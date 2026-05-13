/**
 * Maps Firestore-style doc paths / collection queries to real MySQL tables
 * (see alshafi_mysql8_schema.sql). Used by doc-store so Expo getDoc/getDocs hits SQL.
 */
import type { PoolConnection } from 'mysql2/promise';
import { mapUserRow, mergeProfiles, parseJsonField } from '@/controllers/users';

type AnyRecord = Record<string, unknown>;

type QueryConstraint =
  | { type: 'where'; field: string; op: string; value: unknown }
  | { type: 'orderBy'; field: string; direction: 'asc' | 'desc' }
  | { type: 'limit'; value: number };

export const SQL_DOC_UNHANDLED = Symbol('sql_doc_unhandled');

function isObj(v: unknown): v is AnyRecord {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function rowJson(v: unknown): unknown {
  return parseJsonField(v);
}

function clinicRowToDoc(row: Record<string, unknown>): AnyRecord {
  return {
    ...row,
    id: row.id,
    name: row.clinic_name ?? row.name,
    clinicName: row.clinic_name,
    owner_id: row.owner_uid,
    owner_uid: row.owner_uid,
    specialty: row.specialty,
    governorate: row.governorate,
    qadha: row.qadha,
    nahiya: row.nahiya,
    address: row.address,
    addressDetail: row.address_detail,
    consultationPrice:
      row.consultation_price != null ? Number(row.consultation_price) : null,
    consultationFee:
      row.consultation_price != null ? Number(row.consultation_price) : null,
    doctorPhotoUrl: row.doctor_photo_url,
    clinicPhotoUrl: row.clinic_photo_url,
    certificateUrl: row.certificate_url,
    location: rowJson(row.location),
    licenseNumber:
      typeof (rowJson(row.location) as Record<string, unknown> | undefined)?.licenseNumber ===
      'string'
        ? String((rowJson(row.location) as Record<string, unknown>).licenseNumber)
        : undefined,
    bio:
      typeof (rowJson(row.location) as Record<string, unknown> | undefined)?.bio === 'string'
        ? String((rowJson(row.location) as Record<string, unknown>).bio)
        : typeof (rowJson(row.location) as Record<string, unknown> | undefined)?.about === 'string'
          ? String((rowJson(row.location) as Record<string, unknown>).about)
          : undefined,
    about:
      typeof (rowJson(row.location) as Record<string, unknown> | undefined)?.bio === 'string'
        ? String((rowJson(row.location) as Record<string, unknown>).bio)
        : undefined,
    avgRating: row.avg_rating != null ? Number(row.avg_rating) : 0,
    reviewCount: row.review_count != null ? Number(row.review_count) : 0,
    platformFeeStatus: row.platform_fee_status,
    platformFeePerPatient: row.platform_fee_per_patient,
    updatedAt: row.updated_at,
  };
}

function labRowToDoc(row: Record<string, unknown>): AnyRecord {
  return {
    id: row.id,
    owner_uid: row.owner_uid,
    labName: row.lab_name,
    name: row.name ?? row.lab_name,
    labType: row.lab_type,
    licenseNumber: row.license_number,
    governorate: row.governorate,
    addressDetail: row.address_detail,
    phonePublic: row.phone_public,
    location: rowJson(row.location),
    avgRating: row.avg_rating != null ? Number(row.avg_rating) : 0,
    reviewCount: row.review_count != null ? Number(row.review_count) : 0,
    tests_legacy: rowJson(row.tests_legacy),
    extra: rowJson(row.extra),
    updatedAt: row.updated_at,
  };
}

function pharmacyRowToDoc(row: Record<string, unknown>): AnyRecord {
  return {
    id: row.id,
    owner_uid: row.owner_uid,
    name: row.pharmacy_name,
    pharmacyName: row.pharmacy_name,
    governorate: row.governorate,
    qadha: row.qadha,
    nahiya: row.nahiya,
    addressDetail: row.address_detail,
    phonePublic: row.phone_public,
    pharmacyPhotoUrl: row.pharmacy_photo_url,
    location: rowJson(row.location),
    deliveryEnabled: row.delivery_enabled === 1 || row.delivery_enabled === true,
    deliveryRadius:
      row.delivery_radius != null ? Number(row.delivery_radius) : 10,
    avgRating: row.avg_rating != null ? Number(row.avg_rating) : 0,
    reviewCount: row.review_count != null ? Number(row.review_count) : 0,
    extra: rowJson(row.extra),
    updatedAt: row.updated_at,
  };
}

function nurseRowToDoc(row: Record<string, unknown>): AnyRecord {
  return {
    id: row.id,
    owner_uid: row.owner_uid,
    specialty: row.specialty,
    governorate: row.governorate,
    qadha: row.qadha,
    nahiya: row.nahiya,
    addressDetail: row.address_detail,
    phonePublic: row.phone_public,
    photoUrl: row.photo_url,
    services: rowJson(row.services),
    workDays: rowJson(row.work_days),
    workHours: rowJson(row.work_hours),
    openTime: row.open_time,
    closeTime: row.close_time,
    homeService: row.home_service === 1 || row.home_service === true,
    location: rowJson(row.location),
    coverageRadius:
      row.coverage_radius != null ? Number(row.coverage_radius) : null,
    available: row.available !== 0 && row.available !== false,
    avgRating: row.avg_rating != null ? Number(row.avg_rating) : 0,
    reviewCount: row.review_count != null ? Number(row.review_count) : 0,
    extra: rowJson(row.extra),
    updatedAt: row.updated_at,
  };
}

function hospitalRowToDoc(row: Record<string, unknown>): AnyRecord {
  return {
    id: row.id,
    owner_uid: row.owner_uid,
    name: row.hospital_name,
    hospitalName: row.hospital_name,
    governorate: row.governorate,
    qadha: row.qadha,
    nahiya: row.nahiya,
    addressDetail: row.address_detail,
    phonePublic: row.phone_public,
    photoUrl: row.photo_url,
    location: rowJson(row.location),
    avgRating: row.avg_rating != null ? Number(row.avg_rating) : 0,
    reviewCount: row.review_count != null ? Number(row.review_count) : 0,
    extra: rowJson(row.extra),
    updatedAt: row.updated_at,
  };
}

function consultationProviderRowToDoc(row: Record<string, unknown>): AnyRecord {
  const payload = (rowJson(row.payload) as AnyRecord) ?? {};
  return {
    id: row.id,
    userId: row.user_id,
    name: row.display_name,
    displayName: row.display_name,
    specialty: row.specialty,
    governorate: row.governorate,
    location: rowJson(row.location),
    avgRating: row.avg_rating != null ? Number(row.avg_rating) : 0,
    reviewCount: row.review_count != null ? Number(row.review_count) : 0,
    updatedAt: row.updated_at,
    ...payload,
  };
}

function medicalFileRowToDoc(row: Record<string, unknown>): AnyRecord {
  return {
    bloodType: row.blood_type,
    height: row.height_cm,
    heightCm: row.height_cm,
    weight: row.weight_kg,
    weightKg: row.weight_kg,
    chronicConditions: row.chronic_conditions,
    allergies: row.allergies,
    imagingUrls: rowJson(row.imaging_urls),
    allowedDoctors: rowJson(row.allowed_doctors),
    updatedAt: row.updated_at,
  };
}

/** Single-document reads backed by SQL */
export async function sqlBackedDocGet(
  connection: PoolConnection,
  docPath: string,
): Promise<AnyRecord | null | typeof SQL_DOC_UNHANDLED> {
  const u = /^users\/([^/]+)$/.exec(docPath);
  if (u) {
    const [rows] = await connection.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [
      u[1],
    ]);
    const row = (rows as Record<string, unknown>[])[0];
    return row ? (mapUserRow(row) as unknown as AnyRecord) : null;
  }

  const mf = /^users\/([^/]+)\/medicalFile\/(main|summary)$/.exec(docPath);
  if (mf) {
    const [rows] = await connection.execute(
      'SELECT * FROM user_medical_file_documents WHERE user_id = ? AND doc_key = ? LIMIT 1',
      [mf[1], mf[2]],
    );
    const row = (rows as Record<string, unknown>[])[0];
    return row ? medicalFileRowToDoc(row) : null;
  }

  const c = /^clinics\/([^/]+)$/.exec(docPath);
  if (c) {
    const [rows] = await connection.execute(
      'SELECT *, clinic_name AS name, owner_uid AS owner_id FROM clinics WHERE id = ? LIMIT 1',
      [c[1]],
    );
    const row = (rows as Record<string, unknown>[])[0];
    return row ? clinicRowToDoc(row) : null;
  }

  const l = /^labs\/([^/]+)$/.exec(docPath);
  if (l) {
    const [rows] = await connection.execute('SELECT * FROM labs WHERE id = ? LIMIT 1', [l[1]]);
    const row = (rows as Record<string, unknown>[])[0];
    return row ? labRowToDoc(row) : null;
  }

  const p = /^pharmacies\/([^/]+)$/.exec(docPath);
  if (p) {
    const [rows] = await connection.execute('SELECT * FROM pharmacies WHERE id = ? LIMIT 1', [
      p[1],
    ]);
    const row = (rows as Record<string, unknown>[])[0];
    return row ? pharmacyRowToDoc(row) : null;
  }

  const n = /^nurses\/([^/]+)$/.exec(docPath);
  if (n) {
    const [rows] = await connection.execute('SELECT * FROM nurses WHERE id = ? LIMIT 1', [n[1]]);
    const row = (rows as Record<string, unknown>[])[0];
    return row ? nurseRowToDoc(row) : null;
  }

  const h = /^hospitals\/([^/]+)$/.exec(docPath);
  if (h) {
    const [rows] = await connection.execute('SELECT * FROM hospitals WHERE id = ? LIMIT 1', [
      h[1],
    ]);
    const row = (rows as Record<string, unknown>[])[0];
    return row ? hospitalRowToDoc(row) : null;
  }

  const cp = /^consultationProviders\/([^/]+)$/.exec(docPath);
  if (cp) {
    const [rows] = await connection.execute(
      'SELECT * FROM consultation_providers WHERE id = ? LIMIT 1',
      [cp[1]],
    );
    const row = (rows as Record<string, unknown>[])[0];
    return row ? consultationProviderRowToDoc(row) : null;
  }

  return SQL_DOC_UNHANDLED;
}

type SqlListSpec = {
  table: string;
  map: (row: Record<string, unknown>) => AnyRecord;
  /** Firestore field name -> SQL column */
  filters: Record<string, string>;
  /** SQL order expression (default updated_at) */
  orderSql?: string;
};

const LIST_SPECS: Record<string, SqlListSpec> = {
  users: {
    table: 'users',
    map: (row) => mapUserRow(row) as unknown as AnyRecord,
    filters: { role: 'role', governorate: 'governorate' },
    orderSql: 'COALESCE(updated_at, created_at)',
  },
  clinics: {
    table: 'clinics',
    map: clinicRowToDoc,
    filters: { governorate: 'governorate', specialty: 'specialty', qadha: 'qadha', nahiya: 'nahiya' },
  },
  labs: {
    table: 'labs',
    map: labRowToDoc,
    filters: { governorate: 'governorate' },
  },
  pharmacies: {
    table: 'pharmacies',
    map: pharmacyRowToDoc,
    filters: { governorate: 'governorate', qadha: 'qadha', nahiya: 'nahiya' },
  },
  nurses: {
    table: 'nurses',
    map: nurseRowToDoc,
    filters: { governorate: 'governorate', qadha: 'qadha', nahiya: 'nahiya' },
  },
  hospitals: {
    table: 'hospitals',
    map: hospitalRowToDoc,
    filters: { governorate: 'governorate', qadha: 'qadha', nahiya: 'nahiya' },
  },
  consultationProviders: {
    table: 'consultation_providers',
    map: consultationProviderRowToDoc,
    filters: { governorate: 'governorate', specialty: 'specialty' },
  },
};

export async function sqlBackedDocQuery(
  connection: PoolConnection,
  basePath: string,
  constraints: QueryConstraint[],
  isGroup: boolean,
  _groupName: string,
): Promise<Array<{ id: string; data: AnyRecord }> | null> {
  if (isGroup) return null;

  const spec = LIST_SPECS[basePath];
  if (!spec) return null;

  const where: string[] = [];
  const params: unknown[] = [];
  let lim = 80;

  for (const c of constraints) {
    if (c.type === 'where' && c.op === '==') {
      const col = spec.filters[c.field];
      if (col) {
        where.push(`${col} = ?`);
        params.push(c.value);
      }
    } else if (c.type === 'limit' && typeof c.value === 'number') {
      lim = Math.min(200, Math.max(1, c.value));
    }
  }

  const orderExpr = spec.orderSql ?? 'updated_at';
  const sql = `SELECT * FROM ${spec.table} WHERE 1=1 ${
    where.length ? `AND ${where.join(' AND ')}` : ''
  } ORDER BY ${orderExpr} DESC LIMIT ?`;
  params.push(lim);

  const [rows] = await connection.execute(sql, params as any);
  return (rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    data: spec.map(row),
  }));
}

/** Persist users/{uid} and users/{uid}/medicalFile/{key} into SQL */
export async function sqlBackedDocSet(
  connection: PoolConnection,
  docPath: string,
  data: AnyRecord,
  merge: boolean,
): Promise<boolean> {
  const u = /^users\/([^/]+)$/.exec(docPath);
  if (u) {
    const userId = u[1]!;
    const [users] = await connection.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    const row = (users as Record<string, unknown>[])[0];
    if (!row) return false;

    const body = data;
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
    if (body.email !== undefined) {
      updates.push('email = ?');
      values.push(body.email);
    }
    if (typeof body.age === 'number') {
      updates.push('age = ?');
      values.push(body.age);
    }
    if (typeof body.role === 'string') {
      updates.push('role = ?');
      values.push(body.role);
    }
    if (typeof body.governorate === 'string') {
      updates.push('governorate = ?');
      values.push(body.governorate);
    }
    if (body.bloodDonor !== undefined) {
      updates.push('blood_donor = ?');
      values.push(body.bloodDonor ? 1 : 0);
    }
    if (typeof body.staffRole === 'string' || body.staffRole === null) {
      updates.push('staff_role = ?');
      values.push(body.staffRole);
    }
    const mergeProfile = (col: string, key: 'clinic' | 'nurse' | 'lab' | 'pharmacy' | 'hospital') => {
      const incoming = body[key];
      if (incoming === undefined) return;
      if (!isObj(incoming as unknown)) return;
      const prev = (parseJsonField((row as Record<string, unknown>)[col]) as Record<string, unknown>) ?? {};
      const next = merge ? mergeProfiles(prev, incoming as Record<string, unknown>) : (incoming as Record<string, unknown>);
      updates.push(`${col} = ?`);
      values.push(JSON.stringify(next));
    };
    mergeProfile('clinic_profile', 'clinic');
    mergeProfile('nurse_profile', 'nurse');
    mergeProfile('lab_profile', 'lab');
    mergeProfile('pharmacy_profile', 'pharmacy');
    mergeProfile('hospital_profile', 'hospital');

    if (updates.length === 0) return true;

    updates.push('updated_at = NOW(3)');
    values.push(userId);
    await connection.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values as any);
    return true;
  }

  const c = /^clinics\/([^/]+)$/.exec(docPath);
  if (c) {
    const clinicId = c[1]!;
    const [clinics] = await connection.execute('SELECT * FROM clinics WHERE id = ? LIMIT 1', [
      clinicId,
    ]);
    const row = (clinics as Record<string, unknown>[])[0];
    const body = data;

    const locPatch: Record<string, unknown> = {};
    if (body.location !== undefined) {
      const incoming = body.location;
      if (isObj(incoming)) {
        Object.assign(locPatch, incoming);
      }
    }
    if (body.licenseNumber !== undefined) {
      locPatch.licenseNumber = body.licenseNumber;
    }
    const bioVal = body.bio ?? body.about;
    if (bioVal !== undefined) {
      locPatch.bio = bioVal;
    }

    if (!row) {
      const ownerUid =
        (typeof body.ownerUid === 'string' && body.ownerUid.trim()) ||
        (typeof body.owner_uid === 'string' && body.owner_uid.trim()) ||
        (typeof body.owner_id === 'string' && body.owner_id.trim()) ||
        null;
      if (!ownerUid) return false;

      const clinicName =
        (typeof body.clinicName === 'string' && body.clinicName.trim()) ||
        (typeof body.name === 'string' && body.name.trim()) ||
        'العيادة';
      const specialty =
        (typeof body.specialty === 'string' && body.specialty.trim()) || 'عام';
      const prevLoc: Record<string, unknown> = {};
      const nextLoc = merge ? mergeProfiles(prevLoc, locPatch) : locPatch;

      await connection.execute(
        `INSERT INTO clinics
         (id, owner_uid, clinic_name, specialty, location, governorate, address_detail, doctor_photo_url, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          clinicId,
          ownerUid,
          clinicName,
          specialty,
          JSON.stringify(nextLoc),
          typeof body.governorate === 'string' ? body.governorate : null,
          typeof body.addressDetail === 'string'
            ? body.addressDetail
            : typeof body.address === 'string'
              ? body.address
              : null,
          body.doctorPhotoUrl == null
            ? null
            : body.doctorPhotoUrl !== undefined
              ? String(body.doctorPhotoUrl)
              : null,
        ] as any,
      );
      return true;
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (typeof body.specialty === 'string') {
      updates.push('specialty = ?');
      values.push(body.specialty);
    }
    if (body.doctorPhotoUrl !== undefined) {
      updates.push('doctor_photo_url = ?');
      values.push(body.doctorPhotoUrl == null ? null : String(body.doctorPhotoUrl));
    }
    if (typeof body.addressDetail === 'string' || typeof body.address === 'string') {
      updates.push('address_detail = ?');
      values.push(String(body.addressDetail ?? body.address));
    }
    if (typeof body.governorate === 'string') {
      updates.push('governorate = ?');
      values.push(body.governorate);
    }
    if (Object.keys(locPatch).length > 0) {
      const prev = (parseJsonField(row.location) as Record<string, unknown>) ?? {};
      const next = merge ? mergeProfiles(prev, locPatch) : locPatch;
      updates.push('location = ?');
      values.push(JSON.stringify(next));
    }

    if (updates.length === 0) return true;

    updates.push('updated_at = NOW(3)');
    values.push(clinicId);
    await connection.execute(`UPDATE clinics SET ${updates.join(', ')} WHERE id = ?`, values as any);
    return true;
  }

  const mf = /^users\/([^/]+)\/medicalFile\/(main|summary)$/.exec(docPath);
  if (mf) {
    const userId = mf[1]!;
    const docKey = mf[2]!;
    const [existing] = await connection.execute(
      'SELECT * FROM user_medical_file_documents WHERE user_id = ? AND doc_key = ? LIMIT 1',
      [userId, docKey],
    );
    const prevRow = (existing as Record<string, unknown>[])[0];
    const prevDoc: AnyRecord = prevRow
      ? medicalFileRowToDoc(prevRow)
      : { allowedDoctors: [] };
    const next = merge ? mergeProfiles(prevDoc, data) : data;

    const allowedDoctors = next.allowedDoctors ?? next.allowed_doctors;
    const allowedJson = Array.isArray(allowedDoctors)
      ? JSON.stringify(allowedDoctors)
      : JSON.stringify(parseJsonField(allowedDoctors) ?? []);

    await connection.execute(
      `INSERT INTO user_medical_file_documents
       (user_id, doc_key, blood_type, height_cm, weight_kg, chronic_conditions, allergies, imaging_urls, allowed_doctors, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE
         blood_type = VALUES(blood_type),
         height_cm = VALUES(height_cm),
         weight_kg = VALUES(weight_kg),
         chronic_conditions = VALUES(chronic_conditions),
         allergies = VALUES(allergies),
         imaging_urls = VALUES(imaging_urls),
         allowed_doctors = VALUES(allowed_doctors),
         updated_at = NOW(3)`,
      [
        userId,
        docKey,
        next.bloodType ?? next.blood_type ?? null,
        next.heightCm ?? next.height_cm ?? next.height ?? null,
        next.weightKg ?? next.weight_kg ?? next.weight ?? null,
        next.chronicConditions ?? next.chronic_conditions ?? null,
        next.allergies ?? null,
        JSON.stringify(next.imagingUrls ?? next.imaging_urls ?? []),
        allowedJson,
      ] as any,
    );
    return true;
  }

  return false;
}

export async function sqlBackedDocUpdate(
  connection: PoolConnection,
  docPath: string,
  data: AnyRecord,
): Promise<boolean> {
  return sqlBackedDocSet(connection, docPath, data, true);
}
