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

function createResponse(body, statusCode = 200, event) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": getCorsOrigin(event),
      "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,x-api-key",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function extractApiKey(event) {
  return (
    event.headers?.["x-api-key"] ||
    event.headers?.["X-API-Key"] ||
    event.headers?.["X-Api-Key"] ||
    null
  );
}

function sanitizeDoctorName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .substring(0, 100);
}

exports.handler = async (event) => {
  try {
    const method =
      event.httpMethod ||
      event.requestContext?.http?.method ||
      event.requestContext?.httpMethod;

    if (method === "OPTIONS") {
      return createResponse({ message: "CORS OK" }, 200, event);
    }

    if (method !== "GET") {
      return createResponse(
        { success: false, message: "Method not allowed", doctors: [] },
        405,
        event
      );
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return createResponse(
        { success: false, message: "Supabase configuration missing", doctors: [] },
        500,
        event
      );
    }

    const expectedApiKey = process.env.PUBLIC_API_KEY;
    const receivedApiKey = extractApiKey(event);

    if (!expectedApiKey || !receivedApiKey || receivedApiKey !== expectedApiKey) {
      return createResponse(
        { success: false, message: "Invalid or missing API key", doctors: [] },
        401,
        event
      );
    }

    const { data: doctors, error } = await supabase
      .from("doctors")
      .select("doctor_name, email")
      .order("doctor_name", { ascending: true });

    if (error) {
      throw error;
    }

    const normalizedDoctors = (doctors || [])
      .map((doctor) => ({
        doctor_name: sanitizeDoctorName(doctor.doctor_name),
        email: doctor.email || null,
      }))
      .filter((doctor) => doctor.doctor_name);

    return createResponse(
      {
        success: true,
        doctors: normalizedDoctors,
        names: normalizedDoctors.map((doctor) => doctor.doctor_name),
        total: normalizedDoctors.length,
      },
      200,
      event
    );
  } catch (error) {
    console.error("Public doctors error:", error);
    return createResponse(
      {
        success: false,
        message: error.message || "Internal server error",
        doctors: [],
      },
      500,
      event
    );
  }
};
