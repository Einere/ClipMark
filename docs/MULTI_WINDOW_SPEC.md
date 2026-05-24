# ClipMark Multi-Window Spec

이 문서는 ClipMark의 멀티 윈도우 동작에 대한 SSOT다. 새 기능 추가, 버그 수정, 리팩터링, 테스트 보강은 이 문서의 정책을 우선 기준으로 삼는다.

기존 설계 초안은 `docs/superpowers/specs/2026-05-23-multi-window-design.md`에 남겨 둔다. 이 문서는 그 초안을 실제 구현과 회귀 수정 결과에 맞게 갱신한 기준 문서다.

## 목표

ClipMark는 하나의 앱 프로세스에서 여러 Markdown 문서 창을 동시에 열 수 있어야 한다. 각 창은 하나의 문서 세션을 소유하고, 서로 다른 창은 서로 다른 문서를 독립적으로 편집한다.

MVP의 안전 원칙은 "같은 파일은 동시에 하나의 창에서만 편집한다"이다. 같은 파일을 다시 열면 새 창을 만들지 않고 이미 열린 창을 앞으로 가져온다.

## 비목표

- 같은 파일을 여러 창에서 동시에 편집하는 기능
- 파일 잠금, 외부 변경 감지, 저장 충돌 병합
- 창별 recent files
- 창 위치/크기의 창별 복원
- 탭 UI 또는 한 창 안의 다중 문서 UI
- 네이티브 파일 picker와 save sheet의 완전 자동화

## 핵심 모델

### 창과 문서

- 하나의 `WebviewWindow`는 하나의 문서 세션을 가진다.
- 각 창의 React 앱 인스턴스는 독립적인 `DocumentStore`, dirty 상태, preview/layout 상태를 가진다.
- 창 사이의 중복 파일 방지와 새 창 생성/focus 정책은 Rust/Tauri 레이어가 담당한다.
- `main`은 최초 창 label일 뿐이다. 단일 윈도우를 의미하는 특별한 전역 대상이 아니다.
- 추가 문서 창 label은 Rust registry가 `document-1`, `document-2`처럼 증가 id로 만든다.

### 경로 정규화

파일 중복 판정은 정규화된 절대 경로 문자열을 기준으로 한다.

- 가능한 경우 `fs::canonicalize` 결과를 사용한다.
- canonicalize가 실패하면 원본 path를 `PathBuf` 문자열로 변환해 사용한다.
- 저장 전 후보처럼 아직 존재하지 않을 수 있는 path도 비교 대상이므로 canonicalize 실패가 오류가 되어서는 안 된다.

## Rust/Tauri 책임

`src-tauri/src/main.rs`는 멀티 윈도우 orchestration의 소유자다.

### WindowRegistry

`WindowRegistry`는 다음 상태를 관리한다.

- `window_label -> welcome | untitled | path`
- `path -> window_label`
- 다음 document window label id

필수 불변식:

- 하나의 path는 최대 하나의 window label에만 매핑된다.
- 창이 문서 path를 바꾸면 이전 path 매핑은 제거된다.
- 창이 닫히면 해당 창 label과 path 매핑은 제거된다.
- 다른 창이 이미 가진 path를 현재 창에 등록하면 이전 창은 `welcome` 상태로 정리된다.
- path 없는 자동 생성 `main` 창은 `welcome`으로 등록된다.
- `create_document_window`으로 만든 path 없는 `document-*` 창은 `untitled`로 등록된다.
- Finder/Open With 경로를 처리할 때 재사용 가능한 `welcome` 창이 있으면 새 창을 만들지 않고 그 창을 path 문서 창으로 전환할 수 있다.

### Commands

프론트엔드는 `src/lib/document-window.ts`를 통해서만 window command를 호출한다.

- `create_document_window`
  - 새 untitled 문서 창을 만든다.
  - 새 창 URL은 `index.html?new=1`이다.
- `open_document_window(path)`
  - path가 이미 registry에 있고 실제 창이 존재하면 그 창을 show/focus한다.
  - path가 registry에 있지만 창 객체가 아직 생성 중이면 중복 생성을 하지 않는다.
  - path가 registry에 없으면 path를 예약한 뒤 새 문서 창을 만든다.
  - 문서 편집 창의 Open/Open Recent가 사용하는 명령이므로 재사용 가능한 welcome 창이 있어도 현재 정책에서는 그 창을 덮지 않는다.
  - 새 창 URL은 `index.html?path=<encoded path>`다.
- `register_window_document_path(path | null)`
  - command 호출 창의 label을 registry에 등록하고 path 매핑을 갱신한다.
  - path가 `null`이면 현재 창을 `untitled` 문서 창으로 등록한다.
  - 문서가 저장/열림/초기화될 때 프론트엔드가 호출한다.
- `register_window_untitled_document`
  - command 호출 창을 path 없는 `untitled` 문서 창으로 등록한다.
- `register_window_welcome`
  - command 호출 창을 문서가 없는 `welcome` 창으로 등록한다.
- `is_document_path_open_elsewhere(path)`
  - Save As 충돌 검사용이다.
  - 같은 창의 현재 path는 충돌이 아니다.
  - 다른 창에 매핑된 path만 충돌이다.
- `get_initial_document_window_state`
  - 현재 창 label에 대해 registry가 예약한 초기 path 또는 새 문서 요청 여부를 반환한다.
  - query string만 신뢰하지 않는다. registry 상태가 우선이다.
- `close_document_window`
  - 현재 창의 registry 매핑을 제거하고 실제 창을 닫는다.
- `sync_window_document_state`
  - macOS title, represented file, edited dot 상태를 동기화한다.
  - represented filename은 path가 실제로 바뀐 경우에만 갱신해야 한다.

## macOS 파일 열기 정책

macOS Finder/Open With, `open file.md`, 기본 앱 연결은 LaunchServices를 통해 앱의 `application:openURLs:` 경로로 들어온다.

Tauri/Tao 기본 `application:openURLs:` 핸들러는 Rust panic이 Objective-C unwind 경계를 넘으면 프로세스 abort를 유발할 수 있다. 따라서 ClipMark는 macOS에서 Tao delegate의 `application:openURLs:` 구현을 안전 핸들러로 교체한다.

중요한 타이밍 규칙:

- 안전 핸들러 설치는 `build()` 직후, `run()` 이전에 완료되어야 한다.
- Tauri `setup`은 event loop `Ready` 시점에 실행되므로 Finder cold start의 첫 openURLs 이벤트보다 늦을 수 있다.
- 앱 state가 준비되기 전에 openURLs가 들어오면 path를 pending queue에 저장한다.
- `setup`에서 `WindowRegistryState`를 등록한 뒤 pending path를 drain해 문서 창을 연다.
- Finder/Open With path가 registry에 없고 재사용 가능한 welcome 창이 있으면 새 창을 만들지 않고 해당 welcome 창을 path 문서 창으로 전환한다.
- 이미 열린 path가 있으면 welcome 창 재사용보다 기존 문서 창 focus가 우선이다.

이 규칙을 어기면 Finder에서 `.md` 파일을 바로 열 때 앱이 Dock에도 뜨지 않고 crash report만 남는 회귀가 발생할 수 있다.

## 파일 연결

`src-tauri/tauri.conf.json`은 Markdown 파일 연결을 선언해야 한다.

필수 조건:

- `bundle.fileAssociations`에 `md`와 `markdown`이 포함된다.
- macOS content type은 Markdown과 plain text 계열을 포함한다.
- 앱 role은 editor여야 한다.

파일 연결은 Finder에서 ClipMark를 기본 앱으로 지정하기 위한 조건이다. 파일 연결이 있어도 openURLs 핸들러 타이밍이 틀리면 앱 실행은 crash될 수 있다.

## 프론트엔드 책임

### 파일 열기

`src/hooks/useDocumentFileActions.ts`의 New/Open/Open Recent는 현재 문서를 교체하지 않는다.

- 웰컴 창의 New: 현재 창을 untitled 문서 편집 창으로 전환한다.
- 웰컴 창의 Open...: native picker로 path를 고른 뒤, 해당 path가 이미 다른 창에서 열려 있으면 기존 창을 focus하고, 아니면 현재 웰컴 창에 문서를 로드한다.
- 웰컴 창의 Open Recent: Open...과 같은 current-window reuse 정책을 따른다.
- 문서 편집 창의 New: `createDocumentWindow()`를 호출해 새 untitled 창을 만든다.
- 문서 편집 창의 Open...: native picker로 path만 고르고 `openDocumentWindow(path)`를 호출한다.
- 문서 편집 창의 Open Recent: `openDocumentWindow(path)`를 호출한다.
- 브라우저 fallback 파일 input은 Tauri 런타임이 아닐 때만 현재 창에 파일 내용을 적용하는 호환 경로다.

dirty 문서에서 New/Open/Open Recent를 실행해도 현재 창의 dirty 문서를 건드리지 않으므로 unsaved 확인을 띄우지 않는다.

### 초기 문서 로드

새 문서 창은 mount 후 `useInitialDocumentPath`로 초기 상태를 소비한다.

우선순위:

1. `get_initial_document_window_state()`의 registry 상태
2. URL query의 `path`
3. URL query의 `new=1`

초기 요청은 같은 창에서 한 번만 소비해야 한다. path 로드가 성공하면 해당 문서를 현재 창의 workspace에 적용하고 registry에 path를 다시 등록한다.

### 경로 등록과 recent files

문서를 열거나 저장한 뒤에는 다음을 함께 수행한다.

- workspace document metadata 갱신
- recent files 갱신
- `registerWindowDocumentPath(path)` 호출

현재 창이 path 없는 편집 문서가 되면 `registerWindowUntitledDocument()`를 호출한다. 현재 창이 문서 없는 웰컴 화면으로 돌아가면 `registerWindowWelcome()`을 호출한다.

registry 등록 실패는 사용자 작업을 막지 않는다. debug log에 남기고 문서 적용은 계속한다.

### 저장

Save는 현재 창의 문서에만 적용된다.

- 기존 path가 있고 Save인 경우 같은 path에 덮어쓴다.
- path가 없거나 Save As인 경우 native save dialog로 target path를 받는다.
- Save As 또는 target path 변경은 쓰기 전에 `isDocumentPathOpenElsewhere(targetPath)`를 확인한다.
- 다른 창에서 열린 target이면 저장하지 않고 오류를 표시한다.
- 저장 성공 후 workspace metadata, recent files, registry path를 갱신한다.

기본 파일 덮어쓰기 저장은 macOS represented filename을 반복 갱신해서 crash를 유발해서는 안 된다. `sync_window_document_state`에는 `representedPathChanged`를 전달하고, Rust는 이 값이 참일 때만 represented filename을 갱신한다.

### 창 닫기

멀티 윈도우에서는 창 닫기가 hide/reset이 아니라 실제 window close다.

- clean 문서: registry를 정리하고 창을 닫는다.
- dirty 문서: native sheet 또는 fallback dialog에서 Save, Don't Save, Cancel을 제공한다.
- Save: 저장 성공 후 창을 닫는다. 저장 취소/실패 시 창을 유지한다.
- Don't Save: 저장하지 않고 창을 닫는다.
- Cancel: 창을 유지한다.

프로그램이 직접 닫는 close와 사용자가 요청한 close는 구분해야 한다. 프로그램 close가 다시 close request를 발생시킬 때 unsaved flow가 재진입하면 안 된다.

### Dock reopen

마지막 창을 닫아도 macOS 앱 프로세스는 남을 수 있다. `RunEvent::Reopen { has_visible_windows: false }`가 들어오면 새 빈 문서 창을 만든다.

단, modal sheet가 떠 있는 동안에는 reopen 처리를 무시한다.

### 메뉴

macOS 앱 메뉴는 전역이지만 동작 대상은 현재 포커스된 ClipMark 창이다.

- 각 창은 자신의 상태를 메뉴 state로 계산한다.
- 포커스된 창만 전역 메뉴를 sync한다.
- 포커스되지 않은 창의 상태 변경은 전역 메뉴를 덮어쓰지 않는다.
- 포커스된 ClipMark 창이 없으면 현재 창이 필요한 메뉴 동작은 비활성화되어야 한다.

## 사용자 관점 동작

### New

- 웰컴 창에서는 같은 창이 untitled 편집 창으로 전환된다.
- 문서 편집 창에서는 새 untitled 창이 열린다.
- 문서 편집 창에서 실행하면 현재 창의 문서와 dirty 상태는 유지된다.
- 여러 untitled 창을 동시에 열 수 있다.

### Open...

- 웰컴 창에서 파일을 선택하면 해당 파일이 같은 창에서 열린다.
- 문서 편집 창에서 파일을 선택하면 해당 파일이 새 창에서 열린다.
- 이미 열린 파일을 선택하면 새 창을 만들지 않고 기존 창이 앞으로 온다.
- 문서 편집 창의 dirty 문서는 교체되지 않는다.

### Open Recent

- Open...과 같은 existing-window 정책을 따른다.
- 웰컴 창에서는 아직 열리지 않은 recent file을 같은 창에 로드한다.
- 문서 편집 창에서는 recent file을 새 창에서 열거나 기존 창을 focus한다.
- recent file이 사라졌으면 recent 목록에서 제거하고 오류를 표시한다.

### Finder/Open With

- 앱이 꺼져 있어도 `.md` 파일을 열면 ClipMark가 실행되고 해당 문서 창이 열린다.
- 앱이 이미 실행 중이고 재사용 가능한 웰컴 창이 있으면 그 창이 해당 문서 편집 창으로 전환된다.
- 재사용 가능한 웰컴 창이 없으면 해당 문서 창을 만들거나 기존 창을 focus한다.
- 이미 열린 파일을 다시 열면 기존 창이 앞으로 온다.
- 이 흐름에서 crash report가 새로 생기면 회귀다.

### Save As

- 다른 창에서 열린 파일을 target으로 고르면 저장이 차단된다.
- 현재 창의 기존 path로 저장하는 것은 허용된다.

## 테스트 기준

### 자동 테스트

변경 영향에 따라 다음 테스트를 선택한다.

- Rust window registry, open decision, pending open queue, file association:
  - `cargo test --manifest-path src-tauri/Cargo.toml`
- React hooks, file actions, menu sync, close flow, initial document loading:
  - `npm run test`
- TypeScript와 production bundle:
  - `npm run build`

멀티 윈도우 관련 핵심 동작은 가능한 한 단위 테스트로 고정한다.

필수 회귀 테스트 축:

- registry path 중복 방지
- 창 생성 실패 시 registry 예약 rollback
- 초기 문서 창 state가 welcome 대신 path/new 요청을 반환
- New/Open/Open Recent가 현재 문서를 교체하지 않음
- Save As target 충돌 차단
- dirty close Save/Don't Save/Cancel
- focus된 창만 menu sync
- represented path 변경시에만 macOS represented filename 갱신
- openURLs pending queue drain

### macOS smoke test

네이티브 통합 변경 후에는 가능한 경우 다음을 확인한다.

1. release `.app` 또는 `tauri:dev` 앱을 실행한다.
2. `open /path/to/file.md`로 LaunchServices 파일 열기 경로를 검증한다.
3. `pgrep -fl clipmark`로 프로세스가 살아 있는지 확인한다.
4. `~/Library/Logs/DiagnosticReports`에 새 `clipmark-*.ips`가 생기지 않았는지 확인한다.
5. System Events 또는 시각 확인으로 창 제목이 열린 파일명인지 확인한다.

`npm run tauri:build`가 DMG bundling 단계에서 실패하더라도 `.app` 생성까지 성공했다면 `.app` smoke test는 수행할 수 있다. 단, DMG 실패 자체는 별도 배포 이슈로 추적한다.

### 남겨둘 수 있는 수동 확인

다음은 OS UI 상태와 접근성 권한에 민감하므로 완전 자동화 대상이 아니다.

- native open/save panel의 세부 조작
- native dirty close sheet의 버튼 클릭
- 실제 Dock 아이콘 클릭

이 영역은 핵심 정책을 단위 테스트로 고정하고, 네이티브 UI 연결은 smoke test로 확인한다.

## 변경 규칙

멀티 윈도우 관련 변경은 다음 규칙을 지켜야 한다.

- 현재 창의 문서를 암묵적으로 교체하는 New/Open/Open Recent 흐름을 다시 만들지 않는다.
- path 중복 방지 정책을 우회하지 않는다.
- registry 갱신과 macOS title/dirty/represented file 동기화를 혼동하지 않는다.
- Finder/Open With cold start를 수정할 때는 `setup` 타이밍을 신뢰하지 않는다.
- 저장 성공 전에는 registry path를 최종 path로 확정하지 않는다.
- 창 close는 hide/reset으로 되돌리지 않는다.
- 메뉴 sync는 포커스 소유권을 기준으로 한다.

## 현재 알려진 제약

- `npm run tauri:build`는 `.app` 생성 후 DMG bundling 단계에서 실패할 수 있다. 멀티 윈도우 정책 검증은 `.app`로 가능하지만 배포 패키징은 별도 점검이 필요하다.
- LaunchServices의 기본 앱 캐시는 사용자의 macOS 상태에 영향을 받을 수 있다. Finder 재현이 이상하면 `osascript -e 'POSIX path of (path to application "ClipMark")'`로 실제 선택된 앱 번들을 확인한다.
- `/Applications/ClipMark.app`와 개발 산출물 `.app`가 공존할 수 있다. crash log의 binary UUID와 실제 앱 binary UUID를 비교하면 어느 번들이 실행됐는지 확인할 수 있다.
