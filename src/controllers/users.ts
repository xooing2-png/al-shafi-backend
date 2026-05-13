import { Request, Response } from 'express';
import { pool } from '@/config/database';

export function parseJsonField(v: unknown): unknown {
  if (v == null || v === '') return undefined;
  if (typeof v === 'object') return v;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** شكل قريب من مستند المستخدم في التطبيق (camelCase) */
export function mapUserRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? '',
    email: row.email ?? null,
    contactEmail: row.contact_email ?? undefined,
    age: row.age ?? null,
    role: row.role ?? null,
    staffRole: row.staff_role ?? null,
    createdAt: row.created_at ?? null,
    loyaltyPoints: row.loyalty_points ?? undefined,
    governorate: row.governorate ?? undefined,
    bloodDonor: row.blood_donor === 1 || row.blood_donor === true,
    clinic: parseJsonField(row.clinic_profile),
    nurse: parseJsonField(row.nurse_profile),
    lab: parseJsonField(row.lab_profile),
    pharmacy: parseJsonField(row.pharmacy_profile),
    hospital: parseJsonField(row.hospital_profile),
    plan: row.plan ?? undefined,
    planExpiresAt: row.plan_expires_at ?? null,
    planPrice: row.plan_price != null ? Number(row.plan_price) : undefined,
    planUpdatedAt: row.plan_updated_at ?? null,
    bloodType: row.blood_type ?? undefined,
    lastBloodDonationAt: row.last_blood_donation_at ?? null,
    suspended: row.suspended === 1 || row.suspended === true,
    suspendedAt: row.suspended_at ?? null,
    suspendReason: row.suspend_reason ?? undefined,
  };
}

export async function getUser(req: Request, res: Response) {
  try {
    const { userId } = req.params;

    const connection = await pool.getConnection();

    try {
      const [users] = await connection.execute('SELECT * FROM users WHERE id = ?', [userId]);

      const user = (users as Record<string, unknown>[])[0];

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(mapUserRow(user));
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { name, phone, age, governorate, bloodDonor } = req.body;
    const userId = req.user.userId;

    const connection = await pool.getConnection();

    try {
      const updates: string[] = [];
      const values: unknown[] = [];

      if (name) {
        updates.push('name = ?');
        values.push(name);
      }
      if (phone) {
        updates.push('phone = ?');
        values.push(phone);
      }
      if (age !== undefined) {
        updates.push('age = ?');
        values.push(age);
      }
      if (governorate) {
        updates.push('governorate = ?');
        values.push(governorate);
      }
      if (bloodDonor !== undefined) {
        updates.push('blood_donor = ?');
        values.push(bloodDonor ? 1 : 0);
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      updates.push('updated_at = NOW(3)');
      values.push(userId);

      const q = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

      await connection.execute(q, values as any);

      const [again] = await connection.execute(
        'SELECT * FROM users WHERE id = ?',
        [userId],
      );
      const row = (again as Record<string, unknown>[])[0];
      res.json(mapUserRow(row ?? {}));
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
}

export function mergeProfiles(
  prev: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...prev };
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined) continue;
    if (isObj(v) && isObj(out[k])) {
      out[k] = mergeProfiles(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

const ROLE_PROFILE_COLUMNS: Record<string, string> = {
  clinic: 'clinic_profile',
  nurse: 'nurse_profile',
  lab: 'lab_profile',
  pharmacy: 'pharmacy_profile',
  hospital: 'hospital_profile',
};

function profilePatchFromRoleBody(
  role: string,
  body: Record<string, unknown>,
): { column: string; data: Record<string, unknown> } | null {
  for (const [slot, column] of Object.entries(ROLE_PROFILE_COLUMNS)) {
    const incoming = body[slot];
    if (isObj(incoming)) {
      return { column, data: incoming };
    }
  }
  const legacy = body.clinic;
  if (role !== 'clinic' && isObj(legacy)) {
    const column = ROLE_PROFILE_COLUMNS[role];
    if (column) {
      return { column, data: legacy };
    }
  }
  return null;
}

export async function patchUser(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { userId } = req.params;
    if (req.user.userId !== userId && req.user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const connection = await pool.getConnection();

    try {
      const [users] = await connection.execute('SELECT * FROM users WHERE id = ?', [userId]);
      const row = (users as Record<string, unknown>[])[0];
      if (!row) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const updates: string[] = [];
      const values: unknown[] = [];

      if (typeof body.name === 'string') {
        updates.push('name = ?');
        values.push(body.name);
      }
      if (typeof body.phone === 'string') {
        updates.push('phone = ?');
        values.push(body.phone);
      }
      if (typeof body.age === 'number') {
        updates.push('age = ?');
        values.push(body.age);
      }
      if (typeof body.governorate === 'string') {
        updates.push('governorate = ?');
        values.push(body.governorate);
      }
      if (typeof body.role === 'string') {
        updates.push('role = ?');
        values.push(body.role);
      }
      if (body.bloodDonor !== undefined) {
        updates.push('blood_donor = ?');
        values.push(body.bloodDonor ? 1 : 0);
      }
      if (typeof body.staffRole === 'string' || body.staffRole === null) {
        updates.push('staff_role = ?');
        values.push(body.staffRole);
      }
      if (body.clinic !== undefined && isObj(body.clinic as unknown)) {
        const prev = (parseJsonField(row.clinic_profile) as Record<string, unknown>) ?? {};
        const next = mergeProfiles(prev, body.clinic as Record<string, unknown>);
        updates.push('clinic_profile = ?');
        values.push(JSON.stringify(next));
      }
      if (body.nurse !== undefined && isObj(body.nurse as unknown)) {
        const prev = (parseJsonField(row.nurse_profile) as Record<string, unknown>) ?? {};
        const next = mergeProfiles(prev, body.nurse as Record<string, unknown>);
        updates.push('nurse_profile = ?');
        values.push(JSON.stringify(next));
      }
      if (body.lab !== undefined && isObj(body.lab as unknown)) {
        const prev = (parseJsonField(row.lab_profile) as Record<string, unknown>) ?? {};
        const next = mergeProfiles(prev, body.lab as Record<string, unknown>);
        updates.push('lab_profile = ?');
        values.push(JSON.stringify(next));
      }
      if (body.pharmacy !== undefined && isObj(body.pharmacy as unknown)) {
        const prev = (parseJsonField(row.pharmacy_profile) as Record<string, unknown>) ?? {};
        const next = mergeProfiles(prev, body.pharmacy as Record<string, unknown>);
        updates.push('pharmacy_profile = ?');
        values.push(JSON.stringify(next));
      }
      if (body.hospital !== undefined && isObj(body.hospital as unknown)) {
        const prev = (parseJsonField(row.hospital_profile) as Record<string, unknown>) ?? {};
        const next = mergeProfiles(prev, body.hospital as Record<string, unknown>);
        updates.push('hospital_profile = ?');
        values.push(JSON.stringify(next));
      }

      if (updates.length === 0) {
        res.json(mapUserRow(row));
        return;
      }

      updates.push('updated_at = NOW(3)');
      values.push(userId);
      await connection.execute(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values as any,
      );

      const [again] = await connection.execute('SELECT * FROM users WHERE id = ?', [userId]);
      res.json(mapUserRow((again as Record<string, unknown>[])[0] ?? {}));
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Patch user error:', error);
    res.status(500).json({ error: 'Failed to patch user' });
  }
}

export async function patchUserRole(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { userId } = req.params;
    if (req.user.userId !== userId && req.user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const role = typeof body.role === 'string' ? body.role : '';
    if (!role) {
      res.status(400).json({ error: 'role required' });
      return;
    }

    const connection = await pool.getConnection();
    try {
      const [users] = await connection.execute('SELECT * FROM users WHERE id = ?', [userId]);
      const row = (users as Record<string, unknown>[])[0];
      if (!row) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const profilePatch = profilePatchFromRoleBody(role, body);
      if (profilePatch) {
        const prev = (parseJsonField(row[profilePatch.column]) as Record<string, unknown>) ?? {};
        const next = mergeProfiles(prev, profilePatch.data);
        await connection.execute(
          `UPDATE users SET role = ?, ${profilePatch.column} = ?, updated_at = NOW(3) WHERE id = ?`,
          [role, JSON.stringify(next), userId],
        );
      } else {
        await connection.execute('UPDATE users SET role = ?, updated_at = NOW(3) WHERE id = ?', [
          role,
          userId,
        ]);
      }

      const [again] = await connection.execute('SELECT * FROM users WHERE id = ?', [userId]);
      res.json(mapUserRow((again as Record<string, unknown>[])[0] ?? {}));
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('patchUserRole error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
}

export async function saveNotificationToken(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { fcmToken } = req.body;

    if (!fcmToken) {
      res.status(400).json({ error: 'FCM token is required' });
      return;
    }

    const connection = await pool.getConnection();

    try {
      await connection.execute(
        `INSERT INTO user_tokens (user_id, fcm_token, platform, updated_at)
         VALUES (?, ?, 'mobile', NOW(3))
         ON DUPLICATE KEY UPDATE fcm_token = VALUES(fcm_token), platform = VALUES(platform), updated_at = NOW(3)`,
        [req.user.userId, fcmToken],
      );

      res.json({ message: 'FCM token saved successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Save notification token error:', error);
    res.status(500).json({ error: 'Failed to save notification token' });
  }
}
