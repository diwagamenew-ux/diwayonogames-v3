"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; fallbackTitle?: string };
type State = { error: Error | null };

/**
 * Catches render / hydration errors inside the admin panel and shows a
 * recoverable fallback instead of letting React unmount the whole tree
 * (which is what makes the panel look "blank / not working" when one
 * client island crashes).
 */
export class AdminErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Surface in console so it can be debugged; never re-throw.
    console.error("[admin] render error caught by boundary:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const msg = this.state.error.message || String(this.state.error);
    return (
      <div className="card p-6 sm:p-8 max-w-xl mx-auto mt-10 text-left">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-rose-500">
          Something broke in this panel
        </p>
        <h2 className="font-display text-2xl mt-2 text-ink">
          {this.props.fallbackTitle || "This page hit a render error"}
        </h2>
        <p className="text-sm text-mute mt-3">
          The rest of the admin panel still works — only this view crashed.
          A hard refresh usually clears it; if it keeps happening, the error
          detail below is what to send to whoever maintains the site.
        </p>
        <pre className="mt-4 p-3 rounded-lg bg-panel2 border border-line text-[0.72rem] text-ink/80 whitespace-pre-wrap break-words max-h-48 overflow-auto">
          {msg}
        </pre>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => this.setState({ error: null })}
            className="btn-gold px-4 py-2 text-sm"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="btn-ghost px-4 py-2 text-sm"
          >
            Hard reload
          </button>
          <a href="/admin" className="btn-ghost px-4 py-2 text-sm">
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }
}
