# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the React frontend. Put shared UI state in `src/hooks/`, pure application logic in `src/lib/`, and keep entry points in `src/main.tsx` and `src/App.tsx`. Tests live beside the code they cover as `*.test.ts`, with shared browser mocks in `src/test/setup.ts`. Desktop integration lives in `src-tauri/`: Rust code is under `src-tauri/src/`, capabilities in `src-tauri/capabilities/`, and app config in `src-tauri/tauri.conf.json`. Product and architecture notes now live in `docs/`, including `docs/PRD.md`, `docs/TECH_DECISIONS.md`, `docs/USER_FLOWS.md`, and `docs/PASTE_RULES.md`. Treat `dist/` and `src-tauri/target/` as generated artifacts.

## Build, Test, and Development Commands
Use `npm run dev` to start the Vite app on `127.0.0.1:1420`. Use `npm run tauri:dev` when changes touch native windowing, menus, or file system behavior. `npm run build` runs `tsc` and produces the frontend bundle. `npm run test` runs the Vitest suite once, and `npm run test:watch` is the default loop while editing hooks or utilities. Use `npm run tauri:build` for release desktop builds.

## Coding Style & Naming Conventions
Follow the existing TypeScript and Rust style instead of introducing a new formatter. Frontend files use 2-space indentation, double quotes, and trailing commas where the current code does. Name React components in PascalCase (`EditorWorkspace.tsx`), hooks in camelCase with a `use` prefix (`useDocumentSession.ts`), and utility modules in kebab-case (`native-open-document.ts`). Prefer small pure helpers in `src/lib/` and keep Tauri-specific logic behind narrow adapters.

## Testing Guidelines
Vitest runs in a `jsdom` environment and only includes `src/**/*.test.ts`. By default, add or update tests only for business logic changes, especially menu state, document lifecycle, file system access, and native bridge wrappers, or when the user explicitly asks for tests or verification. Do not create or expand tests by default for presentational refactors such as component moves, barrel exports, or import-path cleanup unless the user requests it. Mirror the source filename when possible, for example `src/lib/paste.ts` with `src/lib/paste.test.ts`. Run `npm run test` before opening a PR when tests were changed or when the affected behavior is covered by existing automated tests; use `npm run tauri:dev` for manual verification of macOS-specific flows.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commits, usually with a scope: `feat(settings): ...`, `fix(menu): ...`, `refactor(app): ...`. Keep subjects imperative and specific. Pull requests should explain intent, affected flows, and user-visible impact before reviewers open the diff. Link related issues, list commands you ran, and include screenshots or short recordings for UI changes. Call out platform-specific behavior, especially when a change depends on Tauri or macOS window/menu behavior.
