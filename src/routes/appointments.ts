import { Router } from 'express';
import {
  createAppointment,
  getAppointments,
  updateAppointmentStatus,
  cancelAppointment,
} from '@/controllers/appointments';
import { authMiddleware } from '@/middleware/auth';

const router = Router();

router.post('/', authMiddleware, createAppointment);
router.get('/', authMiddleware, getAppointments);
router.patch('/:appointmentId/status', authMiddleware, updateAppointmentStatus);
router.delete('/:appointmentId', authMiddleware, cancelAppointment);

export default router;
