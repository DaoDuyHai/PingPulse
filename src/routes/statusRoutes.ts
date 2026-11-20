import { Router } from 'express';
import { getPublicSlug } from '../controllers/statusController.js';
import { rateLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// Route công khai, KHÔNG CẦN token đăng nhập
// Áp dụng Rate Limiting: tối đa 60 request/phút cho mỗi IP
router.get('/:slug', rateLimiter(60, 60), getPublicSlug);

export default router;
