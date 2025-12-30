import ECGData from '../models/ECGData.js';
import { uploadJSONToS3, uploadPDFToS3, generateECGFileKey } from '../config/awsS3.js';
import mongoose from 'mongoose';

/**
 * Receive and store ECG data (JSON + PDF)
 * POST /api/ecg/data
 * 
 * Accepts multiple formats:
 * 1. Multipart/form-data (from cloud_uploader.py):
 *    - file: PDF/JSON file (binary)
 *    - metadata: JSON string with upload_metadata structure
 * 
 * 2. JSON body (legacy/API format):
 *    - ecg_json_data: JSON object or string (index.json structure)
 *    - ecg_pdf_data: base64 encoded PDF
 *    - device_id, patient_id, etc.
 * 
 * Expected JSON structure (index.json format):
 * {
 *   "timestamp": "2025-11-18 13:16:34",
 *   "file": "/path/to/file.pdf",
 *   "patient": { "name": "...", "age": "...", "gender": "...", "date_time": "..." },
 *   "metrics": { "HR_bpm": 75, "PR_ms": 160, ... }
 * }
 */
export const receiveECGData = async (req, res) => {
  const requestId = `ecg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[${requestId}] 📥 Received ECG data request`);

  try {
    // Check MongoDB connection
    const isMongoConnected = mongoose.connection.readyState === 1;
    if (!isMongoConnected) {
      console.error(`[${requestId}] ❌ MongoDB not connected!`);
      try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(`[${requestId}] ✅ MongoDB reconnected`);
      } catch (reconnectError) {
        return res.status(503).json({
          success: false,
          message: 'Database unavailable',
          requestId,
        });
      }
    }

    // Handle multipart/form-data (from cloud_uploader.py)
    let uploadMetadata = null;
    let pdfBuffer = null;
    let jsonTwinData = null;
    let parsedECGData = null;
    let filename = null;

    if (req.file) {
      // Multipart/form-data upload
      const file = req.file;
      const metadataStr = req.body.metadata;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'File is required in multipart/form-data',
          requestId,
        });
      }

      if (metadataStr) {
        try {
          uploadMetadata = typeof metadataStr === 'string' 
            ? JSON.parse(metadataStr) 
            : metadataStr;
        } catch (error) {
          console.warn(`[${requestId}] ⚠️ Failed to parse metadata: ${error.message}`);
        }
      }

      filename = uploadMetadata?.filename || file.originalname || file.name;
      const fileType = filename.split('.').pop().toLowerCase();

      if (fileType === 'pdf') {
        pdfBuffer = file.buffer || Buffer.from(file.data);
      } else if (fileType === 'json') {
        jsonTwinData = JSON.parse(file.buffer.toString('utf-8') || file.data.toString('utf-8'));
        parsedECGData = jsonTwinData;
      }
    }

    // Handle JSON body format (legacy/API)
    const {
      device_id,
      patient_id,
      session_id,
      ecg_json_data,
      ecg_pdf_data, // base64 encoded PDF
      ecg_pdf_buffer, // PDF as Buffer (if sending binary)
      recording_date,
      recording_duration,
      sample_rate,
      leads,
      linked_device_id,
      linked_device_type,
      data_source = 'software',
    } = req.body;

    // Parse JSON data if provided in body (legacy format)
    if (ecg_json_data && !parsedECGData) {
      try {
        parsedECGData = typeof ecg_json_data === 'string' 
          ? JSON.parse(ecg_json_data) 
          : ecg_json_data;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Invalid JSON data: ${error.message}`,
          requestId,
        });
      }
    }

    // Convert PDF from base64 to Buffer if needed (legacy format)
    if (!pdfBuffer && ecg_pdf_buffer) {
      pdfBuffer = Buffer.isBuffer(ecg_pdf_buffer) 
        ? ecg_pdf_buffer 
        : Buffer.from(ecg_pdf_buffer);
    } else if (!pdfBuffer && ecg_pdf_data) {
      // Handle base64 encoded PDF
      const base64Data = ecg_pdf_data.replace(/^data:application\/pdf;base64,/, '');
      pdfBuffer = Buffer.from(base64Data, 'base64');
    }

    // Validation
    const finalDeviceId = device_id || uploadMetadata?.machine_serial || 'unknown';
    if (!finalDeviceId || finalDeviceId === 'unknown') {
      return res.status(400).json({
        success: false,
        message: 'device_id or machine_serial is required',
        requestId,
      });
    }

    // PDF is optional for testing (if only JSON data is provided)
    // If no PDF, we'll only store JSON data
    const hasPDF = pdfBuffer && pdfBuffer.length > 0;

    // If we have JSON twin data, use it; otherwise use parsedECGData or create from metadata
    if (jsonTwinData) {
      parsedECGData = jsonTwinData;
    } else if (!parsedECGData) {
      // Validate that we have at least JSON data or metadata
      if (!ecg_json_data && !uploadMetadata) {
        return res.status(400).json({
          success: false,
          message: 'ecg_json_data is required (or provide file + metadata in multipart/form-data)',
          requestId,
        });
      }
      
      // Create minimal structure from upload metadata
      parsedECGData = {
        timestamp: uploadMetadata?.uploaded_at || uploadMetadata?.report_date || new Date().toISOString(),
        file: uploadMetadata?.filename || filename,
        patient: uploadMetadata ? {
          name: uploadMetadata.patient_name,
          age: uploadMetadata.patient_age,
          gender: null,
          date_time: uploadMetadata.report_date,
        } : null,
        metrics: uploadMetadata?.heart_rate ? {
          HR_bpm: parseInt(uploadMetadata.heart_rate) || null,
        } : null,
      };
    }

    // Extract data from parsedECGData structure
    const reportTimestamp = parsedECGData?.timestamp 
      ? new Date(parsedECGData.timestamp) 
      : (recording_date ? new Date(recording_date) : new Date());
    
    const patientInfo = parsedECGData?.patient || null;
    const metrics = parsedECGData?.metrics || null;
    
    // Use filename from metadata or generate from timestamp
    if (!filename && uploadMetadata?.filename) {
      filename = uploadMetadata.filename;
    } else if (!filename) {
      const timestampStr = reportTimestamp.toISOString().replace(/[:.]/g, '-').split('.')[0];
      filename = `ECG_Report_${timestampStr}.pdf`;
    }

    // Generate S3 keys using new format: ecg-reports/YYYY/MM/DD/filename
    const pdfKey = generateECGFileKey(finalDeviceId, 'pdf', reportTimestamp, filename);
    
    // Generate JSON key (if JSON twin exists or needs to be created)
    let jsonKey = null;
    let jsonTwinKey = null;
    if (jsonTwinData || parsedECGData) {
      const jsonFilename = filename.replace('.pdf', '.json');
      jsonTwinKey = generateECGFileKey(finalDeviceId, 'json', reportTimestamp, jsonFilename);
      jsonKey = jsonTwinKey;
    }

    console.log(`[${requestId}] 📤 Uploading files to S3...`);

    // Upload PDF to S3 (if provided)
    let pdfUploadResult = null;
    if (hasPDF) {
      const pdfMetadata = uploadMetadata || {};
      pdfUploadResult = await uploadPDFToS3(
        pdfBuffer,
        filename || 'ecg_report.pdf',
        pdfMetadata
      );
    }

    // Upload JSON twin file if we have JSON data
    let jsonUploadResult = null;
    let jsonTwinUploadResult = null;
    if (jsonTwinData || parsedECGData) {
      const jsonDataToUpload = jsonTwinData || parsedECGData;
      const jsonMetadata = uploadMetadata || {};
      const jsonFilename = filename ? filename.replace('.pdf', '.json') : 'ecg_data.json';
      jsonTwinUploadResult = await uploadJSONToS3(
        jsonDataToUpload,
        jsonFilename,
        jsonMetadata
      );
      jsonUploadResult = jsonTwinUploadResult;
    }

    console.log(`[${requestId}] ✅ Files uploaded to S3`);

    // Extract metadata from JSON data if available
    const extractedMetadata = {
      recording_date: recording_date || parsedECGData?.recording_date || parsedECGData?.timestamp || reportTimestamp,
      recording_duration: recording_duration || parsedECGData?.duration || parsedECGData?.recording_duration,
      sample_rate: sample_rate || parsedECGData?.sample_rate || parsedECGData?.sampling_rate,
      leads: leads || parsedECGData?.leads || parsedECGData?.channels || [],
    };

    // Prepare upload_metadata structure
    const finalUploadMetadata = uploadMetadata || {
      filename: filename,
      uploaded_at: new Date().toISOString(),
      file_size: pdfBuffer.length,
      file_type: '.pdf',
      patient_name: patientInfo?.name || patient_id || null,
      patient_age: patientInfo?.age || null,
      report_date: patientInfo?.date_time || reportTimestamp.toISOString(),
      machine_serial: finalDeviceId,
      heart_rate: metrics?.HR_bpm?.toString() || null,
    };

    // Create ECG data record
    const ecgDataRecord = new ECGData({
      device_id: finalDeviceId,
      patient_id: patient_id || patientInfo?.name || null,
      session_id: session_id || null,
      ecg_data: parsedECGData || {},
      upload_metadata: finalUploadMetadata,
      patient: patientInfo,
      metrics: metrics,
      json_s3_key: jsonUploadResult?.s3_key || null,
      json_s3_url: jsonUploadResult?.s3_url || null,
      pdf_s3_key: pdfUploadResult?.s3_key || null,
      pdf_s3_url: pdfUploadResult?.s3_url || null,
      json_twin_s3_key: jsonTwinUploadResult?.s3_key || null,
      json_twin_s3_url: jsonTwinUploadResult?.s3_url || null,
      s3_bucket: pdfUploadResult?.bucket || jsonUploadResult?.bucket || 'unknown',
      file_metadata: {
        json_size: parsedECGData ? Buffer.byteLength(JSON.stringify(parsedECGData)) : 0,
        pdf_size: pdfBuffer?.length || 0,
        json_content_type: 'application/json',
        pdf_content_type: hasPDF ? 'application/pdf' : null,
      },
      recording_date: extractedMetadata.recording_date ? new Date(extractedMetadata.recording_date) : reportTimestamp,
      recording_duration: extractedMetadata.recording_duration,
      sample_rate: extractedMetadata.sample_rate,
      leads: extractedMetadata.leads,
      status: 'uploaded',
      data_source: data_source || (uploadMetadata ? 'api' : 'software'),
      linked_device_id: linked_device_id || null,
      linked_device_type: linked_device_type || null,
      timestamp: reportTimestamp,
    });

    await ecgDataRecord.save();
    console.log(`[${requestId}] 💾 ECG data saved to MongoDB: ${ecgDataRecord._id}`);

    return res.status(200).json({
      success: true,
      message: 'ECG data received and saved successfully',
      data: {
        ecg_record_id: ecgDataRecord._id,
        device_id: ecgDataRecord.device_id,
        patient_id: ecgDataRecord.patient_id,
        session_id: ecgDataRecord.session_id,
        json_s3_url: ecgDataRecord.json_s3_url,
        pdf_s3_url: ecgDataRecord.pdf_s3_url || null,
        recording_date: ecgDataRecord.recording_date,
        timestamp: ecgDataRecord.timestamp,
      },
      requestId,
    });
  } catch (error) {
    console.error(`[${requestId}] ❌ Error processing ECG data:`, error);
    return res.status(500).json({
      success: false,
      message: `Error processing ECG data: ${error.message}`,
      requestId,
    });
  }
};

/**
 * Get ECG data records
 * GET /api/ecg/data?device_id=xxx&patient_id=xxx&limit=100&offset=0
 */
export const getECGData = async (req, res) => {
  try {
    const {
      device_id,
      patient_id,
      session_id,
      limit = 100,
      offset = 0,
      status,
      start_date,
      end_date,
    } = req.query;

    const query = {};

    if (device_id) query.device_id = device_id;
    if (patient_id) query.patient_id = patient_id;
    if (session_id) query.session_id = session_id;
    if (status) query.status = status;

    // Date range filter
    if (start_date || end_date) {
      query.recording_date = {};
      if (start_date) query.recording_date.$gte = new Date(start_date);
      if (end_date) query.recording_date.$lte = new Date(end_date);
    }

    const records = await ECGData.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .select('-ecg_data') // Exclude large JSON data from list view
      .lean();

    const total = await ECGData.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: records,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + records.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching ECG data:', error);
    return res.status(500).json({
      success: false,
      message: `Error fetching ECG data: ${error.message}`,
    });
  }
};

/**
 * Get single ECG record by ID
 * GET /api/ecg/data/:recordId
 */
export const getECGDataById = async (req, res) => {
  try {
    const { recordId } = req.params;

    const record = await ECGData.findById(recordId);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'ECG record not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error('Error fetching ECG record:', error);
    return res.status(500).json({
      success: false,
      message: `Error fetching ECG record: ${error.message}`,
    });
  }
};

/**
 * Get presigned URLs for accessing S3 files
 * POST /api/ecg/data/:recordId/presigned-urls
 */
export const getPresignedURLs = async (req, res) => {
  try {
    const { recordId } = req.params;
    const { expiresIn = 3600 } = req.body; // Default 1 hour

    const record = await ECGData.findById(recordId);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'ECG record not found',
      });
    }

    const { getPresignedURL } = await import('../config/awsS3.js');

    const [jsonUrl, pdfUrl] = await Promise.all([
      getPresignedURL(record.json_s3_key, parseInt(expiresIn)),
      getPresignedURL(record.pdf_s3_key, parseInt(expiresIn)),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        json_presigned_url: jsonUrl,
        pdf_presigned_url: pdfUrl,
        expires_in: expiresIn,
      },
    });
  } catch (error) {
    console.error('Error generating presigned URLs:', error);
    return res.status(500).json({
      success: false,
      message: `Error generating presigned URLs: ${error.message}`,
    });
  }
};

