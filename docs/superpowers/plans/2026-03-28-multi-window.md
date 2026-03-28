# Multi-Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ClipMark을 OS 네이티브 멀티 윈도우로 전환한다. 각 창이 하나의 문서를 독립적으로 담당하며, 설정은 모든 창 간에 실시간으로 동기화된다.

**Architecture:** Rust 백엔드가 `AppPreferences`를 단일 소스로 관리한다. 설정 변경 시 `preferences-changed` 이벤트를 모든 창에 브로드캐스트한다. 새 창은 `open_new_window` Tauri 커맨드로 생성하며, 초기 파일 경로는 URL 쿼리 파라미터(`?path=...`)로 전달한다.

**Tech Stack:** Rust (Tauri v2), React 19, TypeScript, `@tauri-apps/api/event`

---

## File Map

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `src-tauri/src/main.rs` | Modify | `open_new_window`, `close_window` 커맨드 추가; `save_app_preferences` 브로드캐스트 추가; `Reopen`/`Opened` 핸들러 업데이트 |
| `src/lib/native-window.ts` | Modify | `openNewWindow`, `closeCurrentWindow` 추가 |
| `src/lib/native-window.test.ts` | Modify | 위 함수 테스트 추가 |
| `src/lib/file-system.ts` | Modify | `pickMarkdownFilePath` 추가 |
| `src/lib/file-system.test.ts` | Modify or Create | `pickMarkdownFilePath` 테스트 |
| `src/hooks/useDocumentSession.ts` | Modify | `initialDocument` 옵션 추가, 마운트 시 자동 로드 |
| `src/main.tsx` | Modify | URL 파라미터 파싱, `initialDocument` 전달 |
| `src/App.tsx` | Modify | `initialDocument` prop; `preferences-changed` 리스너; `performAction`/`requestAction` 멀티 윈도우 라우팅; `closeCurrentWindowSession` 클로즈 동작 변경 |

---

## Task 1: Rust — `open_new_window` + `close_window` 커맨드

**Files:**
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 기존 테스트가 통과하는지 확인**

```bash
cd src-tauri && cargo test
```
Expected: all tests pass

- [ ] **Step 2: 임포트 및 카운터 추가**

`main.rs` 상단 임포트에 다음을 추가한다:

```rust
use std::sync::atomic::{AtomicU32, Ordering};
use tauri::{WebviewUrl, WebviewWindowBuilder};
```

`main()` 함수 위에 정적 카운터와 헬퍼 함수를 추가한다:

```rust
static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(2);

fn new_window_label() -> String {
    format!("document-{}", WINDOW_COUNTER.fetch_add(1, Ordering::SeqCst))
}

fn create_new_window(app_handle: &AppHandle, file_path: Option<&str>) {
    let label = new_window_label();
    let url_path = match file_path {
        Some(path) => {
            let encoded: String =
                url::form_urlencoded::byte_serialize(path.as_bytes()).collect();
            format!("/?path={encoded}")
        }
        None => "/".to_string(),
    };

    let _ = WebviewWindowBuilder::new(app_handle, &label, WebviewUrl::App(url_path.into()))
        .title("ClipMark")
        .inner_size(1440.0, 920.0)
        .min_inner_size(1100.0, 720.0)
        .build();
}
```

- [ ] **Step 3: `open_new_window` + `close_window` 커맨드 추가**

기존 커맨드들 아래에 추가한다:

```rust
#[tauri::command]
fn open_new_window(app_handle: AppHandle, file_path: Option<String>) {
    create_new_window(&app_handle, file_path.as_deref());
}

#[tauri::command]
fn close_window(window: tauri::Window) -> Result<(), String> {
    window.destroy().map_err(|error| error.to_string())
}
```

- [ ] **Step 4: invoke_handler에 등록**

`tauri::generate_handler!` 배열에 추가한다:

```rust
tauri::generate_handler![
    append_debug_log,
    clear_debug_log,
    close_window,        // 추가
    hide_window,
    load_app_preferences,
    open_external_url,
    open_new_window,     // 추가
    pick_markdown_file,
    read_markdown_file,
    save_app_preferences,
    show_window,
    show_unsaved_changes_sheet,
    write_markdown_file,
    sync_window_document_state
]
```

- [ ] **Step 5: 단위 테스트 추가**

`main.rs` 하단 `#[cfg(test)]` 블록에 추가한다:

```rust
#[test]
fn window_labels_are_unique() {
    let label1 = new_window_label();
    let label2 = new_window_label();
    assert_ne!(label1, label2);
    assert!(label1.starts_with("document-"));
    assert!(label2.starts_with("document-"));
}

#[test]
fn window_label_counter_increments() {
    let before = WINDOW_COUNTER.load(Ordering::SeqCst);
    new_window_label();
    let after = WINDOW_COUNTER.load(Ordering::SeqCst);
    assert_eq!(after, before + 1);
}
```

- [ ] **Step 6: 테스트 실행**

```bash
cd src-tauri && cargo test
```

Expected: all tests pass including the two new ones

- [ ] **Step 7: 빌드 확인**

```bash
cd src-tauri && cargo build
```

Expected: compiles without errors

- [ ] **Step 8: 커밋**

```bash
git add src-tauri/src/main.rs
git commit -m "feat(rust): open_new_window, close_window 커맨드 추가"
```

---

## Task 2: Rust — 설정 브로드캐스트 + OS 이벤트 핸들러 업데이트

**Files:**
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: `save_app_preferences`에 `AppHandle` 파라미터 추가 및 브로드캐스트**

기존 `save_app_preferences` 함수 시그니처를 변경하고 브로드캐스트를 추가한다:

```rust
#[tauri::command]
fn save_app_preferences(
    preferences: AppPreferences,
    preferences_state: State<'_, PreferencesState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    save_preferences_to_disk(&preferences_state.file_path, &preferences)?;

    let mut current_preferences = preferences_state
        .preferences
        .lock()
        .map_err(|error| error.to_string())?;
    *current_preferences = preferences.clone();

    let _ = app_handle.emit("preferences-changed", &preferences);

    Ok(())
}
```

- [ ] **Step 2: `Reopen` 핸들러 업데이트**

`app.run` 내의 `Reopen` 핸들러를 변경한다:

```rust
// 변경 전:
tauri::RunEvent::Reopen {
    has_visible_windows: false,
    ..
} => {
    let mtm = MainThreadMarker::new().expect("failed to access the main thread");
    if NSApplication::sharedApplication(mtm).modalWindow().is_some() {
        return;
    }

    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

// 변경 후:
tauri::RunEvent::Reopen {
    has_visible_windows: false,
    ..
} => {
    let mtm = MainThreadMarker::new().expect("failed to access the main thread");
    if NSApplication::sharedApplication(mtm).modalWindow().is_some() {
        return;
    }

    create_new_window(&app_handle, None);
}
```

- [ ] **Step 3: `Opened` 핸들러 업데이트**

`Opened` 핸들러를 변경한다:

```rust
// 변경 전:
tauri::RunEvent::Opened { urls } => {
    for url in urls {
        let Ok(path) = url.to_file_path() else {
            continue;
        };
        let Some(path) = path.to_str() else {
            continue;
        };
        let _ = app_handle.emit(
            OPEN_DOCUMENT_EVENT,
            serde_json::json!({ "path": path }),
        );
    }
}

// 변경 후:
tauri::RunEvent::Opened { urls } => {
    for url in urls {
        let Ok(path) = url.to_file_path() else {
            continue;
        };
        let Some(path_str) = path.to_str() else {
            continue;
        };
        create_new_window(&app_handle, Some(path_str));
    }
}
```

- [ ] **Step 4: `OPEN_DOCUMENT_EVENT` 상수 제거 확인**

`OPEN_DOCUMENT_EVENT` 상수가 더 이상 사용되지 않으면 제거한다:

```rust
// 삭제:
const OPEN_DOCUMENT_EVENT: &str = "clipmark://open-document";
```

- [ ] **Step 5: 빌드 및 테스트**

```bash
cd src-tauri && cargo test && cargo build
```

Expected: all tests pass, no compilation errors

- [ ] **Step 6: 커밋**

```bash
git add src-tauri/src/main.rs
git commit -m "feat(rust): 설정 변경 브로드캐스트, 멀티 윈도우 OS 이벤트 처리"
```

---

## Task 3: Frontend — `native-window.ts` 함수 추가

**Files:**
- Modify: `src/lib/native-window.ts`
- Modify: `src/lib/native-window.test.ts`

- [ ] **Step 1: 실패할 테스트 작성**

`src/lib/native-window.test.ts`에 추가한다:

```typescript
describe("openNewWindow", () => {
  it("새 창을 열 때 file_path 없이 invoke한다", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockClear();

    await openNewWindow();

    expect(invoke).toHaveBeenCalledWith("open_new_window", { filePath: undefined });
  });

  it("파일 경로가 있으면 file_path와 함께 invoke한다", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockClear();

    await openNewWindow("/Users/test/doc.md");

    expect(invoke).toHaveBeenCalledWith("open_new_window", { filePath: "/Users/test/doc.md" });
  });
});

describe("closeCurrentWindow", () => {
  it("close_window를 invoke한다", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockClear();

    await closeCurrentWindow();

    expect(invoke).toHaveBeenCalledWith("close_window");
  });
});
```

import 줄도 업데이트한다:
```typescript
import { closeCurrentWindow, hideNativeWindow, openNewWindow, showNativeWindow } from "./native-window";
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm test -- native-window
```

Expected: FAIL — `openNewWindow`, `closeCurrentWindow` is not a function

- [ ] **Step 3: 구현 추가**

`src/lib/native-window.ts`에 추가한다:

```typescript
export async function openNewWindow(filePath?: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("open_new_window", { filePath });
}

export async function closeCurrentWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("close_window");
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npm test -- native-window
```

Expected: all 4 tests pass

- [ ] **Step 5: 커밋**

```bash
git add src/lib/native-window.ts src/lib/native-window.test.ts
git commit -m "feat(native-window): openNewWindow, closeCurrentWindow 추가"
```

---

## Task 4: Frontend — `file-system.ts`에 `pickMarkdownFilePath` 추가

**Files:**
- Modify: `src/lib/file-system.ts`

- [ ] **Step 1: 실패할 테스트 작성**

`src/lib/file-system.test.ts` 파일이 없으면 생성한다. 있으면 아래 테스트를 추가한다:

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("./file-system", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./file-system")>();
  return {
    ...actual,
    isTauriRuntime: () => true,
  };
});

describe("pickMarkdownFilePath", () => {
  it("pick_markdown_file invoke 결과를 반환한다", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValueOnce("/Users/test/doc.md");

    const { pickMarkdownFilePath } = await import("./file-system");
    const result = await pickMarkdownFilePath();

    expect(invoke).toHaveBeenCalledWith("pick_markdown_file");
    expect(result).toBe("/Users/test/doc.md");
  });

  it("취소 시 null을 반환한다", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValueOnce(null);

    const { pickMarkdownFilePath } = await import("./file-system");
    const result = await pickMarkdownFilePath();

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm test -- file-system
```

Expected: FAIL — `pickMarkdownFilePath` is not exported

- [ ] **Step 3: 구현 추가**

`src/lib/file-system.ts`에 추가한다:

```typescript
export async function pickMarkdownFilePath(): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<string | null>("pick_markdown_file");
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npm test -- file-system
```

Expected: all tests pass

- [ ] **Step 5: 커밋**

```bash
git add src/lib/file-system.ts src/lib/file-system.test.ts
git commit -m "feat(file-system): pickMarkdownFilePath 추가"
```

---

## Task 5: Frontend — 초기 문서 로딩 (main.tsx + useDocumentSession)

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/hooks/useDocumentSession.ts`

- [ ] **Step 1: `useDocumentSession`에 `initialDocument` 옵션 추가**

`src/hooks/useDocumentSession.ts`에서 타입과 초기화 로직을 수정한다:

```typescript
// 타입 수정
type UseDocumentSessionOptions = {
  initialDocument?: OpenedDocument | null;
  onInfo: (message: string) => void;
  onError: (message: string) => void;
};

// 훅 시그니처 수정
export function useDocumentSession({
  initialDocument,
  onInfo,
  onError,
}: UseDocumentSessionOptions) {
  // ... 기존 state 선언 유지 ...

  // 훅 내부에 useEffect 추가 (기존 bumpDocumentKey 함수 아래):
  useEffect(() => {
    if (initialDocument) {
      applyOpenedDocument(initialDocument);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 마운트 시 한 번만 실행, applyOpenedDocument는 useEffectEvent라 안전

  // ... 나머지 기존 코드 ...
}
```

- [ ] **Step 2: `main.tsx` 업데이트 — URL 파라미터 파싱 및 초기 문서 로딩**

`src/main.tsx`를 다음과 같이 수정한다:

```typescript
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
```

- [ ] **Step 3: `App.tsx`에 `initialDocument` prop 추가**

`src/App.tsx`에서 타입과 사용 부분을 수정한다:

```typescript
// AppProps 타입 수정
type AppProps = {
  initialDocument?: OpenedDocument | null;
  initialPreferences?: AppPreferences;
};

// export default function App 시그니처 수정
export default function App({ initialDocument, initialPreferences }: AppProps) {
  // ... 기존 코드 ...

  // useDocumentSession 호출에 initialDocument 추가
  const session = useDocumentSession({
    initialDocument: initialDocument ?? null,
    onError: (message) => showToast(message, "error"),
    onInfo: (message) => showToast(message, "info"),
  });

  // ... 나머지 기존 코드 유지 ...
}
```

`App.tsx` 상단에 import 추가:
```typescript
import type { OpenedDocument } from "./lib/file-system";
```

- [ ] **Step 4: 빌드 확인**

```bash
npm run build
```

Expected: TypeScript 오류 없이 빌드 성공

- [ ] **Step 5: 수동 검증**

```bash
npm run tauri dev
```

1. 웰컴 화면에서 파일 열기 → 기존과 동일하게 동작 확인
2. `http://127.0.0.1:1420/?path=/tmp/test.md` 로 직접 접근 시 해당 파일이 로드되는지 확인 (테스트용 파일 생성 후)

- [ ] **Step 6: 커밋**

```bash
git add src/main.tsx src/hooks/useDocumentSession.ts src/App.tsx
git commit -m "feat: URL 파라미터로 초기 문서 로딩 지원"
```

---

## Task 6: Frontend — `preferences-changed` 이벤트 리스너 (App.tsx)

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: `listen` import 추가**

`src/App.tsx` 상단에 import를 추가한다:

```typescript
import { listen } from "@tauri-apps/api/event";
import { isTauriRuntime } from "./lib/file-system";
```

- [ ] **Step 2: `preferences-changed` 리스너 effect 추가**

App 컴포넌트 내부의 기존 `useEffect` 블록들 아래에 추가한다 (theme effect 아래가 적절):

```typescript
useEffect(() => {
  if (!isTauriRuntime()) {
    return;
  }

  let disposed = false;
  let cleanup: (() => void) | undefined;

  void listen<AppPreferences>("preferences-changed", (event) => {
    const prefs = event.payload;
    setIsExternalMediaAutoLoadEnabled(prefs.autoLoadExternalMedia);
    setIsPreviewVisible(prefs.isPreviewVisible);
    setIsTocVisible(prefs.isTocVisible);
    setPreviewPanelWidth(prefs.previewPanelWidth);
    setTocPanelWidth(prefs.tocPanelWidth);
    setThemeMode(prefs.themeMode);
  }).then((unlisten) => {
    if (disposed) {
      unlisten();
      return;
    }
    cleanup = unlisten;
  });

  return () => {
    disposed = true;
    cleanup?.();
  };
}, []);
```

- [ ] **Step 3: 빌드 확인**

```bash
npm run build
```

Expected: TypeScript 오류 없이 빌드 성공

- [ ] **Step 4: 수동 검증**

```bash
npm run tauri dev
```

1. 두 개의 창이 열린 상태에서 한 창의 테마를 변경한다
2. 다른 창에도 즉시 테마가 반영되는지 확인한다 (현재는 창이 하나뿐이므로 개발자 도구로 이벤트 확인)

- [ ] **Step 5: 커밋**

```bash
git add src/App.tsx
git commit -m "feat(App): preferences-changed 이벤트 리스너 추가"
```

---

## Task 7: Frontend — 멀티 윈도우 액션 라우팅 + 창 닫기 동작 (App.tsx)

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 필요한 import 추가**

`src/App.tsx`에 추가한다:

```typescript
import { openNewWindow, closeCurrentWindow } from "./lib/native-window";
import { pickMarkdownFilePath } from "./lib/file-system";
```

- [ ] **Step 2: `requestAction` 수정 — 문서가 열린 상태에서 new/open/openRecent는 더티 체크 건너뜀**

기존 `requestAction` 함수를 수정한다:

```typescript
// 변경 전:
function requestAction(action: PendingAction) {
  if (isDirty) {
    setPendingAction(action);
    return;
  }

  void performAction(action);
}

// 변경 후:
function requestAction(action: PendingAction) {
  // 문서가 열린 상태에서 new/open/openRecent는 새 창에서 열리므로
  // 현재 창의 더티 상태와 무관하게 즉시 수행한다
  const opensInNewWindow =
    !session.isWelcomeVisible &&
    (action.type === "new" || action.type === "open" || action.type === "openRecent");

  if (!opensInNewWindow && isDirty) {
    setPendingAction(action);
    return;
  }

  void performAction(action);
}
```

- [ ] **Step 3: `performAction` 수정 — new/open/openRecent 멀티 윈도우 라우팅**

기존 `performAction` 함수를 수정한다:

```typescript
// 변경 전:
async function performAction(action: PendingAction) {
  if (action.type === "closeWindow") {
    await closeCurrentWindowSession();
    return;
  }

  if (action.type === "new") {
    session.createNewDocument();
    return;
  }

  if (action.type === "open") {
    await session.openWithPicker();
    return;
  }

  const document = await session.loadRecentDocument(action.path);
  if (!document) {
    return;
  }

  session.applyOpenedDocument(document);
}

// 변경 후:
async function performAction(action: PendingAction) {
  if (action.type === "closeWindow") {
    await closeCurrentWindowSession();
    return;
  }

  if (action.type === "new") {
    if (!session.isWelcomeVisible) {
      await openNewWindow();
    } else {
      session.createNewDocument();
    }
    return;
  }

  if (action.type === "open") {
    if (!session.isWelcomeVisible) {
      const filePath = await pickMarkdownFilePath();
      if (filePath) {
        await openNewWindow(filePath);
      }
    } else {
      await session.openWithPicker();
    }
    return;
  }

  if (action.type === "openRecent") {
    if (!session.isWelcomeVisible) {
      await openNewWindow(action.path);
      return;
    }

    const document = await session.loadRecentDocument(action.path);
    if (!document) {
      return;
    }
    session.applyOpenedDocument(document);
    return;
  }
}
```

- [ ] **Step 4: `closeCurrentWindowSession` 수정 — Tauri에서는 창을 실제로 닫음**

기존 `closeCurrentWindowSession` 함수를 수정한다:

```typescript
// 변경 전:
async function closeCurrentWindowSession() {
  await hideWindowRef.current();
  resetDocumentAfterHide();
}

// 변경 후:
async function closeCurrentWindowSession() {
  if (isTauriRuntime()) {
    await closeCurrentWindow();
  } else {
    await hideWindowRef.current();
    resetDocumentAfterHide();
  }
}
```

- [ ] **Step 5: TypeScript 타입 확인**

`requestAction`에서 `action.type === "openRecent"` 비교 시 TypeScript가 `action.path`를 올바르게 좁히는지 확인한다. 기존 코드에서 `requestAction({ path, type: "openRecent" })` 형태로 사용하고 있으므로 `PendingAction` 타입에 `openRecent` + `path` 조합이 이미 정의되어 있다. 빌드 오류 없으면 통과.

- [ ] **Step 6: 빌드 확인**

```bash
npm run build
```

Expected: TypeScript 오류 없이 빌드 성공

- [ ] **Step 7: 수동 통합 검증**

```bash
npm run tauri dev
```

아래 시나리오를 순서대로 확인한다:

1. **웰컴 → 새 파일**: 웰컴 화면에서 Cmd+N → 현재 창에서 새 문서 생성 ✓
2. **문서 열린 상태 → 새 파일**: 문서가 열린 상태에서 Cmd+N → 새 OS 창에서 빈 문서 열림 ✓
3. **문서 열린 상태 → 파일 열기**: Cmd+O → 파일 선택 후 새 창에서 문서 열림 ✓
4. **더티 상태 → 새 파일**: 미저장 문서 상태에서 Cmd+N → 저장 다이얼로그 없이 새 창 열림 ✓
5. **창 닫기**: Cmd+W → 창이 실제로 닫힘 (웰컴으로 돌아가지 않음) ✓
6. **미저장 → 창 닫기**: 미저장 문서에서 Cmd+W → 저장 여부 확인 → 창 닫힘 ✓
7. **모든 창 닫힘 → 독 클릭**: 새 웰컴 창 생성 ✓
8. **설정 동기화**: 두 창 열린 상태에서 테마 변경 → 다른 창에도 즉시 반영 ✓

- [ ] **Step 8: 커밋**

```bash
git add src/App.tsx
git commit -m "feat(App): 멀티 윈도우 액션 라우팅 및 창 닫기 동작 구현"
```

---

## 완료 후 체크리스트

- [ ] 모든 태스크의 커밋이 `main` 브랜치에 포함됨
- [ ] `npm test` 전체 통과
- [ ] `cargo test` 전체 통과
- [ ] 통합 검증 시나리오 7가지 모두 수동 확인 완료
