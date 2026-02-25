"use strict";
/**
 * ECG Domain Models and Types
 * Production-grade TypeScript interfaces for ECG data management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALIDATION_RULES = exports.S3_CONFIG = exports.ErrorCodes = void 0;
// Error codes
var ErrorCodes;
(function (ErrorCodes) {
    ErrorCodes["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCodes["S3_UPLOAD_ERROR"] = "S3_UPLOAD_ERROR";
    ErrorCodes["S3_LIST_ERROR"] = "S3_LIST_ERROR";
    ErrorCodes["S3_GET_ERROR"] = "S3_GET_ERROR";
    ErrorCodes["RECORD_NOT_FOUND"] = "RECORD_NOT_FOUND";
    ErrorCodes["INVALID_BASE64"] = "INVALID_BASE64";
    ErrorCodes["INVALID_TIMESTAMP"] = "INVALID_TIMESTAMP";
    ErrorCodes["MISSING_REQUIRED_FIELD"] = "MISSING_REQUIRED_FIELD";
    ErrorCodes["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCodes["UNAUTHORIZED"] = "UNAUTHORIZED";
})(ErrorCodes || (exports.ErrorCodes = ErrorCodes = {}));
// Constants
exports.S3_CONFIG = {
    BUCKET_NAME: 'deck-backend-demo',
    REGION: 'us-east-1',
    PREFIX: 'ecg-reports/',
    PRESIGNED_URL_TTL: 300, // 5 minutes - practical for admin viewing/downloading
};
exports.VALIDATION_RULES = {
    HEART_RATE_MIN: 30,
    HEART_RATE_MAX: 300,
    BLOOD_PRESSURE_SYSTOLIC_MIN: 60,
    BLOOD_PRESSURE_SYSTOLIC_MAX: 250,
    BLOOD_PRESSURE_DIASTOLIC_MIN: 30,
    BLOOD_PRESSURE_DIASTOLIC_MAX: 150,
    DEVICE_ID_MAX_LENGTH: 100,
    PATIENT_NAME_MAX_LENGTH: 100,
    PHONE_MAX_LENGTH: 20,
    RECORD_ID_LENGTH: 32,
};
