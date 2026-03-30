# Assignment Management Dashboard

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%7C%20Postgres%20%7C%20Realtime-3ecf8e?logo=supabase&logoColor=white)
![Gemini API](https://img.shields.io/badge/Google-Gemini%20API-4285F4?logo=google&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?logo=tailwindcss&logoColor=white)
![Jest](https://img.shields.io/badge/Tested%20with-Jest-c21325?logo=jest&logoColor=white)

## 1. Project Overview and Live Demo

Assignment Management Dashboard is a full-stack productivity platform built with Next.js App Router, Supabase, and Google Gemini AI. It combines task orchestration, recurring schedule automation, role-aware operations, and real-time analytics in a single modern web application.

It is designed for teams that need:
- Assignment lifecycle management
- Automated schedule-driven task generation
- AI-assisted natural-language task creation
- Operational visibility through live dashboard metrics

Live deployment:
[Live Demo](https://your-vercel-link.vercel.app)

## 2. Tech Stack

- Next.js (App Router)
- Supabase (Auth, Postgres, Realtime)
- Tailwind CSS
- Shadcn UI
- Framer Motion
- Google Gemini API

## 3. Core Features and Architecture

### A. CRUD Operations
- Create assignments with metadata including title, description, priority, due date, assignees, and tags.
- Read assignment data in table and detail views.
- Update assignment state (status transitions and activity log tracking).
- Delete operations with role-aware UI controls.

### B. Cron Scheduling Engine
- Recurrence models: Daily, Weekly (specific weekdays), Monthly (specific month dates).
- Trigger-time based schedule execution.
- Backend cron route evaluates current time window and generates assignments from active schedules.
- Pause and resume toggles control schedule activity state.

How it works at a high level:
1. Schedules are persisted with recurrence metadata.
2. A cron trigger calls the internal processing endpoint.
3. Matching schedules are resolved by recurrence rules and trigger time.
4. New assignments are inserted and schedule run-state is updated.

### C. Real-time Analytics Dashboard
- Top-level KPIs: total, completed, overdue, completion rate.
- Recharts visual trend area chart for completion patterns.
- Real-time updates via Supabase change streams.
- Global filters for status, priority, assignee, and date range.

### D. NLP AI Assistant
- Google Gemini parses conversational input into structured assignment intent.
- AI output is normalized to JSON before insertion.
- Human-in-the-loop confirmation card previews task details before database write.

### E. Role-Based Access Control (RBAC)
- Supabase Auth secures user identity and session flow.
- Middleware guards protected routes and redirects unauthenticated users.
- Role metadata (for example Admin vs Member) drives privileged UI actions.

## 4. Local Setup and Installation

### Prerequisites
- Node.js 18+ (recommended)
- npm
- Supabase project
- Gemini API key

### Install
```bash
git clone https://github.com/your-org/your-repo.git
cd your-repo
npm install
```

### Environment Variables
Create a .env.local file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
CRON_SECRET=
```

### Run Locally
```bash
npm run dev
```

Application starts at:
http://localhost:3000

## 5. Database Schema

The app uses a relational Supabase Postgres model centered around:

- Profiles: user identity, role, and account metadata
- Assignments: task records with status, priority, due date, and ownership context
- Schedules: recurring automation definitions (daily, weekly, monthly with trigger timing)
- Tags and Junction Tables: many-to-many relationships for assignment and schedule categorization
- Activity Logs: immutable audit entries for assignment state transitions
- Notifications and Webhooks: operational eventing and external integration hooks

For full DDL and constraints, see schema.sql.

## 6. API and Testing

### Running Tests
Run the Jest suite locally:

```bash
npm run test
```

### Internal Cron API
Core cron trigger endpoint:

- GET /api/cron/process-schedules

Purpose:
- Validates cron authorization secret
- Fetches active schedules
- Resolves recurrence matches for the current execution window
- Creates assignment records for matched schedules
- Updates schedule run metadata to prevent duplicate execution bursts

---

If you are deploying to Vercel, configure environment variables in project settings and wire a scheduled job to call /api/cron/process-schedules with the correct bearer token.
