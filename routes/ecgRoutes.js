import express from 'express';
import multer from 'multer';
import {
  receiveECGData,
  getECGData,
  getECGDataById,
  getPresignedURLs,
} from '../controllers/ecgController.js';

const router = express.Router();

/**
 * Base route - ECG API information
 * GET /api/v1/ecg
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'ECG Data API',
    version: 'v1',
    timestamp: new Date().toISOString(),
    endpoints: {
      receiveECGData: {
        method: 'POST',
        path: '/api/v1/ecg/data',
        description: 'Receive and store ECG data (JSON + PDF) to S3 and MongoDB',
        formats: ['multipart/form-data (file + metadata)', 'JSON body (ecg_json_data + ecg_pdf_data)'],
      },
      getECGData: {
        method: 'GET',
        path: '/api/v1/ecg/data',
        description: 'Get ECG data records with filtering and pagination',
        queryParams: ['device_id', 'patient_id', 'session_id', 'limit', 'offset', 'status', 'start_date', 'end_date'],
      },
      getECGDataById: {
        method: 'GET',
        path: '/api/v1/ecg/data/:recordId',
        description: 'Get single ECG record by ID',
      },
      getPresignedURLs: {
        method: 'POST',
        path: '/api/v1/ecg/data/:recordId/presigned-urls',
        description: 'Get presigned URLs for accessing S3 files',
      },
    },
    documentation: '/api-docs',
  });
});

// Configure multer for multipart/form-data (memory storage for S3 upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept PDF and JSON files
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'application/json' ||
        file.originalname.endsWith('.pdf') ||
        file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and JSON files are allowed'), false);
    }
  },
});

/**
 * @route   POST /api/ecg/data
 * @desc    Receive and store ECG data (JSON + PDF) to S3 and MongoDB
 * @access  Public (add authentication as needed)
 * 
 * Supports two formats:
 * 1. Multipart/form-data: file + metadata (JSON string)
 * 2. JSON body: ecg_json_data + ecg_pdf_data (base64)
 */
router.post('/data', upload.single('file'), receiveECGData);

/**
 * @route   GET /api/ecg/data
 * @desc    Get ECG data records with filtering and pagination
 * @access  Public (add authentication as needed)
 */
router.get('/data', getECGData);

/**
 * @route   GET /api/ecg/data/:recordId
 * @desc    Get single ECG record by ID
 * @access  Public (add authentication as needed)
 */
router.get('/data/:recordId', getECGDataById);

/**
 * @route   POST /api/ecg/data/:recordId/presigned-urls
 * @desc    Get presigned URLs for accessing S3 files
 * @access  Public (add authentication as needed)
 */
router.post('/data/:recordId/presigned-urls', getPresignedURLs);

export default router;

