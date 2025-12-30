import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from '.env' file (relative to project root)
dotenv.config({ path: join(__dirname, '..', '.env') });

const IOT_ENDPOINT = process.env.AWS_IOT_ENDPOINT; // e.g., xxxxxx-ats.iot.us-east-1.amazonaws.com
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

/**
 * Get IoT Data Plane Client
 */
function getIoTClient() {
  if (!IOT_ENDPOINT) {
    throw new Error('AWS_IOT_ENDPOINT is not configured');
  }

  return new IoTDataPlaneClient({
    region: AWS_REGION,
    endpoint: `https://${IOT_ENDPOINT}`,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } : undefined, // Will use default credential chain if not provided
  });
}

/**
 * Publish a message to AWS IoT Core topic
 * @param {string} topic - IoT Core topic to publish to
 * @param {object} payload - Message payload
 * @returns {Promise<object>} - Publish result
 */
export async function publishToIoT(topic, payload) {
  try {
    if (!IOT_ENDPOINT) {
      throw new Error('AWS_IOT_ENDPOINT is not configured');
    }

    const client = getIoTClient();
    const command = new PublishCommand({
      topic: topic,
      payload: Buffer.from(JSON.stringify(payload)),
      qos: 1, // At least once delivery
    });

    const response = await client.send(command);
    console.log(`Message published to topic: ${topic}`);
    return { success: true, response };
  } catch (error) {
    console.error('Error publishing to IoT Core:', error);
    throw error;
  }
}

/**
 * Publish device configuration update to IoT Core
 * @param {string} deviceId - Device ID
 * @param {object} configValues - Configuration values to send
 * @returns {Promise<object>} - Publish result
 */
export async function publishDeviceConfig(deviceId, configValues) {
  const topic = `devices/${deviceId}/config/update`;
  
  const payload = {
    device_id: deviceId,
    config: configValues,
    timestamp: new Date().toISOString(),
    action: 'config_update',
  };

  return await publishToIoT(topic, payload);
}

/**
 * Publish device configuration update to a specific IoT Core topic
 * @param {string} topic - Specific IoT Core topic to publish to
 * @param {string} deviceId - Device ID
 * @param {object} configValues - Configuration values to send
 * @returns {Promise<object>} - Publish result
 */
export async function publishDeviceConfigToTopic(topic, deviceId, configValues) {
  const payload = {
    device_id: deviceId,
    config: configValues,
    timestamp: new Date().toISOString(),
    action: 'config_update',
  };

  return await publishToIoT(topic, payload);
}

/**
 * Publish acknowledgment to IoT Core
 * @param {string} deviceId - Device ID
 * @param {string} messageId - Original message ID
 * @returns {Promise<object>} - Publish result
 */
export async function publishAcknowledgment(deviceId, messageId) {
  const topic = `devices/${deviceId}/ack`;
  
  const payload = {
    device_id: deviceId,
    message_id: messageId,
    status: 'received',
    timestamp: new Date().toISOString(),
  };

  return await publishToIoT(topic, payload);
}

export default {
  publishToIoT,
  publishDeviceConfig,
  publishDeviceConfigToTopic,
  publishAcknowledgment,
};

