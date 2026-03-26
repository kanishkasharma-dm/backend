"use strict";

const jwt = require("jsonwebtoken");
const { DeleteObjectCommand, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

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

function verifyDoctorToken(event) {
  const token = extractBearerToken(event);
  if (!token) {
    return null;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const doctorName = String(decoded.doctor_name || decoded.doctor_id || "")
      .replace(/[^a-zA-Z0-9_]/g, "")
      .substring(0, 50);

    if (!doctorName) {
      return null;
    }

    return {
      userId: decoded.doctor_id || null,
      doctorName,
    };
  } catch (error) {
    console.error("Doctor JWT verification failed:", error.message);
    return null;
  }
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

    const doctor = verifyDoctorToken(event);
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

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || "deck-backend-demo",
        Key: `doctor-assigned-reports/${doctor.doctorName}/pending/${originalFileName}`,
      })
    );

    return createResponse(
      {
        success: true,
        data: {
          key: uploadResult.Key,
          etag: uploadResult.ETag,
          doctor: {
            userId: doctor.userId,
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
