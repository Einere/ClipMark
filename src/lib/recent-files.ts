import {
  getFilenameFromPath,
  readMarkdownDocumentAtPath,
} from "./file-system";

const RECENT_FILES_KEY = "clipmark:recent-files";
const MAX_RECENT_FILES = 8;

export type RecentFile = {
  filename: string;
  path: string;
};

function normalizeRecentFile(path: string): RecentFile {
  return {
    filename: getFilenameFromPath(path),
    path,
  };
}

export function loadRecentFiles(): RecentFile[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(RECENT_FILES_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as Array<{ path?: string }>;
    return parsed
      .map((entry) => (entry.path ? normalizeRecentFile(entry.path) : null))
      .filter((entry): entry is RecentFile => entry !== null)
      .slice(0, MAX_RECENT_FILES);
  } catch {
    return [];
  }
}

export function saveRecentFiles(files: RecentFile[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    RECENT_FILES_KEY,
    JSON.stringify(files.slice(0, MAX_RECENT_FILES)),
  );
}

export function addRecentFile(
  files: RecentFile[],
  path: string | null,
): RecentFile[] {
  if (!path) {
    return files;
  }

  const next = [
    normalizeRecentFile(path),
    ...files.filter((file) => file.path !== path),
  ].slice(0, MAX_RECENT_FILES);

  saveRecentFiles(next);
  return next;
}

export function removeRecentFile(
  files: RecentFile[],
  path: string,
): RecentFile[] {
  const next = files.filter((file) => file.path !== path);
  saveRecentFiles(next);
  return next;
}

export function clearRecentFiles(): RecentFile[] {
  saveRecentFiles([]);
  return [];
}

export async function openRecentFile(
  path: string,
){
  return readMarkdownDocumentAtPath(path);
}
