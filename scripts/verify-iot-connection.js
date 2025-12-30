/**
 * Script to verify AWS IoT Core connection
 * Run: node scripts/verify-iot-connection.js
 */

import dotenv from 'dotenv';
import { publishToIoT } from '../config/awsIoT.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from '.env' file (relative to project root)
dotenv.config({ path: join(__dirname, '..', '.env') });

async function verifyIoTConnection() {
  console.log('🔍 Verifying AWS IoT Core Connection...\n');
  
  // Check environment variables
  const requiredVars = ['AWS_IOT_ENDPOINT', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease check your env file.');
    process.exit(1);
  }
  
  console.log('✅ Environment variables found:');
  console.log(`   - AWS_REGION: ${process.env.AWS_REGION}`);
  console.log(`   - AWS_IOT_ENDPOINT: ${process.env.AWS_IOT_ENDPOINT}`);
  console.log(`   - AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID?.substring(0, 10)}...`);
  console.log('');
  
  // Test publish to IoT Core
  console.log('📤 Testing publish to IoT Core...');
  
  try {
    const testTopic = 'devices/test/verify';
    const testPayload = {
      message: 'IoT Core connection test',
      timestamp: new Date().toISOString(),
      test: true,
    };
    
    console.log(`   Topic: ${testTopic}`);
    console.log(`   Payload:`, JSON.stringify(testPayload, null, 2));
    console.log('');
    
    const result = await publishToIoT(testTopic, testPayload);
    
    console.log('✅ SUCCESS! Message published to IoT Core');
    console.log('   Response:', JSON.stringify(result, null, 2));
    console.log('');
    console.log('📝 Next Steps:');
    console.log('   1. Go to AWS Console → IoT Core → Test');
    console.log(`   2. Subscribe to topic: ${testTopic}`);
    console.log('   3. You should see the test message');
    console.log('');
    console.log('🎉 IoT Core connection verified!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ FAILED! Error publishing to IoT Core:');
    console.error('   Error:', error.message);
    
    if (error.name === 'UnauthorizedException' || error.message.includes('credentials')) {
      console.error('');
      console.error('💡 Troubleshooting:');
      console.error('   - Check if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are correct');
      console.error('   - Verify the IAM user has IoT Data Plane permissions');
      console.error('   - Ensure the credentials have iot:Publish permission');
    } else if (error.message.includes('endpoint')) {
      console.error('');
      console.error('💡 Troubleshooting:');
      console.error('   - Check if AWS_IOT_ENDPOINT is correct');
      console.error('   - Verify the endpoint is in the correct region');
      console.error('   - Ensure the endpoint format is: xxxxxx-ats.iot.region.amazonaws.com');
    } else {
      console.error('');
      console.error('💡 Check the error details above');
      console.error('   Full error:', error);
    }
    
    process.exit(1);
  }
}

// Run verification
verifyIoTConnection();

