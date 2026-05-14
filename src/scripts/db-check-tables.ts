import { pool } from '../config/database';

async function checkDb() {
  try {
    const conn = await pool.getConnection();
    console.log('✓ Connected to database');
    
    const [tables] = await conn.execute(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME'
    );
    console.log('Tables:', JSON.stringify((tables as any[]).map(r => r.TABLE_NAME)));
    
    const [users] = await conn.execute('SELECT COUNT(*) as c FROM users');
    console.log('Users count:', (users as any[])[0]?.c);
    
    const [clinics] = await conn.execute('SELECT COUNT(*) as c FROM clinics');
    console.log('Clinics count:', (clinics as any[])[0]?.c);
    
    conn.release();
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit(0);
}

checkDb();