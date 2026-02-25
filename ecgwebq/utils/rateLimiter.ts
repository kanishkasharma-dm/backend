/**
 * Rate Limiting Utilities
 * Simple in-memory rate limiting for API protection
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (for production, use Redis or DynamoDB)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Checks if a request should be rate limited
 * @param identifier - Unique identifier (IP address, API key, etc.)
 * @param limit - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000 // 1 minute
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    // New window or expired entry
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs
    };
    rateLimitStore.set(identifier, newEntry);
    
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime: newEntry.resetTime
    };
  }

  // Existing window
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(identifier, entry);

  return {
    allowed: true,
    remaining: limit - entry.count,
    resetTime: entry.resetTime
  };
}

/**
 * Extracts client identifier from request
 */
export function getClientIdentifier(event: any): string {
  // Try to get client IP from various headers
  const ip = event.headers?.['x-forwarded-for'] || 
              event.headers?.['x-real-ip'] || 
              event.requestContext?.identity?.sourceIp ||
              'unknown';
  
  // If multiple IPs, take the first one
  return ip.split(',')[0].trim();
}

/**
 * Cleanup expired entries (call periodically)
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}
