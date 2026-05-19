import { getLicensePool } from '../../config/postgres.js';
import {
  MAX_ACTIVATIONS,
  TIER_NAMES,
  decodeLicenseKey,
  generateLicenseKey,
  normalizeLicenseKey,
} from './crypto.js';

const VALID_TIERS = new Set([0, 1, 2, 3]);

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

function sanitizeText(value, maxLength) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, maxLength);
}

function assertValidTier(tier) {
  if (!Number.isInteger(tier) || !VALID_TIERS.has(tier)) {
    const error = new Error('Invalid tier');
    error.status = 400;
    throw error;
  }
}

function assertValidExpiry(expiry) {
  if (!Number.isInteger(expiry) || expiry < 0 || expiry > 4294967295) {
    const error = new Error('Invalid expiry');
    error.status = 400;
    throw error;
  }
}

export function publicLicenseRow(row) {
  return {
    id: row.id,
    license_key: row.license_key,
    backup_key: row.backup_key,
    tier: row.tier,
    tier_name: TIER_NAMES[row.tier] || 'Unknown',
    expiry: row.expiry,
    lifetime: row.expiry === 0,
    revoked: row.revoked,
    created_at: row.created_at,
    revoked_at: row.revoked_at,
    notes: row.notes,
    activation_count: Number(row.activation_count || 0),
    machine_binding: row.hardware_fingerprint ? {
      hardware_fingerprint: row.hardware_fingerprint,
      machine_name: row.machine_name,
      machine_os: row.machine_os,
      machine_host: row.machine_host,
      activated_at: row.activated_at,
      last_seen: row.last_seen,
    } : null,
  };
}

export async function listLicenses({ limit = 100, offset = 0, revoked } = {}) {
  const params = [];
  const where = [];

  if (typeof revoked === 'boolean') {
    params.push(revoked);
    where.push(`l.revoked = $${params.length}`);
  }

  params.push(limit, offset);
  const query = `
    SELECT
      l.*,
      COALESCE(ac.activation_count, 0) AS activation_count,
      latest.hardware_fingerprint,
      latest.machine_name,
      latest.machine_os,
      latest.machine_host,
      latest.activated_at,
      latest.last_seen
    FROM licenses l
    LEFT JOIN (
      SELECT license_key, COUNT(*) AS activation_count
      FROM activations
      GROUP BY license_key
    ) ac ON ac.license_key = l.license_key
    LEFT JOIN LATERAL (
      SELECT
        a.hardware_fingerprint,
        a.machine_name,
        a.machine_os,
        a.machine_host,
        a.activated_at,
        a.last_seen
      FROM activations a
      WHERE a.license_key = l.license_key
      ORDER BY a.last_seen DESC NULLS LAST, a.activated_at DESC
      LIMIT 1
    ) latest ON true
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY l.created_at DESC
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
  `;

  const countParams = typeof revoked === 'boolean' ? [revoked] : [];
  const countWhere = typeof revoked === 'boolean' ? 'WHERE revoked = $1' : '';

  const pool = getLicensePool();
  const [rows, count] = await Promise.all([
    pool.query(query, params),
    pool.query(`SELECT COUNT(*) AS total FROM licenses ${countWhere}`, countParams),
  ]);

  return {
    records: rows.rows.map(publicLicenseRow),
    pagination: {
      total: Number(count.rows[0]?.total || 0),
      limit,
      offset,
      has_more: offset + rows.rows.length < Number(count.rows[0]?.total || 0),
    },
  };
}

export async function createLicense({ tier = 1, expiry = 0, notes = '' } = {}) {
  assertValidTier(tier);
  assertValidExpiry(expiry);

  const licenseKey = generateLicenseKey(tier, expiry);
  const backupKey = generateLicenseKey(tier, expiry);
  const now = nowUnix();

  const pool = getLicensePool();
  const result = await pool.query(
    'INSERT INTO licenses (license_key, backup_key, tier, expiry, revoked, created_at, notes) VALUES ($1,$2,$3,$4,false,$5,$6) RETURNING *',
    [licenseKey, backupKey, tier, expiry, now, sanitizeText(notes, 1000)]
  );

  return publicLicenseRow({ ...result.rows[0], activation_count: 0 });
}

export async function revokeLicense({ license_key: licenseKey }) {
  const normalizedKey = normalizeLicenseKey(licenseKey);
  const now = nowUnix();

  const pool = getLicensePool();
  const result = await pool.query(
    'UPDATE licenses SET revoked=true, revoked_at=$1 WHERE license_key=$2 OR backup_key=$2 RETURNING *',
    [now, normalizedKey]
  );

  if (result.rowCount === 0) {
    const error = new Error('License not found');
    error.status = 404;
    throw error;
  }

  return publicLicenseRow({ ...result.rows[0], activation_count: undefined });
}

export async function listActivations({ license_key: licenseKey, limit = 100, offset = 0 } = {}) {
  const params = [];
  const where = [];

  if (licenseKey) {
    const normalizedKey = normalizeLicenseKey(licenseKey);
    params.push(normalizedKey);
    where.push('(a.license_key = $1 OR l.backup_key = $1)');
  }

  params.push(limit, offset);
  const query = `
    SELECT
      a.*,
      l.tier,
      l.backup_key,
      l.revoked,
      l.expiry
    FROM activations a
    JOIN licenses l ON l.license_key = a.license_key
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY a.activated_at DESC, a.last_seen DESC NULLS LAST
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
  `;

  const countParams = licenseKey ? [normalizeLicenseKey(licenseKey)] : [];
  const countWhere = licenseKey ? 'WHERE a.license_key = $1 OR l.backup_key = $1' : '';

  const pool = getLicensePool();
  const [rows, count] = await Promise.all([
    pool.query(query, params),
    pool.query(`SELECT COUNT(*) AS total FROM activations a JOIN licenses l ON l.license_key = a.license_key ${countWhere}`, countParams),
  ]);

  return {
    records: rows.rows.map((row) => ({
      id: row.id,
      license_key: row.license_key,
      tier: row.tier,
      tier_name: TIER_NAMES[row.tier] || 'Unknown',
      revoked: row.revoked,
      expiry: row.expiry,
      hardware_fingerprint: row.hardware_fingerprint,
      machine_name: row.machine_name,
      machine_os: row.machine_os,
      machine_host: row.machine_host,
      activated_at: row.activated_at,
      last_seen: row.last_seen,
    })),
    pagination: {
      total: Number(count.rows[0]?.total || 0),
      limit,
      offset,
      has_more: offset + rows.rows.length < Number(count.rows[0]?.total || 0),
    },
  };
}

export async function activateLicense({ license_key: licenseKey, hardware_fingerprint: hardwareFingerprint, machine_name, machine_os, machine_host }) {
  const normalizedKey = normalizeLicenseKey(licenseKey);
  if (!hardwareFingerprint || String(hardwareFingerprint).length > 256) {
    const error = new Error('Invalid hardware_fingerprint');
    error.status = 400;
    throw error;
  }

  const decoded = decodeLicenseKey(normalizedKey);
  const now = nowUnix();
  if (decoded.expiry !== 0 && decoded.expiry < now) {
    const error = new Error('License expired');
    error.status = 403;
    throw error;
  }

  const pool = getLicensePool();
  const client = await pool.connect();
  try {
    const licRow = await client.query('SELECT * FROM licenses WHERE license_key=$1 OR backup_key=$1', [normalizedKey]);
    if (licRow.rows.length === 0) {
      const error = new Error('License not found');
      error.status = 404;
      throw error;
    }

    const lic = licRow.rows[0];
    if (lic.revoked) {
      const error = new Error('License revoked');
      error.status = 403;
      throw error;
    }

    const actRows = await client.query('SELECT * FROM activations WHERE license_key=$1', [lic.license_key]);
    const existing = actRows.rows.find((row) => row.hardware_fingerprint === hardwareFingerprint);

    if (existing) {
      await client.query(
        'UPDATE activations SET last_seen=$1, machine_name=$2, machine_os=$3, machine_host=$4 WHERE id=$5',
        [now, sanitizeText(machine_name, 255), sanitizeText(machine_os, 255), sanitizeText(machine_host, 255), existing.id]
      );
      return { success: true, message: 'License validated', tier: lic.tier, tier_name: TIER_NAMES[lic.tier] };
    }

    if (actRows.rows.length >= MAX_ACTIVATIONS[lic.tier]) {
      const error = new Error('License already activated on another machine. Please contact support.');
      error.status = 403;
      throw error;
    }

    await client.query(
      'INSERT INTO activations (license_key, hardware_fingerprint, machine_name, machine_os, machine_host, activated_at, last_seen) VALUES ($1,$2,$3,$4,$5,$6,$6)',
      [lic.license_key, hardwareFingerprint, sanitizeText(machine_name, 255), sanitizeText(machine_os, 255), sanitizeText(machine_host, 255), now]
    );

    return { success: true, message: 'License activated', tier: lic.tier, tier_name: TIER_NAMES[lic.tier] };
  } finally {
    client.release();
  }
}

export async function validateLicense({ license_key: licenseKey, hardware_fingerprint: hardwareFingerprint }) {
  const normalizedKey = normalizeLicenseKey(licenseKey);
  const decoded = decodeLicenseKey(normalizedKey);
  const now = nowUnix();

  if (!hardwareFingerprint || String(hardwareFingerprint).length > 256) {
    const error = new Error('Invalid hardware_fingerprint');
    error.status = 400;
    throw error;
  }

  if (decoded.expiry !== 0 && decoded.expiry < now) {
    const error = new Error('License expired');
    error.status = 403;
    throw error;
  }

  const pool = getLicensePool();
  const client = await pool.connect();
  try {
    const licRow = await client.query('SELECT * FROM licenses WHERE license_key=$1 OR backup_key=$1', [normalizedKey]);
    if (licRow.rows.length === 0) {
      const error = new Error('Not found');
      error.status = 404;
      throw error;
    }

    const lic = licRow.rows[0];
    if (lic.revoked) {
      const error = new Error('Revoked');
      error.status = 403;
      throw error;
    }

    const actRow = await client.query('SELECT * FROM activations WHERE license_key=$1 AND hardware_fingerprint=$2', [lic.license_key, hardwareFingerprint]);
    if (actRow.rows.length === 0) {
      const error = new Error('Machine not authorized');
      error.status = 403;
      throw error;
    }

    await client.query('UPDATE activations SET last_seen=$1 WHERE id=$2', [now, actRow.rows[0].id]);
    return { success: true, authorized: true, tier: lic.tier, tier_name: TIER_NAMES[lic.tier] };
  } finally {
    client.release();
  }
}

export async function deactivateLicense({ license_key: licenseKey, hardware_fingerprint: hardwareFingerprint }) {
  const normalizedKey = normalizeLicenseKey(licenseKey);
  decodeLicenseKey(normalizedKey);

  if (!hardwareFingerprint || String(hardwareFingerprint).length > 256) {
    const error = new Error('Invalid hardware_fingerprint');
    error.status = 400;
    throw error;
  }

  const pool = getLicensePool();
  const client = await pool.connect();
  try {
    const licRow = await client.query('SELECT license_key FROM licenses WHERE license_key=$1 OR backup_key=$1', [normalizedKey]);
    if (licRow.rows.length === 0) {
      const error = new Error('Not found');
      error.status = 404;
      throw error;
    }

    const result = await client.query('DELETE FROM activations WHERE license_key=$1 AND hardware_fingerprint=$2', [licRow.rows[0].license_key, hardwareFingerprint]);
    if (result.rowCount === 0) {
      const error = new Error('Activation not found');
      error.status = 404;
      throw error;
    }

    return { success: true, message: 'Deactivated successfully' };
  } finally {
    client.release();
  }
}
