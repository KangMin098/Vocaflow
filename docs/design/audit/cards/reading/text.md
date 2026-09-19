# S052 `/text` — My Library (내 책 · 본문 · 구독 단어장 · 담은 교재)

> 생성 2026-09-18 · Claude Opus 5 (서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "읽을거리를 고를 때, 내가 모아 둔 책·글·단어장을 한곳에서 보고 싶다, 그래서 멈춘 자리에서 바로 이어 읽는다"
- 주 사용자: 학생 · 인지 계층: L0–L2 입구

## 흐름
- 진입: 셸 사이드바 `sidebar-config.ts:167` · 28개 화면(게임·flashcard·/my 등) · `/text/new` 저장 후 `text/new/page.tsx:161,179`
- 단계: 1. 면 선택(`?view=`, `text/page.tsx:31-32`) 2. 이어 읽기 행 확인 3. 캐러셀에서 항목 선택
- 완료 조건: `/text/[id]` 로 이동(`TextHubContent.tsx:217` workspaceHref)
- 1차 행동: 이어 읽기 `ContinueRow`(`TextHubContent.tsx:215-226`) · 보조: 면별 행동 카드(교재 `:136` · 단어장 `:162` · 새 글 `:188`)
- 나가는 길: `/library/textbooks` · `/library/vocab` · `/text/new` · `/library`(빈 상태)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | ○ | 전체 빈 `TextHubContent.tsx:75-80` → `EmptyState.tsx:40-55` · 면별 빈 `MyLibraryCarousel.tsx:465-473` | ✓ 직접 입력 / 라이브러리 · ✗ 면별 빈은 문장뿐(위 행동 카드가 대신 — 추정) |
| 로딩 | ○ | 스켈레톤 `TextHubContent.tsx:27-37,69-70` | — |
| 오류 | ✗ | `useTexts.ts:313-317` 가 fetch 오류를 `[]` 로 삼킨다 → 오류가 「첫 스크립트을 시작해 보세요」 빈 상태로 보인다 | ✗ (AGENTS 「오류를 0 으로 삼키지 않는다」 위반) |
| 부분 | ○ | 교재 못 읽음 ≠ 0권 구별 `text/page.tsx:42-43` | — |
| 완료 | — | 허브라 없음 | — |

## 자산
- N1 자산: V-Level(`useUserVLevel` `TextHubContent.tsx:67` → 캐러셀) · 도서 `lexical_coverage`(`useTexts.ts:308` select) — 역할: **칩·숫자**(추정, 카드 안 표시)
- 형태 씨앗: 없음 (S2 DecayUnderline · S3 채색 지문 미사용)
- 학습과학 원칙: #5 Context-Dependent(이어 읽기) 정도 — 약함

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: `ModuleHero` 그라디언트 띠 + 4칸 통계(`TextHubContent.tsx:106-127`, 그라디언트 `ModuleHero.tsx:84`) + 행동 카드 1개 + 이어 읽기 행
- 골격 판정(코드 추정): **히어로 + 카드 캐러셀**(`MyLibraryCarousel.tsx:387-403`) — 평균. 「서가가 차오른다」(환경 변형) 축이 비어 있는 바로 그 자리
- 카피 불일치: 행동 카드 「텍스트 직접 입력 · PDF · DOCX · TXT · URL」(`TextHubContent.tsx:202`) ↔ `/text/new` 파일·URL 「준비 중」(`text/new/page.tsx:422-428`)
- 평균 신호(정적, 자기 트리): 41 — 그룹 최다(gradient 23 · ai-purple 6 · glass 6 · grid-3eq 4 · float-hover 2). 예: 하드코딩 `#A5B4FC` 그라디언트 `TextHubContent.tsx:121,166,192` · `EmptyState.tsx:42`

## 근거
- `apps/web/src/app/(main)/text/page.tsx:36-45` — 교재만 서버에서, 나머지 SWR
- `apps/web/src/components/textviewer/TextHubContent.tsx:89-100` — 면별 개수·라벨
- `apps/web/src/components/textviewer/EmptyState.tsx:28-36` — 「AI가 핵심 단어를 추출해…」 설명형 빈 상태
