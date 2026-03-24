import type { RecentFile } from "../../lib/recent-files";
import {
  designSystem,
  getButtonClasses,
} from "../../lib/design-system";

type WelcomeScreenProps = {
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
  recentFiles: RecentFile[];
};

export function WelcomeScreen({
  onNew,
  onOpen,
  onOpenRecent,
  recentFiles,
}: WelcomeScreenProps) {
  return (
    <main className={designSystem.welcomeScreen}>
      <section className={designSystem.welcomeCard}>
        <p className={designSystem.eyebrow}>ClipMark</p>
        <h1 className={designSystem.welcomeTitle}>
          Open a recent archive or start a new Markdown file.
        </h1>
        <p className={designSystem.welcomeBody}>
          ClipMark keeps web clipping and Markdown cleanup lightweight. Open an
          existing file or create a new note to begin.
        </p>
        <div className={designSystem.welcomeActions}>
          <button className={getButtonClasses("primary")} onClick={onNew} type="button">
            New Markdown File
          </button>
          <button className={getButtonClasses("secondary")} onClick={onOpen} type="button">
            Open Markdown File
          </button>
        </div>
      </section>

      <section className={designSystem.welcomeCard}>
        <div className={designSystem.recentFilesHeader}>
          <strong>Recent Files</strong>
          <span className={designSystem.status}>{recentFiles.length} items</span>
        </div>
        {recentFiles.length === 0 ? (
          <p className={designSystem.tocEmpty}>No recent files yet.</p>
        ) : (
          <div className={designSystem.recentFilesList}>
            {recentFiles.map((file) => (
              <button
                className={designSystem.recentFileItem}
                key={file.path}
                onClick={() => onOpenRecent(file.path)}
                type="button"
              >
                <span>{file.filename}</span>
                <span className={designSystem.status}>{file.path}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
