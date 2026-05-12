"use strict";

const crypto = require("crypto");
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");

const INTERNAL_ISSUER = "cardiox-backend";
const INTERNAL_AUDIENCE = "cardiox-api";

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

function jsonResponse(statusCode, body, event) {
  const corsOrigin = getCorsOrigin(event);

  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function verifyAdminToken(token) {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

  const expectedSignature = crypto
    .createHmac('sha256', jwtSecret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest('base64url');

  if (expectedSignature !== parts[2]) {
    throw new Error("Invalid token signature");
  }

  if (payload.iss !== INTERNAL_ISSUER || payload.aud !== INTERNAL_AUDIENCE) {
    throw new Error("Invalid token issuer or audience");
  }

  if (payload.role !== "admin") {
    throw new Error("Admin role required");
  }

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return payload;
}

function getBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice(7).trim();
}

exports.handler = async (event) => {
  try {
    const method =
      event.httpMethod ||
      event.requestContext?.http?.method ||
      event.requestContext?.httpMethod;

    if (method === "OPTIONS") {
      return jsonResponse(200, { success: true }, event);
    }

    if (method !== "GET") {
      return jsonResponse(
        405,
        {
          success: false,
          error: {
            message: "Method not allowed",
            code: "METHOD_NOT_ALLOWED",
          },
        },
        event
      );
    }

    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const token = getBearerToken(authHeader);

    if (!token) {
      return jsonResponse(
        401,
        {
          success: false,
          error: {
            message: "Authorization token required",
            code: "AUTH_REQUIRED",
          },
        },
        event
      );
    }

    try {
      verifyAdminToken(token);
    } catch (authError) {
      console.error("Authentication error:", authError.message);
      return jsonResponse(
        401,
        {
          success: false,
          error: {
            message: "Invalid or expired admin token",
            code: "INVALID_TOKEN",
          },
        },
        event
      );
    }

    const bucketName = process.env.S3_BUCKET_NAME;
    if (!bucketName) {
      return jsonResponse(
        500,
        {
          success: false,
          error: {
            message: "Server configuration incomplete - S3 bucket not specified",
            code: "SERVER_MISCONFIGURED",
          },
        },
        event
      );
    }

    const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    
    const queryStringParameters = event.queryStringParameters || {};
    const statusFilter = queryStringParameters.status;

    if (statusFilter && !["open", "resolved"].includes(statusFilter)) {
      return jsonResponse(
        400,
        {
          success: false,
          error: {
            message: "Invalid status filter. Must be 'open' or 'resolved'",
            code: "VALIDATION_ERROR",
          },
        },
        event
      );
    }

    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: "complaints/",
      });

      const listResponse = await s3Client.send(listCommand);
      const objects = listResponse.Contents || [];

      const complaintPromises = objects
        .filter(obj => obj.Key.endsWith('.json'))
        .map(async (obj) => {
          try {
            const getCommand = new GetObjectCommand({
              Bucket: bucketName,
              Key: obj.Key,
            });

            const getResponse = await s3Client.send(getCommand);
            const complaintString = await getResponse.Body.transformToString();
            return JSON.parse(complaintString);
          } catch (error) {
            console.error(`Error fetching complaint ${obj.Key}:`, error);
            return null;
          }
        });

      const complaints = (await Promise.all(complaintPromises)).filter(Boolean);

      let filteredComplaints = complaints;
      if (statusFilter) {
        filteredComplaints = complaints.filter(complaint => complaint.status === statusFilter);
      }

      filteredComplaints.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

      return jsonResponse(
        200,
        {
          success: true,
          complaints: filteredComplaints,
          total: filteredComplaints.length,
        },
        event
      );
    } catch (s3Error) {
      console.error("S3 error:", s3Error);
      return jsonResponse(
        500,
        {
          success: false,
          error: {
            message: "Failed to retrieve complaints from storage",
            code: "STORAGE_ERROR",
          },
        },
        event
      );
    }
  } catch (error) {
    console.error("Get complaints error:", error);
    return jsonResponse(
      500,
      {
        success: false,
        error: {
          message: "Internal server error",
          code: "INTERNAL_ERROR",
        },
      },
      event || {}
    );
  }
};
