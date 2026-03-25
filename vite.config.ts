import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (
            id.includes("/react/")
            || id.includes("/react-dom/")
            || id.includes("/scheduler/")
          ) {
            return "framework";
          }

          if (
            id.includes("/@tauri-apps/")
          ) {
            return "native";
          }

          if (
            id.includes("/@codemirror/lang-markdown/")
          ) {
            return "editor-markdown";
          }

          if (
            id.includes("/codemirror/")
          ) {
            return "editor-setup";
          }

          if (
            id.includes("/@codemirror/")
            || id.includes("/@lezer/")
          ) {
            return "editor";
          }

          if (
            id.includes("/react-markdown/")
            || id.includes("/remark-gfm/")
            || id.includes("/rehype-raw/")
          ) {
            return "preview";
          }

          return "vendor";
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
