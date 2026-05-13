import { Router } from 'express';
import { pool } from '@/config/database';
import { authMiddleware } from '@/middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ==========================================
// PRESCRIPTIONS
// ==========================================

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { doctorId, patientId, patientName, doctorName, clinicName, medicines, notes, pharmacyId, prescriptionImageUrl } = req.body;
    const prescriptionId = uuidv4();

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO prescriptions (id, doctor_id, patient_id, patient_name, doctor_name, clinic_name, medicines, notes, sent_to_patient, sent_to_pharmacy, pharmacy_id, prescription_image_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          prescriptionId,
          doctorId,
          patientId,
          patientName,
          doctorName,
          clinicName,
          JSON.stringify(medicines ?? []),
          notes ?? '',
          0,
          pharmacyId ? 1 : 0,
          pharmacyId ?? null,
          prescriptionImageUrl ?? null,
        ],
      );
      res.status(201).json({ id: prescriptionId });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create prescription error:', error);
    res.status(500).json({ error: 'Failed to create prescription' });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { patientId, doctorId, clinicId } = req.query;

    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM prescriptions WHERE 1=1';
      const params: any[] = [];

      if (patientId) {
        query += ' AND patient_id = ?';
        params.push(patientId);
      }
      if (doctorId) {
        query += ' AND doctor_id = ?';
        params.push(doctorId);
      }

      query += ' ORDER BY created_at DESC LIMIT 50';

      const [prescriptions] = await connection.execute(query, params);
      res.json(prescriptions);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get prescriptions error:', error);
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
});

router.get('/:prescriptionId', authMiddleware, async (req, res) => {
  try {
    const { prescriptionId } = req.params;

    const connection = await pool.getConnection();
    try {
      const [prescriptions] = await connection.execute(
        'SELECT * FROM prescriptions WHERE id = ?',
        [prescriptionId]
      );
      const prescription = (prescriptions as any[])[0];

      if (!prescription) {
        res.status(404).json({ error: 'Prescription not found' });
        return;
      }

      res.json(prescription);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get prescription error:', error);
    res.status(500).json({ error: 'Failed to fetch prescription' });
  }
});

router.patch('/:prescriptionId/send', authMiddleware, async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { to } = req.body; // 'patient' or 'pharmacy'

    const connection = await pool.getConnection();
    try {
      if (to === 'patient') {
        await connection.execute(
          `UPDATE prescriptions SET sent_to_patient = 1 WHERE id = ?`,
          [prescriptionId]
        );
      } else if (to === 'pharmacy') {
        await connection.execute(
          `UPDATE prescriptions SET sent_to_pharmacy = 1 WHERE id = ?`,
          [prescriptionId]
        );
      }
      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Send prescription error:', error);
    res.status(500).json({ error: 'Failed to send prescription' });
  }
});

// ==========================================
// BOOKINGS
// ==========================================

router.get('/bookings', authMiddleware, async (req, res) => {
  try {
    const { patientId, type, status } = req.query;

    const connection = await pool.getConnection();
    try {
      let query = 'SELECT * FROM bookings WHERE 1=1';
      const params: any[] = [];

      if (patientId) {
        query += ' AND patient_id = ?';
        params.push(patientId);
      }
      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }
      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      query += ' ORDER BY created_at DESC LIMIT 50';

      const [bookings] = await connection.execute(query, params);
      res.json(bookings);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

router.post('/bookings', authMiddleware, async (req, res) => {
  try {
    const { patientId, patientName, patientPhone, type, labId, labName, testId, testName, visitDate, timeSlot, hospitalId, hospitalName, department, amount } = req.body;
    const bookingId = uuidv4();

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO bookings (id, patient_id, patient_name, patient_phone, type, status, lab_id, lab_name, test_id, test_name, visit_date, time_slot, hospital_id, hospital_name, department, amount, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [bookingId, patientId, patientName, patientPhone, type, labId, labName, testId, testName, visitDate, timeSlot, hospitalId, hospitalName, department, amount || 0]
      );
      res.status(201).json({ id: bookingId });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

router.patch('/bookings/:bookingId/status', authMiddleware, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `UPDATE bookings SET status = ? WHERE id = ?`,
        [status, bookingId]
      );
      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.post('/bookings/:bookingId/rate', authMiddleware, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { rating, comment } = req.body;

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `UPDATE bookings SET rating = ?, comment = ?, rated = 1, rated_at = NOW(3) WHERE id = ?`,
        [rating, comment, bookingId]
      );
      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Rate booking error:', error);
    res.status(500).json({ error: 'Failed to rate booking' });
  }
});

export default router;
