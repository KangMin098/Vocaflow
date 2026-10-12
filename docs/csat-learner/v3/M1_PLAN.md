# 기출분석 v3 M1 — 두 메뉴 · 지도 중심 홈 계획 (2026-10-13)

근거: 정본 설계 `CSAT_LEARNER_UX_V3` §1 · §2 · §7, `CSAT_V3_IMPLEMENTATION_PLAN` §4(설계 브랜치 PR #223), 사용자 결정(2026-10-13 M1 보류 해제), N0 인벤토리(아래).

## N0 — 현재 상태(main 58bfc15b1 · 코드 확인)
- 레일(`CsatRail`) = 홈 · 이어서·복습 · 내 기록 · 내 진단 · 전체 서가 · 연습 · 내 공식 + 목적별 5 · 유형별 · 회차별(하드코딩).
- `/csat` = `SpaceScreen`(유형/함정 표 + 진단 카드 · `need` · `tab=trap` · `view=continue`). 학습 지도는 `/csat/diagnosis?tab=map` 에만(`MapScreen` · `LearnerMap` · `loadMapPage`).
- `LearnerMap` 은 이미 「먼저 확인할 것」 하나(`Focus`: step · distinguish · direct · record · more · pending · none)를 고른다 → 홈은 새 판정을 만들지 않고 재사용한다.
- `/csat/*` 는 전부 로그인 필요(`protected-routes`) → UX §7 의 「익명」 분기는 적용 대상이 없다(정책은 바꾸지 않는다).
- Workspace 라우트는 main 에 없다(`MAP_INTEGRATION_MANIFEST` 제외 항목) — 「바로잡기 진행」 은 기기 기록의 진행 중 세트로만 표현한다.
- 서가 필터는 URL 과 동기화되지 않는다 · 문항의 「뒤로」 는 `/csat` 고정 · 「학습 지도로」 는 `/csat/diagnosis`.

## 변경
1. **레일** — 상시 메뉴 2개: 내 학습 지도(`/csat`) · 기출 탐구(`/csat/browse`). 목적별 · 유형별 · 회차별 묶음은 서가 조건으로 옮긴다. 접기 토글 · 폭 · testid 유지.
2. **`/csat` 홈(쿼리 없음)** — 지도 중심.
   - 첫 제안 카드 하나 — `pickHomeSuggestion`(순수 함수): 지도 오류 → 탐구 복귀(`?from=item&item=<slug>`) → 진행 중 세트 이어서(기기 기록) → 지도 Focus(확인 필요 · 기록 없음 · 기록만) → 지도 준비 중. 새 점수 · 인기 · 약점 순위 없음.
   - 그 아래 핵심 학습 지도(`LearnerMap`, 기록/상세 base 는 `/csat/diagnosis` 유지). 준비 중 · 오류는 각자 안내 + 기출 탐구.
   - 내 자료 줄: 이어서·복습 / 내 기록 / 내 진단 / 내 공식 / 연습 — 기존 경로 그대로.
   - 기출 탐구 진입은 항상(진단이 입장권이 아니다).
3. **옛 주소** — `/csat?need=…` · `?tab=trap` · `?view=continue` 는 옛 URL 전용으로 기존 화면 그대로(무효 need → 지도 홈). 새 링크는 서가 조건 또는 `/csat`.
4. **기출 탐구(서가)** — 「목적」 조건(킬러 유형 · 근거 문장 · 최근 기출 = 필터, 처음 시작 · 오답 설계 = 기존 화면 링크). 필터를 URL 에 replaceState 로 동기화. 문항 칩 → `?ret=<서가 경로>`, 문항의 「뒤로」 는 `safeInternalPath` 통과 + `/csat/browse` 접두일 때만 그 조건으로.
5. **지도 복귀** — 문항의 「학습 지도로」 → `/csat?from=item&item=<slug>`. `check=1` 흐름 유지.
6. **이벤트** — 새 이벤트 이름 없이 기존 이벤트 속성(닫힌 enum) 확장 → funnel CHECK 마이그레이션 불필요.
7. **문서 · 시험** — ROUTES · MODULES · DECISIONS · DELIVERY · CHANGELOG. 단위(`pickHomeSuggestion` · 서가 URL) · e2e(두 메뉴 · 첫 제안 · 옛 링크 · 복귀 · 1280/1440) · 기존 회귀.

## 하지 않을 것
보호 라우트 정책 변경 · Workspace 신설 · 새 진단 점수/DB 컬럼 · 다크 · 모바일 · v3 강의 · 학평 해제.
