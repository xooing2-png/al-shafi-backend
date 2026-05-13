import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '@/config/database';

/** صف clinic_appointments → شكل متوقَّع جزئياً من الواجهة (camelCase) */
export function mapClinicAppointmentRow(row: Record<string, unknown>): Record<string, unknown> {
  const vd = row.visit_date;
  const visitDate =
    vd instanceof Date ? vd.toISOString().slice(0, 10) : vd != null ? String(vd).slice(0, 10) : '';
  return {
    id: row.id,
    clinicId: row.clinic_id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientPhone: row.patient_phone,
    time: row.time,
    visitDate,
    status: row.status,
    type: row.type,
    queueNumber: row.queue_number ?? undefined,
    age: row.age ?? undefined,
    visitReason: row.visit_reason ?? undefined,
    arrivedAt: row.arrived_at ?? undefined,
    rated: row.rated ?? undefined,
    rating: row.rating ?? undefined,
    comment: row.comment ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseVisitDate(raw: unknown): string {
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (typeof raw === 'string' && raw.includes('T')) return raw.slice(0, 10);
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeTime(raw: unknown, fallbackAppointmentTime?: unknown): string {
  if (typeof raw === 'string' && raw.trim()) {
    const s = raw.trim();
    if (/^\d{1,2}:\d{2}$/.test(s)) {
      const [h, m] = s.split(':');
      return `${String(h).padStart(2, '0')}:${m}:00`.slice(0, 8);
    }
    return s.slice(0, 8);
  }
  if (typeof fallbackAppointmentTime === 'string') {
    const iso = fallbackAppointmentTime.match(/T(\d{2}:\d{2})/);
    if (iso) return `${iso[1]}:00`.slice(0, 8);
    const hm = fallbackAppointmentTime.match(/(\d{1,2}:\d{2})/);
    if (hm) {
      const [a, b] = hm[1].split(':');
      return `${String(a).padStart(2, '0')}:${b}:00`.slice(0, 8);
    }
  }
  return '09:00:00';
}

export async function createAppointment(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const clinicId = String(body.clinicId ?? body.clinic_id ?? '');
    const patientId = String(body.patientId ?? body.patient_id ?? req.user.userId);
    const patientName = String(body.patientName ?? body.patient_name ?? '').trim() || 'مريض';
    const patientPhone = String(body.patientPhone ?? body.patient_phone ?? '').trim() || '';
    const visitDate = parseVisitDate(body.visitDate ?? body.visit_date);
    const time = normalizeTime(body.time, body.appointmentTime);
    const type = String(body.type ?? 'electronic');
    const status = String(body.status ?? 'waiting');
    const age = typeof body.age === 'number' ? body.age : body.age != null ? parseInt(String(body.age), 10) : null;
    const visitReason =
      typeof body.visitReason === 'string'
        ? body.visitReason
        : typeof body.notes === 'string'
          ? body.notes
          : null;
    const queueNumber =
      typeof body.queueNumber === 'number'
        ? body.queueNumber
        : body.queueNumber != null
          ? parseInt(String(body.queueNumber), 10)
          : null;

    if (!clinicId) {
      res.status(400).json({ error: 'clinicId is required' });
      return;
    }

    const connection = await pool.getConnection();

    try {
      const appointmentId = uuidv4();

      await connection.execute(
        `INSERT INTO clinic_appointments
         (id, clinic_id, patient_id, patient_name, patient_phone, time, status, type,
          visit_date, queue_number, age, visit_reason, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [
          appointmentId,
          clinicId,
          patientId,
          patientName,
          patientPhone,
          time.slice(0, 8),
          status,
          type,
          visitDate,
          Number.isFinite(queueNumber as number) ? queueNumber : null,
          Number.isFinite(age as number) ? age : null,
          visitReason,
        ],
      );

      const mapped = mapClinicAppointmentRow({
        id: appointmentId,
        clinic_id: clinicId,
        patient_id: patientId,
        patient_name: patientName,
        patient_phone: patientPhone,
        time,
        status,
        type,
        visit_date: visitDate,
        queue_number: queueNumber,
        age,
        visit_reason: visitReason,
        created_at: new Date(),
        updated_at: new Date(),
      });
      res.status(201).json(mapped);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
}

export async function getAppointments(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { status, clinicId, visitDate } = req.query;
    const userId = req.user.userId;
    const role = req.user.role;

    const connection = await pool.getConnection();

    try {
      let sql = `SELECT * FROM clinic_appointments WHERE 1=1`;
      const params: unknown[] = [];

      if (role === 'patient') {
        sql += ` AND patient_id = ?`;
        params.push(userId);
      } else if ((role === 'clinic' || role === 'doctor' || role === 'secretary') && clinicId) {
        sql += ` AND clinic_id = ?`;
        params.push(clinicId as string);
      } else if (clinicId) {
        sql += ` AND clinic_id = ?`;
        params.push(clinicId as string);
      }

      if (status) {
        sql += ` AND status = ?`;
        params.push(status as string);
      }
      if (visitDate && typeof visitDate === 'string') {
        sql += ` AND visit_date = ?`;
        params.push(visitDate.slice(0, 10));
      }

      sql += ` ORDER BY visit_date DESC, time DESC LIMIT 500`;

      const [rows] = await connection.execute(sql, params as any);

      const list = (rows as Record<string, unknown>[]).map((r) => mapClinicAppointmentRow(r));

      res.json(list);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
}

export async function updateAppointmentStatus(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { appointmentId } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }

    const connection = await pool.getConnection();

    try {
      await connection.execute(
        `UPDATE clinic_appointments SET status = ?, updated_at = NOW(3) WHERE id = ?`,
        [status, appointmentId],
      );

      const [again] = await connection.execute(`SELECT * FROM clinic_appointments WHERE id = ?`, [
        appointmentId,
      ]);
      const row = (again as Record<string, unknown>[])[0];
      res.json(row ? mapClinicAppointmentRow(row) : { message: 'Appointment updated successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
}

export async function cancelAppointment(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { appointmentId } = req.params;

    const connection = await pool.getConnection();

    try {
      await connection.execute(
        `UPDATE clinic_appointments SET status = 'cancelled', updated_at = NOW(3) WHERE id = ?`,
        [appointmentId],
      );

      res.json({ message: 'Appointment cancelled successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
}
