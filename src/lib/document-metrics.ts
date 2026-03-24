export type DocumentMetrics = {
  characterCount: number;
  estimatedReadingMinutes: number;
  wordCount: number;
};

function getTokenMatches(markdown: string) {
  return markdown.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) ?? [];
}

export function summarizeDocument(markdown: string): DocumentMetrics {
  const trimmed = markdown.trim();
  const words = getTokenMatches(trimmed);
  const compactText = trimmed.replace(/\s+/g, " ");

  return {
    characterCount: compactText.length,
    estimatedReadingMinutes: words.length === 0 ? 0 : Math.max(1, Math.ceil(words.length / 220)),
    wordCount: words.length,
  };
}
