# Gate 0 · 정리 — `/csat` 이하 라우트·컴포넌트 처분표 (2026-09-17)

> 지시문 A1: 학습자 라우트는 `/csat` · `/csat/session` · `/csat/progress` 셋뿐. 나머지는 삭제하거나 관리자 영역으로.
> 결과: **학습자 라우트 7 → 3.** 판정 근거는 [DECISIONS.md](./DECISIONS.md) D8.

## 라우트

| 이전 | 처분 | 지금 | 이유 |
|---|---|---|---|
| `/csat` (오답 지도 + 모드 넷 + 유형 카드 26) | **교체** | `/csat` = 오늘의 세션 카드 1장 | 선택은 시스템이 한다(A2) |
| — | **신설** | `/csat/session` | 한 문항 = 한 화면 ①②③ |
| — | **신설** | `/csat/progress` | 숫자 셋 + 막대 한 열 |
| `/csat` 옛 허브 | 관리자 이동 | `/admin/kice` | 오답 분포는 분석가의 화면 |
| `/csat/[typeId]` | 관리자 이동 | `/admin/kice/[typeId]` | 유형 리포트 읽기 |
| `/csat/item/[slug]` | 관리자 이동 | `/admin/kice/item/[slug]` | 해설 전문 + **강의 검수 하네스가 쓰는 자리**(gate2-play · e2e 46) |
| `/csat/map` | 관리자 이동 | `/admin/kice/map` | 지형(히트맵) |
| `/csat/predict` | 관리자 이동 | `/admin/kice/predict` | 사정권 |
| `/csat/plan` | 관리자 이동 | `/admin/kice/plan` | 한 회차 주파 계획 |
| `/csat/drill` (+ `actions.ts`) | **삭제** | — | 세션 ①풀기가 대체. 옛 기록(`csat_trap_attempts`)은 남는다 |
| `/csat/overlay` (+ `LinkPanel` · `OverlayClient`) | **삭제** | — | 페이지 캔버스 렌더(A6 위반). reflow 가 대체 |
| `POST /api/csat/overlay` | **삭제** | `POST /api/csat/paper` | 해시 → **좌표만**(분석은 싣지 않는다) |
| — | **신설** | `POST /api/csat/session/reveal` | 답을 고른 뒤에만 해설(A4) |
| `GET /api/csat/lecture` | 유지 | — | ② 이해의 [강의 듣기] |

## 컴포넌트·모듈

| 이전 | 처분 | 이유 |
|---|---|---|
| `components/csat/CsatSteps.tsx` · `lib/csat/steps.ts` | 삭제 | 7단계 레일 — 고를 것이 없어졌다 |
| `components/csat/ModePicker.tsx` | 삭제 | 모드 UI 금지(A2 · F5) |
| `components/csat/OverlayPanel.tsx` (+ 테스트) | 삭제 | 오버레이 전용 |
| `components/csat/TrapDrill.tsx` | 삭제 | 훈련 화면 전용 |
| `TrapAtlas` · `Heatmap` · `LocusBar` · `ReportText` · `PlanTimeline` · `PassageMap` | 유지(관리자 뷰가 씀) | 링크만 `/admin/kice/*` 로 |
| `lecture/*` | 유지 | 세션 ② 이해가 `LectureStage` 를 그대로 쓴다 |
| `lib/csat/overlay-reveal.ts` · `trap-drill.ts` · `drill-loader.ts` | 유지 | 순수 모듈 + 회귀가 있다. 화면 없이도 해가 없다 |
| `lib/csat/overlay.ts` | 유지 + `anchorsBySha256` 추가 | 해시 → 좌표 |

## 함께 고친 곳

- `lib/framework/learner-routes.ts` — `/csat/[typeId]` · `/csat/item/[slug]` · `/csat/overlay` · `/csat/plan` 선언 제거, `/csat/session` · `/csat/progress` 추가
- `lib/layout/full-screen-routes.ts` — `/csat/session` 풀스크린(셸 띠의 다른 모듈 CTA 제거)
- `components/layout/CompassRibbon.tsx` — `/csat*` 에서 띠 숨김(A2)
- `components/layout/SessionFrame.tsx` — 기출 세션 제목·닫기, 「다른 학습 세션으로 이동」 선택 상자 숨김(F5)
- `components/admin/AdminSidebar.tsx` — 「기출 분석 뷰」 항목 · `lib/admin/help/kice.ts` 화면도움말 6
- `app/admin/kice/__tests__/phase2-screens.test.tsx` — 옛 학습자 테스트를 옮기고 레일·모드 검사는 걷음
- `lib/csat/__tests__/axes-steps.test.ts` — `steps.ts` 검사 걷음
