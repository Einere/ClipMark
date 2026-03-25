export type DocumentMetrics = {
  characterCount: number;
  estimatedReadingMinutes: number;
  lineCount: number;
  wordCount: number;
};

const tokenContinuePattern = /[\p{L}\p{N}'’_-]/u;
const tokenStartPattern = /[\p{L}\p{N}]/u;
const whitespaceCharacterPattern = /\s/u;
const visibleCharacterPattern = /\S/u;

export function summarizeDocument(markdown: string): DocumentMetrics {
  let characterCount = 0;
  let lineCount = 0;
  let sawVisibleCharacter = false;
  let pendingWhitespace = false;
  let inToken = false;
  let wordCount = 0;

  for (const character of markdown) {
    if (character === "\n") {
      if (sawVisibleCharacter) {
        lineCount += 1;
      }
      pendingWhitespace = sawVisibleCharacter;
      inToken = false;
      continue;
    }

    if (character === "\r") {
      pendingWhitespace = sawVisibleCharacter;
      inToken = false;
      continue;
    }

    if (whitespaceCharacterPattern.test(character)) {
      pendingWhitespace = sawVisibleCharacter;
      inToken = false;
      continue;
    }

    if (pendingWhitespace) {
      characterCount += 1;
      pendingWhitespace = false;
    }

    if (visibleCharacterPattern.test(character)) {
      sawVisibleCharacter = true;
    }

    characterCount += character.length;

    if (tokenStartPattern.test(character)) {
      if (!inToken) {
        wordCount += 1;
      }
      inToken = true;
      continue;
    }

    if (!tokenContinuePattern.test(character)) {
      inToken = false;
    }
  }

  if (sawVisibleCharacter) {
    lineCount += 1;
  }

  return {
    characterCount,
    estimatedReadingMinutes: wordCount === 0 ? 0 : Math.max(1, Math.ceil(wordCount / 220)),
    lineCount,
    wordCount,
  };
}
