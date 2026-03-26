"use strict";

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

function sanitizeDoctorName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .substring(0, 100);
}

function sanitizeEmail(value) {
  return String(value || "").trim().toLowerCase().substring(0, 255);
}

function generateTemporaryPassword() {
  return `Doc@${Math.random().toString(36).slice(2, 8)}${Math.floor(100 + Math.random() * 900)}`;
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

    if (method !== "POST") {
      return createResponse(
        { success: false, message: "Method not allowed" },
        405,
        event
      );
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return createResponse(
        { success: false, message: "Supabase configuration missing" },
        500,
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

    let body;
    try {
      body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch {
      return createResponse(
        { success: false, message: "Invalid JSON body" },
        400,
        event
      );
    }

    const doctorName = sanitizeDoctorName(body?.name);
    const email = sanitizeEmail(body?.email);

    if (!doctorName || !email) {
      return createResponse(
        { success: false, message: "name and email are required" },
        400,
        event
      );
    }

    const { data: existingDoctors, error: existingError } = await supabase
      .from("doctors")
      .select("id, doctor_name, email")
      .or(`doctor_name.eq.${doctorName},email.eq.${email}`);

    if (existingError) {
      throw existingError;
    }

    if (existingDoctors && existingDoctors.length > 0) {
      return createResponse(
        {
          success: false,
          message: "Doctor with same name or email already exists",
        },
        409,
        event
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const { data: insertedDoctor, error: insertError } = await supabase
      .from("doctors")
      .insert({
        doctor_name: doctorName,
        email,
        password_hash: passwordHash,
      })
      .select("id, created_at, doctor_name, email")
      .single();

    if (insertError) {
      throw insertError;
    }

    return createResponse(
      {
        success: true,
        message: "Doctor created successfully",
        doctor: insertedDoctor,
        temporaryPassword,
        createdBy: {
          userId: admin.userId,
          email: admin.email,
        },
      },
      201,
      event
    );
  } catch (error) {
    console.error("Create doctor error:", error);
    return createResponse(
      {
        success: false,
        message: error.message || "Internal server error",
      },
      500,
      event
    );
  }
};
