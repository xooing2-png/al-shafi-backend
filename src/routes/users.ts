import { Router } from 'express';
import {
  getUser,
  updateUser,
  patchUser,
  patchUserRole,
  saveNotificationToken,
} from '@/controllers/users';
import { authMiddleware } from '@/middleware/auth';

const router = Router();

router.put('/profile', authMiddleware, updateUser);
router.post('/notification-token', authMiddleware, saveNotificationToken);
router.patch('/:userId/role', authMiddleware, patchUserRole);
router.patch('/:userId', authMiddleware, patchUser);
router.get('/:userId', getUser);

export default router;
