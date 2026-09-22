import { describe, it, expect } from 'vitest';
import {
  normalizeIndianPhone,
  validateIndianGSTIN,
  detectIndianEntityType,
  normalizeEmail,
} from '../lib/normalization/india';

describe('Indian B2B Data Normalization Engine', () => {
  it('should normalize standard 10-digit Indian mobile number to +91 E.164', () => {
    const res = normalizeIndianPhone('9876543210');
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe('+919876543210');
    expect(res.type).toBe('MOBILE');
  });

  it('should handle leading 0 in Indian numbers', () => {
    const res = normalizeIndianPhone('09876543210');
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe('+919876543210');
  });

  it('should handle existing +91 prefix and formatting spaces or dashes', () => {
    const res = normalizeIndianPhone('+91 98765-43210');
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe('+919876543210');
  });

  it('should reject invalid phone length', () => {
    const res = normalizeIndianPhone('12345');
    expect(res.isValid).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('should validate valid Indian GSTIN and extract state', () => {
    // Karnataka GST code 29
    const res = validateIndianGSTIN('29AAACA1234A1Z5');
    expect(res.isValid).toBe(true);
    expect(res.stateCode).toBe('29');
    expect(res.stateName).toBe('Karnataka');
    expect(res.pan).toBe('AAACA1234A');
  });

  it('should reject invalid GSTIN format', () => {
    const res = validateIndianGSTIN('INVALID_GSTIN_123');
    expect(res.isValid).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('should detect Indian business entity types', () => {
    expect(detectIndianEntityType('Bharat Precision Tools Pvt Ltd').entityType).toBe('PVT_LTD');
    expect(detectIndianEntityType('Kavach Cloud Systems LLP').entityType).toBe('LLP');
    expect(detectIndianEntityType('Tata Steel Ltd').entityType).toBe('LTD');
    expect(detectIndianEntityType('Siddhivinayak Agro Enterprises').entityType).toBe('MSME');
  });

  it('should normalize email and extract company domain', () => {
    const res = normalizeEmail('  Vikram.M@ApexTech.in ');
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe('vikram.m@apextech.in');
    expect(res.domain).toBe('apextech.in');
  });
});
