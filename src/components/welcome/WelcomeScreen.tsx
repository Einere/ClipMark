import packageJson from "../../../package.json";
import type { RecentFile } from "../../lib/recent-files";
import { WelcomeRecentFileButton } from "./WelcomeRecentFileButton";
import { Button } from "../ui/Button";

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
    <main className="grid min-h-0 grid-rows-[1fr_auto] overflow-hidden p-12">
      <div className="grid min-h-0 items-center gap-8 xl:gap-16 lg:grid-cols-[minmax(0,1.12fr)_minmax(20rem,0.88fr)]">
        <section
          aria-labelledby="welcome-hero-title"
          className="flex min-h-0 flex-col justify-center gap-9"
        >
          <header className="flex flex-col gap-6">
            <h1
              className="m-0 text-[clamp(3rem,6vw,5.25rem)] leading-[0.9] tracking-[-0.04em] font-bold text-on-surface"
              id="welcome-hero-title"
            >
              Open a recent archive or start a new&nbsp;
              <span className="text-primary">Markdown</span> file.
            </h1>
            <p className="m-0 max-w-[31rem] text-[clamp(1.02rem,1.45vw,1.18rem)] leading-[1.7] text-on-surface-variant">
              ClipMark is a lightweight Markdown workspace for saving web research
              into local files. Move from paste to cleanup, preview, and focused
              writing without leaving the file-first flow.
            </p>
          </header>

          <nav aria-label="Welcome actions" className="flex flex-wrap gap-3.5">
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
          className="px-3 pb-6 md:px-6 lg:px-0"
        >
          <article className="radius-squircle flex min-h-0 flex-col gap-6 bg-surface-container-low p-6 shadow-ambient xl:p-8">
            <header className="flex items-center justify-between gap-4">
              <h2
                className="m-0 text-body-sm font-semibold tracking-label-upper text-secondary uppercase"
                id="welcome-recent-files-title"
              >
                Recent Files
              </h2>
              <p className="m-0 text-body-sm font-medium uppercase tracking-label-upper text-on-surface-muted">
                {recentFiles.length === 0
                  ? "Ready"
                  : `${recentFiles.length} file${recentFiles.length === 1 ? "" : "s"}`}
              </p>
            </header>
            {recentFiles.length === 0 ? (
              <p className="radius-squircle m-0 bg-surface-container-lowest px-5 py-5 text-body-md leading-body-md text-on-surface-variant">
                <strong className="font-medium text-on-surface">No recent files yet.</strong>{" "}
                Open a Markdown document once and it will appear here for quick
                access.
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
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

      <footer className="flex flex-wrap items-center gap-x-10 gap-y-3 pt-4 pb-2 text-body-sm font-medium uppercase tracking-label-upper text-on-surface-muted">
        <p className="m-0">{appVersionLabel}</p>
        <p className="m-0">© 2026 ClipMark</p>
      </footer>
    </main>
  );
}
