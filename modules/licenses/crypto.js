import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LICENSE_KEY_PATTERN = /^[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/;

export const MAX_ACTIVATIONS = Object.freeze({ 0: 1, 1: 2, 2: 3, 3: 10 });
export const TIER_NAMES = Object.freeze({ 0: 'Trial', 1: 'Standard', 2: 'Professional', 3: 'Enterprise' });

function getHmacSecret() {
  const secret = process.env.HMAC_SECRET;
  if (!secret) {
    throw new Error('HMAC_SECRET env var not set');
  }
  return secret;
}

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i += 1) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(value) {
  const stripped = stripKey(value);
  const lookup = {};
  for (let i = 0; i < ALPHABET.length; i += 1) lookup[ALPHABET[i]] = i;

  let bits = 0;
  let current = 0;
  const output = [];

  for (const char of stripped) {
    if (!(char in lookup)) throw new Error(`Invalid Base32 char: ${char}`);
    current = (current << 5) | lookup[char];
    bits += 5;
    if (bits >= 8) {
      output.push((current >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

export function formatKey(raw) {
  return raw.match(/.{1,5}/g).join('-');
}

export function stripKey(key) {
  return String(key || '').toUpperCase().replace(/-/g, '');
}

export function normalizeLicenseKey(key) {
  const stripped = stripKey(key);
  if (stripped.length !== 20) {
    throw new Error('Invalid key length');
  }

  const formatted = formatKey(stripped);
  if (!LICENSE_KEY_PATTERN.test(formatted)) {
    throw new Error('Invalid key format');
  }

  return formatted;
}

export function generateLicenseKey(tier, expiryTimestamp) {
  const payload = Buffer.alloc(9);
  payload.writeUInt8(tier, 0);
  payload.writeUInt32BE(expiryTimestamp, 1);
  crypto.randomBytes(4).copy(payload, 5);

  const digest = crypto.createHmac('sha256', getHmacSecret()).update(payload).digest();
  const full = Buffer.concat([payload, digest.slice(0, 3)]);
  return formatKey(base32Encode(full));
}

export function decodeLicenseKey(licenseKey) {
  const raw = stripKey(licenseKey);
  if (raw.length !== 20) throw new Error('Invalid key length');

  const bytes = base32Decode(raw);
  if (bytes.length < 12) throw new Error('Decoded key too short');

  const tier = bytes.readUInt8(0);
  const expiry = bytes.readUInt32BE(1);
  const storedChecksum = bytes.slice(9, 12);
  const payload = bytes.slice(0, 9);
  const expectedChecksum = crypto
    .createHmac('sha256', getHmacSecret())
    .update(payload)
    .digest()
    .slice(0, 3);

  if (!crypto.timingSafeEqual(storedChecksum, expectedChecksum)) {
    throw new Error('Invalid key checksum');
  }

  return { tier, expiry, valid: true };
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(',')}}`;
}

export function signPayload(bodyString) {
  return crypto.createHmac('sha256', getHmacSecret()).update(bodyString).digest('hex');
}

export function safeCompareHex(expectedHex, actualHex) {
  if (!expectedHex || !actualHex) return false;
  if (!/^[a-f0-9]+$/i.test(actualHex)) return false;

  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(actualHex, 'hex');
  if (expected.length !== actual.length) return false;

  return crypto.timingSafeEqual(expected, actual);
}

export function verifyRequestSignature(bodyString, sigHeader) {
  return safeCompareHex(signPayload(bodyString), String(sigHeader || ''));
}

export function makeSignedBody(data) {
  const bodyObj = { ...data };
  const serverSig = signPayload(stableStringify(bodyObj));
  return { ...bodyObj, server_sig: serverSig };
}
