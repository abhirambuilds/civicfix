-- ==============================================================================
-- CivicFix - Supabase Database Schema & Setup
-- Note: Database models and relations will be initialized in subsequent prompts.
-- This file serves as the SQL entry point for Supabase-specific extensions/functions.
-- ==============================================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PostGIS extension for spatial queries (to support geospatial boundary routing)
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Future schema definitions, RLS policies, and triggers will be added here
-- or managed via Prisma migrations.
