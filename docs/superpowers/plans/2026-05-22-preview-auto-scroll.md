# Preview Auto Scroll Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 편집 중 활성 줄 기반 미리보기 자동 스크롤을 anchor 블록 단위로 안정화해 입력 중 흔들림을 줄인다.

**Architecture:** `preview-scroll`에는 anchor key와 탐색 관련 순수 로직을 두고, `MarkdownPreview`는 DOM 측정, animation frame 예약, 수동 스크롤 suspend 상태만 관리한다. 자동 스크롤의 주 트리거는 `activeLine` 변경으로 제한하고, `previewHtml` 변경은 anchor 목록 갱신만 담당한다.

**Tech Stack:** React 19, TypeScript, Vitest, jsdom, Vite

---

## File Structure

- Modify: `src/lib/preview-scroll.ts`
  - preview anchor key를 생성하는 helper를 추가한다.
- Modify: `src/lib/preview-scroll.test.ts`
  - anchor key와 기존 closest anchor 동작을 검증한다.
- Modify: `src/components/preview/MarkdownPreview.tsx`
  - `lastSyncedLineRef`를 anchor key 기반 상태로 교체한다.
  - preview HTML 변경 시 즉시 스크롤하지 않도록 effect 책임을 분리한다.
  - 자동 스크롤을 `requestAnimationFrame`으로 예약하고 입력 중 `behavior: "auto"`를 사용한다.
  - 수동 preview 스크롤 감지 후 자동 추적을 잠시 중단한다.
- Modify: `src/components/preview/MarkdownPreview.test.tsx`
  - 재렌더, 같은 anchor 내부 이동, 다른 anchor 이동, 수동 스크롤 suspend, behavior 정책을 검증한다.

### Task 1: Preview anchor key helper 추가

**Files:**
- Modify: `src/lib/preview-scroll.ts`
- Modify: `src/lib/preview-scroll.test.ts`

- [x] **Step 1: helper 테스트를 먼저 추가한다**

`src/lib/preview-scroll.test.ts`의 import를 확장하고 다음 테스트를 추가한다.

```ts
import { describe, expect, it } from "vitest";
import {
  findClosestPreviewAnchor,
  getPreviewAnchorKey,
} from "./preview-scroll";

describe("getPreviewAnchorKey", () => {
  it("returns a stable key for an anchor range", () => {
    expect(getPreviewAnchorKey({ lineStart: 12, lineEnd: 16 })).toBe("12:16");
  });
});
```

- [x] **Step 2: 테스트 실패를 확인한다**

Run: `npm run test -- src/lib/preview-scroll.test.ts`

Expected: FAIL with `Module '"./preview-scroll"' has no exported member 'getPreviewAnchorKey'`.

- [x] **Step 3: 최소 구현을 추가한다**

`src/lib/preview-scroll.ts`에 helper를 추가한다.

```ts
export function getPreviewAnchorKey(anchor: PreviewScrollAnchor) {
  return `${anchor.lineStart}:${anchor.lineEnd}`;
}
```

- [x] **Step 4: 테스트 통과를 확인한다**

Run: `npm run test -- src/lib/preview-scroll.test.ts`

Expected: PASS.

- [x] **Step 5: 변경을 커밋한다**

```bash
git add src/lib/preview-scroll.ts src/lib/preview-scroll.test.ts
git commit -m "refactor(preview): add stable preview anchor keys"
```

### Task 2: MarkdownPreview 자동 스크롤 트리거 분리

**Files:**
- Modify: `src/components/preview/MarkdownPreview.tsx`
- Modify: `src/components/preview/MarkdownPreview.test.tsx`

- [x] **Step 1: preview HTML 재렌더만으로 스크롤하지 않는 실패 테스트를 추가한다**

`src/components/preview/MarkdownPreview.test.tsx`에 다음 테스트를 추가한다.

```tsx
it("does not scroll again when only the preview html changes for the same active anchor", () => {
  const renderer = createTestRenderer();
  cleanupHandlers.push(() => renderer.cleanup());

  const originalScrollTo = HTMLElement.prototype.scrollTo;
  const scrollTo = vi.fn(function setScrollTop(this: HTMLElement, options: ScrollToOptions) {
    this.scrollTop = options.top ?? 0;
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollTo,
    writable: true,
  });
  cleanupHandlers.push(() => {
    if (originalScrollTo) {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
        writable: true,
      });
      return;
    }

    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
  });

  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function getClientHeight(this: HTMLElement) {
    return this.classList.contains("markdown-preview") ? 400 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function getScrollHeight(this: HTMLElement) {
    return this.classList.contains("markdown-preview") ? 1200 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect(this: HTMLElement) {
    if (this.classList.contains("markdown-preview")) {
      return new DOMRect(0, 0, 320, 400);
    }

    const lineStart = Number(this.dataset.sourceLineStart ?? NaN);
    if (lineStart === 5) {
      return new DOMRect(0, 520, 320, 48);
    }

    return new DOMRect(0, 0, 0, 0);
  });

  renderer.render({
    activeLine: 5,
    markdown: "# Heading\n\nFirst paragraph\n\n## Section\n\nSecond paragraph",
  });
  const initialCallCount = scrollTo.mock.calls.length;

  renderer.render({
    activeLine: 5,
    markdown: "# Heading\n\nFirst paragraph\n\n## Section updated\n\nSecond paragraph",
  });

  expect(scrollTo).toHaveBeenCalledTimes(initialCallCount);
});
```

- [x] **Step 2: 테스트 실패를 확인한다**

Run: `npm run test -- src/components/preview/MarkdownPreview.test.tsx`

Expected: FAIL because `scrollTo` is called again after `previewHtml` changes.

- [x] **Step 3: `MarkdownPreview`에서 previewHtml effect의 스크롤 호출을 제거한다**

`src/components/preview/MarkdownPreview.tsx`의 import와 refs를 먼저 바꾼다.

```tsx
import {
  findClosestPreviewAnchor,
  getPreviewAnchorKey,
  type PreviewScrollAnchor,
} from "../../lib/preview-scroll";
```

```tsx
const lastSyncedAnchorKeyRef = useRef<string | null>(null);
```

기존 `lastSyncedLineRef` 사용을 제거하고, `previewHtml` effect는 anchor 목록만 갱신하게 만든다.

```tsx
useEffect(() => {
  const container = rootRef.current;
  if (!container) {
    anchorsRef.current = [];
    return;
  }

  anchorsRef.current = Array.from(
    container.querySelectorAll<HTMLElement>("[data-source-line-start]"),
  )
    .map((element) => {
      const lineStart = Number(element.dataset.sourceLineStart);
      const lineEnd = Number(element.dataset.sourceLineEnd ?? lineStart);

      if (!Number.isFinite(lineStart) || !Number.isFinite(lineEnd)) {
        return null;
      }

      return {
        element,
        lineEnd,
        lineStart,
      };
    })
    .filter((anchor): anchor is PreviewAnchorElement => anchor !== null);
}, [previewHtml]);
```

- [x] **Step 4: activeLine effect에서만 스크롤을 실행하도록 조정한다**

`syncPreviewScroll` 내부의 중복 방지 조건을 anchor key 기준으로 바꾼다.

```tsx
const targetAnchor = findClosestPreviewAnchor(anchorsRef.current, activeLine);
if (!targetAnchor) {
  return;
}

const targetAnchorKey = getPreviewAnchorKey(targetAnchor);
if (lastSyncedAnchorKeyRef.current === targetAnchorKey) {
  return;
}
```

스크롤하지 않아도 현재 anchor가 안정 영역에 있으면 key를 기록한다.

```tsx
if (
  targetRect.top >= visibleTopThreshold &&
  targetRect.top <= visibleBottomThreshold
) {
  lastSyncedAnchorKeyRef.current = targetAnchorKey;
  return;
}
```

스크롤 후에도 같은 key를 기록한다.

```tsx
scrollPreviewTo(container, nextScrollTop, "auto");
lastSyncedAnchorKeyRef.current = targetAnchorKey;
```

- [x] **Step 5: 테스트 통과를 확인한다**

Run: `npm run test -- src/components/preview/MarkdownPreview.test.tsx`

Expected: PASS for the new preview HTML rerender test, with any old layoutVersion expectation updated in Task 4.

- [x] **Step 6: 변경을 커밋한다**

```bash
git add src/components/preview/MarkdownPreview.tsx src/components/preview/MarkdownPreview.test.tsx
git commit -m "fix(preview): avoid scrolling on preview rerender"
```

### Task 3: 같은 anchor 내부 이동은 스크롤하지 않고 다른 anchor 이동은 스크롤한다

**Files:**
- Modify: `src/components/preview/MarkdownPreview.tsx`
- Modify: `src/components/preview/MarkdownPreview.test.tsx`

- [ ] **Step 1: 같은 anchor 내부 activeLine 변경 테스트를 추가한다**

`src/components/preview/MarkdownPreview.test.tsx`에 다음 테스트를 추가한다.

```tsx
it("does not scroll while the active line stays inside the same preview anchor", () => {
  const renderer = createTestRenderer();
  cleanupHandlers.push(() => renderer.cleanup());

  const scrollTo = vi.fn(function setScrollTop(this: HTMLElement, options: ScrollToOptions) {
    this.scrollTop = options.top ?? 0;
  });
  const originalScrollTo = HTMLElement.prototype.scrollTo;
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollTo,
    writable: true,
  });
  cleanupHandlers.push(() => {
    if (originalScrollTo) {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
        writable: true,
      });
      return;
    }

    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
  });

  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function getClientHeight(this: HTMLElement) {
    return this.classList.contains("markdown-preview") ? 400 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function getScrollHeight(this: HTMLElement) {
    return this.classList.contains("markdown-preview") ? 1200 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect(this: HTMLElement) {
    if (this.classList.contains("markdown-preview")) {
      return new DOMRect(0, 0, 320, 400);
    }

    if (this.dataset.sourceLineStart === "1") {
      return new DOMRect(0, 520, 320, 120);
    }

    return new DOMRect(0, 0, 0, 0);
  });

  renderer.render({
    activeLine: 1,
    markdown: "First line\nSecond line\nThird line",
  });
  const initialCallCount = scrollTo.mock.calls.length;

  renderer.render({
    activeLine: 2,
    markdown: "First line\nSecond line\nThird line",
  });

  expect(scrollTo).toHaveBeenCalledTimes(initialCallCount);
});
```

- [ ] **Step 2: 다른 anchor 이동 테스트를 보강한다**

기존 `"scrolls the preview when the active line changes to an off-screen block"` 테스트의 기대값을 `behavior: "auto"`로 바꾼다.

```tsx
expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({
  behavior: "auto",
}));
```

- [ ] **Step 3: 테스트 실패를 확인한다**

Run: `npm run test -- src/components/preview/MarkdownPreview.test.tsx`

Expected: FAIL if same-anchor line changes still call `scrollTo`, or if behavior is still `smooth`.

- [ ] **Step 4: `scrollPreviewTo`가 behavior를 인자로 받게 바꾼다**

`src/components/preview/MarkdownPreview.tsx`의 helper를 다음 형태로 바꾼다.

```tsx
type PreviewScrollBehavior = ScrollBehavior;

function scrollPreviewTo(
  container: HTMLDivElement,
  top: number,
  behavior: PreviewScrollBehavior,
) {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (typeof container.scrollTo === "function") {
    container.scrollTo({
      behavior: prefersReducedMotion ? "auto" : behavior,
      top,
    });
    return;
  }

  container.scrollTop = top;
}
```

자동 추적 호출은 `auto`를 넘긴다.

```tsx
scrollPreviewTo(container, nextScrollTop, "auto");
```

- [ ] **Step 5: 테스트 통과를 확인한다**

Run: `npm run test -- src/components/preview/MarkdownPreview.test.tsx`

Expected: PASS.

- [ ] **Step 6: 변경을 커밋한다**

```bash
git add src/components/preview/MarkdownPreview.tsx src/components/preview/MarkdownPreview.test.tsx
git commit -m "fix(preview): sync scroll by anchor block"
```

### Task 4: requestAnimationFrame 예약과 layoutVersion 기대값 정리

**Files:**
- Modify: `src/components/preview/MarkdownPreview.tsx`
- Modify: `src/components/preview/MarkdownPreview.test.tsx`

- [ ] **Step 1: `requestAnimationFrame` 기반 동기화 테스트를 준비한다**

`src/components/preview/MarkdownPreview.test.tsx`의 `afterEach`에 fake timer cleanup이 없다면 각 테스트 안에서 `vi.useFakeTimers()`와 `vi.useRealTimers()`를 사용한다. 새 테스트는 다음 형태로 추가한다.

```tsx
it("coalesces rapid active line changes into the latest scheduled scroll", () => {
  vi.useFakeTimers();
  cleanupHandlers.push(() => vi.useRealTimers());

  const requestAnimationFrameSpy = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback) => window.setTimeout(() => callback(performance.now()), 16));
  const cancelAnimationFrameSpy = vi
    .spyOn(window, "cancelAnimationFrame")
    .mockImplementation((handle) => window.clearTimeout(handle));
  cleanupHandlers.push(() => {
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  const renderer = createTestRenderer();
  cleanupHandlers.push(() => renderer.cleanup());

  const scrollTo = vi.fn(function setScrollTop(this: HTMLElement, options: ScrollToOptions) {
    this.scrollTop = options.top ?? 0;
  });
  const originalScrollTo = HTMLElement.prototype.scrollTo;
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollTo,
    writable: true,
  });
  cleanupHandlers.push(() => {
    if (originalScrollTo) {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
        writable: true,
      });
      return;
    }

    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
  });

  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function getClientHeight(this: HTMLElement) {
    return this.classList.contains("markdown-preview") ? 400 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function getScrollHeight(this: HTMLElement) {
    return this.classList.contains("markdown-preview") ? 1400 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect(this: HTMLElement) {
    if (this.classList.contains("markdown-preview")) {
      return new DOMRect(0, 0, 320, 400);
    }

    const lineStart = Number(this.dataset.sourceLineStart ?? NaN);
    if (lineStart === 5) {
      return new DOMRect(0, 520, 320, 48);
    }
    if (lineStart === 7) {
      return new DOMRect(0, 760, 320, 48);
    }

    return new DOMRect(0, 0, 0, 0);
  });

  renderer.render({
    activeLine: 5,
    markdown: "# Heading\n\nFirst paragraph\n\n## Section\n\nSecond paragraph",
  });
  renderer.render({
    activeLine: 7,
    markdown: "# Heading\n\nFirst paragraph\n\n## Section\n\nSecond paragraph",
  });

  expect(cancelAnimationFrameSpy).toHaveBeenCalled();

  act(() => {
    vi.advanceTimersByTime(16);
  });

  expect(scrollTo).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: 기존 layoutVersion 테스트를 새 정책에 맞게 바꾼다**

기존 `"re-syncs preview scrolling when the layout version changes"` 테스트는 삭제하거나 다음 기대값으로 바꾼다.

```tsx
it("does not scroll solely because the layout version changes", () => {
  const renderer = createTestRenderer();
  cleanupHandlers.push(() => renderer.cleanup());

  const scrollTo = vi.fn();
  const originalScrollTo = HTMLElement.prototype.scrollTo;
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollTo,
    writable: true,
  });
  cleanupHandlers.push(() => {
    if (originalScrollTo) {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
        writable: true,
      });
      return;
    }

    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
  });

  renderer.render({
    activeLine: 5,
    layoutVersion: 0,
    markdown: "# Heading\n\nFirst paragraph\n\n## Section\n\nSecond paragraph",
  });
  const initialCallCount = scrollTo.mock.calls.length;

  renderer.render({
    activeLine: 5,
    layoutVersion: 1,
    markdown: "# Heading\n\nFirst paragraph\n\n## Section\n\nSecond paragraph",
  });

  expect(scrollTo).toHaveBeenCalledTimes(initialCallCount);
});
```

- [ ] **Step 3: 테스트 실패를 확인한다**

Run: `npm run test -- src/components/preview/MarkdownPreview.test.tsx`

Expected: FAIL because sync is still immediate or layoutVersion still resets and scrolls.

- [ ] **Step 4: pending animation frame ref와 예약 함수를 추가한다**

`src/components/preview/MarkdownPreview.tsx`에 ref와 cleanup을 추가한다.

```tsx
const pendingScrollFrameRef = useRef<number | null>(null);

const cancelPendingPreviewScroll = useEffectEvent(() => {
  if (pendingScrollFrameRef.current === null) {
    return;
  }

  window.cancelAnimationFrame(pendingScrollFrameRef.current);
  pendingScrollFrameRef.current = null;
});
```

예약 함수를 추가한다.

```tsx
const schedulePreviewScroll = useEffectEvent(() => {
  cancelPendingPreviewScroll();
  pendingScrollFrameRef.current = window.requestAnimationFrame(() => {
    pendingScrollFrameRef.current = null;
    syncPreviewScroll();
  });
});
```

activeLine effect는 즉시 호출 대신 예약한다.

```tsx
useEffect(() => {
  schedulePreviewScroll();
}, [activeLine, isAutoScrollEnabled, isLayoutTransitioning, schedulePreviewScroll]);
```

layoutVersion effect와 ResizeObserver에서 `lastSyncedAnchorKeyRef`를 초기화하고 `syncPreviewScroll()`을 호출하던 코드는 제거한다. unmount cleanup은 pending frame만 취소한다.

```tsx
useEffect(() => {
  return () => {
    cancelPendingPreviewScroll();
  };
}, [cancelPendingPreviewScroll]);
```

- [ ] **Step 5: 테스트 통과를 확인한다**

Run: `npm run test -- src/components/preview/MarkdownPreview.test.tsx`

Expected: PASS.

- [ ] **Step 6: 변경을 커밋한다**

```bash
git add src/components/preview/MarkdownPreview.tsx src/components/preview/MarkdownPreview.test.tsx
git commit -m "fix(preview): schedule preview scroll once per frame"
```

### Task 5: 수동 미리보기 스크롤을 존중한다

**Files:**
- Modify: `src/components/preview/MarkdownPreview.tsx`
- Modify: `src/components/preview/MarkdownPreview.test.tsx`

- [ ] **Step 1: 수동 스크롤 suspend 테스트를 추가한다**

`src/components/preview/MarkdownPreview.test.tsx`에 다음 테스트를 추가한다.

```tsx
it("temporarily suspends auto-scroll after the user scrolls the preview", () => {
  vi.useFakeTimers();
  cleanupHandlers.push(() => vi.useRealTimers());

  const requestAnimationFrameSpy = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback) => window.setTimeout(() => callback(performance.now()), 16));
  const cancelAnimationFrameSpy = vi
    .spyOn(window, "cancelAnimationFrame")
    .mockImplementation((handle) => window.clearTimeout(handle));
  cleanupHandlers.push(() => {
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  const renderer = createTestRenderer();
  cleanupHandlers.push(() => renderer.cleanup());

  const scrollTo = vi.fn(function setScrollTop(this: HTMLElement, options: ScrollToOptions) {
    this.scrollTop = options.top ?? 0;
    this.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  const originalScrollTo = HTMLElement.prototype.scrollTo;
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollTo,
    writable: true,
  });
  cleanupHandlers.push(() => {
    if (originalScrollTo) {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
        writable: true,
      });
      return;
    }

    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
  });

  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function getClientHeight(this: HTMLElement) {
    return this.classList.contains("markdown-preview") ? 400 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function getScrollHeight(this: HTMLElement) {
    return this.classList.contains("markdown-preview") ? 1400 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect(this: HTMLElement) {
    if (this.classList.contains("markdown-preview")) {
      return new DOMRect(0, 0, 320, 400);
    }

    const lineStart = Number(this.dataset.sourceLineStart ?? NaN);
    if (lineStart === 5) {
      return new DOMRect(0, 520, 320, 48);
    }
    if (lineStart === 7) {
      return new DOMRect(0, 760, 320, 48);
    }

    return new DOMRect(0, 0, 0, 0);
  });

  renderer.render({
    activeLine: 5,
    markdown: "# Heading\n\nFirst paragraph\n\n## Section\n\nSecond paragraph",
  });

  act(() => {
    vi.advanceTimersByTime(16);
  });

  const previewElement = renderer.container.querySelector(".markdown-preview") as HTMLDivElement;
  act(() => {
    previewElement.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    previewElement.dispatchEvent(new Event("scroll", { bubbles: true }));
  });

  const callCountAfterManualScroll = scrollTo.mock.calls.length;

  renderer.render({
    activeLine: 7,
    markdown: "# Heading\n\nFirst paragraph\n\n## Section\n\nSecond paragraph",
  });

  act(() => {
    vi.advanceTimersByTime(16);
  });

  expect(scrollTo).toHaveBeenCalledTimes(callCountAfterManualScroll);
});
```

- [ ] **Step 2: 테스트 실패를 확인한다**

Run: `npm run test -- src/components/preview/MarkdownPreview.test.tsx`

Expected: FAIL because auto-scroll still runs after manual preview scroll.

- [ ] **Step 3: 수동 스크롤 suspend 상태를 추가한다**

`src/components/preview/MarkdownPreview.tsx`에 상수와 refs를 추가한다.

```tsx
const MANUAL_SCROLL_SUSPEND_MS = 900;
```

```tsx
const isProgrammaticScrollRef = useRef(false);
const manualScrollSuspendUntilRef = useRef(0);
```

`scrollPreviewTo` 호출 전후로 programmatic scroll 표시를 설정한다.

```tsx
isProgrammaticScrollRef.current = true;
scrollPreviewTo(container, nextScrollTop, "auto");
window.setTimeout(() => {
  isProgrammaticScrollRef.current = false;
}, 0);
lastSyncedAnchorKeyRef.current = targetAnchorKey;
```

수동 스크롤 여부를 확인하는 helper를 추가한다.

```tsx
const isManualScrollSuspended = useEffectEvent(() => {
  return Date.now() < manualScrollSuspendUntilRef.current;
});
```

`syncPreviewScroll` 초반에 suspend를 반영한다.

```tsx
if (isManualScrollSuspended()) {
  return;
}
```

preview root에 wheel과 scroll handler를 추가한다.

```tsx
onWheel={() => {
  manualScrollSuspendUntilRef.current = Date.now() + MANUAL_SCROLL_SUSPEND_MS;
}}
onScroll={() => {
  if (isProgrammaticScrollRef.current) {
    return;
  }

  manualScrollSuspendUntilRef.current = Date.now() + MANUAL_SCROLL_SUSPEND_MS;
}}
```

- [ ] **Step 4: suspend 만료 후 다시 따라가는 테스트를 추가한다**

같은 파일에 다음 테스트를 추가한다.

```tsx
it("resumes auto-scroll after the manual scroll suspension expires", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-22T00:00:00.000Z"));
  cleanupHandlers.push(() => {
    vi.useRealTimers();
  });

  const requestAnimationFrameSpy = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback) => window.setTimeout(() => callback(performance.now()), 16));
  const cancelAnimationFrameSpy = vi
    .spyOn(window, "cancelAnimationFrame")
    .mockImplementation((handle) => window.clearTimeout(handle));
  cleanupHandlers.push(() => {
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  const renderer = createTestRenderer();
  cleanupHandlers.push(() => renderer.cleanup());

  const scrollTo = vi.fn(function setScrollTop(this: HTMLElement, options: ScrollToOptions) {
    this.scrollTop = options.top ?? 0;
  });
  const originalScrollTo = HTMLElement.prototype.scrollTo;
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollTo,
    writable: true,
  });
  cleanupHandlers.push(() => {
    if (originalScrollTo) {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
        writable: true,
      });
      return;
    }

    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
  });

  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function getClientHeight(this: HTMLElement) {
    return this.classList.contains("markdown-preview") ? 400 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function getScrollHeight(this: HTMLElement) {
    return this.classList.contains("markdown-preview") ? 1400 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect(this: HTMLElement) {
    if (this.classList.contains("markdown-preview")) {
      return new DOMRect(0, 0, 320, 400);
    }

    const lineStart = Number(this.dataset.sourceLineStart ?? NaN);
    if (lineStart === 5) {
      return new DOMRect(0, 520, 320, 48);
    }
    if (lineStart === 7) {
      return new DOMRect(0, 760, 320, 48);
    }

    return new DOMRect(0, 0, 0, 0);
  });

  renderer.render({
    activeLine: 5,
    markdown: "# Heading\n\nFirst paragraph\n\n## Section\n\nSecond paragraph",
  });

  act(() => {
    vi.advanceTimersByTime(16);
  });

  const previewElement = renderer.container.querySelector(".markdown-preview") as HTMLDivElement;
  act(() => {
    previewElement.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    vi.advanceTimersByTime(901);
  });

  const callCountBeforeResume = scrollTo.mock.calls.length;
  renderer.render({
    activeLine: 7,
    markdown: "# Heading\n\nFirst paragraph\n\n## Section\n\nSecond paragraph",
  });

  act(() => {
    vi.advanceTimersByTime(16);
  });

  expect(scrollTo.mock.calls.length).toBeGreaterThan(callCountBeforeResume);
});
```

- [ ] **Step 5: 테스트 통과를 확인한다**

Run: `npm run test -- src/components/preview/MarkdownPreview.test.tsx`

Expected: PASS.

- [ ] **Step 6: 변경을 커밋한다**

```bash
git add src/components/preview/MarkdownPreview.tsx src/components/preview/MarkdownPreview.test.tsx
git commit -m "fix(preview): respect manual preview scrolling"
```

### Task 6: 전체 검증과 회귀 확인

**Files:**
- Modify: none

- [ ] **Step 1: preview 관련 테스트를 실행한다**

Run: `npm run test -- src/lib/preview-scroll.test.ts src/components/preview/MarkdownPreview.test.tsx`

Expected: PASS.

- [ ] **Step 2: 전체 테스트를 실행한다**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 3: 빌드를 실행한다**

Run: `npm run build`

Expected: PASS with Vite production bundle generated.

- [ ] **Step 4: 수동 확인을 위한 dev server를 실행한다**

Run: `npm run dev`

Expected: Vite dev server starts on `127.0.0.1:1420`.

- [ ] **Step 5: 수동 QA 시나리오를 확인한다**

브라우저나 Tauri dev 환경에서 다음을 확인한다.

```text
1. 긴 Markdown 문서를 연다.
2. 같은 문단 안에서 여러 줄을 계속 타이핑한다.
3. 미리보기 패널이 반복적으로 위아래로 흔들리지 않는지 본다.
4. 에디터 커서를 다른 heading 또는 다른 문단으로 이동한다.
5. 해당 preview anchor가 화면 밖이면 한 번만 따라오는지 본다.
6. preview 패널을 직접 스크롤한 직후 에디터에서 입력한다.
7. preview 패널이 즉시 다시 끌려오지 않는지 본다.
```

- [ ] **Step 6: 남은 수정이 있는 경우만 최종 정리 커밋을 만든다**

```bash
git status --short
```

Expected: 이전 task별 커밋을 모두 만들었다면 working tree가 비어 있다. 수동 QA 중 보완한 수정이 남아 있을 때만 다음 명령을 실행한다.

```bash
git add src/lib/preview-scroll.ts src/lib/preview-scroll.test.ts src/components/preview/MarkdownPreview.tsx src/components/preview/MarkdownPreview.test.tsx
git commit -m "fix(preview): stabilize active line auto-scroll"
```
