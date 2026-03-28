# Multi-Window Design

**Date:** 2026-03-28
**Status:** Approved

## Overview

ClipMark을 단일 문서 편집에서 OS 네이티브 멀티 윈도우로 전환한다. 각 창은 하나의 문서를 독립적으로 담당하며, 앱 설정(테마, 패널 레이아웃 등)은 모든 창 간에 실시간으로 동기화된다.

---

## Requirements

### 창 열기 동작

- 현재 창이 **웰컴 페이지** → 해당 창에서 바로 문서 로드 (기존 동작 유지)
- 현재 창에 **문서가 열려 있음** → 새 OS 창을 생성해서 열기
  - "새 파일" (Cmd+N): 빈 문서로 새 창
  - "파일 열기" (Cmd+O): 선택한 파일로 새 창

### 창 닫기 동작

- 문서 닫기 = 해당 OS 창 종료
- 미저장 변경 있으면 Save/Discard/Cancel 시트 표시 후 종료
- 웰컴 페이지 창도 닫으면 창 종료

### 독 클릭 (모든 창 닫힌 상태)

- `Reopen` 이벤트 → 웰컴 페이지가 있는 새 창 생성

### 설정 동기화

- `AppPreferences` 전체 필드를 모든 창 간에 실시간 동기화
- 동기화 대상: `themeMode`, `autoLoadExternalMedia`, `isPreviewVisible`, `isTocVisible`, `previewPanelWidth`, `tocPanelWidth`
- 어느 창에서 설정을 변경해도 모든 열린 창에 즉시 반영

---

## Architecture

### 상태 소유권

| 상태 | 소유자 | 동기화 |
|------|--------|--------|
| 문서 내용 (markdown) | 각 창의 `DocumentStore` | 없음 (창별 독립) |
| 파일 경로, 저장 상태 | 각 창의 `useDocumentSession` | 없음 (창별 독립) |
| `AppPreferences` | Rust `Mutex<AppPreferences>` | 전역 실시간 동기화 |

### 동기화 흐름

```
창 A에서 설정 변경
  → save_app_preferences(prefs) [Tauri command]
  → Rust: Mutex 업데이트 + app_handle.emit("preferences-changed", prefs)
  → 모든 창 수신 (창 A 포함)
  → 각 창: React 상태 업데이트
```

### 새 창 생성 흐름

```
문서가 열린 창에서 "새 파일" 또는 "파일 열기"
  → open_new_window(filePath?) [Tauri command]
  → Rust: WebviewWindow::builder로 새 창 생성
         label: "document-{uuid}"
         URL: tauri://localhost?path=/some/file.md  (파일 열기 시)
             tauri://localhost                      (새 파일 시)
  → 새 창: main.tsx에서 URL 파라미터 읽어 파일 자동 로드
```

---

## Changes

### Rust (`src-tauri/src/main.rs`)

**1. `save_app_preferences` 수정**
- 기존: 디스크 저장 + Mutex 업데이트
- 추가: `app_handle.emit("preferences-changed", &preferences)` — 모든 창에 브로드캐스트

**2. `open_new_window` 커맨드 신규 추가**
- 파라미터: `file_path: Option<String>`
- `WebviewWindow::builder`로 새 창 생성
- 파일 경로는 URL 쿼리 파라미터 `?path=...`로 전달
- 창 label: `"document-{uuid}"` (충돌 방지)

**3. `Reopen` 이벤트 핸들러 수정**
- 기존: `get_webview_window("main").show()`
- 변경: `open_new_window(None)` 호출

### Frontend

**`src/lib/native-window.ts`**
- `openNewWindow(filePath?: string): Promise<void>` 추가
- `invoke("open_new_window", { filePath })` 호출

**`src/main.tsx`**
- 앱 시작 시 URL 쿼리 파라미터 `?path=...` 파싱
- 경로가 있으면 초기 문서로 자동 로드

**`src/App.tsx`**
- `useEffect`로 `preferences-changed` 이벤트 listen 등록/해제
- 이벤트 수신 시 `themeMode` 등 모든 설정 상태 업데이트

**`src/hooks/useDocumentSession.ts`**
- `createNewDocument()`: `isWelcomeVisible=false`이면 `openNewWindow()` 호출
- `openWithPicker()`: 파일 선택 후 `isWelcomeVisible=false`이면 `openNewWindow(filePath)` 호출
- `applyOpenedDocument()`: URL 파라미터로 전달된 초기 파일 처리

---

## Event Reference

| 이벤트 | 방향 | 페이로드 |
|--------|------|----------|
| `preferences-changed` | Rust → 모든 창 | `AppPreferences` 전체 |

---

## Performance

- 설정 동기화 페이로드: ~100바이트 JSON
- 동기화 빈도: 사용자가 설정 변경 시에만 (에디터 입력 시 없음)
- 문서 내용은 창 간 전달 없음

---

## Out of Scope

- 창 간 문서 드래그 앤 드롭
- 같은 파일을 여러 창에서 동시 편집
- 창 레이아웃 저장/복원 (세션 복구)
