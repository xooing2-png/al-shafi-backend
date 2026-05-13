import { pool } from '@/config/database';

async function main() {
  const connection = await pool.getConnection();
  try {
    const [dbRows] = await connection.query('SELECT DATABASE() AS db');
    const db = (dbRows as { db: string | null }[])[0]?.db ?? '(unknown)';

    const [tableRows] = await connection.query(
      `SELECT COUNT(*) AS c FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`,
    );
    const tables = Number((tableRows as { c: number | bigint }[])[0]?.c ?? 0);

    const [userRows] = await connection.query('SELECT COUNT(*) AS c FROM users');
    const users = Number((userRows as { c: number | bigint }[])[0]?.c ?? 0);

    console.log(`✓ MySQL: ${db} — ${tables} tables, ${users} users`);
  } finally {
    connection.release();
    await pool.end();
  }
}

void main().catch((error) => {
  console.error('✗ Database status failed:', error);
  process.exit(1);
});
