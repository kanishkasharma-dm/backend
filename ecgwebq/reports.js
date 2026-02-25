const { listECGObjects } = require('./services/s3Service');
const { createSuccessResponse, createErrorResponse } = require('./utils/response');
const { sanitizeString } = require('./utils/validation');

exports.handler = async (event) => {
  try {
    // Get query parameters
    const { name, phoneNumber, deviceId, startDate, endDate } = event.queryStringParameters || {};
    
    // List all ECG objects from S3
    const s3Objects = await listECGObjects();
    
    // Filter objects based on query parameters
    let filteredObjects = s3Objects;
    
    if (name) {
      filteredObjects = filteredObjects.filter(obj => 
        obj.patientName?.toLowerCase().includes(sanitizeString(name).toLowerCase())
      );
    }
    
    if (phoneNumber) {
      filteredObjects = filteredObjects.filter(obj => 
        obj.patientPhone?.includes(sanitizeString(phoneNumber))
      );
    }
    
    if (deviceId) {
      filteredObjects = filteredObjects.filter(obj => 
        obj.deviceId?.toLowerCase().includes(sanitizeString(deviceId).toLowerCase())
      );
    }
    
    if (startDate) {
      filteredObjects = filteredObjects.filter(obj => 
        new Date(obj.date) >= new Date(startDate)
      );
    }
    
    if (endDate) {
      filteredObjects = filteredObjects.filter(obj => 
        new Date(obj.date) <= new Date(endDate)
      );
    }
    
    // Transform to frontend format
    const reports = filteredObjects.map(obj => ({
      id: obj.recordId,
      name: obj.patientName || 'Unknown',
      phoneNumber: obj.patientPhone || '',
      deviceId: obj.deviceId || '',
      date: obj.date || '',
      type: 'ECG Report',
      size: formatFileSize(obj.size || 0),
      s3Key: obj.s3Key || '',
      ecg: obj.ecg || {}
    }));
    
    // Sort by date (newest first)
    reports.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return createSuccessResponse({
      reports,
      total: reports.length
    });
    
  } catch (error) {
    console.error('Reports fetch error:', error);
    return createErrorResponse('Failed to fetch reports', 500);
  }
};

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
