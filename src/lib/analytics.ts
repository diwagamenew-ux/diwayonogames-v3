/**
 * GA4 admin field is deliberately forgiving: an admin can paste either
 *   1. a bare Measurement ID — "G-LWBDM9HJ68", or
 *   2. the full gtag.js snippet Google's UI hands out (two separate
 *      <script> tags — a src-loader tag plus an inline init tag).
 *
 * Historically the raw value of that field was dropped straight into a
 * single <Script dangerouslySetInnerHTML> tag. That works for
 * single-<script> snippets (GTM, Clarity) but NOT for GA4's snippet,
 * because it is two <script> elements concatenated together. The browser's
 * HTML parser treats <script> content as raw text and stops at the FIRST
 * literal "</script>" it sees — so the outer wrapper tag's content becomes
 * `<script async src="...gtag/js?id=...">`, which is a JavaScript syntax
 * error, and gtag.js never loads. The remaining inline snippet then runs as
 * a stray top-level <script> that calls a `gtag()` function which was never
 * defined by a loaded library — so dataLayer pushes happen but nothing is
 * ever sent to Google. No console 404, no obvious failure — GA4 just never
 * receives data. This file exists to make that class of bug impossible: we
 * always extract the Measurement ID and render the two script tags the
 * correct/expected way (see components/analytics.tsx).
 */
const GA4_ID_REGEX = /G-[A-Z0-9]{6,}/i;

/** Extracts a GA4 Measurement ID from either a bare ID or a full pasted snippet. */
export function extractGa4Id(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(GA4_ID_REGEX);
  return match ? match[0].toUpperCase() : null;
}

/**
 * The inline gtag bootstrap. `gaId` must already be validated by
 * extractGa4Id (matches /^G-[A-Z0-9]{6,}$/i) before this is called — it is
 * interpolated into a script body, so untrusted input must never reach it.
 */
export function gtagInitScript(gaId: string): string {
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`;
}

/**
 * Admin-panel "paste a script tag" fields (Google Analytics, GTM, Clarity)
 * are injected server-side via dangerouslySetInnerHTML. That's inherent to
 * letting a trusted admin paste arbitrary third-party tracking code — there
 * is no way to "sanitize" JavaScript and have it still function as a
 * tracking snippet. The practical guardrail is (a) the field is only
 * writable by an authenticated admin with full ("*") permissions, behind
 * the existing origin check, and (b) a sane size cap so the settings
 * document can't be blown up into something pathological. This just
 * enforces (b).
 */
const MAX_SCRIPT_FIELD_LENGTH = 20_000;

export function isReasonableScriptField(value: string): boolean {
  return typeof value === "string" && value.length <= MAX_SCRIPT_FIELD_LENGTH;
}
