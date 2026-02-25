/**
 * ECG Domain Models and Types
 * Production-grade TypeScript interfaces for ECG data management
 */

export interface Patient {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  age?: number;
  gender?: 'M' | 'F' | 'O';
  address?: string;
  medicalHistory?: string[];
}

export interface ECGMetrics {
  heartRate: number;
  bloodPressure?: {
    systolic: number;
    diastolic: number;
  };
  intervals?: {
    pr: number;
    qrs: number;
    qt: number;
    qtc?: number;
  };
  rhythm?: string;
  interpretation?: string;
  abnormalities?: string[];
  recommendations?: string[];
}

export interface ECGRecord {
  recordId: string;
  deviceId: string;
  patient: Patient;
  metrics: ECGMetrics;
  timestamp: string; // ISO 8601 format
  pdfBase64: string; // Base64 encoded PDF
  createdAt?: string;
  updatedAt?: string;
}

export interface ECGUploadPayload {
  deviceId: string;
  patient: Omit<Patient, 'id'>; // Patient ID will be generated
  metrics: ECGMetrics;
  timestamp: string;
  pdfBase64: string;
}

export interface ECGReportMetadata {
  recordId: string;
  deviceId: string;
  patient: {
    id: string;
    name: string;
    phone?: string;
  };
  timestamp: string;
  createdAt?: string;
  fileSize?: number;
  hasPdf: boolean;
  
  // Add these fields for ReportsPage compatibility
  id?: string;
  name?: string;
  phoneNumber?: string;
  date?: string;
  type?: string;
  ecg?: any; // For detailed ECG data
}

export interface ReportFilters {
  name?: string;
  phone?: string;
  deviceId?: string;
  startDate?: string;
  endDate?: string;
}

export interface CreateDoctorPayload {
  name: string;
  email: string;
  specialization: string;
  hospital?: string;
  licenseNumber?: string;
}

export interface Doctor {
  doctorId: string;
  name: string;
  email: string;
  specialization: string;
  hospital?: string;
  licenseNumber?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface S3ObjectMetadata {
  Key: string;
  Size?: number;
  LastModified?: string;
  ETag?: string;
}

export interface APIGatewayEvent {
  httpMethod: string;
  path: string;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
}

export interface APIGatewayResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  metadata?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface UploadResponse {
  success: boolean;
  recordId: string;
}

export interface ReportsResponse {
  success: boolean;
  data: ECGReportMetadata[];
  metadata: {
    total: number;
    filtered?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

export interface ReportUrlsResponse {
  success: boolean;
  data: {
    jsonUrl: string;
    pdfUrl: string | null;
    expiresIn: number;
    generatedAt?: string; // ISO timestamp of when URLs were generated
  };
}

// Validation schemas
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// S3 Service interfaces
export interface S3UploadResult {
  Key: string;
  ETag: string;
  Location?: string;
}

export interface S3SignedUrlResult {
  url: string;
  expiresIn: number;
}

// Error codes
export enum ErrorCodes {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  S3_UPLOAD_ERROR = 'S3_UPLOAD_ERROR',
  S3_LIST_ERROR = 'S3_LIST_ERROR',
  S3_GET_ERROR = 'S3_GET_ERROR',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  INVALID_BASE64 = 'INVALID_BASE64',
  INVALID_TIMESTAMP = 'INVALID_TIMESTAMP',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED'
}

// Constants
export const S3_CONFIG = {
  BUCKET_NAME: 'deck-backend-demo',
  REGION: 'us-east-1',
  PREFIX: 'ecg-reports/',
  PRESIGNED_URL_TTL: 300, // 5 minutes - practical for admin viewing/downloading
} as const;

export const VALIDATION_RULES = {
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
} as const;

export interface S3File {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  type: string;
  url: string | null;
  recordId: string;
  dateFolder: string;
  patientFolder: string;
  fullPath: string;
}

export interface S3FilesResponse {
  files: S3File[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}