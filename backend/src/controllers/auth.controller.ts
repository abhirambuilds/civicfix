import { Request, Response, NextFunction } from 'express';
import { registerUser, loginUser, getCurrentUser } from '../services/auth.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * Handles public user registration (POST /api/auth/register).
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await registerUser(req.body);

    if (!result.success) {
      sendError(res, result.error || 'Registration failed', result.statusCode || 400);
      return;
    }

    sendSuccess(
      res,
      { user: result.data },
      'Registration successful',
      201
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Handles user login (POST /api/auth/login).
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await loginUser(req.body);

    if (!result.success) {
      sendError(res, result.error || 'Login failed', result.statusCode || 401);
      return;
    }

    sendSuccess(res, result.data, 'Login successful', 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles current user profile retrieval (GET /api/auth/me).
 * Identity is strictly derived from verified JWT (req.user).
 */
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await getCurrentUser(req.user.id);

    if (!result.success) {
      sendError(res, result.error || 'User not found.', result.statusCode || 401);
      return;
    }

    sendSuccess(res, { user: result.data }, 'Current user profile retrieved', 200);
  } catch (error) {
    next(error);
  }
}
