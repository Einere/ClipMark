# Preview Auto Scroll Stabilization Design

## 배경 및 의도

ClipMark는 로컬 Markdown 파일을 좌측 편집 패널에서 작성하고 우측 미리보기 패널에서 읽는 split editor다. 현재 미리보기 자동 스크롤은 에디터의 활성 줄을 기준으로 가장 가까운 preview anchor를 찾아 이동한다. 이 기능의 의도는 좋지만, 입력 중 `previewHtml` 재생성과 `ResizeObserver` 변화가 같은 줄에 대한 스크롤 동기화를 반복 실행하면서 미리보기 패널이 흔들릴 수 있다.

이번 변경의 목표는 자동 스크롤의 기준을 명확히 해서 사용자가 입력하는 동안 미리보기가 불필요하게 재배치되지 않게 만드는 것이다. 기능 원칙은 유지한다. 에디터의 활성 줄이 앵커 가능한 다른 Markdown 블록으로 이동했을 때, 미리보기는 해당 블록이 보이도록 따라가야 한다.

## 목표

- 에디터 활성 줄이 다른 preview anchor 블록으로 이동했을 때만 미리보기를 자동 스크롤한다.
- 같은 문단, 리스트 항목, 코드블록, 표 등 같은 anchor 범위 안에서 입력할 때는 미리보기를 다시 스크롤하지 않는다.
- Markdown 재렌더는 anchor 목록을 갱신하되, 그 자체가 자동 스크롤 명령이 되지 않는다.
- 패널 레이아웃 변화와 ResizeObserver 콜백은 스크롤 상태를 흔들지 않도록 보조 이벤트로 취급한다.
- 사용자가 미리보기 패널을 직접 스크롤하면 자동 추적을 잠시 멈춘다.
- 입력 중 자동 스크롤은 즉시 이동을 사용하고, `smooth` 스크롤은 명시적 이동 같은 별도 사용자 명령에서만 사용할 수 있게 경계를 남긴다.

## 비목표

- 에디터 스크롤 위치와 미리보기 스크롤 비율을 양방향으로 동기화하지 않는다.
- 미리보기에서 클릭한 위치로 에디터 커서를 이동하는 기능은 추가하지 않는다.
- Markdown renderer의 source map 정밀도를 문단 내부 character 단위까지 확장하지 않는다.
- UI 토글이나 설정 화면을 새로 만들지 않는다.

## 현재 구조

- `src/components/editor/MarkdownEditor.tsx`
  - CodeMirror update listener가 `docChanged` 시 document store에 변경을 알린다.
  - `docChanged` 또는 `selectionSet` 시 현재 커서 줄을 `EditorViewStateStore`에 기록한다.
- `src/components/workspace/EditorWorkspace.tsx`
  - document store에서 markdown을 읽고 `useDeferredValue`, debounce, idle value를 거쳐 `MarkdownPreview`로 전달한다.
  - 에디터가 focused 상태일 때만 미리보기 자동 스크롤을 켠다.
- `src/components/preview/MarkdownPreview.tsx`
  - `previewHtml`을 렌더링하고 `[data-source-line-start]` 요소들을 anchor로 수집한다.
  - `activeLine`, `previewHtml`, `layoutVersion`, `ResizeObserver` 변화에서 `syncPreviewScroll()`을 호출한다.
- `src/lib/preview-scroll.ts`
  - 활성 줄에 가장 가까운 preview anchor를 찾는다.

## 제안 설계

### 1. 스크롤 트리거 분리

`MarkdownPreview`는 preview DOM이 바뀔 때 anchor 목록만 갱신한다. `previewHtml` 변경 effect는 `syncPreviewScroll()`을 직접 호출하지 않는다. 자동 스크롤은 기본적으로 `activeLine` 변경 effect에서만 예약한다.

레이아웃 변화는 별도 reason으로 처리한다. `layoutVersion` 변경이나 ResizeObserver 콜백은 anchor가 현재 viewport에서 완전히 벗어난 경우에만 보정할 수 있지만, 초기 구현에서는 불필요한 움직임을 피하기 위해 직접 스크롤하지 않는다.

### 2. 줄 단위가 아닌 anchor 단위 중복 방지

현재 `lastSyncedLineRef`는 같은 줄 중복만 막는다. 입력 중 markdown이 재렌더되면 이 값이 초기화되어 같은 줄도 다시 스크롤될 수 있다.

새 기준은 `lineStart:lineEnd` 형태의 anchor key다. 활성 줄이 같은 anchor 범위 안에 있으면 line number가 바뀌어도 스크롤하지 않는다. 예를 들어 문단이 `12-16` 줄에 매핑되어 있으면, 커서가 12, 13, 14, 15, 16줄 사이를 오가도 미리보기 위치는 유지된다.

### 3. 스크롤 예약과 DOM 측정 안정화

자동 스크롤은 즉시 DOM을 측정하지 않고 `requestAnimationFrame`으로 예약한다. 같은 frame 안에서 여러 activeLine 변경이 발생하면 이전 예약을 취소하고 최신 activeLine만 처리한다. 이 방식은 React 렌더와 `dangerouslySetInnerHTML` 반영 직후 layout 측정을 안정화한다.

### 4. 수동 스크롤 존중

미리보기 컨테이너에 `scroll`, `wheel`, pointer 기반 스크롤 신호를 감지한다. 프로그램이 발생시킨 스크롤과 사용자가 발생시킨 스크롤을 구분하기 위해 `isProgrammaticScrollRef`를 둔다. 수동 스크롤이 감지되면 짧은 시간 동안 자동 추적을 중단한다.

자동 추적 재개 조건은 보수적으로 둔다.

- activeLine이 마지막으로 동기화한 anchor와 다른 anchor로 이동한다.
- suspend 시간이 지난 뒤 activeLine 변경이 다시 발생한다.
- 에디터 focus가 다시 들어오고 현재 anchor가 viewport 밖에 있다.

### 5. 스크롤 behavior 정책

입력 중 자동 추적은 `behavior: "auto"`를 사용한다. `smooth`는 애니메이션이 중첩될 수 있어 타이핑 중 흔들림을 키운다. 향후 TOC 클릭 또는 명시적 heading 이동에서 preview를 함께 이동시키는 기능을 추가할 경우, 그 경로에서만 `smooth`를 사용할 수 있도록 `scrollPreviewTo(container, top, behavior)` 형태로 함수 경계를 바꾼다.

## 파일별 책임

- `src/lib/preview-scroll.ts`
  - active line에 대응하는 anchor 탐색.
  - anchor key 생성.
  - viewport 안에서 anchor가 안정 영역에 들어와 있는지 판단하는 순수 helper를 둘 수 있다.
- `src/components/preview/MarkdownPreview.tsx`
  - DOM ref, anchor 목록, pending animation frame, 수동 스크롤 suspend 상태를 관리한다.
  - `activeLine` 변경을 자동 스크롤의 주 트리거로 삼는다.
  - `previewHtml` 변경은 anchor 목록만 갱신한다.
- `src/components/preview/MarkdownPreview.test.tsx`
  - 같은 anchor 내부 입력, previewHtml 재렌더, 다른 anchor 이동, 수동 스크롤 suspend, behavior 정책을 검증한다.

## 테스트 전략

- `preview-scroll` 순수 helper는 anchor key와 탐색 규칙을 단위 테스트로 검증한다.
- `MarkdownPreview`는 jsdom에서 `getBoundingClientRect`, `clientHeight`, `scrollHeight`, `scrollTo`, `requestAnimationFrame`을 제어해 스크롤 호출 여부와 behavior를 검증한다.
- 기존 링크 열기 테스트와 layoutVersion 관련 테스트가 새 정책과 충돌하면 새 정책에 맞게 기대값을 바꾼다.
- 변경 후 `npm run test -- src/lib/preview-scroll.test.ts src/components/preview/MarkdownPreview.test.tsx`를 먼저 실행하고, 최종적으로 `npm run test`를 실행한다.

## 의사결정

스크롤 비율 기반 동기화는 이번 범위에서 제외한다. 비율 동기화는 문서 탐색 경험에는 유용할 수 있지만, source markdown과 rendered preview의 높이 분포가 다르면 정확도가 낮고, 이미지나 코드블록 로딩에 따라 계속 보정이 필요하다. 현재 문제는 편집 중 active line 기반 자동 스크롤이 과도하게 실행되는 것이므로, 같은 모델을 더 안정적으로 만드는 편이 비용과 효과의 균형이 좋다.

## 성공 기준

- 같은 anchor 블록 안에서 타이핑할 때 미리보기 `scrollTo`가 반복 호출되지 않는다.
- 활성 줄이 다른 anchor 블록으로 이동하고 그 anchor가 안정 영역 밖에 있으면 미리보기가 한 번 이동한다.
- preview HTML 재렌더만으로는 미리보기가 이동하지 않는다.
- 사용자가 preview를 직접 스크롤한 직후에는 자동 스크롤이 개입하지 않는다.
- 입력 중 자동 스크롤 호출은 `behavior: "auto"`를 사용한다.
