-- ==============================================================================
-- CivicFix - Complete Supabase PostgreSQL Schema
-- Platform: AI-Assisted Local Issue Reporting and Resolution Platform
-- Scope: Multi-Organization Architecture (Round 1 Seed: SRM Campus Administration)
--
-- How to apply:
-- 1. Open Supabase Dashboard -> SQL Editor
-- 2. Paste and run this script.
-- 3. Idempotent: Uses IF NOT EXISTS, DO NOTHING, and deterministic seed UUIDs.
-- ==============================================================================

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- PostGIS extension (enabled if supported by hosting environment)
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ==============================================================================
-- 2. ENUMS
-- ==============================================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'PLATFORM_ADMIN',
        'ORG_OWNER',
        'ORG_ADMIN',
        'MANAGER',
        'STAFF',
        'USER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE organization_type AS ENUM (
        'UNIVERSITY',
        'MUNICIPALITY',
        'CORPORATION',
        'RESIDENTIAL_ASSOCIATION',
        'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE org_member_role AS ENUM (
        'OWNER',
        'ADMIN',
        'MANAGER',
        'STAFF',
        'MEMBER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE issue_status AS ENUM (
        'REPORTED',
        'UNDER_REVIEW',
        'ASSIGNED',
        'IN_PROGRESS',
        'RESOLVED',
        'CLOSED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE issue_priority AS ENUM (
        'LOW',
        'MEDIUM',
        'HIGH',
        'CRITICAL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE boundary_type AS ENUM (
        'POLYGON',
        'BOUNDING_BOX',
        'RADIUS'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ai_agent_type AS ENUM (
        'ISSUE_INTELLIGENCE',
        'SMART_ROUTING',
        'DUPLICATE_DETECTION',
        'IMAGE_VERIFICATION'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ai_analysis_status AS ENUM (
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'ISSUE_CREATED',
        'ISSUE_ASSIGNED',
        'STATUS_CHANGED',
        'REMARK_ADDED',
        'ISSUE_RESOLVED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 3. UPDATED_AT TRIGGER FUNCTION
-- ==============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 4. ENTITY TABLES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 4.1 USERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'USER',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4.2 ORGANIZATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    org_type organization_type NOT NULL DEFAULT 'OTHER',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4.3 ORGANIZATION MEMBERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_role org_member_role NOT NULL DEFAULT 'MEMBER',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_organization_members UNIQUE (organization_id, user_id)
);

-- ------------------------------------------------------------------------------
-- 4.4 DEPARTMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_department_name_per_org UNIQUE (organization_id, name)
);

-- ------------------------------------------------------------------------------
-- 4.5 DEPARTMENT MEMBERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS department_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_in_department VARCHAR(100) DEFAULT 'STAFF',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_department_members UNIQUE (department_id, user_id)
);

-- ------------------------------------------------------------------------------
-- 4.6 ISSUE CATEGORIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    default_priority issue_priority NOT NULL DEFAULT 'MEDIUM',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4.7 ORGANIZATION SERVICE AREAS
-- ------------------------------------------------------------------------------
-- Practical hybrid spatial design:
-- 1. Bounding box coordinates for ultra-fast indexed pre-filtering
-- 2. Center/radius for circular area representation
-- 3. GeoJSON polygon data in JSONB for direct Leaflet consumption & ray-casting
CREATE TABLE IF NOT EXISTS organization_service_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    boundary_type boundary_type NOT NULL DEFAULT 'POLYGON',
    min_latitude DOUBLE PRECISION,
    max_latitude DOUBLE PRECISION,
    min_longitude DOUBLE PRECISION,
    max_longitude DOUBLE PRECISION,
    center_latitude DOUBLE PRECISION,
    center_longitude DOUBLE PRECISION,
    radius_km DOUBLE PRECISION,
    boundary_geojson JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4.8 ROUTING RULES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS routing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES issue_categories(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    override_priority issue_priority,
    keywords TEXT[],
    rule_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4.9 ISSUES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_number VARCHAR(50) NOT NULL UNIQUE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    category_id UUID NOT NULL REFERENCES issue_categories(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status issue_status NOT NULL DEFAULT 'REPORTED',
    priority issue_priority NOT NULL DEFAULT 'MEDIUM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 4.10 ISSUE LOCATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL UNIQUE REFERENCES issues(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    landmark TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4.11 ISSUE IMAGES
-- ------------------------------------------------------------------------------
-- Stores Supabase Storage file references (NOT raw binary data)
CREATE TABLE IF NOT EXISTS issue_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    storage_path VARCHAR(1000) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4.12 ISSUE ASSIGNMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4.13 ISSUE COMMENTS & REMARKS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    comment_text TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4.14 ISSUE STATUS HISTORY (Audit Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    previous_status issue_status,
    new_status issue_status NOT NULL,
    changed_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    remark TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4.15 AI ANALYSES (Asynchronous Intelligence Processing)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    agent_type ai_agent_type NOT NULL,
    status ai_analysis_status NOT NULL DEFAULT 'PENDING',
    model_provider VARCHAR(100),
    model_name VARCHAR(100),
    confidence NUMERIC(5, 4),
    raw_output JSONB,
    structured_result JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Keep existing deployments compatible with the AI analysis updated timestamp.
ALTER TABLE ai_analyses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- 4.16 NOTIFICATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
    notification_type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. INDEXES FOR PERFORMANCE & HIGH QUERY PATTERNS
-- ==============================================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Organizations
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active);

-- Organization Members
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);

-- Departments
CREATE INDEX IF NOT EXISTS idx_departments_org_id ON departments(organization_id);

-- Department Members
CREATE INDEX IF NOT EXISTS idx_dept_members_dept_id ON department_members(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_members_user_id ON department_members(user_id);

-- Issue Categories
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_org_slug ON issue_categories(COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);
CREATE INDEX IF NOT EXISTS idx_categories_org_id ON issue_categories(organization_id);

-- Service Areas
CREATE INDEX IF NOT EXISTS idx_service_areas_org_id ON organization_service_areas(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_areas_bbox ON organization_service_areas(min_latitude, max_latitude, min_longitude, max_longitude);

-- Routing Rules
CREATE INDEX IF NOT EXISTS idx_routing_rules_org_order ON routing_rules(organization_id, rule_order);
CREATE INDEX IF NOT EXISTS idx_routing_rules_category_id ON routing_rules(category_id);
CREATE INDEX IF NOT EXISTS idx_routing_rules_dept_id ON routing_rules(department_id);

-- Issues (Core query patterns)
CREATE INDEX IF NOT EXISTS idx_issues_reporter_id ON issues(reporter_id);
CREATE INDEX IF NOT EXISTS idx_issues_organization_id ON issues(organization_id);
CREATE INDEX IF NOT EXISTS idx_issues_category_id ON issues(category_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_created_at_desc ON issues(created_at DESC);
-- Composite indexes for fast dashboard aggregation queries
CREATE INDEX IF NOT EXISTS idx_issues_org_status ON issues(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_issues_org_category ON issues(organization_id, category_id);

-- Locations
CREATE INDEX IF NOT EXISTS idx_issue_locations_issue_id ON issue_locations(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_locations_lat_lon ON issue_locations(latitude, longitude);

-- Images
CREATE INDEX IF NOT EXISTS idx_issue_images_issue_id ON issue_images(issue_id);

-- Assignments
CREATE INDEX IF NOT EXISTS idx_issue_assignments_issue_id ON issue_assignments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_assignments_dept_id ON issue_assignments(department_id);
CREATE INDEX IF NOT EXISTS idx_issue_assignments_user_id ON issue_assignments(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_issue_assignments_is_active ON issue_assignments(is_active);

-- Comments
CREATE INDEX IF NOT EXISTS idx_issue_comments_issue_created ON issue_comments(issue_id, created_at ASC);

-- Status History
CREATE INDEX IF NOT EXISTS idx_issue_status_history_issue ON issue_status_history(issue_id, created_at ASC);

-- AI Analyses
CREATE INDEX IF NOT EXISTS idx_ai_analyses_issue_id ON ai_analyses(issue_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_agent_status ON ai_analyses(agent_type, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_analyses_issue_agent ON ai_analyses(issue_id, agent_type);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON notifications(recipient_id, is_read, created_at DESC);

-- ==============================================================================
-- 6. ATTACH AUTOMATIC UPDATED_AT TRIGGERS
-- ==============================================================================

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
    CREATE TRIGGER trg_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_organizations_updated_at ON organizations;
    CREATE TRIGGER trg_organizations_updated_at
        BEFORE UPDATE ON organizations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_organization_members_updated_at ON organization_members;
    CREATE TRIGGER trg_organization_members_updated_at
        BEFORE UPDATE ON organization_members
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_departments_updated_at ON departments;
    CREATE TRIGGER trg_departments_updated_at
        BEFORE UPDATE ON departments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_department_members_updated_at ON department_members;
    CREATE TRIGGER trg_department_members_updated_at
        BEFORE UPDATE ON department_members
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_issue_categories_updated_at ON issue_categories;
    CREATE TRIGGER trg_issue_categories_updated_at
        BEFORE UPDATE ON issue_categories
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_service_areas_updated_at ON organization_service_areas;
    CREATE TRIGGER trg_service_areas_updated_at
        BEFORE UPDATE ON organization_service_areas
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_routing_rules_updated_at ON routing_rules;
    CREATE TRIGGER trg_routing_rules_updated_at
        BEFORE UPDATE ON routing_rules
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_issues_updated_at ON issues;
    CREATE TRIGGER trg_issues_updated_at
        BEFORE UPDATE ON issues
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_issue_locations_updated_at ON issue_locations;
    CREATE TRIGGER trg_issue_locations_updated_at
        BEFORE UPDATE ON issue_locations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_issue_assignments_updated_at ON issue_assignments;
    CREATE TRIGGER trg_issue_assignments_updated_at
        BEFORE UPDATE ON issue_assignments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_issue_comments_updated_at ON issue_comments;
    CREATE TRIGGER trg_issue_comments_updated_at
        BEFORE UPDATE ON issue_comments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_ai_analyses_updated_at ON ai_analyses;
    CREATE TRIGGER trg_ai_analyses_updated_at
        BEFORE UPDATE ON ai_analyses
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

-- ==============================================================================
-- 7. SUPABASE STORAGE BUCKET CONFIGURATION
-- ==============================================================================

-- Create the private issue-images bucket for photographic evidence
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'issue-images',
    'issue-images',
    false, -- Private bucket: access controlled through backend-generated signed URLs
    10485760, -- 10MB limit per image
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Storage Security Policy Notice:
-- Because CivicFix utilizes custom JWT authentication managed by the Express backend
-- rather than Supabase Auth (GoTrue), file uploads and reads are routed through the backend
-- via the Supabase Service Role Key or served using time-limited signed URLs generated by
-- the backend. This guarantees authorization without exposing direct public bucket access.

-- ==============================================================================
-- 8. SEED DATA (Round 1 Focus: SRM Campus Administration)
-- ==============================================================================
-- Note: User accounts and passwords are NOT seeded here.
-- All seed IDs utilize deterministic UUIDs for safe idempotent execution.

-- ------------------------------------------------------------------------------
-- 8.1 Seed Organization: SRM Campus Administration
-- ------------------------------------------------------------------------------
INSERT INTO organizations (id, name, slug, description, org_type, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'SRM Campus Administration',
    'srm-campus-admin',
    'Administrative and facilities maintenance authority for SRM Institute of Science and Technology, Kattankulathur Campus.',
    'UNIVERSITY',
    true
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    org_type = EXCLUDED.org_type,
    is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------------------------
-- 8.2 Seed Departments for SRM
-- ------------------------------------------------------------------------------
INSERT INTO departments (id, organization_id, name, code, description, is_active)
VALUES
    (
        'b0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001',
        'Civil / Infrastructure',
        'CIVIL',
        'Responsible for roads, pavements, structural repairs, campus buildings, and civil infrastructure.',
        true
    ),
    (
        'b0000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000001',
        'Electrical',
        'ELECTRICAL',
        'Manages streetlights, outdoor illumination, wiring, transformers, and electrical fixtures.',
        true
    ),
    (
        'b0000000-0000-0000-0000-000000000003',
        'a0000000-0000-0000-0000-000000000001',
        'Sanitation & Waste',
        'SANITATION',
        'Oversees garbage collection, litter management, campus cleanliness, and waste disposal bins.',
        true
    ),
    (
        'b0000000-0000-0000-0000-000000000004',
        'a0000000-0000-0000-0000-000000000001',
        'Water & Drainage',
        'WATER',
        'Handles water pipeline leaks, drinking water stations, storm drains, and sewage infrastructure.',
        true
    ),
    (
        'b0000000-0000-0000-0000-000000000005',
        'a0000000-0000-0000-0000-000000000001',
        'General Maintenance',
        'MAINTENANCE',
        'General campus upkeep, miscellaneous physical requests, and uncategorized issue resolution.',
        true
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------------------------
-- 8.3 Seed Issue Categories
-- ------------------------------------------------------------------------------
INSERT INTO issue_categories (id, organization_id, name, slug, description, icon, default_priority, is_active)
VALUES
    (
        'c0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001',
        'Pothole / Road',
        'pothole-road',
        'Damaged roads, potholes, broken sidewalks, speed bump issues, or dangerous walkway surfaces.',
        'road',
        'HIGH',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000001',
        'Streetlight',
        'streetlight',
        'Non-functional streetlights, flickering outdoor lights, dark pathways, or damaged lampposts.',
        'lightbulb',
        'MEDIUM',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000003',
        'a0000000-0000-0000-0000-000000000001',
        'Waste',
        'waste',
        'Overflowing garbage bins, scattered trash, uncollected debris, or biohazard disposal concerns.',
        'trash',
        'MEDIUM',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000004',
        'a0000000-0000-0000-0000-000000000001',
        'Water Leakage',
        'water-leakage',
        'Burst water pipes, dripping taps, water logging, leaking outdoor pipes, or flooded walkways.',
        'droplet',
        'HIGH',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000005',
        'a0000000-0000-0000-0000-000000000001',
        'Electrical',
        'electrical',
        'Exposed electrical cables, spark hazards, broken switchboards, or power distribution boxes.',
        'zap',
        'CRITICAL',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000006',
        'a0000000-0000-0000-0000-000000000001',
        'Infrastructure',
        'infrastructure',
        'Damaged railings, broken benches, signposts, building cracks, gates, or general physical fixtures.',
        'building',
        'MEDIUM',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000007',
        'a0000000-0000-0000-0000-000000000001',
        'Other',
        'other',
        'General issues that do not fall under conventional categories.',
        'help-circle',
        'LOW',
        true
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    default_priority = EXCLUDED.default_priority,
    is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------------------------
-- 8.4 Seed Service Area: SRM Kattankulathur Campus
-- ------------------------------------------------------------------------------
INSERT INTO organization_service_areas (
    id,
    organization_id,
    name,
    boundary_type,
    min_latitude,
    max_latitude,
    min_longitude,
    max_longitude,
    center_latitude,
    center_longitude,
    radius_km,
    boundary_geojson,
    is_active
)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'SRM Kattankulathur Campus Perimeter',
    'POLYGON',
    12.8150, -- min_latitude
    12.8350, -- max_latitude
    80.0350, -- min_longitude
    80.0550, -- max_longitude
    12.8230, -- center_latitude
    80.0444, -- center_longitude
    2.5,     -- radius_km
    '{
        "type": "Polygon",
        "coordinates": [
            [
                [80.0350, 12.8150],
                [80.0550, 12.8150],
                [80.0550, 12.8350],
                [80.0350, 12.8350],
                [80.0350, 12.8150]
            ]
        ]
    }'::jsonb,
    true
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    boundary_type = EXCLUDED.boundary_type,
    min_latitude = EXCLUDED.min_latitude,
    max_latitude = EXCLUDED.max_latitude,
    min_longitude = EXCLUDED.min_longitude,
    max_longitude = EXCLUDED.max_longitude,
    center_latitude = EXCLUDED.center_latitude,
    center_longitude = EXCLUDED.center_longitude,
    radius_km = EXCLUDED.radius_km,
    boundary_geojson = EXCLUDED.boundary_geojson,
    is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------------------------
-- 8.5 Seed Initial Routing Rules for SRM
-- ------------------------------------------------------------------------------
INSERT INTO routing_rules (
    id,
    organization_id,
    category_id,
    department_id,
    override_priority,
    keywords,
    rule_order,
    is_active
)
VALUES
    -- Pothole / Road -> Civil
    (
        'e0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000001',
        'HIGH',
        ARRAY['pothole', 'road', 'asphalt', 'sidewalk', 'pavement', 'tar'],
        10,
        true
    ),
    -- Streetlight -> Electrical
    (
        'e0000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000002',
        'MEDIUM',
        ARRAY['streetlight', 'lamp', 'dark', 'bulb', 'lighting', 'pole'],
        20,
        true
    ),
    -- Waste -> Sanitation
    (
        'e0000000-0000-0000-0000-000000000003',
        'a0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000003',
        'b0000000-0000-0000-0000-000000000003',
        'MEDIUM',
        ARRAY['garbage', 'waste', 'trash', 'dustbin', 'litter', 'overflow'],
        30,
        true
    ),
    -- Water Leakage -> Water & Drainage
    (
        'e0000000-0000-0000-0000-000000000004',
        'a0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000004',
        'b0000000-0000-0000-0000-000000000004',
        'HIGH',
        ARRAY['leak', 'pipe', 'water', 'flood', 'drain', 'burst'],
        40,
        true
    ),
    -- Electrical -> Electrical
    (
        'e0000000-0000-0000-0000-000000000005',
        'a0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000005',
        'b0000000-0000-0000-0000-000000000002',
        'CRITICAL',
        ARRAY['spark', 'wire', 'shock', 'electric', 'short circuit', 'panel'],
        50,
        true
    ),
    -- Infrastructure -> Civil
    (
        'e0000000-0000-0000-0000-000000000006',
        'a0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000006',
        'b0000000-0000-0000-0000-000000000001',
        'MEDIUM',
        ARRAY['bench', 'wall', 'crack', 'building', 'gate', 'railing', 'structure'],
        60,
        true
    ),
    -- Other -> General Maintenance
    (
        'e0000000-0000-0000-0000-000000000007',
        'a0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000007',
        'b0000000-0000-0000-0000-000000000005',
        'LOW',
        ARRAY['other', 'general', 'misc', 'maintenance'],
        100,
        true
    )
ON CONFLICT (id) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    department_id = EXCLUDED.department_id,
    override_priority = EXCLUDED.override_priority,
    keywords = EXCLUDED.keywords,
    rule_order = EXCLUDED.rule_order,
    is_active = EXCLUDED.is_active;

-- ==============================================================================
-- END OF SCHEMA SCRIPT
-- ==============================================================================
