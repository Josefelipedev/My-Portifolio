import { describe, it, expect } from 'vitest';
import {
  ApiError,
  Errors,
  validateEmail,
  validateMinLength,
} from '@/lib/api-utils';

describe('ApiError', () => {
  it('should create error with default status code', () => {
    const error = new ApiError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('ApiError');
  });

  it('should create error with custom status code', () => {
    const error = new ApiError('Not found', 404, 'NOT_FOUND');
    expect(error.message).toBe('Not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });
});

describe('Errors factory', () => {
  it('should create BadRequest error', () => {
    const error = Errors.BadRequest('Invalid input');
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Invalid input');
  });

  it('should create Unauthorized error', () => {
    const error = Errors.Unauthorized();
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Unauthorized');
  });

  it('should create RateLimited error', () => {
    const error = Errors.RateLimited();
    expect(error.statusCode).toBe(429);
  });
});

describe('validateEmail', () => {
  it('should return true for valid emails', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user.name@domain.org')).toBe(true);
    expect(validateEmail('user+tag@example.co.uk')).toBe(true);
  });

  it('should return false for invalid emails', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('invalid@')).toBe(false);
    expect(validateEmail('@domain.com')).toBe(false);
    expect(validateEmail('test@.com')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });
});

describe('validateMinLength', () => {
  it('should not throw for valid input', () => {
    expect(() => validateMinLength('hello', 3, 'Field')).not.toThrow();
    expect(() => validateMinLength('hello', 5, 'Field')).not.toThrow();
  });

  it('should throw for input shorter than minimum', () => {
    expect(() => validateMinLength('hi', 3, 'Name')).toThrow(
      'Name must be at least 3 characters'
    );
  });

  it('should trim whitespace when checking length', () => {
    expect(() => validateMinLength('  hi  ', 3, 'Field')).toThrow();
  });
});
