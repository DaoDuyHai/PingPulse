import { Router } from 'express';
import { getPublicSlug } from '../controllers/statusController.js';

const router = Router();

// Route công khai, KHÔNG CẦN token đăng nhập
router.get('/:slug', getPublicSlug);

export default router;
