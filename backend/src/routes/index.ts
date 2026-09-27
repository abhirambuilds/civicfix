import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';

const apiRouter = Router();

// Mount health routes at /api/health
apiRouter.use('/', healthRoutes);

// Mount authentication routes at /api/auth
apiRouter.use('/auth', authRoutes);

export default apiRouter;
