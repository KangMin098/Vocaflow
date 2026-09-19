# S032 `/library/scripts` — 짧은 글 서가 (Dispatches)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "짧은 영어 글을 읽고 싶을 때, 내 수준에 맞는 주제 시리즈 하나를 골라 바로 읽고 싶다, 그래서 매일 조금씩 읽는다"
- 주 사용자: 학생 · 방문자(`?series=` 주소가 공개 색인용 `page.tsx:22-25`) · 인지 계층: L0~L2 앞단

## 흐름
- 진입: LibraryTabs 둘째 탭(`lib/library/tabs.ts:51-55`) · 도서 서가 오류/빈 상태 CTA(`library/books/page.tsx:420`, `LibraryGrid.tsx:190-191`) · 글 상세 뒤로(`scripts/[bookId]/page.tsx:229`)
- 단계: 1. 헤더(아이콘 상자+제목+캡슐) 2. 밴드 안내 한 줄(+미진단 시 /diagnostic) 3. 추천 시리즈 히어로 1 4. 「다른 주제로 읽기」 행 목록 5. `?series=` 상세 = 글 카드 격자(`SeriesDetail.tsx:166,176`) 6. 글 카드 → 학습 시작
- 완료 조건: 글 카드 → `/text/[textId]?mode=read`(`ArticleCard.tsx:111`)
- 1차 행동: 추천 시리즈 들어가기(`ScriptsBrowser.tsx:273-280`) · 보조: 시리즈 정보 모달, 진단
- 나가는 길: /library/scripts/[id](`ArticleCard.tsx:97`) · /text/[id] · /diagnostic(`ScriptsBrowser.tsx:135`) · 오류 시 /library/books

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | `ScriptsBrowser.tsx:90-95`(공용 `ShelfEmptyState`) | ○ 도서 보러 가기 |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 있음 | `page.tsx:61-65` → `ScriptsBrowser.tsx:79-88` | ○ 다시 시도 + 도서 |
| 부분 | 있음 | 없는 series 키 → 진입면으로 폴백 `ScriptsBrowser.tsx:100-101` | — |
| 완료 | 있음 | 시리즈 상세 격자 `SeriesDetail.tsx:166-176` | ○ 글 카드 |

## 자산
- N1 자산: V-Level(`article_v_level` × 내 V → `buildScriptsMap` `ScriptsBrowser.tsx:75`) — 역할: **정렬·칩**(추천 시리즈 선택과 밴드 문구). 커버리지·R(t) 없음
- 형태 씨앗: 정적 도구가 S2 로 표시했으나 `DecayUnderline` import 는 0(grep) — `Gwonjeom`(press) import 오탐으로 추정. MediaCover 는 생성 표지(자산 아님)
- 학습과학 원칙: #3 Desirable Difficulty(수준별 추천 시리즈)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 44/56px 제목 + 캡슐(`page.tsx:72-95`) → 안내 한 줄 → 시리즈 히어로(MediaCover)
- 골격 판정: 히어로 1 + 행 목록; 상세는 카드 1~3열 격자. G1 없음
- 평균 신호(정적): 13 (float-hover 5 · grid-3eq 3). 제목 아이콘을 **둥근 색 상자**에 담음(`page.tsx:74-79`) — 도서 서가가 v07 에 뺀 관용구(`library/books/page.tsx:384-387`), DESIGN_SYSTEM 컴포넌트 규약 "둥근 컨테이너에 담지 않는다" 위반

## 근거
- `apps/web/src/app/(main)/library/scripts/page.tsx:69-97` — books·comics/adapted 와 같은 헤더 틀(제목+Capsule) + Browser 한 개
- `apps/web/src/components/library/browse/ScriptsBrowser.tsx:124-171` — 진입면 3단(안내·히어로·행)
