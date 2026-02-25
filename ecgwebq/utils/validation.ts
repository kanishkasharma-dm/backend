/**
 * Validation Utilities
 * Production-grade input validation for ECG data
 */

import { 
  ECGUploadPayload, 
  ValidationResult, 
  ValidationError, 
  ErrorCodes,
  VALIDATION_RULES 
} from '../types/ecg';
import { validatePDFBase64 } from './base64';

/**
 * Validates ECG upload payload
 */
export function validateECGUploadPayload(payload: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Check if payload exists
  if (!payload || typeof payload !== 'object') {
    errors.push({
      field: 'payload',
      message: 'Payload is required and must be an object',
      code: ErrorCodes.MISSING_REQUIRED_FIELD
    });
    return { isValid: false, errors };
  }

  // Validate deviceId
  if (!payload.deviceId || typeof payload.deviceId !== 'string') {
    errors.push({
      field: 'deviceId',
      message: 'Device ID is required and must be a string',
      code: ErrorCodes.MISSING_REQUIRED_FIELD
    });
  } else if (payload.deviceId.length > VALIDATION_RULES.DEVICE_ID_MAX_LENGTH) {
    errors.push({
      field: 'deviceId',
      message: `Device ID must be less than ${VALIDATION_RULES.DEVICE_ID_MAX_LENGTH} characters`,
      code: ErrorCodes.VALIDATION_ERROR
    });
  }

  // Validate patient object
  if (!payload.patient || typeof payload.patient !== 'object') {
    errors.push({
      field: 'patient',
      message: 'Patient information is required and must be an object',
      code: ErrorCodes.MISSING_REQUIRED_FIELD
    });
  } else {
    // Validate patient name
    if (!payload.patient.name || typeof payload.patient.name !== 'string') {
      errors.push({
        field: 'patient.name',
        message: 'Patient name is required and must be a string',
        code: ErrorCodes.MISSING_REQUIRED_FIELD
      });
    } else if (payload.patient.name.length > VALIDATION_RULES.PATIENT_NAME_MAX_LENGTH) {
      errors.push({
        field: 'patient.name',
        message: `Patient name must be less than ${VALIDATION_RULES.PATIENT_NAME_MAX_LENGTH} characters`,
        code: ErrorCodes.VALIDATION_ERROR
      });
    }

    // Validate patient phone (optional)
    if (payload.patient.phone && typeof payload.patient.phone !== 'string') {
      errors.push({
        field: 'patient.phone',
        message: 'Patient phone must be a string',
        code: ErrorCodes.VALIDATION_ERROR
      });
    } else if (payload.patient.phone && payload.patient.phone.length > VALIDATION_RULES.PHONE_MAX_LENGTH) {
      errors.push({
        field: 'patient.phone',
        message: `Patient phone must be less than ${VALIDATION_RULES.PHONE_MAX_LENGTH} characters`,
        code: ErrorCodes.VALIDATION_ERROR
      });
    }

    // Validate patient age (optional)
    if (payload.patient.age !== undefined) {
      if (typeof payload.patient.age !== 'number' || payload.patient.age < 0 || payload.patient.age > 150) {
        errors.push({
          field: 'patient.age',
          message: 'Patient age must be a number between 0 and 150',
          code: ErrorCodes.VALIDATION_ERROR
        });
      }
    }

    // Validate patient gender (optional)
    if (payload.patient.gender && !['M', 'F', 'O'].includes(payload.patient.gender)) {
      errors.push({
        field: 'patient.gender',
        message: 'Patient gender must be M, F, or O',
        code: ErrorCodes.VALIDATION_ERROR
      });
    }
  }

  // Validate metrics object
  if (!payload.metrics || typeof payload.metrics !== 'object') {
    errors.push({
      field: 'metrics',
      message: 'ECG metrics are required and must be an object',
      code: ErrorCodes.MISSING_REQUIRED_FIELD
    });
  } else {
    // Validate heart rate
    if (typeof payload.metrics.heartRate !== 'number') {
      errors.push({
        field: 'metrics.heartRate',
        message: 'Heart rate is required and must be a number',
        code: ErrorCodes.MISSING_REQUIRED_FIELD
      });
    } else if (payload.metrics.heartRate < VALIDATION_RULES.HEART_RATE_MIN || 
               payload.metrics.heartRate > VALIDATION_RULES.HEART_RATE_MAX) {
      errors.push({
        field: 'metrics.heartRate',
        message: `Heart rate must be between ${VALIDATION_RULES.HEART_RATE_MIN} and ${VALIDATION_RULES.HEART_RATE_MAX}`,
        code: ErrorCodes.VALIDATION_ERROR
      });
    }

    // Validate blood pressure (optional)
    if (payload.metrics.bloodPressure) {
      if (typeof payload.metrics.bloodPressure !== 'object') {
        errors.push({
          field: 'metrics.bloodPressure',
          message: 'Blood pressure must be an object',
          code: ErrorCodes.VALIDATION_ERROR
        });
      } else {
        if (payload.metrics.bloodPressure.systolic !== undefined) {
          if (typeof payload.metrics.bloodPressure.systolic !== 'number' ||
              payload.metrics.bloodPressure.systolic < VALIDATION_RULES.BLOOD_PRESSURE_SYSTOLIC_MIN ||
              payload.metrics.bloodPressure.systolic > VALIDATION_RULES.BLOOD_PRESSURE_SYSTOLIC_MAX) {
            errors.push({
              field: 'metrics.bloodPressure.systolic',
              message: `Systolic blood pressure must be between ${VALIDATION_RULES.BLOOD_PRESSURE_SYSTOLIC_MIN} and ${VALIDATION_RULES.BLOOD_PRESSURE_SYSTOLIC_MAX}`,
              code: ErrorCodes.VALIDATION_ERROR
            });
          }
        }

        if (payload.metrics.bloodPressure.diastolic !== undefined) {
          if (typeof payload.metrics.bloodPressure.diastolic !== 'number' ||
              payload.metrics.bloodPressure.diastolic < VALIDATION_RULES.BLOOD_PRESSURE_DIASTOLIC_MIN ||
              payload.metrics.bloodPressure.diastolic > VALIDATION_RULES.BLOOD_PRESSURE_DIASTOLIC_MAX) {
            errors.push({
              field: 'metrics.bloodPressure.diastolic',
              message: `Diastolic blood pressure must be between ${VALIDATION_RULES.BLOOD_PRESSURE_DIASTOLIC_MIN} and ${VALIDATION_RULES.BLOOD_PRESSURE_DIASTOLIC_MAX}`,
              code: ErrorCodes.VALIDATION_ERROR
            });
          }
        }
      }
    }
  }

  // Validate timestamp
  if (!payload.timestamp || typeof payload.timestamp !== 'string') {
    errors.push({
      field: 'timestamp',
      message: 'Timestamp is required and must be a string',
      code: ErrorCodes.MISSING_REQUIRED_FIELD
    });
  } else {
    const timestamp = new Date(payload.timestamp);
    if (isNaN(timestamp.getTime())) {
      errors.push({
        field: 'timestamp',
        message: 'Timestamp must be a valid ISO 8601 date string',
        code: ErrorCodes.INVALID_TIMESTAMP
      });
    } else if (timestamp > new Date()) {
      errors.push({
        field: 'timestamp',
        message: 'Timestamp cannot be in future',
        code: ErrorCodes.INVALID_TIMESTAMP
      });
    }
  }

  // Validate PDF base64
  const pdfValidationErrors = validatePDFBase64(payload.pdfBase64);
  errors.push(...pdfValidationErrors);

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates record ID format
 */
export function validateRecordId(recordId: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!recordId || typeof recordId !== 'string') {
    errors.push({
      field: 'recordId',
      message: 'Record ID is required and must be a string',
      code: ErrorCodes.MISSING_REQUIRED_FIELD
    });
  } else if (recordId.length !== VALIDATION_RULES.RECORD_ID_LENGTH) {
    errors.push({
      field: 'recordId',
      message: `Record ID must be exactly ${VALIDATION_RULES.RECORD_ID_LENGTH} characters`,
      code: ErrorCodes.VALIDATION_ERROR
    });
  } else if (!/^[a-zA-Z0-9]+$/.test(recordId)) {
    errors.push({
      field: 'recordId',
      message: 'Record ID must contain only alphanumeric characters',
      code: ErrorCodes.VALIDATION_ERROR
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates report filters
 */
export function validateReportFilters(filters: any): ValidationResult {
  const errors: ValidationError[] = [];

  if (!filters || typeof filters !== 'object') {
    return { isValid: true, errors: [] }; // No filters is valid
  }

  // Validate name filter
  if (filters.name && typeof filters.name !== 'string') {
    errors.push({
      field: 'name',
      message: 'Name filter must be a string',
      code: ErrorCodes.VALIDATION_ERROR
    });
  }

  // Validate phone filter
  if (filters.phone && typeof filters.phone !== 'string') {
    errors.push({
      field: 'phone',
      message: 'Phone filter must be a string',
      code: ErrorCodes.VALIDATION_ERROR
    });
  }

  // Validate deviceId filter
  if (filters.deviceId && typeof filters.deviceId !== 'string') {
    errors.push({
      field: 'deviceId',
      message: 'Device ID filter must be a string',
      code: ErrorCodes.VALIDATION_ERROR
    });
  }

  // Validate startDate filter
  if (filters.startDate) {
    const startDate = new Date(filters.startDate);
    if (isNaN(startDate.getTime())) {
      errors.push({
        field: 'startDate',
        message: 'Start date must be a valid date string',
        code: ErrorCodes.INVALID_TIMESTAMP
      });
    }
  }

  // Validate endDate filter
  if (filters.endDate) {
    const endDate = new Date(filters.endDate);
    if (isNaN(endDate.getTime())) {
      errors.push({
        field: 'endDate',
        message: 'End date must be a valid date string',
        code: ErrorCodes.INVALID_TIMESTAMP
      });
    }
  }

  // Validate date range
  if (filters.startDate && filters.endDate) {
    const startDate = new Date(filters.startDate);
    const endDate = new Date(filters.endDate);
    if (startDate >= endDate) {
      errors.push({
        field: 'dateRange',
        message: 'Start date must be before end date',
        code: ErrorCodes.VALIDATION_ERROR
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
