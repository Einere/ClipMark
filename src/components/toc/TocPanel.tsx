import type { Heading } from "../../lib/toc";

type TocPanelProps = {
  headings: Heading[];
  onSelectHeading: (line: number) => void;
};

export function TocPanel({ headings, onSelectHeading }: TocPanelProps) {
  return (
    <aside>
      <div>
        <span>Contents</span>
        <span>{headings.length} headings</span>
      </div>
      <nav>
        {headings.length === 0 ? (
          <p>Add headings to build a table of contents.</p>
        ) : (
          headings.map((heading) => (
            <button
              key={`${heading.id}-${heading.line}`}
              onClick={() => onSelectHeading(heading.line)}
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
