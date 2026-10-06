import { useEffect, useEffectEvent, useRef, useState } from "react";

export type ShowToast = (
  message: string,
  variant?: "error" | "info" | "success" | "warning",
  title?: string,
) => void;

type UseCopyFilePathOptions = {
  filePath: string | null;
  showToast: ShowToast;
};

export function useCopyFilePath({
  filePath,
  showToast,
}: UseCopyFilePathOptions) {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef(0);
  useEffect(() => {
    setCopiedPath(null);
    return () => {
      request.current += 1;
      if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    };
  }, [filePath]);
  const handleCopyFilePathError = useEffectEvent(() => {
    showToast("Could not copy the file path.", "error");
  });

  const handleCopyFilePath = useEffectEvent(async () => {
    if (!filePath) {
      return;
    }

    try {
      const copyRequest = ++request.current;
      await navigator.clipboard.writeText(filePath);
      if (copyRequest !== request.current) return;
      if (resetTimer.current !== null) clearTimeout(resetTimer.current);
      setCopiedPath(filePath);
      resetTimer.current = setTimeout(() => setCopiedPath(null), 1500);
    } catch {
      handleCopyFilePathError();
    }
  });

  return {
    copyFilePath: handleCopyFilePath,
    isPathCopied: filePath !== null && copiedPath === filePath,
  };
}
