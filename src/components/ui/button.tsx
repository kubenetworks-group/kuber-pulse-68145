import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-aileron font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:     "bg-primary text-primary-foreground hover:bg-primary/90 rounded-[14px]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-[14px]",
        outline:     "border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-[14px]",
        secondary:   "bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-[14px]",
        ghost:       "bg-white text-[#1A1A1A] border border-black/[0.14] hover:bg-[#F0F4FA] dark:bg-transparent dark:text-foreground dark:border-border dark:hover:bg-accent rounded-[14px]",
        link:        "text-primary underline-offset-4 hover:underline",
        indigo:      "bg-[#0F3CA5] text-white shadow-[0_1px_2px_rgba(15,60,165,.18)] hover:bg-[#0A2D7E] active:bg-[#082660] rounded-[14px]",
        ink:         "bg-[#1A1A1A] text-white hover:bg-[#333] active:bg-[#111] rounded-[14px] dark:bg-foreground dark:text-background",
        plain:       "bg-transparent text-[#1A1A1A] hover:bg-[rgba(15,60,165,.06)] dark:text-foreground rounded-[14px]",
      },
      size: {
        default: "h-10 px-[18px] py-0 text-sm",
        sm:      "h-[34px] px-[14px] py-0 text-[13px] rounded-[10px]",
        lg:      "h-12 px-[22px] py-0 text-[15px]",
        icon:    "h-10 w-10 rounded-[14px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
