"use client";

import { useRef } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
};

const tools = [
  ["<h2>", "h2"], ["<h3>", "h3"], ["<p>", "p"],
  ["<strong>", "strong"], ["<em>", "em"], ["<ul>", "ul"],
  ["<ol>", "ol"], ["<a>", "a"], ["<blockquote>", "blockquote"],
  ["<table>", "table"], ["<img>", "img"],
] as const;

function wrapSelection(textarea: HTMLTextAreaElement, value: string, tag: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.slice(start, end) || "your text";
  const replacement = `<${tag}>${selected}</${tag}>`;
  return { value: value.slice(0, start) + replacement + value.slice(end), cursor: start + replacement.length };
}

export function HtmlEditor({ value, onChange, rows = 16, placeholder, className = "" }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insert = (tag: string) => {
    const textarea = ref.current;
    if (!textarea) return;
    const result = wrapSelection(textarea, value, tag);
    onChange(result.value);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.cursor, result.cursor);
    });
  };

  return (
    <div className="rounded-xl border border-line overflow-hidden">
      <div className="flex flex-wrap gap-1 p-2 bg-panel2 border-b border-line">
        {tools.map(([label, tag]) => (
          <button
            key={tag}
            type="button"
            onClick={() => insert(tag)}
            className="px-2 py-1 rounded-md border border-line text-[11px] font-mono text-mute hover:text-ink hover:border-primary"
            title={`Insert ${label} HTML`}
          >
            {label}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        className={`input border-0 rounded-none font-mono text-sm min-h-0 ${className}`}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
      />
      <div className="px-3 py-2 bg-panel2 border-t border-line text-[11px] text-mute">
        HTML is supported. Use semantic tags such as <code>&lt;h2&gt;</code>, <code>&lt;p&gt;</code>, <code>&lt;ul&gt;</code>, <code>&lt;a&gt;</code>, <code>&lt;img&gt;</code> and tables. Unsafe HTML is removed when saved.
      </div>
    </div>
  );
}
