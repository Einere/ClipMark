import type { Heading } from "../../lib/toc";
import { designSystem } from "../../lib/design-system";

type TocPanelProps = {
  headings: Heading[];
  onSelectHeading: (line: number) => void;
};

export function TocPanel({ headings, onSelectHeading }: TocPanelProps) {
  return (
    <aside className={`${designSystem.panel} ${designSystem.panelToc}`}>
      <div className={designSystem.panelHeader}>
        <span>Contents</span>
        <span className={designSystem.status}>{headings.length} headings</span>
      </div>
      <nav className={designSystem.toc}>
        {headings.length === 0 ? (
          <p className={designSystem.tocEmpty}>Add headings to build a table of contents.</p>
        ) : (
          headings.map((heading) => (
            <button
              className={designSystem.tocItem}
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
