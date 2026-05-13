import { Router } from 'express';
import { pool } from '@/config/database';
import { authMiddleware } from '@/middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ==========================================
// PHARMACIES
// ==========================================

router.get('/', async (req, res) => {
  try {
    const { governorate, search, skip = 0, limit = 20 } = req.query;

    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM pharmacies WHERE 1=1';
      const params: any[] = [];

      if (governorate) {
        query += ' AND governorate = ?';
        params.push(governorate);
      }

      if (search) {
        query += ' AND pharmacy_name LIKE ?';
        params.push(`%${search}%`);
      }

      query += ' ORDER BY updated_at DESC LIMIT ?, ?';
      params.push(parseInt(skip as string) || 0, parseInt(limit as string) || 20);

      const [pharmacies] = await connection.execute(query, params);
      res.json(pharmacies);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get pharmacies error:', error);
    res.status(500).json({ error: 'Failed to fetch pharmacies' });
  }
});

router.get('/:pharmacyId', async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    const connection = await pool.getConnection();
    try {
      const [pharmacies] = await connection.execute('SELECT * FROM pharmacies WHERE id = ?', [pharmacyId]);
      const pharmacy = (pharmacies as any[])[0];

      if (!pharmacy) {
        res.status(404).json({ error: 'Pharmacy not found' });
        return;
      }

      // Get pharmacy products
      const [products] = await connection.execute(
        'SELECT * FROM pharmacy_products WHERE pharmacy_id = ? ORDER BY name',
        [pharmacyId]
      );

      res.json({ ...pharmacy, products });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get pharmacy error:', error);
    res.status(500).json({ error: 'Failed to fetch pharmacy' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { pharmacyName, governorate, addressDetail, phonePublic, location, deliveryEnabled, deliveryRadius } = req.body;
    const ownerId = req.user!.userId;
    const pharmacyId = uuidv4();

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO pharmacies (id, owner_uid, pharmacy_name, governorate, address_detail, phone_public, location, delivery_enabled, delivery_radius, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          pharmacyId,
          ownerId,
          pharmacyName,
          governorate ?? null,
          addressDetail ?? null,
          phonePublic ?? null,
          JSON.stringify(location ?? {}),
          deliveryEnabled !== false ? 1 : 0,
          deliveryRadius ?? 10,
        ],
      );
      res.status(201).json({ id: pharmacyId });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create pharmacy error:', error);
    res.status(500).json({ error: 'Failed to create pharmacy' });
  }
});

router.put('/:pharmacyId', authMiddleware, async (req, res) => {
  try {
    const { pharmacyId } = req.params;
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
      vals.push(pharmacyId);
      const query = `UPDATE pharmacies SET ${sets.join(', ')} WHERE id = ?`;
      await connection.execute(query, vals as any);

      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update pharmacy error:', error);
    res.status(500).json({ error: 'Failed to update pharmacy' });
  }
});

// ==========================================
// PHARMACY PRODUCTS
// ==========================================

router.get('/:pharmacyId/products', async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    const connection = await pool.getConnection();
    try {
      const [products] = await connection.execute(
        'SELECT * FROM pharmacy_products WHERE pharmacy_id = ? ORDER BY name',
        [pharmacyId]
      );
      res.json(products);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get pharmacy products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.post('/:pharmacyId/products', authMiddleware, async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { name, tradeName, genericName, category, description, imageUrl, unit, price, quantity, available } = req.body;
    const productId = uuidv4();

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO pharmacy_products (id, pharmacy_id, name, trade_name, generic_name, category, description, image_url, unit, price, quantity, available, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [productId, pharmacyId, name, tradeName, genericName, category, description, imageUrl, unit, price, quantity, available !== false]
      );
      res.status(201).json({ id: productId });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create pharmacy product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// ==========================================
// PHARMACY ORDERS
// ==========================================

router.get('/:pharmacyId/orders', authMiddleware, async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    const connection = await pool.getConnection();
    try {
      const [orders] = await connection.execute(
        'SELECT * FROM pharmacy_orders WHERE pharmacy_id = ? ORDER BY created_at DESC LIMIT 50',
        [pharmacyId]
      );
      res.json(orders);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get pharmacy orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.patch('/:pharmacyId/orders/:orderId/status', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `UPDATE pharmacy_orders SET status = ? WHERE id = ?`,
        [status, orderId]
      );
      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update pharmacy order status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ==========================================
// PRESCRIPTION REQUESTS
// ==========================================

router.post('/prescription-requests', authMiddleware, async (req, res) => {
  try {
    const { patientId, patientName, patientPhone, pharmacyId, imageUrl, deliveryType, notes } = req.body;
    const requestId = uuidv4();

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO prescription_requests (id, patient_id, patient_name, patient_phone, pharmacy_id, image_url, status, delivery_type, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW(3), NOW(3))`,
        [requestId, patientId, patientName, patientPhone, pharmacyId, imageUrl, deliveryType, notes]
      );
      res.status(201).json({ id: requestId });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create prescription request error:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

router.get('/prescription-requests', authMiddleware, async (req, res) => {
  try {
    const { pharmacyId, patientId } = req.query;

    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM prescription_requests WHERE 1=1';
      const params: any[] = [];

      if (pharmacyId) {
        query += ' AND pharmacy_id = ?';
        params.push(pharmacyId);
      }
      if (patientId) {
        query += ' AND patient_id = ?';
        params.push(patientId);
      }

      query += ' ORDER BY created_at DESC LIMIT 50';

      const [requests] = await connection.execute(query, params);
      res.json(requests);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get prescription requests error:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

router.patch('/prescription-requests/:requestId', authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, items, totalPrice, rejectionReason } = req.body;

    const connection = await pool.getConnection();
    try {
      const updates: string[] = ['updated_at = NOW(3)'];
      const values: any[] = [];

      if (status) {
        updates.push('status = ?');
        values.push(status);
      }
      if (items) {
        updates.push('items = ?');
        values.push(JSON.stringify(items));
      }
      if (totalPrice !== undefined) {
        updates.push('total_price = ?');
        values.push(totalPrice);
      }
      if (rejectionReason) {
        updates.push('rejection_reason = ?');
        values.push(rejectionReason);
      }

      values.push(requestId);
      const query = `UPDATE prescription_requests SET ${updates.join(', ')} WHERE id = ?`;
      await connection.execute(query, values);
      
      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update prescription request error:', error);
    res.status(500).json({ error: 'Failed to update request' });
  }
});

export default router;
