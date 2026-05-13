import { Router } from 'express';
import { pool } from '@/config/database';
import { authMiddleware } from '@/middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ==========================================
// NURSES
// ==========================================

router.get('/', async (req, res) => {
  try {
    const { governorate, search, skip = 0, limit = 20 } = req.query;

    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM nurses WHERE 1=1';
      const params: any[] = [];

      if (governorate) {
        query += ' AND governorate = ?';
        params.push(governorate);
      }

      if (search) {
        query += ' AND (specialty LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm);
      }

      query += ' ORDER BY updated_at DESC LIMIT ?, ?';
      params.push(parseInt(skip as string) || 0, parseInt(limit as string) || 20);

      const [nurses] = await connection.execute(query, params);
      res.json(nurses);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get nurses error:', error);
    res.status(500).json({ error: 'Failed to fetch nurses' });
  }
});

router.get('/:nurseId', async (req, res) => {
  try {
    const { nurseId } = req.params;

    const connection = await pool.getConnection();
    try {
      const [nurses] = await connection.execute('SELECT * FROM nurses WHERE id = ?', [nurseId]);
      const nurse = (nurses as any[])[0];

      if (!nurse) {
        res.status(404).json({ error: 'Nurse not found' });
        return;
      }

      res.json(nurse);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get nurse error:', error);
    res.status(500).json({ error: 'Failed to fetch nurse' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { specialty, governorate, addressDetail, phonePublic, services, workDays, openTime, closeTime, homeService, location, coverageRadius } = req.body;
    const ownerId = req.user!.userId;
    const nurseId = uuidv4();

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO nurses (id, owner_uid, specialty, governorate, address_detail, phone_public, services, work_days, open_time, close_time, home_service, location, coverage_radius, available, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(3))`,
        [
          nurseId,
          ownerId,
          specialty ?? null,
          governorate ?? null,
          addressDetail ?? null,
          phonePublic ?? null,
          JSON.stringify(services ?? {}),
          JSON.stringify(workDays ?? []),
          openTime ?? null,
          closeTime ?? null,
          homeService !== false ? 1 : 0,
          JSON.stringify(location ?? {}),
          coverageRadius ?? 10,
        ],
      );
      res.status(201).json({ id: nurseId });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create nurse error:', error);
    res.status(500).json({ error: 'Failed to create nurse' });
  }
});

router.put('/:nurseId', authMiddleware, async (req, res) => {
  try {
    const { nurseId } = req.params;
    const updates = req.body;

    const connection = await pool.getConnection();
    try {
      if (updates.location) {
        updates.location = JSON.stringify(updates.location);
      }
      if (updates.services) {
        updates.services = JSON.stringify(updates.services);
      }
      if (updates.workDays) {
        updates.workDays = JSON.stringify(updates.workDays);
      }

      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const [key, raw] of Object.entries(updates)) {
        sets.push(`${key} = ?`);
        vals.push(raw);
      }
      sets.push('updated_at = NOW(3)');
      vals.push(nurseId);
      const query = `UPDATE nurses SET ${sets.join(', ')} WHERE id = ?`;
      await connection.execute(query, vals as any);

      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update nurse error:', error);
    res.status(500).json({ error: 'Failed to update nurse' });
  }
});

// ==========================================
// NURSE ORDERS
// ==========================================

router.get('/:nurseId/orders', authMiddleware, async (req, res) => {
  try {
    const { nurseId } = req.params;
    const { status } = req.query;

    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM nurse_orders WHERE nurse_id = ?';
      const params: any[] = [nurseId];

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
    console.error('Get nurse orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.post('/:nurseId/orders', authMiddleware, async (req, res) => {
  try {
    const { nurseId } = req.params;
    const { patientId, patientName, nurseName, service, address, scheduledTime, price } = req.body;
    const orderId = uuidv4();
    const payload = JSON.stringify({
      service: service ?? null,
      address: address ?? null,
      scheduledTime: scheduledTime ?? null,
      price: price ?? 0,
    });

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO nurse_orders (id, nurse_id, patient_id, patient_name, nurse_name, status, payload, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, NOW(3), NOW(3))`,
        [orderId, nurseId, patientId, patientName ?? null, nurseName ?? null, payload],
      );
      res.status(201).json({ id: orderId });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create nurse order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

router.patch('/:nurseId/orders/:orderId/status', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `UPDATE nurse_orders SET status = ?, updated_at = NOW(3) WHERE id = ?`,
        [status, orderId]
      );
      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update nurse order status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

export default router;
