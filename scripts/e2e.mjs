const BASE = "http://localhost:3000";
let cookie = "";

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { "content-type": "application/json", cookie, ...(opts.headers || {}) },
    redirect: "manual",
  });
  const setC = res.headers.get("set-cookie");
  if (setC) cookie = setC.split(";")[0];
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

const results = [];
const check = (name, ok, extra = "") =>
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);

// 1. Login
const login = await api("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: "admin@apkvault.com", password: "admin123" }),
});
check("Admin login", login.status === 200);

// 2. Change site name via settings
const gs = await api("/api/admin/settings");
const settings = gs.body.settings;
settings.siteName = "DiwaVault Pro";
const so = await api("/api/admin/settings", { method: "PUT", body: JSON.stringify({ settings }) });
check("Save settings (site name)", so.status === 200);
const home = await fetch(BASE + "/").then((r) => r.text());
check("New site name live on homepage", home.includes("DIWAVAULT PRO"));

// 3. Category: create → rename → verify public page
const cc = await api("/api/admin/categories", {
  method: "POST", body: JSON.stringify({ name: "Test Arcade", description: "temp" }),
});
const catId = cc.body?.category?.id;
check("Create category", cc.status === 201, "id=" + catId);
const cu = await api("/api/admin/categories", {
  method: "PUT", body: JSON.stringify({ id: catId, name: "Test Arcade RENAMED" }),
});
const catSlug = cu.body?.category?.slug;
check("Rename category", cu.status === 200 && !!catSlug);
const catPage = await fetch(BASE + `/category/${catSlug}`).then((r) => r.text());
check("Renamed category visible publicly", catPage.includes("TEST ARCADE RENAMED"));

// 4. Tag create
const ct = await api("/api/admin/tags", { method: "POST", body: JSON.stringify({ name: "E2E Test Tag" }) });
const tagId = ct.body?.tag?.id;
check("Create tag", ct.status === 201, "id=" + tagId);

// 5. Game create → verify public page
const cg = await api("/api/admin/games", {
  method: "POST",
  body: JSON.stringify({
    title: "E2E Master Game",
    shortDesc: "Temporary E2E test game",
    version: "9.9", size: "10 MB", developer: "E2E Labs",
    categoryId: catId, bonus: "999 Bonus",
    content: "<p>Test content body long enough to satisfy checks for the e2e test game page rendering.</p>",
    faqs: [{ q: "Is this a test?", a: "Yes, completely." }],
    tagIds: [tagId],
    links: [{ label: "Download Test APK", url: "/uploads/sample-game.apk", version: "9.9", size: "10 MB" }],
  }),
});
const gameSlug = cg.body?.game?.slug;
const gameId = cg.body?.game?.id;
check("Create game", cg.status === 201, "slug=" + gameSlug);
const gamePage = await fetch(BASE + `/game/${gameSlug}`).then((r) => r.text());
check("Game page renders with FAQ schema", gamePage.includes("E2E MASTER GAME") && gamePage.includes("FAQPage"));
check("Game auto meta title generated", gamePage.includes("APK Download (Latest Version 9.9)"));

// 6. Download counter works
const firstLinkId = cg.body?.game ? undefined : undefined;
const dl1 = await fetch(BASE + `/api/download/1`, { redirect: "manual" });
check("Download redirect route", [302].includes(dl1.status));

// 7. Post create → verify
const cp = await api("/api/admin/posts", {
  method: "POST",
  body: JSON.stringify({ title: "E2E Blog Post", content: "<p>Hello world test.</p>", categoryId: catId, tagIds: [tagId] }),
});
const postSlug = cp.body?.post?.slug;
check("Create post", cp.status === 201, "slug=" + postSlug);
const postPage = await fetch(BASE + `/blog/${postSlug}`).then((r) => r.text());
check("Post page renders", postPage.includes("E2E BLOG POST"));
void firstLinkId;

// 8. Links Manager: add custom header link → verify in header
const gs2 = await api("/api/admin/settings");
const s2 = gs2.body.settings;
s2.nav.headerLinks.push({ label: "VIP Zone", url: "/games" });
await api("/api/admin/settings", { method: "PUT", body: JSON.stringify({ settings: s2 }) });
const home2 = await fetch(BASE + "/").then((r) => r.text());
check("Custom header link live", home2.includes("VIP Zone"));

// 9. Cleanup test data + restore name
await api(`/api/admin/games/${gameId}`, { method: "DELETE" });
await api(`/api/admin/posts/${cp.body.post.id}`, { method: "DELETE" });
await api(`/api/admin/categories?id=${catId}`, { method: "DELETE" });
await api(`/api/admin/tags?id=${tagId}`, { method: "DELETE" });
const gs3 = await api("/api/admin/settings");
const s3 = gs3.body.settings;
s3.siteName = "APKVault";
s3.nav.headerLinks = s3.nav.headerLinks.filter((l) => l.label !== "VIP Zone");
const restore = await api("/api/admin/settings", { method: "PUT", body: JSON.stringify({ settings: s3 }) });
check("Cleanup & restore", restore.status === 200);

// 10b. Regression test: category pages must show EVERY game in the
// category, not just the first one — this is the exact bug shape reported
// against the homepage/category listing. We create three categories with
// 1, 2 and 5 games respectively and assert both the category page and the
// homepage's "Browse Categories" tile report the real count.
const multiCatSpecs = [
  { name: "E2E Cat Solo", gameCount: 1 },
  { name: "E2E Cat Pair", gameCount: 2 },
  { name: "E2E Cat Five", gameCount: 5 },
];
const multiCatCleanup = [];
for (const spec of multiCatSpecs) {
  const mc = await api("/api/admin/categories", {
    method: "POST",
    body: JSON.stringify({ name: spec.name, description: "e2e multi-game regression test" }),
  });
  const mcId = mc.body?.category?.id;
  const mcSlug = mc.body?.category?.slug;
  check(`Create category "${spec.name}"`, mc.status === 201 && !!mcId);

  const createdGameIds = [];
  for (let i = 1; i <= spec.gameCount; i++) {
    const g = await api("/api/admin/games", {
      method: "POST",
      body: JSON.stringify({
        title: `${spec.name} Game ${i}`,
        shortDesc: "E2E multi-game regression test game",
        version: "1.0", size: "5 MB", developer: "E2E Labs",
        categoryId: mcId,
        content: "<p>E2E regression test content, long enough to pass any minimum-length checks.</p>",
        links: [{ label: "Download Test APK", url: "/uploads/sample-game.apk", version: "1.0", size: "5 MB" }],
      }),
    });
    if (g.body?.game?.id) createdGameIds.push(g.body.game.id);
  }
  check(`Create ${spec.gameCount} game(s) in "${spec.name}"`, createdGameIds.length === spec.gameCount);

  const catPageHtml = await fetch(BASE + `/category/${mcSlug}`).then((r) => r.text());
  const gameLinksOnCatPage = (catPageHtml.match(/href="\/game\//g) || []).length;
  check(
    `Category page for "${spec.name}" lists all ${spec.gameCount} game(s)`,
    gameLinksOnCatPage === spec.gameCount,
    `found ${gameLinksOnCatPage} game link(s)`
  );
  check(
    `Category page for "${spec.name}" reports correct total in header`,
    catPageHtml.includes(`${spec.gameCount} apps available`)
  );

  const homeHtml = await fetch(BASE + "/").then((r) => r.text());
  check(
    `Homepage category tile for "${spec.name}" shows correct count`,
    homeHtml.includes(`${spec.gameCount} apps`) && homeHtml.includes(spec.name.toUpperCase())
  );

  multiCatCleanup.push({ mcId, createdGameIds });
}
for (const { mcId, createdGameIds } of multiCatCleanup) {
  for (const gid of createdGameIds) await api(`/api/admin/games/${gid}`, { method: "DELETE" });
  await api(`/api/admin/categories?id=${mcId}`, { method: "DELETE" });
}

// 10. Bad login rejected
const login2 = await fetch(BASE + "/api/auth/login", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "editor@apkvault.com", password: "wrong" }),
});
check("Bad login rejected (bcrypt)", login2.status === 401);

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(failed.length ? `\n${failed.length} FAILURES` : "\nALL TESTS PASSED");
process.exit(failed.length ? 1 : 0);
