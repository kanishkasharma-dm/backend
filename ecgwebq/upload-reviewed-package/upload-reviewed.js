"use strict";

const { DeleteObjectCommand, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { createClient } = require("@supabase/supabase-js");

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

let supabaseClient;

function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
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

function badRequest(message, event) {
  return createResponse(
    {
      success: false,
      error: { message },
    },
    400,
    event
  );
}

function extractBearerToken(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice(7).trim();
}

async function verifyDoctorToken(event) {
  const token = extractBearerToken(event);
  if (!token) {
    return null;
  }

  const client = getSupabaseClient();
  const { data, error } = await client.auth.getUser(token);

  if (error || !data?.user) {
    console.error("Supabase token verification failed:", error?.message || error);
    return null;
  }

  const user = data.user;
  const doctorName =
    user.user_metadata?.doctor_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    user.id;

  return {
    userId: user.id,
    email: user.email || null,
    doctorName: doctorName.replace(/[^a-zA-Z0-9_]/g, "").substring(0, 50),
  };
}

function parseMultipart(event, contentType) {
  const boundaryMatch = /boundary=([^;]+)/i.exec(contentType);
  if (!boundaryMatch) {
    return { error: "Invalid multipart boundary" };
  }

  const boundary = "--" + boundaryMatch[1];
  const bodyBuffer = event.isBase64Encoded
    ? Buffer.from(event.body, "base64")
    : Buffer.from(event.body || "", "utf8");

  const parts = bodyBuffer
    .toString("binary")
    .split(boundary)
    .filter((part) => part.includes("Content-Disposition"));

  let originalFileName = "";
  let pdfBuffer = null;

  for (const part of parts) {
    const [rawHeaders, rawContent] = part.split("\r\n\r\n");
    if (!rawContent) continue;

    const headersLines = rawHeaders.split("\r\n").filter(Boolean);
    const dispositionLine =
      headersLines.find((header) => header.toLowerCase().startsWith("content-disposition")) || "";
    const nameMatch = /name="([^"]+)"/i.exec(dispositionLine);
    const filenameMatch = /filename="([^"]+)"/i.exec(dispositionLine);
    const fieldName = nameMatch?.[1];

    const cleaned = rawContent.replace(/\r\n--$/g, "");

    if (filenameMatch && fieldName === "reviewedPdf") {
      pdfBuffer = Buffer.from(cleaned, "binary");
      if (!originalFileName) {
        originalFileName = filenameMatch[1];
      }
    } else if (fieldName === "originalFileName") {
      originalFileName = cleaned.trim();
    }
  }

  if (!pdfBuffer) {
    return { error: "Missing reviewedPdf file" };
  }

  if (!originalFileName) {
    return { error: "Missing originalFileName field" };
  }

  return { pdfBuffer, originalFileName };
}

async function uploadReviewedPDF(baseName, pdfBuffer, doctorName) {
  const bucketName = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET;
  if (!bucketName) {
    throw new Error("S3_BUCKET_NAME or S3_BUCKET is required");
  }

  const key = `doctor-assigned-reports/${doctorName}/reviewed/${baseName}.pdf`;

  const result = await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
      ServerSideEncryption: "AES256",
    })
  );

  return {
    Key: key,
    ETag: result.ETag || "",
  };
}

exports.handler = async (event) => {
  try {
    const httpMethod =
      event.httpMethod ||
      event.requestContext?.http?.method ||
      event.requestContext?.httpMethod;

    const routeKey = event.routeKey;
    const method = httpMethod || (routeKey ? routeKey.split(" ")[0] : null);

    if (method === "OPTIONS") {
      return createResponse({ message: "CORS preflight" }, 200, event);
    }

    if (method !== "POST") {
      return createResponse({ success: false, message: "Method not allowed" }, 405, event);
    }

    const doctor = await verifyDoctorToken(event);
    if (!doctor || !doctor.doctorName) {
      return createResponse(
        {
          success: false,
          error: { message: "Invalid or missing authentication token" },
        },
        401,
        event
      );
    }

    const headers = event.headers || {};
    const contentType =
      headers["content-type"] ||
      headers["Content-Type"] ||
      headers["content-type".toLowerCase()] ||
      headers["Content-Type".toLowerCase()];

    if (!contentType || !contentType.includes("multipart/form-data")) {
      return badRequest("Content-Type must be multipart/form-data", event);
    }

    if (!event.body) {
      return badRequest("Request body is required", event);
    }

    const parsed = parseMultipart(event, contentType);
    if (parsed.error) {
      return badRequest(parsed.error, event);
    }

    const { pdfBuffer, originalFileName } = parsed;
    const baseName = originalFileName.replace(/^.*[\\/]/, "").replace(/\.pdf$/i, "");

    const uploadResult = await uploadReviewedPDF(baseName, pdfBuffer, doctor.doctorName);

    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || "deck-backend-demo",
      Key: `doctor-assigned-reports/${doctor.doctorName}/pending/${originalFileName}`,
    });

    await s3Client.send(deleteCommand);

    return createResponse(
      {
        success: true,
        data: {
          key: uploadResult.Key,
          etag: uploadResult.ETag,
          doctor: {
            userId: doctor.userId,
            email: doctor.email,
            doctorName: doctor.doctorName,
          },
        },
      },
      200,
      event
    );
  } catch (error) {
    console.error("Upload reviewed error:", error);

    return createResponse(
      {
        success: false,
        error: { message: "Internal server error" },
      },
      500,
      event
    );
  }
};
