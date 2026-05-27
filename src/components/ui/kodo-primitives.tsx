import * as React from "react";
import { cn } from "@/lib/utils";

// ── KodoPill ────────────────────────────────────────────────────────────────

type PillTone = "ok" | "warn" | "err" | "info" | "ink" | "neutral";

const PILL_PALETTE: Record<PillTone, { bg: string; fg: string; dot: string }> = {
  ok:      { bg: "#DCFCE7", fg: "#14532D", dot: "#16A34A" },
  warn:    { bg: "#FEF9C3", fg: "#713F12", dot: "#CA8A04" },
  err:     { bg: "#FEE2E2", fg: "#7F1D1D", dot: "#DC2626" },
  info:    { bg: "#E6EEF8", fg: "#0F3CA5", dot: "#0F3CA5" },
  ink:     { bg: "#1A1A1A", fg: "#fff",    dot: "#fff"    },
  neutral: { bg: "#F0F4FA", fg: "#1A1A1A", dot: "#9B9B9B" },
};

interface KodoPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  dot?: boolean;
}

export function KodoPill({ tone = "info", dot = true, children, style, className, ...props }: KodoPillProps) {
  const p = PILL_PALETTE[tone];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 font-aileron", className)}
      style={{
        height: 24,
        padding: "0 10px",
        borderRadius: 999,
        fontWeight: 600,
        fontSize: 11,
        background: p.bg,
        color: p.fg,
        ...style,
      }}
      {...props}
    >
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.dot, flexShrink: 0 }} />
      )}
      {children}
    </span>
  );
}

// ── KodoEyebrow ──────────────────────────────────────────────────────────────

export function KodoEyebrow({ children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("kdo-eyebrow", className)} {...props}>
      {children}
    </span>
  );
}

// ── KodoMonoTag ──────────────────────────────────────────────────────────────

export function KodoMonoTag({ children, className, style, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("font-mono", className)}
      style={{
        fontSize: 11,
        color: "#6B6B6B",
        background: "#F0F4FA",
        padding: "3px 8px",
        borderRadius: 6,
        border: "1px solid rgba(0,0,0,.06)",
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
}
