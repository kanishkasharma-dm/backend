import jwt from 'jsonwebtoken';

/**
 * Verify JWT token and extract user information
 * Middleware to authenticate requests using JWT tokens
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required',
      error: 'AUTH_TOKEN_MISSING',
    });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token',
        error: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
      });
    }
    
    req.user = user;
    next();
  });
};

/**
 * Check if user has admin role
 * Must be used after authenticateToken middleware
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'AUTH_REQUIRED',
    });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
      error: 'INSUFFICIENT_PERMISSIONS',
    });
  }
  
  next();
};

/**
 * Check if user has doctor role or higher
 * Must be used after authenticateToken middleware
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const requireDoctor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'AUTH_REQUIRED',
    });
  }
  
  if (!['admin', 'doctor'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Doctor or admin access required',
      error: 'INSUFFICIENT_PERMISSIONS',
    });
  }
  
  next();
};

/**
 * Optional authentication - doesn't fail if token is missing
 * Useful for endpoints that work with or without authentication
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    req.user = null;
    return next();
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      req.user = null;
    } else {
      req.user = user;
    }
    next();
  });
};

