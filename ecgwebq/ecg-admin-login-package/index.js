"use strict";

const crypto = require("crypto");

const INTERNAL_ISSUER = "cardiox-backend";
const INTERNAL_AUDIENCE = "cardiox-api";

const rateLimitStore = new Map();

function toBase64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(payload, secret, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const expiresInSeconds = options.expiresInSeconds || 12 * 60 * 60;

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const fullPayload = {
    ...payload,
    iss: options.issuer,
    aud: options.audience,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signingInput}.${signature}`;
}

function checkRateLimit(identifier, limit = 5, windowMs = 60000) {
  const now = Date.now();
  const key = `rate_${identifier}`;

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  const entry = rateLimitStore.get(key);

  if (now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}

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

    const clientIp =
      event.requestContext?.identity?.sourceIp ||
      event.requestContext?.http?.sourceIp ||
      event.headers?.["x-forwarded-for"] ||
      "unknown";

    if (!checkRateLimit(`login_${clientIp}`, 5, 60000)) {
      return jsonResponse(
        429,
        {
          success: false,
          error: {
            message: "Too many login attempts. Please try again later.",
            code: "RATE_LIMIT_EXCEEDED",
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

    const { username, password } = requestBody;

    if (!username || !password) {
      return jsonResponse(
        400,
        {
          success: false,
          error: {
            message: "Username and password are required",
            code: "VALIDATION_ERROR",
          },
        },
        event
      );
    }

    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminDisplayName = process.env.ADMIN_DISPLAY_NAME || "Administrator";
    const adminUserId = process.env.ADMIN_USER_ID || "admin";
    const jwtSecret = process.env.JWT_SECRET;

    if (!adminUsername || !adminPassword || !jwtSecret) {
      return jsonResponse(
        500,
        {
          success: false,
          error: {
            message: "Server configuration is incomplete",
            code: "SERVER_MISCONFIGURED",
          },
        },
        event
      );
    }

    if (username !== adminUsername || password !== adminPassword) {
      return jsonResponse(
        401,
        {
          success: false,
          error: {
            message: "Invalid credentials",
            code: "INVALID_CREDENTIALS",
          },
        },
        event
      );
    }

    const token = signJwt(
      {
        userId: adminUserId,
        email: adminUsername,
        role: "admin",
        name: adminDisplayName,
        tokenType: "admin",
      },
      jwtSecret,
      {
        issuer: INTERNAL_ISSUER,
        audience: INTERNAL_AUDIENCE,
        expiresInSeconds: 12 * 60 * 60,
      }
    );

    return jsonResponse(
      200,
      {
        success: true,
        data: {
          user: {
            userId: adminUserId,
            role: "admin",
            name: adminDisplayName,
            email: adminUsername,
            tokenSource: "internal",
          },
          token,
          expiresIn: "12 hours",
        },
      },
      event
    );
  } catch (error) {
    console.error("Login error:", error);
    return jsonResponse(
      500,
      {
        success: false,
        error: {
          message: "Internal server error during login",
          code: "INTERNAL_ERROR",
        },
      },
      event || {}
    );
  }
};
