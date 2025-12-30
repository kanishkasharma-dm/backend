/**
 * Example: How to send ECG data to the API
 * 
 * This shows how your ECG software can send data to the unified API
 * instead of directly to S3.
 */

// Example 1: Send ECG data with base64 PDF
async function sendECGDataWithBase64PDF() {
  const apiUrl = 'http://localhost:3000/api/ecg/data';
  
  // Your ECG JSON data
  const ecgJsonData = {
    patient_id: 'P12345',
    device_id: 'ECG001',
    session_id: 'SESSION_20250120_001',
    recording_date: '2025-01-20T10:30:00Z',
    duration: 300, // seconds
    sample_rate: 500, // Hz
    leads: ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'],
    measurements: {
      heart_rate: 72,
      qrs_duration: 90,
      qt_interval: 380,
      // ... other ECG metrics
    },
    waveform_data: {
      // Your actual ECG waveform data
      // This can be large, so store in S3
    },
  };

  // Read PDF file and convert to base64
  const fs = await import('fs');
  const pdfBuffer = fs.readFileSync('path/to/ecg-report.pdf');
  const pdfBase64 = pdfBuffer.toString('base64');

  const payload = {
    device_id: 'ECG001',
    patient_id: 'P12345',
    session_id: 'SESSION_20250120_001',
    ecg_json_data: ecgJsonData,
    ecg_pdf_data: pdfBase64, // Base64 encoded PDF
    recording_date: '2025-01-20T10:30:00Z',
    recording_duration: 300,
    sample_rate: 500,
    leads: ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'],
    data_source: 'software',
    // Optional: Link to CPAP/BIPAP device if same patient
    linked_device_id: 'DEVICE_24',
    linked_device_type: 'CPAP',
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log('ECG data uploaded:', result);
    return result;
  } catch (error) {
    console.error('Error uploading ECG data:', error);
    throw error;
  }
}

// Example 2: Using FormData for file upload (alternative approach)
async function sendECGDataWithFormData() {
  const apiUrl = 'http://localhost:3000/api/ecg/data';
  const FormData = (await import('form-data')).default;
  
  const formData = new FormData();
  
  // Add JSON data
  const ecgJsonData = {
    patient_id: 'P12345',
    device_id: 'ECG001',
    // ... your ECG data
  };
  formData.append('ecg_json_data', JSON.stringify(ecgJsonData));
  
  // Add PDF file
  const fs = await import('fs');
  formData.append('ecg_pdf', fs.createReadStream('path/to/ecg-report.pdf'));
  
  // Add metadata
  formData.append('device_id', 'ECG001');
  formData.append('patient_id', 'P12345');
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    console.log('ECG data uploaded:', result);
    return result;
  } catch (error) {
    console.error('Error uploading ECG data:', error);
    throw error;
  }
}

// Example 3: Query ECG records
async function getECGRecords() {
  const apiUrl = 'http://localhost:3000/api/ecg/data';
  
  // Get all records for a device
  const response = await fetch(`${apiUrl}?device_id=ECG001&limit=10&offset=0`);
  const result = await response.json();
  
  console.log('ECG records:', result);
  return result;
}

// Example 4: Get presigned URLs for accessing files
async function getPresignedURLs(recordId) {
  const apiUrl = `http://localhost:3000/api/ecg/data/${recordId}/presigned-urls`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expiresIn: 3600, // 1 hour
    }),
  });
  
  const result = await response.json();
  console.log('Presigned URLs:', result);
  
  // Use these URLs to download files directly from S3
  // result.data.json_presigned_url
  // result.data.pdf_presigned_url
  
  return result;
}

export {
  sendECGDataWithBase64PDF,
  sendECGDataWithFormData,
  getECGRecords,
  getPresignedURLs,
};

