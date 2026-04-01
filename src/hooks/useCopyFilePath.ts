import { useEffectEvent } from "react";

export type ShowToast = (
  message: string,
  variant?: "error" | "info" | "success" | "warning",
  title?: string,
) => void;

type UseCopyFilePathOptions = {
  filePath: string | null;
  successToastVariant?: "success";
  showToast: ShowToast;
};

export function useCopyFilePath({
  filePath,
  successToastVariant,
  showToast,
}: UseCopyFilePathOptions) {
  const handleCopyFilePathError = useEffectEvent(() => {
    showToast("Could not copy the file path.", "error");
  });

  const handleCopyFilePath = useEffectEvent(async () => {
    if (!filePath) {
      return;
    }

    try {
      await navigator.clipboard.writeText(filePath);
      if (successToastVariant) {
        showToast("Copied the file path to the clipboard.", successToastVariant);
      } else {
        showToast("Copied the file path to the clipboard.");
      }
    } catch {
      handleCopyFilePathError();
    }
  });

  return {
    copyFilePath: handleCopyFilePath,
  };
}
