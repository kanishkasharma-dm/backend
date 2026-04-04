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

function sanitizeEmail(value) {
  return String(value || "").trim().toLowerCase().substring(0, 255);
}

function validatePassword(value) {
  const password = String(value || "");
  if (password.length < 10) {
    return "Password must be at least 10 characters long";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }

  if (!/\d/.test(password)) {
    return "Password must contain at least one number";
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least one special character";
  }

  return null;
}

async function verifyTemporaryPassword(email, temporaryPassword) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: temporaryPassword,
  });

  if (error || !data?.user?.id) {
    return {
      ok: false,
      message: "Invalid temporary password",
    };
  }

  await supabase.auth.signOut().catch(() => {});

  return {
    ok: true,
    authUserId: data.user.id,
  };
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
    const email = sanitizeEmail(body?.email);
    const temporaryPassword = String(body?.temporaryPassword || "");
    const newPassword = String(body?.newPassword || "");
    const confirmPassword = String(body?.confirmPassword || "");

    if (!token || !email || !temporaryPassword || !newPassword) {
      return createResponse(
        {
          success: false,
          message: "token, email, temporaryPassword and newPassword are required",
        },
        400,
        event
      );
    }

    if (confirmPassword && confirmPassword !== newPassword) {
      return createResponse(
        { success: false, message: "New password and confirm password do not match" },
        400,
        event
      );
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return createResponse({ success: false, message: passwordError }, 400, event);
    }

    const { data: doctor, error } = await supabase
      .from("doctors")
      .select(
        "id, auth_user_id, doctor_name, email, invite_token_expires_at, password_reset_required"
      )
      .eq("invite_token", token)
      .eq("email", email)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!doctor) {
      return createResponse(
        { success: false, message: "Invalid invite token or email" },
        404,
        event
      );
    }

    if (!doctor.auth_user_id) {
      return createResponse(
        {
          success: false,
          message: "Doctor auth user is not linked. Please recreate the doctor account.",
        },
        409,
        event
      );
    }

    if (doctor.password_reset_required === false) {
      return createResponse(
        {
          success: false,
          message: "Password has already been set. Please log in with your current password.",
        },
        409,
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

    const tempPasswordCheck = await verifyTemporaryPassword(email, temporaryPassword);
    if (!tempPasswordCheck.ok) {
      return createResponse(
        {
          success: false,
          message: tempPasswordCheck.message,
        },
        401,
        event
      );
    }

    if (tempPasswordCheck.authUserId !== doctor.auth_user_id) {
      return createResponse(
        {
          success: false,
          message: "Temporary password does not belong to this doctor account",
        },
        401,
        event
      );
    }

    const nowIso = new Date().toISOString();

    const { error: passwordUpdateError } = await supabase.auth.admin.updateUserById(
      doctor.auth_user_id,
      {
        password: newPassword,
        user_metadata: {
          role: "doctor",
          doctor_name: doctor.doctor_name,
          password_reset_required: false,
        },
      }
    );

    if (passwordUpdateError) {
      return createResponse(
        {
          success: false,
          message: passwordUpdateError.message || "Failed to update doctor password",
        },
        400,
        event
      );
    }

    const { data: updatedDoctor, error: updateError } = await supabase
      .from("doctors")
      .update({
        invite_token: null,
        invite_token_expires_at: null,
        password_reset_required: false,
        activated_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", doctor.id)
      .select(
        "id, auth_user_id, doctor_name, email, password_reset_required, invite_sent_at, activated_at, updated_at"
      )
      .single();

    if (updateError) {
      throw updateError;
    }

    return createResponse(
      {
        success: true,
        message: "Password updated successfully",
        doctor: updatedDoctor,
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
