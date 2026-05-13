import { Router } from 'express';
import { pool } from '@/config/database';
import { authMiddleware } from '@/middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

function shapeHospitalRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    name: row.hospital_name ?? row.name,
    hospitalName: row.hospital_name,
    owner_id: row.owner_uid,
  };
}

router.get('/', async (req, res) => {
  try {
    const { governorate, search, skip = 0, limit = 20 } = req.query;
    const connection = await pool.getConnection();
    try {
      let q = 'SELECT * FROM hospitals WHERE 1=1';
      const params: unknown[] = [];
      if (governorate) {
        q += ' AND governorate = ?';
        params.push(governorate);
      }
      if (search) {
        q += ' AND (hospital_name LIKE ? OR address_detail LIKE ?)';
        const t = `%${search}%`;
        params.push(t, t);
      }
      q += ' ORDER BY updated_at DESC LIMIT ?, ?';
      params.push(parseInt(skip as string, 10) || 0, parseInt(limit as string, 10) || 20);
      const [rows] = await connection.execute(q, params as any);
      res.json((rows as Record<string, unknown>[]).map(shapeHospitalRow));
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get hospitals error:', error);
    res.status(500).json({ error: 'Failed to fetch hospitals' });
  }
});

router.get('/:hospitalId', async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM hospitals WHERE id = ?', [hospitalId]);
      const row = (rows as Record<string, unknown>[])[0];
      if (!row) {
        res.status(404).json({ error: 'Hospital not found' });
        return;
      }
      res.json(shapeHospitalRow(row));
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get hospital error:', error);
    res.status(500).json({ error: 'Failed to fetch hospital' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const ownerId = req.user!.userId;
    const {
      hospitalName,
      governorate,
      addressDetail,
      phonePublic,
      location,
    } = req.body as Record<string, unknown>;
    const id = uuidv4();
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO hospitals (id, owner_uid, hospital_name, governorate, address_detail, phone_public, location, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          ownerId,
          hospitalName ?? null,
          governorate ?? null,
          addressDetail ?? null,
          phonePublic ?? null,
          JSON.stringify(location ?? {}),
        ] as any,
      );
      res.status(201).json({ id });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create hospital error:', error);
    res.status(500).json({ error: 'Failed to create hospital' });
  }
});

router.put('/:hospitalId', authMiddleware, async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const updates = req.body as Record<string, unknown>;
    const connection = await pool.getConnection();
    try {
      const [own] = await connection.execute('SELECT owner_uid FROM hospitals WHERE id = ?', [
        hospitalId,
      ]);
      const o = (own as { owner_uid: string }[])[0];
      if (!o || o.owner_uid !== req.user!.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      if (updates.location) {
        updates.location = JSON.stringify(updates.location);
      }
      const sets: string[] = [];
      const vals: unknown[] = [];
      const map: Record<string, string> = {
        hospitalName: 'hospital_name',
        governorate: 'governorate',
        addressDetail: 'address_detail',
        phonePublic: 'phone_public',
        location: 'location',
      };
      for (const [k, col] of Object.entries(map)) {
        if (k in updates) {
          sets.push(`${col} = ?`);
          vals.push(updates[k]);
        }
      }
      if (sets.length === 0) {
        res.status(400).json({ error: 'No fields' });
        return;
      }
      sets.push('updated_at = NOW(3)');
      vals.push(hospitalId);
      await connection.execute(
        `UPDATE hospitals SET ${sets.join(', ')} WHERE id = ?`,
        vals as any,
      );
      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update hospital error:', error);
    res.status(500).json({ error: 'Failed to update hospital' });
  }
});

export default router;
