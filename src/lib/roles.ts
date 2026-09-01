// Shared (client-safe) role/permission definitions — no server imports allowed here.

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export const ROLE_PERMS: Record<string, string[]> = {
  admin: ["*"],
  editor: ["games", "posts", "categories", "tags", "pages", "reviews", "redirects", "seo", "inbox"],
  author: ["posts", "games"],
  moderator: ["reviews", "inbox"],
};

export function can(role: string, perm: string) {
  const perms = ROLE_PERMS[role] || [];
  return perms.includes("*") || perms.includes(perm);
}
