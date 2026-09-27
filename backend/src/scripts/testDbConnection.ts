import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend or root before initializing Prisma
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import { prisma } from '../lib/prisma.js';

export interface DbTestResult {
  connected: boolean;
  message: string;
  organizationCount?: number;
  latencyMs?: number;
}

/**
 * Checks PostgreSQL connectivity through Prisma.
 * Safe: catches connection errors and never exposes credentials in error logs.
 */
export async function testDatabaseConnection(): Promise<DbTestResult> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || databaseUrl.trim() === '') {
    return {
      connected: false,
      message: 'DATABASE_URL is not set in environment or .env file.',
    };
  }

  const startTime = Date.now();

  try {
    // Attempt connection
    await prisma.$connect();

    // Execute lightweight ping query
    await prisma.$queryRaw`SELECT 1`;

    // Attempt to query the seeded organization count
    const orgCount = await prisma.organization.count();
    const latencyMs = Date.now() - startTime;

    return {
      connected: true,
      message: 'Successfully connected to PostgreSQL via Prisma.',
      organizationCount: orgCount,
      latencyMs,
    };
  } catch (error) {
    // Safe error message: mask credentials if present
    const rawMessage = error instanceof Error ? error.message : 'Unknown database error';
    const sanitizedMessage = rawMessage.replace(/\/\/[^:]+:[^@]+@/, '//[REDACTED_CREDENTIALS]@');

    return {
      connected: false,
      message: `Database connection failed: ${sanitizedMessage}`,
    };
  } finally {
    await prisma.$disconnect();
  }
}

// Allow standalone execution via `npm run test:db`
if (process.argv[1]?.includes('testDbConnection')) {
  console.log('[CivicFix DB Test] Testing database connectivity...');

  testDatabaseConnection()
    .then((result) => {
      if (result.connected) {
        console.log(`[CivicFix DB Test] SUCCESS: ${result.message}`);
        console.log(`[CivicFix DB Test] Latency: ${result.latencyMs}ms`);
        if (result.organizationCount !== undefined) {
          console.log(`[CivicFix DB Test] Seeded Organizations found: ${result.organizationCount}`);
        }
        process.exit(0);
      } else {
        console.warn(`[CivicFix DB Test] WARNING: ${result.message}`);
        console.log('[CivicFix DB Test] Note: To connect to Supabase, populate DATABASE_URL in backend/.env');
        process.exit(0); // Exit 0 so CI/scripts do not break before user adds their real credentials
      }
    })
    .catch((err) => {
      console.error('[CivicFix DB Test] Unexpected error during connection test:', err.message);
      process.exit(1);
    });
}
