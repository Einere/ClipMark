export function AppShellFallback() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="app-shell app-shell--loading"
      role="status"
    >
      <div className="app-shell__fallback">
        <p className="app-shell__fallback-kicker">Opening editor</p>
        <p className="app-shell__fallback-message">Preparing your writing workspace.</p>
      </div>
    </div>
  );
}
