import { z } from 'zod';
import { OrganizationType, OrgMemberRole } from '@prisma/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createOrganizationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Organization name must be at least 2 characters long')
      .max(255, 'Organization name cannot exceed 255 characters'),
    description: z.string().trim().max(1000, 'Description cannot exceed 1000 characters').optional(),
    orgType: z
      .nativeEnum(OrganizationType)
      .optional()
      .default(OrganizationType.OTHER),
  })
  .strict();

export const updateOrganizationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Organization name must be at least 2 characters long')
      .max(255, 'Organization name cannot exceed 255 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional()
      .nullable(),
    orgType: z
      .nativeEnum(OrganizationType)
      .optional(),
  })
  .strict();

export const updateOrgStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export const addMemberSchema = z
  .object({
    userId: z
      .string()
      .regex(UUID_REGEX, 'userId must be a valid UUID'),
    role: z.nativeEnum(OrgMemberRole),
  })
  .strict();

export const updateMemberSchema = z
  .object({
    role: z
      .nativeEnum(OrgMemberRole)
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type UpdateOrgStatusInput = z.infer<typeof updateOrgStatusSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
