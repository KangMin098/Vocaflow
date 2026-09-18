# S031 `/library/books/[bookId]` — 도서 미리보기 (한 권)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "책을 담기 전에, 나한테 맞는지·어떤 단어를 배우는지·첫 장을 보고 싶다, 그래서 내 학습에 추가한다"
- 주 사용자: 방문자(검색 착지 — `page.tsx:21-27`) · 학생(미수강) · 인지 계층: L0~L1 앞단

## 흐름
- 진입: /library/books 카드(`BookGridCard.tsx:57`) · /comics/adapted/[bookId] `?preview=1`(`:252`) · /hub·/wordvault 등 8화면. 로그인+수강자는 즉시 `/text` redirect(`page.tsx:82-86`)
- 단계: 1. 「도서로」+예상 시간 2. 난이도 지수 4칸 3. 함께 학습할 단어장(★ 카드+챕터 격자) 4. 고유 어휘 패널(접힘) 5. 본문 리더 1장(비로그인은 게이트 `BookContentReader.tsx:440-458`) 6. 리더 footer 「내 학습에 추가」
- 완료 조건: `enrollBook` → `/text/[firstTextId]`(`UserPreviewClient.tsx:75-86`)
- 1차 행동: 「내 학습에 추가」(`UserPreviewClient.tsx:155-167`) — 리더 **footer**, 스크롤 맨 아래 · 보조: 단어장 구독/미리보기, 로그인하고 읽기
- 나가는 길: /library/books(`UserPreviewClient.tsx:93`) · /library/vocab(`BookDetailClient.tsx:313`) · /flashcard/play · /login

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 없는/비공개 책 `notFound()` `page.tsx:71` → `app/not-found.tsx` · 챕터 세트 0 → 섹션 숨김 `BookDetailClient.tsx:93` | △ 전역 404(/ · /fit) — 서가로 가는 길 없음 |
| 로딩 | 부분 | 전역 스피너 + 추가 중 `Loader2` `UserPreviewClient.tsx:160-164` | — |
| 오류 | 있음 | 추가 실패 문구 `UserPreviewClient.tsx:146-149` · 조회 오류는 `app/error.tsx` | ○ 같은 버튼 재시도 |
| 부분 | 있음 | 지수 없으면 '—', 전무하면 카드 숨김 `UserPreviewClient.tsx:201-207` | — |
| 완료 | 있음 | 추가 성공 → `/text` push | ○ 학습 시작 |

## 자산
- N1 자산: V-Level·CEFR·CEFR-J·F-K 4칸 숫자(`UserPreviewClient.tsx:226-251`) + 「어휘 매칭 %」(외부 CEFR-J 기준 `:253-256`) · 도서 단어(챕터 세트 격자) — 역할: **칩·숫자**. **내 레벨 커버리지(`lexical_coverage`)는 조회조차 하지 않는다**(`page.tsx:60-64` select 에 없음) — 격자 카드의 % 가 상세에서 사라진다
- 형태 씨앗: 없음
- 학습과학 원칙: #1 Active Recall(단어장→/flashcard/play) · #5 Context-Dependent(책 안의 단어)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 난이도 표 4칸 → 금색 테두리 「📚 함께 학습할 단어장」 ★ 카드(`BookDetailClient.tsx:99-105`, 하드코딩 `#FBBF24` · 이모지 · '추천' 배지 = §매대 "배지는 셀 수 있는 것만" 위반). 책 제목 h1 은 리더 헤더 안(`BookContentReader.tsx:183`) → 첫 뷰포트 밖(추정)
- 골격 판정: 스탯 카드 + 타일 격자(2~6열 `BookDetailClient.tsx:188`) + 리더 패널 — 대시보드형. G1 없음
- 평균 신호(정적): 21 (ai-purple 16 — 출처 파일 미확인 · grid-3eq 1)

## 근거
- `apps/web/src/app/(main)/library/books/[bookId]/page.tsx:58-69` — 커버리지 없는 select
- `apps/web/src/app/(main)/library/books/[bookId]/UserPreviewClient.tsx:106-170` — 조립 순서(지수→단어장→어휘→리더, 1차 행동이 맨 끝)
