# Preview Performance Migration

## 개요

이번 작업은 에디터 패널의 검색 기능 복구에서 시작해, 긴 markdown 문서에서 발생하던 편집 반응성 저하를 단계적으로 줄이고, 최종적으로 preview 렌더러를 더 가벼운 구조로 교체하는 흐름으로 진행됐다.

핵심 목표는 세 가지였다.

1. CodeMirror 기본 검색과 편집 기능 회귀 복구
2. 입력 경로에서 불필요한 전체 문자열 동기화와 파생 계산 경쟁 완화
3. preview 렌더링 비용이 큰 구간을 더 단순한 파서/렌더 구조로 교체

## 문제 인식

처음 확인된 증상은 두 가지였다.

- 에디터 패널에서 CodeMirror 검색 UI가 더 이상 열리지 않음
- 문서 길이가 조금만 길어져도 타이핑 반응성이 눈에 띄게 저하됨

원인 분석 결과, 검색 기능 회귀와 성능 문제는 서로 다른 층위에 있었다.

### 검색 기능 회귀

- `MarkdownEditor`가 `basicSetup`에서 `minimalSetup`으로 바뀌면서 검색 keymap과 관련 확장이 빠졌다.
- 그 결과 `Cmd/Ctrl+F`가 CodeMirror 검색 패널을 열지 못했다.

### 편집 반응성 저하

정적 코드 리뷰와 실제 체감 비교를 통해 다음 경로가 병목 후보로 정리됐다.

1. 에디터 입력마다 문서 전체를 문자열로 다시 materialize하는 경로
2. footer 문서 메타 계산이 같은 markdown 문자열을 다시 전체 순회하는 경로
3. preview가 전체 markdown을 다시 파싱해 React tree를 구성하는 경로
4. TOC가 markdown 전체를 다시 스캔하는 경로

실제 사용에서 preview와 TOC 패널을 닫으면 반응성이 즉시 좋아졌기 때문에, 최종 병목은 `preview + TOC`의 파생 작업 경쟁으로 좁혀졌다.

## 진행한 개선 단계

### 1. CodeMirror 기본 기능 복구

먼저 사용자 체감 버그였던 검색 기능을 복구했다.

- `search()`, `searchKeymap`, `highlightSelectionMatches()`를 다시 연결해 검색 패널을 복구
- `bracketMatching()`, `foldGutter()`도 함께 복구
- 관련 테스트 추가

이 단계는 `minimalSetup` 기반을 유지하면서 필요한 기능만 선택적으로 되살리는 방향으로 정리했다.

### 2. workspace 파생 계산 지연

다음 단계에서는 에디터 입력과 직접 경쟁하던 파생 계산을 분리했다.

- `EditorWorkspace`에서 preview, TOC, footer 메타를 상위 컴포넌트의 직접 구독에서 분리
- preview에는 deferred 구독 뒤에 debounce를 적용
- 문서 메타 계산은 더 가벼운 단일 순회 형태로 정리

이 단계의 목적은 타이핑 중 상위 레이아웃 전체가 같이 흔들리는 경로를 줄이는 것이었다.

### 3. document store lazy serialization

입력 경로에서 전체 markdown 문자열을 매번 즉시 store로 복사하던 구조도 손봤다.

- `documentStore`를 단순 string 저장소에서 `revision + markdown source reader` 구조로 변경
- 에디터는 매 키스트로크마다 문자열을 push하지 않고 revision만 알림
- 실제 markdown 직렬화는 preview, 저장, 메타 계산 등 소비 시점에 수행
- dirty 판정도 markdown 비교가 아니라 revision 비교로 변경

이 단계는 입력 경로의 불필요한 동기 문자열 복사를 줄이는 데 의미가 있었다. 다만 실제 체감 병목의 주원인은 아니라는 것도 이후 확인됐다.

## 시도했지만 버린 접근

### preview worker 오프로딩 시도

preview 비용이 큰 만큼, 처음에는 worker로 parsing을 넘기는 방향을 시도했다.

시도한 구조는 다음과 같았다.

- worker 내부에서 markdown parsing + HTML 생성
- 메인 스레드는 완성된 HTML만 렌더
- preview 클릭 동작은 이벤트 위임 유지

### 실패 원인

실제 로그 계측과 번들 확인 결과, worker 자체의 메시지 전달은 정상적이었지만 내부 렌더 파이프라인이 `document`를 참조하며 실패했다.

확인된 현상:

- worker 생성 및 `postMessage`는 정상
- preview 응답이 오지 않고 timeout 발생
- worker error 로그에 `ReferenceError: Can't find variable: document`
- 번들된 worker 코드 안에 `document.createElement(...)` 포함

결론적으로 문제는 worker 통신이 아니라, 당시 preview 스택이던 `remark/rehype` 조합 또는 그 하위 의존성 중 일부가 DOM 존재를 전제로 한다는 점이었다.

### 의사결정

여기서 선택지는 세 가지였다.

1. DOM polyfill을 worker에 억지로 넣는다
2. worker-safe markdown renderer 스택으로 완전히 교체한다
3. worker 시도는 접고 preview 렌더러를 더 단순한 구조로 바꾼다

이번 작업에서는 3번을 선택했다.

이유는 다음과 같다.

- polyfill은 유지보수 비용이 높고 불안정하다.
- worker-safe renderer를 새로 짜는 것은 별도 프로젝트에 가깝다.
- 당장 필요한 것은 체감 성능 개선과 기능 유지였고, 이를 위해서는 preview 파이프라인 단순화가 가장 현실적이었다.

## 최종 선택: markdown-it 기반 preview renderer

최종적으로 preview는 `ReactMarkdown + remark-gfm + rehype-raw`에서 `markdown-it` 기반 HTML renderer로 교체했다.

핵심 설계는 다음과 같다.

1. `markdown-it`으로 markdown을 HTML 문자열로 변환
2. 생성된 HTML을 허용 태그 기반으로 sanitize
3. 링크, heading id, 외부 미디어, details/input 같은 ClipMark 고유 정책을 후처리 단계에서 반영
4. preview 컴포넌트는 HTML 표시와 이벤트 위임만 담당

### 왜 이 구조를 선택했는가

- React element tree를 크게 만드는 비용을 줄일 수 있다.
- preview를 “렌더러”와 “표시 컴포넌트”로 분리할 수 있다.
- 기존 링크/미디어 정책을 renderer 레벨에서 일관되게 다룰 수 있다.
- 추후 worker-safe renderer로 다시 나아갈 때도 경계가 더 명확해진다.

## 실제 수정 내용

### preview 렌더 경로

- `src/components/preview/MarkdownPreview.tsx`
  - `ReactMarkdown` 제거
  - `renderPreviewHtml()` 호출 결과를 `dangerouslySetInnerHTML`로 표시
  - 링크/버튼 클릭과 키보드 동작을 이벤트 위임으로 처리

- `src/lib/preview-renderer.ts`
  - `markdown-it` 기반 HTML renderer 추가
  - 허용 태그 whitelist 적용
  - 링크 URI 해석
  - heading slug 부여
  - 외부 이미지/비디오/오디오 auto-load 정책 유지
  - task list input, details/summary 처리

### 의존성 정리

- 추가
  - `markdown-it`
  - `markdown-it-task-lists`
  - `@types/markdown-it`

- 제거
  - `react-markdown`
  - `remark-gfm`
  - `rehype-raw`

### 테스트 보강

- `src/lib/preview-renderer.test.ts`
  - heading id
  - 상대 링크 해석
  - 외부 이미지 media card
  - auto-load inline media
  - 상대 경로 미디어 해석
  - task list checkbox
  - blocked link sanitize
  - raw HTML sanitize

- `src/components/preview/MarkdownPreview.test.tsx`
  - 링크 click 위임
  - media card button click 위임
  - 링크 keyboard 위임

- 기존 editor/workspace 테스트도 유지

## 체감 개선 포인트

이번 작업에서 사용자 체감에 영향을 준 지점은 크게 세 가지였다.

### 1. preview 렌더 비용 감소

기존에는 markdown 변경 시 ReactMarkdown이 큰 React tree를 구성했다. 현재는 renderer가 HTML 문자열을 만들고, preview 컴포넌트는 표시만 담당하므로 렌더 경로가 더 짧아졌다.

### 2. 입력과 파생 계산의 경쟁 완화

preview, TOC, footer 메타 계산을 상위 입력 경로와 분리하고, preview에는 debounce를 적용해 타이핑과 같은 우선순위로 즉시 경쟁하지 않도록 조정했다.

### 3. 불필요한 eager serialization 제거

document store를 lazy serialization 구조로 바꾸면서, 에디터 입력마다 전체 markdown 문자열을 즉시 외부 상태로 복사하던 비용을 줄였다.

## 개선 효과 정리

체감 기준으로는 다음과 같은 개선이 있었다.

- 에디터 검색 기능 회귀 복구
- 괄호 매칭과 fold gutter 복구
- preview와 TOC가 켜져 있을 때의 타이핑 반응성 개선
- 비교적 큰 문서에서도 preview가 기존과 유사한 출력 품질 유지
- preview 파이프라인이 더 단순해져 이후 최적화 지점이 명확해짐

## 남은 과제

이번 작업으로 가장 큰 체감 병목은 줄였지만, 완전히 끝난 것은 아니다.

남은 후보는 다음과 같다.

- TOC 계산도 필요하면 더 강한 debounce 또는 incremental cache 검토
- preview 갱신에 `requestIdleCallback` 같은 idle scheduling 추가 검토
- 매우 큰 문서 기준의 수동 성능 체크 시나리오 정리
- 향후 필요 시 worker-safe renderer로 다시 확장 가능한지 별도 검토

## 관련 커밋

- `0ad4540` `fix(editor): 코드미러 검색과 기본 편집 기능 복구`
- `8b6fcff` `perf(workspace): 미리보기와 문서 메타 계산 지연`
- `9d11145` `perf(editor): 문서 저장소를 lazy serialization 구조로 전환`
- `eceed2e` `perf(preview): markdown-it 기반 렌더러로 미리보기 비용 축소`
- `585f968` `test(preview): 파서 교체 후 주요 렌더 케이스를 고정`

## 검증

대표적으로 실행한 검증은 다음과 같다.

- `npm run test -- src/components/editor/MarkdownEditor.test.ts`
- `npm run test -- src/lib/document-store.test.ts src/lib/document-metrics.test.ts src/hooks/useDebouncedValue.test.tsx src/components/editor/MarkdownEditor.test.ts src/components/workspace/EditorWorkspace.test.tsx`
- `npm run test -- src/lib/preview-renderer.test.ts src/components/preview/MarkdownPreview.test.tsx src/components/workspace/EditorWorkspace.test.tsx src/components/editor/MarkdownEditor.test.ts`
- `npm run test -- src/lib/preview-renderer.test.ts src/components/preview/MarkdownPreview.test.tsx`
- `npm run build`
