import { register, login, info } from '../controllers/userController.js';

import { Router } from 'express';
import { verifyUserToken } from '../middlewares/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/info', verifyUserToken, info);
export default router;
