"use strict";

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

function sanitizeToken(value) {
  return String(value || "").trim().substring(0, 256);
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
      return createResponse({ success: false, message: "Method not allowed" }, 405, event);
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return createResponse({ success: false, message: "Supabase configuration missing" }, 500, event);
    }

    let body;
    try {
      body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch {
      return createResponse({ success: false, message: "Invalid JSON body" }, 400, event);
    }

    const token = sanitizeToken(body?.token);
    if (!token) {
      return createResponse({ success: false, message: "token is required" }, 400, event);
    }

    const { data: doctor, error } = await supabase
      .from("doctors")
      .select("id, doctor_name, email, invite_token_expires_at, password_reset_required, activated_at")
      .eq("invite_token", token)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!doctor) {
      return createResponse(
        { success: false, message: "Invalid or expired invite token" },
        404,
        event
      );
    }

    const expiresAt = doctor.invite_token_expires_at ? new Date(doctor.invite_token_expires_at).getTime() : 0;
    if (!expiresAt || Date.now() > expiresAt) {
      return createResponse(
        { success: false, message: "Invite token has expired" },
        410,
        event
      );
    }

    return createResponse(
      {
        success: true,
        data: {
          tokenValid: true,
          doctor_name: doctor.doctor_name,
          email: doctor.email,
          password_reset_required: doctor.password_reset_required,
          activated_at: doctor.activated_at,
        },
      },
      200,
      event
    );
  } catch (error) {
    console.error("Validate invite error:", error);
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
