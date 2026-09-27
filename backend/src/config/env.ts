import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend folder or root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  frontendUrl: string;
}

export const config: AppConfig = {
  env: (process.env.NODE_ENV as AppConfig['env']) || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};
