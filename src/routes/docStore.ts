import { Router } from 'express';
import {
  docGet,
  docSet,
  docUpdate,
  docDelete,
  collectionAdd,
  docQuery,
} from '@/controllers/docStore';

const router = Router();

router.post('/doc/get', docGet);
router.post('/doc/set', docSet);
router.post('/doc/update', docUpdate);
router.post('/doc/delete', docDelete);
router.post('/collection/add', collectionAdd);
router.post('/query', docQuery);

export default router;
