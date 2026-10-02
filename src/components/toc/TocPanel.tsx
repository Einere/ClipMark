import type { CSSProperties } from "react";
import type { Heading } from "../../lib/toc";

type TocPanelProps = {
  activeHeadingLine: number | null;
  headings: Heading[];
  onSelectHeading: (line: number) => void;
};

export function TocPanel({
  activeHeadingLine,
  headings,
  onSelectHeading,
}: TocPanelProps) {
  return (
    <aside aria-label="Table of contents" className="toc-panel">
      <nav aria-label="Document headings" className="toc-panel__nav">
        {headings.length === 0 ? (
          <p className="toc-panel__empty">Add headings to build a table of contents.</p>
        ) : (
          headings.map((heading) => (
            <button
              aria-current={activeHeadingLine === heading.line ? "location" : undefined}
              className="toc-panel__item"
              data-active={activeHeadingLine === heading.line}
              key={`${heading.id}-${heading.line}`}
              onClick={() => onSelectHeading(heading.line)}
              style={
                {
                  paddingLeft: `calc(0.7rem + ${(heading.depth - 1) * 0.8}rem)`,
                } as CSSProperties
              }
              title={heading.text}
              type="button"
            >
              <span className="toc-panel__item-label">{heading.text}</span>
            </button>
          ))
        )}
      </nav>
    </aside>
  );
}
