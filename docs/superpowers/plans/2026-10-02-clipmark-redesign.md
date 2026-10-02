# ClipMark 재단장 구현 계획

실행 상태: 첫 구현 완료. 단계별 결과·리뷰 수정·남은 검증은 [구현 기록](./2026-10-02-clipmark-redesign-ledger.md)에 기록한다. 아래 체크리스트는 원래 계획으로 보존한다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 이 계획은 현재 세션에서 직접 순차 구현하는 것을 권장한다. 사용자 요청 없이 하위 에이전트를 생성하지 않는다.

**Goal:** macOS 26 이상에서 실제 Apple Liquid Glass 조작부, 조용한 원문 편집, 파일명 수정과 별도 미리보기의 연속성을 제공한다.

**Architecture:** 기존 Tauri 문서 창 registry와 DocumentStore를 유지한다. Rust는 문서별 네이티브 조작부·파일 이름 변경·보조 창 생명주기를 담당하고, 편집창은 단일 문서 세션으로 읽기 전용 미리보기 상태를 전달한다. 현재 CodeMirror, markdown-it, 색상 토큰과 원문 행 매핑을 재사용한다.

**Tech Stack:** Tauri 2, React, TypeScript, CodeMirror 6, markdown-it, 기존 objc2/AppKit, Vitest, Rust 단위 테스트.

**Spec:** [CLIPMARK_REDESIGN.md](../../CLIPMARK_REDESIGN.md), [MULTI_WINDOW_SPEC.md](../../MULTI_WINDOW_SPEC.md), [LIQUID_GLASS_SPIKE.md](../../LIQUID_GLASS_SPIKE.md).

## Global Constraints

- macOS 26 이상만 지원한다. 이전 macOS용 대체 조작부는 구현하지 않는다.
- 실제 Apple Liquid Glass를 본문 위의 독립된 네이티브 조작 계층에 사용한다. 본문은 안정적인 배경을 유지한다.
- 파일 하나에 편집창 하나를 유지한다. 미리보기는 같은 문서에 연결된 보조 창이다.
- 편집·미리보기 본문 최대 폭을 제한하지 않는다. 줄 번호와 내부 접이식 목차를 유지한다.
- 미리보기는 열 때마다 기본 크기의 새 창으로 생성한다. 이전 위치·크기·스크롤을 복원하지 않는다.
- ⌥⌘P, ⌥⌘C, ⌥⌘T와 기존 파일 단축키를 유지한다. 상단 파일명 수정은 본문 제목을 바꾸지 않는다.
- CSS 유리 모사, 전체 네이티브 전환, 젠 모드, HTML 허용 목록 확대는 제외한다. 새 의존성은 기존 AppKit 통합으로 해결할 수 없을 때만 검토한다.
- 시각 변경에 구현을 복제하는 테스트를 추가하지 않는다. 실제 파일·창·동기화 로직은 최소 회귀 테스트와 macOS 수동 검증을 남긴다.
- 커밋은 Conventional Commits 제목과 한국어 본문으로 배경·목표·변경·영향·검증을 기록한다. 각 작업의 검증 후 관련 파일만 묶는다.

## Review Focus

1. 이름 변경 실패·중복·대소문자만 변경: 기존 파일과 저장 전 본문 보존. Task 3의 파일 시스템 검증이 담당한다.
2. 두 문서 창의 native 이벤트와 미리보기: 다른 문서 내용·저장 상태에 영향을 주지 않음. Task 1, 4, 5가 담당한다.
3. 토글 연타·생성 실패·부모 닫기 취소: 중복·고아 보조 창 없음. Task 4가 담당한다.
4. 준비 완료 전에 변경·오래된 비동기 결과: 최신 전체 상태로 시작하며 stale 상태를 표시하지 않음. Task 5가 담당한다.
5. 화면 경계·Retina 배율·좁은 창·전체 화면: 좌표 단위를 혼용하지 않고 조작부와 본문 커서를 보존. Task 1, 2, 4, 6이 담당한다.

## 배치 예외 검토

일반 배치는 부모 오른쪽 → 왼쪽 → 아래 → 위로, 화면 작업 영역 안의 비겹침 위치를 선택한다. 다른 앱 창은 조사하지 않는다. 부모가 화면 전체를 차지할 때는 비겹침과 화면 내 배치를 동시에 만족할 수 없다.

**구현 제안, 제품 확정 필요:** 다른 연결 화면에 비겹침 배치가 가능하면 그 화면을 사용하고, 모두 불가능하면 화면 안에서 부모와 겹치는 면적이 가장 작은 위치에 연다. 창 열기를 막거나 부모를 자동 축소하지 않는다. 이 예외가 승인되기 전에는 Task 4의 예외 분기를 제품 정책으로 확정하지 않는다. macOS 전체 화면 Space에 보조 창을 표시하는 방식도 Task 4의 실제 앱 검증에서 확인한다.

## 파일 배치와 의존 순서

기존 파일을 우선 수정한다. 새 파일은 아래 세 책임에만 추가한다.

- `src-tauri/src/liquid_glass.rs`, `src/lib/native-controls.ts`: 문서 창별 네이티브 조작부와 좁은 프론트엔드 bridge.
- `src/lib/preview-window.ts`, `src/hooks/usePreviewWindow.ts`, `src/components/preview/PreviewWindow.tsx`: 보조 창 bridge, 부모 연결, 읽기 전용 화면.
- `src/lib/preview-window-state.ts`, `src/lib/preview-window-state.test.ts`: 상태 순서와 추적 전환의 순수 로직.
- 기존 `main.rs`, `App.tsx`, `main.tsx`, document session/hooks, workspace, renderer/scroll/preferences/menu 모듈을 필요한 범위만 수정한다. 별도 전역 상태 프레임워크나 메시지 버스는 만들지 않는다.

순서: Task 1 → 2 → 3 → 4 → 5 → 6. Task 3은 Task 4와 독립적이나 순차 실행해 변경 범위를 작게 유지한다.

### Task 1: macOS 26와 창별 실제 Liquid Glass 조작부

**Files:** 수정 `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/Cargo.toml`; 생성 `src-tauri/src/liquid_glass.rs`, `src/lib/native-controls.ts`, `src/lib/native-controls.test.ts`.

**Interfaces:** `syncNativeControls({ path: string | null, previewOpen: boolean }): Promise<void>`, `listenNativeControlAction(handler: (action: "copy-path" | "toggle-preview") => void): Promise<() => void>`. Rust command는 호출 WebviewWindow를 대상으로 하고 이벤트는 해당 창에만 전달한다. command payload에 대상 label을 받지 않는다.

- [ ] 기존 objc2/AppKit 의존성과 격리 실행 검증을 확인하고 public NSGlassEffectView로 두 조작부를 붙인다. 검증 플러그인을 그대로 도입하지 않는다.
- [ ] bridge 테스트에 invoke payload, 실패 전달, listener 해제 검증을 먼저 추가한다. `npm run test -- src/lib/native-controls.test.ts`에서 구현 전 실패를 확인한다.
- [ ] 최소 OS를 `26.0`으로 변경하고 Rust 모듈을 연결한다. 본문 WKWebView는 불투명하게 유지한다. main 전용 lookup 대신 호출 창의 native handle을 사용한다.
- [ ] 좌하단 경로 복사와 우하단 미리보기 버튼을 만들고 resize 시 배치한다. 시스템 재질·키보드 접근·접근성 이름과 포커스 복귀를 적용한다. 파괴 시 native callback과 observer를 해제한다.
- [ ] `npm run build`, bridge 테스트, `cargo test --manifest-path src-tauri/Cargo.toml`을 실행한다. `npm run tauri:dev`로 두 문서 창에서 각 버튼의 대상과 실제 재질을 확인한다. 창 resize·닫기 뒤 stale callback이 없음을 확인한다.
- [ ] `feat(macos): 문서 창별 Liquid Glass 조작부를 추가한다`로 관련 변경을 커밋한다.

### Task 2: 조용한 원문 화면과 내부 목차

**Files:** 수정 `src/styles.css`, `src/components/editor/MarkdownEditor.tsx`, `src/components/workspace/EditorWorkspace.tsx`, `WorkspaceLayout.tsx`, `DocumentWorkspaceFooter.tsx`, `src/components/toc/TocPanel.tsx`, `src/App.tsx`, `src-tauri/src/main.rs`, `src-tauri/tauri.conf.json`. 같은 workspace 폴더의 panel 로직과 테스트는 제거되는 분할 기능에 한해 정리한다.

**Interfaces:** Task 1 bridge를 기존 경로 복사·미리보기 액션에 연결한다. `MarkdownEditorHandle`과 document key의 기존 역할을 유지한다. 목차 선택은 기존 원문 이동 API를 사용한다.

- [ ] 색상은 `docs/COLOR_TOKEN_SPEC.md`의 primitive/semantic/state 계층을 따른다. 기존 theme 모드와 외부 미디어 설정은 유지한다.
- [ ] 본문·줄 번호·문법 색상과 행간을 조정한다. 문법 상태에 따라 font size·line height를 변경하지 않는다. 본문 최대 폭 제한을 제거한다.
- [ ] 상단 파일명·저장 상태를 간결하게 배치하고 목차를 내부 접이식 패널로 유지한다. 기존 미리보기 패널은 Task 4 전환까지 남겨 기능 공백을 피한다.
- [ ] 경로는 native label에서 말줄임하되 우하단 100pt 버튼과 16pt 간격을 먼저 확보한다. 파일명도 길면 축약한다. tooltip 없이 원본 path를 복사한다. 본문 하단에 조작부 높이 44pt와 여백을 확보한다. 수치는 최초 구현값이며 실제 화면에서 조정 가능하다.
- [ ] 편집창 최소 크기는 480×360 logical units부터 검증한다. 기본 크기는 960×720을 시작값으로 사용한다. Rust builder와 config 값을 동일하게 변경한다. 좁은 창에서는 목차를 사용자가 접을 수 있게 하고 조작부는 겹치지 않게 한다.
- [ ] `npm run build`와 기존 관련 테스트를 실행한다. macOS에서 문법 기호 삭제, 긴 줄·긴 경로·마지막 줄·목차 펼침·다크 모드·키보드 이동을 수동 검증한다. 화면 캡처를 리뷰 자료로 남긴다.
- [ ] `feat(editor): 조용한 원문 화면과 하단 조작부를 적용한다`로 커밋한다.

### Task 3: 실제 파일명 변경과 저장 전 내용 보존

**Files:** 수정 `src/lib/file-system.ts`, `file-system.test.ts`, `src/lib/document-workspace-state.ts`, `document-workspace-state.test.ts`, `src/hooks/useDocumentWorkspaceState.ts`, `useDocumentSession.ts`, `useDocumentFileActions.ts`, `useDocumentFileActions.test.tsx`, `useDocumentSessionFileEffects.ts`, `src/lib/recent-files.ts`, `recent-files.test.ts`, `src/components/workspace/EditorWorkspace.tsx`, `src-tauri/src/main.rs`.

**Interfaces:** `renameMarkdownDocument({path: string, filename: string}): Promise<SavedDocument>`; `getRenamedDocumentWorkspaceState(previousState: DocumentWorkspaceState, renamed: SavedDocument): DocumentWorkspaceState`; session `renameDocument(filename: string): Promise<boolean>`. 새 문서는 파일 시스템 호출 없이 filename만 갱신한다.

- [ ] 실패 테스트를 추가한다: 성공해도 savedRevision/editorDocumentKey 유지; 잘못된 이름·충돌·실패에는 기존 metadata 유지; 새 문서 이름 변경은 파일 쓰기 없이 첫 저장 제안 이름만 변경. UI 문구는 기존 프로젝트의 영어 관례를 따른다.
- [ ] `npm run test -- src/lib/file-system.test.ts src/lib/document-workspace-state.test.ts src/hooks/useDocumentFileActions.test.tsx src/lib/recent-files.test.ts`를 실행해 추가한 단언이 먼저 실패하는지 확인한다.
- [ ] Rust rename command는 호출 창 registry에서 기존 경로를 얻는다. 같은 폴더의 filename과 확장자를 검증하고 빈 이름·경로 구분자·NUL·다른 창의 대상·이미 존재하는 대상을 거부한다. 같은 이름은 변경 없이 성공하며 대소문자만 변경하는 사례는 별도로 검증한다. macOS의 대상 덮어쓰기 없는 원자적 이름 변경을 사용한다. exists 검사 뒤 덮어쓰는 일반 rename은 사용하지 않는다.
- [ ] 파일 작업 성공 후 같은 registry 임계 구역에서 경로를 갱신하고 실패하면 유지한다. 프론트엔드는 metadata만 바꾸며 applySavedDocument/replaceMarkdown을 호출하거나 savedRevision/editorDocumentKey를 초기화하지 않는다. 응답이 유실되면 호출 창 registry 상태를 다시 읽어 다음 저장이 기존 경로에 파일을 만들지 않게 한다.
- [ ] 상단 이름을 같은 자리의 input으로 바꾼다. Enter 적용·Esc 취소, IME 조합 중 Enter 적용 금지, 적용 중 중복 요청 금지. 새 문서는 제안 이름만 변경한다. 성공 시 native title·recent files·열린 preview를 동기화하고 실패 시 입력을 유지해 수정할 수 있게 한다.
- [ ] 실행 테스트와 Rust rename 테스트를 통과시킨다. 임시 폴더에서 원본 디스크 내용, dirty 본문, undo/redo, 이미 존재하는 대상, 권한 실패, 대소문자 변경, 변경된 파일 다시 열기를 검증한다.
- [ ] `feat(document): 편집창에서 파일명을 안전하게 변경한다`로 커밋한다.

### Task 4: 별도 미리보기 창과 메뉴·닫기 생명주기

**Files:** 생성 `src/lib/preview-window.ts`, `src/hooks/usePreviewWindow.ts`, `src/components/preview/PreviewWindow.tsx`; 수정 `src/main.tsx`, `src/App.tsx`, `src-tauri/src/main.rs`, `src-tauri/capabilities/`, `src/lib/document-window.ts`, `src/lib/menu.ts`, `src/hooks/useAppShellActions.ts`, `useAppMenuBindings.ts`, `useNativeWindowState.ts`, `src/lib/preview-preferences.ts`, `src/components/workspace/EditorWorkspace.tsx`, `WorkspaceLayout.tsx`. 테스트는 기존 menu/document-window/preferences 테스트와 Rust tests에 추가한다.

**Interfaces:** `togglePreviewWindow(): Promise<boolean>` returns actual open state; Rust는 호출 편집창 또는 연결된 자식으로 소유자를 찾는다. 보조 창 URL은 `index.html?preview=1`, label은 `preview-{ownerLabel}`이다. main.tsx는 preview role이면 PreviewWindow만 mount한다. parent 연결은 URL 임의 값 대신 Rust 조회를 사용한다.

- [ ] Rust 테스트를 먼저 추가한다: 두 부모 독립 연결, 토글 연타, 생성 실패 rollback, 자식 close, 부모 close 완료, Cancel에는 close가 호출되지 않음. 기존 메뉴 테스트에 preview focus에서도 부모 Save/Copy/Toggle 라우팅을 고정한다.
- [ ] 생성 예약과 실제 창 생성·파괴 상태를 연결해 부모당 하나를 보장한다. 생성 중 재토글은 최신 의도대로 닫는다. 자식은 문서 registry·dirty 확인·recent files에 등록하지 않는다.
- [ ] 미리보기 기본 640×720, 최소 320×240, 창 간격 12 logical units를 시작값으로 한다. 같은 좌표 단위의 부모 외곽 rect와 작업 영역으로 비겹침 배치한다. 오른쪽→왼쪽→아래→위, 불가능할 때는 위 예외 정책 확정 후 구현한다. 순수 geometry 계산은 Rust 단위 테스트에 음수 원점·2배 배율·화면 경계 사례를 추가한다.
- [ ] 처음 열 때 source focus·cursor를 유지한다. preview를 직접 닫거나 preview에서 ⌥⌘P를 실행하면 source focus를 복구한다. 부모 실제 종료는 자식을 먼저 정리하되 닫기 확인 취소에는 영향이 없어야 한다.
- [ ] 메뉴는 preview가 포커스돼도 부모 문서 상태로 계산한다. New/Open은 기존 새 문서 창 정책, Save/Save As는 부모 세션으로 라우팅한다. 편집 메뉴는 preview에서 편집 가능 여부에 맞춘다.
- [ ] preview open 상태·panel width의 이전 preference는 무시하고 제거한다. 목차 폭·theme·외부 미디어 설정은 유지한다. 분할 preview 전용 레이아웃·resize 코드는 호출처가 사라진 것만 삭제한다.
- [ ] 관련 Vitest와 Rust 테스트, `npm run build`를 실행한다. macOS에서 두 문서와 각 preview, 연타, focus, native close sheet Cancel/Save failure, 부모 종료, 전체 화면 Space를 수동 검증한다.
- [ ] `feat(preview): 문서별 미리보기를 별도 창으로 연다`로 커밋한다.

### Task 5: 최신 내용 전달과 사용자 동작 기반 추적

**Files:** 생성 `src/lib/preview-window-state.ts`, `preview-window-state.test.ts`; 수정 Task 4 bridge/hook/PreviewWindow, `src/lib/document-store.ts` (기존 API 유지), `src/lib/editor-view-state-store.ts`, `src/components/editor/MarkdownEditor.tsx`, `src/components/preview/MarkdownPreview.tsx`, `MarkdownPreview.test.tsx`, `src/lib/preview-scroll.ts`, `preview-scroll.test.ts`, `src-tauri/src/main.rs`.

**Interfaces:** `PreviewSnapshot = {ownerLabel: string; connectionId: string; sequence: number; documentRevision: number; editSequence: number; markdown: string; filePath: string | null; filename: string; activeLine: number | null; themeMode: string; autoLoadExternalMedia: boolean}`. connectionId는 창 생성마다 새 값, sequence는 부모가 보내는 모든 상태의 증가값, editSequence는 입력·selection 변경마다 증가한다. 수신은 현재 연결과 더 큰 sequence만 적용한다.

- [ ] 순수 상태 테스트를 먼저 작성한다: 수동 스크롤 후 timer/focus/theme 변경은 suspended 유지; editSequence 증가만 follow 재개; 같은 행에서 입력해도 재개; 다른 owner/connection 및 오래된 sequence 거부. `npm run test -- src/lib/preview-window-state.test.ts`에서 먼저 실패를 확인한다.
- [ ] 자식 listener 설치 후 ready를 보낸다. Rust가 호출 창의 연결을 검증해 부모에 전달하고 부모는 최신 전체 snapshot을 응답한다. 새 창 연결 전에 보낸 이벤트 손실에 의존하지 않는다. 재연결도 같은 handshake를 사용한다.
- [ ] 열린 동안만 DocumentStore를 구독하고 기존 deferred/debounce 처리를 재사용한다. markdown은 revision 변화나 최초 연결에만 읽는다. 커서 변경만으로 lazy string을 다시 직렬화하지 않는다. 동일 snapshot형식을 유지하되 문자열 캐시를 재사용한다.
- [ ] editSequence는 기존 CodeMirror update listener에서 docChanged/selectionSet에 증가시킨다. focus 이벤트·preview render·theme 변경에는 증가시키지 않는다. 목차 선택은 기존 selection 이동을 통해 반영한다.
- [ ] MarkdownPreview의 manual suspension timer를 제거하고 실제 사용자 스크롤 의도와 programmatic scroll을 구분하는 기존 코드를 재사용한다. 새 editSequence에서 같은 블록이라도 visibility를 다시 검사한다. 원문 행 매핑·이미 보이는 블록·reduced motion 동작을 유지한다.
- [ ] 연결 실패를 조용히 최신 내용처럼 표시하지 않는다. preview에 동기화 중/연결 끊김 상태를 표시하고 부모 편집·저장은 계속 동작시킨다. 닫힘·StrictMode 재mount에서 listener/타이머를 정리한다.
- [ ] renderer sanitizer, 링크/상대 이미지와 외부 미디어 정책을 재사용한다. 읽기용 글꼴·제목 위계·목록/인용 표현과 최대 폭 없음, 동일 색상·theme를 적용한다.
- [ ] 상태/preview/scroll/document-store 테스트와 `npm run build`를 실행한다. macOS에서 ready 전 입력, 순서 역전, 두 문서, 수동 읽기 후 같은 줄 입력, 이름 변경, reopen 최신 내용, preview 조작이 editor를 움직이지 않는 것을 확인한다.
- [ ] `feat(preview): 편집 상태와 사용자 동작으로 미리보기를 동기화한다`로 커밋한다.

### Task 6: 통합 검증과 문서의 구현 상태 갱신

**Files:** 수정 `docs/CLIPMARK_REDESIGN.md`, `docs/MULTI_WINDOW_SPEC.md`, `docs/TECH_DECISIONS.md`, `docs/USER_FLOWS.md`; 필요할 때 기존 테스트만 보완한다.

- [ ] `npm run test`, `npm run build`, `cargo test --manifest-path src-tauri/Cargo.toml`을 실행해 전체 통과를 확인한다. 새 실패가 없다면 동일 검사를 불필요하게 반복하지 않는다.
- [ ] `npm run tauri:build`로 release bundle의 최소 macOS 26 설정과 실제 Liquid Glass를 확인한다. 개발 실행만으로 배포 검증을 대신하지 않는다.
- [ ] Finder cold start/Open With, 동일 파일 재열기, 두 dirty 문서와 각 preview, New/Open/Save/Save As/Close Cancel, 경로 복사·파일명 변경을 확인한다. 기존 문서 lifecycle 회귀를 우선 점검한다.
- [ ] 좁고 넓은 창, Retina 배율·다중 모니터·전체 화면, 긴 경로, 마지막 줄, 다크 모드, keyboard navigation/VoiceOver/reduced motion을 확인한다. 확인하지 못한 항목은 완료로 표시하지 않는다.
- [ ] 실제 native 화면 캡처와 실행한 명령·결과를 남기고 목표 문서를 구현 상태로 갱신한다. HTML 시안을 재질 검증 자료로 사용하지 않는다.
- [ ] `docs(redesign): 재단장 구현과 검증 결과를 기록한다`로 커밋한다.

## 계획 자체 검토

- 제품 목표·OS·실제 재질: Task 1/2. 파일명 수정: Task 3. 별도 창·단축키·수명·배치: Task 4. 읽기 표현·최신 상태·추적: Task 5. 회귀·배포: Task 6.
- 클리핑 정책은 유지하며 이번 작업에서 변환 허용 목록을 확대하지 않는다. 기존 paste/renderer 테스트는 Task 6에서 함께 실행한다.
- 문서 store의 lazy serialization과 dirty revision을 유지한다. rename에서 savedRevision을 바꾸는 기존 Save 경로를 재사용하지 않는다.
- 연결·메뉴·native callback의 대상은 main이 아닌 실제 부모 문서다. 모든 새 bridge와 payload 명칭은 본 계획 Interfaces를 기준으로 맞춘다.
- 남은 검토 항목은 물리적으로 비겹침이 불가능한 배치 예외 제안이다. 제품 구현은 아직 시작하지 않았다.
