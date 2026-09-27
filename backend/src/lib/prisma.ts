import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var globalPrisma: PrismaClient | undefined;
}

/**
 * Singleton PrismaClient instance.
 * Reuses existing connection during development hot-reloads (tsx/watch)
 * to prevent exhausting PostgreSQL connection pools.
 */
export const prisma: PrismaClient =
  globalThis.globalPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.globalPrisma = prisma;
}

export default prisma;
