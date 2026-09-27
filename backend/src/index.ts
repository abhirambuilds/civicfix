import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRouter from './routes/index.js';
import { sendSuccess } from './utils/apiResponse.js';

export const app: Express = express();

// Security and utility middlewares
app.use(
  cors({
    origin: [config.frontendUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Root landing endpoint
app.get('/', (_req: Request, res: Response) => {
  sendSuccess(res, {
    service: 'CivicFix API Server',
    tagline: 'Report. Track. Resolve.',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// Mount API router
app.use('/api', apiRouter);

// Fallthrough 404 handler
app.use(notFound);

// Central error handler
app.use(errorHandler);

// Start server if executed directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`[CivicFix Backend] Server running on port ${config.port} (${config.env})`);
    console.log(`[CivicFix Backend] Health check: http://localhost:${config.port}/api/health`);
  });
}
