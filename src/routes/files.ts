import { Router } from 'express';
import { uploadFile, fileUrl, deleteFile, serveRaw } from '@/controllers/files';
import { authMiddleware } from '@/middleware/auth';

const router = Router();

router.post('/upload', authMiddleware, uploadFile);
router.get('/url', authMiddleware, fileUrl);
router.post('/delete', authMiddleware, deleteFile);
/** تخديم الملفات المرفوعة (مثلاً صور الملفات الشخصية) */
router.get('/raw', serveRaw);

export default router;
