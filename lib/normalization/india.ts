// Indian B2B Data Normalization Engine

export interface PhoneNormalizationResult {
  raw: string;
  normalized: string; // E.164 format: +91XXXXXXXXXX
  isValid: boolean;
  type: 'MOBILE' | 'LANDLINE' | 'UNKNOWN';
  circle?: string;
  error?: string;
}

export interface GSTINValidationResult {
  gstin: string;
  isValid: boolean;
  stateCode?: string;
  stateName?: string;
  pan?: string;
  entityCode?: string;
  error?: string;
}

export interface EntityTypeDetectionResult {
  rawName: string;
  cleanName: string;
  entityType: 'PVT_LTD' | 'LLP' | 'LTD' | 'MSME' | 'PROPRIETORSHIP';
  legalSuffix: string;
}

// Indian GST State Codes Map
export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

// Major Indian Hubs
export const INDIAN_TIER_1_CITIES = [
  'Bengaluru',
  'Bangalore',
  'Mumbai',
  'Delhi',
  'New Delhi',
  'Gurugram',
  'Gurgaon',
  'Noida',
  'Hyderabad',
  'Chennai',
  'Pune',
  'Kolkata',
  'Ahmedabad',
];

export const INDIAN_TIER_2_CITIES = [
  'Jaipur',
  'Chandigarh',
  'Indore',
  'Coimbatore',
  'Kochi',
  'Cochin',
  'Vadodara',
  'Nagpur',
  'Surat',
  'Bhopal',
  'Visakhapatnam',
  'Bhubaneswar',
  'Lucknow',
  'Kanpur',
  'Patna',
  'Nashik',
  'Rajkot',
  'Madurai',
  'Mysuru',
  'Mysore',
];

/**
 * Normalizes Indian phone numbers into standard E.164 (+91XXXXXXXXXX)
 */
export function normalizeIndianPhone(rawPhone: string): PhoneNormalizationResult {
  if (!rawPhone) {
    return { raw: '', normalized: '', isValid: false, type: 'UNKNOWN', error: 'Phone is empty' };
  }

  // Strip all non-digit characters except leading '+'
  const cleaned = rawPhone.replace(/[^\d+]/g, '');

  let digitsOnly = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;

  // Handle leading 0 (e.g. 09876543210 -> 9876543210)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    digitsOnly = digitsOnly.slice(1);
  }

  // Handle 91 prefix without plus (e.g. 919876543210 -> 9876543210)
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    digitsOnly = digitsOnly.slice(2);
  }

  // Check if we have a valid 10-digit Indian number
  if (digitsOnly.length !== 10) {
    return {
      raw: rawPhone,
      normalized: cleaned.startsWith('+') ? cleaned : `+${cleaned}`,
      isValid: false,
      type: 'UNKNOWN',
      error: `Invalid length: expected 10 digits for Indian number, got ${digitsOnly.length}`,
    };
  }

  // Indian mobile numbers start with 6, 7, 8, or 9
  const firstDigit = digitsOnly[0];
  const isMobile = ['6', '7', '8', '9'].includes(firstDigit);

  const normalized = `+91${digitsOnly}`;

  return {
    raw: rawPhone,
    normalized,
    isValid: true,
    type: isMobile ? 'MOBILE' : 'LANDLINE',
  };
}

/**
 * Validates Indian GSTIN (Goods and Services Tax Identification Number)
 * Format: 2 digits state code + 10 char PAN (5 letters, 4 digits, 1 letter) + 1 digit entity + 'Z' + 1 checksum
 */
export function validateIndianGSTIN(gstin: string): GSTINValidationResult {
  if (!gstin) {
    return { gstin: '', isValid: false, error: 'GSTIN is empty' };
  }

  const cleanGSTIN = gstin.trim().toUpperCase();
  const gstinRegex = /^([0-9]{2})([A-Z]{5}[0-9]{4}[A-Z]{1})([1-9A-Z]{1})(Z)([0-9A-Z]{1})$/;
  const match = cleanGSTIN.match(gstinRegex);

  if (!match) {
    return {
      gstin: cleanGSTIN,
      isValid: false,
      error: 'Invalid GSTIN structure. Must match 22AAAAA0000A1Z5 pattern.',
    };
  }

  const stateCode = match[1];
  const pan = match[2];
  const entityCode = match[3];
  const stateName = GST_STATE_CODES[stateCode] || 'Unknown State';

  return {
    gstin: cleanGSTIN,
    isValid: true,
    stateCode,
    stateName,
    pan,
    entityCode,
  };
}

/**
 * Parses Indian company names to detect entity structure (Pvt Ltd, LLP, Ltd, MSME)
 */
export function detectIndianEntityType(companyName: string): EntityTypeDetectionResult {
  const trimmed = companyName.trim();
  const lower = trimmed.toLowerCase();

  if (
    lower.includes('pvt ltd') ||
    lower.includes('private limited') ||
    lower.includes('pvt. ltd.') ||
    lower.includes('p. ltd')
  ) {
    const clean = trimmed.replace(/(pvt\.?\s*ltd\.?|private\s+limited)/gi, '').trim();
    return {
      rawName: trimmed,
      cleanName: clean,
      entityType: 'PVT_LTD',
      legalSuffix: 'Pvt. Ltd.',
    };
  }

  if (lower.includes('llp') || lower.includes('limited liability partnership')) {
    const clean = trimmed.replace(/(llp|limited\s+liability\s+partnership)/gi, '').trim();
    return {
      rawName: trimmed,
      cleanName: clean,
      entityType: 'LLP',
      legalSuffix: 'LLP',
    };
  }

  if (lower.endsWith(' ltd') || lower.endsWith(' ltd.') || lower.endsWith(' limited')) {
    const clean = trimmed.replace(/(ltd\.?|limited)$/gi, '').trim();
    return {
      rawName: trimmed,
      cleanName: clean,
      entityType: 'LTD',
      legalSuffix: 'Ltd.',
    };
  }

  if (lower.includes('enterprise') || lower.includes('industries') || lower.includes('trading co')) {
    return {
      rawName: trimmed,
      cleanName: trimmed,
      entityType: 'MSME',
      legalSuffix: '',
    };
  }

  return {
    rawName: trimmed,
    cleanName: trimmed,
    entityType: 'PROPRIETORSHIP',
    legalSuffix: '',
  };
}

/**
 * Normalizes email address and extracts domain
 */
export function normalizeEmail(email: string): { normalized: string; domain: string; isValid: boolean } {
  if (!email) return { normalized: '', domain: '', isValid: false };
  const normalized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = emailRegex.test(normalized);
  const domain = isValid ? normalized.split('@')[1] : '';
  return { normalized, domain, isValid };
}
