import { useState } from "react";
import {
  addRecentFile,
  clearRecentFiles,
  loadRecentFiles,
  removeRecentFile,
  type RecentFile,
} from "../lib/recent-files";

export function useRecentFilesState() {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(() => loadRecentFiles());

  return {
    clearRecentFilesList() {
      setRecentFiles(clearRecentFiles());
    },
    forgetRecentFile(path: string) {
      setRecentFiles((files) => removeRecentFile(files, path));
    },
    recentFiles,
    rememberRecentFile(path: string | null) {
      setRecentFiles((files) => addRecentFile(files, path));
    },
  };
}
