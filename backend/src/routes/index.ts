import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import rbacTestRoutes from './rbacTest.routes.js';
import organizationRoutes from './organization.routes.js';
import issueRouter from './issue.routes.js';
import { listCategoriesHandler } from '../controllers/issue.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const apiRouter = Router();

// Mount health routes at /api/health
apiRouter.use('/', healthRoutes);

// Mount authentication routes at /api/auth
apiRouter.use('/auth', authRoutes);

// Mount RBAC testing routes at /api/auth/test (for development & verification)
apiRouter.use('/auth/test', rbacTestRoutes);

// Mount organization management routes at /api/organizations
apiRouter.use('/organizations', organizationRoutes);

// Mount core civic issue routes at /api/issues
apiRouter.use('/issues', issueRouter);

// Mount active issue categories endpoint at /api/issue-categories
apiRouter.get('/issue-categories', requireAuth, listCategoriesHandler);

export default apiRouter;
