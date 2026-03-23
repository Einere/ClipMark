export type Heading = {
  depth: number;
  id: string;
  line: number;
  text: string;
};

export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function extractHeadings(markdown: string): Heading[] {
  const lines = markdown.split(/\r?\n/);
  const headings: Heading[] = [];
  let inCodeFence = false;

  lines.forEach((line, index) => {
    if (/^(```|~~~)/.test(line.trim())) {
      inCodeFence = !inCodeFence;
      return;
    }

    if (inCodeFence) {
      return;
    }

    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) {
      return;
    }

    const text = match[2].trim();
    headings.push({
      depth: match[1].length,
      id: slugifyHeading(text),
      line: index + 1,
      text,
    });
  });

  return headings;
}
