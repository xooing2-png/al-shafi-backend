import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import type { PoolConnection } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '@/config/database';
import { generateToken, generateRefreshToken } from '@/utils/jwt';
import { mapUserRow } from '@/controllers/users';

function registrationFailed(res: Response, err?: unknown) {
  const body: { error: string; detail?: string } = { error: 'Registration failed' };
  if (process.env.NODE_ENV === 'development' && err instanceof Error && err.message) {
    body.detail = err.message;
  }
  res.status(500).json(body);
}

function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: string; errno?: number };
  return e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062;
}

function isMissingContactEmailColumn(err: unknown): boolean {
  const e = err as { errno?: number; message?: string };
  return (
    e?.errno === 1054 &&
    typeof e?.message === 'string' &&
    e.message.includes('contact_email')
  );
}

/** مطابقة بريد الدخول الداخلي رغم اختلاف 0 في بداية الرقم المحلي */
function buildAuthEmailVariants(loginEmail: string): string[] {
  const s = new Set<string>();
  const t = loginEmail.trim();
  if (!t) return [];
  s.add(t);
  const at = t.lastIndexOf('@');
  if (at <= 0) return [...s];
  const local = t.slice(0, at);
  const domain = t.slice(at).toLowerCase();
  if (domain !== '@alshafi.app') return [...s];
  if (local.length === 11 && local.startsWith('0')) {
    s.add(`${local.slice(1)}@alshafi.app`);
  } else if (local.length === 10 && local.startsWith('7')) {
    s.add(`0${local}@alshafi.app`);
  }
  return [...s];
}

function isBcryptHash(value: string): boolean {
  return (
    value.startsWith('$2a$') ||
    value.startsWith('$2b$') ||
    value.startsWith('$2y$')
  );
}

async function verifyPasswordAndUpgrade(
  connection: PoolConnection,
  userId: string,
  plain: string,
  row: Record<string, unknown>,
): Promise<boolean> {
  const hash = row.password_hash;
  const legacy = row.password;

  if (typeof hash === 'string' && hash.length > 0) {
    if (isBcryptHash(hash)) {
      return bcrypt.compare(plain, hash);
    }
    if (hash === plain) {
      const newHash = await bcrypt.hash(plain, 10);
      await connection.execute(
        'UPDATE users SET password_hash = ?, updated_at = NOW(3) WHERE id = ?',
        [newHash, userId] as any,
      );
      return true;
    }
  }

  if (typeof legacy === 'string' && legacy.length > 0 && legacy === plain) {
    const newHash = await bcrypt.hash(plain, 10);
    await connection.execute(
      'UPDATE users SET password_hash = ?, updated_at = NOW(3) WHERE id = ?',
      [newHash, userId] as any,
    );
    return true;
  }

  return false;
}

export async function register(req: Request, res: Response) {
  try {
    const { name, email, phone, password, role, age, contactEmail } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
      role?: string;
      age?: number | string;
      contactEmail?: string;
    };

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const roleVal = typeof role === 'string' && role ? role : null;
    const phoneVal = typeof phone === 'string' ? phone : '';
    const loginEmail = String(email).trim();
    const contact =
      typeof contactEmail === 'string' && contactEmail.trim()
        ? contactEmail.trim()
        : null;

    const ageVal =
      typeof age === 'number' && Number.isFinite(age)
        ? age
        : typeof age === 'string' && age.trim()
          ? parseInt(age, 10)
          : null;

    const connection = await pool.getConnection();

    try {
      const [existingLogin] = await connection.execute(
        'SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1',
        [loginEmail, phoneVal],
      );
      if ((existingLogin as { id: string }[]).length > 0) {
        res.status(409).json({ error: 'Phone or login email already registered' });
        return;
      }

      if (contact) {
        try {
          const [existingContact] = await connection.execute(
            'SELECT id FROM users WHERE contact_email = ? LIMIT 1',
            [contact],
          );
          if ((existingContact as { id: string }[]).length > 0) {
            res.status(409).json({ error: 'This contact email is already in use' });
            return;
          }
        } catch (checkErr: unknown) {
          if (!isMissingContactEmailColumn(checkErr)) throw checkErr;
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();

      try {
        await connection.execute(
          `INSERT INTO users (id, name, email, contact_email, phone, password_hash, role, age, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
          [userId, name, loginEmail, contact, phoneVal, hashedPassword, roleVal, ageVal] as any,
        );
      } catch (insertErr: unknown) {
        if (isDuplicateKeyError(insertErr)) {
          res.status(409).json({ error: 'Phone or email already registered' });
          return;
        }
        if (isMissingContactEmailColumn(insertErr)) {
          try {
            await connection.execute(
              `INSERT INTO users (id, name, email, phone, password_hash, role, age, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
              [userId, name, loginEmail, phoneVal, hashedPassword, roleVal, ageVal] as any,
            );
          } catch (legacyErr: unknown) {
            if (isDuplicateKeyError(legacyErr)) {
              res.status(409).json({ error: 'Phone or email already registered' });
              return;
            }
            console.error('Register INSERT (legacy) error:', legacyErr);
            registrationFailed(res, legacyErr instanceof Error ? legacyErr : undefined);
            return;
          }
        } else {
          console.error('Register INSERT error:', insertErr);
          registrationFailed(res, insertErr instanceof Error ? insertErr : undefined);
          return;
        }
      }

      const accessToken = generateToken({
        userId,
        role: roleVal ?? 'patient',
        email: loginEmail,
      });
      const refreshToken = generateRefreshToken(userId);

      const [createdRows] = await connection.execute('SELECT * FROM users WHERE id = ?', [userId]);
      const created = (createdRows as Record<string, unknown>[])[0];

      res.status(201).json({
        user: mapUserRow(created ?? { id: userId, name, email: loginEmail, phone: phoneVal, role: roleVal, age: ageVal }),
        accessToken,
        refreshToken,
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Register error:', error);
    registrationFailed(res, error instanceof Error ? error : undefined);
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password, phone } = req.body as {
      email?: string;
      password?: string;
      phone?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const connection = await pool.getConnection();

    try {
      const phoneVal = typeof phone === 'string' ? phone.trim() : '';
      const loginEmail = String(email).trim();
      const variants = buildAuthEmailVariants(loginEmail);

      let user: Record<string, unknown> | undefined;
      if (phoneVal) {
        const inPh = variants.map(() => '?').join(',');
        const [rows] = await connection.execute(
          `SELECT * FROM users WHERE phone = ? OR email IN (${inPh}) LIMIT 1`,
          [phoneVal, ...variants],
        );
        user = (rows as Record<string, unknown>[])[0];
      }
      if (!user) {
        const inPh = variants.map(() => '?').join(',');
        const [rows] = await connection.execute(
          `SELECT * FROM users WHERE email IN (${inPh}) OR contact_email = ? LIMIT 1`,
          [...variants, loginEmail],
        );
        user = (rows as Record<string, unknown>[])[0];
      }

      if (!user) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const passwordMatch = await verifyPasswordAndUpgrade(
        connection,
        String(user.id),
        password,
        user,
      );

      if (!passwordMatch) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const accessToken = generateToken({
        userId: String(user.id),
        role: String(user.role ?? 'patient'),
        email: String(user.email ?? ''),
      });

      const refreshToken = generateRefreshToken(String(user.id));

      res.json({
        user: mapUserRow(user as Record<string, unknown>),
        token: accessToken,
        accessToken,
        refreshToken,
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const connection = await pool.getConnection();

    try {
      const [users] = await connection.execute('SELECT * FROM users WHERE id = ?', [
        req.user.userId,
      ]);

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
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}
