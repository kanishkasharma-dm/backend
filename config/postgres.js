import fs from 'fs';
import { Pool } from 'pg';

let pool;

const REQUIRED_POSTGRES_VARS = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} env var is required for license database access`);
  }
  return value;
}

function buildSslConfig() {
  const caPath = process.env.DB_SSL_CA_PATH;
  const caInline = process.env.DB_SSL_CA;

  if (caInline) {
    return {
      rejectUnauthorized: true,
      ca: caInline.replace(/\\n/g, '\n'),
    };
  }

  if (caPath) {
    return {
      rejectUnauthorized: true,
      ca: fs.readFileSync(caPath, 'utf8'),
    };
  }

  if (process.env.DB_SSL === 'true') {
    return { rejectUnauthorized: true };
  }

  return undefined;
}

export function getLicensePool() {
  if (pool) return pool;

  for (const name of REQUIRED_POSTGRES_VARS) {
    requireEnv(name);
  }

  pool = new Pool({
    host: requireEnv('DB_HOST'),
    port: Number.parseInt(process.env.DB_PORT || '5432', 10),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    ssl: buildSslConfig(),
    max: Number.parseInt(process.env.DB_POOL_MAX || '5', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (error) => {
    console.error(JSON.stringify({
      event: 'license_postgres_pool_error',
      message: error.message,
      timestamp: new Date().toISOString(),
    }));
  });

  return pool;
}
