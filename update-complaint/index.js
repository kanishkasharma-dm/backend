"use strict";

const crypto = require("crypto");
const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");

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
      "Access-Control-Allow-Methods": "PATCH,OPTIONS",
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

function validateRequestBody(body) {
  const { complaint_id, status, admin_notes } = body;

  if (!complaint_id || typeof complaint_id !== "string" || complaint_id.trim().length === 0) {
    return { valid: false, error: "Complaint ID is required and must be a non-empty string" };
  }

  if (status !== undefined) {
    if (!["open", "resolved"].includes(status)) {
      return { valid: false, error: "Status must be either 'open' or 'resolved'" };
    }
  }

  if (admin_notes !== undefined) {
    if (typeof admin_notes !== "string") {
      return { valid: false, error: "Admin notes must be a string" };
    }
  }

  if (status === undefined && admin_notes === undefined) {
    return { valid: false, error: "At least one of 'status' or 'admin_notes' must be provided" };
  }

  return { valid: true };
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

    if (method !== "PATCH") {
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

    let requestBody;
    try {
      requestBody = JSON.parse(event.body || "{}");
    } catch (error) {
      return jsonResponse(
        400,
        {
          success: false,
          error: {
            message: "Invalid JSON",
            code: "INVALID_JSON",
          },
        },
        event
      );
    }

    const validation = validateRequestBody(requestBody);
    if (!validation.valid) {
      return jsonResponse(
        400,
        {
          success: false,
          error: {
            message: validation.error,
            code: "VALIDATION_ERROR",
          },
        },
        event
      );
    }

    const { complaint_id, status, admin_notes } = requestBody;
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
    const key = `complaints/${complaint_id}.json`;

    try {
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const getResponse = await s3Client.send(getCommand);
      const complaintString = await getResponse.Body.transformToString();
      const existingComplaint = JSON.parse(complaintString);

      if (existingComplaint.complaint_id !== complaint_id) {
        return jsonResponse(
          404,
          {
            success: false,
            error: {
              message: "Complaint not found",
              code: "COMPLAINT_NOT_FOUND",
            },
          },
          event
        );
      }

      const updatedComplaint = { ...existingComplaint };

      if (status !== undefined) {
        updatedComplaint.status = status;
        if (status === "resolved") {
          updatedComplaint.resolved_at = new Date().toISOString();
        } else if (status === "open") {
          updatedComplaint.resolved_at = null;
        }
      }

      if (admin_notes !== undefined) {
        updatedComplaint.admin_notes = admin_notes.trim();
      }

      const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: JSON.stringify(updatedComplaint, null, 2),
        ContentType: "application/json",
      });

      await s3Client.send(putCommand);
      console.log(`Successfully updated complaint ${complaint_id}`);

      return jsonResponse(
        200,
        {
          success: true,
          complaint: updatedComplaint,
        },
        event
      );
    } catch (s3Error) {
      if (s3Error.name === 'NoSuchKey' || s3Error.Code === 'NoSuchKey') {
        return jsonResponse(
          404,
          {
            success: false,
            error: {
              message: "Complaint not found",
              code: "COMPLAINT_NOT_FOUND",
            },
          },
          event
        );
      }

      console.error("S3 error:", s3Error);
      return jsonResponse(
        500,
        {
          success: false,
          error: {
            message: "Failed to update complaint in storage",
            code: "STORAGE_ERROR",
          },
        },
        event
      );
    }
  } catch (error) {
    console.error("Update complaint error:", error);
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
