"use strict";

const { createClient } = require("@supabase/supabase-js");
const jwt = require("jsonwebtoken");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
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

function createResponse(event, body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": getCorsOrigin(event),
      "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function generateToken(doctor) {
  return jwt.sign(
    {
      doctor_id: doctor.id,
      auth_user_id: doctor.auth_user_id,
      doctor_name: doctor.doctor_name,
      email: doctor.email,
      role: "doctor",
      tokenType: "doctor",
    },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
}

exports.handler = async (event) => {
  try {
    const method =
      event.httpMethod ||
      event.requestContext?.http?.method ||
      event.requestContext?.httpMethod;

    if (method === "OPTIONS") {
      return createResponse(event, { message: "CORS preflight" }, 200);
    }

    if (method !== "POST") {
      return createResponse(
        event,
        { success: false, message: "Method not allowed" },
        405
      );
    }

    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.JWT_SECRET
    ) {
      return createResponse(
        event,
        { success: false, message: "Server configuration error" },
        500
      );
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return createResponse(
        event,
        { success: false, message: "Invalid JSON in request body" },
        400
      );
    }

    console.log("LOGIN_BODY", body);

    const rawLogin = String(body.email || body.doctor_name || "").trim();
    const password = String(body.password || "");

    if (!rawLogin || !password) {
      return createResponse(
        event,
        {
          success: false,
          message: "email or doctor_name and password are required",
        },
        400
      );
    }

    let doctor = null;
    let loginEmail = "";

    if (rawLogin.includes("@")) {
      loginEmail = rawLogin.toLowerCase();

      const { data: doctorByEmail, error: doctorEmailError } = await supabase
        .from("doctors")
        .select(
          "id, auth_user_id, doctor_name, email, password_reset_required, activated_at, updated_at"
        )
        .ilike("email", loginEmail)
        .maybeSingle();

      if (doctorEmailError) {
        console.error("DOCTOR_EMAIL_LOOKUP_ERROR", doctorEmailError);
        throw doctorEmailError;
      }

      doctor = doctorByEmail;
    } else {
      const doctorName = rawLogin.replace(/\s+/g, "_");

      const { data: doctorByName, error: doctorNameError } = await supabase
        .from("doctors")
        .select(
          "id, auth_user_id, doctor_name, email, password_reset_required, activated_at, updated_at"
        )
        .ilike("doctor_name", doctorName)
        .maybeSingle();

      if (doctorNameError) {
        console.error("DOCTOR_NAME_LOOKUP_ERROR", doctorNameError);
        throw doctorNameError;
      }

      doctor = doctorByName;
      loginEmail = doctorByName?.email || "";
    }

    console.log("DOCTOR_LOOKUP_RESULT", {
      rawLogin,
      found: !!doctor,
      doctorId: doctor?.id || null,
      authUserId: doctor?.auth_user_id || null,
      loginEmail,
    });

    if (!doctor || !loginEmail) {
      return createResponse(
        event,
        { success: false, message: "Doctor not found" },
        404
      );
    }

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

    if (authError || !authData?.user?.id) {
      console.error("SUPABASE_AUTH_FAILED", {
        loginEmail,
        error: authError?.message || null,
      });

      return createResponse(
        event,
        { success: false, message: "Invalid credentials" },
        401
      );
    }

    if (doctor.auth_user_id && doctor.auth_user_id !== authData.user.id) {
      console.error("AUTH_USER_ID_MISMATCH", {
        doctorAuthUserId: doctor.auth_user_id,
        supabaseUserId: authData.user.id,
      });

      return createResponse(
        event,
        {
          success: false,
          message: "Doctor auth mapping mismatch. Please contact admin.",
        },
        409
      );
    }

    if (!doctor.auth_user_id) {
      const { data: updatedDoctor, error: updateError } = await supabase
        .from("doctors")
        .update({
          auth_user_id: authData.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", doctor.id)
        .select(
          "id, auth_user_id, doctor_name, email, password_reset_required, activated_at, updated_at"
        )
        .single();

      if (updateError) {
        console.error("AUTH_USER_ID_BACKFILL_ERROR", updateError);
        throw updateError;
      }

      doctor = updatedDoctor;
    }

    const token = generateToken(doctor);

    return createResponse(
      event,
      {
        success: true,
        token,
        doctor: {
          id: doctor.id,
          auth_user_id: doctor.auth_user_id,
          doctor_name: doctor.doctor_name,
          email: doctor.email,
          password_reset_required: doctor.password_reset_required,
          activated_at: doctor.activated_at,
          updated_at: doctor.updated_at,
        },
      },
      200
    );
  } catch (error) {
    console.error("Doctor login error:", error);
    return createResponse(
      event,
      { success: false, message: "Authentication failed. Please try again." },
      500
    );
  }
};
