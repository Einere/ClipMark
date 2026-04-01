# Frontend Clean Code Review

## 기준

- 가독성: 처음 읽는 사람이 핵심 흐름을 빠르게 파악할 수 있는가
- 예측 가능성: 이름과 시그니처만 보고 동작과 사이드이펙트를 예상할 수 있는가
- 응집도: 함께 바뀌는 코드가 같은 경계에 모여 있는가
- 결합도: 한 변경이 불필요하게 넓은 파일/컴포넌트로 번지지 않는가
- React/Vercel: 불필요한 재렌더, transient state, lazy loading, 파생 상태 관리가 적절한가

점수는 `1`이 취약, `5`가 양호다.

## 요약

- 즉시 수정 필요
  - 현재 없음. 이번 리팩터링으로 파일 경로 복사 중복과 앱 뷰 파생 상태 중복은 해소됨.
- 다음 리팩터링 사이클
  - `useAppMenuController`의 controller state를 초기 sync 보완과 함께 `ref` 기반으로 전환
  - `AppContent`의 prop bag 축소
  - `useAppShellLifecycle`의 welcome/untitled 파생 경로 테스트 보강
- 유지 권장
  - `EditorWorkspace`의 preview/toc 지연 처리
  - `useEffectEvent` 기반 이벤트 핸들러 안정화 패턴
  - `EditorWorkspace` lazy loading

## 파일별 평가

### `src/App.tsx`

- 가독성: 4/5
- 예측 가능성: 4/5
- 응집도: 4/5
- 결합도: 3/5
- React/Vercel: 4/5
- 메모: 앱 조립 진입점으로서 역할은 명확하다. 다만 여전히 메뉴, lifecycle, preferences, session을 한 파일에서 묶기 때문에 변경 영향 범위가 넓다.
- 권장 조치: 지금 수준은 허용 가능하다. 추가로 줄인다면 app shell orchestration만 별도 hook으로 묶는 정도가 적절하다.

### `src/hooks/useAppViewState.ts`

- 가독성: 4/5
- 예측 가능성: 5/5
- 응집도: 5/5
- 결합도: 4/5
- React/Vercel: 4/5
- 메모: `deriveAppViewState`와 `useAppViewState`가 같은 파일에 있어 파생 규칙의 단일 소스가 됐다. visibility/pendingAction처럼 UI 문맥에 따라 달라지는 값과 순수 파생값의 경계도 읽기 쉽다.
- 권장 조치: 현재 구조 유지. 회귀 방지를 위해 lifecycle 연동 테스트만 조금 더 보강하면 충분하다.

### `src/hooks/useAppShellLifecycle.ts`

- 가독성: 4/5
- 예측 가능성: 4/5
- 응집도: 4/5
- 결합도: 3/5
- React/Vercel: 4/5
- 메모: 창 visibility, close flow, pending action을 한데 조율하는 통합 hook이라 결합도는 어느 정도 높다. 그래도 현재 책임은 모두 앱 셸 lifecycle에 속하므로 과도하게 어색하지는 않다.
- 권장 조치: `isWelcomeVisible: true`, `filename: null` 경로를 검증하는 테스트를 추가해 파생 상태 이동 회귀를 막는다.

### `src/hooks/useAppMenuController.ts`

- 가독성: 4/5
- 예측 가능성: 4/5
- 응집도: 4/5
- 결합도: 3/5
- React/Vercel: 3/5
- 메모: imperative menu controller를 React state에 넣고 있어 UI에 쓰이지 않는 값 때문에 재렌더 가능성이 생긴다. 기능상 문제는 없지만, 화면 출력과 무관한 transient 값을 state 대신 ref로 다루는 방향을 검토할 수 있다.
- 권장 조치: `menuController`를 `useRef`로 옮기려면 단순 치환으로 끝내지 말고, `setupAppMenu()` 직후 최신 state를 즉시 `sync()`하거나 최신 state ref를 함께 유지해 초기 메뉴 상태가 누락되지 않게 해야 한다.

### `src/hooks/useAppShellActions.ts`

- 가독성: 4/5
- 예측 가능성: 4/5
- 응집도: 4/5
- 결합도: 4/5
- React/Vercel: 4/5
- 메모: 메뉴/웰컴 화면 액션을 한 경계에 모아둔 점이 좋다. 파일 경로 복사 중복도 제거되어 숨은 사이드이펙트가 줄었다.
- 권장 조치: 현재 구조 유지.

### `src/hooks/useDocumentSession.ts`

- 가독성: 4/5
- 예측 가능성: 4/5
- 응집도: 4/5
- 결합도: 3/5
- React/Vercel: 4/5
- 메모: recent files, workspace state, file actions를 조립하는 세션 진입점으로 역할이 명확하다. 다만 세션 관련 흐름이 커지면 파일 액션과 workspace 적용 규칙이 더 강하게 엮일 수 있다.
- 권장 조치: 현재 구조 유지. 세션 기능이 더 늘어나면 recent files와 file action orchestration의 경계를 다시 본다.

### `src/hooks/useDocumentWorkspaceState.ts`

- 가독성: 4/5
- 예측 가능성: 5/5
- 응집도: 5/5
- 결합도: 4/5
- React/Vercel: 4/5
- 메모: 문서 열기/저장/닫기/새 문서 생성 시 workspace state 갱신 규칙이 한 곳에 모여 있다. `documentStore` 갱신과 state transition이 같은 경계에 있어 따라가기 쉽다.
- 권장 조치: 현재 구조 유지.

### `src/components/app/AppContent.tsx`

- 가독성: 3/5
- 예측 가능성: 4/5
- 응집도: 3/5
- 결합도: 2/5
- React/Vercel: 3/5
- 메모: 파일 자체는 짧지만, `dialog`, `editor`, `fileInput`, `welcome` prop bag을 그대로 아래로 넘기는 중간 통로 역할이 크다. prop 이름 하나 바뀌면 수정 면적이 넓어진다.
- 권장 조치: `AppContent`가 실제로 필요한 경계만 받도록 prop 묶음을 줄이거나, `AppContent` 자체를 더 얇게 만든다.

### `src/components/app/EditorWorkspaceContainer.tsx`

- 가독성: 4/5
- 예측 가능성: 4/5
- 응집도: 4/5
- 결합도: 4/5
- React/Vercel: 5/5
- 메모: 현재 역할이 `Suspense` 경계와 lazy workspace 로딩에 집중돼 있어 깔끔하다. 복사 책임을 footer로 내리면서 불필요한 prop 전달도 사라졌다.
- 권장 조치: 현재 구조 유지.

### `src/components/workspace/EditorWorkspace.tsx`

- 가독성: 4/5
- 예측 가능성: 4/5
- 응집도: 4/5
- 결합도: 3/5
- React/Vercel: 5/5
- 메모: preview/toc 계산, deferred markdown, debounced/idle preview 반영은 성능 관점에서 좋다. 다만 패널 상태, 리사이즈, footer, preview, toc가 모두 모여 있어 파일 길이는 계속 관리가 필요하다.
- 권장 조치: 현 상태는 허용 범위다. 추가 기능이 붙으면 footer/panel config를 더 분리하는 것을 검토한다.

### `src/components/workspace/DocumentWorkspaceFooter.tsx`

- 가독성: 4/5
- 예측 가능성: 4/5
- 응집도: 5/5
- 결합도: 4/5
- React/Vercel: 4/5
- 메모: 파일 경로 표시와 복사 상호작용이 같은 컴포넌트에 모여 응집도가 좋아졌다. 표시 전용 컴포넌트는 아니지만, 실제 사용자 행동의 소유자가 footer라는 점에서 더 자연스럽다.
- 권장 조치: 현재 구조 유지.

### `src/hooks/useCopyFilePath.ts`

- 가독성: 5/5
- 예측 가능성: 5/5
- 응집도: 5/5
- 결합도: 5/5
- React/Vercel: 4/5
- 메모: 파일 경로 복사 정책과 토스트 메시지가 한 곳에 모여 있다. 메뉴와 footer에서 같은 정책을 재사용하므로 변경 비용이 낮다.
- 권장 조치: 현재 구조 유지. 실제 Tauri 런타임에서 clipboard 권한 문제만 수동 확인하면 충분하다.

### `src/components/workspace/WorkspaceLayout.tsx`

- 가독성: 4/5
- 예측 가능성: 4/5
- 응집도: 4/5
- 결합도: 4/5
- React/Vercel: 4/5
- 메모: 레이아웃 구조와 side panel rendering이 명확하게 분리돼 있다. editor/preview/toc panel의 렌더링 순서도 읽기 쉽다.
- 권장 조치: 현재 구조 유지.

## 추천 실행 순서

1. `useAppMenuController`의 transient state를 `ref`로 옮기되, setup 직후 초기 `sync()` 누락 방지까지 함께 처리한다.
2. `useAppShellLifecycle.test.tsx`에 welcome/untitled 파생 케이스를 추가한다.
3. `AppContent` prop bag을 축소해 중간 전달 비용을 줄인다.
4. 필요 시 `EditorWorkspace` 내부 panel 구성 object를 더 분리한다.
