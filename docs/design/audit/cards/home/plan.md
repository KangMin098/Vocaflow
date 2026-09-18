# S043 `/plan` — 나의 학습 계획 (요일 × 자료 보드)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "공부 루틴을 정할 때, 요일마다 어떤 책·챕터·활동을 할지 직접 짜고 싶다, 그래서 매일 Today 에서 그대로 시작한다"
- 주 사용자: 학생(자기주도형) · 인지 계층: 없음(메타 — 추정)

## 흐름
- 진입: /hub TodayPlanCard(`components/home/TodayPlanCard.tsx:36`) · /dashboard ManageSection(`components/dashboard/ManageSection.tsx:63`) · 셸 직접 링크 없음(Growth `owns` 만 `sidebar-config.ts:119`)
- D7 활성화 경로 밖. 계획이 있으면 /hub 정본이 TodayPlanCard 로 바뀜(`app/(main)/hub/page.tsx:115`)
- 단계: 1. 오늘의 학습 띠 2. 주간 보드(7열) 3. 컴포저 좌: 자료 고르기(탭) → 우: 챕터·활동·요일 구성 → 저장
- 완료 조건: 항목 저장 → 보드에 쌓임
- 1차 행동: 자료 담기/저장(컴포저) · 보조: 오늘 항목 바로 시작(LaunchRow), 보드 항목 편집·삭제
- 나가는 길: `activityLaunchHref` 템플릿 링크(`lib/learner/plan-activities.ts:189-201`) — 정적 그래프는 0건으로 봄

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 오늘 항목 0 문장 `components/plan/PlanClient.tsx:626-629` · 자료 없음 `:496-498` · 빈 요일 열 `:706` | ○ 같은 화면 컴포저가 다음 걸음 · 계획 0개면 오늘 띠 자체가 숨음 `:398` |
| 로딩 | 전역만 | `app/loading.tsx` · 저장 중 `pending` 비활성 | — |
| 오류 | 있음 | 추가/저장/삭제 실패 `role="alert"` `PlanClient.tsx:392-396` | △ 문구만 |
| 부분 | 있음 | 요일 미배정 항목 분리 `:675` | — |
| 완료 | 부분 | 보드 반영(별도 완료 신호 없음 — 추정) | — |

## 자산
- N1 자산: 도서 챕터·공용 단어장 카탈로그(`fetchAvailableMaterials`) — 역할: **없음(데이터만)**
- 형태 씨앗: 없음
- 학습과학 원칙: #2 Spaced Repetition 과 무관한 요일 고정 반복 — 자율성(SDT) 지원이 주 근거(추정)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 제목 + 주묵 세로획(`PlanClient.tsx:378-381`) + 오늘 띠 카드 + 7열 캘린더(`:702` `grid-cols-7 min-w-[820px]`, 모바일 가로 스크롤)
- 골격 판정: **표/격자**(주간 캘린더) + 2열 폼 — G1 축 없음
- 평균 신호(정적): 8 — 그룹 최다(float-hover 7: `hover:-translate-y-px/0.5` `:810,995,1486` · gradient 1 `:1237`)

## 근거
- `apps/web/src/app/(main)/plan/page.tsx:1-3` — 리틀팍스형 · 수능 D-day 폐기
- `apps/web/src/components/plan/PlanClient.tsx` 1,865줄 단일 클라이언트
