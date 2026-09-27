import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import rbacTestRoutes from './rbacTest.routes.js';
import organizationRoutes from './organization.routes.js';

const apiRouter = Router();

// Mount health routes at /api/health
apiRouter.use('/', healthRoutes);

// Mount authentication routes at /api/auth
apiRouter.use('/auth', authRoutes);

// Mount RBAC testing routes at /api/auth/test (for development & verification)
apiRouter.use('/auth/test', rbacTestRoutes);

// Mount organization management routes at /api/organizations
apiRouter.use('/organizations', organizationRoutes);

export default apiRouter;
