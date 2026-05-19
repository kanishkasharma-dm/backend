const SENSITIVE_KEYS = new Set(['admin_token', 'x-admin-token', 'authorization', 'password', 'secret']);

function redact(value) {
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : entryValue,
    ])
  );
}

export function auditLicenseEvent(event, req, details = {}) {
  console.log(JSON.stringify({
    event,
    actor: req?.licenseAdmin?.id || 'license-admin',
    ip: req?.ip,
    method: req?.method,
    path: req?.originalUrl,
    userAgent: req?.get?.('user-agent'),
    details: redact(details),
    timestamp: new Date().toISOString(),
  }));
}
