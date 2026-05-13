import { Router } from 'express';
import { pool } from '@/config/database';
import { authMiddleware } from '@/middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ==========================================
// LABS
// ==========================================

router.get('/', async (req, res) => {
  try {
    const { governorate, search, skip = 0, limit = 20 } = req.query;

    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM labs WHERE 1=1';
      const params: any[] = [];

      if (governorate) {
        query += ' AND governorate = ?';
        params.push(governorate);
      }

      if (search) {
        query += ' AND (name LIKE ? OR lab_name LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
      }

      query += ' ORDER BY updated_at DESC LIMIT ?, ?';
      params.push(parseInt(skip as string) || 0, parseInt(limit as string) || 20);

      const [labs] = await connection.execute(query, params);
      res.json(labs);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get labs error:', error);
    res.status(500).json({ error: 'Failed to fetch labs' });
  }
});

router.get('/:labId', async (req, res) => {
  try {
    const { labId } = req.params;

    const connection = await pool.getConnection();
    try {
      const [labs] = await connection.execute('SELECT * FROM labs WHERE id = ?', [labId]);
      const lab = (labs as any[])[0];

      if (!lab) {
        res.status(404).json({ error: 'Lab not found' });
        return;
      }

      // Get lab tests
      const [tests] = await connection.execute(
        'SELECT * FROM lab_tests WHERE lab_id = ? ORDER BY name',
        [labId]
      );

      res.json({ ...lab, tests });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get lab error:', error);
    res.status(500).json({ error: 'Failed to fetch lab' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { labName, name, labType, licenseNumber, governorate, addressDetail, phonePublic, location } = req.body;
    const ownerId = req.user!.userId;
    const labId = uuidv4();

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO labs (id, owner_uid, lab_name, name, lab_type, license_number, governorate, address_detail, phone_public, location, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          labId,
          ownerId,
          labName,
          name ?? labName,
          labType ?? null,
          licenseNumber ?? null,
          governorate ?? null,
          addressDetail ?? null,
          phonePublic ?? null,
          JSON.stringify(location ?? {}),
        ],
      );
      res.status(201).json({ id: labId });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create lab error:', error);
    res.status(500).json({ error: 'Failed to create lab' });
  }
});

router.put('/:labId', authMiddleware, async (req, res) => {
  try {
    const { labId } = req.params;
    const updates = req.body;

    const connection = await pool.getConnection();
    try {
      if (updates.location) {
        updates.location = JSON.stringify(updates.location);
      }

      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const [key, raw] of Object.entries(updates)) {
        sets.push(`${key} = ?`);
        vals.push(raw);
      }
      sets.push('updated_at = NOW(3)');
      vals.push(labId);
      const query = `UPDATE labs SET ${sets.join(', ')} WHERE id = ?`;
      await connection.execute(query, vals as any);

      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update lab error:', error);
    res.status(500).json({ error: 'Failed to update lab' });
  }
});

// ==========================================
// LAB TESTS
// ==========================================

router.post('/:labId/tests', authMiddleware, async (req, res) => {
  try {
    const { labId } = req.params;
    const { name, price, duration, available, category } = req.body;
    const testId = uuidv4();

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO lab_tests (id, lab_id, name, price, duration, available, category, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [testId, labId, name, price, String(duration ?? '60 د'), available !== false, String(category ?? 'عام')]
      );
      res.status(201).json({ id: testId });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create lab test error:', error);
    res.status(500).json({ error: 'Failed to create test' });
  }
});

// ==========================================
// LAB ORDERS
// ==========================================

router.get('/:labId/orders', authMiddleware, async (req, res) => {
  try {
    const { labId } = req.params;
    const { date, status } = req.query;

    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM lab_orders WHERE lab_id = ?';
      const params: any[] = [labId];

      if (date) {
        query += ' AND date = ?';
        params.push(date);
      }
      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      query += ' ORDER BY created_at DESC LIMIT 50';

      const [orders] = await connection.execute(query, params);
      res.json(orders);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get lab orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.post('/:labId/orders', authMiddleware, async (req, res) => {
  try {
    const { labId } = req.params;
    const { patientId, patientName, doctorId, doctorName, tests, notes, date } = req.body;
    const orderId = uuidv4();

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO lab_orders (id, lab_id, patient_id, patient_name, doctor_id, doctor_name, tests, notes, status, sent_to_doctor, sent_to_patient, date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, ?, NOW(3))`,
        [
          orderId,
          labId,
          patientId,
          patientName,
          doctorId ?? null,
          doctorName ?? null,
          JSON.stringify(tests ?? []),
          notes ?? null,
          date ?? null,
        ],
      );
      res.status(201).json({ id: orderId });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create lab order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

router.patch('/:labId/orders/:orderId/status', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, resultUrl } = req.body;

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `UPDATE lab_orders SET status = ?, result_url = ? WHERE id = ?`,
        [status, resultUrl, orderId]
      );
      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

export default router;
