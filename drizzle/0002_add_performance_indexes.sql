-- Performance indexes.
--
-- Postgres automatically indexes PRIMARY KEY and UNIQUE columns, but NOT
-- foreign key columns or plain filter/sort columns. Every one of the
-- columns below is used in a WHERE, JOIN, or ORDER BY on a hot path
-- (category pages, homepage listings, game/post detail pages, the reviews
-- moderation queue) and previously had no index backing it, meaning
-- Postgres had to sequentially scan the full table on every request.
-- Using IF NOT EXISTS so this is safe to run even if a subset were
-- already created by hand.

CREATE INDEX IF NOT EXISTS "games_category_id_idx" ON "games" ("category_id");
CREATE INDEX IF NOT EXISTS "games_status_idx" ON "games" ("status");
CREATE INDEX IF NOT EXISTS "games_featured_idx" ON "games" ("featured");
CREATE INDEX IF NOT EXISTS "games_published_at_idx" ON "games" ("published_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "download_links_game_id_idx" ON "download_links" ("game_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_tags_tag_id_idx" ON "game_tags" ("tag_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_status_idx" ON "posts" ("status");
CREATE INDEX IF NOT EXISTS "posts_category_id_idx" ON "posts" ("category_id");
CREATE INDEX IF NOT EXISTS "posts_author_id_idx" ON "posts" ("author_id");
CREATE INDEX IF NOT EXISTS "posts_published_at_idx" ON "posts" ("published_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_tags_tag_id_idx" ON "post_tags" ("tag_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_game_id_idx" ON "reviews" ("game_id");
CREATE INDEX IF NOT EXISTS "reviews_post_id_idx" ON "reviews" ("post_id");
CREATE INDEX IF NOT EXISTS "reviews_status_idx" ON "reviews" ("status");
