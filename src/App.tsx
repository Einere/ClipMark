import {
  useEffect,
  useEffectEvent,
  startTransition,
  useDeferredValue,
  useRef,
  useState,
} from "react";
import { MarkdownEditor } from "./components/editor/MarkdownEditor";
import { MarkdownPreview } from "./components/preview/MarkdownPreview";
import { TocPanel } from "./components/toc/TocPanel";
import {
  openMarkdownDocument,
  saveMarkdownDocument,
} from "./lib/file-system";
import { setupAppMenu } from "./lib/menu";
import {
  addRecentFile,
  loadRecentFiles,
  openRecentFile,
  removeRecentFile,
} from "./lib/recent-files";
import { SAMPLE_DOCUMENT } from "./lib/sample-document";
import { extractHeadings } from "./lib/toc";

export default function App() {
  const [recentFiles, setRecentFiles] = useState(() => loadRecentFiles());
  const [filePath, setFilePath] = useState<string | null>(null);
  const [filename, setFilename] = useState("untitled.md");
  const [markdown, setMarkdown] = useState(SAMPLE_DOCUMENT);
  const [savedMarkdown, setSavedMarkdown] = useState(SAMPLE_DOCUMENT);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [isTocVisible, setIsTocVisible] = useState(true);
  const [statusText, setStatusText] = useState("Ready");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const deferredMarkdown = useDeferredValue(markdown);
  const headings = extractHeadings(deferredMarkdown);
  const isDirty = markdown !== savedMarkdown;

  function applyOpenedDocument(document: {
    filename: string;
    markdown: string;
    path: string | null;
  }) {
    startTransition(() => {
      setFilePath(document.path);
      setFilename(document.filename);
      setMarkdown(document.markdown);
      setSavedMarkdown(document.markdown);
      setStatusText(`Opened ${document.filename}`);
    });

    if (document.path) {
      setRecentFiles((files) => addRecentFile(files, document.path));
    }
  }

  function handleNewDocument() {
    if (
      isDirty &&
      !window.confirm("Discard unsaved changes and start a new document?")
    ) {
      return;
    }

    setFilePath(null);
    setFilename("untitled.md");
    setMarkdown("");
    setSavedMarkdown("");
    setStatusText("New document");
  }

  async function handleOpenClick() {
    const document = await openMarkdownDocument();
    if (!document) {
      fileInputRef.current?.click();
      return;
    }

    applyOpenedDocument(document);
  }

  async function handleOpenFile(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();

    applyOpenedDocument({
      filename: file.name,
      markdown: text,
      path: null,
    });

    event.target.value = "";
  }

  async function handleOpenRecent(path: string) {
    try {
      const document = await openRecentFile(path);
      if (!document) {
        setStatusText("Open Recent is only available in the desktop app");
        return;
      }

      applyOpenedDocument(document);
    } catch {
      setRecentFiles((files) => removeRecentFile(files, path));
      setStatusText("Recent file is no longer available");
    }
  }

  async function handleSave(saveAs = false) {
    const saved = await saveMarkdownDocument({
      filename,
      markdown,
      path: filePath,
      saveAs,
    });

    if (!saved) {
      setStatusText("Save cancelled");
      return;
    }

    setFilePath(saved.path);
    setFilename(saved.filename);
    setSavedMarkdown(markdown);
    setStatusText(`Saved ${saved.filename}`);
    setRecentFiles((files) => addRecentFile(files, saved.path));
  }

  const handleWindowShortcuts = useEffectEvent((event: KeyboardEvent) => {
    const hasModifier = event.metaKey || event.ctrlKey;
    if (!hasModifier) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "n") {
      event.preventDefault();
      handleNewDocument();
      return;
    }

    if (key === "o") {
      event.preventDefault();
      void handleOpenClick();
      return;
    }

    if (key === "s") {
      event.preventDefault();
      void handleSave(event.shiftKey);
    }
  });

  const handleMenuNew = useEffectEvent(() => {
    handleNewDocument();
  });

  const handleMenuOpen = useEffectEvent(() => {
    void handleOpenClick();
  });

  const handleMenuOpenRecent = useEffectEvent((path: string) => {
    void handleOpenRecent(path);
  });

  const handleMenuSave = useEffectEvent((saveAs = false) => {
    void handleSave(saveAs);
  });

  const handleMenuTogglePreview = useEffectEvent(() => {
    setIsPreviewVisible((value) => !value);
  });

  const handleMenuToggleToc = useEffectEvent(() => {
    setIsTocVisible((value) => !value);
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      handleWindowShortcuts(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleWindowShortcuts]);

  useEffect(() => {
    let cleanup: (() => Promise<void>) | undefined;

    void setupAppMenu({
      onNew: handleMenuNew,
      onOpen: handleMenuOpen,
      onOpenRecent: handleMenuOpenRecent,
      onSave: () => handleMenuSave(false),
      onSaveAs: () => handleMenuSave(true),
      onTogglePreview: handleMenuTogglePreview,
      onToggleToc: handleMenuToggleToc,
      recentFiles,
    }).then((dispose) => {
      cleanup = dispose;
    });

    return () => {
      void cleanup?.();
    };
  }, [
    handleMenuNew,
    handleMenuOpen,
    handleMenuOpenRecent,
    handleMenuSave,
    handleMenuTogglePreview,
    handleMenuToggleToc,
    recentFiles,
  ]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <strong>ClipMark</strong>
          <span className="brand__tag">Archive-first Markdown editor</span>
        </div>
        <div className="toolbar">
          <button onClick={handleNewDocument} type="button">
            New
          </button>
          <button onClick={() => void handleOpenClick()} type="button">
            Open
          </button>
          <button onClick={() => void handleSave()} type="button">
            Save
          </button>
          <button onClick={() => void handleSave(true)} type="button">
            Save As
          </button>
          <button
            onClick={() => setIsTocVisible((value) => !value)}
            type="button"
          >
            TOC
          </button>
          <button
            onClick={() => setIsPreviewVisible((value) => !value)}
            type="button"
          >
            Preview
          </button>
        </div>
      </header>

      <main className="workspace">
        {isTocVisible ? <TocPanel headings={headings} /> : null}
        <section className="panel panel--editor">
          <div className="panel__header">
            <span>{filename}</span>
            <div className="panel__meta">
              {filePath ? <span className="status">{filePath}</span> : null}
              <span className={isDirty ? "status status--dirty" : "status"}>
                {isDirty ? "Unsaved changes" : "Saved"}
              </span>
            </div>
          </div>
          <MarkdownEditor value={markdown} onChange={setMarkdown} />
        </section>
        {isPreviewVisible ? (
          <section className="panel panel--preview">
            <div className="panel__header">
              <span>Preview</span>
              <span className="status">{statusText}</span>
            </div>
            <MarkdownPreview markdown={deferredMarkdown} />
          </section>
        ) : null}
      </main>

      {recentFiles.length > 0 ? (
        <section className="recent-files">
          <div className="recent-files__header">
            <strong>Recent Files</strong>
            <span className="status">{recentFiles.length} items</span>
          </div>
          <div className="recent-files__list">
            {recentFiles.map((file) => (
              <button
                className="recent-files__item"
                key={file.path}
                onClick={() => void handleOpenRecent(file.path)}
                type="button"
              >
                <span>{file.filename}</span>
                <span className="status">{file.path}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <input
        accept=".md,text/markdown,text/plain"
        className="file-input"
        onChange={handleOpenFile}
        ref={fileInputRef}
        type="file"
      />
    </div>
  );
}
