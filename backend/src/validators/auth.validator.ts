import { z } from 'zod';

/**
 * Registration request validation schema.
 * Rejects administrative role/organization injections from public clients.
 */
export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .min(2, 'Name must be at least 2 characters long')
      .max(100, 'Name cannot exceed 100 characters'),
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .toLowerCase()
      .email('Please provide a valid email address')
      .max(255, 'Email cannot exceed 255 characters'),
    password: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Password must be at least 8 characters long')
      .max(128, 'Password cannot exceed 128 characters'),
    // Disallow administrative privilege injection
    role: z.unknown().optional(),
    organizationId: z.unknown().optional(),
    departmentId: z.unknown().optional(),
    permissions: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Public registration cannot specify user roles. Administrative roles are assigned by system administrators.',
        path: ['role'],
      });
    }
    if (data.organizationId !== undefined || data.departmentId !== undefined || data.permissions !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Organization, department, and permissions cannot be specified during public registration.',
        path: ['organization'],
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Login request validation schema.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .toLowerCase()
    .email('Please provide a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
