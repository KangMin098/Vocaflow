# S035 `/library/textbooks/[series]` — 시리즈 서가 (독해·어휘·구문 코너)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "어휘·구문 같은 다른 갈래 교재를 찾을 때, 그 코너의 권들을 보고 담고 싶다"
- 주 사용자: 학생 · 교사 · 방문자(시리즈마다 다른 제목 `page.tsx:36-41`) · 인지 계층: L5 앞단

## 흐름
- 진입: 정적 in=0 은 오판 — `SeriesTabs.tsx:39` 가 템플릿 `seriesShelfHref()`(`:24`)로 링크. 셸에서 바로 오는 길은 없음(LibraryTabs 는 `/library/textbooks` 로)
- 단계: S034 와 동일(같은 `ShelfScreen`) — 탭 → 영상 → 서가 → 권
- 완료 조건: 권 상세로(`ShelfControls.tsx:179`)
- 1차 행동: 「펼쳐 보기」 · 보조: 담기
- 나가는 길: 권 상세 · 다른 시리즈 탭

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 카탈로그 밖 시리즈 → 404 `page.tsx:47` · 조건 0건 `TextbookShelf.tsx:287-297` | △ 404 는 / · /fit 로만 |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 전역만 | catch 없음(`page.tsx:49-53`) → `app/error.tsx`(추정) | 전면 오류 |
| 부분 | 있음 | 미측정 재고 `TextbookShelf.tsx:276-285` | ○ |
| 완료 | 있음 | 매대 격자 | ○ |

## 자산
- N1 자산: S034 와 동일 — 담김도 시리즈 단위(`page.tsx:49-53`) — 역할: **칩·숫자 + 표지 색**
- 형태 씨앗: 없음
- 학습과학 원칙: #3

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: S034 와 같음(sr-only h1 은 시리즈 브랜드명 `ShelfScreen.tsx:40`)
- 골격 판정: 매대 격자. G1 없음
- 평균 신호(정적): 3

## 근거
- `apps/web/src/app/(main)/library/textbooks/[series]/page.tsx:10-12,55` — "옛 주소는 그대로 독해 서가, 화면은 `ShelfScreen` 하나" → `/library/textbooks` ≡ `/library/textbooks/reading`(id `packages/library-pipeline/src/textbook/series-catalog.ts:152`) 의도된 중복 주소
- 병합 후보 판단: 화면 중복은 없음(컴포넌트 1개), **주소 중복**만 — canonical 지정 여부 확인 필요(추정: metadata 에 `alternates` 없음 `page.tsx:28-42`)
