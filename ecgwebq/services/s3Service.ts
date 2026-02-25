/**
 * S3 Service Layer
 * Production-grade AWS S3 interactions using AWS SDK v3
 * Encapsulates all S3 operations with proper error handling and logging
 */

import { 
  S3Client, 
  ListObjectsV2Command, 
  GetObjectCommand, 
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { 
  S3_CONFIG, 
  S3UploadResult, 
  S3SignedUrlResult, 
  S3ObjectMetadata,
  ECGRecord,
  ECGReportMetadata,
  ErrorCodes 
} from '../types/ecg';

/**
 * Helper function to extract date from recordId and build date folder path
 * Format: ECG_Report_YYYYMMDD_HHMMSS -> YYYY/MM/DD/
 */
function getDateFolderFromRecordId(recordId: string): string {
  // Try to extract date from recordId format: ECG_Report_YYYYMMDD_HHMMSS
  const dateMatch = recordId.match(/(\d{4})(\d{2})(\d{2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    return `${year}/${month}/${day}/`;
  }
  
  // If no date found, use current date as fallback
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}/`;
}

/**
 * Helper function to build S3 key with date folders
 */
function buildS3Key(recordId: string, extension: string): string {
  const dateFolder = getDateFolderFromRecordId(recordId);
  return `${S3_CONFIG.PREFIX}${dateFolder}${recordId}.${extension}`;
}

/**
 * Searches for a file in S3 by trying multiple date folders
 * Returns the full S3 key if found, null otherwise
 * JSON files are in ecg-data/, PDF files are in ecg-reports/
 */
async function findFileInS3(recordId: string, extension: string): Promise<string | null> {
  // Determine the prefix based on file type
  // Both JSON and PDF are stored in ecg-reports/ (S3_CONFIG.PREFIX) based on uploadECGRecord
  const prefix = S3_CONFIG.PREFIX;
  
  // First, try the date extracted from recordId
  const dateFolder = getDateFolderFromRecordId(recordId);
  let key = `${prefix}${dateFolder}${recordId}.${extension}`;
  
  try {
    const headCommand = new HeadObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: key
    });
    await s3Client.send(headCommand);
    return key; // Found it!
  } catch (error: any) {
    if (error.name !== 'NotFound' && error.name !== 'NoSuchKey' && error.$metadata?.httpStatusCode !== 404) {
      throw error; // Re-throw non-404 errors
    }
  }
  
  // If not found, search in recent date folders (last 7 days)
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const searchDate = new Date(now);
    searchDate.setDate(now.getDate() - i);
    const year = searchDate.getFullYear();
    const month = String(searchDate.getMonth() + 1).padStart(2, '0');
    const day = String(searchDate.getDate()).padStart(2, '0');
    const searchKey = `${prefix}${year}/${month}/${day}/${recordId}.${extension}`;
    
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: S3_CONFIG.BUCKET_NAME,
        Key: searchKey
      });
      await s3Client.send(headCommand);
      return searchKey; // Found it!
    } catch (error: any) {
      if (error.name !== 'NotFound' && error.name !== 'NoSuchKey' && error.$metadata?.httpStatusCode !== 404) {
        throw error; // Re-throw non-404 errors
      }
    }
  }
  
  return null; // Not found in any date folder
}

// Initialize S3 client with IAM role-based authentication
// Credentials will be automatically picked up from Lambda execution role
const s3Client = new S3Client({
  region: S3_CONFIG.REGION,
  // No explicit credentials - using IAM role
  maxAttempts: 3,
  retryMode: 'adaptive'
});

/**
 * Uploads ECG record (JSON and PDF) to S3
 */
export async function uploadECGRecord(
  recordId: string, 
  record: ECGRecord
): Promise<{ jsonUpload: S3UploadResult; pdfUpload: S3UploadResult }> {
  try {
    // Prepare JSON data
    const jsonData = JSON.stringify(record, null, 2);
    const jsonBuffer = Buffer.from(jsonData, 'utf-8');

    // Upload JSON file
    const jsonCommand = new PutObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: `${S3_CONFIG.PREFIX}${recordId}.json`,
      Body: jsonBuffer,
      ContentType: 'application/json',
      Metadata: {
        recordId,
        deviceId: record.deviceId,
        patientId: record.patient.id,
        timestamp: record.timestamp
      }
    });

    const jsonResult = await s3Client.send(jsonCommand);

    // Prepare PDF data
    const pdfBuffer = Buffer.from(record.pdfBase64, 'base64');

    // Upload PDF file
    const pdfCommand = new PutObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: `${S3_CONFIG.PREFIX}${recordId}.pdf`,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      Metadata: {
        recordId,
        deviceId: record.deviceId,
        patientId: record.patient.id,
        timestamp: record.timestamp
      }
    });

    const pdfResult = await s3Client.send(pdfCommand);

    return {
      jsonUpload: {
        Key: `${S3_CONFIG.PREFIX}${recordId}.json`,
        ETag: jsonResult.ETag || '',
        Location: `s3://${S3_CONFIG.BUCKET_NAME}/${S3_CONFIG.PREFIX}${recordId}.json`
      },
      pdfUpload: {
        Key: `${S3_CONFIG.PREFIX}${recordId}.pdf`,
        ETag: pdfResult.ETag || '',
        Location: `s3://${S3_CONFIG.BUCKET_NAME}/${S3_CONFIG.PREFIX}${recordId}.pdf`
      }
    };

  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error(`Failed to upload ECG record to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Lists all objects in the ECG data prefix
 */
export async function listECGObjects(): Promise<S3ObjectMetadata[]> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Prefix: S3_CONFIG.PREFIX,
      MaxKeys: 1000 // Adjust based on expected volume
    });

    let allObjects: S3ObjectMetadata[] = [];
    let continuationToken: string | undefined;

    do {
      if (continuationToken) {
        command.input.ContinuationToken = continuationToken;
      }

      const response = await s3Client.send(command);
      
      if (response.Contents) {
        const objects = response.Contents.map((obj: any) => ({
          Key: obj.Key!,
          Size: obj.Size,
          LastModified: obj.LastModified?.toISOString(),
          ETag: obj.ETag
        }));
        allObjects = allObjects.concat(objects);
      }
      
      continuationToken = response.NextContinuationToken;
      
    } while (continuationToken);

    return allObjects;

  } catch (error) {
    console.error('S3 list error:', error);
    throw new Error(`Failed to list ECG objects from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieves JSON content for a specific record
 */
export async function getECGRecord(recordId: string, knownKey?: string): Promise<ECGRecord> {
  try {
    let key: string | null | undefined = knownKey;

    if (!key) {
      // Try to find the file if key is not provided
      key = await findFileInS3(recordId, 'json');
    }

    if (!key) {
      // Fallback to legacy flat structure
      key = `${S3_CONFIG.PREFIX}${recordId}.json`;
    }

    const command = new GetObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: key
    });

    const response = await s3Client.send(command);
    const jsonString = await response.Body?.transformToString();
    
    if (!jsonString) {
      throw new Error('Empty response from S3');
    }

    const record = JSON.parse(jsonString) as ECGRecord;
    return record;

  } catch (error) {
    console.error(`S3 get error for record ${recordId}:`, error);
    if (error instanceof Error && error.name === 'NoSuchKey') {
      throw new Error(`ECG record not found: ${recordId}`);
    }
    throw new Error(`Failed to retrieve ECG record: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generates fresh pre-signed URLs for both JSON and PDF files
 * Always generates new URLs - never caches or stores them
 * Returns null for pdfUrl if PDF file doesn't exist
 * Handles date-based folder structure: ecg-reports/YYYY/MM/DD/filename.pdf
 */
export async function generatePresignedUrls(
  recordId: string, 
  expiresIn: number = S3_CONFIG.PRESIGNED_URL_TTL
): Promise<{ jsonUrl: string; pdfUrl: string | null; expiresIn: number }> {
  try {
    // Find JSON file in date folders
    const jsonKey = await findFileInS3(recordId, 'json');
    if (!jsonKey) {
      throw new Error(`JSON file not found for record ${recordId}`);
    }

    // Generate JSON URL
    const jsonCommand = new GetObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: jsonKey,
      ResponseContentType: 'application/json'
    });

    const jsonUrl = await getSignedUrl(s3Client, jsonCommand, { expiresIn });

    // Find PDF file in date folders
    let pdfUrl: string | null = null;
    const pdfKey = await findFileInS3(recordId, 'pdf');
    
    if (pdfKey) {
      try {
        // PDF exists, generate pre-signed URL
    const pdfCommand = new GetObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
          Key: pdfKey,
      ResponseContentType: 'application/pdf'
    });

        pdfUrl = await getSignedUrl(s3Client, pdfCommand, { expiresIn });
      } catch (error: any) {
        console.error(`Error generating PDF URL for record ${recordId}:`, error);
      }
    } else {
      console.log(`PDF not found for record ${recordId}, only providing JSON URL`);
    }

    return {
      jsonUrl,
      pdfUrl,
      expiresIn
    };

  } catch (error) {
    console.error(`Presigned URL generation error for record ${recordId}:`, error);
    throw new Error(`Failed to generate presigned URLs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generates a presigned URL directly from an S3 key
 * Useful when you already have the full S3 key path
 */
export async function generatePresignedUrlFromKey(
  s3Key: string,
  expiresIn: number = S3_CONFIG.PRESIGNED_URL_TTL
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: s3Key,
      ResponseContentType: s3Key.endsWith('.pdf') ? 'application/pdf' : 'application/json'
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error(`Presigned URL generation error for key ${s3Key}:`, error);
    throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Checks if both JSON and PDF files exist for a record
 * Returns existence status without throwing errors for missing files
 * Handles date-based folder structure: ecg-reports/YYYY/MM/DD/filename.pdf
 */
export async function checkRecordExists(recordId: string): Promise<{ jsonExists: boolean; pdfExists: boolean }> {
  try {
    // Find files in date folders
    const jsonKey = await findFileInS3(recordId, 'json');
    const pdfKey = await findFileInS3(recordId, 'pdf');

    return {
      jsonExists: jsonKey !== null,
      pdfExists: pdfKey !== null
    };

  } catch (error) {
    console.error(`Record existence check error for ${recordId}:`, error);
    // Return false for both if there's a system error
    return { jsonExists: false, pdfExists: false };
  }
}

/**
 * Deletes both JSON and PDF files for a record
 */
export async function deleteECGRecord(recordId: string): Promise<{ jsonDeleted: boolean; pdfDeleted: boolean }> {
  try {
    const jsonKey = `${S3_CONFIG.PREFIX}${recordId}.json`;
    const pdfKey = `${S3_CONFIG.PREFIX}${recordId}.pdf`;

    // Delete JSON file
    const jsonCommand = new DeleteObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: jsonKey
    });

    // Delete PDF file
    const pdfCommand = new DeleteObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: pdfKey
    });

    const [jsonResult, pdfResult] = await Promise.allSettled([
      s3Client.send(jsonCommand),
      s3Client.send(pdfCommand)
    ]);

    return {
      jsonDeleted: jsonResult.status === 'fulfilled',
      pdfDeleted: pdfResult.status === 'fulfilled'
    };

  } catch (error) {
    console.error(`Record deletion error for ${recordId}:`, error);
    throw new Error(`Failed to delete ECG record: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Checks if an object exists in S3 without throwing errors
 * Returns true if the object exists, false otherwise
 */
export async function checkObjectExists(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: key
    });

    await s3Client.send(command);
    return true;
  } catch (error: any) {
    // NoSuchKey or NotFound means the object doesn't exist
    if (error.name === 'NotFound' || error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    // For other errors, log and return false to be safe
    console.error(`Error checking object existence for ${key}:`, error);
    return false;
  }
}

/**
 * Gets object metadata (size, last modified, etc.)
 */
export async function getObjectMetadata(key: string): Promise<{ size: number; lastModified: string; contentType: string }> {
  try {
    const command = new HeadObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: key
    });

    const response = await s3Client.send(command);

    return {
      size: response.ContentLength || 0,
      lastModified: response.LastModified?.toISOString() || '',
      contentType: response.ContentType || 'application/octet-stream'
    };

  } catch (error) {
    console.error(`Object metadata error for ${key}:`, error);
    throw new Error(`Failed to get object metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Batch retrieves multiple ECG records
 * Optimized for concurrent execution to prevent timeouts
 */
export async function batchGetECGRecords(items: { id: string; key?: string }[]): Promise<ECGRecord[]> {
  const records: ECGRecord[] = [];
  const errors: string[] = [];
  
  // Limit concurrency to prevent hitting limits or memory issues
  const CONCURRENCY_LIMIT = 20;
  
  // Helper to process a batch of items
  const processBatch = async (batch: { id: string; key?: string }[]) => {
    return Promise.all(
      batch.map(async (item) => {
        try {
          const record = await getECGRecord(item.id, item.key);
          
          // Optimization: Strip heavy data (pdfBase64) to save memory
          // We only need metadata for listing reports
          if (record.pdfBase64) {
            record.pdfBase64 = "";
          }
          
          return record;
        } catch (error) {
          errors.push(`Failed to retrieve record ${item.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return null;
        }
      })
    );
  };

  // Process items in chunks
  for (let i = 0; i < items.length; i += CONCURRENCY_LIMIT) {
    const chunk = items.slice(i, i + CONCURRENCY_LIMIT);
    const chunkResults = await processBatch(chunk);
    
    // Filter out nulls (failed items) and add to results
    chunkResults.forEach(result => {
      if (result) records.push(result);
    });
  }

  if (errors.length > 0) {
    console.warn('Batch retrieval warnings:', errors);
  }

  return records;
}

/**
 * Uploads a doctor‑reviewed PDF to a dedicated S3 prefix.
 */
export async function uploadReviewedPDF(
  originalBaseName: string,
  pdfBuffer: Buffer,
  doctorId: string
): Promise<S3UploadResult> {
  try {
    const safeBase = originalBaseName.replace(/^.*[\\/]/, "").replace(/\.pdf$/i, "");
    const key = `reports/reviewed/${safeBase}_reviewed.pdf`;

    const command = new PutObjectCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
      Metadata: {
        originalName: originalBaseName,
        doctorId,
        reviewedAt: new Date().toISOString(),
      },
    });

    const result = await s3Client.send(command);

    return {
      Key: key,
      ETag: result.ETag || "",
      Location: `s3://${S3_CONFIG.BUCKET_NAME}/${key}`,
    };
  } catch (error) {
    console.error("Error uploading reviewed PDF:", error);
    throw new Error(
      `Failed to upload reviewed PDF: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}