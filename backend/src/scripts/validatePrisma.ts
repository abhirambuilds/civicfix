import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend or workspace root if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

// Provide safe fallback environment variables for offline/CI schema validation
const env = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== ''
      ? process.env.DATABASE_URL
      : 'postgresql://postgres:postgres@localhost:5432/civicfix?schema=public',
  DIRECT_URL:
    process.env.DIRECT_URL && process.env.DIRECT_URL.trim() !== ''
      ? process.env.DIRECT_URL
      : 'postgresql://postgres:postgres@localhost:5432/civicfix?schema=public',
};

try {
  execSync('npx prisma validate', { stdio: 'inherit', env });
} catch (error) {
  process.exit(1);
}
