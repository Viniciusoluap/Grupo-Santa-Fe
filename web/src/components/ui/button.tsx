"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none font-semibold tracking-wider uppercase text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-yellow)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--brand-yellow)] text-[var(--brand-dark)] hover:bg-[var(--brand-yellow-dark)] shadow-md hover:shadow-lg",
        dark: "bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:bg-[var(--brand-dark-secondary)]",
        outline:
          "border-2 border-[var(--brand-dark)] text-[var(--brand-dark)] hover:bg-[var(--brand-dark)] hover:text-[var(--brand-yellow)]",
        "outline-yellow":
          "border-2 border-[var(--brand-yellow)] text-[var(--brand-yellow)] hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)]",
        ghost:
          "text-[var(--brand-dark)] hover:bg-[var(--brand-gray-light)] hover:text-[var(--brand-dark)]",
        link: "text-[var(--brand-dark)] underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-9 px-4 text-xs",
        md: "h-11 px-6",
        lg: "h-13 px-8 text-base",
        xl: "h-15 px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}

export { buttonVariants };
