import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { readMarkdownDocumentAtPath, type OpenedDocument } from "./lib/file-system";
import { loadAppPreferences } from "./lib/preview-preferences";
import { applyTheme } from "./lib/theme";
import "./styles.css";

async function main() {
  const initialPreferences = await loadAppPreferences();
  applyTheme(initialPreferences.themeMode);

  const params = new URLSearchParams(window.location.search);
  const filePath = params.get("path");

  let initialDocument: OpenedDocument | null = null;
  if (filePath) {
    initialDocument = await readMarkdownDocumentAtPath(filePath).catch(() => null);
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App initialDocument={initialDocument} initialPreferences={initialPreferences} />
    </React.StrictMode>,
  );
}

void main();
