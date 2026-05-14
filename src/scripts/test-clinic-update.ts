import { pool } from '../config/database';

async function test() {
  const conn = await pool.getConnection();
  try {
    // Get a real user ID
    const [users] = await conn.execute('SELECT id, name FROM users LIMIT 1');
    const userRows = users as any[];
    
    if (userRows.length === 0) {
      console.log('No users found - need to create user first');
      return;
    }
    
    const ownerUid = userRows[0].id;
    console.log('Using owner:', ownerUid);
    
    // Create a test clinic
    const testClinicId = 'test-clinic-' + Date.now();
    
    await conn.execute(
      `INSERT INTO clinics (id, owner_uid, clinic_name, specialty, location, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(3))`,
      [testClinicId, ownerUid, 'عيادة اختبار', 'باطنية', JSON.stringify({})]
    );
    console.log('✓ Clinic created');
    
    // Update with new specialty
    await conn.execute(
      `UPDATE clinics SET specialty = ?, updated_at = NOW(3) WHERE id = ?`,
      ['قلب', testClinicId]
    );
    console.log('✓ Clinic updated with specialty=قلب');
    
    // Verify
    const [verify] = await conn.execute('SELECT * FROM clinics WHERE id = ?', [testClinicId]);
    const verifyRows = verify as any[];
    console.log('Final specialty:', verifyRows[0]?.specialty);
    console.log('Full record:', JSON.stringify(verifyRows[0], null, 2));
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    conn.release();
    process.exit(0);
  }
}

test();