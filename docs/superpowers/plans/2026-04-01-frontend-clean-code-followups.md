# Frontend Clean Code Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 파일 경로 복사 로직, 앱 뷰 파생 상태, 리뷰 기준 문서를 각각 독립적으로 정리해 변경 비용을 낮춘다.

**Architecture:** 세 작업을 서로 분리된 변경 단위로 다룬다. 1번은 파일 경로 복사 정책을 한 경계로 모으고, 2번은 문서 상태와 창 제목 파생 규칙을 단일 소스로 합치며, 3번은 현재 코드베이스에 대한 클린코드/베스트프랙티스 점검 결과를 파일 단위로 구조화한다.

**Tech Stack:** React 19, TypeScript, Vitest, Vite, Tauri

---

## File Map

- Modify: `src/hooks/useAppShellActions.ts`
  - 메뉴 기반 파일 경로 복사 동작과 토스트 연계를 담당한다.
- Modify: `src/components/workspace/EditorWorkspace.tsx`
  - 워크스페이스 기반 파일 경로 복사 동작을 호출한다.
- Modify: `src/components/app/EditorWorkspaceContainer.tsx`
  - 워크스페이스 컨테이너에서 토스트를 직접 넘기는 구조를 정리한다.
- Create: `src/hooks/useCopyFilePath.ts`
  - 파일 경로 복사와 성공/실패 토스트 정책을 단일 훅으로 캡슐화한다.
- Create: `src/hooks/useCopyFilePath.test.tsx`
  - 파일 경로 복사 성공/실패와 `null` 경로 방어 로직을 검증한다.
- Modify: `src/App.tsx`
  - `activeFilename`, `documentStatus`, `windowTitle` 파생 책임을 직접 들고 있지 않도록 정리한다.
- Modify: `src/hooks/useAppViewState.ts`
  - 앱 뷰 파생 상태의 단일 진입점이 되도록 확장한다.
- Modify: `src/hooks/useAppViewState.test.tsx`
  - 앱 뷰 파생 상태가 제목과 문서 상태를 일관되게 계산하는지 검증한다.
- Create: `docs/frontend-audit/2026-04-01-clean-code-review.md`
  - 현재 코드베이스의 파일별 점검 결과와 우선순위를 문서화한다.

### Task 1: 파일 경로 복사 정책 통합

**Files:**
- Create: `src/hooks/useCopyFilePath.ts`
- Create: `src/hooks/useCopyFilePath.test.tsx`
- Modify: `src/hooks/useAppShellActions.ts`
- Modify: `src/components/workspace/EditorWorkspace.tsx`
- Modify: `src/components/app/EditorWorkspaceContainer.tsx`

- [ ] **Step 1: 기존 호출 지점과 메시지 정책을 확인한다**

Run: `rg -n 'navigator\\.clipboard\\.writeText|Copied the file path|Could not copy the file path' src`
Expected: `useAppShellActions.ts`, `EditorWorkspace.tsx`, `EditorWorkspaceContainer.tsx` 세 파일에서 중복 패턴이 확인된다.

- [ ] **Step 2: 새 훅 테스트를 먼저 추가한다**

테스트 초안:

```tsx
import { renderHook, act } from "@testing-library/react";
import { vi, describe, expect, it, beforeEach } from "vitest";
import { useCopyFilePath } from "./useCopyFilePath";

describe("useCopyFilePath", () => {
  const showToast = vi.fn();

  beforeEach(() => {
    showToast.mockReset();
  });

  it("copies the file path and shows a success toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    const { result } = renderHook(() => useCopyFilePath({ showToast }));

    await act(async () => {
      await result.current.copyFilePath("/tmp/draft.md");
    });

    expect(writeText).toHaveBeenCalledWith("/tmp/draft.md");
    expect(showToast).toHaveBeenCalledWith("Copied the file path to the clipboard.", "success");
  });

  it("shows an error toast when clipboard write fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    const { result } = renderHook(() => useCopyFilePath({ showToast }));

    await act(async () => {
      await result.current.copyFilePath("/tmp/draft.md");
    });

    expect(showToast).toHaveBeenCalledWith("Could not copy the file path.", "error");
  });

  it("returns early when the path is missing", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    const { result } = renderHook(() => useCopyFilePath({ showToast }));

    await act(async () => {
      await result.current.copyFilePath(null);
    });

    expect(writeText).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

Run: `npm run test -- src/hooks/useCopyFilePath.test.tsx`
Expected: FAIL with module not found for `useCopyFilePath`.

- [ ] **Step 4: 최소 구현으로 새 훅을 추가한다**

구현 초안:

```ts
import { useEffectEvent } from "react";

type ShowToast = (
  message: string,
  variant?: "error" | "info" | "success" | "warning",
  title?: string,
) => void;

export function useCopyFilePath({
  showToast,
}: {
  showToast: ShowToast;
}) {
  const copyFilePath = useEffectEvent(async (filePath: string | null) => {
    if (!filePath) {
      return;
    }

    try {
      await navigator.clipboard.writeText(filePath);
      showToast("Copied the file path to the clipboard.", "success");
    } catch {
      showToast("Could not copy the file path.", "error");
    }
  });

  return { copyFilePath };
}
```

- [ ] **Step 5: 기존 호출 지점을 새 훅으로 교체한다**

변경 원칙:

```ts
// useAppShellActions.ts
// clipboard 직접 호출 제거
// 외부에서 주입받은 copyFilePath(filePath)만 호출

// EditorWorkspace.tsx
// navigator.clipboard 직접 호출 제거
// onPathCopy: () => void 형태의 prop만 유지

// EditorWorkspaceContainer.tsx
// 성공/실패 토스트 prop 제거
// 훅에서 받은 copyFilePath(filePath)를 EditorWorkspace로 전달
```

- [ ] **Step 6: 관련 테스트를 실행한다**

Run: `npm run test -- src/hooks/useCopyFilePath.test.tsx src/hooks/useAppShellActions.test.tsx src/components/app/EditorWorkspaceContainer.test.tsx src/components/workspace/EditorWorkspace.test.tsx`
Expected: PASS

- [ ] **Step 7: 변경을 커밋한다**

```bash
git add src/hooks/useCopyFilePath.ts src/hooks/useCopyFilePath.test.tsx src/hooks/useAppShellActions.ts src/components/workspace/EditorWorkspace.tsx src/components/app/EditorWorkspaceContainer.tsx
git commit -m "refactor(app): centralize file path copy behavior"
```

### Task 2: 앱 뷰 파생 상태 단일화

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/hooks/useAppViewState.ts`
- Modify: `src/hooks/useAppViewState.test.tsx`

- [ ] **Step 1: 중복 파생 로직 위치를 확인한다**

Run: `rg -n 'activeFilename|windowTitle|getDocumentStatus|buildWindowTitle' src/App.tsx src/hooks/useAppViewState.ts src/lib/window-state.ts`
Expected: `App.tsx`와 `useAppViewState.ts`에 같은 성격의 파생 로직이 함께 존재한다.

- [ ] **Step 2: 뷰 상태 테스트를 먼저 확장한다**

테스트 초안:

```tsx
it("derives active filename, document status, and window title from one source", () => {
  const { result, rerender } = renderHook((props) => useAppViewState(props), {
    initialProps: {
      filePath: null,
      filename: null,
      isDirty: false,
      isWelcomeVisible: true,
      isWindowVisible: true,
      pendingAction: null,
    },
  });

  expect(result.current.activeFilename).toBe("ClipMark");
  expect(result.current.documentStatus).toBe("initial");
  expect(result.current.windowTitle).toBe("ClipMark");

  rerender({
    filePath: "/tmp/draft.md",
    filename: "draft.md",
    isDirty: true,
    isWelcomeVisible: false,
    isWindowVisible: true,
    pendingAction: null,
  });

  expect(result.current.activeFilename).toBe("draft.md");
  expect(result.current.documentStatus).toBe("edited");
  expect(result.current.windowTitle).toBe("draft.md - edited");
});
```

- [ ] **Step 3: 테스트가 현재 구조를 보호하는지 확인한다**

Run: `npm run test -- src/hooks/useAppViewState.test.tsx`
Expected: PASS 또는 필요한 expectation 차이가 드러난다. 실패 시 현재 public contract를 먼저 맞춘다.

- [ ] **Step 4: `useAppViewState`를 단일 파생 소스로 정리한다**

변경 원칙:

```ts
// useAppViewState.ts
// activeFilename -> documentStatus -> visibleDocumentStatus -> windowTitle
// 순서로만 파생하고, App이 같은 계산을 다시 하지 않게 한다.
```

- [ ] **Step 5: `App.tsx`에서 중복 계산을 제거한다**

변경 원칙:

```ts
// App.tsx
// const activeFilename = ...
// const windowTitle = ...
// const getDocumentStatus(...) 호출 제거
// lifecycle와 actions에는 viewState에서 계산된 값만 전달
```

- [ ] **Step 6: 영향 테스트를 실행한다**

Run: `npm run test -- src/hooks/useAppViewState.test.tsx src/hooks/useAppShellLifecycle.test.tsx src/App.test.tsx`
Expected: PASS

- [ ] **Step 7: 변경을 커밋한다**

```bash
git add src/App.tsx src/hooks/useAppViewState.ts src/hooks/useAppViewState.test.tsx
git commit -m "refactor(app): unify derived view state"
```

### Task 3: 파일별 클린코드 점수표와 감사 문서 작성

**Files:**
- Create: `docs/frontend-audit/2026-04-01-clean-code-review.md`

- [ ] **Step 1: 점검 대상 파일을 확정한다**

Run: `rg --files src/components src/hooks src/lib | rg 'App|Workspace|Menu|Preview|Toast|DocumentSession'`
Expected: 앱 셸, 워크스페이스, 메뉴, 세션 관련 핵심 파일 목록이 추려진다.

- [ ] **Step 2: 평가 기준 템플릿을 문서에 만든다**

문서 구조 초안:

```md
# Frontend Clean Code Review

## 기준
- 가독성
- 예측 가능성
- 응집도
- 결합도
- React/Vercel 성능 패턴

## 요약
- 즉시 수정 필요
- 다음 리팩터링 사이클
- 유지 권장

## 파일별 평가
### src/App.tsx
- 점수:
- 주요 이슈:
- 권장 조치:
```

- [ ] **Step 3: 핵심 파일을 우선순위별로 기록한다**

최소 포함 파일:

```md
- src/App.tsx
- src/hooks/useAppShellActions.ts
- src/hooks/useAppMenuController.ts
- src/hooks/useAppViewState.ts
- src/components/workspace/EditorWorkspace.tsx
- src/components/app/AppContent.tsx
- src/components/app/EditorWorkspaceContainer.tsx
```

- [ ] **Step 4: 각 파일에 점수와 근거를 채운다**

기록 원칙:

```md
### src/hooks/useAppMenuController.ts
- 가독성: 4/5
- 예측 가능성: 4/5
- 응집도: 4/5
- 결합도: 3/5
- React/Vercel: state 대신 ref로 관리 가능
- 메모: imperative controller를 state에 둬서 불필요한 렌더 가능성 존재
```

- [ ] **Step 5: 우선순위 로드맵을 문서 말미에 추가한다**

문서 말미 초안:

```md
## 추천 실행 순서
1. 파일 경로 복사 정책 통합
2. 앱 뷰 파생 상태 단일화
3. 메뉴 컨트롤러의 transient state 제거
4. AppContent prop bag 축소
```

- [ ] **Step 6: 문서 내용을 자체 검토한다**

Run: `sed -n '1,240p' docs/frontend-audit/2026-04-01-clean-code-review.md`
Expected: 모든 파일 항목에 근거와 조치가 있고, `TODO`, `TBD` 같은 placeholder가 없다.

- [ ] **Step 7: 변경을 커밋한다**

```bash
git add docs/frontend-audit/2026-04-01-clean-code-review.md
git commit -m "docs: add frontend clean code audit"
```

## Self-Review

- Spec coverage:
  - 1번 작업은 파일 경로 복사 로직 중복 제거를 다룬다.
  - 2번 작업은 파생 상태 계산 단일화를 다룬다.
  - 3번 작업은 파일별 평가표 작성 요구를 다룬다.
- Placeholder scan:
  - 실행 명령, 파일 경로, 최소 코드 초안, 검증 범위를 모두 채웠다.
- Type consistency:
  - `copyFilePath(filePath: string | null)`와 `showToast(...)` 시그니처를 전 작업에서 일관되게 유지했다.

