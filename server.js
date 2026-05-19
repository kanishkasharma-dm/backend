import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import connectDB from './config/database.js';
import deviceRoutes from './routes/deviceRoutes.js';
import iotRoutes from './routes/iotRoutes.js';
import ecgRoutes from './routes/ecgRoutes.js';
import ocRoutes from './routes/ocRoutes.js';
import licenseRoutes from './routes/licenseRoutes.js';
import licenseAdminRoutes from './routes/licenseAdminRoutes.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Connect to database (non-blocking - won't crash server if MongoDB unavailable)
connectDB().catch(err => {
  console.warn('MongoDB connection attempted but server will continue');
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://www.cardiox.in',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token', 'X-Signature', 'X-HMAC-Signature', 'X-CardioX-Signature'],
}));
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Root endpoint - API information
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Medical Device Data API (CPAP/BIPAP/ECG/OC)',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: 'GET /health',
      receiveDeviceData: 'POST /api/devices/data',
      getDeviceConfig: 'GET /api/devices/:deviceId/config',
      setDeviceConfig: 'POST /api/devices/:deviceId/config',
      markConfigDelivered: 'POST /api/devices/:deviceId/config/delivered',
      getDeviceDataHistory: 'GET /api/devices/:deviceId/data',
      iotWebhook: 'POST /api/iot/webhook',
      ecgData: 'POST /api/ecg/data',
      getECGData: 'GET /api/ecg/data',
      getECGRecord: 'GET /api/ecg/data/:recordId',
      getECGPresignedURLs: 'POST /api/ecg/data/:recordId/presigned-urls',
      ocData: 'POST /api/oc/data',
      getOCDataHistory: 'GET /api/oc/data/:deviceId',
      getLatestOCData: 'GET /api/oc/data/:deviceId/latest',
      updateOCData: 'PUT /api/oc/data/:deviceId',
      licenses: 'GET /api/licenses',
      createLicense: 'POST /api/licenses/create',
      revokeLicense: 'POST /api/licenses/revoke',
      licenseActivations: 'GET /api/licenses/activations',
      adminLicenses: 'GET /admin/licenses',
      adminLicenseActivations: 'GET /admin/activations',
    },
    documentation: 'See README.md for full API documentation',
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/devices', deviceRoutes);
app.use('/api/iot', iotRoutes);
app.use('/api/ecg', ecgRoutes);
app.use('/api/oc', ocRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/admin', licenseAdminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Railway requires listening on 0.0.0.0

app.listen(PORT, HOST, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

