import { Router } from 'express';
import {
  checkNowMonitor,
  createMonitor,
  deleteMonitor,
  editDetailMonitor,
  getDetailMonitor,
  getMonitors,
} from '../controllers/monitorController.js';
import { verifyUserToken } from '../middlewares/auth.js';

const router = Router();

router.use(verifyUserToken);

router.get('/', getMonitors);
router.post('/', createMonitor);
router.get('/:id', getDetailMonitor);
router.put('/:id', editDetailMonitor);
router.patch('/:id', editDetailMonitor);
router.delete('/:id', deleteMonitor);
router.post('/:id/check', checkNowMonitor);

export default router;
