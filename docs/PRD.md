# PRD

## Product

- Product name: `ClipMark`
- One-line definition: 가장 간편하고 우아한 Markdown 파일 편집기. 클리핑에서 편집으로 이어지는 연속성을 유지한다.
- Platform: 재단장 버전은 macOS 26 이상만 지원
- Technical direction: `Tauri + React + CodeMirror 6 + markdown-it + Turndown`, 조작부에 실제 AppKit Liquid Glass 적용

## 재단장 기준

[CLIPMARK_REDESIGN.md](./CLIPMARK_REDESIGN.md)는 합의된 재단장 기준이다. 첫 구현과 검증 범위는 [구현 기록](./superpowers/plans/2026-10-02-clipmark-redesign-ledger.md)을 참조한다. HTML 허용 목록 확장은 후속 범위다.

## Problem

Existing Markdown editors are often optimized for people who already write Markdown fluently. They are less optimized for the workflow of copying content from the web, cleaning it up, preserving structure, and saving it as a local Markdown file. Rich document tools solve some of that import problem, but they tend to be heavier, file-hostile, or overly WYSIWYG.

## Target Users

- Developer-friendly users who already work with Markdown files
- Users who archive web content for research, notes, references, or drafts
- Users who prefer local files over cloud-native document systems

## Core Value

- 조용하고 우아한 화면을 최우선으로 하고 빠르고 안정적인 편집을 다음 우선순위로 둔다.
- 안정적인 원문 편집과 필요할 때 여는 별도 미리보기 창
- High-quality paste conversion from web content into Markdown
- File-first workflow with minimal UI overhead

## Product Principles

- This is not a general-purpose writing suite.
- This is not a WYSIWYG editor.
- The file belongs to the user, not the app.
- Structure matters more than visual styling.
- Speed and clarity are more important than feature breadth.

## Goals

- Make `copy from web -> paste -> clean up -> preview -> save` feel fast and reliable
- Preserve useful document structure when importing content
- Keep the app lightweight enough to feel like an information appliance

## Non-Goals

- Real-time collaboration
- Login or cloud sync
- Notion-style block editing
- Database-style document management
- Plugin ecosystem
- AI-assisted writing

## MVP Scope

### Must Have

- Create a new Markdown document
- Open an existing `.md` file
- Save and Save As
- 파일 하나에 편집창 하나, 선택적인 별도 미리보기 보조 창
- 상단 파일명 직접 수정, 저장 전 내용과 실행 취소 이력 유지
- 커서·입력에 따른 미리보기 추적, 수동 스크롤 시 중단, 편집 재개 시 추적 재개
- 편집창 내부의 접이식 목차, 은은한 줄 번호
- 편집·미리보기 본문 최대 폭 제한 없음
- 좌하단 경로 복사와 우하단 미리보기 토글에 실제 Apple Liquid Glass 적용
- Table of contents panel based on headings
- GitHub Flavored Markdown rendering
- `details/summary` rendering support
- Paste from external apps and browsers
- Convert pasted content into Markdown-friendly output
- Keyboard shortcuts for common file actions
- Dirty state indicator for unsaved changes

### Should Have

- In-document search
- Code block syntax highlighting in preview
- 목차 패널과 별도 미리보기 창을 단축키로 토글
- HTML export
- PDF export

### Later

- 젠 모드, 탭, 라이브러리는 첫 재단장 범위에서 제외
- Folder library or workspace browser
- Tags and metadata management
- Image asset management
- Web clipper

## Success Criteria

- The app feels ready to type within a very short time after launch
- Paste conversion usually produces a usable Markdown draft without major cleanup
- Large Markdown documents remain comfortable to edit and preview
- The file workflow stays obvious and predictable

## Risks

- Paste conversion quality may define product perception more than the editor itself
- Complex tables and interactive web layouts may degrade poorly if conversion rules are too aggressive
- 기능 확대가 간편한 파일 편집과 클리핑 연속성을 해칠 수 있다.
- 네이티브 조작부의 창별 이벤트·접근성과 별도 미리보기 연결을 실제 macOS에서 검증해야 한다.

## Open Decisions

- Whether HTML export ships in MVP or immediately after
- Whether image binary paste is supported in MVP or postponed
- 의미 보존용 제한 HTML의 구체적인 허용 목록은 클리핑 후속 작업에서 확정한다. 원본 CSS와 실행 가능한 콘텐츠는 제외한다.
