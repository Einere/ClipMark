import type { ComponentProps } from "react";

type NewFileIconProps = ComponentProps<"svg">;

export function NewFileIcon(props: NewFileIconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 16 16"
      {...props}
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 5.25v5.5M5.25 8h5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
