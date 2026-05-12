"use strict";
/**
 * Test script to verify doctor reports API works correctly
 */

const jwt = require('jsonwebtoken');

// Test JWT token for Dr_Arjun (you'll need to replace with actual token from login)
const TEST_DOCTOR_NAME = "Dr_Arjun";
const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-here";

// Create a test JWT token
function createTestToken(doctorName) {
    return jwt.sign(
        {
            doctor_id: "test-id",
            doctor_name: doctorName, // This should match what's in database
            email: "test@example.com",
            role: "doctor",
            tokenType: "doctor",
        },
        JWT_SECRET,
        { expiresIn: "24h" }
    );
}

// Test the API call
async function testDoctorReports() {
    console.log('=== Testing Doctor Reports API ===');
    
    // Test with different name formats
    const testCases = [
        "Dr_Arjun",      // Underscore format (S3 folder)
        "Dr Arjun",      // Space format (Database)
        "Dr_Arjun_Test", // Test with underscore
    ];
    
    for (const doctorName of testCases) {
        console.log(`\n--- Testing with doctor name: ${doctorName} ---`);
        
        const token = createTestToken(doctorName);
        console.log(`Generated token: ${token.substring(0, 50)}...`);
        
        // Decode token to verify
        const decoded = jwt.decode(token);
        console.log(`Token contains doctor_name: ${decoded.doctor_name}`);
        
        // Simulate the sanitization
        const sanitized = doctorName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        console.log(`Sanitized name for S3: ${sanitized}`);
    }
}

// Check S3 structure
function checkS3Structure() {
    console.log('\n=== Expected S3 Structure ===');
    console.log('doctor-assigned-reports/');
    console.log('├── Dr_Arjun/');
    console.log('│   ├── pending/');
    console.log('│   │   ├── ECG_Report_12_1_20260220_134951.pdf');
    console.log('│   │   └── ECG_Report_12_1_20260225_125528.pdf');
    console.log('│   └── reviewed/');
    console.log('├── Dr_Divyansh/');
    console.log('│   ├── pending/');
    console.log('│   │   ├── ECG_Report_12_1_20260216_144414.pdf');
    console.log('│   │   └── ECG_Report_12_1_20260221_120908.pdf');
    console.log('│   └── reviewed/');
    console.log('└── ...');
}

if (require.main === module) {
    testDoctorReports();
    checkS3Structure();
}

module.exports = { createTestToken, testDoctorReports };
