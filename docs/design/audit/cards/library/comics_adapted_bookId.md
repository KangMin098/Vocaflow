# S016 `/comics/adapted/[bookId]` — 책 만화 미리보기 · 형식 고르기

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "이 책을 시작할 때, 만화·본문·오디오 중 나한테 맞는 형식을 정하고 싶다, 그래서 첫 장을 편하게 연다"
- 주 사용자: 학생 · 방문자(검색 착지 `page.tsx:36-45` canonical) · 인지 계층: L0

## 흐름
- 진입: 정적 in=0 은 오판 — 템플릿 링크 `comics/adapted/page.tsx:105` · `library/books/page.tsx:318, 361`(만화 히어로·카드 배지)
- 단계: 1. 「만화 목록」 뒤로 2. 헤더(제목·컷·V·적합도·진도) 3. 3컷 미리보기(`page.tsx:200-223`) 4. `ComicFormatChoice`(처방 `prescribeFormat` `:156-163`) 5. 「이 책의 단어장 보기」
- 완료 조건: 만화/본문/오디오 중 하나로 `/text/[id]…` 진입(`page.tsx:237-239`)
- 1차 행동: 처방된 형식으로 시작(`ComicFormatChoice` `page.tsx:235-247`) · 보조: 단어장 보기(`:251-256`)
- 나가는 길: /comics/adapted(`:172`) · /library/books/[bookId]?preview=1(`:252`) · /text/[id]/comic · ?mode=read · ?mode=listen

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 카탈로그에 없으면 404 `page.tsx:66-68` · 미리보기 0컷 `:225-232` | ○ "바로 시작해도 좋아요"(아래 형식 선택) |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 전역만 | `app/error.tsx` | 전면 오류 |
| 부분 | 있음 | 도서 조회 실패 시 카탈로그 값으로 폴백 `page.tsx:95-101` | — |
| 완료 | 있음 | 리더 진입 | ○ |

## 자산
- N1 자산: 커버리지 × 내 V-Level → `judgeIPlusOne`(`page.tsx:155`) → **처방 입력** + 헤더 칩(`:194`) — 역할: **칩·숫자**. 자산이 결정(어떤 형식)에 쓰이는 유일한 만화 화면이지만 형태는 칩
- 형태 씨앗: 없음
- 학습과학 원칙: #4 Dual Coding · #3 Desirable Difficulty(적합도 → 형식 처방)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 34/44px 제목 + 메타 칩 → 3컷 가로 격자(`page.tsx:202` `sm:grid-cols-3`)
- 골격 판정: 미리보기 격자 + 선택 카드. G1 없음
- 평균 신호(정적): 4 (grid-3eq 2 · float-hover 2)

## 근거
- `apps/web/src/app/(main)/comics/adapted/[bookId]/page.tsx:66-68` — 목록용 카탈로그 전체(coverLimit 0)를 읽어 한 권을 찾는다
- 병합 후보: `/library/books/[bookId]` 와 같은 책의 두 번째 상세(난이도·단어장 vs 형식 선택) — 한 책에 입구 둘
