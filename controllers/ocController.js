import OCData from '../models/OCData.js';

/**
 * Receive OC data from mobile app or machine
 * POST /api/oc/data
 * 
 * Expected formats:
 * - From mobile: { device_status: 1, device_data: 0/1/2/3, device_id: "12345678" }
 * - From machine (ack): { device_status: 0, device_data: 0/1/2/3, device_id: "12345678" }
 * - Data storage: { device_data: "power_status, alm_status", device_id: "device_id" }
 */
export const receiveOCData = async (req, res) => {
  try {
    const { device_id, device_status, device_data } = req.body;

    // Validation
    if (!device_id) {
      return res.status(400).json({
        success: false,
        message: 'device_id is required',
      });
    }

    if (device_data === undefined || device_data === null) {
      return res.status(400).json({
        success: false,
        message: 'device_data is required',
      });
    }

    // Determine source based on request
    let source = 'direct';
    let parsedData = {};

    // If device_status is provided, it's realtime communication (mobile/machine)
    if (device_status !== undefined && device_status !== null) {
      if (![0, 1].includes(device_status)) {
        return res.status(400).json({
          success: false,
          message: 'device_status must be 0 (acknowledgement) or 1 (request)',
        });
      }

      // Validate device_data is a number for realtime communication
      if (typeof device_data !== 'number' || ![0, 1, 2, 3].includes(device_data)) {
        return res.status(400).json({
          success: false,
          message: 'device_data must be 0, 1, 2, or 3 for realtime communication',
        });
      }

      source = device_status === 1 ? 'mobile' : 'machine';
    } else {
      // Data storage format: device_data is a string "power_status, alm_status"
      if (typeof device_data !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'device_data must be a string for data storage format',
        });
      }

      // Parse the string format: "power_status, alm_status"
      const parts = device_data.split(',').map(part => part.trim());
      if (parts.length >= 2) {
        parsedData = {
          power_status: parts[0],
          alm_status: parts[1],
        };
      } else {
        parsedData = {
          power_status: parts[0] || '',
          alm_status: '',
        };
      }
    }

    // Create OC data record
    const ocData = new OCData({
      device_id,
      device_status: device_status !== undefined ? device_status : null,
      device_data,
      parsed_data: Object.keys(parsedData).length > 0 ? parsedData : undefined,
      source,
    });

    await ocData.save();

    // If it's a request from mobile (device_status: 1), prepare for machine acknowledgement
    if (device_status === 1) {
      // In a real implementation, you might publish this to MQTT/IoT for the machine to respond
      console.log(`Mobile request received for device ${device_id}, waiting for machine acknowledgement`);
    }

    // If it's an acknowledgement from machine (device_status: 0), notify mobile app
    if (device_status === 0) {
      console.log(`Machine acknowledgement received for device ${device_id}`);
    }

    return res.status(201).json({
      success: true,
      message: 'OC data received and stored',
      data: {
        id: ocData._id,
        device_id: ocData.device_id,
        device_status: ocData.device_status,
        device_data: ocData.device_data,
        source: ocData.source,
        timestamp: ocData.timestamp,
      },
    });
  } catch (error) {
    console.error('Error receiving OC data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to store OC data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get OC data history for a device
 * GET /api/oc/data/:deviceId
 */
export const getOCDataHistory = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { limit = 50, source, device_status } = req.query;

    const query = { device_id: deviceId };

    if (source) {
      query.source = source;
    }

    if (device_status !== undefined) {
      query.device_status = parseInt(device_status);
    }

    const data = await OCData.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select('-__v')
      .lean();

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('Error fetching OC data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch OC data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get latest OC data for a device
 * GET /api/oc/data/:deviceId/latest
 */
export const getLatestOCData = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const data = await OCData.findOne({ device_id: deviceId })
      .sort({ timestamp: -1 })
      .select('-__v')
      .lean();

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'No data found for this device',
      });
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching latest OC data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch latest OC data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Update device data (for data storage format)
 * PUT /api/oc/data/:deviceId
 * Body: { device_data: "power_status, alm_status" }
 */
export const updateOCData = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { device_data } = req.body;

    if (!device_data || typeof device_data !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'device_data is required and must be a string',
      });
    }

    // Parse the string format
    const parts = device_data.split(',').map(part => part.trim());
    const parsedData = {
      power_status: parts[0] || '',
      alm_status: parts[1] || '',
    };

    // Update or create the latest record
    const ocData = await OCData.findOneAndUpdate(
      { device_id: deviceId },
      {
        device_id: deviceId,
        device_data,
        parsed_data: parsedData,
        source: 'direct',
        timestamp: new Date(),
      },
      {
        new: true,
        upsert: true,
      }
    );

    return res.json({
      success: true,
      message: 'OC data updated',
      data: {
        id: ocData._id,
        device_id: ocData.device_id,
        device_data: ocData.device_data,
        parsed_data: ocData.parsed_data,
        timestamp: ocData.timestamp,
      },
    });
  } catch (error) {
    console.error('Error updating OC data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update OC data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

