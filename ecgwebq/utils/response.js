"use strict";
/**
 * API Response Utilities
 * Production-grade HTTP response formatting for API Gateway
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAPIGatewayResponse = createAPIGatewayResponse;
exports.createSuccessResponse = createSuccessResponse;
exports.createErrorResponse = createErrorResponse;
exports.createValidationErrorResponse = createValidationErrorResponse;
exports.createNotFoundResponse = createNotFoundResponse;
exports.createCORSResponse = createCORSResponse;
exports.withErrorHandler = withErrorHandler;
const ecg_1 = require("../types/ecg");
/**
 * Creates a standardized API Gateway response
 */
function createAPIGatewayResponse(statusCode, body, headers = {}) {
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
function createSuccessResponse(data, statusCode = 200, metadata) {
    const response = {
        success: true,
        data,
        ...(metadata && { metadata })
    };
    return createAPIGatewayResponse(statusCode, response);
}
/**
 * Creates an error response
 */
function createErrorResponse(message, statusCode = 500, code, details) {
    const response = {
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
function createValidationErrorResponse(validationErrors) {
    const response = {
        success: false,
        error: {
            message: 'Validation failed',
            code: ecg_1.ErrorCodes.VALIDATION_ERROR,
            details: validationErrors
        }
    };
    return createAPIGatewayResponse(400, response);
}
/**
 * Creates a not found response
 */
function createNotFoundResponse(message = 'Resource not found') {
    return createErrorResponse(message, 404, ecg_1.ErrorCodes.RECORD_NOT_FOUND);
}
/**
 * Handles CORS preflight requests
 */
function createCORSResponse() {
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
function withErrorHandler(handler) {
    return async (event) => {
        try {
            return await handler(event);
        }
        catch (error) {
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
                return createValidationErrorResponse([{ message: error.message, field: 'general', code: ecg_1.ErrorCodes.VALIDATION_ERROR }]);
            }
            // Generic server error
            return createErrorResponse(process.env.NODE_ENV === 'production'
                ? 'Internal server error'
                : error.message || 'Unknown error', 500, ecg_1.ErrorCodes.INTERNAL_ERROR);
        }
    };
}
