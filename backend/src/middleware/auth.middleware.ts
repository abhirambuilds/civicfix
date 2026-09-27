import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../services/auth.service.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * Authentication middleware that verifies the Bearer JWT token from the Authorization header.
 * Attaches the verified user payload (id, role) to req.user.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'Authentication required. Missing or malformed Bearer token.', 401);
    return;
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    sendError(res, 'Authentication required. Token is empty.', 401);
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
    };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      sendError(res, 'Authentication token has expired. Please log in again.', 401);
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      sendError(res, 'Invalid authentication token.', 401);
      return;
    }

    sendError(res, 'Authentication failed.', 401);
  }
}
