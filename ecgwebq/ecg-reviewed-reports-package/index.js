"use strict";

const crypto = require("crypto");
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");
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

function createResponse(body, statusCode = 200, event) {
  return {
    statusCode,
    headers: buildHeaders(event),
    body: JSON.stringify(body),
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
  } catch {
    return null;
  }
}

function extractBearerToken(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice(7).trim();
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
    email: payload.email || null,
  };
}

async function listReviewedObjects(bucketName) {
  let continuationToken;
  const allObjects = [];

  do {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: "doctor-assigned-reports/",
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
    );

    if (Array.isArray(response.Contents)) {
      allObjects.push(...response.Contents);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return allObjects.filter(
    (obj) => obj.Key && obj.Key.includes("/reviewed/") && obj.Key.endsWith(".pdf")
  );
}

function extractDoctorName(key) {
  const match = key.match(/^doctor-assigned-reports\/([^/]+)\/reviewed\//);
  return match ? match[1] : "";
}

exports.handler = async (event) => {
  try {
    const method =
      event.httpMethod ||
      event.requestContext?.http?.method ||
      event.requestContext?.httpMethod;

    if (method === "OPTIONS") {
      return createResponse({ message: "CORS preflight" }, 200, event);
    }

    if (method !== "GET") {
      return createResponse(
        { success: false, message: "Method not allowed" },
        405,
        event
      );
    }

    const token = extractBearerToken(event);
    if (!token) {
      return createResponse(
        {
          success: false,
          error: { message: "Unauthorized - Missing token", code: "UNAUTHORIZED" },
        },
        401,
        event
      );
    }

    const admin = verifyAdminJwt(token);
    if (!admin) {
      return createResponse(
        {
          success: false,
          error: { message: "Unauthorized - Invalid admin token", code: "UNAUTHORIZED" },
        },
        401,
        event
      );
    }

    const bucketName = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET;
    if (!bucketName) {
      throw new Error("S3_BUCKET_NAME or S3_BUCKET is required");
    }

    const reviewedObjects = await listReviewedObjects(bucketName);

    const reports = await Promise.all(
      reviewedObjects.map(async (obj) => {
        const signedUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: bucketName,
            Key: obj.Key,
          }),
          { expiresIn: 3600 }
        );

        return {
          key: obj.Key,
          doctorName: extractDoctorName(obj.Key),
          fileName: obj.Key?.split("/").pop() || "unknown",
          url: signedUrl,
          uploadedAt: obj.LastModified?.toISOString(),
          lastModified: obj.LastModified?.toISOString(),
        };
      })
    );

    reports.sort(
      (a, b) => new Date(b.lastModified || 0).getTime() - new Date(a.lastModified || 0).getTime()
    );

    return createResponse(
      {
        success: true,
        reports,
        total: reports.length,
      },
      200,
      event
    );
  } catch (error) {
    console.error("Reviewed reports error:", error);
    return createResponse(
      {
        success: false,
        error: { message: "Failed to fetch reviewed reports" },
      },
      500,
      event
    );
  }
};
