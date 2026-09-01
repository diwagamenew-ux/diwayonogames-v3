ALTER TABLE posts ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS scheduled_at timestamp;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reading_time integer NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS posts_featured_idx ON posts (featured);
CREATE INDEX IF NOT EXISTS posts_scheduled_at_idx ON posts (scheduled_at);
