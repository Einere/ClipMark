export type PreviewScrollAnchor = {
  lineEnd: number;
  lineStart: number;
};

export function findClosestPreviewAnchor<T extends PreviewScrollAnchor>(
  anchors: T[],
  activeLine: number | null,
) {
  if (activeLine === null || activeLine < 1 || anchors.length === 0) {
    return null;
  }

  let low = 0;
  let high = anchors.length - 1;
  let candidateIndex = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const anchor = anchors[middle];

    if (anchor.lineStart <= activeLine) {
      candidateIndex = middle;
      low = middle + 1;
      continue;
    }

    high = middle - 1;
  }

  const candidate = anchors[candidateIndex];
  if (candidate.lineStart <= activeLine && activeLine <= candidate.lineEnd) {
    return candidate;
  }

  return candidateIndex > 0 && anchors[candidateIndex].lineStart > activeLine
    ? anchors[candidateIndex - 1]
    : candidate;
}
