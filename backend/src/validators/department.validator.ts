import { z } from 'zod';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createDepartmentSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Department name must be at least 2 characters long')
      .max(255, 'Department name cannot exceed 255 characters'),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional()
      .nullable(),
    code: z
      .string()
      .trim()
      .max(50, 'Department code cannot exceed 50 characters')
      .optional()
      .nullable(),
  })
  .strict();

export const updateDepartmentSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Department name must be at least 2 characters long')
      .max(255, 'Department name cannot exceed 255 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional()
      .nullable(),
    code: z
      .string()
      .trim()
      .max(50, 'Department code cannot exceed 50 characters')
      .optional()
      .nullable(),
  })
  .strict();

export const updateDeptStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export const addDeptMemberSchema = z
  .object({
    userId: z
      .string()
      .regex(UUID_REGEX, 'userId must be a valid UUID'),
    roleInDepartment: z
      .string()
      .trim()
      .min(1, 'roleInDepartment cannot be empty')
      .max(100, 'roleInDepartment cannot exceed 100 characters')
      .optional()
      .default('STAFF'),
  })
  .strict();

export const updateDeptMemberSchema = z
  .object({
    roleInDepartment: z
      .string()
      .trim()
      .min(1, 'roleInDepartment cannot be empty')
      .max(100, 'roleInDepartment cannot exceed 100 characters')
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type UpdateDeptStatusInput = z.infer<typeof updateDeptStatusSchema>;
export type AddDeptMemberInput = z.infer<typeof addDeptMemberSchema>;
export type UpdateDeptMemberInput = z.infer<typeof updateDeptMemberSchema>;
