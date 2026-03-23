import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { loadAppPreferences } from "./lib/preview-preferences";
import "./styles.css";

async function main() {
  const initialPreferences = await loadAppPreferences();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App initialPreferences={initialPreferences} />
    </React.StrictMode>,
  );
}

void main();
