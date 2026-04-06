# Supabase Setup (Backend)

This project uses Prisma for relational data and Supabase Storage for resume PDFs.

## 1) Create Supabase Project

1. Create a new Supabase project.
2. In the project dashboard, open `Connect` and copy:
- Session Pooler connection string (port `5432`) for runtime `DATABASE_URL`.
- Direct DB connection string for optional `DIRECT_URL`.
3. In `Settings > API`, copy:
- `Project URL` -> `SUPABASE_URL`
- `service_role` key -> `SUPABASE_SERVICE_ROLE_KEY`

## 2) Create Storage Bucket

1. Open `Storage`.
2. Create bucket named `resume-uploads`.
3. Keep it private.

## 3) Create Prisma DB Role (Recommended)

Run this in Supabase SQL Editor (adjust password):

```sql
create user prisma with password 'replace-with-strong-password' bypassrls createdb;
grant prisma to postgres;
grant usage on schema public to prisma;
grant create on schema public to prisma;
grant all on all tables in schema public to prisma;
grant all on all routines in schema public to prisma;
grant all on all sequences in schema public to prisma;
alter default privileges for role postgres in schema public grant all on tables to prisma;
alter default privileges for role postgres in schema public grant all on routines to prisma;
alter default privileges for role postgres in schema public grant all on sequences to prisma;
```

Then build your pooler URL with this user.

## 4) Configure Environment

Use `backend/.env.example` as reference. In `backend/.env`:

- Set `DATABASE_URL` to Session Pooler URL.
- Optionally set `DIRECT_URL` to direct DB URL.
- Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`.

## 5) Run Prisma Against Supabase

From repo root:

```bash
npm run prisma:migrate --workspace backend
npm run prisma:generate --workspace backend
```

Prisma migrations create/update tables in Supabase automatically. You do not need to manually create tables in the dashboard.

## 6) Run App Against Supabase

1. Keep backend running locally with `npm run dev`.
2. Backend connects to Supabase using your `.env` settings.

## Notes

- If migration commands fail with pooled connection behavior, use `DIRECT_URL` for Prisma CLI operations.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Never expose it to frontend code.
