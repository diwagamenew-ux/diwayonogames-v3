import { z } from "zod";

/**
 * Shared Zod schemas for externally-reachable, unauthenticated endpoints —
 * the highest-value place for schema validation since these accept input
 * directly from anonymous visitors. Admin CRUD routes are already
 * authenticated + role-checked (see lib/api.ts requirePerm) and use manual
 * coercion helpers (asStr/asInt/asBool); Zod is layered here on top of the
 * existing sanitization (sanitize-html) rather than replacing it.
 */

export const loginSchema = z.object({
  email: z.string().trim().min(3).max(200).email(),
  password: z.string().min(1).max(200),
});

// `website` is the honeypot field: real users never see or fill it (hidden
// via CSS in the form), so any non-empty value means a bot filled every
// field it could find. We accept it in the schema so it round-trips, and
// the route handler rejects silently (fake success) when it's non-empty.
const honeypot = z.string().max(200).optional().default("");

export const contactFormSchema = z.object({
  kind: z.literal("contact"),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().min(3).max(200).email(),
  subject: z.string().trim().max(200).optional().default(""),
  message: z.string().trim().min(1).max(3000),
  captchaToken: z.string().max(50),
  captchaAnswer: z.union([z.string(), z.number()]),
  website: honeypot,
});

export const requestFormSchema = z.object({
  kind: z.literal("request"),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().max(200).optional().default(""),
  gameName: z.string().trim().min(1).max(200),
  message: z.string().trim().max(2000).optional().default(""),
  captchaToken: z.string().max(50),
  captchaAnswer: z.union([z.string(), z.number()]),
  website: honeypot,
});

export const reportFormSchema = z.object({
  kind: z.literal("report"),
  gameId: z.union([z.string(), z.number()]).optional(),
  url: z.string().trim().max(500).optional().default(""),
  reason: z.string().trim().max(120).optional().default("Broken link"),
  message: z.string().trim().max(2000).optional().default(""),
  captchaToken: z.string().max(50),
  captchaAnswer: z.union([z.string(), z.number()]),
  website: honeypot,
});

export const reviewFormSchema = z.object({
  kind: z.literal("review"),
  name: z.string().trim().min(1).max(120),
  rating: z.union([z.string(), z.number()]).optional().default(5),
  comment: z.string().trim().min(1).max(2000),
  gameId: z.union([z.string(), z.number()]).optional(),
  postId: z.union([z.string(), z.number()]).optional(),
  captchaToken: z.string().max(50),
  captchaAnswer: z.union([z.string(), z.number()]),
  website: honeypot,
});

export const newsletterFormSchema = z.object({
  kind: z.literal("newsletter"),
  email: z.string().trim().min(3).max(200).email(),
  website: honeypot,
});

export const formSchema = z.discriminatedUnion("kind", [
  contactFormSchema,
  requestFormSchema,
  reportFormSchema,
  reviewFormSchema,
  newsletterFormSchema,
]);

/** True if the honeypot field was filled — i.e. this submission is a bot. */
export function isHoneypotTripped(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
