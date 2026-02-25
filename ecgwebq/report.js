const { checkRecordExists, generatePresignedUrls } = require('./services/s3Service');
const { createSuccessResponse, createErrorResponse } = require('./utils/response');
const { sanitizeString } = require('./utils/validation');

exports.handler = async (event) => {
  try {
    const { id } = event.queryStringParameters || {};
    
    if (!id) {
      return createErrorResponse('Report ID is required', 400);
    }
    
    // Sanitize and normalize report ID
    let reportId = sanitizeString(id);
    
    // Handle different ID formats:
    // ?id=123
    // ?id=ecg-data/123
    // ?id=ecg-data/123.json
    if (reportId.includes('ecg-data/')) {
      reportId = reportId.replace('ecg-data/', '').replace('.json', '');
    }
    
    // Check if report exists
    const exists = await checkRecordExists(reportId);
    if (!exists) {
      return createErrorResponse('Report not found', 404);
    }
    
    // Generate fresh pre-signed URLs (5-minute expiry)
    const urls = await generatePresignedUrls(reportId);
    
    return createSuccessResponse({
      jsonUrl: urls.jsonUrl,
      pdfUrl: urls.pdfUrl,
      expiresIn: 300, // 5 minutes
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Report fetch error:', error);
    return createErrorResponse('Failed to fetch report', 500);
  }
};
