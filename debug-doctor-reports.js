"use strict";
/**
 * Debug version of doctor-reports.js to identify the issue
 */

const { ListObjectsV2Command, S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const jwt = require('jsonwebtoken');

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

function extractDoctorFromToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    const token = authHeader.substring(7);
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('JWT decoded successfully:', JSON.stringify(decoded, null, 2));
        return decoded.doctor_name || decoded.doctor_id || decoded.name || decoded.userId;
    } catch (error) {
        console.error('JWT verification failed:', error);
        return null;
    }
}

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

        const doctors = response.CommonPrefixes
            .map(prefix => {
                const folderPath = prefix.Prefix;
                const match = folderPath.match(/doctor-assigned-reports\/([^\/]+)\//);
                return match ? match[1] : null;
            })
            .filter(doctor => doctor !== null)
            .sort();

        console.log('Available doctors in S3:', doctors);
        return doctors;
    } catch (error) {
        console.error('Error fetching doctors from S3:', error);
        return [];
    }
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
        console.log('=== DEBUG DOCTOR REPORTS ===');
        console.log('Event:', JSON.stringify(event, null, 2));
        
        const method = event.httpMethod || event.requestContext?.http?.method || event.requestContext?.httpMethod;

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
        console.log('Auth header:', authHeader);
        
        const doctorName = extractDoctorFromToken(authHeader);
        console.log('Extracted doctor name:', doctorName);
        
        if (!doctorName) {
            return createResponse(
                { success: false, message: "Invalid or missing authentication token", reports: [] },
                401
            );
        }

        // Get available doctors from S3
        const availableDoctors = await fetchDoctorsFromS3();
        
        // Try different name variations
        const nameVariations = [
            doctorName,
            doctorName.replace(/\s+/g, '_'),  // "Dr Arjun" -> "Dr_Arjun"
            doctorName.replace(/_/g, ' '),    // "Dr_Arjun" -> "Dr Arjun"
            doctorName.toLowerCase(),
            doctorName.toUpperCase()
        ];

        console.log('Trying name variations:', nameVariations);
        console.log('Available doctors:', availableDoctors);

        let matchedDoctor = null;
        for (const variation of nameVariations) {
            if (availableDoctors.includes(variation)) {
                matchedDoctor = variation;
                break;
            }
        }

        if (!matchedDoctor) {
            return createResponse(
                { 
                    success: false, 
                    message: `Doctor '${doctorName}' not found in S3. Available doctors: ${availableDoctors.join(', ')}`,
                    debug: {
                        extractedName: doctorName,
                        nameVariations,
                        availableDoctors
                    },
                    reports: [] 
                },
                404
            );
        }

        console.log('Matched doctor:', matchedDoctor);

        const status = event.queryStringParameters?.status ?? event.queryParameters?.status ?? null;
        const folder = status === "reviewed" ? "reviewed" : "pending";
        const prefix = `doctor-assigned-reports/${matchedDoctor}/${folder}/`;

        console.log('Fetching from prefix:', prefix);

        const command = new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: prefix,
            MaxKeys: 1000,
        });

        const response = await s3Client.send(command);
        console.log('S3 response:', response);

        const pdfObjects = response.Contents?.filter((obj) => obj.Key && obj.Key.endsWith(".pdf")) || [];
        console.log('PDF objects found:', pdfObjects.length);

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
            } catch (error) {
                console.error(`Error processing file ${obj.Key}:`, error);
            }
        }

        reports.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

        console.log('Final reports count:', reports.length);

        return createResponse(
            {
                success: true,
                reports,
                debug: {
                    extractedName: doctorName,
                    matchedDoctor,
                    prefix,
                    totalFiles: reports.length
                }
            },
            200
        );
    } catch (error) {
        console.error("ERROR:", error);
        return createResponse(
            {
                success: false,
                message: "Internal server error",
                error: error.message,
                reports: [],
            },
            500
        );
    }
};
