# S038 `/library/vocab` — 공용 단어장 서가 (Decks)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "외울 단어를 고를 때, 내 수준·목적에 맞는 단어장을 찾아 구독하고 싶다, 그래서 바로 플래시카드로 외운다"
- 주 사용자: 학생 · 방문자(구독은 로그인 필요) · 인지 계층: L3~L4a 입구(WordVault·Flashcard 앞단)

## 흐름
- 진입: LibraryTabs 셋째 탭(`lib/library/tabs.ts:57-61`) · /diagnostic · 도서 상세(`BookDetailClient.tsx:313`) · /wordvault · /text · 관리자 2화면
- 단계: 1. `VocabSeriesHeader`(제목+사다리 단·권·단어, 내 칸 표시 `VocabSeriesHeader.tsx:50,70-90`) 2. 구독 캡슐 3. 진단자는 추천 줄 / 미진단은 진단 유도(`VocabSetGrid.tsx:402-416`) 4. 카테고리별 가로 캐러셀(`:418-426`) 5. 조건 줄(검색·카테고리·정렬) 6. 카드 → 미리보기 모달 → 구독/학습
- 완료 조건: 구독 성공 토스트(`VocabSetGrid.tsx:456`) 또는 /flashcard/play
- 1차 행동: 세트 구독(카드 토글 `handleToggle`) · 보조: 미리보기 모달의 「학습」(`VocabSetPreviewModal.tsx:484`)
- 나가는 길: /flashcard/play · /diagnostic(`VocabSetGrid.tsx:466`) · 빈 상태 /library/books

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | `VocabSetGrid.tsx:376-382`(공용 `ShelfEmptyState`) | ○ 도서 보러 가기 |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 전역만 | 조회 실패 → throw(`lib/library/vocab/queries.ts:220`) → `app/error.tsx` · 구독 오류는 카드별(`VocabSetGrid.tsx:120`) | △ 도서·글 서가의 「못 불러왔어요」 톤 없음 |
| 부분 | 있음 | 필터 0건 `VocabSetGrid.tsx:383-399` | ○ 필터 초기화 + 도서 |
| 완료 | 있음 | 구독 토스트 · 밀집 격자 2~6열 `:430` | ○ 학습 |

## 자산
- N1 자산: V-Level → 사다리 학습자 칸(`page.tsx:65-67`) + 추천 RPC `recommend_word_sets_for_user`(`page.tsx:51-56`) · 단어장 표지 = DB 각인(§매대) — 역할: **헤더 안 띠·칩**. R(t)·FSRS 없음(구독한 세트의 기억 상태도 안 보임)
- 형태 씨앗: 정적 도구의 S2 표기는 오탐 추정(`DecayUnderline` grep 0). `VocabSetMatrix.tsx` 는 import 0 인데 레벨에 `--memory-shaky` 를 씀(`:59,77,120`) — 망각 4색 의미 전용
- 학습과학 원칙: #3(수준 추천) · #2 Spaced Repetition 은 구독 뒤 화면 몫(추정)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 26→52px 제목 + 사다리 줄 → 추천 줄 또는 진단 유도 → 첫 캐러셀
- 골격 판정: OTT 캐러셀(`VocabSetGrid.tsx:417` 주석 "OTT/Netflix 스타일") + 격자. G1 없음. 사다리(`VocabSeriesHeader`)가 가장 형태에 가까우나 헤더 곁가지
- 평균 신호(정적): **46 — 그룹 최고**(ai-purple 17 · gradient 14 · glass 7 · grid-3eq 4)

## 근거
- `apps/web/src/app/(main)/library/vocab/page.tsx:69-92` — 헤더+캡슐+Grid 3단(도서·글 서가와 같은 틀)
- `apps/web/src/components/library/shared/NetflixDetailSheet.tsx:21` — 도서 서가 상세 시트가 단어장 `VocabSpreadSheet` 를 재사용(두 서가가 상세를 공유)
