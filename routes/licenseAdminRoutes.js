import express from 'express';
import { query } from 'express-validator';
import {
  getLicenseActivations,
  getLicenses,
} from '../controllers/licenseController.js';
import { requireLicenseAdminSigned } from '../middleware/adminAuth.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const adminLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

const paginationValidators = [
  query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  query('offset').optional().isInt({ min: 0, max: 1000000 }).toInt(),
];

router.use(requireLicenseAdminSigned);
router.use(adminLimiter);

router.get(
  '/licenses',
  [
    ...paginationValidators,
    query('revoked').optional().isBoolean().withMessage('revoked must be true or false'),
  ],
  getLicenses
);

router.get(
  '/activations',
  [
    ...paginationValidators,
    query('license_key')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 20, max: 23 })
      .matches(/^[A-Za-z2-9-]+$/)
      .withMessage('license_key must be a valid CardioX license key'),
  ],
  getLicenseActivations
);

export default router;
