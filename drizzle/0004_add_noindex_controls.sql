-- Per-content "noindex" control (games, posts, categories, pages) so an
-- admin can pull an individual page out of search indexing (robots meta +
-- sitemap) without touching code. Defaults to false (indexable) everywhere
-- so existing published content keeps behaving exactly as before.
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "no_index" boolean DEFAULT false NOT NULL;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "no_index" boolean DEFAULT false NOT NULL;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "no_index" boolean DEFAULT false NOT NULL;
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "no_index" boolean DEFAULT false NOT NULL;
