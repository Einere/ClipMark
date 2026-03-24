import type { Heading } from "../../lib/toc";

type TocPanelProps = {
  headings: Heading[];
  onSelectHeading: (line: number) => void;
};

export function TocPanel({ headings, onSelectHeading }: TocPanelProps) {
  return (
    <aside className="cm-panel cm-panel-toc">
      <div className="cm-panel-header">
        <span>Contents</span>
        <span className="cm-status">{headings.length} headings</span>
      </div>
      <nav className="cm-toc">
        {headings.length === 0 ? (
          <p className="cm-toc-empty">Add headings to build a table of contents.</p>
        ) : (
          headings.map((heading) => (
            <button
              className="cm-toc-item"
              key={`${heading.id}-${heading.line}`}
              onClick={() => onSelectHeading(heading.line)}
              style={{ paddingLeft: `${heading.depth * 0.75}rem` }}
              type="button"
            >
              {heading.text}
            </button>
          ))
        )}
      </nav>
    </aside>
  );
}
