import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:     "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:   "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline:     "text-foreground",
        ok:          "border-transparent bg-[#DCFCE7] text-[#14532D]",
        warn:        "border-transparent bg-[#FEF9C3] text-[#713F12]",
        err:         "border-transparent bg-[#FEE2E2] text-[#7F1D1D]",
        info:        "border-transparent bg-[#E6EEF8] text-[#0F3CA5]",
        ink:         "border-transparent bg-[#1A1A1A] text-white",
        neutral:     "border-transparent bg-[#F0F4FA] text-[#1A1A1A]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const DOT_COLOR: Record<string, string> = {
  ok:      "#16A34A",
  warn:    "#CA8A04",
  err:     "#DC2626",
  info:    "#0F3CA5",
  ink:     "#ffffff",
  neutral: "#9B9B9B",
};

const PILL_VARIANTS = new Set(["ok", "warn", "err", "info", "ink", "neutral"]);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  const showDot = dot !== false && variant && PILL_VARIANTS.has(variant);
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {showDot && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: DOT_COLOR[variant as string] }}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
