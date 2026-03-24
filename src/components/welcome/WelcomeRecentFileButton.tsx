import type { RecentFile } from "../../lib/recent-files";

type WelcomeRecentFileButtonProps = {
  file: RecentFile;
  onOpenRecent: (path: string) => void;
};

export function WelcomeRecentFileButton({
  file,
  onOpenRecent,
}: WelcomeRecentFileButtonProps) {
  return (
    <li>
      <button
        className="radius-squircle flex w-full flex-col gap-1.5 px-4 py-4 text-left transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus-glow"
        onClick={() => onOpenRecent(file.path)}
        type="button"
      >
        <span className="font-medium text-on-surface">{file.filename}</span>
        <span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-body-sm text-on-surface-variant">
          {file.path}
        </span>
      </button>
    </li>
  );
}
