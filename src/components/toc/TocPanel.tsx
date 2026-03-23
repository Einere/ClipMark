import type { Heading } from "../../lib/toc";

type TocPanelProps = {
  headings: Heading[];
};

export function TocPanel({ headings }: TocPanelProps) {
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
            <a
              className="toc__item"
              href={`#${heading.id}`}
              key={`${heading.id}-${heading.line}`}
              style={{ paddingLeft: `${heading.depth * 0.75}rem` }}
            >
              {heading.text}
            </a>
          ))
        )}
      </nav>
    </aside>
  );
}
