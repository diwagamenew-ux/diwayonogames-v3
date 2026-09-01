import {
  pgTable,
  serial,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

/* ---------------------------------- Users --------------------------------- */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("author"), // admin | editor | author | moderator
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* -------------------------------- Categories ------------------------------- */
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").default("").notNull(),
  icon: text("icon").default("").notNull(),
  metaTitle: text("meta_title").default("").notNull(),
  metaDescription: text("meta_description").default("").notNull(),
  h1: text("h1").default("").notNull(),
  focusKeyword: text("focus_keyword").default("").notNull(),
  canonicalUrl: text("canonical_url").default("").notNull(),
  ogTitle: text("og_title").default("").notNull(),
  ogDescription: text("og_description").default("").notNull(),
  ogImage: text("og_image").default("").notNull(),
  twitterTitle: text("twitter_title").default("").notNull(),
  twitterDescription: text("twitter_description").default("").notNull(),
  twitterImage: text("twitter_image").default("").notNull(),
  noIndex: boolean("no_index").default(false).notNull(),
  noFollow: boolean("no_follow").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ---------------------------------- Games ---------------------------------- */
export type FaqItem = { q: string; a: string };

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  shortDesc: text("short_desc").default("").notNull(),
  content: text("content").default("").notNull(), // HTML allowed
  icon: text("icon").default("").notNull(),
  banner: text("banner").default("").notNull(),
  version: text("version").default("1.0").notNull(),
  size: text("size").default("").notNull(),
  developer: text("developer").default("").notNull(),
  packageName: text("package_name").default("").notNull(),
  minAndroid: text("min_android").default("5.0+").notNull(),
  bonus: text("bonus").default("").notNull(),
  categoryId: integer("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  rating: real("rating").default(0).notNull(),
  ratingCount: integer("rating_count").default(0).notNull(),
  // Editorial rating: the site team's own assessment, set independently of
  // user reviews (never fabricated user counts/votes). Kept in a separate
  // column from `rating`/`ratingCount` on purpose — those two are recomputed
  // from real approved reviews (see recomputeGameRating in
  // api/admin/reviews/route.ts) and feed the public AggregateRating JSON-LD,
  // so they must only ever reflect actual users. `editorialRating` is
  // display-only, always labeled "Editorial Rating" wherever shown, and is
  // never included in structured data as if it were a user rating.
  editorialRating: real("editorial_rating").default(0).notNull(),
  downloads: integer("downloads").default(0).notNull(),
  views: integer("views").default(0).notNull(),
  featured: boolean("featured").default(false).notNull(),
  status: text("status").notNull().default("published"), // published | draft
  metaTitle: text("meta_title").default("").notNull(),
  metaDescription: text("meta_description").default("").notNull(),
  h1: text("h1").default("").notNull(),
  focusKeyword: text("focus_keyword").default("").notNull(),
  secondaryKeywords: text("secondary_keywords").default("").notNull(),
  canonicalUrl: text("canonical_url").default("").notNull(),
  ogTitle: text("og_title").default("").notNull(),
  ogDescription: text("og_description").default("").notNull(),
  ogImage: text("og_image").default("").notNull(),
  twitterTitle: text("twitter_title").default("").notNull(),
  twitterDescription: text("twitter_description").default("").notNull(),
  twitterImage: text("twitter_image").default("").notNull(),
  noIndex: boolean("no_index").default(false).notNull(),
  noFollow: boolean("no_follow").default(false).notNull(),
  faqs: jsonb("faqs").$type<FaqItem[]>().default([]).notNull(),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  // Postgres does not auto-index foreign key columns — only the table's
  // own primary/unique keys. Every category page and every "latest"/
  // "trending" homepage listing filters on status + category and sorts by
  // publishedAt, so without these this was a sequential scan of the whole
  // games table on every request.
  index("games_category_id_idx").on(t.categoryId),
  index("games_status_idx").on(t.status),
  index("games_featured_idx").on(t.featured),
  index("games_published_at_idx").on(t.publishedAt),
]);

/* ---------------------------- Download links ------------------------------- */
export const downloadLinks = pgTable("download_links", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  label: text("label").notNull().default("Download APK"),
  url: text("url").notNull(),
  version: text("version").default("").notNull(),
  size: text("size").default("").notNull(),
  hits: integer("hits").default(0).notNull(),
  sort: integer("sort").default(0).notNull(),
}, (t) => [
  // Every game detail page looks up its download links by gameId.
  index("download_links_game_id_idx").on(t.gameId),
]);

/* ----------------------------------- Tags ---------------------------------- */
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  metaTitle: text("meta_title").default("").notNull(),
  metaDescription: text("meta_description").default("").notNull(),
  h1: text("h1").default("").notNull(),
  focusKeyword: text("focus_keyword").default("").notNull(),
  canonicalUrl: text("canonical_url").default("").notNull(),
  noIndex: boolean("no_index").default(true).notNull(),
  noFollow: boolean("no_follow").default(false).notNull(),
});

export const gameTags = pgTable(
  "game_tags",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.tagId] }),
    // The composite PK (gameId, tagId) only serves lookups that start with
    // gameId. `relatedGames()` and tag pages look up by tagId alone
    // (find every game with this tag), which needs its own index.
    index("game_tags_tag_id_idx").on(t.tagId),
  ]
);

/* ---------------------------------- Posts ---------------------------------- */
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").default("").notNull(),
  content: text("content").default("").notNull(),
  image: text("image").default("").notNull(),
  categoryId: integer("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  authorId: integer("author_id").references(() => users.id, {
    onDelete: "set null",
  }),
  views: integer("views").default(0).notNull(),
  status: text("status").notNull().default("published"), // published | draft | scheduled
  featured: boolean("featured").default(false).notNull(),
  scheduledAt: timestamp("scheduled_at"),
  readingTime: integer("reading_time").default(1).notNull(),
  metaTitle: text("meta_title").default("").notNull(),
  metaDescription: text("meta_description").default("").notNull(),
  h1: text("h1").default("").notNull(),
  focusKeyword: text("focus_keyword").default("").notNull(),
  secondaryKeywords: text("secondary_keywords").default("").notNull(),
  canonicalUrl: text("canonical_url").default("").notNull(),
  ogTitle: text("og_title").default("").notNull(),
  ogDescription: text("og_description").default("").notNull(),
  ogImage: text("og_image").default("").notNull(),
  twitterTitle: text("twitter_title").default("").notNull(),
  twitterDescription: text("twitter_description").default("").notNull(),
  twitterImage: text("twitter_image").default("").notNull(),
  noIndex: boolean("no_index").default(false).notNull(),
  noFollow: boolean("no_follow").default(false).notNull(),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("posts_status_idx").on(t.status),
  index("posts_category_id_idx").on(t.categoryId),
  index("posts_author_id_idx").on(t.authorId),
  index("posts_published_at_idx").on(t.publishedAt),
  index("posts_featured_idx").on(t.featured),
  index("posts_scheduled_at_idx").on(t.scheduledAt),
]);

export const postTags = pgTable(
  "post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.tagId] }),
    index("post_tags_tag_id_idx").on(t.tagId),
  ]
);

/* ------------------------- Reviews / Comments ------------------------------ */
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").references(() => games.id, { onDelete: "cascade" }),
  postId: integer("post_id").references(() => posts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  rating: integer("rating").default(5).notNull(),
  comment: text("comment").default("").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("reviews_game_id_idx").on(t.gameId),
  index("reviews_post_id_idx").on(t.postId),
  index("reviews_status_idx").on(t.status),
]);

/* ---------------------------------- Pages ---------------------------------- */
export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").default("").notNull(),
  metaTitle: text("meta_title").default("").notNull(),
  metaDescription: text("meta_description").default("").notNull(),
  h1: text("h1").default("").notNull(),
  focusKeyword: text("focus_keyword").default("").notNull(),
  canonicalUrl: text("canonical_url").default("").notNull(),
  ogTitle: text("og_title").default("").notNull(),
  ogDescription: text("og_description").default("").notNull(),
  ogImage: text("og_image").default("").notNull(),
  twitterTitle: text("twitter_title").default("").notNull(),
  twitterDescription: text("twitter_description").default("").notNull(),
  twitterImage: text("twitter_image").default("").notNull(),
  noIndex: boolean("no_index").default(false).notNull(),
  noFollow: boolean("no_follow").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* -------------------------------- Settings --------------------------------- */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

/* -------------------------------- Redirects -------------------------------- */
export const redirects = pgTable("redirects", {
  id: serial("id").primaryKey(),
  fromPath: text("from_path").notNull().unique(),
  toPath: text("to_path").notNull(),
  statusCode: integer("status_code").default(301).notNull(),
  hits: integer("hits").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notFoundLogs = pgTable("not_found_logs", {
  id: serial("id").primaryKey(),
  path: text("path").notNull().unique(),
  hits: integer("hits").default(1).notNull(),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
});

/* --------------------------------- Extras ---------------------------------- */
export const newsletterSubs = pgTable("newsletter_subs", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const gameRequests = pgTable("game_requests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").default("").notNull(),
  gameName: text("game_name").notNull(),
  message: text("message").default("").notNull(),
  status: text("status").notNull().default("new"), // new | done
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").references(() => games.id, { onDelete: "set null" }),
  url: text("url").default("").notNull(),
  reason: text("reason").default("Broken link").notNull(),
  message: text("message").default("").notNull(),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").default("").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* --------------------------------- Audit log -------------------------------- */
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  userName: text("user_name").default("").notNull(),
  action: text("action").notNull(), // create | update | delete | login | logout
  entity: text("entity").notNull(), // game | post | category | tag | page | user | settings | review | redirect
  entityId: text("entity_id").default("").notNull(),
  summary: text("summary").default("").notNull(),
  ip: text("ip").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
