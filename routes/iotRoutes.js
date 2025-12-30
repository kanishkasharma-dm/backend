import express from 'express';
import { receiveIoTData } from '../controllers/iotController.js';

const router = express.Router();

/**
 * Base route - IoT API information
 * GET /api/v1/iot
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'IoT Webhook API',
    version: 'v1',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhook: {
        method: 'POST',
        path: '/api/v1/iot/webhook',
        description: 'Receive IoT data from AWS IoT Core (webhook endpoint)',
        note: 'This endpoint is called by AWS IoT Core Rule Action',
      },
      webhookConfirmation: {
        method: 'GET',
        path: '/api/v1/iot/webhook',
        description: 'AWS IoT destination confirmation endpoint',
        note: 'Used by AWS IoT Core to confirm destination ownership',
      },
    },
    documentation: '/api-docs',
  });
});

// GET endpoint for AWS IoT HTTP destination confirmation
// AWS IoT sends a GET request with query params to confirm destination ownership
router.get('/webhook', (req, res) => {
  console.log('📧 AWS IoT destination confirmation request received (GET)');
  console.log('Query params:', req.query);
  console.log('Headers:', req.headers);
  
  // AWS IoT sends confirmation with confirmationToken and enableUrl query params
  // OR with x-amzn-trace-id or similar query params
  // Return 200 OK to confirm ownership
  // Note: AWS IoT also requires manual confirmation via enableUrl or AWS CLI
  res.status(200).json({
    success: true,
    message: 'AWS IoT destination confirmed',
    endpoint: '/api/iot/webhook',
    timestamp: new Date().toISOString(),
    confirmationToken: req.query.confirmationToken || null,
    enableUrl: req.query.enableUrl || null,
  });
});

// POST endpoint - handles both confirmation requests and device data
// AWS IoT might send POST for confirmation (with confirmationToken)
// OR sends POST for actual device data (from rule action)
router.post('/webhook', (req, res) => {
  // Check if this is a confirmation request (has confirmationToken in body or query)
  const confirmationToken = req.body.confirmationToken || req.query.confirmationToken;
  const enableUrl = req.body.enableUrl || req.query.enableUrl;
  
  if (confirmationToken && enableUrl) {
    // This is a confirmation request from AWS IoT
    console.log('📧 AWS IoT destination confirmation request received (POST)');
    console.log('Confirmation Token:', confirmationToken);
    console.log('Enable URL:', enableUrl);
    
    // Return 200 OK to acknowledge confirmation
    // Note: AWS IoT also requires manual confirmation via enableUrl or AWS CLI
    res.status(200).json({
      success: true,
      message: 'AWS IoT destination confirmed',
      endpoint: '/api/iot/webhook',
      timestamp: new Date().toISOString(),
      confirmationToken: confirmationToken,
      enableUrl: enableUrl,
      note: 'Please confirm destination using enableUrl or AWS CLI: aws iot confirm-topic-rule-destination --confirmation-token ' + confirmationToken,
    });
    return;
  }
  
  // This is actual device data - forward to receiveIoTData handler
  // receiveIoTData is async, but Express handles promises automatically
  receiveIoTData(req, res).catch(err => {
    console.error('Error in receiveIoTData:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message,
      });
    }
  });
});

export default router;

