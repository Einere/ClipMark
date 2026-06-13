# ClipMark

ClipMark는 웹에서 복사한 내용을 로컬 Markdown 파일로 빠르게 정리하고 저장하기 위한 가벼운 macOS 중심 에디터입니다.

복잡한 문서 툴이나 클라우드 노트 앱 대신, `.md` 파일을 직접 다루고 싶은 사람을 위한 도구입니다. 특히 개발 친화적인 맥 유저, 웹 아카이빙을 자주 하는 사람, “그냥 빠르고 단순한 MD 에디터”를 원하는 사용자에게 맞춰져 있습니다.

## 이런 분에게 맞습니다

- 웹 글, 문서, 참고 자료를 복사해서 Markdown으로 보관하고 싶은 사람
- 파일 기반 워크플로를 선호하는 사람
- Git과 잘 맞는 단순한 `.md` 파일을 다루고 싶은 사람
- 편집기와 렌더된 결과를 나란히 보면서 정리하고 싶은 사람

## 핵심 특징

- 웹에서 복사한 HTML을 Markdown 친화적으로 정리해서 붙여넣기
- 편집기와 Preview를 나란히 보는 분할 레이아웃
- 헤딩 기반 목차 패널
- `.md`, `.markdown`, `.txt` 파일 열기
- 로컬 파일로 저장, 다른 이름으로 저장 지원
- 최근 파일 목록 제공
- 현재 문서 경로 표시 및 클릭으로 경로 복사
- 외부 링크는 앱 밖에서 열기
- 이미지, 오디오, 비디오는 외부 열기 또는 자동 로드 선택 가능
- 저장되지 않은 변경 사항 표시 및 닫기 전 확인

## 사용 흐름

1. 새 문서를 만들거나 기존 Markdown 파일을 엽니다.
2. 브라우저나 다른 앱에서 내용을 복사해 붙여넣습니다.
3. ClipMark가 HTML을 정리해 Markdown에 맞는 형태로 변환합니다.
4. Preview와 목차를 보면서 문서를 다듬습니다.
5. 로컬 `.md` 파일로 저장합니다.

## 자주 쓰는 단축키

- `Cmd+N`: 새 문서
- `Cmd+O`: 파일 열기
- `Cmd+S`: 저장
- `Cmd+Shift+S`: 다른 이름으로 저장
- `Option+Cmd+P`: Preview 토글
- `Option+Cmd+T`: 목차 토글
- `Option+Cmd+C`: 현재 파일 경로 복사

## macOS에서 실행하기

현재 이 저장소는 macOS 우선 Tauri 앱입니다. 가장 확실한 사용 방법은 소스에서 실행하는 방식입니다.

### 준비물

- macOS 13 이상
- Node.js
- Rust toolchain
- Xcode Command Line Tools

### 실행

```bash
npm install
npm run tauri:dev
```

개발 중 프론트엔드만 확인하려면 아래 명령도 사용할 수 있습니다.

```bash
npm run dev
```

## 배포

GitHub Actions로 CI와 GitHub Release 배포를 구성합니다.

- Pull request와 `main` 브랜치 push에서는 프론트엔드 테스트, 프론트엔드 빌드, Rust 체크를 실행합니다.
- `v*` 형식의 태그를 push하면 macOS, Linux, Windows용 Tauri 번들을 빌드하고 GitHub Release draft에 업로드합니다.
- macOS 번들은 Developer ID로 서명하고, `.app`과 `.dmg`를 공증한 뒤 stapling합니다.
- GitHub Actions의 `Release` 워크플로를 수동 실행해 특정 태그로 릴리스를 만들 수도 있습니다.

릴리스 전 GitHub 저장소 secrets에 아래 값이 있어야 합니다.

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

새 버전을 배포할 때는 버전 bump 커밋과 태그를 먼저 만듭니다. 이 스크립트는 `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`의 버전을 같은 값으로 맞추고 `chore(release): vX.Y.Z` 커밋과 `vX.Y.Z` 태그를 생성합니다.

```bash
npm run release:prepare -- 0.1.2
git push origin HEAD v0.1.2
```

릴리스 워크플로는 태그 버전과 세 버전 파일이 일치하지 않으면 실패합니다. 따라서 태그를 직접 만들기보다 `npm run release:prepare -- <version>`을 사용하는 것을 권장합니다.

워크플로가 끝나면 GitHub Releases에서 draft를 확인하고 릴리스 노트와 첨부 파일을 검토한 뒤 게시합니다.

## 현재 범위

ClipMark는 의도적으로 작습니다. 계정, 클라우드 동기화, 협업, 데이터베이스형 문서 관리, 블록 에디팅 같은 기능은 포함하지 않습니다. 문서는 사용자의 로컬 파일이며, 앱은 그 파일을 빠르게 열고 정리하고 저장하는 데 집중합니다.

## 상태와 주의사항

- macOS 중심으로 설계되어 있습니다.
- 복잡한 표나 인터랙티브 웹 레이아웃은 붙여넣기 후 수동 정리가 필요할 수 있습니다.
- HTML/PDF export, 멀티탭, 검색 같은 기능은 아직 포함되어 있지 않습니다.

ClipMark의 목표는 “복사 → 붙여넣기 → 정리 → 저장” 흐름을 최대한 가볍게 만드는 것입니다.
