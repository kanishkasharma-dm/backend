"use strict";

const crypto = require("crypto");
const { SendEmailCommand, SESv2Client } = require("@aws-sdk/client-sesv2");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sesClient = new SESv2Client({
  region: process.env.SES_REGION || process.env.AWS_REGION || "us-east-1",
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
  return `Doc@${Math.random().toString(36).slice(2, 8)}${Math.floor(
    100 + Math.random() * 900
  )}`;
}

function generateInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

function buildSetupUrl(token) {
  const baseUrl = process.env.DOCTOR_SETUP_BASE_URL;
  if (!baseUrl) {
    return null;
  }

  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}

async function sendInviteEmail({ email, doctorName, temporaryPassword, setupUrl }) {
  const provider = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  const fromAddress = process.env.EMAIL_FROM;

  if (provider !== "ses" || !fromAddress) {
    return {
      sent: false,
      reason: "EMAIL_NOT_CONFIGURED",
    };
  }

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2>Welcome to CardioX</h2>
      <p>Hello ${doctorName},</p>
      <p>Your doctor account has been created.</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
      <p>Please open this link and set your own password:</p>
      <p><a href="${setupUrl}">${setupUrl}</a></p>
      <p>This link expires in 24 hours.</p>
    </div>
  `;

  const textBody = [
    `Hello ${doctorName},`,
    "",
    "Your doctor account has been created.",
    `Email: ${email}`,
    `Temporary Password: ${temporaryPassword}`,
    "",
    "Set your own password using this link:",
    setupUrl,
    "",
    "This link expires in 24 hours.",
  ].join("\n");

  await sesClient.send(
    new SendEmailCommand({
      FromEmailAddress: fromAddress,
      Destination: {
        ToAddresses: [email],
      },
      Content: {
        Simple: {
          Subject: {
            Data: "Your CardioX doctor account invitation",
          },
          Body: {
            Text: { Data: textBody },
            Html: { Data: htmlBody },
          },
        },
      },
    })
  );

  return {
    sent: true,
    reason: null,
  };
}

exports.handler = async (event) => {
  let createdAuthUserId = null;

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
      .select("id, doctor_name, email, auth_user_id")
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
    const inviteToken = generateInviteToken();
    const inviteTokenExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();
    const nowIso = new Date().toISOString();
    const setupUrl = buildSetupUrl(inviteToken);

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          role: "doctor",
          doctor_name: doctorName,
          password_reset_required: true,
        },
      });

    if (authError) {
      return createResponse(
        {
          success: false,
          message: authError.message || "Failed to create doctor auth user",
        },
        409,
        event
      );
    }

    createdAuthUserId = authData?.user?.id;
    if (!createdAuthUserId) {
      throw new Error("Supabase auth user was not created");
    }

    const { data: insertedDoctor, error: insertError } = await supabase
      .from("doctors")
      .insert({
        auth_user_id: createdAuthUserId,
        doctor_name: doctorName,
        email,
        invite_token: inviteToken,
        invite_token_expires_at: inviteTokenExpiresAt,
        password_reset_required: true,
        invite_sent_at: nowIso,
        updated_at: nowIso,
      })
      .select(
        "id, auth_user_id, created_at, doctor_name, email, invite_token_expires_at, password_reset_required, invite_sent_at, activated_at, updated_at"
      )
      .single();

    if (insertError) {
      await supabase.auth.admin.deleteUser(createdAuthUserId);
      createdAuthUserId = null;
      throw insertError;
    }

    const emailResult = setupUrl
      ? await sendInviteEmail({
          email,
          doctorName,
          temporaryPassword,
          setupUrl,
        })
      : {
          sent: false,
          reason: "SETUP_URL_NOT_CONFIGURED",
        };

    if (emailResult.sent) {
      await supabase
        .from("doctors")
        .update({
          invite_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", insertedDoctor.id);
    }

    return createResponse(
      {
        success: true,
        message: emailResult.sent
          ? "Doctor invited successfully"
          : "Doctor created successfully, but invite email was not sent",
        doctor: insertedDoctor,
        invite: {
          emailSent: emailResult.sent,
          reason: emailResult.reason,
        },
        createdBy: {
          userId: admin.userId,
          email: admin.email,
        },
      },
      201,
      event
    );
  } catch (error) {
    if (createdAuthUserId) {
      await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => {});
    }

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
