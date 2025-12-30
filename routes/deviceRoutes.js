import express from 'express';
import {
  receiveDeviceData,
  getDeviceConfig,
  setDeviceConfig,
  markConfigDelivered,
  getDeviceDataHistory,
} from '../controllers/deviceController.js';

const router = express.Router();

/**
 * Base route - Device API information
 * GET /api/v1/devices
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Device Management API',
    version: 'v1',
    timestamp: new Date().toISOString(),
    endpoints: {
      receiveDeviceData: {
        method: 'POST',
        path: '/api/v1/devices/data',
        description: 'Receive device data from hardware',
      },
      getDeviceConfig: {
        method: 'GET',
        path: '/api/v1/devices/:deviceId/config',
        description: 'Get device configuration',
      },
      setDeviceConfig: {
        method: 'POST',
        path: '/api/v1/devices/:deviceId/config',
        description: 'Set/update device configuration',
      },
      markConfigDelivered: {
        method: 'POST',
        path: '/api/v1/devices/:deviceId/config/delivered',
        description: 'Mark configuration as delivered',
      },
      getDeviceDataHistory: {
        method: 'GET',
        path: '/api/v1/devices/:deviceId/data',
        description: 'Get device data history',
      },
    },
    documentation: '/api-docs',
  });
});

// Receive device data from hardware
router.post('/data', receiveDeviceData);

// Get device configuration
router.get('/:deviceId/config', getDeviceConfig);

// Set/update device configuration
router.post('/:deviceId/config', setDeviceConfig);

// Mark configuration as delivered
router.post('/:deviceId/config/delivered', markConfigDelivered);

// Get device data history
router.get('/:deviceId/data', getDeviceDataHistory);

export default router;

