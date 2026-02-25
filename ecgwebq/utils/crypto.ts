/**
 * Cryptographic Utilities
 * Production-grade cryptographically secure random string generation
 */

import { randomBytes } from 'crypto';

/**
 * Generates a cryptographically secure random string
 */
export function generateSecureRandomString(length: number): string {
  const bytes = randomBytes(Math.ceil(length / 2));
  return bytes.toString('hex').slice(0, length);
}

/**
 * Generates a unique record ID
 */
export function generateRecordId(): string {
  return generateSecureRandomString(32);
}

/**
 * Generates a unique patient ID
 */
export function generatePatientId(): string {
  const prefix = 'P';
  const randomPart = generateSecureRandomString(8);
  return `${prefix}${randomPart}`;
}

/**
 * Generates a timestamp-based unique identifier
 */
export function generateTimestampId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = generateSecureRandomString(8);
  return `${timestamp}_${randomPart}`;
}
