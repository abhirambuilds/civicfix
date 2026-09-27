import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller.js';
import { validateBody } from '../validators/validate.middleware.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Public Authentication Endpoints
router.post('/register', validateBody(registerSchema), register);
router.post('/login', validateBody(loginSchema), login);

// Authenticated User Endpoints
router.get('/me', requireAuth, getMe);

export default router;
