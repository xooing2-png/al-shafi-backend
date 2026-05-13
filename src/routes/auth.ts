import { Router } from 'express';
import { register, login, getMe } from '@/controllers/auth';
import { authMiddleware } from '@/middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authMiddleware, (_req, res) => {
  res.json({ ok: true });
});
router.get('/me', authMiddleware, getMe);

export default router;
