/**
 * Swagger/OpenAPI configuration for API documentation
 */

export const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CardioX Backend API',
      version: '1.0.0',
      description: 'API documentation for CardioX medical device data platform',
      contact: {
        name: 'CardioX API Support',
        email: 'support@cardiox.com',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://your-production-url.railway.app',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Error message',
            },
            error: {
              type: 'string',
              example: 'ERROR_CODE',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
            path: {
              type: 'string',
              example: '/api/v1/admin/device-data',
            },
            method: {
              type: 'string',
              example: 'GET',
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Operation successful',
            },
            data: {
              type: 'object',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Devices',
        description: 'Device management endpoints',
      },
      {
        name: 'IoT',
        description: 'IoT webhook endpoints for device data ingestion',
      },
      {
        name: 'ECG',
        description: 'ECG data endpoints',
      },
      {
        name: 'OC',
        description: 'Oxygen Concentrator data endpoints',
      },
      {
        name: 'Admin',
        description: 'Admin data fetching endpoints (requires authentication)',
      },
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
    ],
  },
  apis: [
    './routes/*.js',
    './controllers/*.js',
    './server.js',
  ],
};

