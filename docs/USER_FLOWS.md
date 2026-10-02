# USER_FLOWS

Product: `ClipMark`

macOS 앱의 재단장 흐름이다. 지원 OS는 macOS 26 이상이며 상세 기준은 [CLIPMARK_REDESIGN.md](./CLIPMARK_REDESIGN.md)를 따른다. 웹 개발 환경에는 기존 분할 미리보기를 유지한다.

## Primary Flow: Archive Web Content

1. The user finds useful content on a web page.
2. The user copies all or part of the page.
3. The user opens the app and creates a new document.
4. The user pastes the content into the editor.
5. The app converts clipboard content into clean Markdown-oriented text.
6. 필요하면 ⌥⌘P 또는 우하단 Liquid Glass 버튼으로 별도 미리보기 창을 연다. 편집 포커스는 유지한다.
7. The user edits headings, links, lists, quotes, and code blocks as needed.
8. The user uses the table of contents to navigate long sections.
9. The user saves the document as a local `.md` file.

## Secondary Flow: Update an Existing Archive

1. The user opens an existing `.md` file.
2. 파일별 독립 편집창에 원문을 연다. 같은 파일이 이미 열려 있으면 기존 편집창을 활성화한다.
3. The user edits or appends new content.
4. The user verifies structure with the preview and TOC.
5. The user saves changes.

## Tertiary Flow: Prepare a Shareable Output

1. The user finishes editing an archive document.
2. The user checks visual output in preview.
3. The user exports the document as HTML or PDF if supported.
4. The user uses the export for reading, sharing, or reference.

## 다른 파일명으로 저장

1. ⇧⌘S 또는 File → Save As로 저장 대화상자를 연다.
2. 새 이름과 경로를 선택하여 현재 본문을 저장한다. 원본 파일은 유지한다.
3. 성공하면 창 제목·경로 복사·미리보기 제목에 새 경로를 반영한다. 취소하거나 실패하면 원래 편집 세션을 유지한다.

## 미리보기 읽기와 편집 재개

1. 새 미리보기 창은 편집창과 겹치지 않게 옆에 배치한다. 다른 앱의 창은 조사하지 않는다.
2. 편집 커서·입력에 해당하는 블록을 따라간다. 이미 보이는 블록은 불필요하게 움직이지 않는다.
3. 미리보기를 직접 스크롤하면 추적을 중단한다. 시간이나 포커스 변경만으로 재개하지 않는다.
4. 원문에서 커서를 옮기거나 입력하면 추적을 재개한다. 목차 선택도 원문과 열린 미리보기에 반영한다.
5. 양쪽 창에서 ⌥⌘P로 닫을 수 있다. 미리보기에서 닫으면 편집창 원문으로 포커스를 돌린다.
6. 다시 열면 기본 크기의 새 창을 만들고 최신 내용·커서를 반영한다. 이전 창 위치·크기·스크롤은 복원하지 않는다.
7. 편집창 실제 닫기에 연결해 미리보기도 닫는다. 저장 확인에서 Cancel 또는 저장 실패 시 두 창을 유지한다.

## 경로 복사와 목차

- 좌하단 경로 버튼 또는 ⌥⌘C는 전체 경로를 복사한다. 화면 표시는 말줄임하며 우하단 버튼 영역을 침범하지 않는다. 전체 경로 툴팁은 추가하지 않는다.
- 목차는 편집창 내부 패널이며 ⌥⌘T로 토글한다. 현재 제목을 표시하고 제목 선택 시 원문으로 이동한다.

## 문서 상태

- Empty document state
- Loaded document state
- Dirty state with unsaved changes
- Paste conversion in progress
- Conversion fallback state for complex pasted content
- Export ready state

## UX Priorities By Flow

- Web archive flow: paste quality and low friction matter most
- Existing file flow: stability and predictable save behavior matter most
- Export flow: readable output matters more than extensive publishing options
