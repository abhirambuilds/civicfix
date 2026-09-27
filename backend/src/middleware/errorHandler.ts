import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiResponse.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Unhandled Application Error:', err);
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Unknown error occurred';

  sendError(res, message, 500);
}
