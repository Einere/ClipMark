import type { Heading } from "../../lib/toc";

type TocPanelProps = {
  headings: Heading[];
  onSelectHeading: (line: number) => void;
};

export function TocPanel({ headings, onSelectHeading }: TocPanelProps) {
  return (
    <aside className="panel panel--toc">
      <div className="panel__header">
        <span>Contents</span>
        <span className="status">{headings.length} headings</span>
      </div>
      <nav className="toc">
        {headings.length === 0 ? (
          <p className="toc__empty">Add headings to build a table of contents.</p>
        ) : (
          headings.map((heading) => (
            <button
              className="toc__item"
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
