"use strict";

const crypto = require("crypto");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

function getCorsOrigin(event) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const requestOrigin = event.headers?.origin || event.headers?.Origin;
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return allowedOrigins[0] || "*";
}

function buildHeaders(event) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": getCorsOrigin(event),
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
}

function createSuccessResponse(data, statusCode = 200, event) {
  return {
    statusCode,
    headers: buildHeaders(event),
    body: JSON.stringify({
      success: true,
      data,
    }),
  };
}

function createErrorResponse(message, statusCode = 500, code = "INTERNAL_ERROR", event) {
  return {
    statusCode,
    headers: buildHeaders(event),
    body: JSON.stringify({
      success: false,
      error: {
        message,
        code,
      },
    }),
  };
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding ? normalized + "=".repeat(4 - padding) : normalized;
  return Buffer.from(padded, "base64").toString("utf8");
}

function parseJsonSafely(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function verifyAdminJwt(token) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, receivedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac("sha256", jwtSecret)
    .update(signingInput)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (receivedSignature !== expectedSignature) {
    return null;
  }

  const payload = parseJsonSafely(base64UrlDecode(encodedPayload));
  if (!payload) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now >= payload.exp) {
    return null;
  }

  if (payload.iss !== "cardiox-backend") {
    return null;
  }

  if (payload.aud !== "cardiox-api") {
    return null;
  }

  if (payload.role !== "admin" || payload.tokenType !== "admin") {
    return null;
  }

  return {
    userId: payload.userId,
    role: payload.role,
    email: payload.email || null,
    name: payload.name || "Administrator",
  };
}

function extractBearerToken(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice(7).trim();
}

function sanitizeString(input) {
  if (typeof input !== "string") {
    return "";
  }

  return input
    .trim()
    .replace(/[<>]/g, "")
    .replace(/['"]/g, "")
    .substring(0, 1000);
}

function isValidBase64(input) {
  if (typeof input !== "string" || input.length === 0) {
    return false;
  }

  const data = extractBase64Data(input);
  try {
    Buffer.from(data.data, "base64");
    return true;
  } catch (error) {
    return false;
  }
}

function extractBase64Data(base64String) {
  const matches = base64String.match(/^data:(.+?);base64,(.+)$/);
  if (matches && matches.length === 3) {
    return {
      mimeType: matches[1],
      data: matches[2],
    };
  }

  return {
    mimeType: "application/octet-stream",
    data: base64String,
  };
}

function generateRecordId() {
  const now = new Date();
  const timestamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0"),
  ].join("");

  const suffix = crypto.randomBytes(4).toString("hex");
  return `ECG_Report_${timestamp}_${suffix}`;
}

async function uploadECGRecord(recordId, record) {
  const bucketName = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET;
  if (!bucketName) {
    throw new Error("S3_BUCKET_NAME or S3_BUCKET is required");
  }

  const jsonKey = `ecg-data/${recordId}.json`;
  const pdfKey = `ecg-data/${recordId}.pdf`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: jsonKey,
      Body: JSON.stringify(record, null, 2),
      ContentType: "application/json",
      ServerSideEncryption: "AES256",
    })
  );

  const pdfPayload = extractBase64Data(record.pdfReport);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: pdfKey,
      Body: Buffer.from(pdfPayload.data, "base64"),
      ContentType: pdfPayload.mimeType || "application/pdf",
      ServerSideEncryption: "AES256",
    })
  );
}

exports.handler = async (event) => {
  try {
    const method =
      event.httpMethod ||
      event.requestContext?.http?.method ||
      event.requestContext?.httpMethod;

    if (method === "OPTIONS") {
      return createSuccessResponse({ message: "CORS preflight" }, 200, event);
    }

    if (method !== "POST") {
      return createErrorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED", event);
    }

    const token = extractBearerToken(event);
    if (!token) {
      return createErrorResponse("Unauthorized - Missing token", 401, "UNAUTHORIZED", event);
    }

    const user = verifyAdminJwt(token);
    if (!user) {
      return createErrorResponse("Unauthorized - Invalid admin token", 401, "UNAUTHORIZED", event);
    }

    let requestBody;
    try {
      requestBody = JSON.parse(event.body || "{}");
    } catch (error) {
      return createErrorResponse("Invalid JSON in request body", 400, "INVALID_JSON", event);
    }

    const { deviceId, patient, ecgData, pdfReport } = requestBody;

    if (!deviceId || !patient || !ecgData || !pdfReport) {
      return createErrorResponse(
        "Missing required fields: deviceId, patient, ecgData, pdfReport",
        400,
        "VALIDATION_ERROR",
        event
      );
    }

    if (!patient.name || !patient.phone || !patient.age || !patient.gender) {
      return createErrorResponse(
        "Missing required patient fields: name, phone, age, gender",
        400,
        "VALIDATION_ERROR",
        event
      );
    }

    if (!ecgData.duration || !ecgData.leads || !ecgData.sampleRate || !ecgData.waveform) {
      return createErrorResponse(
        "Missing required ECG data fields: duration, leads, sampleRate, waveform",
        400,
        "VALIDATION_ERROR",
        event
      );
    }

    if (!isValidBase64(ecgData.waveform)) {
      return createErrorResponse("Invalid base64 data in ECG waveform", 400, "VALIDATION_ERROR", event);
    }

    if (!isValidBase64(pdfReport)) {
      return createErrorResponse("Invalid base64 data in PDF report", 400, "VALIDATION_ERROR", event);
    }

    const recordId = generateRecordId();

    const record = {
      recordId,
      deviceId: sanitizeString(deviceId),
      patient: {
        name: sanitizeString(patient.name),
        phone: sanitizeString(patient.phone),
        email: sanitizeString(patient.email || ""),
        age: parseInt(patient.age, 10),
        gender: sanitizeString(patient.gender),
        address: sanitizeString(patient.address || ""),
        medicalHistory: Array.isArray(patient.medicalHistory)
          ? patient.medicalHistory.map((item) => sanitizeString(item))
          : [],
      },
      ecgData: {
        duration: parseInt(ecgData.duration, 10),
        leads: parseInt(ecgData.leads, 10),
        sampleRate: parseInt(ecgData.sampleRate, 10),
        waveform: extractBase64Data(ecgData.waveform).data,
      },
      pdfReport,
      createdAt: new Date().toISOString(),
      status: "active",
      uploadedBy: {
        userId: user.userId,
        role: user.role,
        email: user.email,
      },
    };

    await uploadECGRecord(recordId, record);

    return createSuccessResponse(
      {
        recordId,
        message: "ECG record uploaded successfully",
        timestamp: new Date().toISOString(),
      },
      200,
      event
    );
  } catch (error) {
    console.error("Upload error:", error);
    return createErrorResponse("Internal server error during upload", 500, "INTERNAL_ERROR", event);
  }
};
