import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from '.env' file (relative to project root)
dotenv.config({ path: join(__dirname, '..', '.env') });

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const S3_ECG_FOLDER = process.env.S3_ECG_FOLDER || 'ecg-data'; // Folder prefix in S3

/**
 * Get S3 Client
 */
function getS3Client() {
  return new S3Client({
    region: AWS_REGION,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } : undefined, // Will use default credential chain if not provided
  });
}

/**
 * Upload file to S3
 * @param {Buffer|string} fileContent - File content as Buffer or string
 * @param {string} s3Key - S3 object key (path)
 * @param {string} contentType - MIME type (e.g., 'application/json', 'application/pdf')
 * @param {object} metadata - Optional metadata to attach
 * @returns {Promise<object>} - Upload result with S3 URL
 */
export async function uploadToS3(fileContent, s3Key, contentType, metadata = {}) {
  try {
    if (!S3_BUCKET_NAME) {
      throw new Error('S3_BUCKET_NAME is not configured');
    }

    const s3Client = getS3Client();
    const fullKey = `${S3_ECG_FOLDER}/${s3Key}`;

    // Convert string to Buffer if needed
    const buffer = Buffer.isBuffer(fileContent) 
      ? fileContent 
      : Buffer.from(fileContent);

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: fullKey,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
    });

    await s3Client.send(command);

    // Generate S3 URL
    const s3Url = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${fullKey}`;

    console.log(`File uploaded to S3: ${fullKey}`);
    return {
      success: true,
      s3_key: fullKey,
      s3_url: s3Url,
      bucket: S3_BUCKET_NAME,
    };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
}

/**
 * Upload JSON data to S3
 * @param {object} jsonData - JSON object to upload
 * @param {string} fileName - Filename (will be prefixed with timestamp)
 * @param {object} metadata - Optional metadata
 * @returns {Promise<object>} - Upload result
 */
export async function uploadJSONToS3(jsonData, fileName, metadata = {}) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const s3Key = `${timestamp}_${fileName}`;
  const jsonString = JSON.stringify(jsonData, null, 2);
  
  return await uploadToS3(jsonString, s3Key, 'application/json', metadata);
}

/**
 * Upload PDF file to S3
 * @param {Buffer} pdfBuffer - PDF file as Buffer
 * @param {string} fileName - Filename (will be prefixed with timestamp)
 * @param {object} metadata - Optional metadata
 * @returns {Promise<object>} - Upload result
 */
export async function uploadPDFToS3(pdfBuffer, fileName, metadata = {}) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const s3Key = `${timestamp}_${fileName}`;
  
  if (!Buffer.isBuffer(pdfBuffer)) {
    throw new Error('PDF must be provided as a Buffer');
  }
  
  return await uploadToS3(pdfBuffer, s3Key, 'application/pdf', metadata);
}

/**
 * Generate presigned URL for S3 object (for temporary access)
 * @param {string} s3Key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>} - Presigned URL
 */
export async function getPresignedURL(s3Key, expiresIn = 3600) {
  try {
    if (!S3_BUCKET_NAME) {
      throw new Error('S3_BUCKET_NAME is not configured');
    }

    const s3Client = getS3Client();
    const fullKey = s3Key.startsWith(S3_ECG_FOLDER) ? s3Key : `${S3_ECG_FOLDER}/${s3Key}`;

    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: fullKey,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw error;
  }
}

/**
 * Generate S3 key for ECG files based on device/patient ID and timestamp
 * @param {string} deviceId - Device ID
 * @param {string} fileType - 'json' or 'pdf'
 * @param {Date} timestamp - Optional timestamp (defaults to now)
 * @param {string} filename - Optional filename (if provided, uses ecg-reports/YYYY/MM/DD/filename format)
 * @returns {string} - S3 key
 */
export function generateECGFileKey(deviceId, fileType, timestamp = new Date(), filename = null) {
  if (filename) {
    // Use ecg-reports/YYYY/MM/DD/filename format from documentation
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `ecg-reports/${year}/${month}/${day}/${filename}`;
  }
  
  // Legacy format: deviceId/YYYY-MM-DD/timestamp.extension
  const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = timestamp.toISOString().replace(/[:.]/g, '-').split('.')[0]; // YYYY-MM-DDTHH-MM-SS
  const extension = fileType === 'json' ? 'json' : 'pdf';
  return `${deviceId}/${dateStr}/${timeStr}.${extension}`;
}

export default {
  uploadToS3,
  uploadJSONToS3,
  uploadPDFToS3,
  getPresignedURL,
  generateECGFileKey,
};

