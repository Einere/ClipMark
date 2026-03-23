import type { RecentFile } from "../../lib/recent-files";

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
    <main className="welcome-screen">
      <section className="welcome-card">
        <p className="welcome-card__eyebrow">ClipMark</p>
        <h1 className="welcome-card__title">
          Open a recent archive or start a new Markdown file.
        </h1>
        <p className="welcome-card__body">
          ClipMark keeps web clipping and Markdown cleanup lightweight. Open an
          existing file or create a new note to begin.
        </p>
        <div className="welcome-card__actions">
          <button className="button-primary" onClick={onNew} type="button">
            New Markdown File
          </button>
          <button className="button-secondary" onClick={onOpen} type="button">
            Open Markdown File
          </button>
        </div>
      </section>

      <section className="welcome-card">
        <div className="recent-files__header">
          <strong>Recent Files</strong>
          <span className="status">{recentFiles.length} items</span>
        </div>
        {recentFiles.length === 0 ? (
          <p className="toc__empty">No recent files yet.</p>
        ) : (
          <div className="recent-files__list">
            {recentFiles.map((file) => (
              <button
                className="recent-files__item"
                key={file.path}
                onClick={() => onOpenRecent(file.path)}
                type="button"
              >
                <span>{file.filename}</span>
                <span className="status">{file.path}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
