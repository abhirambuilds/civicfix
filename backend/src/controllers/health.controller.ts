import { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse.js';
import { config } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  let databaseStatus: 'connected' | 'disconnected' | 'not_configured' = 'not_configured';

  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
    try {
      // Execute a quick ping query with a short timeout
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database ping timeout')), 2500)
        ),
      ]);
      databaseStatus = 'connected';
    } catch {
      databaseStatus = 'disconnected';
    }
  }

  sendSuccess(
    res,
    {
      status: databaseStatus === 'disconnected' ? 'degraded' : 'healthy',
      service: 'civicfix-backend',
      version: '1.0.0',
      environment: config.env,
      database: databaseStatus,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    databaseStatus === 'disconnected'
      ? 'CivicFix backend service operational (database disconnected)'
      : 'CivicFix backend service operational'
  );
}
