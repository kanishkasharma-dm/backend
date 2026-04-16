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

/**
 * Uploads both JSON and PDF to S3 (Twin Upload)
 */
async function uploadECGRecord(recordId, record, pdfBase64) {
  const bucketName = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET;
  if (!bucketName) {
    throw new Error("S3_BUCKET_NAME or S3_BUCKET is required");
  }

  const jsonKey = `ecg-data/${recordId}.json`;
  const pdfKey = `ecg-data/${recordId}.pdf`;

  // Optimization: Clone record and remove base64 PDF from JSON to save space
  const jsonRecord = { ...record };
  delete jsonRecord.pdfReport;

  // 1. Upload JSON Metadata
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: jsonKey,
      Body: JSON.stringify(jsonRecord, null, 2),
      ContentType: "application/json",
      ServerSideEncryption: "AES256",
    })
  );

  // 2. Upload PDF Report
  const pdfPayload = extractBase64Data(pdfBase64);
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

    // Determine Report Type & PDF Report
    const reportType = (requestBody.report_type || requestBody.reportType || "ecg").toLowerCase();
    const pdfReport = requestBody.pdfReport;

    // Base Validation
    if (!pdfReport) {
      return createErrorResponse("Missing required field: pdfReport (base64 encoded)", 400, "VALIDATION_ERROR", event);
    }

    if (!isValidBase64(pdfReport)) {
      return createErrorResponse("Invalid base64 data in PDF report", 400, "VALIDATION_ERROR", event);
    }

    // Flexible Validation based on report type
    if (reportType === "ecg") {
      // Legacy 12-lead check
      if (!requestBody.deviceId && !requestBody.device_details) {
        return createErrorResponse("Missing required fields for ECG: deviceId or device_details", 400, "VALIDATION_ERROR", event);
      }
    } else if (reportType === "hrv") {
      // HRV specific check
      if (!requestBody.hrv_result_reading && !requestBody.rr_intervals) {
        return createErrorResponse("Missing required fields for HRV: hrv_result_reading or rr_intervals", 400, "VALIDATION_ERROR", event);
      }
    } else if (reportType === "hyperkalemia") {
      // Hyperkalemia specific check
      if (!requestBody.clinical_findings || !requestBody.clinical_findings.hyperkalemia) {
        return createErrorResponse("Missing required fields for Hyperkalemia: clinical_findings.hyperkalemia", 400, "VALIDATION_ERROR", event);
      }
    }

    // Determine Record ID (Use patient_details.report_id if available, else generate)
    const recordId = requestBody.patient_details?.report_id || generateRecordId();

    // Create final record object
    const record = {
      ...requestBody,
      recordId,
      reportType,
      uploadedAt: new Date().toISOString(),
      status: "active",
      uploadedBy: {
        userId: user.userId,
        role: user.role,
        email: user.email,
      },
    };

    // Upload to S3
    await uploadECGRecord(recordId, record, pdfReport);

    return createSuccessResponse(
      {
        recordId,
        reportType,
        message: `${reportType.toUpperCase()} record uploaded successfully`,
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
