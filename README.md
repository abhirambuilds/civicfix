# CivicFix

> **Report. Track. Resolve.**  
> *AI-Assisted Local Issue Reporting and Resolution Platform*

---

## 1. What CivicFix Is

**CivicFix** is an AI-assisted neighborhood and campus issue reporting and resolution platform. It connects citizens and students directly with responsible administrative departments to streamline the lifecycle of civic issues—from reporting with photos, category, and geolocation, to automated routing, triage, departmental assignment, priority handling, and resolution tracking.

---

## 2. Current Round 1 Scope

For the Round 1 hackathon evaluation, the platform fulfills the official **Neighborhood Issue Reporter** requirements:

- **Citizen / Student Reporting:**
  - Issue description
  - Issue category selection
  - Geolocation (GPS with manual map pin adjustment)
  - Photo attachment (stored in Supabase Storage)
- **Authority / Admin Management:**
  - Status progression (`REPORTED` &rarr; `UNDER_REVIEW` &rarr; `ASSIGNED` &rarr; `IN_PROGRESS` &rarr; `RESOLVED` &rarr; `CLOSED`)
  - Priority assignment (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
  - Official administrative remarks and public resolution notes
- **Analytics & Dashboards:**
  - Real-time aggregation of issue counts categorized by **category** and **status**
- **Round 1 Seeded Tenant:**
  - **SRM Campus Administration** is the single active seeded organization.
  - The architecture treats SRM strictly as a **data record**, never hardcoding SRM-specific conditions into the core schema or business logic.

---

## 3. Multi-Organization Architecture

CivicFix is architected from the ground up as a multi-tenant platform:

```
Platform (CivicFix)
  └── Organization (e.g., SRM Campus Administration, City Municipality)
        ├── Service Area (Geographic boundaries / Polygon coordinates / Bounding Box)
        ├── Departments (Civil, Electrical, Sanitation, Water, Maintenance)
        ├── Members & Staff (Admins, Department Leads, Field Technicians)
        ├── Routing Rules (Category/Keyword/Priority to Department mappings)
        └── Issues (Submitted reports, audit logs, comments, status history)
```

### Automatic Organization Routing
Reporters **do not manually select an organization**. The backend routing engine resolves organization ownership dynamically:
1. **Location Resolution:** The reported GPS coordinates are evaluated against organization service areas (using bounding box index filtering and GeoJSON boundary evaluation).
2. **Deterministic Department Routing:** Issue category, keywords, and routing rules assign the ticket to the appropriate internal department.
3. **Round 1 Behavior:** Any issue located within the SRM Campus service area automatically resolves to SRM Campus Administration.

---

## 4. Three Dashboard Contexts

CivicFix separates responsibilities into three distinct dashboard contexts:

| Dashboard Context | Target Role | Key Responsibilities |
|---|---|---|
| **Platform Admin Dashboard** | Platform Superadmins (`PLATFORM_ADMIN`) | Manage organizations, activate/deactivate tenants, configure platform-level routing rules, global analytics. |
| **Citizen / Student Dashboard** | Public Users & Students (`USER`) | Submit new issues (with photo, description, map marker), track reported issues in real time, view official status changes and resolution notes. |
| **Organization Dashboard** | Campus & Municipal Staff (`ORG_ADMIN`, `MANAGER`, `STAFF`) | Triage issues, assign priority and internal departments, reassign staff, add administrative remarks, update status, view department-level analytics. |

---

## 5. Technology Stack

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Maps:** Leaflet & OpenStreetMap *(to be integrated in subsequent prompts)*
- **Charts:** Recharts *(to be integrated in subsequent prompts)*

### Backend
- **Runtime:** Node.js
- **Server Framework:** Express.js
- **Language:** TypeScript (strict mode, NodeNext module resolution)
- **Architecture:** Controller-Service-Repository pattern with structured REST API endpoints

### Database & Storage
- **Database:** Supabase PostgreSQL
- **ORM:** Prisma ORM *(configured in Prompt 3)*
- **File Storage:** Supabase Storage (`issue-images` bucket for photographic evidence)

### Authentication & Security
- **Authentication:** Custom JWT authentication with bcrypt password hashing *(not Supabase Auth)*
- **Security:** CORS configuration, input sanitization, parameterized queries

### Runtime Validation
- **Validation:** Zod (runtime request payload validation)

### AI Intelligence Integrations *(Asynchronous enhancement)*
- **Groq API:** Fast LLaMA inference for issue summarization, category validation, keyword extraction, and preliminary severity estimation.
- **Gemini API:** Image verification to validate photo relevance and detect spam or inappropriate content.
- *Reliability Rule:* AI is strictly an enhancement. If AI services are unavailable or rate-limited, issue creation and routing complete deterministically without failure.

---

## 6. Database Architecture & Schema Overview

The database schema is defined in [supabase/schema.sql](file:///c:/Projects/CivicFix/supabase/schema.sql). It is 100% idempotent, Prisma-friendly, and strictly typed.

### 6.1 Database Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ organization_members : "belongs to"
    users ||--o{ department_members : "assigned to"
    users ||--o{ issues : "reports"
    users ||--o{ issue_comments : "writes"
    users ||--o{ issue_status_history : "updates"
    users ||--o{ notifications : "receives"

    organizations ||--o{ organization_members : "has"
    organizations ||--o{ departments : "contains"
    organizations ||--o{ organization_service_areas : "defines"
    organizations ||--o{ issue_categories : "configures"
    organizations ||--o{ routing_rules : "configures"
    organizations ||--o{ issues : "manages"

    departments ||--o{ department_members : "staffs"
    departments ||--o{ routing_rules : "targets"
    departments ||--o{ issue_assignments : "assigned"

    issue_categories ||--o{ routing_rules : "triggers"
    issue_categories ||--o{ issues : "classifies"

    issues ||--|| issue_locations : "located at"
    issues ||--o{ issue_images : "evidenced by"
    issues ||--o{ issue_assignments : "delegated via"
    issues ||--o{ issue_comments : "annotated with"
    issues ||--o{ issue_status_history : "tracks"
    issues ||--o{ ai_analyses : "processed by"
    issues ||--o{ notifications : "generates"
```

### 6.2 Database Entities Summary (16 Tables)

| # | Table Name | Purpose | Primary Keys & Core Relations |
|---|---|---|---|
| 1 | `users` | User credentials, roles, and status | `id` (UUID), `email` (UNIQUE), `role` (`user_role`) |
| 2 | `organizations` | Tenant organizations (Universities, Municipalities) | `id` (UUID), `name` (UNIQUE), `slug` (UNIQUE) |
| 3 | `organization_members` | User-to-organization membership mappings | `(organization_id, user_id)` (UNIQUE) |
| 4 | `departments` | Operational branches (Civil, Electrical, etc.) | `id` (UUID), `(organization_id, name)` (UNIQUE) |
| 5 | `department_members` | Staff assignments within departments | `(department_id, user_id)` (UNIQUE) |
| 6 | `issue_categories` | Configurable issue categories & defaults | `id` (UUID), `(organization_id, slug)` (UNIQUE) |
| 7 | `organization_service_areas` | Geographic service boundaries for automated routing | `id` (UUID), Bounding box + GeoJSON polygon in JSONB |
| 8 | `routing_rules` | Deterministic rules mapping categories & keywords to depts | `id` (UUID), `(organization_id, rule_order)` |
| 9 | `issues` | Core ticket record (lifecycle, priority, status) | `id` (UUID), `issue_number` (UNIQUE), `status`, `priority` |
| 10 | `issue_locations` | Issue GPS coordinates and optional address | `id` (UUID), `issue_id` (1-to-1 UNIQUE), `lat`, `lon` |
| 11 | `issue_images` | References to photographic evidence in Supabase Storage | `id` (UUID), `issue_id`, `storage_path` |
| 12 | `issue_assignments` | Assignment history to departments and staff members | `id` (UUID), `issue_id`, `department_id`, `assigned_user_id` |
| 13 | `issue_comments` | Internal staff remarks and public resolution notes | `id` (UUID), `issue_id`, `author_id`, `is_internal` |
| 14 | `issue_status_history` | Immutable audit trail of every status transition | `id` (UUID), `issue_id`, `previous_status`, `new_status` |
| 15 | `ai_analyses` | Asynchronous AI results (Intelligence, Routing, Verification) | `id` (UUID), `issue_id`, `agent_type`, `structured_result` |
| 16 | `notifications` | In-app user notifications for issue lifecycle events | `id` (UUID), `recipient_id`, `issue_id`, `notification_type` |

### 6.3 Enums
- `user_role`: `PLATFORM_ADMIN`, `ORG_OWNER`, `ORG_ADMIN`, `MANAGER`, `STAFF`, `USER`
- `organization_type`: `UNIVERSITY`, `MUNICIPALITY`, `CORPORATION`, `RESIDENTIAL_ASSOCIATION`, `OTHER`
- `org_member_role`: `OWNER`, `ADMIN`, `MANAGER`, `STAFF`, `MEMBER`
- `issue_status`: `REPORTED`, `UNDER_REVIEW`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`
- `issue_priority`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- `boundary_type`: `POLYGON`, `BOUNDING_BOX`, `RADIUS`
- `ai_agent_type`: `ISSUE_INTELLIGENCE`, `SMART_ROUTING`, `DUPLICATE_DETECTION`, `IMAGE_VERIFICATION`
- `ai_analysis_status`: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`
- `notification_type`: `ISSUE_CREATED`, `ISSUE_ASSIGNED`, `STATUS_CHANGED`, `REMARK_ADDED`, `ISSUE_RESOLVED`

### 6.4 Geographic Boundary Architecture (Practical Hybrid Approach)
`organization_service_areas` utilizes a practical hybrid spatial structure:
1. **Bounding Box (`min_latitude`, `max_latitude`, `min_longitude`, `max_longitude`):** Enables ultra-fast B-Tree indexed pre-filtering in standard SQL queries (`WHERE :lat BETWEEN min_latitude AND max_latitude AND :lon BETWEEN min_longitude AND max_longitude`).
2. **GeoJSON Geometry (`boundary_geojson JSONB`):** Stores polygon vertices directly in GeoJSON format. This avoids Prisma's `Unsupported("geometry")` friction, directly integrates with Leaflet maps on the frontend (`L.geoJSON`), and allows server-side point-in-polygon ray-casting.
3. **PostGIS Compatibility:** The schema safely enables PostGIS (`CREATE EXTENSION IF NOT EXISTS "postgis"`), allowing PostGIS spatial functions (`ST_Contains`, `ST_GeomFromGeoJSON`) to be layered on without requiring it as an absolute dependency.

---

## 7. Supabase Setup & Execution Instructions

### 7.1 How to Apply `supabase/schema.sql`
1. Navigate to your [Supabase Project Dashboard](https://supabase.com/dashboard).
2. In the left navigation bar, click on **SQL Editor**.
3. Click **+ New Query**.
4. Copy the entire contents of [supabase/schema.sql](file:///c:/Projects/CivicFix/supabase/schema.sql).
5. Paste into the query editor and click **Run**.
6. The query will create all enums, tables, composite indexes, `updated_at` triggers, the `issue-images` storage bucket, and seed initial data for **SRM Campus Administration**.

### 7.2 Supabase Storage Configuration
- **Bucket Name:** `issue-images`
- **Visibility:** Private (`public = false`)
- **File Size Limit:** 10MB (`10485760` bytes)
- **Allowed MIME Types:** `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- **Security & Authorization Model:**
  CivicFix utilizes custom JWT authentication managed by the Node/Express backend rather than Supabase Auth (GoTrue). Image uploads and access are mediated by the backend using the Supabase Service Role Key to generate time-limited signed URLs or direct streaming uploads. This ensures strict role-based access control without exposing client-side Supabase keys.

### 7.3 Seed Data (Round 1 Focus)
The SQL script seeds the following initial records with deterministic UUIDs:
- **Organization:** `SRM Campus Administration` (Type: `UNIVERSITY`, ID: `a0000000-0000-0000-0000-000000000001`)
- **Departments (5):**
  1. `Civil / Infrastructure` (`CIVIL`)
  2. `Electrical` (`ELECTRICAL`)
  3. `Sanitation & Waste` (`SANITATION`)
  4. `Water & Drainage` (`WATER`)
  5. `General Maintenance` (`MAINTENANCE`)
- **Issue Categories (7):**
  1. `Pothole / Road` (Priority: `HIGH`)
  2. `Streetlight` (Priority: `MEDIUM`)
  3. `Waste` (Priority: `MEDIUM`)
  4. `Water Leakage` (Priority: `HIGH`)
  5. `Electrical` (Priority: `CRITICAL`)
  6. `Infrastructure` (Priority: `MEDIUM`)
  7. `Other` (Priority: `LOW`)
- **Service Area:** SRM Kattankulathur Campus (Bounding box + GeoJSON Polygon)
- **Routing Rules (7):** Configured to route each seeded category directly to its respective department.
- *Security Note:* User accounts and passwords are **NOT** seeded in the SQL script. Admin and user accounts will be seeded through secure hashing scripts in subsequent prompts.

---

## 8. Development Commands

### Root Workspace Commands
From the project root (`c:\Projects\CivicFix`):

```bash
# Run both checks across frontend and backend (typecheck & builds)
npm run check

# Start Backend Development Server (Port 5000)
npm run dev:backend

# Start Frontend Development Server (Port 3000)
npm run dev:frontend

# Build Backend TypeScript
npm run build:backend

# Build Frontend Next.js
npm run build:frontend

# Typecheck Backend
npm run typecheck:backend

# Lint Frontend
npm run lint:frontend
```

---

## 9. Environment Variables Template

Copy `.env.example` to `.env` (backend) and `frontend/.env.local` (frontend):

```env
# Application Environment
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Database (Supabase PostgreSQL via Prisma)
DATABASE_URL=
DIRECT_URL=

# Supabase Storage & Services
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Authentication (Custom JWT + bcrypt)
JWT_SECRET=
JWT_EXPIRES_IN=7d

# AI Intelligence Integrations
GROQ_API_KEY=
GEMINI_API_KEY=
```

---

## 10. Implementation Roadmap & Deferred Scope

| Phase | Status | Focus |
|---|---|---|
| **Prompt 1: Project Foundation** | &check; Complete | Directory structure, Express backend, Next.js frontend, branding, health check |
| **Prompt 2: Database Schema** | &check; Complete | Supabase PostgreSQL schema, 16 tables, 9 enums, 36 indexes, storage bucket, seed data |
| **Prompt 3: Prisma ORM Integration** | Upcoming | Prisma schema generation, database connection, client models, migration setup |
| **Prompt 4: Authentication & Users** | Upcoming | Custom JWT auth, bcrypt password hashing, login/register, role authorization |
| **Prompt 5: Issue APIs & Storage** | Upcoming | Issue creation, Supabase Storage uploads, Leaflet geocoding, triage endpoints |
| **Prompt 6: AI Intelligence Agent** | Upcoming | Groq & Gemini asynchronous analysis, smart routing, duplicate detection |
| **Prompt 7: Dashboards & UI** | Upcoming | Citizen reporter UI, Organization Admin dashboard, Platform Admin dashboard |
