# LM-G1.1 — R5 학습 단계 · 다음 행동 통합(단계 판정 수정 · 수용 보고서)

> 기준 main `914c16096`(PR #270 병합 뒤) · 브랜치 `fix/lm-g1-1-r5-next-action`.
> 범위: R5(`r.central_meaning`) REPAIR 단계의 **다음 행동 판정**만. 화면 구조 · 디자인(PR #270) · DB/RPC/RLS · 기존 기록 · CHECK `resolved` 정책 · 지연 정책 · TargetSpec · V2/S5 · 교재공장 변경 없음.
> 합성 계정 · 순수 함수 검증 — **학습 효과 증거가 아니다.** 독립 검증(Codex) 전 — ACCEPT · 제품 완성을 선언하지 않는다.

## 1. 기존 G02 재현

LM-G1 감사 G02([lm-g1/probes.json](./lm-g1/probes.json) — 원본 그대로 · 덮어쓰지 않음):

| | 수정 전(원본 관찰) |
|---|---|
| 직접 확인 i1 · i2 오답 | R5 = 확인된 요구 · REPAIR |
| 바로잡기 i1 · i2 다시 풀어 **모두 오답** | 수행량(doneOf repair) = 2 |
| PLAN 단계(`stageNow`) | **transfer** — 다음 행동 `/csat/practice/claim-support?item=t1` |
| lifecycle(`nextLifecycleAction`) | **repair** — 성공 근거(repairAt) 없음 |

같은 근거를 PLAN 은 「적용」, lifecycle 은 「바로잡기」로 말했다. 이번 브랜치에서 새 테스트로 다시 재현(수정 전 코드에서 T02 · T03 · T08 · T10 실패 — 단계가 transfer 로 넘어가고 재시도 대신 적용 문항 링크).

## 2. 원인과 바꾼 함수

| 원인 | 위치 | 수정 |
|---|---|---|
| 단계 이동을 **수행량**으로 판단 — `doneOf('repair') < count` 이면 바로잡기, 아니면 다음 단계 | `v4/plan.ts` `stageNow` | 바로잡기 → 다음 단계는 **성공 근거**(`repairGate().succeeded`)로만. 수행량(doneOf)은 그대로 센다 |
| 재시도 링크가 「이미 시도한 문항」을 빼서, 다 틀려도 링크가 사라짐 | `v4/plan.ts` `stageLink` | 바로잡기 링크 = 이번 회차에 **아직 맞히지 못한** 막힌 문항(틀린 시도가 있어도 재시도 대상). 없으면 null(실제 막힘) — 다른 단계 자료로 바꿔 열지 않음 |
| PLAN 에 정오가 없었음 | `v4/plan.ts` `PlanActivity` | `isCorrect?: boolean \| null` 타입만 추가(`load.ts` 의 `lifecycleActivity` 가 이미 `is_correct` 를 싣고 있음 — 로더 변경 없음) |
| 다시 확인 실패 시각이 As-Is 에 없어 재바로잡기 창을 PLAN 이 못 씀 | `v4/as-is.ts` `check` | `lastWrongAt`(skillDiagnosis 그대로) 추가 |
| 성공 기준이 두 군데(lifecycle 문자열 · PLAN 수행량) | `lifecycle-evidence.ts` | 회차 창 `repairWindow` · 이번 회차 시도 `repairAttempts` 를 꺼내 **lifecycle 과 PLAN 이 같은 함수**를 쓴다. 규칙은 기존 그대로(정답 true 만 성공 · 확정 뒤 · 다시 확인에서 막혔으면 그 막힌 문항을 그 뒤에) |
| Workspace 행이 계획 링크가 없으면 Workspace 확인 문항으로 대체 | `v62/workspace-list.ts` | 계획이 바로잡기 · 적용 단계인데 링크가 없으면 대체하지 않음(확인 · 다시 확인 단계만 같은 출처라 허용) |
| `resolved` 문구가 「연습하고 … 해냈어요」 — 바로잡기 · 적용 기록 없이 독립 CHECK 만으로도 나옴 | `skill-diagnosis.ts` `skillMessage` | 문구만: 「처음 확인 뒤, 풀지 않았던 확인 문항 N개를 혼자 해냈어요. 이번 확인 기준으로는 다시 확인됐어요 …」. 판정 · 120일 기한 불변(기한은 지연 확인 증거로 말하지 않음) |

새 성공 기준을 더 엄격하게 만들지 않았다 — 기존 lifecycle 의 「막힌 문항을 이번 회차에 정답」 그대로를 PLAN 에도 적용했다.

## 3. 수행량과 단계 준비의 분리

| 칸 | 뜻 | 출처 |
|---|---|---|
| 수행량 `quantity.done` | 이번 회차에 막힌 문항을 다시 푼 **서로 다른 문항 수**(정오 무관) | `doneOf`(변경 없음) |
| 단계 준비 | 막힌 문항을 이번 회차에 **맞힌** 근거가 있는가 | `repairGate` → `repairAttempts`(lifecycle 과 공용) |
| 성취 `achievement` | 직접 확인 판정 | As-Is(변경 없음 — 수행 · 단계는 성취를 바꾸지 않는다) |

적용(TRANSFER)은 기존 정책 그대로 — 계획량(2지문)만큼 진행하고, 자료가 없으면 건너뛴다. lifecycle 의 「적용 경험」(1회)과 PLAN 의 운영 수행량(1/2)은 다른 칸으로 둔다(T05).

## 4. 다음 행동 단일 출처

모든 표면이 `taskPlan`(stage · next) 하나에서 나온다:

```
lifecycle-evidence.repairAttempts ─▶ plan.repairGate ─▶ stageNow · stageLink ─▶ TaskPlan.next
   ├ ranksOf ActionRank ─▶ 상단 띠 · 빠른 팝업 · 근거 드로어(taskInspector)
   ├ workspacePlan ─▶ Workspace 상세 모달 단계 · PLAN 탭(plan-go)
   └ workspaceRows ─▶ Workspace 리스트 행(막힌 단계는 대체 링크 없음)
```

## 5. 테스트

### 순수 함수 — `v4/__tests__/plan-lm-g1-1.test.ts` 15 · `v62/__tests__/workspace-list.test.ts` +4

| | 내용 | 결과 |
|---|---|---|
| T01 | 직접 확인 2 실패 → REPAIR · 막힌 문항 링크 | PASS |
| T02 | 바로잡기 2 실패 → 수행 2 · 단계 REPAIR | PASS(수정 전 FAIL) |
| T03 | 재시도 링크 = 막힌 문항 | PASS(수정 전 FAIL) |
| T04 | 정답 바로잡기 → TRANSFER | PASS |
| T05 | 적용 1회 → lifecycle 경험 있음 · PLAN 1/2 | PASS |
| T06 | 적용 자료 없음 → 적용 단계 · 완료 꾸밈 없음 | PASS |
| T07 | 독립 CHECK 2 성공 → resolved 그대로 | PASS |
| T08 | 다시 확인 실패 → 그 막힌 문항을 그 뒤에 맞혀야 함(이전 성공 승계 없음) | PASS(수정 전 FAIL) |
| T09 | 바로잡기 · 적용 없이 resolved — 문구가 연습 완주 · 지연 확인으로 말하지 않음 | PASS(수정 전 FAIL) |
| T10 | 정오 null → 성공 아님 | PASS(수정 전 FAIL) |
| T11 | 이전 회차 성공 승계 없음 | PASS |
| T12 | 다른 과제 키 근거 혼합 없음 | PASS |
| T13 · T14 · T17 | 리스트 행 단계 · 링크 = 계획 · 막힌 단계 대체 없음 | PASS |
| lifecycle | 같은 반례에서 lifecycle 도 REPAIR | PASS |

기존 테스트 3개(`plan.test.ts` ② · ③ · `state-transitions.test.ts` F)는 「막힌 문항을 다시 풀면 적용으로」를 **정오 없이** 기대해 G02 결함을 고정하고 있었다 — 의도(다시 맞힌 경로)를 유지하고 그 시도에 `isCorrect: true` 를 넣었다. `plan.test.ts` 의 날짜 픽스처(`2026-09-9`)는 두 자리로 맞췄다(문자열 비교 — 실제 ISO 와 같게).

전체(`src/lib/csat` · `components/csat` · `lib/learner` · `lib/knowledge`) **2,366 통과** · 68 skip(통합 환경 미설정 — PASS 아님) · tsc · eslint 0 · `agents/scripts/check.mjs` 15/15.

### G02 / G03 revision 2 — [lm-g1-1/probes-r2.json](./lm-g1-1/probes-r2.json)

같은 fixture(`scripts/research/lm-g1/fixture.ts`) · 같은 입력. 원본 `lm-g1/probes.json` 은 읽기만 했다.

| | before(원본) | after |
|---|---|---|
| G02 | planStage transfer · lifecycle repair | 수행 2 · **planStage repair = lifecycle repair** · planNext `/csat/item/i1` |
| G02 대조 | — | null 재시도 → repair · 정답 재시도 → transfer(PLAN = lifecycle) |
| G03 | resolved · 기록된 바로잡기 0 · 적용 0 | resolved 그대로 · 문구에서 「연습하고」 제거 |

(`scripts/research/lm-g1/verify.mjs` 는 감사 당시 소스 해시를 고정하므로 이제 「audited source changed — create a new audit revision」 으로 멈춘다 — 의도된 동작이고, 이 revision 2 가 그 새 revision 이다. CI 대상 아님.)

### 실제 브라우저 — `scripts/csat/map/v62/e2e-lm-g1-1.mjs` **9 PASS · 0 FAIL**(1440 · 개발 서버 · 합성 계정 1 → 남은 0)

[results.json](./evidence/lm-g1-1-20261015/results.json) · 화면(드로어 · 모달 · PLAN × 단계). 시도는 기존 기록 API(`/api/csat/item/{slug}/task`)로만 — 정답 · 오답은 주석 정답으로 만든다.

| | 확인 | 결과 |
|---|---|---|
| T01 | 확인 2 오답 → 팝업 · 드로어 · 행 · PLAN 이 같은 막힌 문항(2022-20) | PASS |
| T02 | 바로잡기 2 오답 → PLAN `data-stage=repair` · `data-done=2` · 모달 지금 단계 repair | PASS |
| T03 · T16 | 재시도 링크 존재 · 막힌 문항 | PASS |
| T13 · T14 · T15 | 팝업 = 행 = 모달 = PLAN 탭 = 드로어 링크 | PASS |
| T18 | 행의 다음 행동 → 문항 → 「학습 지도로」 → 같은 TASK · Workspace | PASS |
| T04 | 정답 1 → PLAN · 모달 · 행 · 팝업 모두 「다른 글에 적용」 · 같은 링크 | PASS |
| T17 | 행 상태와 링크 일치(링크 없으면 학습 가능 아님) | PASS |
| T19 | 과거 asof → 팝업 · 행 · 띠 · 드로어 · 모달 · PLAN 학습 시작 링크 0 | PASS |
| T20 | 페이지 가로 넘침 0 | PASS |

### 회귀(같은 서버 · 같은 HEAD)

| 묶음 | 결과 |
|---|---|
| LM-W1 통합 화면 `e2e-map-workspace`(1280 · 1440 · 레일) | 36 / 0 |
| 복귀 `e2e-map-return`(저장 PLAN v1 · v2 · 목표 변경 · 남의 UUID · 과거 보기) | 7 / 0 |
| 기출 해부 `e2e-map-study` | 6 / 0 |
| R5 공급 `e2e-map-supply` | 6 / 0 |

로그 · 화면: [evidence/lm-g1-1-20261015](./evidence/lm-g1-1-20261015/).

## 6. 보존한 것

- 기존 기록(학습자 · DB) 변경 · 삭제 0. 새 테이블 · 엔진 0. 로더(`load.ts`) 변경 0.
- 저장된 PLAN(append-only) · 계획량 · 진행량 · 성취는 의미 그대로 — 수행량은 숙달률이 아니고, 바로잡기 성공은 R5 능력 숙달이 아니다.
- CHECK `resolved` 정책 · 120일 기한 · NeedRank/ActionRank 구분 · 30 TASK id · composeV4 · PR #270 화면.

## 7. LM-G1.2 에 남긴 것(이번 PR 아님)

- 실제 DB 쓰기 종단(실학습자 수행 → 지도 갱신 → PLAN 새 버전) — 이번 브라우저 검증은 합성 계정 · 개발 DB.
- 1280 에서 LM-G1.1 표면 일치(이번엔 1440 · 1280 은 LM-W1 회귀로만).
- 적용(TRANSFER) 운영 계획량(2) vs lifecycle 최소 경험(1)의 정본 결정 — 지금은 둘을 다른 칸으로 둔다.
- 바로잡기 자료가 아예 없을 때의 학습자 문구(지금은 「앞 단계 뒤에 열려요」 류 차단 표시).

## 8. Codex 독립 검증 대상

1. 바로잡기 성공 기준이 기존 lifecycle 과 정확히 같은가(더 엄격 · 느슨하지 않은가) — `repairWindow` · `repairAttempts`.
2. 모든 표면이 `taskPlan` 하나에서 나오는가 — 특히 `workspace-list` 의 대체 금지 조건.
3. 바꾼 기존 테스트 3개의 기대가 정당한가(정오 추가 · 날짜 두 자리).
4. `resolved` 문구가 판정을 바꾸지 않고 근거만 정확히 말하는가.
