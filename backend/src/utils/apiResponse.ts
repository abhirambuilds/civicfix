import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp: string;
}

export function sendSuccess<T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode = 200
): void {
  const response: ApiResponse<T> = {
    success: true,
    ...(message ? { message } : {}),
    ...(data !== undefined ? { data } : {}),
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  error: string,
  statusCode = 500
): void {
  const response: ApiResponse<null> = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(response);
}
