/**
 * Example script to test the CPAP/BIPAP API
 * Run this with: node examples/test-api.js
 */

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

// Helper function to make API calls
async function apiCall(method, endpoint, data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const result = await response.json();
    console.log(`\n${method} ${endpoint}`);
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error(`Error calling ${method} ${endpoint}:`, error.message);
    return null;
  }
}

async function testAPI() {
  console.log('=== CPAP/BIPAP API Test ===\n');

  // Test 1: Health check
  await apiCall('GET', '/health');

  // Test 2: Send CPAP device data
  const cpapDeviceId = 'cpap_001';
  await apiCall('POST', '/api/devices/data', {
    device_status: 1,
    device_data: '*,S,141125,1447,G,12.2,1.0,H,10.6,10.6,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,#',
    device_type: 'CPAP',
    device_id: cpapDeviceId,
  });

  // Test 3: Send BIPAP device data
  const bipapDeviceId = 'bipap_001';
  await apiCall('POST', '/api/devices/data', {
    device_status: 1,
    device_data: '*,S,141125,1447,A,12.2,1.0,B,29.6,10.8,10.6,40.0,10.0,10.0,13.0,1.0,C,16.0,10.0,10.0,10.0,10.0,10.0,0.0,200.0,1.0,D,11.0,10.0,10.0,10.0,10.0,10.0,10.0,200.0,1.0,E,20.0,10.0,5.0,10.0,20.0,20.0,1.0,200.0,1.0,170.0,500.0,F,5.0,1.0,1.0,1.0,0.0,1.0,1.0,#',
    device_type: 'BIPAP',
    device_id: bipapDeviceId,
  });

  // Test 4: Set CPAP device configuration
  await apiCall('POST', `/api/devices/${cpapDeviceId}/config`, {
    device_type: 'CPAP',
    config_values: {
      pressure: 14.0,
      humidity: 6.0,
      temperature: 2.0,
      mode: 1,
    },
  });

  // Test 5: Get CPAP device configuration
  await apiCall('GET', `/api/devices/${cpapDeviceId}/config`);

  // Test 6: Get device data history
  await apiCall('GET', `/api/devices/${cpapDeviceId}/data?limit=10&offset=0`);

  // Test 7: Simulate device receiving config (mark as delivered)
  await apiCall('POST', `/api/devices/${cpapDeviceId}/config/delivered`);

  console.log('\n=== Tests Complete ===');
}

// Run tests
testAPI().catch(console.error);

