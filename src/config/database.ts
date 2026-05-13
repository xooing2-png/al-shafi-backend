import fs from 'node:fs';
import path from 'node:path';

import mysql, { type PoolConnection, type PoolOptions } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

function readEnvPassword(): string {
  return process.env.DB_PASSWORD?.trim() || process.env.DB_PASS?.trim() || '';
}

function isLocalHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

function buildSslConfig(host: string): PoolOptions['ssl'] {
  const mode = (process.env.DB_SSL || process.env.DB_SSL_MODE || '').trim().toUpperCase();
  const explicitOff = mode === 'DISABLED' || mode === 'FALSE' || mode === '0' || mode === 'OFF';
  if (explicitOff) return undefined;

  const explicitOn =
    mode === 'REQUIRED' ||
    mode === 'PREFERRED' ||
    mode === 'TRUE' ||
    mode === '1' ||
    mode === 'ON';
  const remoteHost = !isLocalHost(host);
  if (!explicitOn && !remoteHost) return undefined;

  const caPath = process.env.DB_SSL_CA_PATH?.trim();
  const caInline = process.env.DB_SSL_CA?.trim();
  if (caPath) {
    const resolved = path.isAbsolute(caPath) ? caPath : path.resolve(process.cwd(), caPath);
    return {
      ca: fs.readFileSync(resolved, 'utf8'),
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    };
  }
  if (caInline) {
    return {
      ca: caInline.replace(/\\n/g, '\n'),
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    };
  }

  const skipVerify =
    process.env.DB_SSL_SKIP_VERIFY === 'true' ||
    process.env.DB_SSL_INSECURE === 'true';
  if (skipVerify) {
    return { rejectUnauthorized: false, minVersion: 'TLSv1.2' };
  }
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '⚠ MySQL SSL: لم يُعثر على DB_SSL_CA_PATH — الاتصال يعمل بدون التحقق من شهادة CA (مناسب للتطوير فقط).',
    );
    return { rejectUnauthorized: false, minVersion: 'TLSv1.2' };
  }

  throw new Error(
    'MySQL SSL مطلوب: عيّن DB_SSL_CA_PATH أو DB_SSL_CA، أو DB_SSL_SKIP_VERIFY=true للتطوير.',
  );
}

function buildDatabaseConfig(): PoolOptions {
  const host = process.env.DB_HOST?.trim() || 'localhost';
  const ssl = buildSslConfig(host);
  const config: PoolOptions = {
    host,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: readEnvPassword(),
    database: process.env.DB_NAME || 'alshafi',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_SIZE || '10', 10),
    queueLimit: 0,
    multipleStatements: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT_MS || '60000', 10),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  };
  if (ssl) config.ssl = ssl;
  return config;
}

const databaseConfig = buildDatabaseConfig();

export const pool = mysql.createPool(databaseConfig);

pool.on('connection', () => {
  if (process.env.DB_DEBUG === 'true') {
    console.log('✓ MySQL pool connection opened');
  }
});

export const migrationDatabaseConfig: PoolOptions = {
  ...databaseConfig,
  multipleStatements: true,
};

async function usersHasColumn(connection: PoolConnection, columnName: string): Promise<boolean> {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?`,
    [columnName],
  );
  return Number((rows as { c: number | bigint }[])[0]?.c ?? 0) > 0;
}

async function usersTableExists(connection: PoolConnection): Promise<boolean> {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`,
  );
  return Number((rows as { c: number | bigint }[])[0]?.c ?? 0) > 0;
}

/**
 * يضيف أعمدة جدول users الناقصة مقارنةً بمخطط Node (قواعد قديمة / XAMPP بدون password_hash).
 */
export async function ensureUsersColumnsForNode(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    if (!(await usersTableExists(connection))) {
      console.warn('⚠ Schema: جدول users غير موجود — شغّل npm run migrate من مجلد backend.');
      return;
    }

    const patches: Array<{ col: string; ddl: string }> = [
      {
        col: 'password_hash',
        ddl: `ADD COLUMN password_hash VARCHAR(255) NULL COMMENT 'bcrypt for mobile/Node auth'`,
      },
      {
        col: 'contact_email',
        ddl: `ADD COLUMN contact_email VARCHAR(255) NULL COMMENT 'Real email from registration form'`,
      },
      {
        col: 'updated_at',
        ddl: `ADD COLUMN updated_at DATETIME(3) NULL`,
      },
    ];

    for (const { col, ddl } of patches) {
      try {
        if (await usersHasColumn(connection, col)) continue;
        await connection.execute(`ALTER TABLE users ${ddl}`);
        console.log(`✓ Schema: added users.${col}`);
      } catch (e) {
        const err = e as { errno?: number };
        if (err.errno === 1060) continue;
        console.error(`✗ Schema patch users.${col}:`, e);
      }
    }
  } finally {
    connection.release();
  }
}

export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    console.log(
      `✓ Database connection successful (${databaseConfig.host}:${databaseConfig.port}/${databaseConfig.database})`,
    );
    connection.release();
    await ensureUsersColumnsForNode();
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    return false;
  }
}
