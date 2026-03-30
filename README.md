# Artkey Assignment Management Dashboard

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%7C%20Postgres%20%7C%20Realtime-3ecf8e?logo=supabase&logoColor=white)
![Gemini API](https://img.shields.io/badge/Google-Gemini%20API-4285F4?logo=google&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?logo=tailwindcss&logoColor=white)
![Jest](https://img.shields.io/badge/Tested%20with-Jest-c21325?logo=jest&logoColor=white)

An end-to-end task orchestration platform built with Next.js, Supabase, and Gemini. It combines assignment operations, recurring schedule automation, real-time updates, role-aware access, and AI-assisted task creation in one full-stack application.

Live deployment placeholder: [Live Demo](https://your-vercel-link.vercel.app)

## Table of Contents

1. Product Overview
2. System Architecture
3. How It Works End to End
4. Detailed Build Journey
5. Project Structure
6. Data Model and Relationships
7. Local Setup and Installation
8. Environment Variables
9. Running the App
10. API Endpoints
11. Scheduling and Cron Strategy
12. Authentication and Authorization
13. Testing
14. Deployment on Vercel
15. Troubleshooting
16. Roadmap

## 1. Product Overview

This dashboard was designed for teams managing recurring and ad hoc work across multiple users. The app solves five core problems:

- Assignment lifecycle management: create, view, update, and delete tasks with priority, due date, and status.
- Assignee-aware visibility: users only see assignments linked to them.
- Recurring automation: daily, weekly, and monthly schedule templates that materialize into assignments.
- Insightful analytics: metrics and chart-based trends with live updates.
- Conversational task entry: AI translates natural language into structured task payloads with a confirmation step.

## 2. System Architecture

The architecture is split into four cooperating layers:

- Presentation layer: Next.js App Router pages and client components.
- Application layer: route handlers for AI and cron processing.
- Data layer: Supabase Postgres tables, relational links, and activity logs.
- Identity and access layer: Supabase Auth, route middleware, role checks, and assignment link scoping.

High-level flow:

1. User authenticates through Supabase Auth.
2. Middleware protects dashboard routes and redirects unauthorized users.
3. Frontend loads assignment and schedule data using scoped queries.
4. User actions write to Postgres and update notifications and timeline logs.
5. Realtime subscriptions refresh views when data changes.
6. Cron route periodically converts schedule definitions into assignment records.
7. AI route converts free text into JSON task intent and returns a preview for confirmation.

## 3. How It Works End to End

### Assignment creation path

1. User opens the assignment dialog and enters task details.
2. App inserts a row in assignments with creator metadata.
3. App inserts links in assignment_assignees.
4. If no assignee is selected, creator is auto-assigned by default.
5. If assignee link insertion fails, assignment is rolled back to prevent orphan tasks.
6. Optional tags are added through assignment_tags.
7. Notification is generated.

### Assignment visibility path

1. User identity is resolved from Supabase session.
2. If role is Admin, all assignments are loaded.
3. If role is non-admin, assignments are loaded strictly via assignment_assignees links.
4. UI assignee labels are hydrated by joining assignment_assignees to profiles.

### AI assistant path

1. User sends natural language prompt in assistant sheet.
2. Client sends message and conversation history to internal AI route.
3. Gemini model returns strict JSON payload.
4. Client renders a confirmation card before insert.
5. On confirm, assignment is inserted and creator-assignee link is written.

### Recurring schedule path

1. User creates schedule with recurrence type and timing.
2. Schedule record persists recurrence metadata and status.
3. Vercel cron calls internal processing route once daily.
4. Route computes which schedules are due for today.
5. Route inserts due assignments and updates schedule run timestamp.

## 4. Detailed Build Journey

This section explains the implementation process step by step.

### Step 1: Core project scaffolding

- Next.js App Router foundation.
- Tailwind and component primitives.
- Routing structure for auth and dashboard sections.

### Step 2: Auth and guarded navigation

- Supabase browser and server client setup.
- Session middleware for route protection.
- Login and registration screens.

### Step 3: Assignment domain

- Assignment table rendering and status actions.
- Assignment detail sheet with timeline events.
- Multi-assignee and tag management through junction tables.

### Step 4: Schedule automation

- Schedule creation UI for Daily, Weekly, Monthly patterns.
- Calendar views and schedule cards.
- Pause and resume toggle with persistence.

### Step 5: Analytics

- KPI cards and chart trend visualization.
- Global filters and scoped dataset recalculation.
- Realtime updates via Supabase channel subscriptions.

### Step 6: AI integration

- Internal chat route for Gemini prompt orchestration.
- Structured JSON extraction from free text.
- Confirmation-first insertion strategy.

### Step 7: Hardening and production behavior

- Assignment visibility scoping by relational links.
- Creator metadata on assignment creation.
- Default creator assignment when no assignee selected.
- Rollback strategy to prevent unassigned orphan records.
- Vercel Hobby-compatible cron strategy.

## 5. Project Structure

Key directories:

- src/app
	- Auth routes
	- Dashboard routes
	- API route handlers
- src/components
	- Domain components (assignments, schedule, dashboard, AI)
	- Shared UI primitives
- src/lib
	- Supabase clients
	- Export utilities
	- Seed and mock helpers
- src/hooks
	- Realtime subscription hooks
- src/__tests__ and __tests__
	- Unit and rendering tests

## 6. Data Model and Relationships

Core entities:

- profiles
	- User profile and role metadata.
- assignments
	- Main task records, status, due date, creator metadata.
- assignment_assignees
	- Junction table linking assignment_id to user_id.
- assignment_tags
	- Assignment-to-tag relation.
- assignment_activity_logs
	- Immutable timeline of changes.
- schedules
	- Recurrence definitions and processing state.
- notifications
	- User-facing event feed.
- webhooks
	- External integration targets.

Relational principles:

- assignment_assignees is the source of truth for who can see a task.
- assignment_activity_logs tracks status changes and actor context.
- schedule processing writes assignments in bulk for due schedules.

For full SQL definition and constraints, use the project schema file in your database migration source.

## 7. Local Setup and Installation

Prerequisites:

- Node.js 18 or newer
- npm
- Supabase project
- Gemini API key

Install steps:

1. Clone repository

	 git clone https://github.com/your-org/your-repo.git

2. Move into project folder

	 cd your-repo

3. Install dependencies

	 npm install

## 8. Environment Variables

Create a file named .env.local in the project root.

Required values:

- NEXT_PUBLIC_SUPABASE_URL=
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
- SUPABASE_SERVICE_ROLE_KEY=
- GEMINI_API_KEY=
- CRON_SECRET=

Notes:

- Never commit real keys.
- Use separate Supabase projects for development and production.

## 9. Running the App

Development server:

npm run dev

Default URL:

http://localhost:3000

Production build check:

1. npm run build
2. npm run start

## 10. API Endpoints

### AI chat endpoint

- Method: POST
- Path: /api/chat
- Purpose: convert conversational prompt into structured assignment intent JSON.

### Cron processing endpoint

- Method: GET
- Path: /api/cron/process-schedules
- Purpose: process due schedules and generate assignments.
- Security: requires Bearer token matching CRON_SECRET.

## 11. Scheduling and Cron Strategy

Current strategy is designed for Vercel Hobby constraints.

- Cron runs once daily.
- Processing route determines which schedules are due today.
- Daily schedules run every day.
- Weekly schedules run when today matches configured day list.
- Monthly schedules run when today matches configured date list.
- Duplicate creation is prevented by last_run_at day checks.

Vercel cron config is in vercel.json.

## 12. Authentication and Authorization

Authentication:

- Supabase Auth handles login and registration.
- Middleware protects dashboard routes.

Authorization:

- Role values in profiles determine admin capabilities.
- Non-admin visibility is scoped by assignment_assignees links.
- Admin users can view full assignment dataset.

For hardened production security, enforce equivalent logic with Supabase Row Level Security policies.

## 13. Testing

Run test suite:

npm run test

Current test coverage includes:

- Basic smoke checks
- Dashboard metrics rendering and computation behavior

If tests fail due to environment gaps, ensure Jest setup includes browser polyfills required by export-related dependencies.

## 14. Deployment on Vercel

Recommended deployment steps:

1. Connect repository to Vercel.
2. Configure all environment variables in Vercel project settings.
3. Confirm cron schedule in vercel.json matches plan limits.
4. Ensure CRON_SECRET in Vercel matches route validation.
5. Deploy and validate AI, auth, and schedule processing flows.

## 15. Troubleshooting

### Symptom: user sees wrong assignment set

- Verify assignment_assignees rows exist for expected assignment_id and user_id pairs.
- Verify user role in profiles.
- Verify RLS policies permit expected reads.

### Symptom: assignment appears without assignee

- Creation flow should auto-assign creator when no assignee selected.
- If link insertion fails, creation should roll back.
- Validate foreign key and RLS behavior on assignment_assignees.

### Symptom: cron not running as expected

- Verify Vercel plan cron limits.
- Verify CRON_SECRET header.
- Check route logs for schedule matching details.

### Symptom: AI task creation fails

- Verify GEMINI_API_KEY exists and has quota.
- Confirm model availability and API plan.
- Check API response parsing logs.

## 16. Roadmap

- Add server-side policy tests for access rules.
- Add integration tests for schedule processing.
- Add richer assignment edit workflow and audit details.
- Add webhook event delivery retries and monitoring.
- Add stronger AI schema validation and fallback providers.

---

If you use this project as a foundation, treat assignment_assignees and RLS as primary security controls, and keep client-side filtering only as a presentation layer safeguard.
