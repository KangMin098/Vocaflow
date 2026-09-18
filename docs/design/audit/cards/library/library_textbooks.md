# S034 `/library/textbooks` — 교재 서가 (독해 코너)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "학년에 맞는 교재 한 권을 고를 때, 학령·수준·유형으로 좁혀 담고 싶다, 그래서 오늘의 학습이 그 수준에서 문항을 고른다"
- 주 사용자: 학생 · 교사(권 공유) · 방문자(공개·sitemap `page.tsx:12-17`) · 인지 계층: L5 앞단(문항 연습 입구)

## 흐름
- 진입: LibraryTabs 마지막 탭(`lib/library/tabs.ts:62-67`) · /text · 권 상세 뒤로(`[series]/[step]/page.tsx:170`) · 연습 빈 상태(`practice/page.tsx:131`)
- 단계: 1. SeriesTabs(독해·어휘·구문) 2. 12초 소개 영상(발행 시) 3. 서가 머리 「학년을 잇는 일곱 권」+도구줄(검색·정렬·보기) 4. 좁혀 찾기 5. 학령 매대별 권 격자/행 6. 레벨 차트(접힘)
- 완료 조건: 권 선택 → `/library/textbooks/[series]/[step]`(`ShelfControls.tsx:179`) 또는 담기
- 1차 행동: 「펼쳐 보기」(`ShelfControls.tsx:175-182`) · 보조: 담기(`TextbookPickButton`), 레벨 차트
- 나가는 길: 권 상세 · 시리즈 서가(`SeriesTabs.tsx:24,39`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 조건 0건 `TextbookShelf.tsx:287-297` · 재고 0 권은 '근간 예정'으로 표시(주석 `:9`) | △ 문구로 「좁혀 찾기」 안내 — 초기화 버튼 없음 |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 전역만 | 페이지에 catch 없음(`page.tsx:32`) → `app/error.tsx`(추정) | 전면 오류 화면 |
| 부분 | 있음 | 재고 미측정 안내 `TextbookShelf.tsx:276-285` | ○ "잠시 뒤 다시" |
| 완료 | 있음 | 매대 격자 `TextbookShelf.tsx:322,353` | ○ 펼쳐 보기 |

## 자산
- N1 자산: CSAT 계열 문항 재고(권별 itemCount·readyCount `TextbookShelf.tsx:255`) · V-Level 계단 · 교재 표지 정본 `textbook-cover`(`ShelfControls.tsx:57,79`, 식별색 = §매대 RUNG_INK) — 역할: **칩·숫자 + 표지 색**
- 형태 씨앗: 없음(레벨 차트 `LevelChart` 는 접힌 보조)
- 학습과학 원칙: Progressive Disclosure(차트 접힘 `ShelfScreen.tsx:61-76`) · #3(학년 계단)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: **보이는 제목 없음**(sr-only h1 `ShelfScreen.tsx:40`) → 시리즈 탭 → 영상(≤420px) → 서가 카드 머리+도구줄 → 첫 매대
- 골격 판정: 매대 격자 2~3열(`VolumeCard` `ShelfControls.tsx:232`). G1 없음 — 「시험지 사물」 재료(유형·문항 수)를 가졌지만 격자
- 평균 신호(정적): 3 — 그룹에서 낮은 편

## 근거
- `apps/web/src/app/(main)/library/textbooks/page.tsx:17,34` — `/library/textbooks/[series]` 와 **같은 `ShelfScreen`** 을 그림(독해 = 두 주소)
- `apps/web/src/components/library/textbooks/ShelfScreen.tsx:33-79` — 화면 조립 전부
