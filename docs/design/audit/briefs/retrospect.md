# 브리프 — 회고: `/dashboard` 성장 (S021) + `/reports` 주간 리포트 (S046)

> 생성 2026-09-18 · Claude Code · 근거: [카드 dashboard](../cards/home/dashboard.md) · [카드 reports](../cards/home/reports.md) · [판정](../verdict.md) · DB 질의. 4안은 만들지 않았다.
> `/reports` 의 유일한 입구가 `/dashboard` ManageSection 한 곳(`ManageSection.tsx:86`)이고 둘 다 L7 회고라 **통합 후보**로 한 브리프에 묶는다.

## 목적 · 여정 위치
- JTBD: "한 주를 지났을 때, 내 기억이 얼마나 버티게 됐는지 보고 싶다, 그래서 계속할 이유를 얻는다"
- 여정 ③ 의 회고 끝(L7) — 셸 Growth.

## 현재 골격 (판정: 둘 다 평균)
- `/dashboard`: 섹션 번호 + **카드 목록**, 01번은 빈 상태 문장 카드, 02번은 같은 폭 카드 2개와 숫자 3칸. **선언 `@form 환경 변형`(DurabilityLadder) 이 렌더되지 않는다.** 코드상 히어로는 중앙값 숫자와 12px 막대 하나(`DurabilityLadder.tsx:76-104`).
- `/reports`: 팔레트 밖 3D 달력 이모지 + 가운데 정렬 빈 상태, 카드 안 `grid-cols-3` 통계. **조회 실패를 빈 목록으로 삼킨다**(`lib/learner/weekly-report.ts:118-124`) · 같은 원천의 분(分)을 `/dashboard` 는 반올림 0 으로 버리는데 여기선 보인다 — 두 화면 기준 불일치.

## 자산 (DB 실측)

| 자산 | 값 | 어디 |
|---|---|---|
| 기억이 버티는 기간 | `vocabularies.stability` 2,249행 | 씨앗 **S8** `DurabilityLadder.tsx` |
| 어휘의 무게중심 | `shared_dictionary.frequency_rank` × 내 단어 | 씨앗 **S9** `LexicalReach.tsx` |
| 활동 | `daily_activity` 61행 · `weekly_reports` 1행 | 집계 원천 |
| 7일 곡선 | 코드 | 씨앗 **S1** |

## G1 축 후보
1. **환경 변형** — 첫 시선이 **내 서가/지층**: 단어가 버티는 기간별 층이 쌓이고(S8 을 막대가 아니라 공간으로), 주가 지날 때 층이 두꺼워진다 — 주간 리포트는 이 지층의 "이번 주 한 겹" 으로 흡수.
2. **망각 × 과거의 나** — §B 빈 칸 「과거의 나 × 학기 × 회상률 곡선」: 지난주의 나와 오늘의 나의 R(t) 곡선 두 개를 겹친다.

## 서명 후보
- 들어올 때 이번 주에 새로 생긴 한 겹이 페이드 300ms 로 얹힌다(숫자 카운트업 대신 — 7종 중 페이지 페이드).

## 제약
- 빈 상태가 주인공이 되지 않게 — 기록이 없으면 예시 학습자의 지층(렌즈 4) · 조회 실패와 빈 상태 구분 · 분 기준 통일 · 이모지 제거 · Implicit Progress(0/0/0 카운터 금지).

## 성공 지표
- 기존: `screen_viewed`(dashboard 145 · reports 82 — 표본 부족).
- **신설 필요**: `retrospect_layer_opened { weeksBack: number }` — 재방문은 세션 행에서 파생(D4).
