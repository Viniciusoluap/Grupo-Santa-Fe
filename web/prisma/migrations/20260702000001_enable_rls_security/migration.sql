-- Security fix: Supabase advisor findings "rls_disabled_in_public" and
-- "sensitive_columns_exposed" (28 Jun 2026).
--
-- Supabase exposes every table in the "public" schema through its PostgREST
-- API using the anon/authenticated roles. This app talks to Postgres only via
-- Prisma (direct connection as the table owner), so the API surface is pure
-- attack surface: without RLS, anyone with the project URL + anon key could
-- read/write all tables, including "usuarios" (password hashes).
--
-- Fix, in two layers:
--   1. Enable RLS on every existing table in "public" (no policies created =
--      deny-all for API roles; the table owner used by Prisma bypasses RLS).
--   2. Revoke all privileges from the API roles (anon, authenticated) and
--      change default privileges so future tables are not re-exposed.
--
-- NOTE for future migrations: new tables get no anon/authenticated grants
-- (layer 2 covers them), but to keep the Supabase advisor green also add
-- "ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;" when creating tables.
--
-- This migration is a no-op for local/dev databases without the Supabase
-- roles, hence the conditional blocks.

-- Layer 1: enable RLS on all existing public tables
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Layer 2: revoke API role access (only if the Supabase roles exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated;
  END IF;
END $$;
