import { body, param, query, validationResult } from 'express-validator';

/**
 * Middleware to handle validation results
 * Must be used after express-validator rules
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Request validation failed',
      error: 'VALIDATION_ERROR',
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value,
        location: err.location,
      })),
    });
  }
  
  next();
};

/**
 * Validation rules for device data endpoints
 */
export const validateDeviceData = [
  body('device_id')
    .optional()
    .isString()
    .withMessage('device_id must be a string')
    .trim()
    .notEmpty()
    .withMessage('device_id cannot be empty'),
  
  body('device_type')
    .optional()
    .isIn(['CPAP', 'BIPAP'])
    .withMessage('device_type must be either CPAP or BIPAP'),
  
  body('device_status')
    .optional()
    .isInt({ min: 0, max: 1 })
    .withMessage('device_status must be 0 or 1'),
  
  body('device_data')
    .optional()
    .isString()
    .withMessage('device_data must be a string')
    .notEmpty()
    .withMessage('device_data cannot be empty'),
  
  validate,
];

/**
 * Validation rules for IoT webhook endpoint
 */
export const validateIoTWebhook = [
  body('device_status')
    .exists()
    .withMessage('device_status is required')
    .isInt({ min: 0, max: 1 })
    .withMessage('device_status must be 0 or 1'),
  
  body('device_data')
    .exists()
    .withMessage('device_data is required')
    .isString()
    .withMessage('device_data must be a string')
    .notEmpty()
    .withMessage('device_data cannot be empty'),
  
  body('device_id')
    .optional()
    .isString()
    .withMessage('device_id must be a string'),
  
  body('device_type')
    .optional()
    .isIn(['CPAP', 'BIPAP'])
    .withMessage('device_type must be either CPAP or BIPAP'),
  
  validate,
];

/**
 * Validation rules for ECG data endpoint
 */
export const validateECGData = [
  body('device_id')
    .optional()
    .isString()
    .withMessage('device_id must be a string'),
  
  body('patient_id')
    .optional()
    .isString()
    .withMessage('patient_id must be a string'),
  
  body('ecg_json_data')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        try {
          JSON.parse(value);
          return true;
        } catch {
          throw new Error('ecg_json_data must be valid JSON');
        }
      }
      return typeof value === 'object';
    })
    .withMessage('ecg_json_data must be valid JSON'),
  
  body('ecg_pdf_data')
    .optional()
    .isString()
    .withMessage('ecg_pdf_data must be a base64 string'),
  
  validate,
];

/**
 * Validation rules for OC data endpoint
 */
export const validateOCData = [
  body('device_id')
    .exists()
    .withMessage('device_id is required')
    .isString()
    .withMessage('device_id must be a string')
    .trim()
    .notEmpty()
    .withMessage('device_id cannot be empty'),
  
  body('device_status')
    .optional()
    .isInt({ min: 0, max: 1 })
    .withMessage('device_status must be 0 or 1'),
  
  body('data')
    .optional()
    .isString()
    .withMessage('data must be a string'),
  
  validate,
];

/**
 * Validation rules for admin data fetch endpoints
 */
export const validateAdminDeviceData = [
  query('device_id')
    .exists()
    .withMessage('device_id query parameter is required')
    .isString()
    .withMessage('device_id must be a string')
    .trim()
    .notEmpty()
    .withMessage('device_id cannot be empty'),
  
  query('from')
    .optional()
    .isISO8601()
    .withMessage('from must be a valid ISO 8601 date string'),
  
  query('to')
    .optional()
    .isISO8601()
    .withMessage('to must be a valid ISO 8601 date string'),
  
  query('latest')
    .optional()
    .isBoolean()
    .withMessage('latest must be a boolean')
    .toBoolean(),
  
  query('device_type')
    .optional()
    .isIn(['CPAP', 'BIPAP'])
    .withMessage('device_type must be either CPAP or BIPAP'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('limit must be an integer between 1 and 1000')
    .toInt(),
  
  query('include_corrupted')
    .optional()
    .isBoolean()
    .withMessage('include_corrupted must be a boolean')
    .toBoolean(),
  
  validate,
];

/**
 * Validation rules for admin ECG data fetch
 */
export const validateAdminECGData = [
  query('device_id')
    .optional()
    .isString()
    .withMessage('device_id must be a string'),
  
  query('patient_id')
    .optional()
    .isString()
    .withMessage('patient_id must be a string'),
  
  query('from')
    .optional()
    .isISO8601()
    .withMessage('from must be a valid ISO 8601 date string'),
  
  query('to')
    .optional()
    .isISO8601()
    .withMessage('to must be a valid ISO 8601 date string'),
  
  query('latest')
    .optional()
    .isBoolean()
    .withMessage('latest must be a boolean')
    .toBoolean(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be an integer between 1 and 100')
    .toInt(),
  
  validate,
];

/**
 * Validation rules for admin OC data fetch
 */
export const validateAdminOCData = [
  query('device_id')
    .exists()
    .withMessage('device_id query parameter is required')
    .isString()
    .withMessage('device_id must be a string')
    .trim()
    .notEmpty()
    .withMessage('device_id cannot be empty'),
  
  query('from')
    .optional()
    .isISO8601()
    .withMessage('from must be a valid ISO 8601 date string'),
  
  query('to')
    .optional()
    .isISO8601()
    .withMessage('to must be a valid ISO 8601 date string'),
  
  query('latest')
    .optional()
    .isBoolean()
    .withMessage('latest must be a boolean')
    .toBoolean(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be an integer between 1 and 100')
    .toInt(),
  
  validate,
];

/**
 * Validation rules for MongoDB ObjectId parameters
 */
export const validateObjectId = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage(`${paramName} must be a valid MongoDB ObjectId`),
  
  validate,
];

