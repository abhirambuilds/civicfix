import { Router } from 'express';
import healthRoutes from './health.routes.js';

const apiRouter = Router();

// Mount health routes at /api/health
apiRouter.use('/', healthRoutes);

export default apiRouter;
