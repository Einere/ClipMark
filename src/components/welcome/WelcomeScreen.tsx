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
    <main>
      <div>
        <section aria-labelledby="welcome-hero-title">
          <header>
            <h1 id="welcome-hero-title">
              Open a recent archive or start a new&nbsp;
              <span>Markdown</span> file.
            </h1>
            <p>
              ClipMark is a lightweight Markdown workspace for saving web research
              into local files. Move from paste to cleanup, preview, and focused
              writing without leaving the file-first flow.
            </p>
          </header>

          <nav aria-label="Welcome actions">
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
          <article>
            <header>
              <h2 id="welcome-recent-files-title">
                Recent Files
              </h2>
              <p>
                {recentFiles.length === 0
                  ? "Ready"
                  : `${recentFiles.length} file${recentFiles.length === 1 ? "" : "s"}`}
              </p>
            </header>
            {recentFiles.length === 0 ? (
              <p>
                <strong>No recent files yet.</strong>{" "}
                Open a Markdown document once and it will appear here for quick
                access.
              </p>
            ) : (
              <ul>
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

      <footer>
        <p>{appVersionLabel}</p>
        <p>© 2026 ClipMark</p>
      </footer>
    </main>
  );
}
