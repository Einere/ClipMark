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
      className="welcome-recent-file-button"
      onClick={() => onOpenRecent(file.path)}
      type="button"
    >
      <span className="welcome-recent-file-button__filename">{file.filename}</span>
      <span className="welcome-recent-file-button__path">
        {file.path}
      </span>
    </button>
  );
}
