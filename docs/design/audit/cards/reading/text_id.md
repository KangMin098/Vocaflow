# S053 `/text/[id]` — 읽기 워크스페이스 (TextViewer)

> 생성 2026-09-18 · Claude Opus 5 (서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "영어 본문을 읽을 때, 막히는 단어를 그 자리에서 확인하고 듣고 싶다, 그래서 챕터를 끝까지 읽고 다음 학습으로 넘어간다"
- 주 사용자: 학생 · 인지 계층: L0–L2

## 흐름
- 진입: `/text` 캐러셀·이어 읽기(`TextHubContent.tsx:217`) · `/hub` · `/library/books/[bookId]` · `/my/books/[bookId]` · `/teacher` · 형제 comic/echo 「본문으로」
- 단계: 1. 헤더 모드 선택(`UnifiedHeader` `page.tsx:537`) 2. 본문 읽기 · 문장 재생 · 단어 탭 → RecallCard/사전(`page.tsx:567-577,617-636`) 3. 챕터 이동/페이지 넘김(`:580-595`)
- 완료 조건: 챕터 완료 표시(`UnifiedHeader.tsx:307` CompleteChapterButton)
- 1차 행동: 본문 안 단어 탭(읽기 자체) · 보조: 듣기 플레이어 · 따라읽기 `?mode=shadow` · 추천 스파클(`page.tsx:650`)
- 나가는 길: `/wordvault`(`:517`) · `/my/books`(`CompleteChapterButton.tsx:112`) · `/teacher` · 모드 알약 → `/text/[id]/comic`(`ModePills.tsx:131`). **echo 로 가는 모드 알약은 없다**

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | ✗ | 문단 0개 처리 없음(`ReadingUniverse.tsx` 길이 검사 없음) | ✗ |
| 로딩 | △ | RSC layout 대기 → 루트 `app/loading.tsx` 만 | — |
| 오류 | ○ | 없는 글 `text/[id]/layout.tsx:104` notFound · 북마크 실패 토스트 `page.tsx:424-427` | △ 404 페이지 의존 |
| 부분 | ○ | 사용자 글 「단어」 모드 = 추출 패널 `page.tsx:505-533` · 책 vs 사용자 글 내비 분기 `:580-595` | — |
| 완료 | ○ | 챕터 풋터 「n개의 학습 단어를 만났어요」 `page.tsx:598-614` · 책 완료 → `/my/books` | ✓ |

## 자산
- N1 자산: R(t) 망각도(선언) · V-Level(`word-enrichment.ts` vLevel) — 역할: **골격 선언은 있으나 데이터가 상수**
- `// @form: 채색 지문 — 밑줄 두께 = 망각도 (F1)` `page.tsx:2`, 두께 구현 `ReadingUniverse.tsx:275-285`. 그러나 모든 단어가 `status: 'new'` 고정(`word-enrichment.ts:91`) → 전부 2px 점선. R(t) 를 계산하는 경로가 없다
- 하드코딩 수치: `memoryStats = { stable: 97, shaky: 28, risk: 14, newWords: 17 }` `page.tsx:471` → InsightPanel(`:661`) · softQuote 「Page 3까지 왔어요」 `:659` · 모드 상태 목업 `MODE_STATUS` `:47-60` (I5 위반)
- 형태 씨앗: S2(선언) · S4(단어 모드 추출 패널 안 `ExtractionPanel.tsx:518`)
- 학습과학 원칙: #4 Dual Coding(삽화·듣기) · #5 Context-Dependent(맥락 속 단어) · #1 Active Recall(RecallCard — 추정)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: UnifiedHeader(모드 알약 `ModePills.tsx:28-44` MODES) + 챕터 kicker + 본문 산문(`ReadingUniverse`)
- 골격 판정(코드 추정): **산문(지문) + F1 밑줄 — 형태는 서명, 데이터는 평균.** 채색 지문(아는/모르는 면)·레벨 조작은 없다(S3 는 랜딩에만)
- 평균 신호(정적, 자기 트리): 24 (gradient 9 · glass 5 · infinite-anim 4 · float-hover 3)

## 근거
- `apps/web/src/app/(main)/text/[id]/layout.tsx:92-104` — 실데이터 조회 · notFound
- `apps/web/src/app/(main)/text/[id]/word-enrichment.ts:84-94` — toWord 가 status 를 'new' 로 박는다
