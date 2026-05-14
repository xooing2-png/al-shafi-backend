import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '@/config/database';

/** يصدّر صف عيادة بأسماء قريبة مما تتوقعه الواجهة (name / owner_id) */
function shapeClinicRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    name: row.clinic_name ?? row.name,
    owner_id: row.owner_uid ?? row.owner_id,
  };
}

export async function createClinic(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const name = String(body.name ?? '').trim();
    const specialty = String(body.specialty ?? 'عام').trim();
    const phone = body.phone != null ? String(body.phone) : '';
    const address = body.address != null ? String(body.address) : null;
    const governorate = body.governorate != null ? String(body.governorate) : null;
    const city = body.city != null ? String(body.city) : '';
    const description = body.description != null ? String(body.description) : '';
    const lat = body.latitude;
    const lng = body.longitude;

    if (!name) {
      res.status(400).json({ error: 'Clinic name is required' });
      return;
    }

    const ownerUid = req.user.userId;
    const clinicId = uuidv4();

    const location: Record<string, unknown> = {};
    if (typeof lat === 'number' && typeof lng === 'number') {
      location.lat = lat;
      location.lng = lng;
    }
    if (phone) location.phone = phone;

    const addressDetail = [city, description].filter(Boolean).join(' — ') || null;

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO clinics
         (id, owner_uid, clinic_name, specialty, location, governorate, address, address_detail, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          clinicId,
          ownerUid,
          name,
          specialty,
          JSON.stringify(location),
          governorate,
          address,
          addressDetail,
        ],
      );

      res.status(201).json(
        shapeClinicRow({
          id: clinicId,
          owner_uid: ownerUid,
          clinic_name: name,
          specialty,
          governorate,
          address,
          address_detail: addressDetail,
          location,
        }),
      );
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create clinic error:', error);
    res.status(500).json({ error: 'Failed to create clinic' });
  }
}

export async function getClinics(req: Request, res: Response) {
  try {
    const { governorate, search, skip = 0, limit = 20 } = req.query;

    const connection = await pool.getConnection();
    try {
      let query = `SELECT *, clinic_name AS name, owner_uid AS owner_id FROM clinics WHERE 1=1`;
      const params: unknown[] = [];

      if (governorate) {
        query += ` AND governorate = ?`;
        params.push(governorate);
      }

      if (search) {
        query += ` AND (clinic_name LIKE ? OR address LIKE ? OR address_detail LIKE ? OR specialty LIKE ?)`;
        const term = `%${search}%`;
        params.push(term, term, term, term);
      }

      query += ` ORDER BY updated_at DESC LIMIT ?, ?`;
      params.push(parseInt(skip as string, 10) || 0, parseInt(limit as string, 10) || 20);

      const [clinics] = await connection.execute(query, params as any);
      const rows = clinics as Record<string, unknown>[];
      res.json(rows.map(shapeClinicRow));
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get clinics error:', error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to fetch clinics', detail: message });
  }
}

export async function getClinic(req: Request, res: Response) {
  try {
    const { clinicId } = req.params;

    const connection = await pool.getConnection();
    try {
      const [clinics] = await connection.execute(
        `SELECT *, clinic_name AS name, owner_uid AS owner_id FROM clinics WHERE id = ?`,
        [clinicId],
      );

      const clinic = (clinics as Record<string, unknown>[])[0];

      if (!clinic) {
        res.status(404).json({ error: 'Clinic not found' });
        return;
      }

      const [staff] = await connection.execute(
        `SELECT cs.id, cs.role, cs.specialty, u.id AS user_id, u.name, u.email, u.phone
         FROM clinic_staff cs
         LEFT JOIN users u ON cs.user_id = u.id
         WHERE cs.clinic_id = ?`,
        [clinicId],
      );

      res.json({
        ...shapeClinicRow(clinic),
        staff,
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get clinic error:', error);
    res.status(500).json({ error: 'Failed to fetch clinic' });
  }
}

function canManageClinic(
  clinic: Record<string, unknown> | undefined,
  clinicId: string,
  userId: string,
  role: string,
): boolean {
  if (!clinic) return true;
  const ownerUid = String(clinic.owner_uid ?? '');
  if (ownerUid === userId) return true;
  if (clinicId === userId) return true;
  return role === 'clinic' || role === 'admin';
}

export async function updateClinic(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { clinicId } = req.params;
    const body = req.body as Record<string, unknown>;

    const connection = await pool.getConnection();
    try {
      const [clinics] = await connection.execute('SELECT * FROM clinics WHERE id = ?', [clinicId]);
      const clinic = (clinics as Record<string, unknown>[])[0] as
        | Record<string, unknown>
        | undefined;

      if (!canManageClinic(clinic, clinicId, req.user.userId, req.user.role)) {
        res.status(403).json({ error: 'You do not have permission to update this clinic' });
        return;
      }

      let loc: Record<string, unknown> = {};
      try {
        const raw = clinic?.location;
        if (typeof raw === 'string') loc = JSON.parse(raw);
        else if (raw && typeof raw === 'object') loc = { ...(raw as object) };
      } catch {
        loc = {};
      }
      if (typeof body.latitude === 'number' && typeof body.longitude === 'number') {
        loc.lat = body.latitude;
        loc.lng = body.longitude;
      }
      if (body.phone != null) loc.phone = String(body.phone);
      if (body.licenseNumber != null || body.license_number != null) {
        loc.licenseNumber = String(body.licenseNumber ?? body.license_number);
      }
      if (body.bio != null || body.about != null) {
        loc.bio = String(body.bio ?? body.about);
      }

      const clinicName =
        body.clinicName != null
          ? String(body.clinicName).trim()
          : body.name != null
            ? String(body.name).trim()
            : clinic
              ? String(clinic.clinic_name ?? 'العيادة')
              : 'العيادة';
      const specialty =
        body.specialty != null
          ? String(body.specialty).trim()
          : clinic
            ? String(clinic.specialty ?? 'عام')
            : 'عام';
      const governorate =
        body.governorate != null
          ? String(body.governorate)
          : clinic
            ? (clinic.governorate as string | null)
            : null;
      const doctorPhotoUrl =
        body.doctorPhotoUrl !== undefined
          ? body.doctorPhotoUrl == null
            ? null
            : String(body.doctorPhotoUrl)
          : body.doctor_photo_url !== undefined
            ? body.doctor_photo_url == null
              ? null
              : String(body.doctor_photo_url)
            : undefined;

      if (!clinic) {
        await connection.execute(
          `INSERT INTO clinics
           (id, owner_uid, clinic_name, specialty, location, governorate, doctor_photo_url, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`,
          [
            clinicId,
            req.user.userId,
            clinicName || 'العيادة',
            specialty || 'عام',
            JSON.stringify(loc),
            governorate,
            doctorPhotoUrl ?? null,
          ] as any,
        );
        res.status(201).json({ message: 'Clinic created successfully' });
        return;
      }

      const updates: string[] = [];
      const values: unknown[] = [];

      if (body.name != null || body.clinicName != null) {
        updates.push('clinic_name = ?');
        values.push(clinicName || 'العيادة');
      }
      if (body.specialty != null) {
        updates.push('specialty = ?');
        values.push(specialty || 'عام');
      }
      if (body.governorate != null) {
        updates.push('governorate = ?');
        values.push(String(body.governorate));
      }
      if (body.address != null) {
        updates.push('address = ?');
        values.push(String(body.address));
      }
      if (body.city != null || body.description != null) {
        const city = body.city != null ? String(body.city) : '';
        const desc = body.description != null ? String(body.description) : '';
        updates.push('address_detail = ?');
        values.push([city, desc].filter(Boolean).join(' — ') || null);
      }
      if (body.consultationPrice != null || body.consultation_price != null) {
        const p = body.consultationPrice ?? body.consultation_price;
        updates.push('consultation_price = ?');
        values.push(p);
      }
      if (doctorPhotoUrl !== undefined) {
        updates.push('doctor_photo_url = ?');
        values.push(doctorPhotoUrl);
      }
      if (Object.keys(loc).length) {
        updates.push('location = ?');
        values.push(JSON.stringify(loc));
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      updates.push('updated_at = NOW(3)');
      values.push(clinicId);

      const q = `UPDATE clinics SET ${updates.join(', ')} WHERE id = ?`;
      await connection.execute(q, values as any);

      res.json({ message: 'Clinic updated successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update clinic error:', error);
    res.status(500).json({ error: 'Failed to update clinic' });
  }
}

export async function addClinicStaff(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { clinicId } = req.params;
    const { userId, role, specialty } = req.body;

    const connection = await pool.getConnection();
    try {
      const [clinics] = await connection.execute('SELECT owner_uid FROM clinics WHERE id = ?', [clinicId]);
      const clinic = (clinics as Record<string, unknown>[])[0];

      if (!clinic || clinic.owner_uid !== req.user.userId) {
        res.status(403).json({ error: 'You do not have permission to add staff to this clinic' });
        return;
      }

      const staffId = uuidv4();

      await connection.execute(
        `INSERT INTO clinic_staff (id, clinic_id, user_id, role, specialty, created_at)
         VALUES (?, ?, ?, ?, ?, NOW(3))`,
        [staffId, clinicId, userId, role, specialty || null],
      );

      res.status(201).json({
        id: staffId,
        clinic_id: clinicId,
        user_id: userId,
        role,
        specialty,
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Add clinic staff error:', error);
    res.status(500).json({ error: 'Failed to add staff' });
  }
}

export async function removeClinicStaff(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { clinicId, staffId } = req.params;

    const connection = await pool.getConnection();
    try {
      const [clinics] = await connection.execute('SELECT owner_uid FROM clinics WHERE id = ?', [clinicId]);
      const clinic = (clinics as Record<string, unknown>[])[0];

      if (!clinic || clinic.owner_uid !== req.user.userId) {
        res.status(403).json({ error: 'You do not have permission' });
        return;
      }

      await connection.execute('DELETE FROM clinic_staff WHERE id = ? AND clinic_id = ?', [staffId, clinicId]);

      res.json({ message: 'Staff removed successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Remove clinic staff error:', error);
    res.status(500).json({ error: 'Failed to remove staff' });
  }
}
