# CivicFix

> **Report. Track. Resolve.**  
> *AI-Assisted Local Issue Reporting and Resolution Platform*

---

## 1. What CivicFix Is

**CivicFix** is an AI-assisted neighborhood and campus issue reporting and resolution platform. It connects citizens and students directly with responsible administrative departments to streamline the lifecycle of civic issues—from reporting with photos, category, and geolocation, to triage, departmental assignment, priority handling, and resolution tracking.

---

## 2. Current Round 1 Scope

For the Round 1 hackathon evaluation, the platform fulfills the official **Neighborhood Issue Reporter** requirements:

- **Citizen / Student Reporting:**
  - Issue description
  - Issue category selection
  - Geolocation (GPS with map verification)
  - Photo attachment
- **Authority / Admin Management:**
  - Status progression (`SUBMITTED` &rarr; `UNDER_REVIEW` &rarr; `ASSIGNED` &rarr; `IN_PROGRESS` &rarr; `RESOLVED` / `REJECTED`)
  - Priority assignment (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
  - Official administrative remarks and resolution notes
- **Analytics & Dashboards:**
  - Real-time aggregation of issue counts categorized by **category** and **status**
- **Round 1 Seeded Tenant:**
  - **SRM Campus Administration** is the single active seeded organization.
  - The architecture treats SRM strictly as a **data record**, never hardcoding SRM-specific conditions into the core application logic.

---

## 3. Multi-Organization Architecture

CivicFix is designed from day one with a clean multi-tenant foundation:

```
Platform (CivicFix)
  └── Organization (e.g., SRM Campus Administration, City Municipality)
        ├── Service Area (Geographic boundaries / Polygon coordinates)
        ├── Departments (e.g., Maintenance, Sanitation, Electrical, Security)
        ├── Members & Staff (Admins, Department Leads, Field Technicians)
        ├── Routing Rules (Category/Keyword/Location to Department mappings)
        └── Issues (Submitted reports, audit logs, comments, status transitions)
```

### Automatic Organization Routing
Reporters **do not manually select an organization**. The backend routing engine resolves organization ownership dynamically:
1. **Location Resolution:** The reported GPS coordinates are evaluated against organization service areas.
2. **Deterministic Department Routing:** Issue category and routing rules assign the ticket to the appropriate internal department.
3. **Round 1 Behavior:** Any issue located within the SRM Campus service area automatically resolves to SRM Campus Administration.

---

## 4. Three Dashboard Contexts

CivicFix separates responsibilities into three distinct dashboard contexts:

| Dashboard Context | Target Role | Key Responsibilities |
|---|---|---|
| **Platform Admin Dashboard** | Platform Superadmins | Manage organizations, activate/deactivate tenants, configure platform-level routing rules, global analytics. |
| **Citizen / Student Dashboard** | Public Users & Students | Submit new issues (with photo, description, map marker), track reported issues in real time, view official status changes and resolution notes. |
| **Organization Dashboard** | Campus & Municipal Staff | Triage issues, assign priority and internal departments, reassign staff, add administrative remarks, update status, view department-level analytics. |

---

## 5. Technology Stack

### Frontend
- **Framework:** Next.js (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Maps:** Leaflet & OpenStreetMap *(to be integrated in upcoming prompts)*
- **Charts:** Recharts *(to be integrated in upcoming prompts)*

### Backend
- **Runtime:** Node.js
- **Server Framework:** Express.js
- **Language:** TypeScript (strict mode, NodeNext module resolution)
- **Architecture:** Controller-Service-Repository pattern with structured REST API endpoints

### Database & Storage
- **Database:** Supabase PostgreSQL
- **ORM:** Prisma ORM
- **File Storage:** Supabase Storage (for issue photographic evidence)

### Authentication & Security
- **Authentication:** Custom JWT authentication with HTTP-only cookies / bearer tokens
- **Security:** bcrypt password hashing, CORS configuration, input sanitization

### Runtime Validation
- **Validation:** Zod (for runtime validation of incoming payloads)

### AI Intelligence Integrations *(Asynchronous enhancement)*
- **Groq API:** Fast LLaMA inference for issue summarization, category validation, keyword extraction, and preliminary severity estimation.
- **Gemini API:** Image verification to validate photo relevance and detect spam or inappropriate content.
- *Reliability Rule:* AI is strictly an enhancement. If AI services are unavailable or rate-limited, issue creation and routing complete deterministically without failure.

---

## 6. Development Commands

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

### Backend Direct Commands (`cd backend`)
```bash
npm run dev         # Starts backend with tsx file watcher
npm run build       # Compiles TypeScript to dist/
npm run start       # Starts compiled production server
npm run typecheck   # Runs tsc --noEmit
```

### Frontend Direct Commands (`cd frontend`)
```bash
npm run dev         # Starts Next.js dev server on http://localhost:3000
npm run build       # Next.js production build
npm run start       # Starts Next.js production server
npm run lint        # Runs ESLint
```

---

## 7. Environment Variables Required Later

Copy `.env.example` to `.env` in the backend root and `frontend/.env.local` for frontend:

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

## 8. What Is Intentionally NOT Implemented Yet (Prompt 1 Scope)

In strict adherence to Prompt 1 constraints, the following features are deliberately deferred to subsequent prompts:
- Complete Prisma database schema and relational models
- User authentication, JWT issuance, and login/register endpoints
- AI service integrations (Groq / Gemini)
- Leaflet map rendering and geolocation picker
- Issue submission form, file upload middleware, and Supabase Storage upload
- Organization and Platform Admin dashboards
- Mock or fake API responses for future features
- Unnecessary dependencies for features to be implemented later

---

## 9. Current Architecture Status

- Backend health check operational: `GET /api/health` &rarr; `HTTP 200 OK`
- Error middleware and structured JSON responses configured
- Frontend Next.js App Router operational with CivicFix branding and Tailwind CSS
- Zero TypeScript errors (`tsc --noEmit` clean on both frontend and backend)
