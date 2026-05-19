import crypto from 'crypto';
import { signPayload, stableStringify } from '../modules/licenses/crypto.js';

function safeTokenCompare(actualToken, expectedToken) {
  if (!actualToken || !expectedToken) return false;

  const actual = Buffer.from(String(actualToken), 'utf8');
  const expected = Buffer.from(String(expectedToken), 'utf8');
  if (actual.length !== expected.length) return false;

  return crypto.timingSafeEqual(actual, expected);
}

export function requireLicenseAdmin(req, res, next) {
  const expectedToken = process.env.ADMIN_TOKEN;
  if (!expectedToken) {
    return res.status(503).json({
      success: false,
      message: 'License admin auth is not configured',
    });
  }

  const token = req.get('x-admin-token');
  if (!safeTokenCompare(token, expectedToken)) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  req.licenseAdmin = { id: 'admin-token' };
  return next();
}

function getSignatureHeader(req) {
  return req.get('x-signature') || req.get('x-hmac-signature') || req.get('x-cardiox-signature');
}

function requestSigningPayload(req) {
  const method = req.method.toUpperCase();
  const path = req.originalUrl.split('?')[0];
  const query = stableStringify(req.query || {});
  const body = req.rawBody || (req.body && Object.keys(req.body).length ? stableStringify(req.body) : '');

  return `${method}\n${path}\n${query}\n${body}`;
}

export function requireLicenseAdminSigned(req, res, next) {
  requireLicenseAdmin(req, res, () => {
    const signature = getSignatureHeader(req);
    if (!signature) {
      return res.status(401).json({
        success: false,
        message: 'Missing request signature',
      });
    }

    let expected;
    try {
      expected = signPayload(requestSigningPayload(req));
    } catch (error) {
      return res.status(503).json({
        success: false,
        message: 'License request signing is not configured',
      });
    }

    const actual = Buffer.from(String(signature), 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (actual.length !== expectedBuffer.length || !crypto.timingSafeEqual(actual, expectedBuffer)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid request signature',
      });
    }

    return next();
  });
}
