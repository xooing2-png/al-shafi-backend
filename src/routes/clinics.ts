import { Router } from 'express';
import {
  createClinic,
  getClinics,
  getClinic,
  updateClinic,
  addClinicStaff,
  removeClinicStaff,
} from '@/controllers/clinics';
import { authMiddleware } from '@/middleware/auth';

const router = Router();

router.post('/', authMiddleware, createClinic);
router.get('/', getClinics);
router.get('/:clinicId', getClinic);
router.put('/:clinicId', authMiddleware, updateClinic);
router.post('/:clinicId/staff', authMiddleware, addClinicStaff);
router.delete('/:clinicId/staff/:staffId', authMiddleware, removeClinicStaff);

export default router;
