export type OpenedDocument = {
  filename: string;
  markdown: string;
  path: string | null;
};

type SaveDocumentInput = {
  filename: string;
  markdown: string;
  path: string | null;
  saveAs?: boolean;
};

type SavedDocument = {
  filename: string;
  path: string | null;
};

const MARKDOWN_FILTERS = [
  {
    name: "Markdown",
    extensions: ["md", "markdown", "txt"],
  },
];

export function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export function getFilenameFromPath(path: string): string {
  return path.split(/[/\\]/).pop() || "untitled.md";
}

export function ensureMarkdownExtension(filename: string): string {
  const trimmed = filename.trim() || "untitled";
  return /\.(md|markdown|txt)$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
}

function downloadMarkdown(filename: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function openMarkdownDocument(): Promise<OpenedDocument | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  const [{ open }, { readTextFile }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/plugin-fs"),
  ]);

  const selected = await open({
    directory: false,
    filters: MARKDOWN_FILTERS,
    multiple: false,
  });

  if (!selected || Array.isArray(selected)) {
    return null;
  }

  const markdown = await readTextFile(selected);
  return {
    filename: getFilenameFromPath(selected),
    markdown,
    path: selected,
  };
}

export async function saveMarkdownDocument({
  filename,
  markdown,
  path,
  saveAs = false,
}: SaveDocumentInput): Promise<SavedDocument | null> {
  const nextFilename = ensureMarkdownExtension(filename);

  if (!isTauriRuntime()) {
    downloadMarkdown(nextFilename, markdown);
    return {
      filename: nextFilename,
      path: null,
    };
  }

  const [{ save }, { writeTextFile }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/plugin-fs"),
  ]);

  let targetPath = path;
  if (!targetPath || saveAs) {
    targetPath = await save({
      defaultPath: nextFilename,
      filters: MARKDOWN_FILTERS,
    });
  }

  if (!targetPath) {
    return null;
  }

  await writeTextFile(targetPath, markdown);
  return {
    filename: getFilenameFromPath(targetPath),
    path: targetPath,
  };
}
