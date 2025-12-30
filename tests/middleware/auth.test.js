/**
 * Tests for authentication middleware
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { authenticateToken, requireAdmin, requireDoctor } from '../../middleware/auth.js';

describe('Authentication Middleware', () => {
  const mockRequest = (headers = {}) => ({
    headers,
    user: null,
  });
  
  const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };
  
  const mockNext = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });
  
  describe('authenticateToken', () => {
    it('should return 401 if no token is provided', () => {
      const req = mockRequest();
      const res = mockResponse();
      
      authenticateToken(req, res, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Access token required',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    it('should return 403 if token is invalid', () => {
      const req = mockRequest({
        authorization: 'Bearer invalid-token',
      });
      const res = mockResponse();
      
      authenticateToken(req, res, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Invalid or expired token',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    it('should call next() if token is valid', () => {
      const token = jwt.sign(
        { userId: '123', username: 'test', role: 'admin' },
        process.env.JWT_SECRET
      );
      const req = mockRequest({
        authorization: `Bearer ${token}`,
      });
      const res = mockResponse();
      
      authenticateToken(req, res, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(req.user).toMatchObject({
        userId: '123',
        username: 'test',
        role: 'admin',
      });
    });
  });
  
  describe('requireAdmin', () => {
    it('should return 401 if user is not authenticated', () => {
      const req = mockRequest();
      const res = mockResponse();
      
      requireAdmin(req, res, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    it('should return 403 if user is not admin', () => {
      const req = mockRequest();
      req.user = { userId: '123', role: 'doctor' };
      const res = mockResponse();
      
      requireAdmin(req, res, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    it('should call next() if user is admin', () => {
      const req = mockRequest();
      req.user = { userId: '123', role: 'admin' };
      const res = mockResponse();
      
      requireAdmin(req, res, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });
  
  describe('requireDoctor', () => {
    it('should return 401 if user is not authenticated', () => {
      const req = mockRequest();
      const res = mockResponse();
      
      requireDoctor(req, res, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    it('should return 403 if user is not doctor or admin', () => {
      const req = mockRequest();
      req.user = { userId: '123', role: 'patient' };
      const res = mockResponse();
      
      requireDoctor(req, res, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    it('should call next() if user is doctor', () => {
      const req = mockRequest();
      req.user = { userId: '123', role: 'doctor' };
      const res = mockResponse();
      
      requireDoctor(req, res, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
    
    it('should call next() if user is admin', () => {
      const req = mockRequest();
      req.user = { userId: '123', role: 'admin' };
      const res = mockResponse();
      
      requireDoctor(req, res, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });
});

