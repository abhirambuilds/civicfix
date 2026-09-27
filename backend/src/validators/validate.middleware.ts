import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/apiResponse.js';

/**
 * Express middleware generator that validates and normalizes req.body using a Zod schema.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const error = result.error as ZodError;
      const firstIssue = error.issues[0];
      const message = firstIssue ? firstIssue.message : 'Invalid request payload';

      sendError(res, message, 400);
      return;
    }

    // Assign sanitized & normalized data back to req.body
    req.body = result.data;
    next();
  };
}

export const validate = validateBody;

