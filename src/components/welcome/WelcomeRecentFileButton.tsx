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
    <button
      onClick={() => onOpenRecent(file.path)}
      type="button"
    >
      <span>{file.filename}</span>
      <span>
        {file.path}
      </span>
    </button>
  );
}
