-- ============================================================================
-- APKVault — COMPLETE Supabase / PostgreSQL fresh-install setup
-- ============================================================================
-- What this project actually is (read this first):
--   This app does NOT use Supabase Auth, Supabase Storage, or Supabase's
--   client libraries. It is a plain Next.js app that talks to a plain
--   PostgreSQL database over `DATABASE_URL` (via node-postgres + Drizzle
--   ORM). Supabase is only being used here as a *hosted Postgres server* —
--   the connection string you get from Project Settings → Database.
--   Admin auth is a custom email+password system (bcrypt hash, JWT session
--   cookie) that lives entirely in `users.password_hash`, not in Supabase's
--   `auth.users`. Because of that, Row Level Security policies are NOT part
--   of this file — the app connects with the full Postgres role from your
--   connection string and reads/writes these tables directly (the same way
--   it would against Neon, Railway, RDS, or a self-hosted Postgres), so
--   RLS on the built-in `postgres` role would not add real protection here
--   and would risk *breaking* the app if misconfigured. Access control is
--   enforced in the application layer instead (see src/lib/auth.ts,
--   src/lib/roles.ts, and the per-route permission checks under
--   src/app/api/admin/**).
--
-- How to use this file:
--   1. Create a brand-new Supabase project.
--   2. Project Settings → Database → SQL Editor → paste this whole file → Run.
--   3. Set your environment variables (see .env.example) — most importantly
--      DATABASE_URL (use the "Transaction pooler" connection string on
--      Vercel/serverless) and AUTH_SECRET.
--   4. Deploy. Log in at /admin/login with the default admin account below.
--
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / ON CONFLICT
-- DO NOTHING), so running this file twice against the same database will
-- not duplicate data, drop anything, or error out.
-- ============================================================================

BEGIN;

-- pgcrypto gives us crypt()/gen_salt() so we can create a real bcrypt hash
-- for the default admin password directly in SQL — the exact same hash
-- format (`$2a$..`/`$2b$..`) that the app's bcryptjs-based verification in
-- src/lib/auth.ts (signIn -> bcrypt.compare) expects. No plaintext password
-- is ever stored.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- users  (custom auth table — NOT Supabase's auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "users" (
  "id"            serial PRIMARY KEY NOT NULL,
  "name"          text NOT NULL,
  "email"         text NOT NULL,
  "password_hash" text NOT NULL,
  "role"          text NOT NULL DEFAULT 'author', -- admin | editor | author | moderator
  "created_at"    timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "users_email_unique" UNIQUE ("email")
);

-- ----------------------------------------------------------------------------
-- categories
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "categories" (
  "id"                   serial PRIMARY KEY NOT NULL,
  "name"                 text NOT NULL,
  "slug"                 text NOT NULL,
  "description"          text NOT NULL DEFAULT '',
  "icon"                 text NOT NULL DEFAULT '',
  "meta_title"           text NOT NULL DEFAULT '',
  "meta_description"     text NOT NULL DEFAULT '',
  "h1"                   text NOT NULL DEFAULT '',
  "focus_keyword"        text NOT NULL DEFAULT '',
  "canonical_url"        text NOT NULL DEFAULT '',
  "og_title"             text NOT NULL DEFAULT '',
  "og_description"       text NOT NULL DEFAULT '',
  "og_image"             text NOT NULL DEFAULT '',
  "twitter_title"        text NOT NULL DEFAULT '',
  "twitter_description"  text NOT NULL DEFAULT '',
  "twitter_image"        text NOT NULL DEFAULT '',
  "no_index"             boolean NOT NULL DEFAULT false,
  "no_follow"            boolean NOT NULL DEFAULT false,
  "created_at"           timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "categories_slug_unique" UNIQUE ("slug")
);

-- ----------------------------------------------------------------------------
-- tags
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "tags" (
  "id"               serial PRIMARY KEY NOT NULL,
  "name"             text NOT NULL,
  "slug"             text NOT NULL,
  "meta_title"       text NOT NULL DEFAULT '',
  "meta_description" text NOT NULL DEFAULT '',
  "h1"               text NOT NULL DEFAULT '',
  "focus_keyword"    text NOT NULL DEFAULT '',
  "canonical_url"    text NOT NULL DEFAULT '',
  "no_index"         boolean NOT NULL DEFAULT true,
  "no_follow"        boolean NOT NULL DEFAULT false,
  CONSTRAINT "tags_slug_unique" UNIQUE ("slug")
);

-- ----------------------------------------------------------------------------
-- games
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "games" (
  "id"                   serial PRIMARY KEY NOT NULL,
  "title"                text NOT NULL,
  "slug"                 text NOT NULL,
  "short_desc"           text NOT NULL DEFAULT '',
  "content"              text NOT NULL DEFAULT '',
  "icon"                 text NOT NULL DEFAULT '',
  "banner"               text NOT NULL DEFAULT '',
  "version"              text NOT NULL DEFAULT '1.0',
  "size"                 text NOT NULL DEFAULT '',
  "developer"            text NOT NULL DEFAULT '',
  "package_name"         text NOT NULL DEFAULT '',
  "min_android"          text NOT NULL DEFAULT '5.0+',
  "bonus"                text NOT NULL DEFAULT '',
  "category_id"          integer REFERENCES "categories"("id") ON DELETE SET NULL,
  "rating"               real NOT NULL DEFAULT 0,
  "rating_count"         integer NOT NULL DEFAULT 0,
  "editorial_rating"     real NOT NULL DEFAULT 0,
  "downloads"            integer NOT NULL DEFAULT 0,
  "views"                integer NOT NULL DEFAULT 0,
  "featured"             boolean NOT NULL DEFAULT false,
  "status"               text NOT NULL DEFAULT 'published', -- published | draft
  "meta_title"           text NOT NULL DEFAULT '',
  "meta_description"     text NOT NULL DEFAULT '',
  "h1"                   text NOT NULL DEFAULT '',
  "focus_keyword"        text NOT NULL DEFAULT '',
  "secondary_keywords"   text NOT NULL DEFAULT '',
  "canonical_url"        text NOT NULL DEFAULT '',
  "og_title"             text NOT NULL DEFAULT '',
  "og_description"       text NOT NULL DEFAULT '',
  "og_image"             text NOT NULL DEFAULT '',
  "twitter_title"        text NOT NULL DEFAULT '',
  "twitter_description"  text NOT NULL DEFAULT '',
  "twitter_image"        text NOT NULL DEFAULT '',
  "no_index"             boolean NOT NULL DEFAULT false,
  "no_follow"            boolean NOT NULL DEFAULT false,
  "faqs"                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  "published_at"         timestamp NOT NULL DEFAULT now(),
  "created_at"           timestamp NOT NULL DEFAULT now(),
  "updated_at"           timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "games_slug_unique" UNIQUE ("slug")
);

CREATE INDEX IF NOT EXISTS "games_category_id_idx"   ON "games" ("category_id");
CREATE INDEX IF NOT EXISTS "games_status_idx"        ON "games" ("status");
CREATE INDEX IF NOT EXISTS "games_featured_idx"      ON "games" ("featured");
CREATE INDEX IF NOT EXISTS "games_published_at_idx"  ON "games" ("published_at");

-- ----------------------------------------------------------------------------
-- download_links
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "download_links" (
  "id"      serial PRIMARY KEY NOT NULL,
  "game_id" integer NOT NULL REFERENCES "games"("id") ON DELETE CASCADE,
  "label"   text NOT NULL DEFAULT 'Download APK',
  "url"     text NOT NULL,
  "version" text NOT NULL DEFAULT '',
  "size"    text NOT NULL DEFAULT '',
  "hits"    integer NOT NULL DEFAULT 0,
  "sort"    integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "download_links_game_id_idx" ON "download_links" ("game_id");

-- ----------------------------------------------------------------------------
-- game_tags (join table)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "game_tags" (
  "game_id" integer NOT NULL REFERENCES "games"("id") ON DELETE CASCADE,
  "tag_id"  integer NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  CONSTRAINT "game_tags_game_id_tag_id_pk" PRIMARY KEY ("game_id", "tag_id")
);

CREATE INDEX IF NOT EXISTS "game_tags_tag_id_idx" ON "game_tags" ("tag_id");

-- ----------------------------------------------------------------------------
-- posts (blog)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "posts" (
  "id"                   serial PRIMARY KEY NOT NULL,
  "title"                text NOT NULL,
  "slug"                 text NOT NULL,
  "excerpt"              text NOT NULL DEFAULT '',
  "content"              text NOT NULL DEFAULT '',
  "image"                text NOT NULL DEFAULT '',
  "category_id"          integer REFERENCES "categories"("id") ON DELETE SET NULL,
  "author_id"            integer REFERENCES "users"("id") ON DELETE SET NULL,
  "views"                integer NOT NULL DEFAULT 0,
  "status"               text NOT NULL DEFAULT 'published', -- published | draft | scheduled
  "featured"             boolean NOT NULL DEFAULT false,
  "scheduled_at"         timestamp,
  "reading_time"         integer NOT NULL DEFAULT 1,
  "meta_title"           text NOT NULL DEFAULT '',
  "meta_description"     text NOT NULL DEFAULT '',
  "h1"                   text NOT NULL DEFAULT '',
  "focus_keyword"        text NOT NULL DEFAULT '',
  "secondary_keywords"   text NOT NULL DEFAULT '',
  "canonical_url"        text NOT NULL DEFAULT '',
  "og_title"             text NOT NULL DEFAULT '',
  "og_description"       text NOT NULL DEFAULT '',
  "og_image"             text NOT NULL DEFAULT '',
  "twitter_title"        text NOT NULL DEFAULT '',
  "twitter_description"  text NOT NULL DEFAULT '',
  "twitter_image"        text NOT NULL DEFAULT '',
  "no_index"             boolean NOT NULL DEFAULT false,
  "no_follow"            boolean NOT NULL DEFAULT false,
  "published_at"         timestamp NOT NULL DEFAULT now(),
  "created_at"           timestamp NOT NULL DEFAULT now(),
  "updated_at"           timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "posts_slug_unique" UNIQUE ("slug")
);

CREATE INDEX IF NOT EXISTS "posts_status_idx"        ON "posts" ("status");
CREATE INDEX IF NOT EXISTS "posts_category_id_idx"   ON "posts" ("category_id");
CREATE INDEX IF NOT EXISTS "posts_author_id_idx"     ON "posts" ("author_id");
CREATE INDEX IF NOT EXISTS "posts_published_at_idx"  ON "posts" ("published_at");
CREATE INDEX IF NOT EXISTS "posts_featured_idx"      ON "posts" ("featured");
CREATE INDEX IF NOT EXISTS "posts_scheduled_at_idx"  ON "posts" ("scheduled_at");

-- ----------------------------------------------------------------------------
-- post_tags (join table)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "post_tags" (
  "post_id" integer NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "tag_id"  integer NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  CONSTRAINT "post_tags_post_id_tag_id_pk" PRIMARY KEY ("post_id", "tag_id")
);

CREATE INDEX IF NOT EXISTS "post_tags_tag_id_idx" ON "post_tags" ("tag_id");

-- ----------------------------------------------------------------------------
-- reviews
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "reviews" (
  "id"         serial PRIMARY KEY NOT NULL,
  "game_id"    integer REFERENCES "games"("id") ON DELETE CASCADE,
  "post_id"    integer REFERENCES "posts"("id") ON DELETE CASCADE,
  "name"       text NOT NULL,
  "rating"     integer NOT NULL DEFAULT 5,
  "comment"    text NOT NULL DEFAULT '',
  "status"     text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "reviews_game_id_idx" ON "reviews" ("game_id");
CREATE INDEX IF NOT EXISTS "reviews_post_id_idx" ON "reviews" ("post_id");
CREATE INDEX IF NOT EXISTS "reviews_status_idx"  ON "reviews" ("status");

-- ----------------------------------------------------------------------------
-- pages (static content: Privacy Policy, Terms, DMCA, Disclaimer, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "pages" (
  "id"                   serial PRIMARY KEY NOT NULL,
  "title"                text NOT NULL,
  "slug"                 text NOT NULL,
  "content"              text NOT NULL DEFAULT '',
  "meta_title"           text NOT NULL DEFAULT '',
  "meta_description"     text NOT NULL DEFAULT '',
  "h1"                   text NOT NULL DEFAULT '',
  "focus_keyword"        text NOT NULL DEFAULT '',
  "canonical_url"        text NOT NULL DEFAULT '',
  "og_title"             text NOT NULL DEFAULT '',
  "og_description"       text NOT NULL DEFAULT '',
  "og_image"             text NOT NULL DEFAULT '',
  "twitter_title"        text NOT NULL DEFAULT '',
  "twitter_description"  text NOT NULL DEFAULT '',
  "twitter_image"        text NOT NULL DEFAULT '',
  "no_index"             boolean NOT NULL DEFAULT false,
  "no_follow"            boolean NOT NULL DEFAULT false,
  "updated_at"           timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "pages_slug_unique" UNIQUE ("slug")
);

-- ----------------------------------------------------------------------------
-- settings (key/value store — Admin → Settings tabs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "settings" (
  "key"   text PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL
);

-- ----------------------------------------------------------------------------
-- redirects
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "redirects" (
  "id"          serial PRIMARY KEY NOT NULL,
  "from_path"   text NOT NULL,
  "to_path"     text NOT NULL,
  "status_code" integer NOT NULL DEFAULT 301,
  "hits"        integer NOT NULL DEFAULT 0,
  "created_at"  timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "redirects_from_path_unique" UNIQUE ("from_path")
);

-- ----------------------------------------------------------------------------
-- not_found_logs (404 monitor)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "not_found_logs" (
  "id"        serial PRIMARY KEY NOT NULL,
  "path"      text NOT NULL,
  "hits"      integer NOT NULL DEFAULT 1,
  "last_seen" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "not_found_logs_path_unique" UNIQUE ("path")
);

-- ----------------------------------------------------------------------------
-- newsletter_subs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "newsletter_subs" (
  "id"         serial PRIMARY KEY NOT NULL,
  "email"      text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "newsletter_subs_email_unique" UNIQUE ("email")
);

-- ----------------------------------------------------------------------------
-- game_requests ("Request a game" form)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "game_requests" (
  "id"         serial PRIMARY KEY NOT NULL,
  "name"       text NOT NULL,
  "email"      text NOT NULL DEFAULT '',
  "game_name"  text NOT NULL,
  "message"    text NOT NULL DEFAULT '',
  "status"     text NOT NULL DEFAULT 'new', -- new | done
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- reports (broken-link reports)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "reports" (
  "id"         serial PRIMARY KEY NOT NULL,
  "game_id"    integer REFERENCES "games"("id") ON DELETE SET NULL,
  "url"        text NOT NULL DEFAULT '',
  "reason"     text NOT NULL DEFAULT 'Broken link',
  "message"    text NOT NULL DEFAULT '',
  "status"     text NOT NULL DEFAULT 'new',
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- contact_messages
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "contact_messages" (
  "id"         serial PRIMARY KEY NOT NULL,
  "name"       text NOT NULL,
  "email"      text NOT NULL,
  "subject"    text NOT NULL DEFAULT '',
  "message"    text NOT NULL,
  "status"     text NOT NULL DEFAULT 'new',
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- audit_logs (admin activity trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"         serial PRIMARY KEY NOT NULL,
  "user_id"    integer REFERENCES "users"("id") ON DELETE SET NULL,
  "user_name"  text NOT NULL DEFAULT '',
  "action"     text NOT NULL, -- create | update | delete | login | logout
  "entity"     text NOT NULL, -- game | post | category | tag | page | user | settings | review | redirect
  "entity_id"  text NOT NULL DEFAULT '',
  "summary"    text NOT NULL DEFAULT '',
  "ip"         text NOT NULL DEFAULT '',
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================================
-- Default admin account
-- ============================================================================
-- Email:    admin@apkvault.com
-- Password: admin123   (bcrypt-hashed below via pgcrypto — never stored as
--                        plain text, and hashed the same way the app itself
--                        hashes passwords, so bcrypt.compare() in
--                        src/lib/auth.ts verifies it correctly)
--
-- ON CONFLICT DO NOTHING makes this idempotent: re-running this file will
-- never create a duplicate admin or reset an admin whose password you've
-- since changed from the admin panel.
--
-- ⚠️  Change this password from Admin → Users immediately after your first
--     login on a real deployment.
INSERT INTO "users" ("name", "email", "password_hash", "role")
VALUES (
  'Site Admin',
  'admin@apkvault.com',
  crypt('admin123', gen_salt('bf', 10)),
  'admin'
)
ON CONFLICT ("email") DO NOTHING;

-- ============================================================================
-- Tell the app's own migration runner these tables already exist
-- ============================================================================
-- The app (src/db/seed.ts -> src/instrumentation.ts) runs Drizzle's
-- migrator on every server boot so it can apply *new* migrations to an
-- existing site automatically. Drizzle tracks which migrations already ran
-- in drizzle."__drizzle_migrations". Without this stamp, the very first
-- boot after you run this file would try to re-run migration 0000 (CREATE
-- TABLE ...) against tables that already exist and fail with "relation
-- already exists". This stamp tells it "everything through migration 0006
-- is already applied," so it safely skips straight to seeding/serving
-- traffic — while still applying any migration added after this file was
-- generated (future updates keep working automatically).
CREATE SCHEMA IF NOT EXISTS "drizzle";
CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
  "id"         serial PRIMARY KEY,
  "hash"       text NOT NULL,
  "created_at" bigint
);
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT 'supabase_complete_setup.sql', 1788000000000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations");

COMMIT;

-- ============================================================================
-- Done. Next steps:
--   1. Copy your connection string (Project Settings → Database →
--      Connection string → "Transaction pooler" for Vercel/serverless)
--      into DATABASE_URL.
--   2. Set AUTH_SECRET to a long random value: openssl rand -base64 48
--   3. Set NEXT_PUBLIC_SITE_URL to your deployed domain.
--   4. Deploy, then log in at /admin/login with admin@apkvault.com / admin123
--      and change the password right away.
-- ============================================================================
