# Welcome Window Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Finder/Open With와 웰컴 화면의 New/Open 동작에서 불필요한 웰컴 창이 남지 않도록, 문서가 없는 웰컴 창을 첫 문서 편집 창으로 재사용한다.

**Architecture:** `WindowRegistry`가 path뿐 아니라 창의 문서 상태(`welcome`, `untitled`, `path`)를 구분하게 만들어 Rust가 재사용 가능한 웰컴 창을 안전하게 찾는다. 프론트엔드는 웰컴 화면에서 New/Open/Open Recent를 누를 때 현재 창 세션을 직접 전환하고, 이미 문서를 편집 중인 창에서는 기존 멀티 윈도우 정책대로 새 창 생성 또는 기존 창 focus를 유지한다.

**Tech Stack:** Tauri v2, Rust, React, TypeScript, Vitest, Cargo tests.

---

## Root Cause Summary

### 1. Finder에서 `.md` 파일을 열면 웰컴 창과 문서 창이 함께 뜸

현재 `src-tauri/tauri.conf.json`의 기본 window 설정 때문에 앱 시작 시 `main` 창이 자동 생성된다. 이후 macOS `openURLs` 또는 `RunEvent::Opened` 경로가 `open_document_paths()`를 호출하고, 이 함수는 항상 `open_document_window_with_path()`를 통해 `document-*` 창을 새로 만든다. `main` 창은 registry상 `path = None`인 상태로 남고, `get_initial_document_window_state()`도 `main`을 `isNewDocument: false, path: null`로 반환하므로 React는 웰컴 화면을 유지한다.

### 2. 웰컴 화면의 "새 파일"이 현재 창을 편집 창으로 바꾸지 않고 새 창을 띄움

`src/hooks/useAppShellActions.ts`의 `handleWelcomeNew`가 `createNewDocumentWindow()`를 호출한다. 이 함수는 `src/hooks/useDocumentFileActions.ts`에서 Tauri command `create_document_window`으로 연결되어 별도 `document-*` 창을 만든다. 이미 `useDocumentSession.createNewDocument()`는 현재 창을 새 파일 편집 상태로 전환할 수 있지만, 웰컴 액션에 연결되어 있지 않다.

### 3. 웰컴 화면의 "기존 파일 열기"가 현재 창을 편집 창으로 바꾸지 않고 새 창을 띄움

`handleWelcomeOpen`은 `openWithPicker()`를 호출하고, 현재 `openWithPicker()`는 picker에서 path를 받은 뒤 항상 `openDocumentWindow(path)`를 호출한다. `handleWelcomeOpenRecent`도 `openRecentDocumentWindow(path)`를 호출하고, 이 역시 항상 `openDocumentWindow(path)`로 연결된다. 즉 웰컴 상태와 편집 상태를 구분하지 않고 모든 open 계열 액션이 새 창 정책을 사용한다.

## Target Behavior

- Finder/Open With로 앱을 cold start하고 `.md` 파일 1개를 열면 `main` 창 하나만 보이고, 그 창이 해당 문서 편집 창이 된다.
- 앱이 이미 실행 중이고 재사용 가능한 웰컴 창이 있으면 Finder/Open With로 열린 첫 문서는 그 웰컴 창을 편집 창으로 전환한다.
- 앱이 이미 실행 중이지만 모든 창이 문서 편집 중이면 Finder/Open With는 기존 멀티 윈도우 정책대로 새 문서 창을 만들거나 이미 열린 파일 창을 focus한다.
- 웰컴 화면의 New는 현재 웰컴 창을 untitled 편집 창으로 전환한다.
- 웰컴 화면의 Open/Open Recent는 현재 웰컴 창을 선택한 문서 편집 창으로 전환한다.
- 문서 편집 창의 menu New/Open/Open Recent는 현재 문서를 건드리지 않고 기존처럼 새 창 생성 또는 기존 창 focus를 유지한다.
- 이미 열린 파일을 웰컴 창에서 Open/Open Recent/Finder로 다시 열면 웰컴 창을 전환하지 않고 기존 문서 창을 focus한다.

## Files

- Modify: `src-tauri/src/main.rs`
- Modify: `src/lib/document-window.ts`
- Modify: `src/lib/document-window.test.ts`
- Modify: `src/hooks/useDocumentSession.ts`
- Modify: `src/hooks/useDocumentFileActions.ts`
- Modify: `src/hooks/useDocumentFileActions.test.tsx`
- Modify: `src/hooks/useAppShellActions.ts`
- Modify: `src/hooks/useAppShellActions.test.tsx`
- Modify: `src/hooks/useDocumentSessionFileEffects.ts`
- Modify: `src/hooks/useDocumentSessionFileEffects.test.tsx`
- Modify: `docs/MULTI_WINDOW_SPEC.md`

## Task 1: Track Welcome vs Untitled vs Path in the Rust Window Registry

**Files:**
- Modify: `src-tauri/src/main.rs`

- [x] **Step 1: Add a failing Rust test for reusable welcome windows**

Add these tests in the existing `#[cfg(test)] mod tests` block:

```rust
#[test]
fn window_registry_returns_first_reusable_welcome_window() {
    let mut registry = WindowRegistry::default();
    registry.register_welcome_window("main".to_string());
    registry.register_untitled_document_window("document-1".to_string());

    assert_eq!(registry.reusable_welcome_window(), Some("main".to_string()));
}

#[test]
fn window_registry_does_not_reuse_untitled_documents_as_welcome_windows() {
    let mut registry = WindowRegistry::default();
    registry.register_untitled_document_window("main".to_string());

    assert_eq!(registry.reusable_welcome_window(), None);
}

#[test]
fn initial_document_window_state_keeps_welcome_window_as_welcome() {
    let mut registry = WindowRegistry::default();
    registry.register_welcome_window("main".to_string());

    assert_eq!(
        initial_document_window_state_for_label(&registry, "main"),
        InitialDocumentWindowState {
            is_new_document: false,
            path: None,
        },
    );
}

#[test]
fn initial_document_window_state_marks_pathless_document_window_as_new() {
    let mut registry = WindowRegistry::default();
    registry.register_untitled_document_window("document-1".to_string());

    assert_eq!(
        initial_document_window_state_for_label(&registry, "document-1"),
        InitialDocumentWindowState {
            is_new_document: true,
            path: None,
        },
    );
}
```

- [x] **Step 2: Run the focused Rust tests and verify they fail**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml window_registry_returns_first_reusable_welcome_window
```

Expected: fail because `register_welcome_window`, `register_untitled_document_window`, and `reusable_welcome_window` do not exist.

- [x] **Step 3: Replace `window_paths` with explicit window document state**

In `src-tauri/src/main.rs`, add:

```rust
#[derive(Clone, Debug, PartialEq, Eq)]
enum WindowDocumentState {
    Welcome,
    Untitled,
    Path(String),
}
```

Change `WindowRegistry` from:

```rust
struct WindowRegistry {
    next_window_id: u64,
    window_paths: HashMap<String, Option<String>>,
    path_windows: HashMap<String, String>,
}
```

to:

```rust
struct WindowRegistry {
    next_window_id: u64,
    window_states: HashMap<String, WindowDocumentState>,
    path_windows: HashMap<String, String>,
}
```

Replace the registry methods with:

```rust
fn register_welcome_window(&mut self, label: String) {
    self.unregister_window(&label);
    self.window_states.insert(label, WindowDocumentState::Welcome);
}

fn register_untitled_document_window(&mut self, label: String) {
    self.unregister_window(&label);
    self.window_states.insert(label, WindowDocumentState::Untitled);
}

fn register_document_path(&mut self, label: &str, path: String) {
    self.clear_window_path(label);

    if let Some(previous_label) = self.path_windows.get(&path) {
        if previous_label != label {
            self.window_states
                .insert(previous_label.clone(), WindowDocumentState::Welcome);
        }
    }

    self.window_states
        .insert(label.to_string(), WindowDocumentState::Path(path.clone()));
    self.path_windows.insert(path, label.to_string());
}

fn clear_window_path(&mut self, label: &str) {
    if let Some(WindowDocumentState::Path(previous_path)) = self.window_states.get(label) {
        self.path_windows.remove(previous_path);
    }
}

fn unregister_window(&mut self, label: &str) {
    self.clear_window_path(label);
    self.window_states.remove(label);
}

fn reusable_welcome_window(&self) -> Option<String> {
    self.window_states
        .iter()
        .find_map(|(label, state)| {
            if matches!(state, WindowDocumentState::Welcome) {
                Some(label.clone())
            } else {
                None
            }
        })
}
```

Keep the existing `next_document_label`, `window_for_path`, and `is_path_open_elsewhere` responsibilities, but update them to read `window_states` where needed.

- [x] **Step 4: Update initial state helper**

Change `initial_document_window_state_for_label()` to:

```rust
fn initial_document_window_state_for_label(
    registry: &WindowRegistry,
    label: &str,
) -> InitialDocumentWindowState {
    match registry.window_states.get(label) {
        Some(WindowDocumentState::Path(path)) => InitialDocumentWindowState {
            is_new_document: false,
            path: Some(path.clone()),
        },
        Some(WindowDocumentState::Untitled) => InitialDocumentWindowState {
            is_new_document: true,
            path: None,
        },
        _ => InitialDocumentWindowState {
            is_new_document: false,
            path: None,
        },
    }
}
```

- [x] **Step 5: Update existing Rust tests that assert `window_paths`**

Replace direct assertions like:

```rust
assert_eq!(registry.window_paths.get("main"), Some(&None));
```

with state assertions:

```rust
assert_eq!(
    registry.window_states.get("main"),
    Some(&WindowDocumentState::Welcome),
);
```

For path owners, assert:

```rust
assert_eq!(
    registry.window_states.get("document-1"),
    Some(&WindowDocumentState::Path(path.clone())),
);
```

- [x] **Step 6: Run registry tests**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml window_registry
```

Expected: all `window_registry_*` tests pass.

## Task 2: Reuse a Welcome Window for Finder/Open With Paths

**Files:**
- Modify: `src-tauri/src/main.rs`

- [x] **Step 1: Add failing Rust tests for open path decisions with a reusable welcome window**

Add:

```rust
#[derive(Debug, PartialEq, Eq)]
enum DocumentWindowOpenDecision {
    Focus(String),
    ReuseWelcome(String),
    AlreadyOpening,
    Create,
}

#[test]
fn document_window_open_decision_reuses_welcome_when_path_is_not_open() {
    assert_eq!(
        document_window_open_decision(None, false, Some("main".to_string())),
        DocumentWindowOpenDecision::ReuseWelcome("main".to_string()),
    );
}

#[test]
fn document_window_open_decision_focuses_existing_path_before_reusing_welcome() {
    assert_eq!(
        document_window_open_decision(
            Some("document-1".to_string()),
            true,
            Some("main".to_string()),
        ),
        DocumentWindowOpenDecision::Focus("document-1".to_string()),
    );
}

#[test]
fn document_window_open_decision_creates_when_no_path_or_welcome_exists() {
    assert_eq!(
        document_window_open_decision(None, false, None),
        DocumentWindowOpenDecision::Create,
    );
}
```

- [x] **Step 2: Run decision tests and verify they fail**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml document_window_open_decision
```

Expected: fail because the decision signature and `ReuseWelcome` variant are not implemented yet.

- [x] **Step 3: Update `document_window_open_decision`**

Change the function to:

```rust
fn document_window_open_decision(
    existing_label: Option<String>,
    window_exists: bool,
    reusable_welcome_label: Option<String>,
) -> DocumentWindowOpenDecision {
    match (existing_label, window_exists, reusable_welcome_label) {
        (Some(label), true, _) => DocumentWindowOpenDecision::Focus(label),
        (Some(_), false, _) => DocumentWindowOpenDecision::AlreadyOpening,
        (None, _, Some(label)) => DocumentWindowOpenDecision::ReuseWelcome(label),
        (None, _, None) => DocumentWindowOpenDecision::Create,
    }
}
```

- [x] **Step 4: Add helper to assign a path to an existing welcome window**

Add:

```rust
fn assign_path_to_existing_window(
    app_handle: &AppHandle,
    registry_state: &State<'_, WindowRegistryState>,
    label: &str,
    path: String,
) -> Result<(), String> {
    let normalized_path = normalize_document_path_for_registry(&path);
    {
        let mut registry = registry_state
            .registry
            .lock()
            .map_err(|error| error.to_string())?;
        registry.register_document_path(label, normalized_path);
    }

    if let Some(window) = app_handle.get_webview_window(label) {
        focus_window(&window)?;
    }

    Ok(())
}
```

The existing React instance will pick up the path through `get_initial_document_window_state()` if it has not consumed an initial request yet. This covers cold start because the `main` React tree mounts after setup completes.

- [x] **Step 5: Update `open_document_window_with_path` to consider welcome reuse**

Inside `open_document_window_with_path`, collect `reusable_welcome_label` under the registry lock only when the path is not already registered:

```rust
let (existing_label, reusable_welcome_label) = {
    let registry = registry_state
        .registry
        .lock()
        .map_err(|error| error.to_string())?;
    let existing = registry.window_for_path(&normalized_path);
    let reusable = if existing.is_none() {
        registry.reusable_welcome_window()
    } else {
        None
    };
    (existing, reusable)
};
```

Update the match:

```rust
match document_window_open_decision(
    existing_label,
    existing_window.is_some(),
    reusable_welcome_label,
) {
    DocumentWindowOpenDecision::Focus(_) => {
        let window = existing_window.expect("window should exist for focus decision");
        focus_window(&window)
    }
    DocumentWindowOpenDecision::ReuseWelcome(label) => {
        assign_path_to_existing_window(app_handle, registry_state, &label, path)
    }
    DocumentWindowOpenDecision::AlreadyOpening => Ok(()),
    DocumentWindowOpenDecision::Create => {
        create_document_window_with_path(app_handle, registry_state, Some(path))
    }
}
```

- [x] **Step 6: Update setup registration**

Change setup registration for `main` from a generic pathless registration to:

```rust
registry.register_welcome_window(window.label().to_string());
```

Change `reserve_document_window_in_registry` so `path: None` registers `WindowDocumentState::Untitled`, not `Welcome`.

- [x] **Step 7: Run Rust tests**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all Rust tests pass.

## Task 3: Add Frontend Commands for Welcome and Untitled Registration

**Files:**
- Modify: `src/lib/document-window.ts`
- Modify: `src/lib/document-window.test.ts`
- Modify: `src/hooks/useDocumentSessionFileEffects.ts`
- Modify: `src/hooks/useDocumentSessionFileEffects.test.tsx`

- [x] **Step 1: Add failing adapter tests**

In `src/lib/document-window.test.ts`, add:

```ts
it("registers the current window as an untitled document", async () => {
  await registerWindowUntitledDocument();
  expect(invoke).toHaveBeenCalledWith("register_window_untitled_document");
});

it("registers the current window as welcome", async () => {
  await registerWindowWelcome();
  expect(invoke).toHaveBeenCalledWith("register_window_welcome");
});
```

Update the imports to include `registerWindowUntitledDocument` and `registerWindowWelcome`.

- [x] **Step 2: Run adapter tests and verify they fail**

Run:

```bash
npm run test -- src/lib/document-window.test.ts
```

Expected: fail because the functions are not implemented.

- [x] **Step 3: Add Rust commands**

In `src-tauri/src/main.rs`, add:

```rust
#[tauri::command]
fn register_window_untitled_document(
    window: tauri::Window,
    registry_state: State<'_, WindowRegistryState>,
) -> Result<(), String> {
    let mut registry = registry_state
        .registry
        .lock()
        .map_err(|error| error.to_string())?;

    registry.register_untitled_document_window(window.label().to_string());
    Ok(())
}

#[tauri::command]
fn register_window_welcome(
    window: tauri::Window,
    registry_state: State<'_, WindowRegistryState>,
) -> Result<(), String> {
    let mut registry = registry_state
        .registry
        .lock()
        .map_err(|error| error.to_string())?;

    registry.register_welcome_window(window.label().to_string());
    Ok(())
}
```

Add both commands to `tauri::generate_handler!`.

- [x] **Step 4: Add TypeScript adapters**

In `src/lib/document-window.ts`, add:

```ts
export async function registerWindowUntitledDocument(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("register_window_untitled_document");
}

export async function registerWindowWelcome(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("register_window_welcome");
}
```

- [x] **Step 5: Update file effects to expose explicit state registration**

In `src/hooks/useDocumentSessionFileEffects.ts`, import the two new adapters and add quiet wrappers:

```ts
function registerWindowUntitledDocumentQuietly() {
  void registerWindowUntitledDocument().catch((error) => {
    logDebug(`window:registerUntitledDocument failed error=${String(error)}`);
  });
}

function registerWindowWelcomeQuietly() {
  void registerWindowWelcome().catch((error) => {
    logDebug(`window:registerWelcome failed error=${String(error)}`);
  });
}
```

Return:

```ts
const registerCurrentWindowAsUntitledDocument = useEffectEvent(() => {
  registerWindowUntitledDocumentQuietly();
});

const registerCurrentWindowAsWelcome = useEffectEvent(() => {
  registerWindowWelcomeQuietly();
});
```

- [x] **Step 6: Keep `clearRegisteredWindowDocumentPath` only if still referenced**

If all call sites are migrated in Task 4, remove `clearRegisteredWindowDocumentPath`. If a call site still needs it, make it delegate to `registerCurrentWindowAsWelcome()` only for true welcome transitions.

- [x] **Step 7: Run frontend adapter/effects tests**

Run:

```bash
npm run test -- src/lib/document-window.test.ts src/hooks/useDocumentSessionFileEffects.test.tsx
```

Expected: all tests pass after updating expectations.

## Task 4: Reuse the Current Window for Welcome New/Open/Open Recent

**Files:**
- Modify: `src/hooks/useDocumentSession.ts`
- Modify: `src/hooks/useDocumentFileActions.ts`
- Modify: `src/hooks/useDocumentFileActions.test.tsx`
- Modify: `src/hooks/useAppShellActions.ts`
- Modify: `src/hooks/useAppShellActions.test.tsx`

- [x] **Step 1: Add failing tests for welcome New/Open/Open Recent**

In `src/hooks/useDocumentFileActions.test.tsx`, add:

```ts
it("creates a new document in the current window when the welcome screen is visible", async () => {
  const createNewDocument = vi.fn();

  await act(async () => {
    root.render(createElement(Harness, {
      onReady: (nextControls) => {
        controls = nextControls;
      },
      overrides: {
        createNewDocument,
        isWelcomeVisible: true,
      },
    }));
  });

  await act(async () => {
    await controls.createNewDocumentWindow();
  });

  expect(createNewDocument).toHaveBeenCalledTimes(1);
  expect(createDocumentWindow).not.toHaveBeenCalled();
});

it("opens picker results in the current window when the welcome screen is visible", async () => {
  const document: OpenedDocument = {
    filename: "open.md",
    markdown: "# Open",
    path: "/tmp/open.md",
  };
  const applyOpenedDocument = vi.fn();
  pickMarkdownDocumentPath.mockResolvedValue("/tmp/open.md");
  openRecentFile.mockResolvedValue(document);

  await act(async () => {
    root.render(createElement(Harness, {
      onReady: (nextControls) => {
        controls = nextControls;
      },
      overrides: {
        applyOpenedDocument,
        isWelcomeVisible: true,
      },
    }));
  });

  await act(async () => {
    await controls.openWithPicker();
  });

  expect(openRecentFile).toHaveBeenCalledWith("/tmp/open.md");
  expect(applyOpenedDocument).toHaveBeenCalledWith(document);
  expect(openDocumentWindow).not.toHaveBeenCalled();
});

it("opens recent files in the current window when the welcome screen is visible", async () => {
  const document: OpenedDocument = {
    filename: "recent.md",
    markdown: "# Recent",
    path: "/tmp/recent.md",
  };
  const applyOpenedDocument = vi.fn();
  openRecentFile.mockResolvedValue(document);

  await act(async () => {
    root.render(createElement(Harness, {
      onReady: (nextControls) => {
        controls = nextControls;
      },
      overrides: {
        applyOpenedDocument,
        isWelcomeVisible: true,
      },
    }));
  });

  await act(async () => {
    await controls.openRecentDocumentWindow("/tmp/recent.md");
  });

  expect(openRecentFile).toHaveBeenCalledWith("/tmp/recent.md");
  expect(applyOpenedDocument).toHaveBeenCalledWith(document);
  expect(openDocumentWindow).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run focused tests and verify they fail**

Run:

```bash
npm run test -- src/hooks/useDocumentFileActions.test.tsx
```

Expected: new tests fail because all three actions still use native window creation/opening.

- [x] **Step 3: Update `useDocumentSession.createNewDocument` registration**

In `src/hooks/useDocumentSession.ts`, destructure the new effect:

```ts
const {
  applyOpenedDocument,
  applySavedDocument,
  handleMissingRecentFile,
  handleUnavailableRecentFile,
  registerCurrentWindowAsUntitledDocument,
  registerCurrentWindowAsWelcome,
} = useDocumentSessionFileEffects(...);
```

Change `createNewDocument`:

```ts
const createNewDocument = useEffectEvent(() => {
  workspaceState.createNewDocument();
  registerCurrentWindowAsUntitledDocument();
});
```

Change `closeCurrentDocument` if it remains used for returning to welcome:

```ts
const closeCurrentDocument = useEffectEvent(() => {
  workspaceState.closeCurrentDocument();
  registerCurrentWindowAsWelcome();
});
```

- [x] **Step 4: Update `useDocumentFileActions` current-window behavior**

Change `createNewDocumentWindow`:

```ts
const createNewDocumentWindow = useEffectEvent(async () => {
  if (isWelcomeVisible) {
    createNewDocument();
    return;
  }

  await createDocumentWindow();
});
```

Add helper:

```ts
async function applyDocumentFromPath(path: string) {
  const document = await loadRecentDocument(path);
  if (!document) {
    return null;
  }

  applyOpenedDocument(document);
  return document;
}
```

Change picker handling:

```ts
const openWithPicker = useEffectEvent(async (fallbackToFileInput = true) => {
  const path = await pickMarkdownDocumentPath();
  if (!path) {
    if (fallbackToFileInput) {
      fileInputRef.current?.click();
    }
    return null;
  }

  if (isWelcomeVisible) {
    return applyDocumentFromPath(path);
  }

  await openDocumentWindow(path);
  return null;
});
```

Change recent handling:

```ts
const openRecentDocumentWindow = useEffectEvent(async (path: string) => {
  if (isWelcomeVisible) {
    await applyDocumentFromPath(path);
    return;
  }

  await openDocumentWindow(path);
});
```

- [x] **Step 5: Wire the session-provided actions into `useAppShellActions`**

In `src/App.tsx`, pass the session functions:

```ts
const actions = useAppShellActions({
  activeFilename: viewState.activeFilename,
  canSaveDocument: viewState.canSaveDocument,
  createNewDocumentWindow: session.createNewDocumentWindow,
  filePath: session.filePath,
  openRecentDocumentWindow: session.openRecentDocumentWindow,
  openWithPicker: session.openWithPicker,
  saveDocument: session.saveDocument,
  setIsExternalMediaAutoLoadEnabled,
  setIsPreviewVisible,
  setIsTocVisible,
  setThemeMode,
  showToast,
});
```

This avoids the current default adapter path bypassing the session’s `isWelcomeVisible` branching.

- [x] **Step 6: Update action tests**

In `src/hooks/useAppShellActions.test.tsx`, rename the welcome test to reflect current-window behavior through the injected callbacks:

```ts
it("routes welcome actions through the provided document session actions", async () => {
  const createNewDocumentWindow = vi.fn().mockResolvedValue(undefined);
  const openRecentDocumentWindow = vi.fn().mockResolvedValue(undefined);
  const openWithPicker = vi.fn().mockResolvedValue(null);

  await act(async () => {
    root.render(createElement(Harness, {
      onReady: (nextControls) => {
        controls = nextControls;
      },
      overrides: {
        createNewDocumentWindow,
        openRecentDocumentWindow,
        openWithPicker,
      },
    }));
  });

  await act(async () => {
    controls.handleWelcomeNew();
    controls.handleWelcomeOpen();
    controls.handleWelcomeOpenRecent("/tmp/recent.md");
  });

  expect(createNewDocumentWindow).toHaveBeenCalledTimes(1);
  expect(openWithPicker).toHaveBeenCalledTimes(1);
  expect(openRecentDocumentWindow).toHaveBeenCalledWith("/tmp/recent.md");
});
```

- [x] **Step 7: Run focused frontend tests**

Run:

```bash
npm run test -- src/hooks/useDocumentFileActions.test.tsx src/hooks/useAppShellActions.test.tsx
```

Expected: all focused frontend tests pass.

## Task 5: Avoid Reusing Welcome for Already Open Paths

**Files:**
- Modify: `src/hooks/useDocumentFileActions.ts`
- Modify: `src/lib/document-window.ts`
- Modify: `src/lib/document-window.test.ts`
- Modify: `src/hooks/useDocumentFileActions.test.tsx`

- [x] **Step 1: Add a current-window duplicate-path guard adapter**

In `src/lib/document-window.ts`, keep using the existing `isDocumentPathOpenElsewhere(path)` function.

- [x] **Step 2: Add failing frontend tests**

In `src/hooks/useDocumentFileActions.test.tsx`, mock `isDocumentPathOpenElsewhere` from `../lib/document-window` and add:

```ts
it("focuses an existing document window instead of reusing welcome for an already-open picker path", async () => {
  const applyOpenedDocument = vi.fn();
  pickMarkdownDocumentPath.mockResolvedValue("/tmp/open.md");
  isDocumentPathOpenElsewhere.mockResolvedValue(true);

  await act(async () => {
    root.render(createElement(Harness, {
      onReady: (nextControls) => {
        controls = nextControls;
      },
      overrides: {
        applyOpenedDocument,
        isWelcomeVisible: true,
      },
    }));
  });

  await act(async () => {
    await controls.openWithPicker();
  });

  expect(openDocumentWindow).toHaveBeenCalledWith("/tmp/open.md");
  expect(openRecentFile).not.toHaveBeenCalled();
  expect(applyOpenedDocument).not.toHaveBeenCalled();
});

it("focuses an existing document window instead of reusing welcome for an already-open recent path", async () => {
  const applyOpenedDocument = vi.fn();
  isDocumentPathOpenElsewhere.mockResolvedValue(true);

  await act(async () => {
    root.render(createElement(Harness, {
      onReady: (nextControls) => {
        controls = nextControls;
      },
      overrides: {
        applyOpenedDocument,
        isWelcomeVisible: true,
      },
    }));
  });

  await act(async () => {
    await controls.openRecentDocumentWindow("/tmp/recent.md");
  });

  expect(openDocumentWindow).toHaveBeenCalledWith("/tmp/recent.md");
  expect(openRecentFile).not.toHaveBeenCalled();
  expect(applyOpenedDocument).not.toHaveBeenCalled();
});
```

- [x] **Step 3: Update helper to check duplicates before applying to welcome**

In `useDocumentFileActions`, import `isDocumentPathOpenElsewhere` and update `applyDocumentFromPath`:

```ts
async function applyDocumentFromPath(path: string) {
  if (await isDocumentPathOpenElsewhere(path)) {
    await openDocumentWindow(path);
    return null;
  }

  const document = await loadRecentDocument(path);
  if (!document) {
    return null;
  }

  applyOpenedDocument(document);
  return document;
}
```

- [x] **Step 4: Run focused duplicate tests**

Run:

```bash
npm run test -- src/hooks/useDocumentFileActions.test.tsx
```

Expected: all tests pass.

## Task 6: Update the Multi-Window Spec to Match the New Policy

**Files:**
- Modify: `docs/MULTI_WINDOW_SPEC.md`

- [x] **Step 1: Update frontend responsibility text**

Replace the current “파일 열기” bullets:

```md
- New: `createDocumentWindow()`를 호출한다.
- Open...: native picker로 path만 고르고 `openDocumentWindow(path)`를 호출한다.
- Open Recent: `openDocumentWindow(path)`를 호출한다.
```

with:

```md
- 웰컴 창의 New: 현재 창을 untitled 문서 편집 창으로 전환한다.
- 웰컴 창의 Open...: native picker로 path를 고른 뒤, 해당 path가 이미 다른 창에서 열려 있으면 기존 창을 focus하고, 아니면 현재 웰컴 창에 문서를 로드한다.
- 웰컴 창의 Open Recent: Open...과 같은 current-window reuse 정책을 따른다.
- 문서 편집 창의 New: `createDocumentWindow()`를 호출해 새 untitled 창을 만든다.
- 문서 편집 창의 Open...: native picker로 path만 고르고 `openDocumentWindow(path)`를 호출한다.
- 문서 편집 창의 Open Recent: `openDocumentWindow(path)`를 호출한다.
```

- [x] **Step 2: Update user behavior text**

Under “사용자 관점 동작”, update New/Open/Open Recent/Finder sections to explicitly mention welcome reuse.

- [x] **Step 3: Do not add new docs beyond this spec correction**

No extra docs are needed for this bug fix.

## Task 7: Full Verification

**Files:**
- No code changes.

- [x] **Step 1: Run all frontend tests**

Run:

```bash
npm run test
```

Expected: Vitest suite passes.

- [x] **Step 2: Run all Rust tests**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: Rust unit tests pass.

- [x] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: TypeScript compile and Vite build pass.

- [ ] **Step 4: Manual macOS verification**

Run:

```bash
npm run tauri:dev
```

Manual checks:

1. Quit ClipMark completely, then Finder/Open With an `.md` file. Expected: one visible window, and it is the selected document editor.
2. Start ClipMark to the welcome screen, then click “새 파일”. Expected: the same window becomes an untitled editor.
3. Start ClipMark to the welcome screen, then click “기존 파일 열기” and choose an `.md` file. Expected: the same window becomes that document editor.
4. Start ClipMark to the welcome screen, then open a recent file. Expected: the same window becomes that document editor.
5. Open document A in one editor window, leave another welcome window visible, then open document A from the welcome window. Expected: existing document A window is focused; welcome window remains welcome.
6. From a dirty document editor window, use menu New/Open/Open Recent. Expected: current dirty document remains untouched and a separate document window opens or existing matching window is focused.

## Self-Review

- Spec coverage: all three reported bugs map to Tasks 2 and 4, with duplicate-path safety covered by Task 5.
- Placeholder scan: no task contains TBD/TODO/fill-in-later instructions.
- Type consistency: Rust state names are `WindowDocumentState::{Welcome, Untitled, Path}`; TypeScript adapter names are `registerWindowUntitledDocument` and `registerWindowWelcome`.
