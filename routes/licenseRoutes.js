import express from 'express';
import { body, query } from 'express-validator';
import {
  getLicenseActivations,
  getLicenses,
  postCreateLicense,
  postRevokeLicense,
} from '../controllers/licenseController.js';
import { requireLicenseAdmin } from '../middleware/adminAuth.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const adminLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });
const writeLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

const licenseKeyValidator = body('license_key')
  .isString()
  .trim()
  .isLength({ min: 20, max: 23 })
  .matches(/^[A-Za-z2-9-]+$/)
  .withMessage('license_key must be a valid CardioX license key');

const paginationValidators = [
  query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  query('offset').optional().isInt({ min: 0, max: 1000000 }).toInt(),
];

router.use(requireLicenseAdmin);
router.use(adminLimiter);

router.get(
  '/',
  [
    ...paginationValidators,
    query('revoked').optional().isBoolean().withMessage('revoked must be true or false'),
  ],
  getLicenses
);

router.post(
  '/create',
  writeLimiter,
  [
    body('tier').optional().isInt({ min: 0, max: 3 }).toInt(),
    body('expiry').optional().isInt({ min: 0, max: 4294967295 }).toInt(),
    body('notes').optional().isString().trim().isLength({ max: 1000 }),
  ],
  postCreateLicense
);

router.post('/revoke', writeLimiter, [licenseKeyValidator], postRevokeLicense);

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
