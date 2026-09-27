import { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse.js';
import { config } from '../config/env.js';

export function getHealth(_req: Request, res: Response): void {
  sendSuccess(
    res,
    {
      status: 'healthy',
      service: 'civicfix-backend',
      version: '1.0.0',
      environment: config.env,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    'CivicFix backend service operational'
  );
}
