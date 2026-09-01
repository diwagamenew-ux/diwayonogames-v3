-- Editorial rating: the site team's own rating, set independently of real
-- user reviews. Kept separate from `rating`/`rating_count` (which are
-- recomputed only from approved reviews and feed the public AggregateRating
-- structured data) so an editorial score can never be mistaken for, or
-- overwrite, a real user rating.
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "editorial_rating" real DEFAULT 0 NOT NULL;
