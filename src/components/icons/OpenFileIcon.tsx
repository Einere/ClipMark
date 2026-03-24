import type { ComponentProps } from "react";

type OpenFileIconProps = ComponentProps<"svg">;

export function OpenFileIcon(props: OpenFileIconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 16 16"
      {...props}
    >
      <path
        d="M2.25 4.25A1.5 1.5 0 0 1 3.75 2.75h2.1c.28 0 .55.1.76.3l.84.78c.2.18.45.28.72.28h4.08a1.5 1.5 0 0 1 1.5 1.5v5.64a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path
        d="M2.75 5.75h10.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}
