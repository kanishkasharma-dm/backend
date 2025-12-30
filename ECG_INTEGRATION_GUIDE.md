# ECG Data Integration Guide

## Overview

This guide explains how to integrate ECG data into your unified medical device API. Instead of sending ECG data directly to S3, you can now use the centralized API that handles validation, metadata storage, and provides unified access to all medical device data.

## Architecture

```
ECG Software → API Endpoint → MongoDB (metadata) + S3 (files)
```

### Benefits

1. **Unified API**: Single endpoint for all medical devices (CPAP/BIPAP + ECG)
2. **Metadata Tracking**: All ECG records stored in MongoDB with searchable metadata
3. **Data Correlation**: Link ECG data with CPAP/BIPAP data for same patient
4. **Security**: Centralized authentication and validation
5. **Scalability**: Easy to add processing, alerts, analytics

## Setup

### 1. Install Dependencies

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 2. Environment Variables

Add to your `.env` file:

```env
# AWS S3 Configuration
S3_BUCKET_NAME=your-ecg-bucket-name
S3_ECG_FOLDER=ecg-data  # Optional: folder prefix in S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

### 3. MongoDB Model

The ECG data model stores:
- **Metadata in MongoDB**: Device ID, patient ID, recording date, file references
- **Files in S3**: JSON data and PDF reports

## API Endpoints

### POST /api/ecg/data

Upload ECG data (JSON + PDF)

**Request Body:**
```json
{
  "device_id": "ECG001",
  "patient_id": "P12345",
  "session_id": "SESSION_20250120_001",
  "ecg_json_data": {
    "recording_date": "2025-01-20T10:30:00Z",
    "duration": 300,
    "sample_rate": 500,
    "leads": ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"],
    "measurements": {
      "heart_rate": 72,
      "qrs_duration": 90,
      "qt_interval": 380
    }
  },
  "ecg_pdf_data": "base64_encoded_pdf_string",
  "recording_date": "2025-01-20T10:30:00Z",
  "recording_duration": 300,
  "sample_rate": 500,
  "leads": ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"],
  "data_source": "software",
  "linked_device_id": "DEVICE_24",
  "linked_device_type": "CPAP"
}
```

**Response:**
```json
{
  "success": true,
  "message": "ECG data received and saved successfully",
  "data": {
    "ecg_record_id": "65f1234567890abcdef12345",
    "device_id": "ECG001",
    "patient_id": "P12345",
    "session_id": "SESSION_20250120_001",
    "json_s3_url": "https://bucket.s3.amazonaws.com/ecg-data/ECG001/2025-01-20/...",
    "pdf_s3_url": "https://bucket.s3.amazonaws.com/ecg-data/ECG001/2025-01-20/...",
    "recording_date": "2025-01-20T10:30:00.000Z",
    "timestamp": "2025-01-20T10:35:00.000Z"
  },
  "requestId": "ecg_1234567890_abc123"
}
```

### GET /api/ecg/data

Query ECG records with filtering

**Query Parameters:**
- `device_id`: Filter by device ID
- `patient_id`: Filter by patient ID
- `session_id`: Filter by session ID
- `status`: Filter by status (uploaded, processed, analyzed, error)
- `start_date`: Start date for recording_date filter
- `end_date`: End date for recording_date filter
- `limit`: Number of records (default: 100)
- `offset`: Pagination offset (default: 0)

**Example:**
```
GET /api/ecg/data?device_id=ECG001&patient_id=P12345&limit=10&offset=0
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65f1234567890abcdef12345",
      "device_id": "ECG001",
      "patient_id": "P12345",
      "json_s3_url": "https://...",
      "pdf_s3_url": "https://...",
      "recording_date": "2025-01-20T10:30:00.000Z",
      "status": "uploaded",
      "timestamp": "2025-01-20T10:35:00.000Z"
    }
  ],
  "pagination": {
    "total": 50,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

### GET /api/ecg/data/:recordId

Get single ECG record with full details

### POST /api/ecg/data/:recordId/presigned-urls

Get temporary presigned URLs for accessing S3 files

**Request Body:**
```json
{
  "expiresIn": 3600  // URL expiration in seconds (default: 1 hour)
}
```

## Migration from Direct S3 Upload

### Before (Direct S3 Upload):
```javascript
// Your current code - direct S3 upload
const s3 = new AWS.S3();
await s3.putObject({
  Bucket: 'your-bucket',
  Key: 'ecg-data/2025-01-20/ecg001.json',
  Body: JSON.stringify(ecgData),
}).promise();
```

### After (API Integration):
```javascript
// New approach - use unified API
const response = await fetch('http://your-api.com/api/ecg/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    device_id: 'ECG001',
    ecg_json_data: ecgData,
    ecg_pdf_data: pdfBase64,
    // ... metadata
  }),
});
```

## Advantages

### 1. Centralized Management
- All ECG records searchable in MongoDB
- Easy to query by patient, device, date range
- Unified API for all device types

### 2. Data Correlation
- Link ECG data with CPAP/BIPAP data
- Track patient's complete medical device history
- Cross-device analytics

### 3. Scalability
- Easy to add processing pipelines
- Can trigger alerts/notifications
- Add analytics and reporting
- Webhook support for external systems

### 4. Security & Access Control
- API-level authentication (add as needed)
- Presigned URLs for secure file access
- Audit trail in MongoDB

## Example: Correlation with CPAP Data

```javascript
// Get ECG data for a patient
const ecgRecords = await fetch('/api/ecg/data?patient_id=P12345');

// Get CPAP data for the same patient
const cpapRecords = await fetch('/api/devices/data?device_id=DEVICE_24');

// Correlate data for comprehensive patient view
// Both datasets have timestamps for time-series analysis
```

## Next Steps

1. **Install dependencies**: `npm install`
2. **Configure S3**: Add environment variables
3. **Update ECG software**: Change from direct S3 upload to API calls
4. **Test integration**: Use examples in `examples/ecg-api-example.js`
5. **Add authentication**: Implement API keys or OAuth as needed

## Troubleshooting

### S3 Upload Fails
- Check `S3_BUCKET_NAME` environment variable
- Verify AWS credentials have S3 write permissions
- Ensure bucket exists and is accessible

### MongoDB Connection Issues
- Verify `MONGODB_URI` is set correctly
- Check network access to MongoDB Atlas

### Large File Uploads
- For very large PDFs, consider using multipart upload
- API accepts up to 10MB by default (adjust Express limit if needed)

## Support

See `README.md` for general API documentation or check the examples in `examples/ecg-api-example.js`.

