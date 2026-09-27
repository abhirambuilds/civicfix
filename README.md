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
- **ORM:** Prisma Client v6.19.3
- **Password Hashing:** bcryptjs (work factor 10)
- **Architecture:** Controller-Service-Repository pattern with structured REST API endpoints

### Database & Storage
- **Database:** Supabase PostgreSQL
- **ORM:** Prisma ORM ([backend/prisma/schema.prisma](file:///c:/Projects/CivicFix/backend/prisma/schema.prisma))
- **File Storage:** Supabase Storage (`issue-images` bucket for photographic evidence)

### Authentication & Security
- **Authentication:** Custom JWT authentication with bcrypt password hashing *(not Supabase Auth)*
- **Security:** CORS configuration, input sanitization, parameterized queries, bcrypt password hashing

### Runtime Validation
- **Validation:** Zod (runtime request payload validation)

### AI Intelligence Integrations *(Asynchronous enhancement)*
- **Groq API:** Fast LLaMA inference for issue summarization, category validation, keyword extraction, and preliminary severity estimation.
- **Gemini API:** Image verification to validate photo relevance and detect spam or inappropriate content.
- *Reliability Rule:* AI is strictly an enhancement. If AI services are unavailable or rate-limited, issue creation and routing complete deterministically without failure.

---

## 6. Database Architecture & Schema Overview

The database schema is defined in [supabase/schema.sql](file:///c:/Projects/CivicFix/supabase/schema.sql) and mirrored 1:1 in [backend/prisma/schema.prisma](file:///c:/Projects/CivicFix/backend/prisma/schema.prisma). It is 100% idempotent, Prisma-friendly, and strictly typed.

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

---

## 8. Prisma ORM & Database Access Layer

Prisma operates as the strongly-typed database client connecting the Express.js backend to Supabase PostgreSQL.

### 8.1 Connecting Prisma to Supabase PostgreSQL
1. Create a project in [Supabase](https://supabase.com).
2. Go to **Project Settings** &rarr; **Database** &rarr; **Connection string**.
3. Copy the **Transaction Mode** (pooled) connection string (typically port `6543`) and assign to `DATABASE_URL`.
4. Copy the **Session Mode** (direct) connection string (typically port `5432`) and assign to `DIRECT_URL`.
5. Create `backend/.env` (or copy from `.env.example`) and fill in:
   ```env
   DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
   ```
6. **Safety & Secrets:** Never commit `.env` or paste real credentials into version control. `.gitignore` is configured to prevent credential exposure.

### 8.2 Database Architecture Source of Truth
The canonical source of truth for the database architecture is [supabase/schema.sql](file:///c:/Projects/CivicFix/supabase/schema.sql). 

> [!CAUTION]
> **Do NOT run destructive commands** such as `prisma migrate reset` or `prisma db push --force-reset`.
> The database structure is already established via `supabase/schema.sql`. Prisma maps directly to these tables.

---

## 9. Demo & Development Seed Data

CivicFix includes an automated, **100% idempotent** database seeding script located at [backend/prisma/seed.ts](file:///c:/Projects/CivicFix/backend/prisma/seed.ts). It populates essential reference data, demo users, organization structures, and sample issues for local development.

### 9.1 Password Security Rule
**NEVER store or seed plaintext passwords.**
All seed account passwords are dynamically hashed using `bcryptjs` (10 rounds). The script reads raw passwords from environment variables and refuses to run if any password is missing:

```env
# Required Seed Passwords (set locally in backend/.env)
SEED_PLATFORM_ADMIN_PASSWORD=
SEED_ORG_OWNER_PASSWORD=
SEED_ORG_ADMIN_PASSWORD=
SEED_MANAGER_PASSWORD=
SEED_STAFF_PASSWORD=
SEED_USER_PASSWORD=
```

### 9.2 How to Run the Seed
From the workspace root:

```bash
# Execute safe idempotent database seed
npm run db:seed
```

Or from the backend directory:
```bash
cd backend
npm run db:seed
```

### 9.3 Demo Accounts Seeded

| Role | Name | Email | Assignment / Permissions |
|---|---|---|---|
| `PLATFORM_ADMIN` | Platform Superadmin | `platform.admin@civicfix.demo` | Platform-wide administration across all organizations |
| `ORG_OWNER` | SRM Administration Owner | `srm.owner@civicfix.demo` | Primary authority / owner for SRM Campus Administration |
| `ORG_ADMIN` | SRM Operations Admin | `srm.admin@civicfix.demo` | Operational administrator managing SRM triage & workflow |
| `MANAGER` | Civil Infrastructure Manager | `manager@civicfix.demo` | Department Head for **Civil / Infrastructure** |
| `STAFF` | Electrical Field Technician | `staff@civicfix.demo` | Field technician for **Electrical** department |
| `USER` | SRM Campus Student | `student@civicfix.demo` | Standard student / citizen reporter (reporting & tracking) |

*Note: All demo accounts use the `@civicfix.demo` domain and do NOT represent real people.*

### 9.4 Reference Data Seeded
- **Organization:** `SRM Campus Administration` (Type: `UNIVERSITY`, slug: `srm-campus-admin`)
- **Departments (5):**
  1. `Civil / Infrastructure` (`CIVIL`)
  2. `Electrical` (`ELECTRICAL`)
  3. `Sanitation & Waste` (`SANITATION`)
  4. `Water & Drainage` (`WATER`)
  5. `General Maintenance` (`MAINTENANCE`)
- **Categories (7):**
  1. `Pothole / Road` (Priority: `HIGH`, icon: `road`)
  2. `Streetlight` (Priority: `MEDIUM`, icon: `lightbulb`)
  3. `Waste` (Priority: `MEDIUM`, icon: `trash`)
  4. `Water Leakage` (Priority: `HIGH`, icon: `droplet`)
  5. `Electrical` (Priority: `CRITICAL`, icon: `zap`)
  6. `Infrastructure` (Priority: `MEDIUM`, icon: `building`)
  7. `Other` (Priority: `LOW`, icon: `help-circle`)
- **Routing Rules (7):** Deterministic database records mapping categories to departments with keyword arrays and priority orders.
- **Service Area:** SRM Kattankulathur Campus Perimeter (`DEMO SERVICE AREA`) with bounding box (Lat 12.815–12.835, Lon 80.035–80.055) and GeoJSON polygon boundary.

### 9.5 Demo Issues Seeded (3 Sample Issues)
To test reporting, triage, and resolution workflows:
1. `CF-SRM-2026-0001` — *"Streetlight flickering near Hostel 3 walkway"* (`IN_PROGRESS`, Category: Streetlight, Assigned to Electrical staff member with status history and triage comment).
2. `CF-SRM-2026-0002` — *"Pothole on Main Campus Avenue near Tech Park"* (`REPORTED`, Category: Pothole / Road, High priority).
3. `CF-SRM-2026-0003` — *"Water pipe leakage near Bio-Engineering block"* (`RESOLVED`, Category: Water Leakage, Assigned to Water & Drainage with resolution remark).

### 9.6 Safe Re-Seeding (Idempotency)
The script uses Prisma `upsert` across all entities. You can run `npm run db:seed` repeatedly during development without duplicating organizations, users, departments, or issues.

---

---

## 10. Authentication Architecture & Security Foundation

CivicFix uses a **custom stateless JWT authentication** model paired with `bcryptjs` password hashing. It does **not** rely on third-party auth services (such as Supabase Auth, Clerk, or Firebase), providing full architectural control over user identities and multi-tenant access boundaries.

### 10.1 Key Architecture Principles
- **Stateless Tokens:** Access tokens are signed using HMAC-SHA256 (`HS256`) and verified server-side with `JWT_SECRET`.
- **Minimal Token Payload:** The JWT payload contains only essential identity metadata to reduce overhead and prevent credential leakage:
  ```json
  {
    "sub": "f0000000-0000-0000-0000-000000000006",
    "role": "USER",
    "iat": 1727436000,
    "exp": 1727522400
  }
  ```
- **Privilege Escalation Protection:** Public registration **always** creates accounts with `role: USER`. Any registration request attempting to supply administrative roles (`PLATFORM_ADMIN`, `ORG_ADMIN`, `ORG_OWNER`, `MANAGER`, `STAFF`) or organization IDs is rejected with `400 Bad Request`.
- **No Password Exposure:** Passwords and password hashes are **never** returned in API responses, never logged, and never included in JWT payloads.
- **Enumeration Attack Prevention:** Login failures return a generic error message (`"Invalid email or password."`) regardless of whether the email was not found or the password was incorrect.
- **Stateless Logout:** Because tokens are stateless, logout is handled client-side by clearing the locally stored token. The backend does not implement token blacklists at this stage.

### 10.2 Authentication Endpoints

#### 1. Public Registration
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Alex Student",
  "email": "alex.student@srm.edu",
  "password": "StrongPassword123!"
}
```
**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "c1a2b3c4-...",
      "name": "Alex Student",
      "email": "alex.student@srm.edu",
      "role": "USER",
      "isActive": true,
      "createdAt": "2026-09-27T12:00:00.000Z",
      "updatedAt": "2026-09-27T12:00:00.000Z"
    }
  }
}
```

#### 2. User Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "alex.student@srm.edu",
  "password": "StrongPassword123!"
}
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "c1a2b3c4-...",
      "name": "Alex Student",
      "email": "alex.student@srm.edu",
      "role": "USER"
    }
  }
}
```

#### 3. Current User Profile
```http
GET /api/auth/me
Authorization: Bearer <token>
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Current user profile retrieved",
  "data": {
    "user": {
      "id": "c1a2b3c4-...",
      "name": "Alex Student",
      "email": "alex.student@srm.edu",
      "role": "USER",
      "isActive": true,
      "createdAt": "2026-09-27T12:00:00.000Z",
      "updatedAt": "2026-09-27T12:00:00.000Z"
    }
  }
}
```

### 10.3 Reusable Authentication Middleware (`requireAuth`)
Protected backend routes use the `requireAuth` middleware:
1. Validates the `Authorization: Bearer <token>` header.
2. Verifies signature and expiration using `verifyToken()`.
3. Attaches strongly-typed user claims (`req.user = { id, role }`) to the Express `Request` object.
4. Returns `401 Unauthorized` for missing, expired, malformed, or forged tokens without leaking internal stack traces.

---

## 11. Role-Based Access Control (RBAC) & Authorization Architecture

CivicFix implements a multi-tenant **Role-Based Access Control (RBAC)** architecture that enforces security boundaries across platform, organization, department, and individual user resources.

### 11.1 Authentication vs. Authorization
- **Authentication (`requireAuth`):** Answers *"Who are you?"* by validating the cryptographic signature and expiration of the JWT bearer token.
- **Authorization (`requireRole`, `requireOrganizationAccess`, etc.):** Answers *"What are you allowed to do?"* by checking active database state and contextual relationships.

> [!IMPORTANT]
> **Database State Rule:** CivicFix does **not** rely solely on the role claims inside the JWT.
> Authorization verifies the user's active status, current role, and memberships (`organization_members`, `department_members`) directly from the database. If a user is deactivated or their role is modified, access is revoked immediately without waiting for token expiration.

### 11.2 Available Roles & Responsibilities

| Role | Scope | Key Capabilities & Boundaries |
|---|---|---|
| `PLATFORM_ADMIN` | Platform-Wide | Platform governance, tenant onboarding/activation, global configuration, cross-tenant auditing. Does not automatically bypass operational restrictions unless explicitly permitted. |
| `ORG_OWNER` | Organization | Primary tenant authority (e.g., SRM Campus Administration). Full control over organization configuration, organization admins, department creation, and all issues within their organization. |
| `ORG_ADMIN` | Organization | Operational administration within their organization. Manage department staff, triage and assign tickets, re-route issues, and inspect organization-wide issue telemetry. |
| `MANAGER` | Department | Operational lead of a specific department (e.g., Civil, Electrical). Triage tickets assigned to their department, assign technicians, update workflow status, and add remarks. Cannot access unrelated departments. |
| `STAFF` | Department | Field technicians and operational staff. View tickets assigned to their department, update issue resolution progress, add remarks, and submit resolution proofs. Cannot manage organizations or users. |
| `USER` | Citizen / Student | Public reporters and students. Submit new issues, view own issue history and timelines, add details to own issues, and receive notifications. Cannot access organization administration or other users' private issues. |

### 11.3 Multi-Tenant Isolation Layers

#### 1. Organization Isolation (`requireOrganizationAccess`)
- Prevents horizontal privilege escalation where an admin of Organization A attempts to inspect or manipulate Organization B (`/api/organizations/:organizationId/*`).
- Validates active database membership in `organization_members`.
- Requests from unauthorized users are rejected with `403 Forbidden`.

#### 2. Department Isolation (`requireDepartmentAccess`)
- Ensures departmental managers and staff are strictly confined to their assigned operations (`/api/departments/:departmentId/*`).
- For example, an Electrical technician cannot access Civil / Infrastructure workflows.
- Validates active database membership in `department_members`. Parent organization admins retain hierarchical access.

#### 3. User Resource Ownership (`requireUserOwnership`)
- Enforces strict user-scoped isolation (`/api/users/:userId/*`).
- Identity is derived strictly from the verified JWT subject, **never** trusting `req.body.userId` or `req.query.userId`.
- Any user attempting to read or modify another user's data receives `403 Forbidden`.

#### 4. Issue-Scoped Access Rights (`requireIssueAccess`)
- Future issue APIs leverage centralized access logic:
  - `USER`: Only permitted to access issues where `issue.reporterId === req.user.id`.
  - `ORG_ADMIN` / `ORG_OWNER`: Permitted across any issue within their organization.
  - `MANAGER` / `STAFF`: Permitted only on issues assigned to their department or assigned directly to them.
  - `PLATFORM_ADMIN`: Permitted platform-wide.

### 11.4 HTTP Status Code Conventions
- `401 Unauthorized`: Authentication missing, Bearer token malformed, token expired, signature forged, or account deactivated.
- `403 Forbidden`: Authenticated identity verified, but the user does not possess sufficient role, organization, department, or ownership permissions.
- `400 Bad Request`: Malformed or invalid UUID parameters.
- `404 Not Found`: Target resource (department, issue) does not exist.

### 11.5 Reusable Authorization Middlewares
- `requireRole(...roles: UserRole[])`: Enforces global role requirements with live DB role synchronization.
- `requireAnyRole(...roles: UserRole[])`: Convenience alias for role union checks.
- `requireOrganizationAccess(paramName, options)`: Enforces tenant isolation.
- `requireDepartmentAccess(paramName, options)`: Enforces departmental operational boundaries.
- `requireUserOwnership(paramName, options)`: Enforces strict data ownership.
- `requireIssueAccess(paramName)`: Enforces issue access rules.

---

## 12. Organization Management API

CivicFix is architecturally a multi-organization platform. While SRM Campus Administration is seeded for the demo, all organization management endpoints are generic, parameter-driven, and enforce multi-tenant isolation.

### 12.1 Endpoints Specification

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/organizations` | `PLATFORM_ADMIN` | Creates new tenant organization with server-generated slug. |
| `GET` | `/api/organizations` | `PLATFORM_ADMIN`, `ORG_OWNER`, `ORG_ADMIN`, `MANAGER`, `STAFF` | Lists organizations. Platform Admin views all; operational roles view associated orgs; `USER` rejected (403). |
| `GET` | `/api/organizations/:organizationId` | `PLATFORM_ADMIN` or active org member | Retrieves organization metadata with member and department counts. |
| `PATCH` | `/api/organizations/:organizationId` | `PLATFORM_ADMIN`, `ORG_OWNER`, `ORG_ADMIN` | Updates organization name, description, or orgType. Rejects injected IDs or server fields. |
| `PATCH` | `/api/organizations/:organizationId/status` | `PLATFORM_ADMIN` strictly | Activates or deactivates an organization (`isActive: boolean`). |
| `GET` | `/api/organizations/:organizationId/members` | `PLATFORM_ADMIN`, `ORG_OWNER`, `ORG_ADMIN` | Lists organization members with safe user metadata (passwords/hashes omitted). |
| `POST` | `/api/organizations/:organizationId/members` | `PLATFORM_ADMIN`, `ORG_OWNER`, `ORG_ADMIN` | Adds an existing user as an organization member. |
| `PATCH` | `/api/organizations/:organizationId/members/:userId` | `PLATFORM_ADMIN`, `ORG_OWNER`, `ORG_ADMIN` | Updates an organization member's role or status. Self-promotion blocked. |
| `DELETE` | `/api/organizations/:organizationId/members/:userId` | `PLATFORM_ADMIN`, `ORG_OWNER`, `ORG_ADMIN` | Soft-deactivates organization membership without deleting the underlying user account. |

### 12.2 Authorization & Access Rules

1. **Platform Admin Exclusive Capabilities:**
   - Only `PLATFORM_ADMIN` can create new organizations.
   - Only `PLATFORM_ADMIN` can activate or deactivate organizations (`/status`).
   - Platform admin has global override capabilities across all tenant organizations.
2. **Organization-Scoped Administrator Capabilities:**
   - `ORG_OWNER` and `ORG_ADMIN` can manage their own organization's settings and members.
   - Cross-organization queries or modifications are rejected with `403 Forbidden`.
   - `MANAGER`, `STAFF`, and `USER` cannot modify organization metadata or manage memberships.
3. **Public User Protection:**
   - Ordinary `USER` accounts receive `403 Forbidden` on all organization administration and member endpoints.

### 12.3 Organization Membership & Role Assignment Policy

| Actor Role | Permitted Target Roles for Member Addition / Update | Prohibited Actions |
|---|---|---|
| `PLATFORM_ADMIN` | `OWNER`, `ADMIN`, `MANAGER`, `STAFF`, `MEMBER` | None (Platform override) |
| `ORG_OWNER` | `ADMIN`, `MANAGER`, `STAFF`, `MEMBER` | Cannot assign `PLATFORM_ADMIN` |
| `ORG_ADMIN` | `MANAGER`, `STAFF`, `MEMBER` | Cannot assign `OWNER` or `ADMIN`; cannot modify existing Owner/Admin |
| `MANAGER` / `STAFF` / `USER` | None | Cannot add, modify, or remove any members |

**Privilege Escalation Guards:**
- Users cannot add themselves or modify their own role.
- Request payload cannot override server-generated fields (`id`, `createdAt`, `updatedAt`, `slug`).
- Role tampering via request bodies, query strings, or fake headers is rejected.

### 12.4 Inactive Organization Behavior
- When an organization is deactivated (`isActive: false`), operational updates and new member additions by non-platform users are rejected with `403 Forbidden`.
- Inactive organizations retain all historical records, department mappings, and issue logs intact. No data is deleted.
- Only a `PLATFORM_ADMIN` can reactivate a deactivated organization.

### 12.5 Example Requests & Responses

#### Create Organization (`PLATFORM_ADMIN` only)
```http
POST /api/organizations
Authorization: Bearer <PLATFORM_ADMIN_JWT>
Content-Type: application/json

{
  "name": "Greater Chennai Corporation",
  "description": "Civic municipal body for Chennai district",
  "orgType": "MUNICIPALITY"
}
```

Response (`201 Created`):
```json
{
  "success": true,
  "data": {
    "id": "a0000000-0000-0000-0000-000000000011",
    "name": "Greater Chennai Corporation",
    "slug": "greater-chennai-corporation",
    "description": "Civic municipal body for Chennai district",
    "orgType": "MUNICIPALITY",
    "isActive": true,
    "createdAt": "2026-09-27T12:00:00.000Z"
  },
  "message": "Organization created successfully"
}
```

#### Add Organization Member
```http
POST /api/organizations/a0000000-0000-0000-0000-000000000001/members
Authorization: Bearer <ORG_ADMIN_JWT>
Content-Type: application/json

{
  "userId": "f0000000-0000-0000-0000-000000000007",
  "role": "STAFF"
}
```

Response (`201 Created`):
```json
{
  "success": true,
  "data": {
    "member": {
      "id": "m0000000-0000-0000-0000-000000000010",
      "organizationId": "a0000000-0000-0000-0000-000000000001",
      "userId": "f0000000-0000-0000-0000-000000000007",
      "orgRole": "STAFF",
      "isActive": true,
      "user": {
        "id": "f0000000-0000-0000-0000-000000000007",
        "name": "Campus Citizen 2",
        "email": "citizen2@civicfix.demo",
        "role": "USER"
      }
    }
  },
  "message": "Member added to organization successfully"
}
```

---

## 13. Development Commands

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

# Validate Prisma Schema
npm run prisma:validate

# Generate Prisma Client
npm run prisma:generate

# Run Automated Authentication Tests (50 assertions)
npm run test:auth

# Run Automated RBAC & Authorization Tests (47 assertions)
npm run test:rbac

# Run Automated Organization Management Tests (55 assertions)
npm run test:org

# Test Database Connectivity
npm run test:db

# Run Idempotent Database Seed
npm run db:seed
```

---

## 14. Environment Variables Template

Copy `.env.example` to `backend/.env` and `frontend/.env.local`:

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
JWT_EXPIRES_IN=24h

# Database Demo Seed Passwords (Required by npm run db:seed)
SEED_PLATFORM_ADMIN_PASSWORD=
SEED_ORG_OWNER_PASSWORD=
SEED_ORG_ADMIN_PASSWORD=
SEED_MANAGER_PASSWORD=
SEED_STAFF_PASSWORD=
SEED_USER_PASSWORD=

# AI Intelligence Integrations
GROQ_API_KEY=
GEMINI_API_KEY=
```

---

## 15. Implementation Roadmap & Deferred Scope

| Phase | Status | Focus |
|---|---|---|
| **Prompt 1: Project Foundation** | &check; Complete | Directory structure, Express backend, Next.js frontend, branding, health check |
| **Prompt 2: Database Schema** | &check; Complete | Supabase PostgreSQL schema, 16 tables, 9 enums, 36 indexes, storage bucket, seed data |
| **Prompt 3: Prisma ORM Integration** | &check; Complete | Prisma schema mapping, Client generation, singleton client, DB test script, health check |
| **Prompt 4: Demo Database Seed Data** | &check; Complete | Idempotent Prisma seeder, bcrypt password hashing, demo users, orgs, rules, issues |
| **Prompt 5: Backend Authentication Foundation** | &check; Complete | Custom JWT auth, bcrypt hashing, register/login/me APIs, requireAuth middleware, security test suite |
| **Prompt 6: Role-Based Access Control (RBAC)** | &check; Complete | Reusable authorization middlewares, multi-tenant organization isolation, department isolation, user ownership, RBAC test suite |
| **Prompt 7: Platform Admin & Organization Management** | &check; Complete | Multi-tenant organization CRUD, status toggling, safe member management, privilege escalation guards, organization test suite |
| **Prompt 8: Issue APIs & Storage** | Upcoming | Issue creation, Supabase Storage uploads, Leaflet geocoding, triage endpoints |
| **Prompt 9: AI Intelligence Agent** | Upcoming | Groq & Gemini asynchronous analysis, smart routing, duplicate detection |
| **Prompt 10: Dashboards & UI** | Upcoming | Citizen reporter UI, Organization Admin dashboard, Platform Admin dashboard |
