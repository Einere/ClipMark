# ClipMark Multi-Window Design

## 배경 및 목표

ClipMark는 현재 하나의 앱 프로세스에서 하나의 문서 창만 다룬다. 창 닫기 흐름도 실제 종료가 아니라 창을 숨기고 단일 문서 세션을 초기화하는 방식이다. 이 구조는 단일 문서 편집에는 단순하지만, 여러 Markdown 파일을 동시에 비교하거나 번갈아 편집하는 흐름에서는 불편하다.

이번 변경의 목표는 멀티 윈도우를 지원하되, 같은 파일을 여러 창에서 동시에 편집하지 않는 안전한 MVP를 만드는 것이다. 하나의 창은 하나의 문서 세션을 소유하고, 이미 열린 파일을 다시 열면 새 창을 만들지 않고 기존 창을 앞으로 가져온다.

## 범위

### 포함

- 여러 untitled 문서 창을 동시에 열 수 있다.
- 서로 다른 Markdown 파일을 각각 독립 창에서 열고 편집할 수 있다.
- 이미 열린 파일을 다시 열면 기존 창을 focus한다.
- `New`, `Open...`, `Open Recent`, Finder/Open With 이벤트를 멀티 윈도우 정책에 맞게 재정의한다.
- 창 닫기는 현재의 hide/reset 방식이 아니라 문서 세션 종료와 WebviewWindow 제거로 동작한다.
- `Save As...` 대상이 다른 창에서 이미 열린 파일이면 저장을 막는다.
- 앱 메뉴는 현재 포커스된 ClipMark 창의 상태를 기준으로 동작한다.

### 제외

- 같은 파일을 여러 창에서 동시에 여는 기능.
- 파일 잠금, 외부 변경 감지, 저장 충돌 병합.
- 창별 최근 파일 목록. 최근 파일은 앱 전체 공유 목록으로 유지한다.
- 창 위치와 크기의 창별 복원.
- 탭 UI 또는 한 창 안의 다중 문서 UI.

## 핵심 설계

멀티 윈도우 모델은 `창 하나 = 문서 세션 하나`로 정의한다. 프론트엔드의 `App`, `useDocumentSession`, `DocumentStore`, dirty tracking, preview/layout 상태는 각 WebviewWindow 안에서 독립적으로 실행된다. 창 간 조정은 Rust/Tauri 레이어가 담당한다.

Rust 앱 상태에는 `WindowRegistry`를 추가한다. registry는 다음 매핑을 관리한다.

- `window_label -> path | null`
- `path -> window_label`
- 새 창 label 생성을 위한 증가 id

`path`는 정규화된 절대 경로 문자열을 기준으로 저장한다. Windows 경로까지 고려해야 하므로 Rust의 `PathBuf`를 문자열로 보관하되, 비교 전 canonicalize 가능한 파일은 canonicalize 결과를 우선 사용한다. canonicalize가 실패하는 저장 전 경로나 아직 생성되지 않은 Save As 후보는 원본 절대 경로를 비교 키로 사용한다.

프론트엔드는 문서를 열거나 저장해서 현재 창의 경로가 바뀔 때 Rust command를 호출해 registry를 갱신한다. 기존 `sync_window_document_state`는 macOS 문서 아이콘, dirty dot, title 반영을 담당하고, registry 갱신은 별도 command로 분리한다. 이렇게 하면 네이티브 window 표시 상태와 앱의 중복 파일 방지 정책을 독립적으로 테스트할 수 있다.

## Rust/Tauri API

새 command는 다음 책임을 갖는다.

- `create_document_window(initial_path?: string)`: 새 WebviewWindow를 생성한다. `initial_path`가 있으면 앱 URL query string에 encoded path를 실어 새 창이 mount 직후 해당 파일을 로드하게 한다.
- `open_document_window(path: string)`: path가 registry에 있으면 해당 창을 보여주고 focus한다. 없으면 `create_document_window(path)`를 호출한다.
- `register_window_document_path(path: string | null)`: 현재 command를 호출한 창 label에 path를 매핑한다. 기존 path 매핑은 제거한다.
- `is_document_path_open_elsewhere(path: string)`: Save As 충돌 검사용 command다. 같은 창에 매핑된 path는 충돌로 보지 않고, 다른 창에 매핑된 path만 충돌로 본다.
- `close_document_window()`: 현재 창을 실제로 닫는다. 닫기 전 registry에서 해당 창 label과 path 매핑을 제거한다.

기본 Tauri 설정으로 자동 생성되는 최초 창 label은 `main`으로 유지한다. 단, `"main"`은 최초 창 label일 뿐 단일 윈도우 전제의 특별한 대상이 아니다. setup 단계에서 `main`을 registry에 등록하고, 이후 생성되는 창은 `document-1`, `document-2`처럼 증가 id를 붙인다.

`RunEvent::Opened`는 더 이상 전역 `clipmark://open-document` 이벤트를 모든 창에 emit하지 않는다. Rust가 각 file URL을 `open_document_window(path)` 정책으로 처리한다.

`RunEvent::Reopen { has_visible_windows: false }`는 기존 `"main"` 창을 찾는 대신 새 빈 문서 창을 만든다. modal sheet가 떠 있는 동안에는 현재처럼 재오픈 처리를 무시한다.

## 프론트엔드 동작

`useDocumentSession`은 창 내부 단일 문서 세션으로 유지한다. 다만 파일 열기 계열 액션은 현재 문서를 교체하지 않고 Rust window command를 호출하도록 바뀐다.

- `New`: `create_document_window()` 호출.
- `Open...`: 파일 선택 후 `open_document_window(path)` 호출.
- `Open Recent`: `open_document_window(path)` 호출.
- Finder/Open With: Rust가 직접 `open_document_window(path)` 처리.
- 초기 path가 전달된 새 창: `window.location.search`에서 path를 읽고, mount 후 해당 파일을 현재 창의 `DocumentStore`에 적용한다.

현재 창의 문서를 교체하는 흐름은 축소한다. 기존 단일 윈도우에서는 dirty 문서 위에서 `Open...`이나 `New`를 누르면 pending action과 unsaved dialog가 필요했다. 멀티 윈도우 MVP에서는 `New`와 `Open...`이 새 창 생성 또는 기존 창 focus로 동작하므로 현재 dirty 문서를 건드리지 않는다. 따라서 이 두 액션에는 unsaved 확인이 필요 없다.

창 내부에서 여전히 필요한 unsaved 확인은 창 닫기다. dirty 문서 창을 닫을 때는 저장, 버리기, 취소를 제공한다.

## 저장 동작

`Save`는 현재 포커스된 창의 문서에만 적용된다. 저장 성공 후 현재 창의 file path와 filename을 갱신하고, registry에도 새 path를 등록한다.

`Save As...`는 저장 전에 선택된 target path가 다른 창에서 이미 열려 있는지 확인한다.

- 열려 있지 않으면 저장하고 registry를 새 path로 갱신한다.
- 같은 창의 현재 path면 일반 저장과 동일하게 허용한다.
- 다른 창에서 열려 있으면 저장을 취소하고 사용자에게 오류 토스트를 보여준다.

이 정책은 같은 파일을 여러 창에서 동시에 편집하지 않는 MVP 원칙을 저장 경로 변경에도 동일하게 적용한다.

## 창 닫기 동작

현재 구현은 close request를 가로채고 `hide_window()`로 창을 숨긴 뒤 문서 상태를 초기화한다. 멀티 윈도우에서는 hide/reset 방식 대신 실제 window close를 사용한다.

- clean 문서: registry를 정리하고 창을 닫는다.
- dirty 문서: 네이티브 sheet 또는 fallback dialog로 저장, 버리기, 취소를 묻는다.
- 저장 성공: registry를 최신 path로 갱신한 뒤 창을 닫는다.
- 버리기: registry를 정리하고 창을 닫는다.
- 취소: 창을 유지한다.

마지막 창을 닫아도 macOS 앱 프로세스는 유지될 수 있다. Dock 아이콘을 다시 클릭했을 때 보이는 창이 없으면 새 빈 문서 창을 만든다.

## 메뉴 동작

macOS 앱 메뉴는 전역이지만, 파일/뷰 동작 대상은 현재 포커스된 ClipMark 창이다.

- `New`: 항상 새 untitled 창을 만든다.
- `Open...`: 파일 선택 후 이미 열린 파일이면 기존 창 focus, 아니면 새 창 생성.
- `Open Recent`: `Open...`과 같은 정책을 사용한다.
- `Save`, `Save As...`, `Copy File Path`, preview/TOC/external media 토글: 현재 포커스된 창의 React 핸들러가 처리한다.
- 포커스된 ClipMark 창이 없으면 현재 창이 필요한 메뉴 항목은 비활성화한다.
- recent files와 preferences는 앱 전체 공유 상태로 유지한다.

구현은 각 창의 React 앱이 focus 이벤트와 상태 변경 시 자신의 `MenuState`를 app menu에 반영하는 방식으로 시작한다. 포커스된 창이 바뀌면 새로 포커스된 창의 menu state가 전역 메뉴를 덮어쓴다. 포커스를 잃은 창은 상태가 바뀌어도 전역 메뉴를 sync하지 않는다. 나중에 메뉴 상태 경쟁이 다시 문제가 되면 Rust에 focused window state를 두는 방식으로 옮길 수 있지만, MVP에서는 현재 `useAppMenuController` 구조를 유지하며 focus 기준 sync를 강화한다.

## 오류 처리

- 이미 열린 파일을 다시 열면 오류로 보지 않고 기존 창을 focus한다.
- recent file이 사라졌으면 기존처럼 recent 목록에서 제거하고 오류 토스트를 표시한다.
- 새 창 생성 실패는 현재 창에 오류 토스트를 표시한다.
- 초기 path 로드 실패는 해당 새 창에서 welcome 또는 빈 문서 상태로 되돌리고 오류 토스트를 표시한다.
- Save As 충돌은 저장하지 않고 오류 토스트를 표시한다.

## 테스트 전략

### 단위 테스트

- registry가 이미 열린 path에 대해 기존 window label을 반환한다.
- registry가 창 닫힘 또는 path 변경 시 이전 path 매핑을 제거한다.
- `open_document_window(path)`가 기존 창 focus와 새 창 생성을 올바르게 분기한다.
- 프론트 파일 액션에서 `New`, `Open...`, `Open Recent`가 현재 문서를 교체하지 않고 window command를 호출한다.
- 저장 성공 후 registry 갱신 command가 호출된다.
- `Save As...` target이 다른 창에서 열려 있으면 저장을 막고 오류를 반환한다.
- dirty close에서 save/discard/cancel 결과가 실제 close 여부로 이어진다.

### 수동 검증

- `Cmd+N`으로 untitled 창을 여러 개 만든다.
- 서로 다른 `.md` 파일 두 개를 각각 다른 창에서 연다.
- 이미 열린 파일을 다시 열었을 때 새 창이 생기지 않고 기존 창이 앞으로 온다.
- Finder에서 이미 열린 `.md` 파일을 다시 열었을 때 기존 창이 앞으로 온다.
- dirty 창 닫기에서 Save, Don't Save, Cancel을 각각 확인한다.
- 마지막 창을 닫은 뒤 Dock 아이콘을 클릭하면 새 빈 창이 열린다.
- `Save As...` 대상이 다른 창에서 열린 파일이면 저장이 차단된다.

## 구현 순서

1. Rust에 `WindowRegistry`와 path normalization helper를 추가하고 단위 테스트를 작성한다.
2. 창 생성, 기존 창 focus, registry 갱신 command를 추가한다.
3. `RunEvent::Opened`와 `RunEvent::Reopen`을 registry 기반 window orchestration으로 바꾼다.
4. 프론트 파일 액션을 현재 문서 교체 방식에서 window command 호출 방식으로 바꾼다.
5. 새 창 초기 path 로드 흐름을 추가한다.
6. 저장과 Save As 충돌 검사를 registry와 연결한다.
7. 창 닫기 흐름을 hide/reset에서 실제 close로 바꾼다.
8. 메뉴 sync를 포커스된 창 기준으로 정리한다.
9. 단위 테스트와 macOS 수동 검증을 수행한다.

## 리스크와 대응

- Tauri app menu가 전역이어서 여러 React 인스턴스가 동시에 sync하면 race가 생길 수 있다. focus된 창만 menu sync를 수행하도록 제한한다.
- Save As 충돌 검사를 저장 다이얼로그 이후에 수행해야 하므로 사용자가 선택한 path를 저장 전에 검증하는 중간 단계가 필요하다.
- default window 자동 생성과 수동 window 생성이 섞이면 label 관리가 복잡해질 수 있다. 최초 창도 registry에 등록하고 label 규칙을 문서화한다.
- 현재 close 흐름이 hide/reset을 전제로 하므로 테스트 기대값이 많이 바뀔 수 있다. close 책임을 `useWindowCloseRequest`와 native window adapter 경계에서 좁게 수정한다.

## 승인 기준

- 하나의 앱 프로세스에서 여러 문서 창을 동시에 띄울 수 있다.
- 같은 파일은 한 번만 열린다.
- 새 파일/기존 파일 열기는 현재 dirty 문서를 교체하지 않는다.
- 각 창의 title, dirty 표시, represented file path가 해당 문서 상태와 일치한다.
- 마지막 창을 닫아도 앱 재오픈이 정상 동작한다.
- 자동 테스트와 지정된 macOS 수동 검증 플로우가 통과한다.
