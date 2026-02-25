export const handler = async (event) => {
  // TODO implement
  const response = {
    statusCode: 200,
    body: JSON.stringify('Hello from Lambda!'),
  };
  return response;"use strict";
/**
 * API Handler: GET /api/public/reviewed-reports
 * Public endpoint to access reviewed reports without JWT authentication
 * For external teammate integration
 */

const { ListObjectsV2Command, S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const BUCKET = "deck-backend-demo";
const s3Client = new S3Client({ region: "us-east-1" });

function createResponse(body, statusCode = 200) {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers":
                "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
        },
        body: JSON.stringify(body),
    };
}

async function generatePresignedUrl(key) {
    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn: 300 });
}

exports.handler = async (event) => {
    try {
        // Support REST + HTTP API
        const method =
            event.httpMethod ||
            event.requestContext?.http?.method ||
            event.requestContext?.httpMethod;

        if (method === "OPTIONS") {
            return createResponse({ message: "CORS OK" }, 200);
        }

        if (method !== "GET") {
            return createResponse(
                { success: false, message: "Method not allowed", reports: [] },
                405
            );
        }

        // Get doctorName from query parameter
        const doctorName = event.queryStringParameters?.doctor || event.queryParameters?.doctor;
        
        if (!doctorName) {
            return createResponse(
                { success: false, message: "doctorName parameter is required", reports: [] },
                400
            );
        }

        // Sanitize doctorName to prevent path traversal
        const sanitizedDoctorName = doctorName.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 50);
        
        const prefix = `doctor-assigned-reports/${sanitizedDoctorName}/reviewed/`;
        
        const command = new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: prefix,
            MaxKeys: 1000,
        });

        const response = await s3Client.send(command);
        
        const pdfObjects = response.Contents?.filter(
            (obj) => obj.Key && obj.Key.endsWith(".pdf")
        ) || [];

        const reports = [];

        for (const obj of pdfObjects) {
            try {
                const key = obj.Key;
                const fileName = key.split("/").pop();
                const presignedUrl = await generatePresignedUrl(key);

                reports.push({
                    key,
                    fileName,
                    doctorName: sanitizedDoctorName,
                    url: presignedUrl,
                    uploadedAt: obj.LastModified?.toISOString(),
                });
            } catch (error) {
                console.error(`Error processing file ${obj.Key}:`, error);
                // skip invalid file
            }
        }

        // Sort by upload date (newest first)
        reports.sort((a, b) => 
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );

        return createResponse(
            {
                success: true,
                reports,
                total: reports.length,
                doctorName: sanitizedDoctorName
            },
            200
        );
    } catch (error) {
        console.error("ERROR in public reviewed reports:", error);

        return createResponse(
            {
                success: false,
                message: "Internal server error",
                reports: [],
            },
            500
        );
    }
};
};
"use strict";
/**
 * API Handler: POST /api/doctor/upload-reviewed
 * Accepts multipart/form-data with reviewedPdf, originalFileName
 * Uses JWT authentication to extract doctor identity
 */

Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;

const s3Service_1 = require("./services/s3Service");
const response_1 = require("./utils/response");
const jwt = require('jsonwebtoken'); // Add JWT import

function badRequest(message) {
    return {
        statusCode: 400,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        body: JSON.stringify({
            success: false,
            error: { message },
        }),
    };
}

// Add JWT extraction function
function extractDoctorFromToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    const token = authHeader.substring(7);
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.doctor_name || decoded.doctor_id;
    } catch (error) {
        console.error('JWT verification failed:', error);
        return null;
    }
}

exports.handler = (0, response_1.withErrorHandler)(async (event) => {
    console.log('Upload reviewed event received:', JSON.stringify(event, null, 2));
    
    // Support both REST API (v1) and HTTP API (v2) event formats
    const httpMethod = event.httpMethod || event.requestContext?.http?.method || event.requestContext?.httpMethod;
    const routeKey = event.routeKey; // HTTP API v2 format: "POST /api/doctor/upload-reviewed"
    
    // Check method - support both formats
    const method = httpMethod || (routeKey ? routeKey.split(' ')[0] : null);
    
    if (method !== "POST") {
        if (method === "OPTIONS") {
            return (0, response_1.createSuccessResponse)({ message: "CORS preflight" }, 200);
        }
        return (0, response_1.createSuccessResponse)({ message: "Method not allowed" }, 405);
    }

    // 🔑 JWT AUTHENTICATION - Extract doctor from token
    const headers = event.headers || {};
    const authHeader = headers.Authorization || headers.authorization;
    console.log('Auth header:', authHeader);
    
    const doctorName = extractDoctorFromToken(authHeader);
    console.log('Extracted doctor name:', doctorName);
    
    if (!doctorName) {
        return {
            statusCode: 401,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
                "Access-Control-Allow-Methods": "POST,OPTIONS",
            },
            body: JSON.stringify({
                success: false,
                error: { message: "Invalid or missing authentication token" },
            }),
        };
    }

    // Support both REST API and HTTP API v2 header formats
    const contentType = headers["content-type"] ||
        headers["Content-Type"] ||
        headers["content-type".toLowerCase()] ||
        headers["Content-Type".toLowerCase()];
    
    if (!contentType || !contentType.includes("multipart/form-data")) {
        return badRequest("Content-Type must be multipart/form-data");
    }
    
    if (!event.body) {
        return badRequest("Request body is required");
    }
    
    const boundaryMatch = /boundary=([^;]+)/i.exec(contentType);
    if (!boundaryMatch) {
        return badRequest("Invalid multipart boundary");
    }
    
    const boundary = "--" + boundaryMatch[1];
    const bodyBuffer = event.isBase64Encoded
        ? Buffer.from(event.body, "base64")
        : Buffer.from(event.body, "utf8");
    
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
        const dispositionLine = headersLines.find((h) => h.toLowerCase().startsWith("content-disposition")) || "";
        const nameMatch = /name="([^"]+)"/i.exec(dispositionLine);
        const filenameMatch = /filename="([^"]+)"/i.exec(dispositionLine);
        const fieldName = nameMatch?.[1];
        
        // Trim trailing boundary markers/newlines
        const cleaned = rawContent.replace(/\r\n--$/g, "");
        
        if (filenameMatch && fieldName === "reviewedPdf") {
            // File content
            pdfBuffer = Buffer.from(cleaned, "binary");
            if (!originalFileName) {
                originalFileName = filenameMatch[1];
            }
        }
        else if (fieldName === "originalFileName") {
            originalFileName = cleaned.trim();
        }
        // 🔑 IGNORE doctorId field - use JWT instead
    }
    
    if (!pdfBuffer) {
        return badRequest("Missing reviewedPdf file");
    }
    
    if (!originalFileName) {
        return badRequest("Missing originalFileName field");
    }
    
    const baseName = originalFileName.replace(/^.*[\\/]/, "").replace(/\.pdf$/i, "");
    console.log('Uploading reviewed PDF for doctor:', doctorName, 'file:', baseName);
    
    // 🔑 Use doctorName from JWT instead of doctorId field
    const uploadResult = await (0, s3Service_1.uploadReviewedPDF)(baseName, pdfBuffer, doctorName);
    
    // 🗑️ DELETE original file from pending folder
    const originalKey = `doctor-assigned-reports/${doctorName}/pending/${originalFileName}`;
    console.log('Deleting original file from pending:', originalKey);
    
    const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
    const s3Client = require("@aws-sdk/client-s3").S3Client;
    const client = new s3Client({ region: "us-east-1" });
    
    const deleteCommand = new DeleteObjectCommand({
        Bucket: "deck-backend-demo",
        Key: originalKey
    });
    
    await client.send(deleteCommand);
    console.log('Original file deleted from pending folder');
    
    return (0, response_1.createSuccessResponse)({
        success: true,
        data: {
            key: uploadResult.Key,
            etag: uploadResult.ETag,
        },
    }, 200);
});
