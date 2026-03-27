import packageJson from "../../../package.json";
import type { RecentFile } from "../../lib/recent-files";
import { WelcomeRecentFileButton } from "./WelcomeRecentFileButton";
import { Button } from "../ui";

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
  const appVersionLabel = `v${packageJson.version}`;

  return (
    <main className="welcome-screen">
      <div className="welcome-screen__inner">
        <section aria-labelledby="welcome-hero-title" className="welcome-screen__hero">
          <header>
            <span className="welcome-screen__eyebrow">File-first Markdown editor</span>
            <h1 className="welcome-screen__title" id="welcome-hero-title">
              Open a recent archive or start a new&nbsp;
              <span className="welcome-screen__title-accent">Markdown</span> file.
            </h1>
            <p className="welcome-screen__lede">
              ClipMark is a lightweight Markdown workspace for saving web research
              into local files. Move from paste to cleanup, preview, and focused
              writing without leaving the file-first flow.
            </p>
          </header>

          <nav aria-label="Welcome actions" className="welcome-screen__actions">
            <Button variant="primary" onClick={onNew}>
              New Markdown File
            </Button>
            <Button variant="secondary" onClick={onOpen}>
              Open Existing File
            </Button>
          </nav>
        </section>

        <section
          aria-labelledby="welcome-recent-files-title"
        >
          <article className="welcome-screen__recent-card">
            <header className="welcome-screen__section-header">
              <h2 className="welcome-screen__section-title" id="welcome-recent-files-title">
                Recent Files
              </h2>
              {recentFiles.length > 0 ? (
                <p className="welcome-screen__section-meta">
                  {`${recentFiles.length} file${recentFiles.length === 1 ? "" : "s"}`}
                </p>
              ) : null}
            </header>
            {recentFiles.length === 0 ? (
              <p className="welcome-screen__empty-state">
                <strong>No recent files yet.</strong>{" "}
                Open a Markdown document once and it will appear here for quick
                access.
              </p>
            ) : (
              <ul className="welcome-screen__recent-list">
                {recentFiles.map((file) => (
                  <li key={file.path}>
                    <WelcomeRecentFileButton
                      file={file}
                      onOpenRecent={onOpenRecent}
                    />
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
      </div>

      <footer className="welcome-screen__footer">
        <p>{appVersionLabel}</p>
        <p>© 2026 ClipMark</p>
      </footer>
    </main>
  );
}
