"use strict";

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { createClient } = require("@supabase/supabase-js");
const Busboy = require("busboy");

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

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
    "Access-Control-Allow-Headers": "Content-Type,x-api-key,X-API-Key,Authorization",
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

function validateApiKey(event) {
  const expectedApiKey = process.env.DOCTOR_UPLOAD_API_KEY;
  const providedApiKey =
    event.headers?.["x-api-key"] ||
    event.headers?.["X-API-Key"] ||
    event.headers?.["X-Api-Key"];

  if (!expectedApiKey || !providedApiKey) {
    return false;
  }

  return providedApiKey === expectedApiKey;
}

function sanitizeDoctorName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .substring(0, 100);
}

function sanitizeFileName(value) {
  return String(value || "")
    .trim()
    .replace(/^.*[\\/]/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .substring(0, 200);
}

function sanitizePatientName(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, 60);
}

function generateFileName(originalName, patientName) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const patientPrefix = patientName ? `${sanitizePatientName(patientName)}_` : "";
  const safeOriginal = sanitizeFileName(originalName || "report.pdf");
  const extension = safeOriginal.toLowerCase().endsWith(".pdf") ? ".pdf" : ".pdf";
  return `ECG_Report_${patientPrefix}${timestamp}${extension}`;
}

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    try {
      const headers = event.headers || {};
      const contentType = headers["content-type"] || headers["Content-Type"];
      if (!contentType || !contentType.includes("multipart/form-data")) {
        resolve({ error: "Content-Type must be multipart/form-data" });
        return;
      }

      const fields = {};
      let file = null;

      const busboy = Busboy({
        headers: {
          "content-type": contentType,
        },
      });

      busboy.on("field", (name, value) => {
        fields[name] = value;
      });

      busboy.on("file", (name, stream, info) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => {
          file = {
            fieldName: name,
            filename: info.filename,
            mimeType: info.mimeType,
            buffer: Buffer.concat(chunks),
          };
        });
      });

      busboy.on("error", reject);
      busboy.on("finish", () => resolve({ fields, file }));

      const bodyBuffer = event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64")
        : Buffer.from(event.body || "", "utf8");

      busboy.end(bodyBuffer);
    } catch (error) {
      reject(error);
    }
  });
}

async function resolveDoctorName(fields) {
  const doctorName = sanitizeDoctorName(fields.doctorName || "");
  if (doctorName) {
    return doctorName;
  }

  const doctorId = String(fields.doctorId || "").trim();
  if (!doctorId) {
    return "";
  }

  const { data: doctor, error } = await supabase
    .from("doctors")
    .select("doctor_name")
    .eq("id", doctorId)
    .single();

  if (error || !doctor) {
    return "";
  }

  return sanitizeDoctorName(doctor.doctor_name);
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

    if (!validateApiKey(event)) {
      return createResponse(
        { success: false, message: "Invalid or missing API key" },
        401,
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

    const parsed = await parseMultipart(event);
    if (parsed.error) {
      return createResponse(
        { success: false, message: parsed.error },
        400,
        event
      );
    }

    const { fields, file } = parsed;
    if (!file || !file.buffer || file.buffer.length === 0) {
      return createResponse(
        { success: false, message: "PDF file is required" },
        400,
        event
      );
    }

    const doctorName = await resolveDoctorName(fields);
    if (!doctorName) {
      return createResponse(
        { success: false, message: "doctorName or valid doctorId is required" },
        400,
        event
      );
    }

    const fileName = generateFileName(file.filename || "report.pdf", fields.patientName || "");
    const bucketName = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || "deck-backend-demo";
    const key = `doctor-assigned-reports/${doctorName}/pending/${fileName}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: "application/pdf",
        Metadata: {
          doctorname: doctorName,
          patientname: String(fields.patientName || ""),
          reporttype: String(fields.reportType || "ECG"),
          uploadedby: "teammate-app",
          uploadedat: new Date().toISOString(),
        },
      })
    );

    return createResponse(
      {
        success: true,
        message: "Report uploaded successfully",
        doctorName,
        fileName,
        s3Key: key,
        uploadedAt: new Date().toISOString(),
      },
      200,
      event
    );
  } catch (error) {
    console.error("Doctor upload error:", error);
    return createResponse(
      {
        success: false,
        message: error.message || "Failed to upload report",
      },
      500,
      event
    );
  }
};
