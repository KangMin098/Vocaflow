# S046 `/reports` — 주간 리포트 (Report Card)

> 생성 2026-09-18 · Claude(감사 서브에이전트, 저장은 메인 에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "한 주를 마쳤을 때, 그 주에 무엇을 얼마나 했는지 한 장으로 보고 싶다, 그래서 다음 주를 조정한다"
- 주 사용자: 학생(및 보호자에게 보여줄 학생 — 리틀팍스 월리포트 이식, 추정) · 인지 계층: L7 성격(추정)

## 흐름
- 진입: /dashboard ManageSection 한 곳(`components/dashboard/ManageSection.tsx:86`) · 셸 직접 링크 없음(Growth `owns` `sidebar-config.ts:119`)
- D7 활성화 경로 밖
- 단계: 1. 헤더 + 「이번 주 갱신」 2. 주별 카드 최대 8장 읽기
- 완료 조건: 없음(읽기)
- 1차 행동: 「이번 주 갱신」(`components/reports/ReportsClient.tsx:50-59`) · 보조: 오늘 할 일 보러 가기
- 나가는 길: /hub(`ReportsClient.tsx:84,102`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 🗓️ 이모지 + "아직 리포트가 없어요" `ReportsClient.tsx:68-91` | ○ /hub CTA |
| 로딩 | 부분 | 갱신 중 스피너 `:57-58` · 페이지는 전역 `app/loading.tsx` | — |
| 오류 | 부분 | 갱신 실패 `role="alert"` `:62-66`. **조회 실패는 빈 목록으로 삼킴** — `lib/learner/weekly-report.ts:118-124` 가 `error` 를 버리고 `data ?? []` | ✗ 실패가 "리포트 없음"으로 보임 |
| 부분 | 없음 | — | — |
| 완료 | 해당 없음 | — | — |

## 자산
- N1 자산: weekly_reports(daily_activity 집계) — 역할: **숫자** — 카드마다 단어/복습/모듈 3칸 통계(`:130-134`) + 분(分)
- ⚠️ `total_minutes` 표시(`:127`) — /dashboard 는 같은 원천 분이 60초 미만을 0분으로 반올림해 쓰지 않기로 함(`app/(main)/dashboard/page.tsx:14-17`). 두 화면 기준 불일치
- 형태 씨앗: 없음
- 학습과학 원칙: #7 Emotional(empathetic_note `:151-156`)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 아이콘 칩 + 20px 제목 + 갱신 버튼, 아래 주별 카드(`max-w-2xl`)
- 골격 판정: **카드 목록**, 카드 안 **3열 동일 통계 격자**(`grid-cols-3` `:130`) — G1 축 없음
- 평균 신호(정적): 3 (grid-3eq 1 · float-hover 2 — `hover:-translate-y-px` `:85`)

## 근거
- `apps/web/src/app/(main)/reports/page.tsx:1-3` — 생성은 클라 버튼(server action)
- `apps/web/src/components/reports/ReportsClient.tsx:71-73` — 빈 상태 이모지(연습 화면은 "이모지 0" 원칙 `app/(main)/practice/page.tsx:21`)
