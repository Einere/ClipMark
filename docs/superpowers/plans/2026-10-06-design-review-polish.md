# 디자인 리뷰 대응 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 미색과 편집 구조를 유지하면서 확정된 네 가지 디자인 문제를 해결한다.
**Architecture:** 기존 semantic/state 색상 토큰과 CSS를 국소 변경하고 환영 화면의 소개 위계만 줄인다. 동작·네이티브 재질·문서 폭 정책은 유지한다.
**Tech Stack:** React, CSS OKLCH, Tauri.
**Spec:** 사용자가 승인한 docs/DESIGN_REVIEW_2026-10-06.md의 우선 개선점 1–4. 원본 리뷰는 기존 체크아웃에 있으며 아래 요구사항이 실행 기준이다.

## Global Constraints

- 미색 팔레트, 원문 편집, 목차, 최대 폭 제한 없음, 실제 Apple Liquid Glass 유지.
- 새 의존성·추상화·불필요한 테스트 추가 없음. 표현 변경은 computed CSS·대비 계산·화면 검증으로 확인.
- 일반 primary 버튼 텍스트 대비 4.5:1 이상(default/hover/active, light/dark).
- CSS focus 표식과 실제 주변 배경 대비 3:1 이상. 본문에 상시 outline 추가하지 않음.
- 미리보기 링크는 hover 전에도 색 이외의 표식으로 구별.
- 새 파일·열기·최근 파일 동작과 빈 상태 안내 유지.
- 각 개선을 Conventional Commits 한국어 제목·배경/변경/영향/검증 본문으로 별도 커밋.

## Review Focus

- 라이트·다크의 primary 기본/hover/active 대비.
- 버튼·목차·검색의 키보드 포커스 대비.
- 미리보기 문장 안 링크의 기본 밑줄, 코드·다른 텍스트 영향 없음.
- 좁고 낮은 환영 화면에서 새 파일·열기·최근 파일 접근.
- 긴 최근 파일명과 빈 최근 파일 상태 유지.

### Task 1: 버튼 및 포커스 대비

Files: src/styles/colors.css, 필요시 docs/COLOR_TOKEN_SPEC.md.
- [ ] 기존 토큰과 리뷰의 대비 부족을 계산으로 확인.
- [ ] 일반 primary default/hover/active 조합을 light/dark 모두 4.5:1 이상으로 변경하고 검증.
- [ ] 버튼 대비 변경을 별도 커밋.
- [ ] light focus token을 기존 파란색으로 보완하고 실제 canvas/subtle 배경에서 3:1 이상 확인.
- [ ] 포커스 변경을 별도 커밋.

### Task 2: 미리보기 링크

Files: src/styles/components.css의 markdown-preview__content a.
- [ ] 기본 상태에 얇은 밑줄과 underline-offset을 추가.
- [ ] hover/키보드 포커스에서도 표식 유지하고 링크·코드·본문 화면 확인.
- [ ] 링크 변경을 별도 커밋.

### Task 3: 작업 중심 환영 화면

Files: src/components/welcome/WelcomeScreen.tsx, src/styles/components.css.
- [ ] 큰 홍보형 제목을 ClipMark로 바꾸고 eyebrow·강조 단어·긴 설명을 제거.
- [ ] 짧은 안내 "Create a Markdown file or open an existing document."를 사용.
- [ ] New Markdown File/Open Existing File, 최근 파일, 빈 상태 안내, 버전/저작권 유지.
- [ ] 제목은 최대 2.25rem, 자간 -0.02em 이상. 최근 파일이 작업 중심 위계에 놓이도록 기존 간격을 작게 정돈.
- [ ] 480×480 및 960×720에서 레이아웃과 긴 파일명·빈 상태 검증, 기존 테스트 및 build 확인.
- [ ] 환영 화면 변경을 별도 커밋.

## 최종 검증

- [ ] 전체 npm test / npm run build / git diff --check.
- [ ] 실제 브라우저에서 변경 화면과 기본 링크 표식 확인.
- [ ] 독립 task 리뷰와 전체 브랜치 리뷰 완료.
