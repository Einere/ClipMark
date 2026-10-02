# 재단장 코드 리뷰

범위: `e8296ef..00d89bc`의 세 커밋. 수정 없이 정확성, React 및 구조, 복잡성, UI 감사 네 관점의 서브에이전트 결과를 교차 검토했다.

적용 스킬: Vercel React Best Practices, Frontend Clean Code, Ponytail Review, Impeccable의 product register와 technical audit. 사용자 결정인 macOS 26 전용, 실제 Apple Liquid Glass, 미색, 본문 최대 폭 없음은 결함으로 취급하지 않았다.

## 수정할 발견 사항

### P1 — 미리보기 메뉴가 편집창 메뉴 콜백을 덮어쓴다

위치: `src/components/preview/PreviewWindow.tsx:21–26`, 공유 메뉴 생성은 `src/lib/menu.ts`.

미리보기도 편집창과 같은 메뉴 ID로 콜백을 등록한다. 설치된 Tauri 2.11.1 메뉴 플러그인은 앱 전체의 `MenuId → Channel` 맵에 콜백을 보관하고 새 등록으로 기존 값을 교체한다. 포커스 동기화는 앱 메뉴를 교체하지만 콜백 채널은 다시 등록하지 않는다. 미리보기를 닫으면 기존 편집창 메뉴가 파괴된 미리보기의 채널을 참조할 수 있다. 다른 문서가 열려 있을 때는 액션 소유자가 잘못될 수도 있다.

실제 테스트 앱에서 미리보기의 View → Preview로 창을 닫은 후, 다른 편집창을 활성화해 View → Table of Contents를 실행했다. 목차가 계속 표시되어 메뉴 액션이 수행되지 않았다. 플러그인 구현과 일치하는 결과다. 기존 다중 편집창에도 같은 ID 충돌 여지가 있지만 새 미리보기는 편집창 하나의 정상 동선에서도 문제를 유발한다.

최소 수정: 각 창 label을 메뉴 ID 접두사로 사용한다. 최근 파일의 동적 메뉴 ID도 함께 분리한다. 검증: 미리보기 열기·닫기 뒤 편집창의 Save/Preview/TOC 메뉴 및 두 문서의 액션 소유자.

### P2 — 읽기 전용 미리보기에서 Copy와 Select All까지 막는다

위치: `src/hooks/usePreviewWindow.ts:34`.

미리보기 스냅샷의 `canUseEditMenu: false`는 `menu-sync.ts`에서 Edit 서브메뉴 전체를 비활성화한다. 이 메뉴에는 Copy와 Select All도 있어, 렌더링된 본문을 읽고 복사하려는 사용자가 메뉴를 사용할 수 없다. 네이티브 접근성 트리에서도 미리보기의 Edit 메뉴가 비활성 상태였다. ⌘C 자체의 동작 여부는 별도로 검증하지 않았다.

최소 수정: 읽기 전용 창에서 Cut/Paste/Undo 등 수정 액션만 비활성화하고 Copy/Select All은 사용할 수 있게 한다.

## 후보 및 낮은 우선순위 관찰

- 테마: `App.tsx:181`과 `liquid_glass.rs:113`은 앱 테마를 네이티브 appearance에 전달하지 않는다. DOM에만 테마가 적용되므로 시스템과 앱 강제 테마가 다르면 조작부 분위기가 달라질 수 있다. 반대 테마의 실제 화면 검증 후 확정한다.
- 웹 폴백: `EditorWorkspace.tsx:70`의 내장 미리보기는 `editSequence`를 전달하지 않아 수동 스크롤 후 추적이 재개되지 않는다. macOS 26 별도 창에는 해당하지 않아 필수 수정 목록에서 제외했다.
- 테스트 연결: `preview-window-state.ts:16`의 `shouldResumePreview`는 테스트만 호출하고 실제 비교는 `MarkdownPreview.tsx:204`에 복제돼 있다. 실제 조건에서 기존 helper를 사용하면 테스트가 제품 정책을 직접 검증한다. 테스트 삭제는 권하지 않는다.
- IPC: 커서 스냅샷마다 캐시된 본문 전체를 다시 전송한다. QA 예제 스냅샷은 약 86.9KB지만 직렬화 평균 약 0.04ms였고 네이티브 왕복 비용을 측정하지 않았다. 성능 결함으로 단정하지 않는다.

## 긍정 및 검증

- 본문 HTML 파싱은 메모화돼 있어 커서 이동마다 다시 실행하지 않는다. 최신 콜백 참조와 비동기 리스너 정리도 유지한다.
- TOC 접근성 landmark, 검색 포커스 표시, reduced-motion, 네이티브 경로 말줄임은 적용돼 있다.
- Impeccable detector의 workspace/toc/preview 소스 스캔 결과는 빈 목록이었다. 실제 Apple Liquid Glass를 장식용 CSS 유리와 혼동하지 않았다.
- Ponytail: 요구사항을 제거하지 않고 안전하게 줄일 큰 구조는 없었다. `net: -0 lines possible.`
- 전체 프론트엔드 자동 테스트 239개가 통과했다. 이 결과는 네이티브 메뉴 채널 충돌을 검증하지 않는다.

권장 순서: P1 메뉴 ID 분리 → P2 읽기 전용 메뉴 권한 분리 → 네이티브 테마 검증 → Impeccable polish/audit 재확인. 이번 리뷰에서는 제품 코드를 수정하지 않았다.

## 후속 수정 및 검증

사용자 요청으로 P1과 미리보기 복사 메뉴를 수정했다.

- 공유 고정 메뉴 ID를 제거하고 Tauri/muda의 프로세스 전체 고유 ID 생성을 사용한다. 최근 파일과 목록 지우기 메뉴도 포함한다. 별도 ID 접두사 계층은 필요하지 않았다.
- 미리보기에서 Edit 메뉴를 활성화한다. 본문은 계속 읽기 전용이며 Copy·Select All을 메뉴에서 사용할 수 있다.
- 두 메뉴 컨트롤러의 콜백을 앱 전체 ID 맵으로 모델링한 회귀 테스트를 추가했다. 두 번째 창의 메뉴 생성·종료 뒤 첫 번째 창의 Save·TOC·최근 파일·최근 목록 지우기 콜백이 유지되는지 확인한다.
- 전체 자동 테스트 240개 통과. 서브에이전트 재검토에서도 누락된 고정 ID 경로를 찾지 못했다.
- 별도 ClipMarkMenuQA 앱에서 미리보기 Edit → Copy/Select All 활성화를 확인했다. 미리보기 생성·종료 후 편집창 목차를 단축키로 숨기고 View → Table of Contents 클릭으로 다시 표시하는 실제 메뉴 동작도 확인했다.
- `npm run tauri:build -- --bundles app` 성공. 기본 전체 번들 빌드는 앱 컴파일 후 DMG 포장 단계에서 실패했으며, 이번 검증은 성공한 `.app` 번들을 사용했다.

테마 후보 및 웹 폴백 관찰은 이번 수정 범위에 포함하지 않았다.
