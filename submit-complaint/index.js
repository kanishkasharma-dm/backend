"use strict";

const crypto = require("crypto");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

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
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function generateUUID() {
  return crypto.randomUUID();
}

function validateRequestBody(body) {
  const { name, machine_id, complaint, source } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return { valid: false, error: "Name is required and must be a non-empty string" };
  }

  if (!machine_id || typeof machine_id !== "string" || machine_id.trim().length === 0) {
    return { valid: false, error: "Machine ID is required and must be a non-empty string" };
  }

  if (!complaint || typeof complaint !== "string" || complaint.trim().length === 0) {
    return { valid: false, error: "Complaint is required and must be a non-empty string" };
  }

  if (!source || !["software", "app"].includes(source)) {
    return { valid: false, error: "Source must be either 'software' or 'app'" };
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

    if (method !== "POST") {
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

    const { name, machine_id, complaint, source } = requestBody;
    const complaint_id = generateUUID();
    const created_at = new Date().toISOString();

    const complaintData = {
      complaint_id,
      name: name.trim(),
      machine_id: machine_id.trim(),
      complaint: complaint.trim(),
      source,
      status: "open",
      created_at,
      resolved_at: null,
      admin_notes: "",
    };

    const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
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

    const key = `complaints/${complaint_id}.json`;
    
    try {
      const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: JSON.stringify(complaintData, null, 2),
        ContentType: "application/json",
      });

      await s3Client.send(putCommand);
      console.log(`Successfully saved complaint ${complaint_id} to S3`);

      return jsonResponse(
        200,
        {
          success: true,
          complaint_id,
        },
        event
      );
    } catch (s3Error) {
      console.error("S3 upload error:", s3Error);
      return jsonResponse(
        500,
        {
          success: false,
          error: {
            message: "Failed to save complaint to storage",
            code: "STORAGE_ERROR",
          },
        },
        event
      );
    }
  } catch (error) {
    console.error("Submit complaint error:", error);
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
