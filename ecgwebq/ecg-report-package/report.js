"use strict";

const crypto = require("crypto");
const { S3Client, HeadObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

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
    "Access-Control-Allow-Methods": "GET,OPTIONS",
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

async function checkRecordExists(bucketName, key) {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound") {
      return false;
    }
    throw error;
  }
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

    if (method !== "GET") {
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

    const reportId = sanitizeString(event.queryStringParameters?.id || "");
    if (!reportId) {
      return createErrorResponse("Report ID is required", 400, "VALIDATION_ERROR", event);
    }

    const bucketName = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET;
    if (!bucketName) {
      throw new Error("S3_BUCKET_NAME or S3_BUCKET is required");
    }

    const jsonKey = `ecg-data/${reportId}.json`;
    const pdfKey = `ecg-data/${reportId}.pdf`;

    const exists = await checkRecordExists(bucketName, jsonKey);
    if (!exists) {
      return createErrorResponse("Report not found", 404, "NOT_FOUND", event);
    }

    const jsonUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: jsonKey,
      }),
      { expiresIn: 300 }
    );

    const pdfUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: pdfKey,
      }),
      { expiresIn: 300 }
    );

    return createSuccessResponse(
      {
        reportId,
        jsonUrl,
        pdfUrl,
        expiresIn: 300,
        generatedAt: new Date().toISOString(),
      },
      200,
      event
    );
  } catch (error) {
    console.error("Report fetch error:", error);
    return createErrorResponse("Failed to fetch report", 500, "INTERNAL_ERROR", event);
  }
};
