import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend folder or root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  frontendUrl: string;
  databaseUrl: string;
  directUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  groqApiKey: string;
  groqModel: string;
  groqVisionModel: string;
}

const DEVELOPMENT_JWT_SECRET =
  'civicfix-dev-jwt-secret-do-not-use-in-production-change-in-env';

/**
 * Builds runtime configuration and fails closed for production JWT settings.
 * The development fallback exists only for the repository's offline/mock mode.
 */
export function createAppConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const env = (environment.NODE_ENV as AppConfig['env']) || 'development';
  const configuredJwtSecret = environment.JWT_SECRET?.trim();

  if (
    env === 'production' &&
    (!configuredJwtSecret || configuredJwtSecret === DEVELOPMENT_JWT_SECRET)
  ) {
    throw new Error(
      'JWT_SECRET must be configured with a unique non-development value when NODE_ENV=production.'
    );
  }

  return {
    env,
    port: parseInt(environment.PORT || '5000', 10),
    frontendUrl: environment.FRONTEND_URL || 'http://localhost:3000',
    databaseUrl: environment.DATABASE_URL || '',
    directUrl: environment.DIRECT_URL || '',
    jwtSecret: configuredJwtSecret || DEVELOPMENT_JWT_SECRET,
    jwtExpiresIn: environment.JWT_EXPIRES_IN || '24h',
    supabaseUrl: environment.SUPABASE_URL || '',
    supabaseServiceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY || '',
    groqApiKey: environment.GROQ_API_KEY?.trim() || '',
    groqModel: environment.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
    groqVisionModel: environment.GROQ_VISION_MODEL?.trim() || 'meta-llama/llama-4-scout-17b-16e-instruct',
  };
}

export const config = createAppConfig();
