import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ToastProvider } from "./components/toast/ToastProvider";
import { loadAppPreferences } from "./lib/preview-preferences";
import { applyTheme } from "./lib/theme";
import "./styles.css";

async function main() {
  const initialPreferences = await loadAppPreferences();
  applyTheme(initialPreferences.themeMode);

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ToastProvider>
        <App initialPreferences={initialPreferences} />
      </ToastProvider>
    </React.StrictMode>,
  );
}

void main();
