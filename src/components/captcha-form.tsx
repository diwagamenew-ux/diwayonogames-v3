"use client";

import { useEffect, useState } from "react";
import { IconSend, IconFlag } from "./icons";

type Props =
  | { kind: "request" }
  | { kind: "contact" }
  | { kind: "report"; gameId?: number; url?: string; compact?: boolean };

/** Visually hidden honeypot input. Off-screen (not display:none, which some
 * bots skip) and unreachable by keyboard/screen-reader users. */
function HoneypotField() {
  return (
    <div style={{ position: "absolute", left: "-5000px", width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
      <label htmlFor="website">Leave this field empty</label>
      <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

export function CaptchaForm(props: Props) {
  const [captcha, setCaptcha] = useState<{ token: string; question: string } | null>(null);
  const [state, setState] = useState<{ type: "idle" | "loading" | "ok" | "err"; msg: string }>({
    type: "idle", msg: "",
  });
  const [open, setOpen] = useState(props.kind !== "report");

  const load = () =>
    fetch("/api/forms")
      .then((r) => r.json())
      .then(setCaptcha)
      .catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setState({ type: "loading", msg: "" });
    const payload: Record<string, unknown> = {
      kind: props.kind,
      captchaToken: captcha?.token || "",
      captchaAnswer: fd.get("captchaAnswer"),
      // Honeypot: real visitors never see this field (visually hidden below
      // and marked aria-hidden/tabIndex=-1); bots that auto-fill every
      // input on the page fill it, so a non-empty value flags them.
      website: fd.get("website") || "",
    };
    if (props.kind === "request") {
      payload.name = fd.get("name");
      payload.email = fd.get("email");
      payload.gameName = fd.get("gameName");
      payload.message = fd.get("message");
    } else if (props.kind === "contact") {
      payload.name = fd.get("name");
      payload.email = fd.get("email");
      payload.subject = fd.get("subject");
      payload.message = fd.get("message");
    } else {
      payload.gameId = props.gameId;
      payload.url = props.url;
      payload.reason = fd.get("reason");
      payload.message = fd.get("message");
    }
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setState({ type: "ok", msg: data.message });
        form.reset();
        load();
      } else {
        setState({ type: "err", msg: data.error || "Something went wrong" });
        load();
      }
    } catch {
      setState({ type: "err", msg: "Network error. Try again." });
    }
  };

  if (props.kind === "report" && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost text-xs px-3.5 py-2 inline-flex items-center gap-1.5 text-mute hover:text-rose-400 hover:border-rose-400/40"
      >
        <IconFlag className="w-3.5 h-3.5" /> Report broken link
      </button>
    );
  }

  const Msg = () =>
    state.msg ? (
      <p className={`text-sm rounded-lg px-3.5 py-2.5 ${state.type === "ok" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"}`}>
        {state.msg}
      </p>
    ) : null;

  if (props.kind === "report") {
    return (
      <form onSubmit={submit} className="card p-4 space-y-3 mt-3 w-full max-w-md overflow-hidden">
        <p className="text-sm font-semibold flex items-center gap-2">
          <IconFlag className="w-4 h-4 text-rose-400" /> Report an issue
        </p>
        <select name="reason" className="input text-sm" defaultValue="Broken download link">
          <option>Broken download link</option>
          <option>Wrong version</option>
          <option>File not working</option>
          <option>Copyright / DMCA issue</option>
          <option>Other</option>
        </select>
        <textarea name="message" rows={2} placeholder="Describe the issue (optional)" className="input text-sm" />
        <div className="flex items-center gap-2">
          <label className="text-xs text-mute shrink-0">{captcha?.question || "Loading…"}</label>
          <input name="captchaAnswer" required inputMode="numeric" className="input text-sm w-20" placeholder="?" />
        </div>
        <HoneypotField />
        <Msg />
        <button type="submit" disabled={state.type === "loading"} className="btn-gold w-full py-2.5 text-sm disabled:opacity-60">
          Submit Report
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="card p-5 sm:p-6 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor={`${props.kind}-name`}>Your Name *</label>
          <input id={`${props.kind}-name`} name="name" required className="input" placeholder="John Doe" />
        </div>
        <div>
          <label className="label" htmlFor={`${props.kind}-email`}>Email {props.kind === "contact" ? "*" : ""}</label>
          <input id={`${props.kind}-email`} name="email" type="email" required={props.kind === "contact"} className="input" placeholder="you@email.com" />
        </div>
      </div>
      {props.kind === "request" ? (
        <div>
          <label className="label" htmlFor="req-game">Game / App Name *</label>
          <input id="req-game" name="gameName" required className="input" placeholder="e.g. Teen Patti Master APK" />
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="contact-subject">Subject</label>
          <input id="contact-subject" name="subject" className="input" placeholder="How can we help?" />
        </div>
      )}
      <div>
        <label className="label" htmlFor={`${props.kind}-msg`}>Message {props.kind === "contact" ? "*" : ""}</label>
        <textarea
          id={`${props.kind}-msg`}
          name="message"
          rows={4}
          required={props.kind === "contact"}
          className="input"
          placeholder={props.kind === "request" ? "Any specific version or details…" : "Write your message…"}
        />
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-mute">Anti-spam: {captcha?.question || "…"}</span>
        <input name="captchaAnswer" required inputMode="numeric" className="input w-24" placeholder="Answer" aria-label="Captcha answer" />
      </div>
      <HoneypotField />
      <Msg />
      <button type="submit" disabled={state.type === "loading"} className="btn-gold w-full sm:w-auto px-8 py-3 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
        <IconSend className="w-4 h-4" />
        {state.type === "loading" ? "Sending…" : props.kind === "request" ? "Submit Request" : "Send Message"}
      </button>
    </form>
  );
}
