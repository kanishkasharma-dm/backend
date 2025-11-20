import DeviceData from '../models/DeviceData.js';
import DeviceConfig from '../models/DeviceConfig.js';
import { parseDeviceData } from '../utils/dataParser.js';
import { publishDeviceConfig, publishAcknowledgment } from '../config/awsIoT.js';

/**
 * Receive and store device data from hardware
 * POST /api/devices/data
 */
export const receiveDeviceData = async (req, res) => {
  try {
    const { device_status, device_data, device_type, device_id } = req.body;

    // Validation
    if (!device_status && device_status !== 0) {
      return res.status(400).json({
        success: false,
        message: 'device_status is required',
      });
    }

    if (!device_data) {
      return res.status(400).json({
        success: false,
        message: 'device_data is required',
      });
    }

    if (!device_type || !['CPAP', 'BIPAP'].includes(device_type)) {
      return res.status(400).json({
        success: false,
        message: 'device_type is required and must be CPAP or BIPAP',
      });
    }

    // Parse the device data
    let parsedData;
    try {
      parsedData = parseDeviceData(device_data, device_type);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: `Failed to parse device data: ${error.message}`,
      });
    }

    // Extract or generate device ID
    const finalDeviceId = device_id || `device_${Date.now()}`;

    // Save device data
    // Mark as 'software' since it's coming from direct API call (software/application)
    const deviceDataRecord = new DeviceData({
      device_type,
      device_id: finalDeviceId,
      device_status,
      raw_data: device_data,
      parsed_data: parsedData,
      data_source: 'software', // Data from direct API call (software/application)
    });

    await deviceDataRecord.save();

    // Check if there's a pending configuration update for this device
    const config = await DeviceConfig.findOne({ device_id: finalDeviceId, pending_update: true });

    // If config exists and AWS IoT is configured, publish to IoT Core
    if (config && process.env.AWS_IOT_ENDPOINT) {
      try {
        await publishDeviceConfig(finalDeviceId, config.config_values);
        console.log(`Config published to IoT Core for device: ${finalDeviceId}`);
      } catch (error) {
        console.error('Error publishing config to IoT Core:', error);
        // Don't fail the request if IoT publish fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Device data received and saved successfully',
      data: {
        device_id: finalDeviceId,
        timestamp: deviceDataRecord.timestamp,
      },
      // Include configuration if available
      config_update: config ? {
        available: true,
        config_values: config.config_values,
      } : {
        available: false,
      },
    });
  } catch (error) {
    console.error('Error receiving device data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get device configuration
 * GET /api/devices/:deviceId/config
 */
export const getDeviceConfig = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const config = await DeviceConfig.findOne({ device_id: deviceId });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Device configuration not found',
      });
    }

    res.json({
      success: true,
      data: {
        device_id: config.device_id,
        device_type: config.device_type,
        config_values: config.config_values,
        last_updated: config.last_updated,
        pending_update: config.pending_update,
      },
    });
  } catch (error) {
    console.error('Error getting device config:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Create or update device configuration
 * POST /api/devices/:deviceId/config
 */
export const setDeviceConfig = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { config_values, device_type } = req.body;

    if (!config_values) {
      return res.status(400).json({
        success: false,
        message: 'config_values is required',
      });
    }

    // Check if device type matches if provided
    if (device_type && !['CPAP', 'BIPAP'].includes(device_type)) {
      return res.status(400).json({
        success: false,
        message: 'device_type must be CPAP or BIPAP',
      });
    }

    // Find or create device config
    let config = await DeviceConfig.findOne({ device_id: deviceId });

    if (config) {
      // Update existing config
      config.config_values = config_values;
      config.pending_update = true;
      config.last_updated = new Date();
      if (device_type) {
        config.device_type = device_type;
      }
    } else {
      // Create new config
      config = new DeviceConfig({
        device_id: deviceId,
        device_type: device_type || 'CPAP', // Default to CPAP if not specified
        config_values,
        pending_update: true,
      });
    }

    await config.save();

    // Publish config to AWS IoT Core if configured
    if (process.env.AWS_IOT_ENDPOINT) {
      try {
        await publishDeviceConfig(deviceId, config_values);
        console.log(`Config published to IoT Core for device: ${deviceId}`);
      } catch (error) {
        console.error('Error publishing config to IoT Core:', error);
        // Continue even if IoT publish fails - config is still saved
      }
    }

    res.json({
      success: true,
      message: 'Device configuration saved successfully',
      data: {
        device_id: config.device_id,
        device_type: config.device_type,
        config_values: config.config_values,
        pending_update: config.pending_update,
        last_updated: config.last_updated,
      },
    });
  } catch (error) {
    console.error('Error setting device config:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Mark configuration as delivered (called after device receives config)
 * POST /api/devices/:deviceId/config/delivered
 */
export const markConfigDelivered = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const config = await DeviceConfig.findOne({ device_id: deviceId });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Device configuration not found',
      });
    }

    config.pending_update = false;
    await config.save();

    // Optionally publish acknowledgment to IoT Core
    if (process.env.AWS_IOT_ENDPOINT && req.body.message_id) {
      try {
        await publishAcknowledgment(deviceId, req.body.message_id);
      } catch (error) {
        console.error('Error publishing acknowledgment to IoT Core:', error);
      }
    }

    res.json({
      success: true,
      message: 'Configuration marked as delivered',
      data: {
        device_id: config.device_id,
        pending_update: config.pending_update,
      },
    });
  } catch (error) {
    console.error('Error marking config as delivered:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get device data history
 * GET /api/devices/:deviceId/data?limit=100&offset=0
 */
export const getDeviceDataHistory = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const dataSource = req.query.data_source; // Optional: 'cloud', 'software', or 'direct'

    // Build query filter
    const query = { device_id: deviceId };
    if (dataSource && ['cloud', 'software', 'direct'].includes(dataSource)) {
      query.data_source = dataSource;
    }

    const data = await DeviceData.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(offset)
      .select('-raw_data'); // Exclude raw_data for performance

    const total = await DeviceData.countDocuments(query);

    res.json({
      success: true,
      data: {
        records: data,
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + limit < total,
        },
      },
    });
  } catch (error) {
    console.error('Error getting device data history:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

