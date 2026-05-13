import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';

const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');

function safeStoragePath(rel: string): string | null {
  const normalized = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  if (normalized.includes('..')) return null;
  const full = path.join(UPLOAD_ROOT, normalized);
  if (!full.startsWith(UPLOAD_ROOT)) return null;
  return full;
}

function ensureDirForFile(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export async function uploadFile(req: Request, res: Response) {
  try {
    const { path: rel, contentType: _ct, base64 } = req.body as {
      path?: string;
      contentType?: string;
      base64?: string;
    };
    if (!rel || typeof rel !== 'string' || !base64 || typeof base64 !== 'string') {
      res.status(400).json({ error: 'path and base64 required' });
      return;
    }
    const full = safeStoragePath(rel);
    if (!full) {
      res.status(400).json({ error: 'invalid path' });
      return;
    }
    ensureDirForFile(full);
    const buf = Buffer.from(base64, 'base64');
    fs.writeFileSync(full, buf);

    const pubPath = rel.replace(/\\/g, '/');
    const base =
      typeof process.env.PUBLIC_FILE_BASE_URL === 'string' && process.env.PUBLIC_FILE_BASE_URL
        ? process.env.PUBLIC_FILE_BASE_URL.replace(/\/$/, '')
        : '';
    const qp = `path=${encodeURIComponent(pubPath)}`;
    const url = base ? `${base}/api/files/raw?${qp}` : `/api/files/raw?${qp}`;
    res.status(201).json({ path: pubPath, url });
  } catch (error) {
    console.error('uploadFile', error);
    res.status(500).json({ error: 'upload failed' });
  }
}

export async function fileUrl(req: Request, res: Response) {
  try {
    const rel = req.query.path as string;
    if (!rel) {
      res.status(400).json({ error: 'path query required' });
      return;
    }
    const pubPath = String(rel).replace(/\\/g, '/');
    const base =
      typeof process.env.PUBLIC_FILE_BASE_URL === 'string' && process.env.PUBLIC_FILE_BASE_URL
        ? process.env.PUBLIC_FILE_BASE_URL.replace(/\/$/, '')
        : '';
    const qp = `path=${encodeURIComponent(pubPath)}`;
    const url = base ? `${base}/api/files/raw?${qp}` : `/api/files/raw?${qp}`;
    res.json({ url });
  } catch (error) {
    console.error('fileUrl', error);
    res.status(500).json({ error: 'failed' });
  }
}

export async function deleteFile(req: Request, res: Response) {
  try {
    const { path: rel } = req.body as { path?: string };
    if (!rel || typeof rel !== 'string') {
      res.status(400).json({ error: 'path required' });
      return;
    }
    const full = safeStoragePath(rel);
    if (!full) {
      res.status(400).json({ error: 'invalid path' });
      return;
    }
    if (fs.existsSync(full)) fs.unlinkSync(full);
    res.json({ ok: true });
  } catch (error) {
    console.error('deleteFile', error);
    res.status(500).json({ error: 'delete failed' });
  }
}

export async function serveRaw(req: Request, res: Response) {
  try {
    const rel = typeof req.query.path === 'string' ? req.query.path : '';
    if (!rel) {
      res.status(400).send('path required');
      return;
    }
    const full = safeStoragePath(rel);
    if (!full || !fs.existsSync(full)) {
      res.status(404).send('Not found');
      return;
    }
    res.sendFile(full);
  } catch (error) {
    console.error('serveRaw', error);
    res.status(500).send('Error');
  }
}
