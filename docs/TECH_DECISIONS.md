# TECH_DECISIONS

Product: `ClipMark`

## Chosen Stack

| Layer | Choice | Reason |
| --- | --- | --- |
| App shell | Tauri | Lightweight desktop shell that supports fast MVP iteration |
| UI | React | Mature ecosystem and smooth integration with editor/rendering libraries |
| Editor | CodeMirror 6 | Modular and well-suited to Markdown-focused editing |
| Markdown rendering | markdown-it + existing preview sanitizer | 현재 구현을 재사용하고 원문 행과 렌더링 블록 연결을 유지 |
| Paste conversion | Turndown with custom rules | Fastest path to a useful HTML-to-Markdown pipeline |

## Why This Stack

- It favors fast validation without locking the product into Electron-scale overhead
- It supports clipping-to-editing continuity with the existing paste pipeline
- It keeps the document model centered on plain Markdown text

## Architectural Constraints

- Keep the document model as `markdown string + metadata`
- Isolate editor-specific behavior behind an adapter
- Keep rendering behind a dedicated Markdown rendering module
- Keep paste conversion as a staged pipeline:
  - clipboard normalization
  - HTML cleanup
  - HTML to Markdown conversion
  - Markdown post-processing
- Limit Tauri commands to file system and desktop integration concerns

## Expected Future Pressure

- Paste conversion quality may require replacing or augmenting Turndown later
- A stronger macOS-native feel may eventually justify revisiting a native shell
- Export requirements may add a dedicated print or rendering pipeline

## Migration Strategy

### Editor

If the editor ever changes, preserve the app-facing interface:

- `getText()`
- `setText(value)`
- `replaceSelection(value)`
- `focus()`
- `onChange(listener)`
- `scrollToHeading(id)`

### Renderer

Keep preview generation behind a single function boundary:

- `renderMarkdown(markdown): html`

현재 실제 경계는 `src/lib/preview-renderer.ts`의 `renderPreviewHtml(input)`이다. 위의 `renderMarkdown`은 개념적인 인터페이스 예시이며 새 API를 추가할 이유가 아니다. 현재 markdown-it 구현을 재사용한다.

## 재단장 결정 — 2026-10-02

- macOS 26 이상만 지원한다. 현재 설정의 최소 OS 13.0은 구현 단계에서 26.0으로 변경한다. 이전 OS 대체 재질은 이번 범위에서 제외한다.
- Tauri·React·CodeMirror를 유지한다. 전체 네이티브 전환이나 렌더러 교체는 선행 조건이 아니다.
- 하단 조작부는 실제 AppKit Liquid Glass로 만든다. CSS 유사 재질과 전체 웹뷰 투명화로 대체하지 않는다. 기존 objc2/AppKit 통합을 우선 재사용한다.
- 격리 실행 검증은 가능성의 근거다. 검증 플러그인의 기본 main 창 대상 동작을 제품에 그대로 적용하지 않는다. 문서 창별 대상과 이벤트를 명시한다.
- 편집창이 DocumentStore·savedRevision·문서 경로의 단일 소유자다. 미리보기는 읽기 전용 렌더링 상태만 받는다.
- 미리보기는 별도 보조 WebviewWindow이며 문서 registry의 독립 편집 세션으로 등록하지 않는다. 닫으면 파괴하고 열 때 최신 전체 상태를 전달한다.
- 창 사이 초기 연결에는 준비 완료 후 전체 상태 전달이 필요하다. 이후 변경은 문서·창 식별자와 증가 순서로 구분해 오래된 상태와 다른 문서의 이벤트를 버린다.
- 기존 lazy markdown serialization을 유지한다. 미리보기가 닫혀 있으면 이를 위한 문자열 직렬화·전송·렌더링을 하지 않는다.
- 파일명 변경은 Save As와 구분한다. 본문과 savedRevision, editorDocumentKey를 변경하지 않고 파일 시스템 이름과 metadata·registry를 갱신한다.
- 미리보기 추적 재개는 편집 동작을 기준으로 한다. 수동 스크롤 중단에 시간 만료를 사용하지 않는다.
- 기존 색상 토큰 계층은 [COLOR_TOKEN_SPEC.md](./COLOR_TOKEN_SPEC.md)를 따른다.

상세 목표는 [CLIPMARK_REDESIGN.md](./CLIPMARK_REDESIGN.md), 실행 근거는 [LIQUID_GLASS_SPIKE.md](./LIQUID_GLASS_SPIKE.md)를 참조한다. 본 절은 구현 목표이며 기존 코드가 이미 변경됐다는 뜻이 아니다.

### Paste Pipeline

Keep the converter split by stages so that Turndown can be replaced incrementally instead of all at once.

## Editor Synchronization

### Problem

The initial editor integration pushed `view.state.doc.toString()` into the shared document store on every CodeMirror document change.

That kept the rest of the app simple, but it also meant:

- every keystroke serialized the full CodeMirror document into a string
- preview, TOC, footer metrics, save, and dirty tracking all competed with active typing
- larger Markdown documents paid an O(n) copy cost even when no consumer immediately needed the latest string

### Decision

Keep the app-facing document contract as `markdown string + metadata`, but change the internal store implementation to use:

- a monotonically increasing document revision
- a lazily-read markdown source owned by the editor
- deferred string serialization only when a consumer actually reads markdown

In practice, the editor now connects a source reader to the document store and only notifies the store that the document changed. The store increments its revision immediately, but postpones `doc.toString()` until `getMarkdown()` is called by preview, save, or another consumer.

### Why This Instead Of Full Editor-State Ownership

We considered moving the entire application model to "editor state handle + delayed serialization". That would reduce string-centric assumptions further, but it would also expand the change surface across save flows, tests, document session orchestration, and future non-editor document access.

The chosen design keeps the existing external API shape while removing the hottest serialization path from active typing.

### Consequences

Benefits:

- dirty tracking can react to document changes through revision comparison without forcing full string reads
- the editor no longer serializes the full document on every keystroke
- preview, save, and derived document metrics still read plain markdown when they need it

Trade-offs:

- the store now has hidden internal state beyond the last realized markdown string
- disconnecting or replacing the editor source must flush any pending markdown before the source is dropped
- code that assumes "store update implies markdown string already materialized" is no longer valid

### Guardrails

- `replaceMarkdown` is still used for opened documents, new documents, and explicit external resets
- `getMarkdown()` remains the single boundary that materializes the latest markdown string
- `useDocumentDirty()` compares revisions, not serialized markdown
- editor-driven updates must go through the connected source reader instead of calling `setMarkdown(doc.toString())` on every change
