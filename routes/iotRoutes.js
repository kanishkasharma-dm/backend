import express from 'express';
import { receiveIoTData } from '../controllers/iotController.js';

const router = express.Router();

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
  receiveIoTData(req, res);
});

export default router;

