# 학습 Workspace — 설계 (2026-09-29)

> 상태: **구현됨(2026-09-29) · 계측 마이그레이션 승인 대기.** 요구: 사용자 작업 지시(2026-09-29) · 검토 반영 5건(같은 날).
> 코드: `lib/csat/workspace.ts`(순수 모델) · `lib/csat/workspace-index.ts`(서버 색인) · `components/csat/workspace/*` · 라우트 `(app)/csat/workspace{,/new,/[id]}` · 회귀 `lib/csat/__tests__/workspace.test.ts` · e2e `tests/e2e/51-csat-workspace.spec.ts`.

## 1. 무엇인가

학습자가 기출의 단위 — **유형(26) · 함정(오답 계열 32) · 회차 · 문항** — 를 골라 담아 만든 자기만의 학습 묶음.
만들 때 목표 · 계획 · 방향 · 약점을 적고, 가이드(목적별 5 + 「내 약점으로」)가 구성을 미리 채운다. 안에서 진행과 약점 변화를 보고 부족한 곳을 더 담는다.

## 2. 화면

| 경로 | 요소 |
|---|---|
| `/csat` (기존 메인) | 표 위에 「내 Workspace」 줄 — 카드(이름 · 목표 · 진행 · 약점 칩 · [이어서]) + 「새 Workspace」. 유형·함정 표 · 이어서·복습 · 목적별은 그대로 |
| `/csat/workspace/new` | 만들기: ① 출발점 ② 목표·계획·방향·약점 ③ 구성(칩) + **실제 포함 문항 미리보기** ④ 이름 → 저장 |
| `/csat/workspace/[id]` | 머리(목표·계획) · [다음 3문항] · 담은 것(편집) · 진행 · 약점 변화 · 추천 |
| 레일 | 홈 아래 「내 Workspace」 한 줄 |

## 3. 문항 풀 — 칸 안은 「또는」, 칸 사이는 「그리고」

「빈칸 + 최근 회차」 = **최근 회차의 빈칸**(합집합 아님). 낱개로 더한 문항은 조건과 상관없이 들어간다. 조합의 결과가 직관과 다를 수 있으므로 만들기 · 편집 화면은 **실제 포함 문항(수와 목록)**을 바로 보여 준다(검토 ③).

## 4. 저장 — 저장용 마이그레이션 0개

`DissectionRecord.workspaces`(기기 IndexedDB + 서버 `csat_learner_state.record` jsonb). 풀 · 진행 · 약점은 저장하지 않고 기존 기록(`predictions` · `completed` · `views`)에서 즉석으로 센다 — 기출 데이터 · 기존 기록을 고치거나 복제하지 않는다.

병합(`mergeWorkspaces`, 검토 ④):
- id 단위. `updatedAt` 이 늦은 쪽. **같으면 키 순서와 무관한 직렬화가 큰 쪽** — 어느 기기에서 병합해도 같은 결과.
- 지우기는 **묘비**(`deletedAt`)로 남긴다 — 옛 사본이 되살리지 못한다. 묘비보다 늦게 고친 사본만 산다.
- 보관(`archived`)은 필드라 같은 규칙을 따른다.
- **한계:** Workspace 한 벌 단위로 늦은 쪽을 고른다. 두 기기에서 같은 Workspace 의 다른 칸을 동시에 고치면 한쪽이 사라진다(칸별 시각을 두지 않았다 — 학습자 1인 · 편집 빈도가 낮아 받아들인다).

## 5. 진행 — 기존 학습 포함과 계획 달성을 가른다 (검토 ②)

| 수 | 뜻 | 화면 문구 |
|---|---|---|
| `touched / pool` | 이 풀에서 연 문항 — **만들기 전 학습 포함** | 「연 문항 n/총 (기존 학습 기록 포함)」 |
| `touchedSince` | 만든 뒤에 연 문항 | 「만든 뒤 n」 |
| `studiedThisWeek / perWeek` | 이번 주(월 0시 UTC) · 만든 뒤에 이 풀에서 학습한 문항(해설 열기 · 예측 · 해부, 문항당 1) · 계획 | 「이번 주 학습한 문항 n/m」 |
| `daysLeft` | 기한까지 남은 날 | 「기한까지 n일」 |

## 6. 약점 변화 — 예측 적중 (검토 ①)

- brief A7 예외(2026-09-29 · 이 문서): **예측 결과를 학습 피드백으로 보여 준다.** 풀이 정오 · 점수 · 정답률은 여전히 없다(A2).
- 무엇의 적중인지 함께 쓴다: 유형 축 = 1수 **근거 자리**, 함정 축 = 2수 **오답 계열**(`STEP_TARGET`).
- **표본 수 · 비교 기준을 함께 보인다**: 「최근 5회 중 n · 그 앞 5회 중 m」.
- 표본이 `MIN_JUDGE`(6) 미만이거나 비교할 앞 창이 없으면 **「기록 부족 — 판단 보류」**. 방향(나아짐 · 떨어짐)은 창 5개에서 2개 이상 차이일 때만.
- 「내 약점으로」 가이드는 표본 6 이상 · 적중 절반 미만만 후보로 올린다. 없으면 후보를 만들지 않는다.

## 7. 다음 3문항

안 연 문항 → 약한 유형·계열 → 오래전에 본 문항 순, 같은 순위는 id 순(결정적). 첫 문항을 **출제 사고 화면 `/csat/item/[slug]`** 으로 연다 — 해부 세션(`/csat/dissect`)은 손으로 채운 메타데이터가 있는 소수 문항만 돌려서(실측 2026-09-29: 빈칸 7 · 2026 수능 2) Workspace 풀 대부분을 못 연다. 화면 무변경.

## 8. 계측 (검토 ⑤) — 이벤트용 마이그레이션 1개 예정

| 이벤트 | 속성(숫자 · 불리언 · 닫힌 열거형만) |
|---|---|
| `csat_workspace_created` | starter(6) · types · traps · exams · items(개수) · pool(구간) · has_plan |
| `csat_workspace_opened` | from(home · rail · created) · pool(구간) |
| `csat_workspace_session_started` | size · unseen(개수) |
| `csat_workspace_edited` | action(add · remove · archive · delete · intent) · unit(type · trap · exam · item · mapped · none) |
| `csat_workspace_suggestion_applied` | axis(type · trap) · verdict |

이름 · 목표 · Workspace id 같은 자유 문자열은 보내지 않는다. `funnel_events` 의 DB CHECK 허용 목록에 넣는 마이그레이션은 SQL 을 보여 드리고 **별도 승인** 후 적용한다.

## 9. 문항 색인 (구현에서 바뀐 것)

처음에는 해부 카탈로그를 색인으로 썼는데, 그 카탈로그는 손으로 채운 메타데이터가 있는 소수 문항만 담아(빈칸 7 · 2026 수능 2) 담을 것이 거의 없었다. 지금은 **서가 카탈로그(평가원 802)** 를 뼈대로, 함정은 오답 지도(`build-trap-atlas.mjs`)와 같은 규칙 — 최신 published 분석의 `choice_analysis[].trap` 중 지도에 오른 이름(32) — 으로 읽는다. 문항 하나에 계열이 여럿이라 `families: string[]` 이고, 함정 조건은 그중 하나라도 맞으면 든다. 약점의 함정 축은 2수 예측이 가리킨 계열(`Prediction.family`)로 세고, 계열이 없는 옛 기록은 넣지 않는다(짐작하면 지어낸 수가 된다).
