# AI Career Pods (Qwyse)

**Current Version:** 1.0.0
**Release Date:** April 28, 2026

AI Career Pods is a monorepo for the Qwyse platform.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Auth: JWT cookie sessions + optional Google OAuth
- Data: Supabase Postgres via Prisma ORM
- File Storage: Supabase Storage (resume PDFs)

## Prerequisites

1. Node.js 20+ LTS
2. npm
3. A Supabase project

## Workspace Setup

```bash
npm install
```

Create these files:

- backend/.env
- frontend/.env

### backend/.env

Use backend/.env.example as the source of truth. Minimum required values:

```env
PORT=4000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
SERVER_ORIGIN=http://localhost:4000

DATABASE_URL=postgresql://<POOLER-USER>:<PASSWORD>@<REGION>.pooler.supabase.com:5432/postgres
JWT_SECRET=replace-with-a-secure-secret
JWT_EXPIRES_IN=7d
AUTH_COOKIE_NAME=careerpods_token

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback

SUPABASE_URL=https://<PROJECT-REF>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
SUPABASE_STORAGE_BUCKET=resume-uploads
```

### frontend/.env

```env
VITE_API_BASE_URL=http://localhost:4000/api
VITE_SERVER_URL=http://localhost:4000
```

## Database and Prisma

Run migrations and generate Prisma client:

```bash
npm run prisma:migrate --workspace backend
npm run prisma:generate --workspace backend
```

If you modify the Prisma schema and need a new migration:

```bash
npm run prisma:migrate --workspace backend -- --name your_migration_name
```

## Run the App

```bash
npm run dev
```

Local URLs:

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- Health check: http://localhost:4000/api/health

## Test and Build

```bash
npm run test:backend
npm run lint --workspace frontend
npm run build --workspace frontend
```

## Root Scripts

Defined in package.json:

- npm run dev
- npm run dev:backend
- npm run dev:frontend
- npm run test:backend
- npm run lint
- npm run build

## Backend Features

- Auth endpoints: register, login, logout, me, Google OAuth callbacks
- Profile setup endpoint
- Pod discovery, creation, join/leave flow
- Private-pod membership request moderation for admins
- Pod onboarding and pod feed posting
- Bi-weekly ritual endpoints: check-ins, reflections, celebrations, phase, stats, notifications
- Resume review endpoints:
  - create review request
  - upload PDF metadata/storage reference
  - list/detail requests
  - submit feedback
  - view feedback (requester/admin)
  - update request status

## Monorepo Layout

```text
AI-Career-Pods/
  backend/        Express API, Prisma schema, migrations, tests
  frontend/       React client (Vite)
  README.md
  package.json    Workspace-level scripts
```

## Troubleshooting

### Prisma generate fails on Windows with EPERM rename

1. Stop running Node processes/terminals that may hold Prisma engine files.
2. Re-run:

```bash
npm run prisma:generate --workspace backend
```

### Cannot authenticate with Google

- Verify GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL in backend/.env.
- Ensure callback URL in Google Cloud matches http://localhost:4000/api/auth/google/callback.

### Supabase connectivity or migration issues

- Confirm DATABASE_URL uses Supabase Session Pooler on port 5432.
- Re-run migration status:

```bash
npm run prisma:migrate --workspace backend -- --schema prisma/schema.prisma
```

- If needed, run:

```bash
cd backend
npx prisma migrate status --schema prisma/schema.prisma
npx prisma migrate deploy --schema prisma/schema.prisma
```

### Cookie/CORS issues in local development

- Ensure frontend is running on http://localhost:5173.
- Ensure backend CLIENT_ORIGIN is http://localhost:5173.
- Keep credentials included in frontend API requests.
