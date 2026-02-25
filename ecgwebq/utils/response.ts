/**
 * API Response Utilities
 * Production-grade HTTP response formatting for API Gateway
 */

import { APIGatewayResponse, APIResponse, ErrorCodes } from '../types/ecg';

/**
 * Creates a standardized API Gateway response
 */
export function createAPIGatewayResponse(
  statusCode: number,
  body: any,
  headers: Record<string, string> = {}
): APIGatewayResponse {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400',
  };

  return {
    statusCode,
    headers: { ...defaultHeaders, ...headers },
    body: JSON.stringify(body),
    isBase64Encoded: false
  };
}

/**
 * Creates a success response
 */
export function createSuccessResponse<T>(
  data: T,
  statusCode: number = 200,
  metadata?: any
): APIGatewayResponse {
  const response: APIResponse<T> = {
    success: true,
    data,
    ...(metadata && { metadata })
  };

  return createAPIGatewayResponse(statusCode, response);
}

/**
 * Creates an error response
 */
export function createErrorResponse(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): APIGatewayResponse {
  const response: APIResponse = {
    success: false,
    error: {
      message,
      ...(code && { code }),
      ...(details && { details })
    }
  };

  return createAPIGatewayResponse(statusCode, response);
}

/**
 * Creates a validation error response
 */
export function createValidationErrorResponse(
  validationErrors: any[]
): APIGatewayResponse {
  const response: APIResponse = {
    success: false,
    error: {
      message: 'Validation failed',
      code: ErrorCodes.VALIDATION_ERROR,
      details: validationErrors
    }
  };

  return createAPIGatewayResponse(400, response);
}

/**
 * Creates a not found response
 */
export function createNotFoundResponse(message: string = 'Resource not found'): APIGatewayResponse {
  return createErrorResponse(message, 404, ErrorCodes.RECORD_NOT_FOUND);
}

/**
 * Handles CORS preflight requests
 */
export function createCORSResponse(): APIGatewayResponse {
  return createAPIGatewayResponse(200, {}, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400'
  });
}

/**
 * Wraps async handlers with error handling
 */
export function withErrorHandler(handler: Function) {
  return async (event: any) => {
    try {
      return await handler(event);
    } catch (error: any) {
      console.error('Unhandled error in handler:', error);

      // Handle specific error types
      if (error.name === 'ValidationError') {
        return createValidationErrorResponse(error.details || [error.message]);
      }

      if (error.name === 'NoSuchKey' || error.message?.includes('not found')) {
        return createNotFoundResponse(error.message || 'Resource not found');
      }

      if (error.message?.includes('Access Denied')) {
        return createErrorResponse('Access denied', 403, 'ACCESS_DENIED');
      }

      if (error.message?.includes('Validation failed')) {
        return createValidationErrorResponse([{ message: error.message, field: 'general', code: ErrorCodes.VALIDATION_ERROR }]);
      }

      // Generic server error
      return createErrorResponse(
        process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : error.message || 'Unknown error',
        500,
        ErrorCodes.INTERNAL_ERROR
      );
    }
  };
}
