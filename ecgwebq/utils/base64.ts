/**
 * Base64 Utilities
 * Production-grade base64 encoding/decoding with validation
 */

import { ErrorCodes, ValidationError } from '../types/ecg';
import { Buffer } from 'buffer';

/**
 * Validates if a string is a valid base64 encoded string
 */
export function isValidBase64(str: string): boolean {
  if (typeof str !== 'string') return false;
  
  // Remove data URL prefix if present
  const base64Data = str.replace(/^data:application\/pdf;base64,/, '');
  
  // Check if the string is empty
  if (!base64Data.trim()) return false;
  
  try {
    // Use Node.js Buffer instead of browser btoa/atob
    const buffer = Buffer.from(base64Data, 'base64');
    const reencoded = buffer.toString('base64');
    return reencoded === base64Data;
  } catch {
    return false;
  }
}

/**
 * Extracts base64 data from data URL
 */
export function extractBase64Data(dataUrl: string): string {
  if (typeof dataUrl !== 'string') {
    throw new Error('Input must be a string');
  }
  
  const base64Data = dataUrl.replace(/^data:application\/pdf;base64,/, '');
  
  if (!base64Data) {
    throw new Error('No base64 data found in input');
  }
  
  return base64Data;
}

/**
 * Converts base64 string to binary buffer
 */
export function base64ToBuffer(base64String: string): Buffer {
  if (!isValidBase64(base64String)) {
    throw new Error('Invalid base64 string format');
  }
  
  try {
    const base64Data = extractBase64Data(base64String);
    return Buffer.from(base64Data, 'base64');
  } catch (error) {
    throw new Error(`Failed to convert base64 to buffer: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validates PDF base64 content
 */
export function validatePDFBase64(base64String: string): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!base64String || typeof base64String !== 'string') {
    errors.push({
      field: 'pdfBase64',
      message: 'PDF base64 is required and must be a string',
      code: ErrorCodes.MISSING_REQUIRED_FIELD
    });
    return errors;
  }
  
  // Check if it's a valid base64
  if (!isValidBase64(base64String)) {
    errors.push({
      field: 'pdfBase64',
      message: 'Invalid base64 format',
      code: ErrorCodes.INVALID_BASE64
    });
    return errors;
  }
  
  try {
    const buffer = base64ToBuffer(base64String);
    
    // Check if it's a valid PDF by checking PDF header
    const pdfHeader = buffer.slice(0, 4).toString();
    if (pdfHeader !== '%PDF') {
      errors.push({
        field: 'pdfBase64',
        message: 'Invalid PDF format - missing PDF header',
        code: ErrorCodes.INVALID_BASE64
      });
    }
    
    // Check minimum PDF size (should be at least 100 bytes for a valid PDF)
    if (buffer.length < 100) {
      errors.push({
        field: 'pdfBase64',
        message: 'PDF content too small to be valid',
        code: ErrorCodes.INVALID_BASE64
      });
    }
    
    // Check maximum PDF size (10MB limit)
    if (buffer.length > 10 * 1024 * 1024) {
      errors.push({
        field: 'pdfBase64',
        message: 'PDF size exceeds 10MB limit',
        code: ErrorCodes.INVALID_BASE64
      });
    }
    
  } catch (error) {
    errors.push({
      field: 'pdfBase64',
      message: `PDF validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      code: ErrorCodes.INVALID_BASE64
    });
  }
  
  return errors;
}

/**
 * Gets file size from base64 string
 */
export function getBase64FileSize(base64String: string): number {
  try {
    const buffer = base64ToBuffer(base64String);
    return buffer.length;
  } catch {
    return 0;
  }
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
