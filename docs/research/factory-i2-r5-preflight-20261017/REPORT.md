# Factory I2 — R5(r.central_meaning) 실제 공급 사전 감사

> 읽기 전용 감사다. 기준 main은 `9c19f15b1`, I0 계약은 PR #277 head `6b91ae010`(OPEN · 미병합), 측정 시각은 2026-10-17T09:16:42Z다.
> 위는 **최초 감사 당시** 기준이다. Codex-E가 최신 #277 `4a853dca7`(main 병합)과 새 SELECT로 재현했다. 후속 정정과 수용 범위는 [독립 수용](../factory-i2-independent-20261017/ACCEPTANCE.md)이 정본이다. 최초 AUDIT·DB 스냅샷은 역사 증거로 보존한다.
> DB·RPC·RLS 변경, 주문, 납품, 학생 기록 변경은 **없다**. I0 소유 파일은 고치지 않았다. 해결기 원본은 `git show`로 임시 추출해 실행했고, 실행 뒤 지웠다.
> 증거: [AUDIT.json](./AUDIT.json)(감사기 출력, sha256 `b0de63be…3390`, 두 번 실행해 같음) · [db-snapshot.json](./db-snapshot.json) · [db-revisions.json](./db-revisions.json). 학습자 식별자는 담지 않았다.
> 재현: `snapshot.sql`·`revisions.sql`을 실행해 두 JSON을 저장한 뒤 `cd apps/web && pnpm exec tsx ../../scripts/research/factory-i2-r5-preflight/audit.mts`를 돌린다. 기대값과 다르면 exit 1로 끝난다.

## 0. 결론

| | 값 |
|---|---|
| **I2 신규 영속 납품 적격** | **0 / 전 역할** |
| 이유 | C/B 원장 9개 표 **미설치**(`to_regclass` null) → 해결기 줄 상태 `not_installed`, 신규 생산 필요량 `null`. 설치되더라도 R5 FQ(A~H) 결과가 **0건**이라 13건 모두 `candidate_unreviewed` |
| 기존 학습 화면에서 이용 가능 | 독립 확인 9 · 전이 4 · 지도 연습 13(같은 13문항) · 해설 113(개인별 노출 규칙) · 지연 0 |
| 선행 보고 「재고 13건」 | DB에서 다시 확인했다. claim-support active·B7 승인 13건(확인 9 · 전이 4). 이 13은 **후보 수**이고 적격 수가 아니다 |
| UNKNOWN 승격 | 0. F·E·D·노출 unknown은 하나도 적격으로 세지 않았다 |

## 1. 역할별 재고

R5 TASK 자산은 정의(v4 `r.central_meaning` · `content_keys: ["claim-support"]`)상 claim-support 하나뿐이다. 같은 R5 유형(R-GIST·TOPIC·TITLE) 문항에 출시된 `option-restate` 6건은 **다른 TASK**(선택지 대응)라 R5 공급 후보에서 뺐다.

| 역할 | 후보 | 기존 경로 이용 가능 | I2 적격 | 막는 것 |
|---|---:|---:|---:|---|
| 기출 원문 분석 | 113 | 개인별 | 0 | 근거: 평가원 골격 115 중 공개 v3 113(2014A#24·2014B#23 보류, 학평은 공개 보류). D(교수 적합성) unknown. `supplyFor`는 teaching null인 채로 `available`을 표시한다 |
| 모델 설명 | 113 | 개인별 | 0 | 같은 v3 해설을 역할만 바꾼 것이다(별도 자료가 아님) |
| 지도 연습 | 13 | 13 | 0 | D unknown. 아래 §3의 **평가 자료와 같은 문항** 문제 |
| 독립 확인 | 9 | 9(신규 학습자 기준) | 0 | C/B 미설치 · F/E unknown · assessment 승인 원장 없음 |
| 새 지문 전이 | 4 | 4(신규 학습자 기준) | 0 | 같음 |
| 지연 재확인 | 0 | 0 | 0 | 전용 자료·실행기 없음. `supply.ts`는 안 본 확인 문항을 재사용하고, 최소 지연은 미구현(R15) |

후보 풀 전체(DB): R-CLAIM 127 · GIST 132 · TITLE 137 · TOPIC 134 = 530문항, 이 중 학평(교육청) 415. 학평은 공개 보류 결정에 따라 후보로 세지 않았다.

## 2. 13건 문항별 상태

모든 문항에서 공통으로 확인된 것: 출시 `knowledge_applications` active · `release_approved_at` 있음(B7) · 평가원 출제(kice) · body_ok · 정답 있음 · 분석 published(v4, 2022#20·2026#23·M2609#23은 v5) · 주석 reviewerBlind=true · 골격 서명 **13/13 일치** · `csat_items_public` 노출 · 같은 지문 다른 문항 0 · B 공식 revision 산출 가능. reviewerBlind는 전체 Gold 자격이 아니다. 전이 주석의 두 판정자는 같은 계열 AI이고, 일부 확인 관계 판정은 사후 합의를 포함한다.

공통으로 **없는** 것: 문항 단위 권리 기록(F) · 평가 Gold 자격(E) · 교수 적합성(D) · `content_release_approval`(public/assessment). 출시 원장의 B7 승인은 C의 공개/평가 승인과 **다른 객체**라서 대신 쓰지 않는다. `units_hash`는 13건 모두 null이다.

| 문항 | 역할 | 유형 | 실사용자 시도 | 합성 시도 | 해설만 열람 | 비고 |
|---|---|---|---:|---:|---:|---|
| 2016#20 | 확인 | CLAIM | 0 | 13 | 0 | |
| 2020#20 | 확인 | CLAIM | 0 | 13 | 0 | |
| 2021#20 | 확인 | CLAIM | 0 | 14 | 0 | |
| 2022#20 | 확인 | CLAIM | **1** | 14 | 0 | G2 실사용자 시도 |
| 2025#20 | 확인 | CLAIM | 0 | 13 | 0 | |
| 2026#20 | 확인 | CLAIM | 0 | 13 | 합성 1 | |
| M2506#20 | 확인 | CLAIM | 0 | 13 | 0 | |
| M2606#20 | 확인 | CLAIM | 0 | 14 | 0 | |
| M2609#20 | 확인 | CLAIM | 0 | 13 | 0 | |
| 2020#24 | 전이 | TITLE | 0 | 0 | 0 | 노출 0 |
| 2021#24 | 전이 | TITLE | 0 | 0 | 0 | G2/세션/dx 0 · trap 26행(1명) |
| 2026#23 | 전이 | TOPIC | 0 | 0 | 합성 1(세션 8) | **option-restate 확인으로도 출시** |
| M2609#23 | 전이 | TOPIC | 0 | 0 | 0 | 노출 0 |

dx 응답·응시 회차 기록은 이 13문항에 0건이다. 위 노출 표의 시도는 **G2만** 센다. 확장 SELECT에서는 `csat_trap_attempts`에 2021#24 26행(1명), 2025#20 6행(1명), 2026#23 1행(1명)이 있다. 앞 두 학습자의 해당 문항 노출은 최초 snapshot의 G2·세션·dx 검사에 잡히지 않는다. 따라서 위 표의 0을 전체 원장 무노출로 해석하지 않는다. 해설 113도 전체 카탈로그이며 Workspace의 실제 연결 자료 수와 다르다([독립 수용 §1](../factory-i2-independent-20261017/ACCEPTANCE.md)).

## 3. 감사에서 새로 드러난 사실

1. **확인 시도가 `phase='practice'`로 기록된다.** `product-server.ts:192`는 전이만 `transfer`로 기록하고, 독립 확인은 연습과 같은 phase로 남긴다. phase만으로는 구별할 수 없지만, 확인의 `activity=theater`와 연습의 `activity=practice`로 원장 전체에서는 구별 가능하다. 실측된 G2 시도는 theater/practice다.
2. **지도 연습 풀과 평가 자료가 같은 13문항이다.** `/csat/practice/claim-support`(`practice-server.ts serverPool`)는 같은 13 주석 문항을 사용한다. 전이 유형은 연습 화면에서도 phase=transfer일 수 있으므로 activity·TASK·역할·도움·세션을 함께 읽어야 한다. 연습으로 열린 문항은 같은 학습자의 독립 확인·전이 납품에서 제외한다. I0 순수 해결기는 노출을 입력받으면 거절하지만, 미설치 B reader가 실제 G2를 읽는다는 뜻은 아니다.
3. **2026#23은 같은 문항이 두 역할로 출시되어 있다**(option-restate 확인 + claim-support 전이). 현재 currentItemTask는 claim-support를 먼저 반환하므로 option-restate 우선 풀이 경로는 재현하지 않았다. 다중 출시의 실행 우선순위와 동일 문항 타 TASK 노출을 관리해야 한다. 실제로 합성 학습자 1명이 G2 시도 없이 해설을 8번 열었고 trap 기록도 1행 있다. 이 학습자에게 미노출 전이로 공급하면 안 된다.
4. **`supply.ts`는 확인·전이 줄의 자격 7필드를 상수 true로 채운다.** I1 위험 #2(해설 teaching null)보다 범위가 넓다. 학습자 진단 화면이 「검수된 확인 과제」라고 하는 근거는 B7 출시 원장이고, FQ 자격 원장이 아니다. I0 해결기는 이 값을 쓰지 않아 영향이 없다.
5. **B의 csat_item revision은 stem을 포함한다**(`sha256(stem|passage|choices|answer)`). 주석 revision(skeletonSig·annotation hash)과 분석 revision은 들어가지 않는다. 주석이 바뀌어도 B revision은 그대로라서, I2는 자격 행에 주석 hash까지 결속해야 한다.

## 4. I0 계약 대조(PR #277 해결기 실측)

| 상황 | 해결기 결과 |
|---|---|
| **지금 실제**(원장 미설치) | 줄 `not_installed`, `newProductionNeeded = null`(0으로 바꾸지 않음) |
| I1 설치 뒤 FQ 없음 | 확인 9/9 · 전이 4/4 `candidate_unreviewed:qualification` |
| 반례 fixture 기준(축 전부 pass + 승인 2종을 **가정**) | `eligible_existing`. 가정일 뿐 실제 적격이 아니다 |

## 5. 반례 결과

기준 fixture(2020#24 전이)에서 조건을 하나씩만 바꿨다. 모두 PR #277 원본 해결기로 판정했다.

| 반례 | 결과 | 판정 |
|---|---|---|
| 이미 푼 문항 | `blocked_exposure:learner:attempted` | 막힘 ✔ |
| 해설만 본 문항 | `blocked_exposure:learner:explanation_seen` | 막힘 ✔. 단 현재 B `supply_learner_exposure`는 이 원장을 읽지 않는다 → I1 delta D1 필요 |
| 동일 지문 다른 문항 노출 | `blocked_exposure` | 막힘 ✔ |
| 동일 지문 두 번째 평가 자료 | 두 번째 `blocked_exposure:shared_passage` | 막힘 ✔ |
| 노출 조회 불가(null) | `blocked_exposure:learner:unknown` | fail-closed ✔ |
| currentRevision 문자열 변경 fixture | `candidate_unreviewed:revision_mismatch` | 막힘 ✔. 주석만 변경했을 때 reader가 revision을 바꾸는 실증은 아니다. B에는 주석이 빠져 있음(§3-5) |
| 출시 승인 철회 | `awaiting_release` | 막힘 ✔ |
| 권리 미확인(F unknown) | `candidate_unreviewed:rights` | 막힘 ✔ |
| 평가 자격 미확인(E unknown) | `blocked_gold:E` | 막힘 ✔ |
| 실행기 미지원 | `blocked_runner` | 막힘 ✔ |
| 역할 불일치(확인 자격을 전이에) | `candidate_unreviewed:role_mismatch` | 막힘 ✔ |
| 조회 실패 | 줄 `read_error`, 필요량 `null` | ✔ |
| 같은 ref 상충 행 | `candidate_unreviewed:conflicting_candidate` | ✔ |
| 사용자 소유권 불일치 | 해결기는 보지 않음. 수요 서명은 사용자별로 달라짐 | **NOT_TESTED**: B RLS가 미설치 |
| 서로 다른 목표·PLAN revision | 해결기는 보지 않음. 서명이 달라져 새 수요가 됨 | 구별만 확인. 거부·재주문 동작은 I1 뒤 시험 |

## 6. 최초 I2 수직 시나리오(R5 전이 한 줄)

**최초 자격 검토 후보: `2020#24` 전이**(평가원 2020 수능 · TITLE). 적격 납품 자료로 확정하지 않는다. `2021#24`의 전역 무노출 대안 추천은 trap 노출 26행·1명 확인으로 철회한다.
이유: 2020#24는 확장한 7경로 노출 조회에서도 0이며, 단일 출시 역할·같은 지문 다른 문항 0이다. 학습자별 공급 직전에는 다시 검사한다. 제한된 claim/support/relation 채점이 R5 전체·제목 선택 능력·자유 요약을 입증하지 않으며, 교수·Gold·권리 자격은 별도다.

| # | 질문 | 현재 답 |
|---|---|---|
| 1 | WorkspaceDemand 발생 | `demand.ts` 템플릿 `ws.central-meaning`이 전이 줄을 만든다. 영속 수요 `workspace_content_demand`는 미설치 → 화면 안 파생값만 있다 |
| 2 | 적격 자료 찾기 | 후보 4개는 찾는다. 적격은 0이다(FQ·승인 원장 없음) |
| 3 | revision·역할 결속 | B revision으로 문항은 고정된다. 주석 hash는 결속되지 않는다(§3-5). 역할은 출시 행 audience.role에만 있다 |
| 4 | 이미 본 자료 제외 | 해결기는 제외한다. 현재 B SQL은 G2 시도·해설 열람을 못 본다(I1 위험 #1) · 연습 노출은 phase로 구별되지 않는다(§3-1·2) |
| 5 | 납품 시 C/B 기록 | 실제 자격·승인 근거 확보 뒤 `content_qualification` → `content_release_approval` public + assessment → `workspace_content_demand(_line)` → 재고 재사용 납품 `workspace_content_delivery(order_id=null)`. `NOT_NEEDED`는 ProductionNeed 판정이며 B의 factory_order 상태가 아니다. 주문을 만들 필요가 없다 |
| 6 | 기존 화면 실행 | 예. 문항 과제 API(`api/csat/item/[slug]/task` → `recordItemTaskAttempt`)가 `phase=transfer`로 채점·기록한다 |
| 7 | G2 환류 | 시도는 `learning_task_attempts`에 들어간다(application_id · content_hash). **납품 id와 연결하는 칸은 없다**. 납품된 자료의 결과인지, 학습자가 스스로 연 결과인지 원장에서 구별하지 못한다 |
| 8 | I1 뒤 별도 검증 | 아래 §7 |

## 7. I1 설치 뒤 추가 조건 · I2 종단 검증 계획

설치 전 결정·보완:
1. I1 delta D1(노출에 G2 시도·해설 열람 포함)과 D2(승인 범위 정합), 그리고 독립 SQL 감사의 NULL 거절·`IS NOT TRUE` 권한 보완을 적용 묶음에 넣는다.
2. 자격 행에 **주석 hash**를 결속하는 규칙을 정한다(B revision만으로는 주석 변경을 못 잡는다).
3. 연습·확인은 activity로 구별하되 모든 노출을 합친 reader를 사용한다. phase 변경은 G2 소비자 영향 검토 후 결정한다. trap·문항만 열람·삭제 세션·도움·동일 지문도 검사한다.
4. 같은 문항을 여러 역할로 출시하는 것(2026#23)을 허용할지 결정한다.
5. 납품 ↔ 시도 연결 칸(delivery_id)을 둘지 결정한다(G2 환류 귀속).

종단 검증(승인 뒤, 개발 DB · 합성 학습자):
1. `/db-checkpoint before` → C/B(+delta) 적용 → `after` diff.
2. 2020#24 전이 자격 1행 기록(근거: 주석 맹검 2인 · 원문 B revision · 권리 F의 실제 근거 문서). 근거가 없으면 기록하지 않고 멈춘다.
3. public + assessment 승인 → 해결기 `eligible_existing`, 노출 none 학습자에게 납품 1행.
4. 같은 학습자가 화면에서 풀이 → `learning_task_attempts phase=transfer` → 재계산 시 노출 `attempted`, 두 번째 납품 거절.
5. 반례 재실행(§5)을 실제 원장으로: 해설만 열람 · 연습으로 연 문항 · 승인 철회 · 주석 변경 · 다른 학습자 소유 납품 읽기(RLS 거절) · goal/PLAN 개정 시 새 수요.
6. 이 감사기를 실제 원장 reader로 다시 돌려 `AUDIT.json` 후속판과 비교한다.

## 8. 하지 않은 것

DB·RPC·RLS 변경, `apply_migration`, 자격·승인·주문·납품 행 생성, 학생 기록 변경, I0·I1 소유 파일 수정, FQ 판정(자격을 내가 매기지 않았다), 학습 효과 주장. 반례의 「전부 pass」 fixture는 **가정**이며 어떤 문항의 실제 자격도 아니다.
