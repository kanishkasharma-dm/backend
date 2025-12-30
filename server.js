import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import connectDB from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { swaggerOptions } from './config/swagger.js';
import mongoose from 'mongoose';

// Import versioned routes
import deviceRoutes from './routes/deviceRoutes.js';
import iotRoutes from './routes/iotRoutes.js';
import ecgRoutes from './routes/ecgRoutes.js';
import ocRoutes from './routes/ocRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

// Load environment variables from '.env' file (relative to project root)
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

// Initialize Express app
const app = express();

// Connect to database (non-blocking - won't crash server if MongoDB unavailable)
connectDB().catch(err => {
  console.warn('MongoDB connection attempted but server will continue');
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Swagger documentation setup
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'CardioX API Documentation',
}));

// Root endpoint - API information
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Medical Device Data API (CPAP/BIPAP/ECG/OC)',
    version: '1.0.0',
    apiVersion: 'v1',
    timestamp: new Date().toISOString(),
    documentation: '/api-docs',
    endpoints: {
      health: 'GET /health',
      apiDocs: 'GET /api-docs',
      // Versioned endpoints
      v1: {
        devices: '/api/v1/devices',
        iot: '/api/v1/iot',
        ecg: '/api/v1/ecg',
        oc: '/api/v1/oc',
        admin: '/api/v1/admin',
      },
    },
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    database: {
      connected: mongoose.connection.readyState === 1,
    },
  });
});

// API Version 1 Routes
const API_VERSION = process.env.API_VERSION || 'v1';
app.use(`/api/${API_VERSION}/devices`, deviceRoutes);
app.use(`/api/${API_VERSION}/iot`, iotRoutes);
app.use(`/api/${API_VERSION}/ecg`, ecgRoutes);
app.use(`/api/${API_VERSION}/oc`, ocRoutes);
app.use(`/api/${API_VERSION}/admin`, adminRoutes);

// Legacy routes (backward compatibility - redirect to v1)
app.use('/api/devices', deviceRoutes);
app.use('/api/iot', iotRoutes);
app.use('/api/ecg', ecgRoutes);
app.use('/api/oc', ocRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method,
    availableVersions: ['v1'],
    documentation: '/api-docs',
  });
});

// Centralized error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Railway requires listening on 0.0.0.0

app.listen(PORT, HOST, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

