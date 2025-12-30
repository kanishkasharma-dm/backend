/**
 * Tests for validation middleware
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { validate } from '../../middleware/validation.js';
import { validationResult } from 'express-validator';

// Mock express-validator
jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
}));

describe('Validation Middleware', () => {
  const mockRequest = (body = {}) => ({
    body,
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
  });
  
  it('should call next() if validation passes', async () => {
    const req = mockRequest({ device_id: '123' });
    const res = mockResponse();
    
    // Mock validationResult to return no errors
    validationResult.mockReturnValue({
      isEmpty: () => true,
      array: () => [],
    });
    
    await validate(req, res, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
  
  it('should return 400 if validation fails', async () => {
    const req = mockRequest({ device_id: '' });
    const res = mockResponse();
    
    // Mock validationResult to return errors
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [
        {
          path: 'device_id',
          param: 'device_id',
          msg: 'device_id cannot be empty',
          value: '',
          location: 'body',
        },
      ],
    });
    
    await validate(req, res, mockNext);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Request validation failed',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });
});

