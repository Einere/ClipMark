import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-3",
    "radius-squircle px-5 py-3",
    "text-body-lg leading-none font-semibold text-center",
    "transform-gpu",
    "transition-[background-color,color,opacity,transform] duration-220 ease-[var(--ease-standard)]",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-focus-glow)]",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-primary-container text-on-primary",
          "hover:bg-primary",
          "active:bg-surface-tint",
        ],
        secondary: [
          "bg-surface-container-high text-on-surface",
          "hover:bg-surface-container-highest",
          "active:bg-surface-container",
        ],
        tertiary: [
          "bg-transparent text-primary shadow-none",
          "hover:bg-[var(--color-active-tint)]",
          "active:bg-[var(--color-active-tint-strong)]",
        ],
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
} & VariantProps<typeof buttonVariants>;

export function Button({
  children,
  className,
  variant,
  type = "button",
  ...props
}: ButtonProps) {
  // TODO: cn 같은 라이브러리 도입하기
  const resolvedClassName = [buttonVariants({ variant }), className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={resolvedClassName}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
