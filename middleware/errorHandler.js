/**
 * Centralized error handling middleware
 * Handles all errors in a consistent format
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // Default error response
  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errorCode = err.code || 'INTERNAL_ERROR';
  let details = null;
  
  // MongoDB connection errors
  if (err.name === 'MongoServerError' || err.name === 'MongooseError') {
    statusCode = 503;
    message = 'Database connection error';
    errorCode = 'DATABASE_ERROR';
    details = process.env.NODE_ENV === 'development' ? err.message : undefined;
  }
  
  // MongoDB validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    errorCode = 'VALIDATION_ERROR';
    details = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
    }));
  }
  
  // MongoDB duplicate key errors
  if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate entry';
    errorCode = 'DUPLICATE_ENTRY';
    const field = Object.keys(err.keyPattern || {})[0];
    details = {
      field,
      message: `${field} already exists`,
    };
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    errorCode = 'TOKEN_INVALID';
  }
  
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    errorCode = 'TOKEN_EXPIRED';
  }
  
  // Express validator errors
  if (err.name === 'ValidationError' && Array.isArray(err.errors)) {
    statusCode = 400;
    message = 'Request validation failed';
    errorCode = 'VALIDATION_ERROR';
    details = err.errors;
  }
  
  // Multer errors (file upload)
  if (err.name === 'MulterError') {
    statusCode = 400;
    message = 'File upload error';
    errorCode = 'FILE_UPLOAD_ERROR';
    details = err.message;
  }
  
  // AWS SDK errors
  if (err.name === 'S3ServiceException' || err.name === 'IoTDataPlaneServiceException') {
    statusCode = 503;
    message = 'AWS service error';
    errorCode = 'AWS_SERVICE_ERROR';
    details = process.env.NODE_ENV === 'development' ? err.message : undefined;
  }
  
  // Custom application errors
  if (err.isCustomError) {
    statusCode = err.statusCode || 400;
    message = err.message;
    errorCode = err.errorCode || 'CUSTOM_ERROR';
    details = err.details || null;
  }
  
  // Build error response
  const errorResponse = {
    success: false,
    message,
    error: errorCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };
  
  // Add details in development mode or if explicitly provided
  if (details) {
    errorResponse.details = details;
  }
  
  // Add stack trace in development mode only
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.stack = err.stack;
  }
  
  // Log error details
  console.error(`[${errorCode}] ${message}`, {
    statusCode,
    path: req.path,
    method: req.method,
    details,
  });
  
  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper - catches errors in async route handlers
 * Usage: wrapAsync(async (req, res) => { ... })
 * 
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
export const wrapAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create custom error with status code and error code
 * 
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} errorCode - Application error code
 * @param {*} details - Additional error details
 * @returns {Error} Custom error object
 */
export const createError = (message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  error.errorCode = errorCode;
  error.isCustomError = true;
  if (details) {
    error.details = details;
  }
  return error;
};

