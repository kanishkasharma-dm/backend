import express from 'express';
import {
  getDeviceData,
  getECGDataAdmin,
  getOCDataAdmin,
} from '../controllers/adminController.js';
import {
  authenticateToken,
  requireAdmin,
} from '../middleware/auth.js';
import {
  validateAdminDeviceData,
  validateAdminECGData,
  validateAdminOCData,
} from '../middleware/validation.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/admin:
 *   get:
 *     summary: Get admin API information
 *     description: Returns information about available admin endpoints
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Admin API information
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Admin API Endpoints',
    version: 'v1',
    timestamp: new Date().toISOString(),
    endpoints: {
      deviceData: {
        method: 'GET',
        path: '/api/v1/admin/device-data',
        description: 'Get device data (CPAP/BIPAP) with filtering',
        queryParams: ['device_id (required)', 'from', 'to', 'latest', 'device_type', 'limit', 'include_corrupted'],
        authentication: 'Required (Admin)',
      },
      ecgData: {
        method: 'GET',
        path: '/api/v1/admin/ecg-data',
        description: 'Get ECG data with filtering',
        queryParams: ['device_id', 'patient_id', 'from', 'to', 'latest', 'limit'],
        authentication: 'Required (Admin)',
      },
      ocData: {
        method: 'GET',
        path: '/api/v1/admin/oc-data',
        description: 'Get OC (Oxygen Concentrator) data with filtering',
        queryParams: ['device_id (required)', 'from', 'to', 'latest', 'limit'],
        authentication: 'Required (Admin)',
      },
    },
    documentation: '/api-docs',
    note: 'All endpoints require JWT authentication with admin role',
  });
});

/**
 * @swagger
 * /api/v1/admin/device-data:
 *   get:
 *     summary: Get device data with date filtering
 *     description: Retrieve device data (CPAP/BIPAP) with optional date range filtering. Admin access required.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: device_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Device ID
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date (ISO 8601)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date (ISO 8601)
 *       - in: query
 *         name: latest
 *         schema:
 *           type: boolean
 *         description: Get only the latest record
 *       - in: query
 *         name: device_type
 *         schema:
 *           type: string
 *           enum: [CPAP, BIPAP]
 *         description: Filter by device type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 1000
 *         description: Maximum number of records to return
 *       - in: query
 *         name: include_corrupted
 *         schema:
 *           type: boolean
 *         description: Include corrupted records
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 data:
 *                   type: array
 *                 filters:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get(
  '/device-data',
  authenticateToken,
  requireAdmin,
  validateAdminDeviceData,
  getDeviceData
);

/**
 * @swagger
 * /api/v1/admin/ecg-data:
 *   get:
 *     summary: Get ECG data with date filtering
 *     description: Retrieve ECG data records with optional filtering. Admin access required.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: device_id
 *         schema:
 *           type: string
 *         description: Device ID
 *       - in: query
 *         name: patient_id
 *         schema:
 *           type: string
 *         description: Patient ID
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date (ISO 8601)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date (ISO 8601)
 *       - in: query
 *         name: latest
 *         schema:
 *           type: boolean
 *         description: Get only the latest record
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 100
 *         description: Maximum number of records to return
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get(
  '/ecg-data',
  authenticateToken,
  requireAdmin,
  validateAdminECGData,
  getECGDataAdmin
);

/**
 * @swagger
 * /api/v1/admin/oc-data:
 *   get:
 *     summary: Get OC data with date filtering
 *     description: Retrieve Oxygen Concentrator data with optional filtering. Admin access required.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: device_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Device ID
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date (ISO 8601)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date (ISO 8601)
 *       - in: query
 *         name: latest
 *         schema:
 *           type: boolean
 *         description: Get only the latest record
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 100
 *         description: Maximum number of records to return
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get(
  '/oc-data',
  authenticateToken,
  requireAdmin,
  validateAdminOCData,
  getOCDataAdmin
);

export default router;

