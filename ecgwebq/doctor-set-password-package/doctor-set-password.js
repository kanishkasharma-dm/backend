"use strict";

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

function sanitizeToken(value) {
  return String(value || "").trim().substring(0, 256);
}

function validatePassword(value) {
  const password = String(value || "");
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must contain at least one letter and one number";
  }

  return null;
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
    const newPassword = String(body?.newPassword || "");

    if (!token || !newPassword) {
      return createResponse({ success: false, message: "token and newPassword are required" }, 400, event);
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return createResponse({ success: false, message: passwordError }, 400, event);
    }

    const { data: doctor, error } = await supabase
      .from("doctors")
      .select("id, doctor_name, invite_token_expires_at")
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

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const nowIso = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("doctors")
      .update({
        password_hash: passwordHash,
        invite_token: null,
        invite_token_expires_at: null,
        password_reset_required: false,
        activated_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", doctor.id);

    if (updateError) {
      throw updateError;
    }

    return createResponse(
      {
        success: true,
        message: "Password updated successfully",
        doctor: {
          id: doctor.id,
          doctor_name: doctor.doctor_name,
        },
      },
      200,
      event
    );
  } catch (error) {
    console.error("Set password error:", error);
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
