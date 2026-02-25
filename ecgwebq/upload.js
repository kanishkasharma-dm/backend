const { uploadECGRecord } = require('./services/s3Service');
const { validateECGPayload, sanitizeString } = require('./utils/validation');
const { createSuccessResponse, createErrorResponse } = require('./utils/response');
const { isValidBase64, extractBase64Data } = require('./utils/base64');
const { generateRecordId } = require('./utils/crypto');

exports.handler = async (event) => {
  try {
    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      return createErrorResponse('Invalid JSON in request body', 400);
    }

    // Validate required fields
    const { deviceId, patient, ecgData, pdfReport } = requestBody;
    
    if (!deviceId || !patient || !ecgData || !pdfReport) {
      return createErrorResponse('Missing required fields: deviceId, patient, ecgData, pdfReport', 400);
    }

    // Validate patient data
    if (!patient.name || !patient.phone || !patient.age || !patient.gender) {
      return createErrorResponse('Missing required patient fields: name, phone, age, gender', 400);
    }

    // Validate ECG data
    if (!ecgData.duration || !ecgData.leads || !ecgData.sampleRate || !ecgData.waveform) {
      return createErrorResponse('Missing required ECG data fields: duration, leads, sampleRate, waveform', 400);
    }

    // Validate base64 data
    if (!isValidBase64(ecgData.waveform)) {
      return createErrorResponse('Invalid base64 data in ECG waveform', 400);
    }

    if (!isValidBase64(pdfReport)) {
      return createErrorResponse('Invalid base64 data in PDF report', 400);
    }

    // Generate unique record ID
    const recordId = generateRecordId();

    // Create record object
    const record = {
      recordId,
      deviceId: sanitizeString(deviceId),
      patient: {
        name: sanitizeString(patient.name),
        phone: sanitizeString(patient.phone),
        email: sanitizeString(patient.email || ''),
        age: parseInt(patient.age),
        gender: sanitizeString(patient.gender),
        address: sanitizeString(patient.address || ''),
        medicalHistory: Array.isArray(patient.medicalHistory) 
          ? patient.medicalHistory.map(item => sanitizeString(item))
          : []
      },
      ecgData: {
        duration: parseInt(ecgData.duration),
        leads: parseInt(ecgData.leads),
        sampleRate: parseInt(ecgData.sampleRate),
        waveform: extractBase64Data(ecgData.waveform)
      },
      pdfReport: extractBase64Data(pdfReport),
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    // Upload to S3
    await uploadECGRecord(recordId, record);

    return createSuccessResponse({
      recordId,
      message: 'ECG record uploaded successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Upload error:', error);
    return createErrorResponse('Internal server error during upload', 500);
  }
};
