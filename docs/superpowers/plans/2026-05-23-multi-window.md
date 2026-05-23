# ClipMark Multi-Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support multiple ClipMark document windows while preventing the same file from being edited in more than one window.

**Architecture:** Keep one React app instance and one `DocumentStore` per WebviewWindow. Add a Rust `WindowRegistry` that maps normalized file paths to window labels, then route `New`, `Open`, Finder open events, save path registration, and close cleanup through Tauri commands.

**Tech Stack:** Tauri 2, Rust, React 19, TypeScript, Vitest, jsdom.

---

## File Structure

- Modify: `src-tauri/src/main.rs`
  - Add `WindowRegistry`, path normalization, window creation/focus helpers, document path registration commands, and close command.
  - Replace `"main"` reopen/open-file assumptions with registry-based orchestration.
- Create: `src/lib/document-window.ts`
  - Frontend adapter around Tauri window commands.
- Modify: `src/lib/file-system.ts`
  - Split “pick path” from “open and apply document”, add Save As target conflict checking.
- Modify: `src/lib/file-system.test.ts`
  - Cover Save As conflict behavior and path-only picker behavior.
- Modify: `src/hooks/useDocumentFileActions.ts`
  - Make `New`, `Open`, and `Open Recent` window-oriented instead of current-document replacement.
- Modify: `src/hooks/useDocumentFileActions.test.tsx`
  - Verify window commands are called and dirty current document is not replaced by open/new actions.
- Create: `src/hooks/useInitialDocumentPath.ts`
  - Read initial `path` query parameter and apply the opened document once per window.
- Create: `src/hooks/useInitialDocumentPath.test.tsx`
  - Verify initial file path loads into the current window.
- Modify: `src/hooks/useDocumentSession.ts`
  - Expose initial path application and register saved/opened paths.
- Modify: `src/hooks/useAppShellLifecycle.ts`
  - Replace hide/reset close session with actual native close command.
- Modify: `src/hooks/useAppShellLifecycle.test.tsx`
  - Update close expectation from hide/reset to close-window command.
- Modify: `src/hooks/useNativeWindowState.ts`
  - Track focused state and expose whether the current window should sync menus.
- Modify: `src/hooks/useAppMenuController.ts`
  - Sync app menu only while the current window is focused.
- Modify: `src/lib/menu.test.ts`
  - Keep app menu construction tests passing while focus-gated behavior is covered in `useAppMenuController.test.ts`.
- Modify: `src/App.tsx`
  - Wire initial path loading, new window actions, focused menu sync, and close behavior.

---

### Task 1: Rust Window Registry

**Files:**
- Modify: `src-tauri/src/main.rs`

- [x] **Step 1: Write failing Rust tests for registry behavior**

Add these helpers and tests inside the existing `#[cfg(test)] mod tests` in `src-tauri/src/main.rs`. The implementation types do not exist yet, so this should fail to compile.

```rust
#[test]
fn window_registry_reuses_existing_window_for_open_path() {
    let mut registry = WindowRegistry::default();
    let path = normalize_document_path_for_registry("/tmp/clipmark-a.md");

    registry.register_window("main".to_string());
    registry.register_document_path("main", Some(path.clone()));

    assert_eq!(
        registry.window_for_path(&path),
        Some("main".to_string())
    );
}

#[test]
fn window_registry_replaces_old_path_when_window_document_changes() {
    let mut registry = WindowRegistry::default();
    let old_path = normalize_document_path_for_registry("/tmp/old.md");
    let new_path = normalize_document_path_for_registry("/tmp/new.md");

    registry.register_window("document-1".to_string());
    registry.register_document_path("document-1", Some(old_path.clone()));
    registry.register_document_path("document-1", Some(new_path.clone()));

    assert_eq!(registry.window_for_path(&old_path), None);
    assert_eq!(
        registry.window_for_path(&new_path),
        Some("document-1".to_string())
    );
}

#[test]
fn window_registry_detects_paths_open_in_other_windows() {
    let mut registry = WindowRegistry::default();
    let path = normalize_document_path_for_registry("/tmp/shared.md");

    registry.register_window("main".to_string());
    registry.register_window("document-1".to_string());
    registry.register_document_path("document-1", Some(path.clone()));

    assert!(registry.is_path_open_elsewhere("main", &path));
    assert!(!registry.is_path_open_elsewhere("document-1", &path));
}

#[test]
fn window_registry_removes_window_mappings_on_close() {
    let mut registry = WindowRegistry::default();
    let path = normalize_document_path_for_registry("/tmp/closing.md");

    registry.register_window("document-2".to_string());
    registry.register_document_path("document-2", Some(path.clone()));
    registry.unregister_window("document-2");

    assert_eq!(registry.window_for_path(&path), None);
}
```

- [x] **Step 2: Run Rust tests and verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml window_registry`

Expected: FAIL because `WindowRegistry` and `normalize_document_path_for_registry` are not defined.

- [x] **Step 3: Add minimal registry implementation**

Add imports near the top of `src-tauri/src/main.rs`:

```rust
use std::collections::HashMap;
```

Add the registry types near `PreferencesState`:

```rust
#[derive(Default)]
struct WindowRegistry {
    next_window_id: u64,
    window_paths: HashMap<String, Option<String>>,
    path_windows: HashMap<String, String>,
}

impl WindowRegistry {
    fn register_window(&mut self, label: String) {
        self.window_paths.entry(label).or_insert(None);
    }

    fn next_document_label(&mut self) -> String {
        self.next_window_id += 1;
        format!("document-{}", self.next_window_id)
    }

    fn register_document_path(&mut self, label: &str, path: Option<String>) {
        if let Some(Some(previous_path)) = self.window_paths.get(label) {
            self.path_windows.remove(previous_path);
        }

        self.window_paths.insert(label.to_string(), path.clone());

        if let Some(next_path) = path {
            self.path_windows.insert(next_path, label.to_string());
        }
    }

    fn unregister_window(&mut self, label: &str) {
        if let Some(Some(path)) = self.window_paths.remove(label) {
            self.path_windows.remove(&path);
        }
    }

    fn window_for_path(&self, path: &str) -> Option<String> {
        self.path_windows.get(path).cloned()
    }

    fn is_path_open_elsewhere(&self, label: &str, path: &str) -> bool {
        self.path_windows
            .get(path)
            .is_some_and(|window_label| window_label != label)
    }
}

struct WindowRegistryState {
    registry: Mutex<WindowRegistry>,
}

fn normalize_document_path_for_registry(path: &str) -> String {
    fs::canonicalize(path)
        .unwrap_or_else(|_| PathBuf::from(path))
        .to_string_lossy()
        .to_string()
}
```

- [x] **Step 4: Run Rust registry tests and verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml window_registry`

Expected: PASS for the four registry tests.

- [x] **Step 5: Commit**

```bash
git add src-tauri/src/main.rs
git commit -m "feat(window): add document window registry"
```

---

### Task 2: Rust Window Commands

**Files:**
- Modify: `src-tauri/src/main.rs`

- [x] **Step 1: Write failing tests for path conflict command helper**

Add a pure helper so command behavior can be tested without constructing a Tauri window:

```rust
#[test]
fn document_path_open_elsewhere_helper_uses_registry() {
    let mut registry = WindowRegistry::default();
    let path = normalize_document_path_for_registry("/tmp/shared-save-as.md");

    registry.register_window("main".to_string());
    registry.register_window("document-1".to_string());
    registry.register_document_path("document-1", Some(path.clone()));

    assert!(is_document_path_open_elsewhere_in_registry(
        &registry,
        "main",
        "/tmp/shared-save-as.md",
    ));
    assert!(!is_document_path_open_elsewhere_in_registry(
        &registry,
        "document-1",
        "/tmp/shared-save-as.md",
    ));
}
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml document_path_open_elsewhere_helper_uses_registry`

Expected: FAIL because `is_document_path_open_elsewhere_in_registry` does not exist.

- [x] **Step 3: Implement command helpers and commands**

Add imports:

```rust
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
```

Replace the existing `use tauri::{AppHandle, Emitter, Manager, State};` line with the import above.

Add constants:

```rust
const DEFAULT_WINDOW_WIDTH: f64 = 1440.0;
const DEFAULT_WINDOW_HEIGHT: f64 = 920.0;
const DEFAULT_WINDOW_MIN_WIDTH: f64 = 1100.0;
const DEFAULT_WINDOW_MIN_HEIGHT: f64 = 720.0;
```

Add helpers and commands:

```rust
fn encoded_document_url(path: Option<&str>) -> WebviewUrl {
    match path {
        Some(path) => WebviewUrl::App(format!("index.html?path={}", urlencoding::encode(path)).into()),
        None => WebviewUrl::App("index.html".into()),
    }
}

fn focus_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

fn create_document_window_with_path(
    app_handle: &AppHandle,
    registry_state: &State<'_, WindowRegistryState>,
    path: Option<String>,
) -> Result<(), String> {
    let label = {
        let mut registry = registry_state
            .registry
            .lock()
            .map_err(|error| error.to_string())?;
        let label = registry.next_document_label();
        registry.register_window(label.clone());
        label
    };

    WebviewWindowBuilder::new(app_handle, label, encoded_document_url(path.as_deref()))
        .title("ClipMark")
        .inner_size(DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT)
        .min_inner_size(DEFAULT_WINDOW_MIN_WIDTH, DEFAULT_WINDOW_MIN_HEIGHT)
        .build()
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn open_document_window_with_path(
    app_handle: &AppHandle,
    registry_state: &State<'_, WindowRegistryState>,
    path: String,
) -> Result<(), String> {
    let normalized_path = normalize_document_path_for_registry(&path);
    let existing_label = {
        let registry = registry_state
            .registry
            .lock()
            .map_err(|error| error.to_string())?;
        registry.window_for_path(&normalized_path)
    };

    if let Some(label) = existing_label {
        if let Some(window) = app_handle.get_webview_window(&label) {
            return focus_window(&window);
        }
    }

    create_document_window_with_path(app_handle, registry_state, Some(path))
}

fn is_document_path_open_elsewhere_in_registry(
    registry: &WindowRegistry,
    label: &str,
    path: &str,
) -> bool {
    let normalized_path = normalize_document_path_for_registry(path);
    registry.is_path_open_elsewhere(label, &normalized_path)
}

#[tauri::command]
fn create_document_window(
    app_handle: AppHandle,
    registry_state: State<'_, WindowRegistryState>,
) -> Result<(), String> {
    create_document_window_with_path(&app_handle, &registry_state, None)
}

#[tauri::command]
fn open_document_window(
    app_handle: AppHandle,
    registry_state: State<'_, WindowRegistryState>,
    path: String,
) -> Result<(), String> {
    open_document_window_with_path(&app_handle, &registry_state, path)
}

#[tauri::command]
fn register_window_document_path(
    window: tauri::Window,
    registry_state: State<'_, WindowRegistryState>,
    path: Option<String>,
) -> Result<(), String> {
    let label = window.label().to_string();
    let normalized_path = path.map(|path| normalize_document_path_for_registry(&path));
    let mut registry = registry_state
        .registry
        .lock()
        .map_err(|error| error.to_string())?;
    registry.register_window(label.clone());
    registry.register_document_path(&label, normalized_path);
    Ok(())
}

#[tauri::command]
fn is_document_path_open_elsewhere(
    window: tauri::Window,
    registry_state: State<'_, WindowRegistryState>,
    path: String,
) -> Result<bool, String> {
    let registry = registry_state
        .registry
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(is_document_path_open_elsewhere_in_registry(
        &registry,
        window.label(),
        &path,
    ))
}

#[tauri::command]
fn close_document_window(
    window: tauri::Window,
    registry_state: State<'_, WindowRegistryState>,
) -> Result<(), String> {
    let label = window.label().to_string();
    {
        let mut registry = registry_state
            .registry
            .lock()
            .map_err(|error| error.to_string())?;
        registry.unregister_window(&label);
    }
    window.close().map_err(|error| error.to_string())
}
```

In `setup`, register the default window:

```rust
app.manage(WindowRegistryState {
    registry: Mutex::new(WindowRegistry::default()),
});

if let Some(window) = app.get_webview_window("main") {
    let registry_state = app.state::<WindowRegistryState>();
    let mut registry = registry_state
        .registry
        .lock()
        .map_err(|error| error.to_string())?;
    registry.register_window(window.label().to_string());
}
```

Add the new commands to `tauri::generate_handler!`:

```rust
close_document_window,
create_document_window,
is_document_path_open_elsewhere,
open_document_window,
register_window_document_path,
```

- [x] **Step 4: Add dependency for query encoding**

Modify `src-tauri/Cargo.toml`:

```toml
urlencoding = "2"
```

- [x] **Step 5: Run Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src-tauri/src/main.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat(window): add multi-window commands"
```

---

### Task 3: Rust Open/Reopen Events

**Files:**
- Modify: `src-tauri/src/main.rs`

- [x] **Step 1: Update `RunEvent::Opened` to route through window orchestration**

Replace the current `RunEvent::Opened` branch with:

```rust
tauri::RunEvent::Opened { urls } => {
    let registry_state = app_handle.state::<WindowRegistryState>();
    for url in urls {
        let Ok(path) = url.to_file_path() else {
            continue;
        };

        let Some(path) = path.to_str() else {
            continue;
        };

        let _ = open_document_window_with_path(
            app_handle,
            &registry_state,
            path.to_string(),
        );
    }
}
```

- [x] **Step 2: Update `RunEvent::Reopen` to create a fresh empty window**

Replace the `"main"` lookup in `RunEvent::Reopen { has_visible_windows: false, .. }` with:

```rust
let registry_state = app_handle.state::<WindowRegistryState>();
let _ = create_document_window_with_path(app_handle, &registry_state, None);
```

- [x] **Step 3: Remove unused open-document event pieces**

Remove:

```rust
use tauri::Emitter;
const OPEN_DOCUMENT_EVENT: &str = "clipmark://open-document";
```

The frontend listener will be removed in a later task.

- [x] **Step 4: Run Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src-tauri/src/main.rs
git commit -m "feat(window): route native open events to document windows"
```

---

### Task 4: Frontend Window Command Adapter

**Files:**
- Create: `src/lib/document-window.ts`
- Create: `src/lib/document-window.test.ts`

- [x] **Step 1: Write failing adapter tests**

Create `src/lib/document-window.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeCurrentDocumentWindow,
  createDocumentWindow,
  isDocumentPathOpenElsewhere,
  openDocumentWindow,
  registerWindowDocumentPath,
} from "./document-window";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (command: string, args?: unknown) => invoke(command, args),
}));

vi.mock("./file-system", () => ({
  isTauriRuntime: () => true,
}));

describe("document-window", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("creates a new document window", async () => {
    await createDocumentWindow();
    expect(invoke).toHaveBeenCalledWith("create_document_window");
  });

  it("opens a document path through the native window registry", async () => {
    await openDocumentWindow("/tmp/a.md");
    expect(invoke).toHaveBeenCalledWith("open_document_window", {
      path: "/tmp/a.md",
    });
  });

  it("registers the current window document path", async () => {
    await registerWindowDocumentPath("/tmp/a.md");
    expect(invoke).toHaveBeenCalledWith("register_window_document_path", {
      path: "/tmp/a.md",
    });
  });

  it("checks whether a Save As target is open in another window", async () => {
    invoke.mockResolvedValue(true);
    await expect(isDocumentPathOpenElsewhere("/tmp/a.md")).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith("is_document_path_open_elsewhere", {
      path: "/tmp/a.md",
    });
  });

  it("closes the current document window", async () => {
    await closeCurrentDocumentWindow();
    expect(invoke).toHaveBeenCalledWith("close_document_window");
  });
});
```

- [x] **Step 2: Run adapter tests and verify they fail**

Run: `npm run test -- src/lib/document-window.test.ts`

Expected: FAIL because `src/lib/document-window.ts` does not exist.

- [x] **Step 3: Implement adapter**

Create `src/lib/document-window.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./file-system";

export async function createDocumentWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("create_document_window");
}

export async function openDocumentWindow(path: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("open_document_window", { path });
}

export async function registerWindowDocumentPath(
  path: string | null,
): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("register_window_document_path", { path });
}

export async function isDocumentPathOpenElsewhere(
  path: string,
): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  return invoke<boolean>("is_document_path_open_elsewhere", { path });
}

export async function closeCurrentDocumentWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("close_document_window");
}
```

- [x] **Step 4: Run adapter tests**

Run: `npm run test -- src/lib/document-window.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/document-window.ts src/lib/document-window.test.ts
git commit -m "feat(window): add frontend document window adapter"
```

---

### Task 5: File System Path Picking And Save As Conflict

**Files:**
- Modify: `src/lib/file-system.ts`
- Modify: `src/lib/file-system.test.ts`

- [x] **Step 1: Add failing tests for save conflict helper**

Extend `src/lib/file-system.test.ts`:

```ts
import { beforeEach, vi } from "vitest";

const isDocumentPathOpenElsewhere = vi.fn();

vi.mock("./document-window", () => ({
  isDocumentPathOpenElsewhere: (path: string) => isDocumentPathOpenElsewhere(path),
}));
```

Add tests:

```ts
describe("getFilenameFromPath", () => {
  // keep existing tests
});

describe("ensureMarkdownExtension", () => {
  // keep existing tests
});

describe("assertSaveTargetAvailable", () => {
  beforeEach(() => {
    isDocumentPathOpenElsewhere.mockReset();
  });

  it("allows a target path that is not open elsewhere", async () => {
    isDocumentPathOpenElsewhere.mockResolvedValue(false);

    await expect(assertSaveTargetAvailable("/tmp/free.md")).resolves.toBeUndefined();
  });

  it("rejects a target path that is open in another window", async () => {
    isDocumentPathOpenElsewhere.mockResolvedValue(true);

    await expect(assertSaveTargetAvailable("/tmp/open.md")).rejects.toThrow(
      "That file is already open in another window.",
    );
  });
});
```

Update the import list to include `assertSaveTargetAvailable`.

- [x] **Step 2: Run file-system tests and verify they fail**

Run: `npm run test -- src/lib/file-system.test.ts`

Expected: FAIL because `assertSaveTargetAvailable` does not exist.

- [x] **Step 3: Implement path-only picker and conflict helper**

Modify `src/lib/file-system.ts`:

```ts
import { isDocumentPathOpenElsewhere } from "./document-window";
```

Add:

```ts
export async function pickMarkdownDocumentPath(): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  const [{ open }] = await Promise.all([import("@tauri-apps/plugin-dialog")]);

  const selected = await open({
    directory: false,
    filters: MARKDOWN_FILTERS,
    multiple: false,
  });

  if (!selected || Array.isArray(selected)) {
    return null;
  }

  return selected;
}

export async function assertSaveTargetAvailable(path: string): Promise<void> {
  const isOpenElsewhere = await isDocumentPathOpenElsewhere(path);
  if (isOpenElsewhere) {
    throw new Error("That file is already open in another window.");
  }
}
```

Update `openMarkdownDocument()` to use `pickMarkdownDocumentPath()`:

```ts
export async function openMarkdownDocument(): Promise<OpenedDocument | null> {
  const selected = await pickMarkdownDocumentPath();
  if (!selected) {
    return null;
  }

  const markdown = await invoke<string>("read_markdown_file", { path: selected });
  return {
    filename: getFilenameFromPath(selected),
    markdown,
    path: selected,
  };
}
```

In `saveMarkdownDocument`, after `targetPath` is selected and before `write_markdown_file`, add:

```ts
if (saveAs || targetPath !== path) {
  await assertSaveTargetAvailable(targetPath);
}
```

- [x] **Step 4: Run file-system tests**

Run: `npm run test -- src/lib/file-system.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/file-system.ts src/lib/file-system.test.ts
git commit -m "feat(files): prevent save as conflicts across windows"
```

---

### Task 6: Document File Actions Become Window-Oriented

**Files:**
- Modify: `src/hooks/useDocumentFileActions.ts`
- Modify: `src/hooks/useDocumentFileActions.test.tsx`
- Modify: `src/hooks/useDocumentSession.ts`
- Modify: `src/hooks/useAppShellActions.ts`

- [x] **Step 1: Update failing tests for New/Open/Open Recent behavior**

In `src/hooks/useDocumentFileActions.test.tsx`, add mocks:

```ts
const createDocumentWindow = vi.fn();
const openDocumentWindow = vi.fn();
const pickMarkdownDocumentPath = vi.fn();

vi.mock("../lib/document-window", () => ({
  createDocumentWindow: () => createDocumentWindow(),
  openDocumentWindow: (path: string) => openDocumentWindow(path),
}));
```

Update the `../lib/file-system` mock to include:

```ts
pickMarkdownDocumentPath: () => pickMarkdownDocumentPath(),
```

Add tests:

```ts
it("creates a new native document window instead of replacing the current document", async () => {
  const createNewDocument = vi.fn();

  await act(async () => {
    root.render(createElement(Harness, {
      onReady: (nextControls) => {
        controls = nextControls;
      },
      overrides: {
        createNewDocument,
      },
    }));
  });

  await act(async () => {
    await controls.createNewDocumentWindow();
  });

  expect(createDocumentWindow).toHaveBeenCalledTimes(1);
  expect(createNewDocument).not.toHaveBeenCalled();
});

it("opens picker results through native document windows", async () => {
  const applyOpenedDocument = vi.fn();
  pickMarkdownDocumentPath.mockResolvedValue("/tmp/open.md");

  await act(async () => {
    root.render(createElement(Harness, {
      onReady: (nextControls) => {
        controls = nextControls;
      },
      overrides: {
        applyOpenedDocument,
      },
    }));
  });

  await act(async () => {
    await controls.openWithPicker();
  });

  expect(openDocumentWindow).toHaveBeenCalledWith("/tmp/open.md");
  expect(applyOpenedDocument).not.toHaveBeenCalled();
});

it("opens recent files through native document windows", async () => {
  await act(async () => {
    root.render(createElement(Harness, {
      onReady: (nextControls) => {
        controls = nextControls;
      },
    }));
  });

  await act(async () => {
    await controls.openRecentDocumentWindow("/tmp/recent.md");
  });

  expect(openDocumentWindow).toHaveBeenCalledWith("/tmp/recent.md");
  expect(openRecentFile).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run hook tests and verify they fail**

Run: `npm run test -- src/hooks/useDocumentFileActions.test.tsx`

Expected: FAIL because the new controls and mocks are not implemented.

- [x] **Step 3: Implement window-oriented actions**

Modify `src/hooks/useDocumentFileActions.ts` imports:

```ts
import {
  pickMarkdownDocumentPath,
  saveMarkdownDocument,
} from "../lib/file-system";
import {
  createDocumentWindow,
  openDocumentWindow,
} from "../lib/document-window";
```

Add returned controls:

```ts
const createNewDocumentWindow = useEffectEvent(async () => {
  await createDocumentWindow();
});

const openRecentDocumentWindow = useEffectEvent(async (path: string) => {
  await openDocumentWindow(path);
});
```

Replace `openWithPicker` body with:

```ts
const openWithPicker = useEffectEvent(async (fallbackToFileInput = true) => {
  const path = await pickMarkdownDocumentPath();
  if (!path) {
    if (fallbackToFileInput) {
      fileInputRef.current?.click();
    }
    return null;
  }

  await openDocumentWindow(path);
  return null;
});
```

Keep `loadRecentDocument` for initial path loading and missing-file handling. Return the new controls:

```ts
return {
  createNewDocumentWindow,
  fileInputRef,
  handleOpenFile,
  loadRecentDocument,
  openRecentDocumentWindow,
  openWithPicker,
  openWithPickerWithoutShowingWindow,
  saveDocument,
};
```

Modify `src/hooks/useDocumentSession.ts` to expose `createNewDocumentWindow` and `openRecentDocumentWindow`.

Modify `src/hooks/useAppShellActions.ts` so menu and welcome New/Open Recent use the window-oriented controls:

```ts
createNewDocumentWindow: () => Promise<void>;
openRecentDocumentWindow: (path: string) => Promise<void>;
```

Then:

```ts
const handleMenuNew = useEffectEvent(() => {
  void createNewDocumentWindow();
});

const handleMenuOpenRecent = useEffectEvent((path: string) => {
  void openRecentDocumentWindow(path);
});

const handleWelcomeNew = useEffectEvent(() => {
  void createNewDocumentWindow();
});

const handleWelcomeOpenRecent = useEffectEvent((path: string) => {
  void openRecentDocumentWindow(path);
});
```

Keep `handleMenuOpen` and `handleWelcomeOpen` calling `openWithPicker()` through lifecycle until Task 8 removes hidden-window special cases.

- [x] **Step 4: Run hook tests**

Run: `npm run test -- src/hooks/useDocumentFileActions.test.tsx src/hooks/useAppShellActions.test.tsx`

Expected: PASS after updating expected calls in `useAppShellActions.test.tsx` from pending actions to window action mocks.

- [x] **Step 5: Commit**

```bash
git add src/hooks/useDocumentFileActions.ts src/hooks/useDocumentFileActions.test.tsx src/hooks/useDocumentSession.ts src/hooks/useAppShellActions.ts src/hooks/useAppShellActions.test.tsx
git commit -m "feat(files): open documents in separate windows"
```

---

### Task 7: Initial Document Path Loading

**Files:**
- Create: `src/hooks/useInitialDocumentPath.ts`
- Create: `src/hooks/useInitialDocumentPath.test.tsx`
- Modify: `src/App.tsx`

- [x] **Step 1: Write failing initial path tests**

Create `src/hooks/useInitialDocumentPath.test.tsx`:

```tsx
import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInitialDocumentPath } from "./useInitialDocumentPath";

function Harness({
  applyOpenedDocument,
  loadRecentDocument,
  search,
}: {
  applyOpenedDocument: (document: { filename: string; markdown: string; path: string | null }) => void;
  loadRecentDocument: (path: string) => Promise<{ filename: string; markdown: string; path: string | null } | null>;
  search: string;
}) {
  useInitialDocumentPath({
    applyOpenedDocument,
    loadRecentDocument,
    search,
  });

  return null;
}

describe("useInitialDocumentPath", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("loads the encoded path from the window query string once", async () => {
    const document = {
      filename: "note.md",
      markdown: "# Note",
      path: "/tmp/note.md",
    };
    const loadRecentDocument = vi.fn().mockResolvedValue(document);
    const applyOpenedDocument = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        applyOpenedDocument,
        loadRecentDocument,
        search: "?path=%2Ftmp%2Fnote.md",
      }));
    });

    expect(loadRecentDocument).toHaveBeenCalledWith("/tmp/note.md");
    expect(applyOpenedDocument).toHaveBeenCalledWith(document);
  });

  it("does nothing when the query string has no path", async () => {
    const loadRecentDocument = vi.fn();
    const applyOpenedDocument = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        applyOpenedDocument,
        loadRecentDocument,
        search: "",
      }));
    });

    expect(loadRecentDocument).not.toHaveBeenCalled();
    expect(applyOpenedDocument).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run initial path tests and verify they fail**

Run: `npm run test -- src/hooks/useInitialDocumentPath.test.tsx`

Expected: FAIL because the hook does not exist.

- [x] **Step 3: Implement hook**

Create `src/hooks/useInitialDocumentPath.ts`:

```ts
import { useEffect, useRef } from "react";

type OpenedDocumentLike = {
  filename: string;
  markdown: string;
  path: string | null;
};

type UseInitialDocumentPathOptions = {
  applyOpenedDocument: (document: OpenedDocumentLike) => void;
  loadRecentDocument: (path: string) => Promise<OpenedDocumentLike | null>;
  search?: string;
};

export function getInitialDocumentPath(search: string): string | null {
  const params = new URLSearchParams(search);
  const path = params.get("path");
  return path && path.length > 0 ? path : null;
}

export function useInitialDocumentPath({
  applyOpenedDocument,
  loadRecentDocument,
  search = window.location.search,
}: UseInitialDocumentPathOptions) {
  const consumedPathRef = useRef<string | null>(null);

  useEffect(() => {
    const path = getInitialDocumentPath(search);
    if (!path || consumedPathRef.current === path) {
      return;
    }

    consumedPathRef.current = path;
    void loadRecentDocument(path).then((document) => {
      if (document) {
        applyOpenedDocument(document);
      }
    });
  }, [applyOpenedDocument, loadRecentDocument, search]);
}
```

- [x] **Step 4: Wire hook in App**

In `src/App.tsx`, import and call:

```ts
import { useInitialDocumentPath } from "./hooks/useInitialDocumentPath";
```

After `session` is created:

```ts
useInitialDocumentPath({
  applyOpenedDocument: session.applyOpenedDocument,
  loadRecentDocument: session.loadRecentDocument,
});
```

- [x] **Step 5: Run tests**

Run: `npm run test -- src/hooks/useInitialDocumentPath.test.tsx src/App.test.tsx`

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/hooks/useInitialDocumentPath.ts src/hooks/useInitialDocumentPath.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat(files): load initial document path per window"
```

---

### Task 8: Register Current Window Document Path

**Files:**
- Modify: `src/hooks/useDocumentSessionFileEffects.ts`
- Modify: `src/hooks/useDocumentSessionFileEffects.test.tsx`
- Modify: `src/hooks/useDocumentSession.ts`

- [x] **Step 1: Add failing tests for registry registration**

In `src/hooks/useDocumentSessionFileEffects.test.tsx`, mock:

```ts
const registerWindowDocumentPath = vi.fn();

vi.mock("../lib/document-window", () => ({
  registerWindowDocumentPath: (path: string | null) => registerWindowDocumentPath(path),
}));
```

Add expectations to opened and saved document tests:

```ts
expect(registerWindowDocumentPath).toHaveBeenCalledWith("/tmp/opened.md");
```

For missing/closed state, add:

```ts
expect(registerWindowDocumentPath).toHaveBeenCalledWith(null);
```

- [x] **Step 2: Run tests and verify they fail**

Run: `npm run test -- src/hooks/useDocumentSessionFileEffects.test.tsx`

Expected: FAIL because the hook does not register paths.

- [x] **Step 3: Register paths after opened/saved/closed state changes**

In `src/hooks/useDocumentSessionFileEffects.ts`, import:

```ts
import { registerWindowDocumentPath } from "../lib/document-window";
```

After applying an opened document:

```ts
void registerWindowDocumentPath(document.path);
```

After applying a saved document:

```ts
void registerWindowDocumentPath(saved.path);
```

When closing current document or returning to welcome through session state, call:

```ts
void registerWindowDocumentPath(null);
```

If this hook does not own close, pass a `registerWindowDocumentPath(null)` call from `useDocumentWorkspaceState.closeCurrentDocument()` through `useDocumentSession`.

- [x] **Step 4: Run tests**

Run: `npm run test -- src/hooks/useDocumentSessionFileEffects.test.tsx src/hooks/useDocumentSessionFileEffects.test.tsx`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/hooks/useDocumentSessionFileEffects.ts src/hooks/useDocumentSessionFileEffects.test.tsx src/hooks/useDocumentSession.ts
git commit -m "feat(window): register document paths per window"
```

---

### Task 9: Actual Window Close Instead Of Hide And Reset

**Files:**
- Modify: `src/hooks/useNativeWindowState.ts`
- Modify: `src/hooks/useAppShellLifecycle.ts`
- Modify: `src/hooks/useAppShellLifecycle.test.tsx`
- Modify: `src/hooks/useWindowCloseRequest.ts`
- Modify: `src/hooks/useWindowCloseRequest.test.tsx`

- [ ] **Step 1: Update lifecycle close test to expect native close**

In `src/hooks/useAppShellLifecycle.test.tsx`, replace `hideWindow` with `closeWindow` in `nativeWindowControls`:

```ts
const nativeWindowControls = vi.hoisted(() => ({
  closeWindow: vi.fn().mockResolvedValue(undefined),
  ensureWindowVisible: vi.fn().mockResolvedValue(undefined),
  handleEditorFocusChange: vi.fn(),
}));
```

Update the close test name and assertions:

```ts
it("closes the current window session through the native close command", async () => {
  let closeWindowSession: (() => Promise<void>) | undefined;

  useWindowCloseRequestMock.mockImplementation(({ closeWindowSession: nextCloseWindowSession }) => {
    closeWindowSession = nextCloseWindowSession;
    return vi.fn();
  });

  await act(async () => {
    root.render(createElement(Harness, {
      onReady: (nextControls) => {
        controls = nextControls;
      },
    }));
  });

  await act(async () => {
    await closeWindowSession?.();
  });

  expect(nativeWindowControls.closeWindow).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run lifecycle tests and verify they fail**

Run: `npm run test -- src/hooks/useAppShellLifecycle.test.tsx`

Expected: FAIL because `useNativeWindowState` still returns `hideWindow`.

- [ ] **Step 3: Implement close adapter in native window state**

In `src/hooks/useNativeWindowState.ts`, import:

```ts
import { closeCurrentDocumentWindow } from "../lib/document-window";
```

Replace `hideWindow` with:

```ts
const closeWindow = useEffectEvent(async () => {
  if (!isTauriRuntime()) {
    return;
  }

  await closeCurrentDocumentWindow();
});
```

Return:

```ts
return {
  closeWindow,
  ensureWindowVisible,
  handleEditorFocusChange,
};
```

In `src/hooks/useAppShellLifecycle.ts`, replace `hideWindowRef` and `closeCurrentWindowSession` with:

```ts
const closeWindowRef = useRef<() => Promise<void>>(async () => {});

const closeCurrentWindowSession = useEffectEvent(async () => {
  await closeWindowRef.current();
});
```

Assign:

```ts
closeWindowRef.current = closeWindow;
```

Remove `resetDocumentAfterHide`.

- [ ] **Step 4: Keep dirty close behavior intact**

In `src/hooks/useWindowCloseRequest.ts`, no behavior change is needed if it still calls `closeWindowSession` after save or discard. Update names in tests from hide to close.

- [ ] **Step 5: Run close-related tests**

Run: `npm run test -- src/hooks/useAppShellLifecycle.test.tsx src/hooks/useWindowCloseRequest.test.tsx src/hooks/useNativeWindowState.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useNativeWindowState.ts src/hooks/useNativeWindowState.test.ts src/hooks/useAppShellLifecycle.ts src/hooks/useAppShellLifecycle.test.tsx src/hooks/useWindowCloseRequest.ts src/hooks/useWindowCloseRequest.test.tsx
git commit -m "feat(window): close document windows instead of hiding them"
```

---

### Task 10: Remove Hidden-Window Pending Action Paths

**Files:**
- Modify: `src/hooks/usePendingDocumentAction.ts`
- Modify: `src/hooks/usePendingDocumentAction.test.tsx`
- Modify: `src/hooks/useAppShellLifecycle.ts`
- Modify: `src/lib/pending-action.ts`
- Modify: `src/lib/pending-action.test.ts`

- [ ] **Step 1: Update pending action tests around New/Open**

In `src/hooks/usePendingDocumentAction.test.tsx`, remove expectations for hidden-window document loading. Add tests that dirty state only gates actions that mutate the current document. For MVP, `new`, `open`, and `openRecent` should no longer be queued here because they are handled by window commands before reaching pending action.

Use this expected behavior:

```ts
expect(result.current.pendingAction).toBe(null);
```

for menu New/Open flows that no longer call `requestVisibleAction`.

- [ ] **Step 2: Simplify pending action type**

In `src/lib/pending-action.ts`, keep:

```ts
export type PendingAction = { type: "closeWindow" };
```

Update `getPostSaveResolution`:

```ts
export function getPostSaveResolution(_action: PendingAction) {
  return "hide-window" as const;
}
```

Update `getPostDiscardResolution`:

```ts
export function getPostDiscardResolution(_action: PendingAction) {
  return "hide-window" as const;
}
```

Keep the return literal names for now to minimize test churn, or rename to `"close-window"` in this task and update tests consistently.

- [ ] **Step 3: Remove unused hidden-window lifecycle options**

In `src/hooks/useAppShellLifecycle.ts`, remove:

```ts
openWithPickerWithoutShowingWindow
```

from options and from `usePendingDocumentAction` inputs.

In `src/hooks/usePendingDocumentAction.ts`, remove `requestVisibleAction`, `showHiddenWindowWithDocument`, and the open/new/openRecent branches from `performAction`.

- [ ] **Step 4: Run pending action tests**

Run: `npm run test -- src/hooks/usePendingDocumentAction.test.tsx src/lib/pending-action.test.ts src/hooks/useAppShellLifecycle.test.tsx`

Expected: PASS after updating expected type surface.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePendingDocumentAction.ts src/hooks/usePendingDocumentAction.test.tsx src/hooks/useAppShellLifecycle.ts src/lib/pending-action.ts src/lib/pending-action.test.ts
git commit -m "refactor(window): remove single-window pending open flow"
```

---

### Task 11: Focus-Gated Menu Sync

**Files:**
- Modify: `src/hooks/useNativeWindowState.ts`
- Modify: `src/hooks/useAppMenuController.ts`
- Modify: `src/hooks/useAppMenuController.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add failing tests for focused-only menu sync**

In `src/hooks/useAppMenuController.test.ts`, add a focused option to the harness and verify sync does not run while unfocused:

```ts
it("does not sync menu state while the current window is unfocused", async () => {
  await act(async () => {
    root.render(createElement(Harness, {
      isMenuOwner: false,
      onReady: (nextController) => {
        controller = nextController;
      },
    }));
  });

  expect(setupAppMenu).toHaveBeenCalledTimes(1);
  expect(menuController.sync).not.toHaveBeenCalled();
});
```

Update the existing harness to pass `isMenuOwner` into `useAppMenuController`.

- [ ] **Step 2: Run menu controller tests and verify they fail**

Run: `npm run test -- src/hooks/useAppMenuController.test.ts`

Expected: FAIL because `useAppMenuController` has no `isMenuOwner` option.

- [ ] **Step 3: Implement focus state and menu owner gate**

In `src/hooks/useNativeWindowState.ts`, add:

```ts
const [isFocused, setIsFocused] = useState(true);
```

In focus listener:

```ts
currentWindow.onFocusChanged(({ payload: focused }) => {
  setIsFocused(focused);
  if (focused) {
    onVisibilityChange(true);
  }
}),
```

Return `isFocused`.

In `src/hooks/useAppMenuController.ts`, change signature:

```ts
export function useAppMenuController(
  handlers: MenuHandlers,
  state: MenuState,
  isMenuOwner = true,
)
```

Gate sync:

```ts
useEffect(() => {
  latestStateRef.current = state;

  if (!isMenuOwner || !menuControllerRef.current) {
    return;
  }

  void menuControllerRef.current.sync(state);
}, [isMenuOwner, state]);
```

When setup completes:

```ts
if (isMenuOwner) {
  void nextController?.sync(latestStateRef.current);
}
```

Include `isMenuOwner` in the setup effect dependency.

In `src/App.tsx`, pass:

```ts
useAppMenuController(menuHandlers, menuState, lifecycle.isWindowFocused);
```

Expose `isWindowFocused` from `useAppShellLifecycle`.

- [ ] **Step 4: Run menu tests**

Run: `npm run test -- src/hooks/useAppMenuController.test.ts src/hooks/useNativeWindowState.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNativeWindowState.ts src/hooks/useNativeWindowState.test.ts src/hooks/useAppMenuController.ts src/hooks/useAppMenuController.test.ts src/hooks/useAppShellLifecycle.ts src/App.tsx
git commit -m "feat(menu): sync app menu from focused window"
```

---

### Task 12: Remove Native Open Document Event Listener

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/hooks/useNativeOpenDocumentListener.ts`
- Delete: `src/hooks/useNativeOpenDocumentListener.test.tsx`
- Delete: `src/lib/native-open-document.ts`
- Delete: `src/lib/native-open-document.test.ts`

- [ ] **Step 1: Remove listener wiring from App**

Delete this import:

```ts
import { useNativeOpenDocumentListener } from "./hooks/useNativeOpenDocumentListener";
```

Delete this call:

```ts
useNativeOpenDocumentListener({
  onOpenDocument: actions.handleMenuOpenRecent,
});
```

- [ ] **Step 2: Delete obsolete listener files**

Run:

```bash
git rm src/hooks/useNativeOpenDocumentListener.ts src/hooks/useNativeOpenDocumentListener.test.tsx src/lib/native-open-document.ts src/lib/native-open-document.test.ts
```

- [ ] **Step 3: Search for stale references**

Run: `rg -n "NativeOpenDocument|native-open-document|clipmark://open-document|useNativeOpenDocumentListener" src src-tauri`

Expected: no matches.

- [ ] **Step 4: Run affected tests**

Run: `npm run test -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(window): remove renderer open-document listener"
```

---

### Task 13: Full Verification

**Files:**
- No source edits unless verification exposes a failure.

- [ ] **Step 1: Run frontend tests**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 2: Run Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Run Tauri dev manual checks**

Run: `npm run tauri:dev`

Manual checks:

- `Cmd+N` opens multiple untitled windows.
- `Open...` opens a selected `.md` file in a new window.
- Opening the same `.md` file again focuses the existing window.
- `Open Recent` follows the same existing-window policy.
- Finder/Open With for an already opened file focuses the existing window.
- Dirty close Save closes after saving.
- Dirty close Don't Save closes without saving.
- Dirty close Cancel keeps the window open.
- `Save As...` to a path open in another window is blocked with an error toast.
- Closing the final window and clicking the Dock icon opens a new empty window.

- [ ] **Step 5: Commit verification fixes when verification changed files**

If any verification step required source changes:

```bash
git add -A
git commit -m "fix(window): address multi-window verification issues"
```

If no source changes were needed, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage:
  - Multiple untitled windows: Tasks 2, 6, 13.
  - Different files in independent windows: Tasks 2, 6, 7, 13.
  - Existing file focuses existing window: Tasks 1, 2, 3, 13.
  - New/Open/Open Recent/Finder Open With policies: Tasks 3, 6, 12, 13.
  - Actual close instead of hide/reset: Tasks 9, 10, 13.
  - Save As conflict: Tasks 2, 5, 13.
  - Focused-window menu behavior: Task 11.
- 미완성 표식 검사: 실행을 막는 빈 항목은 남기지 않았다.
- Type consistency:
  - Rust command names match `document-window.ts`.
  - Frontend adapter names are used by file actions, close handling, save conflict, and path registration.
  - Initial path loading uses `path` query string, matching the Rust window URL helper.
