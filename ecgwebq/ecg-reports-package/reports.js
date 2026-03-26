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

function createSuccessResponse(data, statusCode = 200, metadata, event) {
  return {
    statusCode,
    headers: buildHeaders(event),
    body: JSON.stringify({
      success: true,
      data,
      ...(metadata ? { metadata } : {}),
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

function validatePagination(page, limit) {
  const pageNum = parseInt(page || "1", 10);
  const limitNum = parseInt(limit || "50", 10);

  if (Number.isNaN(pageNum) || Number.isNaN(limitNum) || pageNum < 1 || limitNum < 1 || limitNum > 100) {
    return null;
  }

  return {
    page: pageNum,
    limit: limitNum,
  };
}

function extractRecordId(key) {
  return key.replace(/^ecg-data\//, "").replace(/\.(pdf|json)$/, "");
}

async function listECGObjects(bucketName) {
  let continuationToken;
  const objects = [];

  do {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: "ecg-data/",
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
    );

    if (Array.isArray(response.Contents)) {
      objects.push(...response.Contents);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

async function buildFileResponse(bucketName, object) {
  const recordId = extractRecordId(object.Key);
  const key = object.Key;
  const name = key.split("/").pop() || key;

  if (key.endsWith(".json")) {
    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
      { expiresIn: 300 }
    );

    return {
      key,
      name,
      size: object.Size || 0,
      lastModified: object.LastModified,
      type: "application/json",
      url,
      recordId,
    };
  }

  if (key.endsWith(".pdf")) {
    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
      { expiresIn: 300 }
    );

    return {
      key,
      name,
      size: object.Size || 0,
      lastModified: object.LastModified,
      type: "application/pdf",
      url,
      recordId,
    };
  }

  return {
    key,
    name,
    size: object.Size || 0,
    lastModified: object.LastModified,
    type: "application/octet-stream",
    url: null,
    recordId,
  };
}

exports.handler = async (event) => {
  try {
    const method =
      event.httpMethod ||
      event.requestContext?.http?.method ||
      event.requestContext?.httpMethod;

    if (method === "OPTIONS") {
      return createSuccessResponse({ message: "CORS preflight" }, 200, undefined, event);
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

    const queryStringParameters = event.queryStringParameters || {};
    const pagination = validatePagination(queryStringParameters.page, queryStringParameters.limit);
    if (!pagination) {
      return createErrorResponse(
        "Invalid pagination parameters. Page must be >= 1 and limit must be between 1-100",
        400,
        "VALIDATION_ERROR",
        event
      );
    }

    const search = (queryStringParameters.search || "").toLowerCase();
    const bucketName = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET;
    if (!bucketName) {
      throw new Error("S3_BUCKET_NAME or S3_BUCKET is required");
    }

    const allObjects = await listECGObjects(bucketName);

    let filteredObjects = allObjects;
    if (search) {
      filteredObjects = allObjects.filter((object) => object.Key.toLowerCase().includes(search));
    }

    filteredObjects.sort((a, b) => {
      const dateA = new Date(a.LastModified || "").getTime();
      const dateB = new Date(b.LastModified || "").getTime();
      return dateB - dateA;
    });

    const total = filteredObjects.length;
    const totalPages = Math.ceil(total / pagination.limit);
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    const paginatedObjects = filteredObjects.slice(startIndex, endIndex);

    const files = await Promise.all(
      paginatedObjects.map(async (object) => {
        try {
          return await buildFileResponse(bucketName, object);
        } catch (error) {
          console.error(`Error generating URL for ${object.Key}:`, error);
          return {
            key: object.Key,
            name: object.Key.split("/").pop() || object.Key,
            size: object.Size || 0,
            lastModified: object.LastModified,
            type: "application/octet-stream",
            url: null,
            recordId: extractRecordId(object.Key),
          };
        }
      })
    );

    return createSuccessResponse(
      {
        files,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages,
          hasNext: pagination.page < totalPages,
          hasPrev: pagination.page > 1,
        },
      },
      200,
      { total },
      event
    );
  } catch (error) {
    console.error("Reports list error:", error);
    return createErrorResponse("Failed to fetch reports", 500, "INTERNAL_ERROR", event);
  }
};
