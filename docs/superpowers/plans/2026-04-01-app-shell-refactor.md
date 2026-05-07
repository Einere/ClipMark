# App Shell Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/App.tsx`를 상위 오케스트레이터 역할로 축소하고, 액션 조립과 window lifecycle 연결, 화면 렌더링 분기를 별도 경계로 나눠 변경 비용을 줄인다.

**Architecture:** `App`는 상태를 조립하고 하위 경계에 전달하는 컨테이너로 남긴다. 메뉴/단축키/네이티브 오픈 액션은 `useAppShellActions`, window close/pending action/native visibility 연결은 `useAppShellLifecycle`로 추출하고, welcome/editor/dialog/toast/file input 렌더링은 `AppContent` 계열 컴포넌트로 분리한다.

**Tech Stack:** React 19, TypeScript, Vitest, Vite, Tauri adapter hooks

---

## File Structure

- Modify: `src/App.tsx`
  - 최종적으로 상태 준비와 하위 경계 연결만 담당한다.
- Create: `src/hooks/useAppShellActions.ts`
  - 메뉴, 단축키, 외부 open document 이벤트에서 쓰는 앱 액션 인터페이스를 조립한다.
- Create: `src/hooks/useAppShellActions.test.tsx`
  - 저장, 복사, 토글, 새 문서/열기 액션 wiring을 검증한다.
- Create: `src/hooks/useAppShellLifecycle.ts`
  - window visibility, close request, pending action resolution을 한 경계에서 조합한다.
- Create: `src/hooks/useAppShellLifecycle.test.tsx`
  - close request, hidden window open, pending action resolution wiring을 검증한다.
- Create: `src/components/app/AppContent.tsx`
  - welcome/editor 분기와 dialog/toast/file input 렌더링을 담당한다.
- Create: `src/components/app/AppContent.test.tsx`
  - welcome/editor 분기, dialog open, toast presence를 검증한다.
- Modify: `src/App.test.tsx`
  - 기존 toast lifecycle 테스트가 새 경계 아래에서도 유지되는지 검증한다.

### Task 1: 앱 액션 조립부 추출

**Files:**
- Create: `src/hooks/useAppShellActions.ts`
- Test: `src/hooks/useAppShellActions.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 액션 훅 테스트를 먼저 추가**

```tsx
import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppShellActions } from "./useAppShellActions";

type Controls = ReturnType<typeof useAppShellActions>;

function Harness({
  onReady,
}: {
  onReady: (controls: Controls) => void;
}) {
  const controls = useAppShellActions({
    activeFilename: "draft.md",
    canSaveDocument: true,
    filePath: "/tmp/draft.md",
    requestAction: vi.fn(),
    requestVisibleAction: vi.fn(),
    saveDocument: vi.fn().mockResolvedValue(true),
    setIsExternalMediaAutoLoadEnabled: vi.fn(),
    setIsPreviewVisible: vi.fn(),
    setIsTocVisible: vi.fn(),
    setThemeMode: vi.fn(),
    showToast: vi.fn(),
  });

  onReady(controls);
  return null;
}

describe("useAppShellActions", () => {
  it("forwards menu save with active filename and saveAs flag", async () => {
    // render harness
    // call controls.handleMenuSave(true)
    // expect saveDocument toHaveBeenCalledWith({ activeFilename: "draft.md", saveAs: true })
  });

  it("routes welcome and native open flows through visible actions", async () => {
    // call handleMenuNew / handleMenuOpen / handleMenuOpenRecent
    // expect requestVisibleAction calls with typed pending actions
  });
});
```

- [ ] **Step 2: 실패를 확인**

Run: `npm run test -- src/hooks/useAppShellActions.test.tsx`
Expected: FAIL with `Cannot find module './useAppShellActions'`

- [ ] **Step 3: 최소 구현으로 액션 조립 훅을 만든다**

```ts
import { useEffectEvent } from "react";
import type { ThemeMode } from "../lib/preview-preferences";
import type { PendingAction } from "../lib/pending-action";

type UseAppShellActionsOptions = {
  activeFilename: string;
  canSaveDocument: boolean;
  filePath: string | null;
  requestAction: (action: PendingAction) => void;
  requestVisibleAction: (action: PendingAction) => void;
  saveDocument: (options: { activeFilename: string; saveAs?: boolean }) => Promise<boolean>;
  setIsExternalMediaAutoLoadEnabled: (updater: (value: boolean) => boolean) => void;
  setIsPreviewVisible: (updater: (value: boolean) => boolean) => void;
  setIsTocVisible: (updater: (value: boolean) => boolean) => void;
  setThemeMode: (value: ThemeMode) => void;
  showToast: (message: string, variant?: "success" | "info" | "error") => void;
};

export function useAppShellActions({
  activeFilename,
  canSaveDocument,
  filePath,
  requestAction,
  requestVisibleAction,
  saveDocument,
  setIsExternalMediaAutoLoadEnabled,
  setIsPreviewVisible,
  setIsTocVisible,
  setThemeMode,
  showToast,
}: UseAppShellActionsOptions) {
  const handleMenuNew = useEffectEvent(() => {
    requestVisibleAction({ type: "new" });
  });

  const handleMenuOpen = useEffectEvent(() => {
    requestVisibleAction({ type: "open" });
  });

  const handleMenuOpenRecent = useEffectEvent((path: string) => {
    requestVisibleAction({ path, type: "openRecent" });
  });

  const handleMenuSave = useEffectEvent((saveAs = false) => {
    if (!canSaveDocument) {
      return;
    }

    void saveDocument({ activeFilename, saveAs });
  });

  const handleWelcomeNew = useEffectEvent(() => {
    requestAction({ type: "new" });
  });

  const handleWelcomeOpen = useEffectEvent(() => {
    requestAction({ type: "open" });
  });

  const handleWelcomeOpenRecent = useEffectEvent((path: string) => {
    requestAction({ path, type: "openRecent" });
  });

  const handleMenuCopyFilePath = useEffectEvent(async () => {
    if (!filePath) {
      return;
    }

    try {
      await navigator.clipboard.writeText(filePath);
      showToast("Copied the file path to the clipboard.");
    } catch {
      showToast("Could not copy the file path.", "error");
    }
  });

  return {
    handleMenuCopyFilePath,
    handleMenuNew,
    handleMenuOpen,
    handleMenuOpenRecent,
    handleMenuSave,
    handleMenuSetThemeMode: setThemeMode,
    handleMenuToggleExternalMedia: () => setIsExternalMediaAutoLoadEnabled((value) => !value),
    handleMenuTogglePreview: () => setIsPreviewVisible((value) => !value),
    handleMenuToggleToc: () => setIsTocVisible((value) => !value),
    handleWelcomeNew,
    handleWelcomeOpen,
    handleWelcomeOpenRecent,
  };
}
```

- [ ] **Step 4: `App.tsx`에서 메뉴/웰컴 액션을 훅으로 교체**

```tsx
const actions = useAppShellActions({
  activeFilename,
  canSaveDocument,
  filePath: session.filePath,
  requestAction,
  requestVisibleAction,
  saveDocument: session.saveDocument,
  setIsExternalMediaAutoLoadEnabled,
  setIsPreviewVisible,
  setIsTocVisible,
  setThemeMode,
  showToast,
});

useWindowShortcuts({
  onNew: actions.handleWelcomeNew,
  onOpen: actions.handleWelcomeOpen,
  onSave: actions.handleMenuSave,
});

useNativeOpenDocumentListener({
  onOpenDocument: actions.handleMenuOpenRecent,
});
```

- [ ] **Step 5: 테스트를 다시 실행**

Run: `npm run test -- src/hooks/useAppShellActions.test.tsx src/App.test.tsx`
Expected: PASS

### Task 2: window lifecycle 조합 훅 추출

**Files:**
- Create: `src/hooks/useAppShellLifecycle.ts`
- Test: `src/hooks/useAppShellLifecycle.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: lifecycle 훅 테스트를 먼저 추가**

```tsx
import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppShellLifecycle } from "./useAppShellLifecycle";

describe("useAppShellLifecycle", () => {
  it("exposes request and resolution handlers backed by pending document actions", async () => {
    // mock useNativeWindowState, usePendingDocumentAction, useWindowCloseRequest
    // render hook harness
    // assert lifecycle object forwards pending action handlers
  });

  it("closes current window session by hiding first and resetting document in a transition", async () => {
    // assert hideWindow runs before closeCurrentDocument
  });
});
```

- [ ] **Step 2: 실패를 확인**

Run: `npm run test -- src/hooks/useAppShellLifecycle.test.tsx`
Expected: FAIL with `Cannot find module './useAppShellLifecycle'`

- [ ] **Step 3: lifecycle 훅을 구현**

```ts
import { startTransition, useEffectEvent, useRef, useState } from "react";
import type { PendingAction } from "../lib/pending-action";
import { useNativeWindowState } from "./useNativeWindowState";
import { usePendingDocumentAction } from "./usePendingDocumentAction";
import { useWindowCloseRequest } from "./useWindowCloseRequest";

export function useAppShellLifecycle(options: {
  activeFilename: string;
  applyOpenedDocument: (document: {
    filename: string;
    markdown: string;
    path: string | null;
  }) => void;
  closeCurrentDocument: () => void;
  createNewDocument: () => void;
  filePath: string | null;
  isDirty: boolean;
  loadRecentDocument: (path: string) => Promise<{
    filename: string;
    markdown: string;
    path: string | null;
  } | null>;
  openWithPicker: () => Promise<{
    filename: string;
    markdown: string;
    path: string | null;
  } | null>;
  openWithPickerWithoutShowingWindow: () => Promise<{
    filename: string;
    markdown: string;
    path: string | null;
  } | null>;
  saveDocument: (options: { activeFilename: string; saveAs?: boolean }) => Promise<boolean>;
  windowTitle: string;
}) {
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  const hideWindowRef = useRef<() => Promise<void>>(async () => {});
  const queuePendingActionRef = useRef<(action: PendingAction) => void>(() => undefined);

  const resetDocumentAfterHide = useEffectEvent(() => {
    startTransition(() => {
      options.closeCurrentDocument();
    });
  });

  const closeCurrentWindowSession = useEffectEvent(async () => {
    await hideWindowRef.current();
    resetDocumentAfterHide();
  });

  const handleCloseRequested = useWindowCloseRequest({
    activeFilename: options.activeFilename,
    closeWindowSession: closeCurrentWindowSession,
    isDirty: options.isDirty,
    queuePendingAction: (action) => queuePendingActionRef.current(action),
    saveDocument: options.saveDocument,
  });

  const nativeWindow = useNativeWindowState({
    filePath: options.filePath,
    isDirty: options.isDirty,
    onRequestClose: handleCloseRequested,
    onVisibilityChange: setIsWindowVisible,
    windowTitle: options.windowTitle,
  });

  hideWindowRef.current = nativeWindow.hideWindow;

  const pendingActions = usePendingDocumentAction({
    activeFilename: options.activeFilename,
    applyOpenedDocument: options.applyOpenedDocument,
    createNewDocument: options.createNewDocument,
    ensureWindowVisible: nativeWindow.ensureWindowVisible,
    hideWindowAndResetDocument: closeCurrentWindowSession,
    isDirty: options.isDirty,
    isWindowVisible,
    loadRecentDocument: options.loadRecentDocument,
    onWindowVisibleChange: setIsWindowVisible,
    openWithPicker: options.openWithPicker,
    openWithPickerWithoutShowingWindow: options.openWithPickerWithoutShowingWindow,
    saveDocument: options.saveDocument,
  });

  queuePendingActionRef.current = pendingActions.queuePendingAction;

  return {
    ...pendingActions,
    handleEditorFocusChange: nativeWindow.handleEditorFocusChange,
    isWindowVisible,
  };
}
```

- [ ] **Step 4: `App.tsx`의 lifecycle 관련 로직을 새 훅으로 치환**

```tsx
const lifecycle = useAppShellLifecycle({
  activeFilename,
  applyOpenedDocument: session.applyOpenedDocument,
  closeCurrentDocument: session.closeCurrentDocument,
  createNewDocument: session.createNewDocument,
  filePath: session.filePath,
  isDirty,
  loadRecentDocument: session.loadRecentDocument,
  openWithPicker: session.openWithPicker,
  openWithPickerWithoutShowingWindow: session.openWithPickerWithoutShowingWindow,
  saveDocument: session.saveDocument,
  windowTitle,
});

const canSaveDocument = lifecycle.isWindowVisible && !session.isWelcomeVisible;
const canTogglePanels = lifecycle.isWindowVisible && !session.isWelcomeVisible;
const canCopyFilePath = lifecycle.isWindowVisible && session.filePath !== null;
```

- [ ] **Step 5: 테스트를 다시 실행**

Run: `npm run test -- src/hooks/useAppShellLifecycle.test.tsx src/hooks/usePendingDocumentAction.test.tsx src/hooks/useWindowCloseRequest.test.tsx`
Expected: PASS

### Task 3: 렌더링 분기와 화면 조립 추출

**Files:**
- Create: `src/components/app/AppContent.tsx`
- Test: `src/components/app/AppContent.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 화면 컴포넌트 테스트를 먼저 추가**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppContent } from "./AppContent";

describe("AppContent", () => {
  it("renders the welcome screen when the session is in welcome mode", () => {
    render(
      <AppContent
        activeFilename="ClipMark"
        dialogOpen={false}
        isWelcomeVisible
        onDiscard={vi.fn()}
        onOpen={vi.fn()}
        onOpenRecent={vi.fn()}
        onNew={vi.fn()}
        onSave={vi.fn()}
        recentFiles={[]}
        toast={null}
      />,
    );

    expect(screen.getByText(/welcome/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패를 확인**

Run: `npm run test -- src/components/app/AppContent.test.tsx`
Expected: FAIL with `Cannot find module './AppContent'`

- [ ] **Step 3: 화면 조립 컴포넌트를 구현**

```tsx
import { Suspense } from "react";
import type { RefObject } from "react";
import { UnsavedChangesDialog } from "../dialog/UnsavedChangesDialog";
import type { MarkdownEditorHandle } from "../editor/MarkdownEditor";
import { Toast } from "../ui/Toast";
import { WelcomeScreen } from "../welcome/WelcomeScreen";
import { AppShellFallback } from "../../App";

export function AppContent(props: {
  activeFilename: string;
  dialogDescription: string;
  dialogOpen: boolean;
  dialogTitle: string;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  filePath: string | null;
  handleOpenFile: React.ChangeEventHandler<HTMLInputElement>;
  isWelcomeVisible: boolean;
  onDiscard: () => void;
  onEditorFocusChange: (focused: boolean) => void;
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
  onPanelWidthsChange: (sizes: { previewPanelWidth: number; tocPanelWidth: number }) => void;
  onPathCopy: () => void;
  onPathCopyError: () => void;
  onSave: () => void;
  recentFiles: Array<{ filename: string; path: string }>;
  toast: {
    id: number;
    message: string;
    phase: "enter" | "idle" | "exit";
    title?: string;
    variant: "success" | "info" | "error";
  } | null;
}) {
  return (
    <div className="app-shell">
      {props.isWelcomeVisible ? (
        <WelcomeScreen
          onNew={props.onNew}
          onOpen={props.onOpen}
          onOpenRecent={props.onOpenRecent}
          recentFiles={props.recentFiles}
        />
      ) : (
        <Suspense fallback={<AppShellFallback />}>
          {/* EditorWorkspace props 그대로 전달 */}
        </Suspense>
      )}

      <UnsavedChangesDialog
        filename={props.activeFilename}
        onDiscard={props.onDiscard}
        onSave={props.onSave}
        open={props.dialogOpen}
        title={props.dialogTitle}
        description={props.dialogDescription}
      />

      <input
        accept=".md,text/markdown,text/plain"
        hidden
        onChange={props.handleOpenFile}
        ref={props.fileInputRef}
        type="file"
      />

      {props.toast ? <Toast key={props.toast.id} {...props.toast} onExitComplete={() => undefined} /> : null}
    </div>
  );
}
```

- [ ] **Step 4: `App.tsx`는 파생 상태와 하위 경계 연결만 남긴다**

```tsx
return (
  <AppContent
    activeFilename={activeFilename}
    dialogDescription={dialogState.description}
    dialogOpen={lifecycle.pendingAction !== null}
    dialogTitle={dialogState.title}
    editorRef={editorRef}
    fileInputRef={session.fileInputRef}
    filePath={session.filePath}
    handleOpenFile={session.handleOpenFile}
    isWelcomeVisible={session.isWelcomeVisible}
    onDiscard={() => void lifecycle.resolvePendingActionWithDiscard()}
    onEditorFocusChange={lifecycle.handleEditorFocusChange}
    onNew={actions.handleWelcomeNew}
    onOpen={actions.handleWelcomeOpen}
    onOpenRecent={actions.handleWelcomeOpenRecent}
    onSave={() => void lifecycle.resolvePendingActionWithSave()}
    recentFiles={session.recentFiles}
    toast={toast}
  />
);
```

- [ ] **Step 5: 테스트를 다시 실행**

Run: `npm run test -- src/components/app/AppContent.test.tsx src/App.test.tsx`
Expected: PASS

### Task 4: 불필요한 파생/메모 정리와 최종 회귀 검증

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: 파생값을 이름 있는 묶음으로 정리하고 단순 `useMemo`를 제거**

```tsx
const documentUiState = {
  activeFilename: session.isWelcomeVisible ? APP_NAME : (session.filename ?? "Untitled.md"),
  documentStatus: getDocumentStatus(session.filePath, isDirty, session.isWelcomeVisible),
};

const visibleDocumentStatus = getVisibleDocumentStatus(documentUiState.documentStatus);
const windowTitle = buildWindowTitle(documentUiState.activeFilename, documentUiState.documentStatus);
const dialogState = getUnsavedDialogState(documentUiState.activeFilename, lifecycle.pendingAction);
```

- [ ] **Step 2: `App.test.tsx`를 새 구조에 맞게 갱신**

```tsx
vi.mock("./components/app/AppContent", () => ({
  AppContent: ({ toast, onPathCopy }: { toast: { phase: string } | null; onPathCopy: () => void }) => (
    <>
      <button onClick={onPathCopy} type="button">Trigger toast</button>
      {toast ? <div data-phase={toast.phase} role="status" /> : null}
    </>
  ),
}));

it("keeps the toast lifecycle intact after the app shell refactor", async () => {
  // render App
  // click trigger
  // advance timers
  // expect enter -> exit -> removed
});
```

- [ ] **Step 3: 전체 관련 테스트를 실행**

Run: `npm run test -- src/App.test.tsx src/hooks/useAppShellActions.test.tsx src/hooks/useAppShellLifecycle.test.tsx src/components/app/AppContent.test.tsx`
Expected: PASS

- [ ] **Step 4: 전체 스위트를 실행**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/App.tsx src/App.test.tsx src/hooks/useAppShellActions.ts src/hooks/useAppShellActions.test.tsx src/hooks/useAppShellLifecycle.ts src/hooks/useAppShellLifecycle.test.tsx src/components/app/AppContent.tsx src/components/app/AppContent.test.tsx docs/superpowers/plans/2026-04-01-app-shell-refactor.md
git commit -m "refactor(app): split app shell orchestration boundaries"
```
