import { z } from 'zod';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const analyticsQuerySchema = z
  .object({
    timeRange: z.enum(['7', '30', '90', 'all']).default('30'),
    departmentId: z.string().regex(UUID_REGEX, 'departmentId must be a valid UUID').optional(),
    categoryId: z.string().regex(UUID_REGEX, 'categoryId must be a valid UUID').optional(),
  })
  .strict();

export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;
