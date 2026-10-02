# Tauri + Apple Liquid Glass 실행 검증

검증일: 2026-10-02

## 결론

Tauri를 유지하면서 WebView 위에 실제 Apple Liquid Glass 조작부를 배치할 수 있다. 전체 네이티브 재작성은 Liquid Glass 적용의 필수 조건이 아니다.

별도 검증 앱에서 macOS의 `NSGlassEffectView` 두 개 안에 네이티브 `NSButton`을 배치했다. CSS 블러나 유사 재질을 사용한 결과가 아니다. 런타임 지원 응답은 `supported: true`, `fallback: false`였고, 뷰 트리에서 실제 `NSKVONotifying_NSGlassEffectView` 인스턴스를 확인했다.

이 결과는 Tauri + 부분 네이티브 UI 방식의 가능성을 검증한다. 현재 ClipMark에 통합했거나 최종 디자인·성능·배포 적합성을 검증한 결과는 아니다.

## 환경과 격리

- macOS 26.6.2, Xcode 27.0.
- Tauri 2.11.1 및 기존 ClipMark Cargo 잠금 버전을 기준으로 빌드.
- 배포된 `tauri-plugin-system-components` 0.1.8 사용.
- 검증 소스: `/private/tmp/clipmark-liquid-glass-spike`.
- 실행 앱: `/private/tmp/ClipMarkGlassProbe.app`.
- 빌드 출력: `/private/tmp/clipmark-liquid-glass-target`.
- 런타임 로그: `/private/tmp/clipmark-glass-runtime.log`.
- 제품 소스·의존성·잠금 파일은 변경하지 않음. 검증 코드는 임시 실험이며 제품 구현으로 채택하지 않음.

검증 창은 불투명한 WebView 본문 위에 네이티브 조작부를 올렸다. `transparent: true`와 `macOSPrivateApi: true` 설정을 사용하지 않았다. 이는 창 배경 전체에 효과를 적용하는 방식과 다르다. 플러그인 전체의 비공개 API·배포 적합성 감사가 완료됐다는 의미는 아니다.

## 확인한 동작

| 항목 | 결과 |
| --- | --- |
| 실제 Apple Liquid Glass 인스턴스 | 두 개 확인, 일반 vibrancy 대체 효과 아님 |
| 좌하단 경로 복사 버튼 | 네이티브 클릭 이벤트 수신, 테스트 전체 경로 복사 성공 |
| 우하단 미리보기 버튼 | 네이티브 클릭 이벤트로 별도 Tauri 창 생성 |
| 900 × 680 창 | 두 조작부가 창 내부에 위치하며 겹치지 않음 |
| 420 × 460 창 | 경로 영역 축소 후 두 조작부가 창 내부에 위치하며 겹치지 않음 |
| 경로 복사 후 편집 | 원문 입력 가능, 편집 요소 포커스 유지 |
| 미리보기 열기 | 편집창의 WebView·원문 포커스 유지 |
| 편집창에서 ⌥⌘P | 미리보기 닫힘, 편집 포커스 복귀 |
| 미리보기 창에서 ⌥⌘P | 미리보기 닫힘, 연결된 편집창의 원문 포커스 복귀 |

좌표 검증은 실제 네이티브 뷰 트리를 이용했다. 일반 크기에서 경로 캡슐은 `[16, 16, 330, 44]`, 미리보기 캡슐은 `[784, 16, 100, 44]`였다. 좁은 크기에서는 각각 `[16, 16, 270, 44]`, `[304, 16, 100, 44]`로 배치됐다. 좌표 원점은 AppKit 기준 좌하단이다.

검증 앱의 미리보기 본문은 고정된 샘플이다. 실제 Markdown 렌더링, 문서 동기화와 커서 추적은 이번 실험에 포함하지 않았다. 편집 요소도 최소 WebView 텍스트 영역이며 기존 CodeMirror와의 통합은 후속 검증 대상이다.

## 발견한 제약

### 창별 대상 지정

배포 소스 `src/desktop/mod.rs`의 `window()`는 `main` 창을 우선 선택하며, 없으면 첫 WebView 창을 선택한다. 일반 조작부 생성·갱신은 이 함수에 의존한다. 클릭 이벤트도 앱 단위로 전달된다.

따라서 파일마다 편집창이 존재하는 ClipMark에는 그대로 연결하지 않는다. 문서 창을 명시적으로 지정하고 이벤트를 해당 창으로 연결하는 보완이 필요하다. 플러그인의 지원 여부와 ClipMark에 수정 없이 적용 가능한지를 구분해야 한다.

### 조작부 표시와 크기

- 아이콘과 텍스트를 동시에 지정한 초기 버튼은 아이콘만 표시됐다. 이 실험은 텍스트 버튼으로 검증했으며, 제품에서는 버튼 표현을 별도로 다듬어야 한다.
- 기본 네이티브 버튼 테두리와 외부 유리 캡슐이 겹쳐 보인다. 현재 결과는 기술 검증이며 최종 디자인 시안이 아니다.
- 좁은 창에서 캡슐 크기는 조절됐지만 긴 경로의 폴더 우선 축약·말줄임은 구현하지 않았다. 실제 조작부 구현에 포함해야 한다.
- 키보드 Tab 탐색·VoiceOver·다크 모드·구형 macOS·여러 모니터·실제 파일별 다중 창과 제품 성능은 미검증이다.

### 빌드 버전

최초 격리 앱에서 Tauri 2.11.1과 자동 선택된 더 최신 하위 패키지가 충돌했다. 기존 ClipMark Cargo.lock을 검증 앱의 출발점으로 사용하여 빌드에 성공했다. 제품의 잠금 파일은 수정하지 않았다.

## 재현

빌드:

```sh
cargo build --offline --manifest-path /private/tmp/clipmark-liquid-glass-spike/Cargo.toml --target-dir /private/tmp/clipmark-liquid-glass-target
```

검증 앱을 실행하고 다음 동작을 확인한다.

1. 좌하단 경로 복사 클릭 후 원문 입력.
2. 우하단 버튼으로 미리보기 열기, 편집창 포커스 유지 확인.
3. ⌥⌘P로 닫기.
4. 검증 전용 ⌥⌘1로 420 × 460, ⌥⌘2로 900 × 680 크기 전환.
5. 미리보기를 다시 열고 Window 메뉴에서 미리보기 창을 선택한 뒤 ⌥⌘P로 닫기.

로그 회귀 확인:

```sh
python3 /private/tmp/clipmark-liquid-glass-spike/verify.py /private/tmp/clipmark-glass-runtime.log
```

기본 효과 감지, 실제 두 유리 뷰, 두 크기에서 비겹침, 네이티브 편집 포커스, 복사·입력·토글 로그를 assert로 검사한다. 미리보기 창에서 닫고 원문으로 복귀하는 결과는 네이티브 접근성 상태로 별도 확인했다.

임시 디렉터리는 OS 정리 대상이다. 이번 실험 소스는 제품에 보존할 코드가 아니라 재현·판단용 자료다.

## 방향 제안

Tauri 유지 + 문서 창별 작은 네이티브 Liquid Glass 조작부를 첫 구현 후보로 삼는다. 전체 창을 유리 배경으로 만드는 라이브러리를 추가하는 방향은 이번 요구에 맞지 않는다.

커뮤니티 플러그인을 그대로 제품 의존성으로 확정하지 않는다. 실제 구현 계획에서 기존 macOS 어댑터를 활용한 작은 조작부 구현과 플러그인 보완 비용을 비교한다. 기존 편집·렌더링 로직은 유지하며, 네이티브 창별 연결과 접근성까지 검증한 뒤 구현 방식을 확정한다.

## 자료

- [Apple NSGlassEffectView](https://developer.apple.com/documentation/appkit/nsglasseffectview)
- [Tauri 네이티브 창 연동](https://v2.tauri.app/learn/window-customization/)
- [플러그인 배포 문서](https://docs.rs/tauri-plugin-system-components/0.1.8/tauri_plugin_system_components/)
- [플러그인 소스와 설명](https://github.com/sosweetham/tauri-plugin-system-components)
