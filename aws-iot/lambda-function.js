/**
 * AWS Lambda Function Template for AWS IoT Core Rule Action
 * 
 * This Lambda function can be used as an alternative to HTTPS action
 * for processing device data from AWS IoT Core.
 * 
 * Configuration:
 * 1. Create a Lambda function in AWS Lambda
 * 2. Set up an IoT Core Rule with this Lambda function as the action
 * 3. Configure environment variables in Lambda:
 *    - BACKEND_API_URL: Your backend API URL (e.g., https://api.example.com)
 */

const https = require('https');
const http = require('http');

/**
 * Lambda handler for IoT Core messages
 */
exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    try {
        // Extract device data from IoT Core message
        // IoT Core sends messages in different formats depending on rule SQL
        const deviceData = event.device_data || event.data || event;
        
        // Extract device information
        const deviceId = event.device_id || event.thingName || extractDeviceId(event.topic);
        const deviceType = event.device_type || 'CPAP'; // Default to CPAP
        
        // Prepare payload for backend API
        const payload = {
            device_status: event.device_status || deviceData.device_status || 1,
            device_data: deviceData.device_data || deviceData.data || deviceData,
            device_type: deviceType,
            device_id: deviceId,
            topic: event.topic || event.topicName,
            timestamp: new Date().toISOString(),
            messageId: event.messageId || event.awsMessageId,
        };
        
        // Send to backend API
        const backendUrl = process.env.BACKEND_API_URL;
        if (!backendUrl) {
            throw new Error('BACKEND_API_URL environment variable not set');
        }
        
        const response = await sendToBackend(backendUrl, payload);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Data forwarded to backend successfully',
                backendResponse: response,
            }),
        };
    } catch (error) {
        console.error('Error processing IoT message:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message,
            }),
        };
    }
};

/**
 * Send data to backend API
 */
function sendToBackend(url, payload) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const postData = JSON.stringify(payload);
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname || '/api/iot/webhook',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        };
        
        const req = client.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (error) {
                    resolve({ raw: data });
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}

/**
 * Extract device ID from IoT Core topic
 * Topic format: devices/{device_id}/data
 */
function extractDeviceId(topic) {
    if (!topic) return null;
    const parts = topic.split('/');
    if (parts.length >= 2 && parts[0] === 'devices') {
        return parts[1];
    }
    return null;
}

