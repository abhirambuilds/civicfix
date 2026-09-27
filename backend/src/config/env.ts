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
}

export const config: AppConfig = {
  env: (process.env.NODE_ENV as AppConfig['env']) || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || '',
  directUrl: process.env.DIRECT_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'civicfix-dev-jwt-secret-do-not-use-in-production-change-in-env',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
};
