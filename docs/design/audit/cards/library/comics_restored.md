# S017 `/comics/restored` — 복원 만화 서가 (Vintage Comics)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "1940~50년대 영어 만화 원본을 볼 때, 유형·시리즈별로 둘러보고 한 호를 골라 읽고 싶다"
- 주 사용자: 학생 · 방문자 · 인지 계층: L0(읽기 재미 입구)

## 흐름
- 진입: 사이드바 Comics(`sidebar-config.ts:292`) · ComicsTabs(`ComicsTabs.tsx:25`) · 리더 뒤로(`restored/[slug]/page.tsx:156, 319`). 정적 in 목록의 관리자 60화면은 관리자 셸 공용 링크로 추정
- 단계: 1. 헤더(Vintage Comics·「옛 영어 만화책」·설명) 2. 유형 바로가기 칩(`page.tsx:99-115`) 3. 유형별 시리즈 표지 격자 2~4열(`:140`) 4. `?series=` 호 격자(`:242`) + 정보 다이얼로그(`:280`) 5. 호 → 리더
- 완료 조건: `/comics/restored/[slug]` 진입(`page.tsx:246`)
- 1차 행동: 호 표지 열기 · 보조: 호 정보(`ComicInfoDialog`), 유형 점프
- 나가는 길: /comics/restored/[slug] · /library/books(`:301, :328`) · /comics/adapted(`:334`) · 다이얼로그 → /library/books/[bookId](`ComicInfoDialog.tsx:251`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 발행 0 `Empty` `page.tsx:314-339` · 시리즈 호 0 `:196-212` | ○ 도서+책 만화 / 서가로 |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 부분 | 스키마 없음만 `NotReady`(`page.tsx:292-305`, `lib/pd-comic/queries.ts:84-86`), 그 밖 오류는 throw → `app/error.tsx` | ○ NotReady 는 도서로 · 일반 오류는 전면 |
| 부분 | 있음 | 표지 없으면 'no cover' 글자 `page.tsx:152-156` | — |
| 완료 | 있음 | 시리즈/호 격자 | ○ |

## 자산
- N1 자산: **없음** — 카드에 싣는 것은 연도·출판사·권수·쪽수뿐(`page.tsx:157-174`). V-Level·커버리지·사전 불사용 → N1 불통과. 역할: **없음**
- 형태 씨앗: 없음
- 학습과학 원칙: #7 Emotional Encoding(원본 연도 표지 — "1945 원본" 칩, 추정) 외 명시 원칙 없음

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 30px 제목 + 설명 두 줄 + 유형 칩 → 첫 유형의 2/3 비율 표지 격자
- 골격 판정: 표지 격자(웹툰·전자책 서점과 동일 구조). G1 없음
- 평균 신호(정적): 11 — glass(`backdrop-blur` `page.tsx:157, 259, 283`) · 하드코딩 `#E6C275`·`rgba(23,17,10,.82)` 칩(`:157, :259` — CSS 변수 규칙 위반) · float-hover `hover:-translate-y-0.5`(`:145, :247`)

## 근거
- `apps/web/src/app/(main)/comics/restored/page.tsx:50-91` — 서가/시리즈 두 면을 한 라우트가 `?series=` 로 전환
- 병합 후보: /comics/adapted 와 **같은 탭 셸**(`comics/layout.tsx`)이지만 카드·빈 상태 컴포넌트는 따로 만듦(공용 `ShelfEmptyState` 미사용)
