/**
 * Firebase-style hierarchical paths persisted in MySQL (generic_documents).
 * Mirrors what the Expo client sends via POST /api/doc-store/*
 */
import { Response } from 'express';
import type { PoolConnection } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '@/config/database';
import {
  SQL_DOC_UNHANDLED,
  sqlBackedDocGet,
  sqlBackedDocQuery,
  sqlBackedDocSet,
  sqlBackedDocUpdate,
} from '@/utils/docStoreSqlBridge';

type Primitive = string | number | boolean | null;
type AnyRecord = Record<string, unknown>;

type QueryConstraint =
  | { type: 'where'; field: string; op: string; value: unknown }
  | { type: 'orderBy'; field: string; direction: 'asc' | 'desc' }
  | { type: 'limit'; value: number };

function isObj(v: unknown): v is AnyRecord {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function applySentinel(current: unknown, value: unknown): unknown {
  if (!isObj(value) || typeof value.__op !== 'string') return value;
  const sent = value as {
    __op: string;
    value?: number;
    values?: unknown[];
  };
  if (sent.__op === 'serverTimestamp') return new Date().toISOString();
  if (sent.__op === 'increment')
    return (Number(current ?? 0) || 0) + (Number(sent.value) || 0);
  if (sent.__op === 'arrayUnion') {
    const vals = sent.values ?? [];
    const base = Array.isArray(current) ? [...current] : [];
    for (const item of vals) {
      if (!base.some((x) => JSON.stringify(x) === JSON.stringify(item))) base.push(item);
    }
    return base;
  }
  if (sent.__op === 'arrayRemove') {
    const vals = sent.values ?? [];
    const base = Array.isArray(current) ? [...current] : [];
    return base.filter((x) => !vals.some((item) => JSON.stringify(item) === JSON.stringify(x)));
  }
  if (sent.__op === 'deleteField') return undefined;
  return value;
}

function mergePatch(target: AnyRecord, patch: AnyRecord): AnyRecord {
  const next = { ...target };
  for (const [key, raw] of Object.entries(patch)) {
    const incoming = applySentinel(next[key], raw);
    if (incoming === undefined) {
      delete next[key];
      continue;
    }
    if (isObj(incoming) && isObj(next[key])) {
      next[key] = mergePatch(next[key] as AnyRecord, incoming);
      continue;
    }
    next[key] = incoming;
  }
  return next;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getJson(
  connection: PoolConnection,
  docPath: string,
): Promise<AnyRecord | null> {
  const [rows] = await connection.execute(
    'SELECT payload FROM generic_documents WHERE doc_path = ? LIMIT 1',
    [docPath],
  );
  const row = (rows as { payload: unknown }[])[0];
  if (!row) return null;
  if (typeof row.payload === 'string') {
    try {
      return JSON.parse(row.payload) as AnyRecord;
    } catch {
      return null;
    }
  }
  return (row.payload ?? null) as AnyRecord | null;
}

async function upsertJson(
  connection: PoolConnection,
  docPath: string,
  data: AnyRecord,
  merge: boolean,
): Promise<void> {
  if (merge) {
    const prev = (await getJson(connection, docPath)) ?? {};
    const next = mergePatch(prev, data);
    await connection.execute(
      `INSERT INTO generic_documents (doc_path, payload, updated_at)
       VALUES (?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW(3)`,
      [docPath, JSON.stringify(next)],
    );
  } else {
    await connection.execute(
      `INSERT INTO generic_documents (doc_path, payload, updated_at)
       VALUES (?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW(3)`,
      [docPath, JSON.stringify(data)],
    );
  }
}

async function listPathsWithPrefix(
  connection: PoolConnection,
  basePath: string,
): Promise<string[]> {
  const like = `${basePath}/%`;
  const [rows] = await connection.execute(
    'SELECT doc_path FROM generic_documents WHERE doc_path LIKE ?',
    [like],
  );
  return (rows as { doc_path: string }[]).map((r) => r.doc_path);
}

async function listGroupPaths(
  connection: PoolConnection,
  groupName: string,
): Promise<string[]> {
  const re = new RegExp(`^.*/${escapeRegex(groupName)}/[^/]+$`);
  const [rows] = await connection.execute(
    'SELECT doc_path FROM generic_documents WHERE doc_path LIKE ?',
    [`%/${groupName}/%`],
  );
  const all = (rows as { doc_path: string }[]).map((r) => r.doc_path);
  return all.filter((p) => re.test(p));
}

function applyQueryLocal(
  rows: Array<{ id: string; data: AnyRecord }>,
  constraints: QueryConstraint[],
): Array<{ id: string; data: AnyRecord }> {
  let next = [...rows];
  for (const c of constraints) {
    if (c.type === 'where') {
      next = next.filter((row) => {
        const val = row.data[c.field];
        if (c.op === '==') return val === c.value;
        if (c.op === '>=') return Number(val) >= Number(c.value);
        if (c.op === '>') return Number(val) > Number(c.value);
        if (c.op === '<=') return Number(val) <= Number(c.value);
        if (c.op === '<') return Number(val) < Number(c.value);
        if (c.op === 'not-in' && Array.isArray(c.value)) return !c.value.includes(val);
        if (c.op === 'array-contains' && Array.isArray(val))
          return Array.isArray(c.value) ? false : val.includes(c.value as Primitive);
        if (c.op === 'in' && Array.isArray(c.value)) return c.value.includes(val);
        return false;
      });
    } else if (c.type === 'orderBy') {
      const dir = c.direction === 'desc' ? -1 : 1;
      next.sort((a, b) => {
        const va = a.data[c.field];
        const vb = b.data[c.field];
        if (va === vb) return 0;
        return va! > vb! ? dir : -dir;
      });
    } else if (c.type === 'limit') {
      next = next.slice(0, c.value);
    }
  }
  return next;
}

export async function docGet(req: { body: { path?: string } }, res: Response) {
  const docPath = req.body.path;
  if (!docPath || typeof docPath !== 'string') {
    res.status(400).json({ error: 'path required' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    const adminMatch = /^admins\/([^/]+)$/.exec(docPath);
    if (adminMatch) {
      const adminId = adminMatch[1]!;
      const [rows] = await connection.execute(
        'SELECT admin_id FROM admins WHERE admin_id = ? LIMIT 1',
        [adminId],
      );
      const ok = Array.isArray(rows) && (rows as { admin_id: string }[]).length > 0;
      res.json({ doc: ok ? { active: true } : null });
      return;
    }

    const sqlDoc = await sqlBackedDocGet(connection, docPath);
    if (sqlDoc !== SQL_DOC_UNHANDLED) {
      const overlay = await getJson(connection, docPath);
      const merged =
        sqlDoc && overlay
          ? mergePatch(deepClone(sqlDoc), overlay)
          : sqlDoc ?? overlay;
      res.json({ doc: merged ?? null });
      return;
    }

    const data = await getJson(connection, docPath);
    res.json({ doc: data });
  } finally {
    connection.release();
  }
}

export async function docSet(req: { body: { path?: string; data?: AnyRecord; merge?: boolean } }, res: Response) {
  const docPath = req.body.path;
  const data = req.body.data;
  const merge = req.body.merge === true;
  if (!docPath || typeof docPath !== 'string' || !isObj(data)) {
    res.status(400).json({ error: 'path and data required' });
    return;
  }
  const connection = await pool.getConnection();
  try {
    const didSql = await sqlBackedDocSet(connection, docPath, data, merge);
    if (didSql) {
      res.json({ ok: true });
      return;
    }
    await upsertJson(connection, docPath, data, merge);
    res.json({ ok: true });
  } catch (error) {
    console.error('docSet error:', error);
    res.status(500).json({ error: 'Failed to persist document' });
  } finally {
    connection.release();
  }
}

export async function docUpdate(req: { body: { path?: string; data?: AnyRecord } }, res: Response) {
  const docPath = req.body.path;
  const data = req.body.data;
  if (!docPath || typeof docPath !== 'string' || !isObj(data)) {
    res.status(400).json({ error: 'path and data required' });
    return;
  }
  const connection = await pool.getConnection();
  try {
    const didSql = await sqlBackedDocUpdate(connection, docPath, data);
    if (didSql) {
      res.json({ ok: true });
      return;
    }
    const prev = (await getJson(connection, docPath)) ?? {};
    const next = mergePatch(prev, data);
    await connection.execute(
      `INSERT INTO generic_documents (doc_path, payload, updated_at)
       VALUES (?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW(3)`,
      [docPath, JSON.stringify(next)],
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('docUpdate error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  } finally {
    connection.release();
  }
}

export async function docDelete(req: { body: { path?: string } }, res: Response) {
  const docPath = req.body.path;
  if (!docPath || typeof docPath !== 'string') {
    res.status(400).json({ error: 'path required' });
    return;
  }
  const connection = await pool.getConnection();
  try {
    await connection.execute('DELETE FROM generic_documents WHERE doc_path = ?', [docPath]);
    res.json({ ok: true });
  } finally {
    connection.release();
  }
}

export async function collectionAdd(
  req: { body: { path?: string; data?: AnyRecord } },
  res: Response,
) {
  const colPath = req.body.path;
  const data = req.body.data;
  if (!colPath || typeof colPath !== 'string' || !isObj(data)) {
    res.status(400).json({ error: 'path and data required' });
    return;
  }
  const id = uuidv4();
  const docPath = `${colPath}/${id}`;
  const connection = await pool.getConnection();
  try {
    await upsertJson(connection, docPath, data, false);
    res.json({ id });
  } finally {
    connection.release();
  }
}

export async function docQuery(
  req: {
    body: {
      basePath?: string;
      constraints?: QueryConstraint[];
      isGroup?: boolean;
      groupName?: string;
    };
  },
  res: Response,
) {
  const basePath = req.body.basePath ?? '';
  const constraints = Array.isArray(req.body.constraints) ? req.body.constraints : [];
  const isGroup = req.body.isGroup === true;
  const groupName = typeof req.body.groupName === 'string' ? req.body.groupName : '';

  const connection = await pool.getConnection();
  try {
    const sqlRows = await sqlBackedDocQuery(
      connection,
      basePath,
      constraints as QueryConstraint[],
      isGroup,
      groupName,
    );
    if (sqlRows !== null) {
      res.json({ rows: sqlRows });
      return;
    }

    let docPaths: string[] = [];
    if (isGroup && groupName) {
      docPaths = await listGroupPaths(connection, groupName);
    } else {
      const all = await listPathsWithPrefix(connection, basePath);
      const pref = `${basePath}/`;
      docPaths = all.filter((p) => {
        if (!p.startsWith(pref)) return false;
        const rest = p.slice(pref.length);
        return !!rest && !rest.includes('/');
      });
    }

    const rows: Array<{ id: string; data: AnyRecord }> = [];
    for (const p of docPaths) {
      let id = '';
      if (isGroup && groupName) {
        const parts = p.split('/').filter(Boolean);
        const idx = parts.lastIndexOf(groupName);
        if (idx >= 0 && idx + 1 < parts.length) id = parts[idx + 1]!;
      } else {
        const prefix = `${basePath}/`;
        if (!p.startsWith(prefix)) continue;
        const rest = p.slice(prefix.length);
        if (!rest || rest.includes('/')) continue;
        id = rest;
      }
      if (!id) continue;
      const data = await getJson(connection, p);
      if (data) rows.push({ id, data: deepClone(data) });
    }

    const filtered = applyQueryLocal(rows, constraints);
    res.json({ rows: filtered });
  } finally {
    connection.release();
  }
}
