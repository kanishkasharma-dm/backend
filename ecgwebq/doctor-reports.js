"use strict";
/**
 * API Handler: GET /api/doctor/reports
 * Fetches doctor reports based on JWT authentication
 * Doctor identity extracted from JWT token, not query parameters
 */

const { ListObjectsV2Command, S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const jwt = require('jsonwebtoken');

const BUCKET = "deck-backend-demo";
const s3Client = new S3Client({ region: "us-east-1" });

/**
 * Extract and verify JWT token
 */
function extractDoctorFromToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.doctor_name || decoded.doctor_id;
    } catch (error) {
        console.error('JWT verification failed:', error);
        return null;
    }
}

/* ---------------------------------- */
/* Dynamic Doctor Fetching            */
/* ---------------------------------- */

/**
 * Fetches list of doctors from S3 bucket folders
 */
async function fetchDoctorsFromS3() {
    try {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: 'doctor-assigned-reports/',
            Delimiter: '/',
            MaxKeys: 1000
        });

        const response = await s3Client.send(command);
        
        if (!response.CommonPrefixes) {
            return [];
        }

        // Extract doctor names from folder paths
        const doctors = response.CommonPrefixes
            .map(prefix => {
                const folderPath = prefix.Prefix;
                // Extract doctor name from: doctor-assigned-reports/Dr_Name/
                const match = folderPath.match(/doctor-assigned-reports\/([^\/]+)\//);
                return match ? match[1] : null;
            })
            .filter(doctor => doctor !== null)
            .sort();

        return doctors;
    } catch (error) {
        console.error('Error fetching doctors from S3:', error);
        return [];
    }
}

/* ---------------------------------- */
/* Helpers                            */
/* ---------------------------------- */

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

async function validateDoctorName(name) {
    if (!name) return null;
    
    // Remove whitespace and sanitize
    const sanitized = name.trim()
        .replace(/[^a-zA-Z0-9_]/g, '') // Keep only alphanumeric and underscore
        .substring(0, 50); // Limit length
    
    // Fetch doctors dynamically from S3
    const validDoctors = await fetchDoctorsFromS3();
    
    // Validate against dynamic list
    if (!validDoctors.includes(sanitized)) {
        return null;
    }
    
    return sanitized;
}

async function generatePresignedUrl(key) {
    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn: 300 });
}

/* ---------------------------------- */
/* Main Handler                       */
/* ---------------------------------- */

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

        // Extract doctor from JWT token
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        const doctorName = extractDoctorFromToken(authHeader);
        
        if (!doctorName) {
            return createResponse(
                { success: false, message: "Invalid or missing authentication token", reports: [] },
                401
            );
        }

        const status =
            event.queryStringParameters?.status ??
            event.queryParameters?.status ??
            null;

        /* ---------------------------------- */
        /* REVIEWED → Fetch from reviewed folder */
        /* ---------------------------------- */

        if (status === "reviewed") {
            // Use doctor name from JWT (already extracted above)
            if (!doctorName) {
                const validDoctors = await fetchDoctorsFromS3();
                return createResponse(
                    {
                        success: false,
                        message: "Authentication required: No valid doctor found in token",
                        reports: [],
                    },
                    401
                );
            }

            const prefix = `doctor-assigned-reports/${doctorName}/reviewed/`;

            const command = new ListObjectsV2Command({
                Bucket: BUCKET,
                Prefix: prefix,
                MaxKeys: 1000,
            });

            const response = await s3Client.send(command);

            const pdfObjects =
                response.Contents?.filter(
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
                        url: presignedUrl,
                        uploadedAt: obj.LastModified?.toISOString(),
                    });
                } catch {
                    // skip invalid file
                }
            }

            return createResponse(
                {
                    success: true,
                    reports,
                },
                200
            );
        }

        /* ---------------------------------- */
        /* PENDING → Use JWT doctor name      */
        /* ---------------------------------- */

        // Use doctor name from JWT (already extracted above)
        if (!doctorName) {
            const validDoctors = await fetchDoctorsFromS3();
            return createResponse(
                {
                    success: false,
                    message:
                        "Authentication required: No valid doctor found in token",
                    reports: [],
                },
                401
            );
        }

        const prefix = `doctor-assigned-reports/${doctorName}/pending/`;

        const command = new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: prefix,
            MaxKeys: 1000,
        });

        const response = await s3Client.send(command);

        const pdfObjects =
            response.Contents?.filter(
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
                    url: presignedUrl,
                    uploadedAt: obj.LastModified?.toISOString(),
                });
            } catch {
                // skip invalid file
            }
        }

        // Newest first
        reports.sort(
            (a, b) =>
                new Date(b.uploadedAt).getTime() -
                new Date(a.uploadedAt).getTime()
        );

        return createResponse(
            {
                success: true,
                reports,
            },
            200
        );
    } catch (error) {
        console.error("ERROR:", error);

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
