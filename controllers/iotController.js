import DeviceData from '../models/DeviceData.js';
import DeviceConfig from '../models/DeviceConfig.js';
import { parseDeviceData } from '../utils/dataParser.js';
import { publishDeviceConfig, publishDeviceConfigToTopic, publishAcknowledgment } from '../config/awsIoT.js';
import mongoose from 'mongoose';

/**
 * Webhook endpoint to receive data from AWS IoT Core
 * This endpoint is called by AWS IoT Core Rule Action (HTTPS)
 * POST /api/iot/webhook
 */
export const receiveIoTData = async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[${requestId}] 📥 Received IoT data request`);
  
  try {
    // Check MongoDB connection before processing
    const isMongoConnected = mongoose.connection.readyState === 1;
    if (!isMongoConnected) {
      console.error(`[${requestId}] ❌ MongoDB not connected! Connection state: ${mongoose.connection.readyState}`);
      console.error(`[${requestId}] Attempting to reconnect...`);
      try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(`[${requestId}] ✅ MongoDB reconnected successfully`);
      } catch (reconnectError) {
        console.error(`[${requestId}] ❌ Failed to reconnect to MongoDB:`, reconnectError.message);
        return res.status(503).json({
          success: false,
          message: 'Database unavailable',
          requestId: requestId,
        });
      }
    }
    
    // AWS IoT Core may send data in different formats depending on the rule action
    // Handle both direct payload and IoT Core message format
    let payload = req.body;
    console.log(`[${requestId}] 📦 Raw payload received:`, JSON.stringify(payload).substring(0, 200));
    
    // If coming from IoT Core HTTPS action, payload might be nested
    if (payload.payload) {
      // Handle base64 decoded payload
      if (typeof payload.payload === 'string') {
        try {
          payload = JSON.parse(Buffer.from(payload.payload, 'base64').toString());
          console.log(`[${requestId}] 📦 Decoded base64 payload`);
        } catch {
          payload = JSON.parse(payload.payload);
          console.log(`[${requestId}] 📦 Parsed string payload`);
        }
      } else {
        payload = payload.payload;
        console.log(`[${requestId}] 📦 Extracted nested payload`);
      }
    }

    // Extract device information
    const { 
      device_status, 
      device_data, 
      device_type, 
      device_id,
      topic // IoT Core topic
    } = payload;

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

    // Device type is optional - will be auto-detected from data if not provided

    // Extract device ID and auto-detect device type from topic/data
    // Support multiple topic formats: devices/{id}/data, esp32/{id}, esp32/data{id}
    let finalDeviceId = device_id;
    let finalDeviceType = device_type;
    
    if (!finalDeviceId && topic) {
      const topicParts = topic.split('/');
      if (topicParts.length >= 2) {
        if (topicParts[0] === 'devices') {
          // Format: devices/{device_id}/data
          finalDeviceId = topicParts[1];
        } else if (topicParts[0] === 'esp32') {
          // Format: esp32/data24 or esp32/24
          finalDeviceId = topicParts[1].replace('data', ''); // Extract ID from esp32/data24
          if (!finalDeviceId) {
            finalDeviceId = topicParts[1] || 'esp32';
          }
        }
      }
    }
    
    // Auto-detect device type from data string if not provided
    if (!finalDeviceType && device_data) {
      if (device_data.includes('VAPS_MODE') || device_data.includes('BIPAP')) {
        finalDeviceType = 'BIPAP';
      } else if (
        device_data.includes('CPAP') || 
        device_data.includes('MANUALMODE') || 
        (device_data.includes('G,') && device_data.includes('H,') && device_data.includes('I,'))
      ) {
        // CPAP has G, H, I sections, BIPAP has A, B, C, D, E, F sections
        finalDeviceType = 'CPAP';
      } else {
        // Default detection based on section count
        // CPAP typically: S, G, H, I (4 sections)
        // BIPAP typically: S, A, B, C, D, E, F (7 sections)
        const hasMultipleSections = (device_data.match(/[A-Z],/g) || []).length > 5;
        finalDeviceType = hasMultipleSections ? 'BIPAP' : 'CPAP';
      }
    }
    
    if (!finalDeviceId) {
      finalDeviceId = `device_${Date.now()}`;
    }
    
    if (!finalDeviceType || !['CPAP', 'BIPAP'].includes(finalDeviceType)) {
      finalDeviceType = 'BIPAP'; // Default to BIPAP
    }

    // Parse the device data
    let parsedData;
    try {
      parsedData = parseDeviceData(device_data, finalDeviceType);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: `Failed to parse device data: ${error.message}`,
      });
    }

    // Save device data with retry logic
    // Mark as 'cloud' since it's coming from AWS IoT Core
    const deviceDataRecord = new DeviceData({
      device_type: finalDeviceType,
      device_id: finalDeviceId,
      device_status,
      raw_data: device_data,
      parsed_data: parsedData,
      data_source: 'cloud', // Data from AWS IoT Core (hardware)
    });

    console.log(`[${requestId}] 💾 Attempting to save data for device: ${finalDeviceId}, type: ${finalDeviceType}`);
    
    // Retry save up to 3 times if it fails
    let saveAttempts = 0;
    const maxSaveAttempts = 3;
    let savedSuccessfully = false;
    
    while (saveAttempts < maxSaveAttempts && !savedSuccessfully) {
      try {
        // Check MongoDB connection before each save attempt
        if (mongoose.connection.readyState !== 1) {
          console.warn(`[${requestId}] ⚠️  MongoDB disconnected before save attempt ${saveAttempts + 1}`);
          try {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log(`[${requestId}] ✅ Reconnected to MongoDB`);
          } catch (reconnectError) {
            console.error(`[${requestId}] ❌ Failed to reconnect:`, reconnectError.message);
            saveAttempts++;
            if (saveAttempts < maxSaveAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000 * saveAttempts)); // Wait before retry
              continue;
            }
            throw reconnectError;
          }
        }
        
        await deviceDataRecord.save();
        savedSuccessfully = true;
        console.log(`[${requestId}] ✅ Data saved successfully to MongoDB (attempt ${saveAttempts + 1})`);
        console.log(`[${requestId}] 📊 Saved record ID: ${deviceDataRecord._id}, timestamp: ${deviceDataRecord.timestamp}`);
      } catch (saveError) {
        saveAttempts++;
        console.error(`[${requestId}] ❌ Save attempt ${saveAttempts} failed:`, saveError.message);
        
        if (saveAttempts < maxSaveAttempts) {
          console.log(`[${requestId}] 🔄 Retrying save... (${saveAttempts}/${maxSaveAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * saveAttempts)); // Exponential backoff
        } else {
          console.error(`[${requestId}] ❌ All ${maxSaveAttempts} save attempts failed`);
          throw saveError;
        }
      }
    }
    
    if (!savedSuccessfully) {
      throw new Error(`Failed to save data after ${maxSaveAttempts} attempts`);
    }

    // Check if there's a pending configuration update for this device
    // Send config update when device_status indicates update needed or when config is pending
    const config = await DeviceConfig.findOne({ device_id: finalDeviceId, pending_update: true });

    // If config exists, publish to IoT Core immediately
    // This ensures hardware gets config updates on every data send
    // Determine config topic based on original topic pattern
    if (config && process.env.AWS_IOT_ENDPOINT) {
      try {
        // Determine config topic based on device topic pattern
        let configTopic;
        if (topic && topic.startsWith('esp32/')) {
          // Check if device uses same topic for publish/subscribe
          // If topic is esp32/data24 and device subscribes to same topic, use same topic
          // Otherwise use esp32/config24 format
          const topicParts = topic.split('/');
          if (topicParts[1] && topicParts[1].includes('data')) {
            // Option 1: Use same topic for config (device subscribes to esp32/data24)
            configTopic = topic; // esp32/data24 -> esp32/data24
            // Option 2: Use config topic format (device subscribes to esp32/config24)
            // Uncomment below if device subscribes to esp32/config24:
            // const devicePart = topicParts[1].replace('data', 'config');
            // configTopic = `esp32/${devicePart}`;
          } else {
            // esp32/24 -> esp32/config24 or esp32/24 (same topic)
            configTopic = topic; // Use same topic
            // Or use: configTopic = `esp32/config${topicParts[1]}`;
          }
        } else {
          // Default format: devices/{device_id}/config/update
          configTopic = `devices/${finalDeviceId}/config/update`;
        }
        
        await publishDeviceConfigToTopic(configTopic, finalDeviceId, config.config_values);
        console.log(`Config published to IoT Core topic: ${configTopic} for device: ${finalDeviceId}`);
      } catch (error) {
        console.error('Error publishing config to IoT Core:', error);
      }
    }

    // Send acknowledgment back to IoT Core
    if (process.env.AWS_IOT_ENDPOINT && payload.messageId) {
      try {
        await publishAcknowledgment(finalDeviceId, payload.messageId);
      } catch (error) {
        console.error('Error publishing acknowledgment:', error);
      }
    }

    console.log(`[${requestId}] ✅ Request completed successfully`);
    
    res.status(200).json({
      success: true,
      message: 'IoT data received and processed successfully',
      requestId: requestId,
      data: {
        device_id: finalDeviceId,
        device_type: finalDeviceType,
        timestamp: deviceDataRecord.timestamp,
        record_id: deviceDataRecord._id.toString(),
      },
      config_update: config ? {
        available: true,
        published: true,
      } : {
        available: false,
      },
    });
  } catch (error) {
    console.error(`[${requestId}] ❌ Error receiving IoT data:`, error);
    console.error(`[${requestId}] ❌ Error stack:`, error.stack);
    console.error(`[${requestId}] ❌ MongoDB connection state:`, mongoose.connection.readyState);
    
    // Return error but don't crash the server
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      requestId: requestId,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      mongodb_connected: mongoose.connection.readyState === 1,
    });
  }
};

