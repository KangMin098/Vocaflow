# S030 `/library/books` — 도서 서가 (Books)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "읽을 원서를 고를 때, 내 수준에서 읽히는 책을 빨리 찾고 싶다, 그래서 이어 읽거나 새 책을 담는다"
- 주 사용자: 학생 · 방문자(공개 표면, `?show=all` 크롤러 경로 `page.tsx:39-45`) · 인지 계층: L0~L2 앞단(TextViewer 진입 전)

## 흐름
- 진입: 사이드바 Library → `/library` redirect(`app/(main)/library/page.tsx:8`) · LibraryTabs 첫 탭(`lib/library/tabs.ts:45-49`) · 10화면(/, /my/books 빈 상태, /comics/restored 등)
- 단계: 1. 헤더(56px 제목+캡슐 4) 2. 만화 히어로 4편 3. 미진단 배너→/diagnostic 4. 코버플로우 추천 5. 레일 4줄(이어서·딱 맞아요·여기부터·인기) 6. 전체 탐색(퀵픽+필터바+격자 60장) 7. 카드→상세 시트/상세 화면
- 완료 조건: 책 상세 또는 `/text/[id]?mode=read` 로 이동(`page.tsx:258-279` CTA 결정)
- 1차 행동: 표지 카드 열기(`BookGridCard.tsx:57`) · 보조: 진단, 필터·정렬, 「N권 더 보기」, 만화로 읽기
- 나가는 길: /library/books/[bookId] · /text/[id] · /comics/adapted/[bookId](템플릿 `page.tsx:318,361`) · /diagnostic

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | `LibraryGrid.tsx:180-202`(공용 `ShelfEmptyState`) | ○ /library/scripts |
| 로딩 | 전역만 | `app/loading.tsx:3-17` 풀스크린 스피너 | — |
| 오류 | 있음 | `page.tsx:111-114, 415-422` tone=error | ○ 짧은 글로 · 재시도 버튼 없음(문구만) |
| 부분 | 있음 | 필터 0건 `BooksExplorer.tsx:534-552` · 단어장 수 실패 시 배지만 빠짐 `page.tsx:139-142` | ○ 필터 초기화 |
| 완료 | 있음 | 격자 `BooksExplorer.tsx:555-570` + 전량 링크 `:588-593` | ○ 「전체 N권 한 번에 보기」 |

## 자산
- N1 자산: 커버리지(`lexical_coverage` × 내 V-Level → `judgeIPlusOne`) · V-Level · 챕터 V 분포 — 역할: **칩·숫자**. 커버리지 %는 제목 아래 18px 칩 한 줄(`BookGridCard.tsx:223-239`), V·CEFR·「읽을 장 N」은 표지 우상단 칩(`:123-141`). 미진단(V=0)이면 칩도 없음(`page.tsx:48`)
- 형태 씨앗: 없음 — S3 채색 지문은 `docs/design/compare/library-books.md` 안 A 로 제안만
- 학습과학 원칙: #3 Desirable Difficulty — 레일 이름 「지금 딱 맞아요」(`BooksExplorer.tsx:472-481`)로만 존재

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 제목+캡슐(`page.tsx:382-409`) → 만화 히어로 4편 2열(`ComicHeroCard.tsx:37`) — 1280×900 에서 **책보다 만화가 먼저** 자리를 차지(추정)
- 골격 판정: OTT 관용구 — 3D 코버플로우(`LibraryGrid.tsx:3`) + 가로 레일 + 표지 격자 2~6열(`BooksExplorer.tsx:557`) + Netflix 시트. G1 축 없음 → N4 불통과
- 평균 신호(정적): 31 (gradient 15 · glass 10 — 표지 그라디언트·라미네이트·sheen `BookGridCard.tsx:78-114`, 칩 `backdrop-blur` `:130`)

## 근거
- `apps/web/src/app/(main)/library/books/page.tsx:382-409` — 헤더 골격(주묵 획+44/56px 제목+Capsule 줄) = scripts·comics/adapted 와 동일
- `apps/web/src/components/library/browse/BooksExplorer.tsx:463-503` — 「이어서 학습」 레일이 /my/books · /text?view=books 와 같은 일을 한다
- `apps/web/src/components/library/shared/ShelfEmptyState.tsx:31-60` — 도서·글·단어장·만화 4서가 공용 빈/오류 컴포넌트
