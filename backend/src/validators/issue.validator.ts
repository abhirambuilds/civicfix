import { z } from 'zod';
import { IssueStatus, IssuePriority } from '@prisma/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createIssueSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(5, 'Issue title must be at least 5 characters long')
      .max(200, 'Issue title cannot exceed 200 characters'),
    description: z
      .string()
      .trim()
      .min(10, 'Issue description must be at least 10 characters long')
      .max(3000, 'Issue description cannot exceed 3000 characters'),
    categoryId: z
      .string()
      .regex(UUID_REGEX, 'categoryId must be a valid UUID'),
    latitude: z
      .number()
      .min(-90, 'latitude must be between -90 and 90')
      .max(90, 'latitude must be between -90 and 90'),
    longitude: z
      .number()
      .min(-180, 'longitude must be between -180 and 180')
      .max(180, 'longitude must be between -180 and 180'),
    locationLabel: z.string().trim().max(300, 'locationLabel cannot exceed 300 characters').optional().nullable(),
    address: z.string().trim().max(500, 'address cannot exceed 500 characters').optional().nullable(),
    landmark: z.string().trim().max(300, 'landmark cannot exceed 300 characters').optional().nullable(),
    organizationId: z.string().regex(UUID_REGEX, 'organizationId must be a valid UUID').optional().nullable(),
    priority: z.nativeEnum(IssuePriority).optional().nullable(),
  })
  .strict();

export const issueQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    categoryId: z.string().regex(UUID_REGEX, 'categoryId must be a valid UUID').optional(),
    status: z.nativeEnum(IssueStatus).optional(),
    priority: z.nativeEnum(IssuePriority).optional(),
    organizationId: z.string().regex(UUID_REGEX, 'organizationId must be a valid UUID').optional(),
    departmentId: z.string().regex(UUID_REGEX, 'departmentId must be a valid UUID').optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['createdAt', 'updatedAt', 'title', 'status', 'priority']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  });

export const createCommentSchema = z
  .object({
    content: z.string().trim().min(1, 'Comment content cannot be empty').max(2000, 'Comment cannot exceed 2000 characters').optional(),
    commentText: z.string().trim().min(1, 'Comment text cannot be empty').max(2000, 'Comment cannot exceed 2000 characters').optional(),
    isInternal: z.boolean().default(false).optional(),
  })
  .refine((data) => Boolean((data.content && data.content.length > 0) || (data.commentText && data.commentText.length > 0)), {
    message: 'Comment content is required and cannot be empty',
    path: ['content'],
  })
  .strict();

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type IssueQueryInput = z.infer<typeof issueQuerySchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
