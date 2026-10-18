# LM-G1 — 최종 목표 완성의 최소 변경 로드맵

2026-10-15 · [Gap 감사](GOAL_GAP_AUDIT.md)에 근거한 Claude Code 구현 계약. 교육 정본을 다시 설계하는 계획이 아니다. 순서는 필수성→선행 의존성→재사용→실제 완성까지의 작업 범위→오판/권한 위험으로 정했다. 시간 추정이나 학생별 필요 총량은 산출하지 않았다.

## 1. 가장 짧은 경로

**LM-G1.1 단계 준비 조건 일치 → LM-G1.2 기존 R5 수직/저장 복귀 실제 수용**을 먼저 끝낸다. 병행 가능한 다음 묶음은 **LM-G1.3 목표 버전 연결**이다. 그 뒤 **LM-G1.4 수행·노출·지연 계약**, **LM-G1.5 V2/S5의 실제 지원 확대**를 진행한다. **LM-G1.6 실제 공장 연결**은 별도 승인/외부 입력 경로다. R5 검증을 Factory 대기 때문에 멈추지 않는다.

| 단위 | 최종 목표에 필수인 결과 | 선행 조건 | 재사용/상대 범위 | 위험 | DB 승인 |
|---|---|---|---|---|---|
| LM-G1.1 | PLAN·lifecycle의 다음 행동이 같은 증거를 설명 | 없음 | 기존 함수 조정, 가장 작음 | 높은 단계 오판 | 불필요 |
| LM-G1.2 | 동일 학생의 원자 저장→새 MAP/추천→명시 저장 PLAN/복귀 | 1.1 | 기존 route/RPC/E2E 재사용 | 권한·중복·역사 보존 | 기존 RPC 사용에는 불필요; 현재 감사의 쓰기 금지는 유지 |
| LM-G1.3a | 설치된 목표 열·버전의 제품 연결/옛 PLAN 기준 설명 | 1.1과 독립 가능 | 기존 열·API adapter 확장 | 잘못된 목표 기준 | 기존 열 읽기/쓰기 계약 안에서는 불필요 |
| LM-G1.3b | 시간 예산·전체 시험 범위·등급 단독 목표 영속화 | 1.3a, 의미/버전 계약 | 신규 delta 최소화 | 역사/변환 | 스키마/RPC 변경 시 필요 |
| LM-G1.4 | 정성 수행 조건·독립/전이/지연의 판정 분리 | 1.2/3 목표 기준 | 기존 policy/metadata 재사용 | 높은 교육적 과장 | JSONB/현 RPC 재사용 검토 후 필요한 차이만 승인 |
| LM-G1.5 | V2/S5 평가 도구와 적격 지원, E3 범위 명확화 | 1.4의 증거 계약 | TASK ID/Workspace/기출 자산 재사용 | 도구를 능력으로 과장 | grader/RPC/공개 정책 변경 시 필요 |
| LM-G1.6 | 실제 주문·검수·공급; 여전히 효과와 구별 | 승인 A3/A/C/B·실제 외부 공장 | 수용된 v1.2 계약 유지 | 미검수 상품 승격 | 필요, 현재 외부 입력 대기 |

## 2. LM-G1.1 — 다음 Claude 작업의 정확한 범위

**문제:** `doneOf('repair')`의 시도량으로 `stageNow`가 transfer를 선택하는 동안 `lifecycleEvidence`는 성공한 repair가 없다고 판정한다. [G02](lm-g1/probes.json)는 현행 main에서 이를 재현한다.

**소유 파일 범위(루트 `apps/web/src/`):**

- `lib/csat/map/lifecycle-evidence.ts`: 기존 성공 근거·다음 행동 정책을 재사용/공유하는 단일 판정 함수. 과거 status를 재판정하거나 교수 효과 기준을 새로 만들지 않는다.
- `lib/csat/map/v4/plan.ts`: `doneOf`는 진행량으로 유지. 별도의 readiness로 `stageNow`/`taskPlan`의 next를 결정한다. `PlanActivity`에 필요한 correctness를 추가하면 loader의 기존 raw 필드를 전달한다.
- `lib/csat/map/skill-diagnosis.ts::skillMessage`: 실제 연습 이력이 없는 resolved에서 연습 완료를 암시하지 않도록 문구의 근거만 맞춘다. 상태 판정 알고리즘 자체는 바꾸지 않는다.
- `lib/csat/map/load.ts`: 기존 읽기 결과의 correctness 전달이 필요한 경우에만 변경. 새 저장 경로/RPC를 만들지 않는다.
- `lib/csat/map/v4/workspace.ts`, `v62/rank.ts`: 실제 다른 판정이 남는 경우에만 공통 결과를 소비하도록 연결한다. 랭커·composeV4 전면 교체 금지.
- 위 함수의 기존 `__tests__` 및 `scripts/research/lm-g1/audit.test.ts`는 역사적 관찰을 덮지 말고 새 revision의 회귀 테스트를 추가한다. 감사 G02 입력을 복제하되 수정 후 기대와 최초 관찰을 구별한다.
- 문서: 해당 동작 정본/모듈 설명/CHANGELOG와 새 검증 결과를 같은 PR에 둔다. UI가 실제로 바뀌지 않으면 불필요한 화면 재설계는 하지 않는다.

**불변식:** 시도량≠정답량≠도달도. 실패 2회의 진행은 남고 성공한 repair가 없으면 해당 교수 경로의 다음 행동은 repair다. 기존 lifecycle의 성공 근거 정의를 먼저 사용한다. 현재의 ‘하나의 적격 성공’보다 엄격한 기준을 원하면 별도 정책 버전/근거를 명시하며 이 수정에 섞지 않는다. 스스로 독립 CHECK에 도달한 학생에게 일률적으로 모든 교수 단계를 강제하지 않는다.

**인수:** [수직 수용](R5_VERTICAL_ACCEPTANCE.md)의 R01~R06 및 기존 plan/lifecycle/rank/coverage 테스트가 통과하고, MAP·Inspector·PLAN·legacy 링크가 동일한 정책 결과를 사용한다. 지원 자료가 없으면 content_needed/대기이며 기존 또는 mock 자료로 우회 승격하지 않는다. 실패 항목을 이미 시도했다는 이유로 repair 링크가 사라지지 않도록 `stageLink`의 재시도 선택도 검증한다. legacy의 첫 transfer 근거와 PLAN의 2개 운영량 차이를 명시하고, 하나의 근거를 같은 충분성으로 포장하지 않는다. DB/RPC/RLS 변경 없이 PR을 제출한다.

## 3. LM-G1.2 — 실제 수직 경로와 저장 PLAN

**소유 범위:** 위 수정 함수, `/api/csat/item/[slug]/task`, `/api/csat/practice/attempt`, `/api/csat/diagnosis/map/{goal,plan}`, `lib/knowledge/{product-server,practice-server,practice-writer}.ts`, `lib/csat/map/v4/{plan-store,plan-commit}.ts`, `v62/return-ctx.ts`; `scripts/csat/map/v62/e2e-*`의 기존 시나리오를 확장한다. 제품 코드 수정은 새 반례로 드러난 결함에 한정한다.

**재사용:** 기본 원자 writer `learning_attempt_submit`, 첫 시도/도움 필터, 서버 user_id, dynamic MAP 로드, append-only PLAN commit/restore, API retry 충돌 검증. 새 journal/재계산 엔진/병렬 PLAN 저장소를 만들지 않는다.

**인수:** R01~R16. 실행별 소유권이 있는 격리 계정/환경에서 두 번의 독립 FIND 실패→실패 repair 유지→성공 근거→적격 transfer→독립 CHECK→같은 학생의 새 MAP/NeedRank/PLAN을 확인한다. 실제 자료가 부족하면 그 단계만 BLOCKED와 제외 사유로 남긴다. 없는 자료를 mock으로 채워 live PASS로 만들지 않는다.

저장 PLAN이 없을 때 생성, 순서/수량 변경, 새 버전 저장, 이전 PLAN 복원은 각각 검증한다. 새 수행은 최신 상태/추천을 바꾸지만 저장 PLAN을 몰래 덮지 않는다. 과거 goal_version_id 설명을 history read model에 전달한다. 구 URL로 돌아오면 계약대로 최신 기준 변경 안내를 보이며, 명시 복원과 자동 과거 목표 되감기를 혼동하지 않는다.

이번 감사는 DB 쓰기를 금지했으므로 live 결과는 NOT_TESTED다. 다음 실행에서 환경/계정 소유권·쓰기 범위를 명시하고 승인된 기존 기능만 사용한다. 오류 상태에서 성공 toast·중복 증거·타인 데이터·빈 PLAN 덮어쓰기가 없음을 검사한다.

## 4. LM-G1.3 — 목표 버전과 요구 연결

**3a 파일 범위:** GoalBar와 목표 입력 컴포넌트, goal API, `v4/{definition,plan-store,load,to-be,compose}.ts`의 실제 책임 파일, `v62/{target-spec,rank,return-ctx}.ts`. 목표가 어디서 소비되는지 데이터 흐름으로 검사하며 저장만 되고 계산은 옛 score를 쓰는 완료를 금한다.

**3a 인수:** 설치된 score/grade/exam/date 열을 정규 입력·read model·버전에 결속한다. 구 score-only 목표는 그대로 읽힌다. 불명확한 점수/등급 조합은 설명/확인 없이 예측 변환하지 않는다. 목표 변경은 새 버전, 과거 PLAN의 goal 버전은 보존, 구 링크는 변경 안내, 동일 요청은 멱등이다. scope별 자료·관련성 분모를 실제 메타데이터와 대조한다. 필요 시험 자료가 없으면 지원 부족으로 표시한다.

**3b 승인 delta:** 기존 score 필수, 단일 exam 열의 범위, 시간 예산 미보관을 기준으로 grade-only/복합 scope/예산/버전 snapshot에 필요한 최소 열·JSONB·RPC 차이를 비교한다. 기존 nullable 열이 있는데 새 테이블을 중복 생성하지 않는다. SQL·권한·이관/되돌리기·옛 버전 의미·멱등 signature를 제출하고 승인 전 미적용으로 유지한다.

## 5. LM-G1.4 — 학습 기준·노출·지연

**파일 범위:** `skill-diagnosis.ts`, `lifecycle-evidence.ts`, `lib/knowledge/{find-outcome,prior-help,item-tasks,claim-support}.ts`, writer의 기존 metadata, v62 coverage/research/study-items, Workspace의 기준 설명. DB가 필요한 부분은 `_pending_` 제안과 문서만 작성한다.

**계약:** TASK ID·현재 자료 revision/annotation·원문 제시형/공유 지문 ID·instrument/rubric/policy version·phase·독립성/도움·노출·timestamp·목표 버전을 결속한다. 기록하지 못한 필드를 true로 보충하지 않는다. 짧은 항목 정답을 전체 TASK 도달로 자동 확대하지 않는다.

**인수:** 같은 지문 다른 문항, 사전 해설/연습 열람, stale annotation, 잘못된 phase, 지연 미충족, 정책 버전 불일치, raw 조회 한도 초과를 반례로 검사한다. ‘현재 독립 CHECK’, ‘교수 경로 완료’, ‘새 지문 전이’, ‘지연 유지’를 따로 보고한다. 지연 최소 간격과 정성 충분성은 정책으로 고정하되 효과 검증 전에는 최적 학습 기준이라고 쓰지 않는다. 운영 연습 수와 필요 총량도 구별한다.

## 6. LM-G1.5 — V2/S5 확대 및 E3 경계

LM-G1.4의 지원 R5 증거 주장 계약은 [독립 T4 보고](../../research/lm-g1-4-independent/ACCEPTANCE.md)에서 ACCEPT_WITH_LIMITS로 수용했다. 첫 시도 ID·현행 도구 자격·조회 실패/과거 asof·세 표면의 주장 범위를 재사용할 수 있다. 실제 지연/효과·전체30 TASK 및 V2/S5 지원을 완료한 판정은 아니다. 최종 HEAD CI와 안전 병합 결과는 PR #275 기록을 따른다. 아래 확대 작업의 착수는 가능하며, P1~P7 중 실제 정책/DB 변경을 요구하는 부분만 별도 승인한다.

**파일 범위:** `item-tasks.ts` registry, 해당 TASK instrument/검증/표시 컴포넌트, `v62/{inventory,coverage}.ts`, `v4/workspace.ts`, 기존 writer 적격성 adapter 및 테스트. DCP 어댑터를 재사용할 수 있지만 DCP 정오 기록을 G2 TASK 직접 수행으로 무조건 복사하지 않는다.

**V2 인수:** 문맥 의미 선택의 실제 답/근거·대안 배제·지원 범위·노출/현재 revision이 결속된 도구, 적격 확인/연습/전이 자료, 저장 및 MAP 환류. `/dev/vocab-practice` 접근만으로 제품 통합을 선언하지 않는다.

**S5 인수:** 구문/의미 결합 TASK의 정성 수행을 독립 정의·채점한다. vocab_choice가 실행된다는 이유로 S5 전체 지원을 주장하지 않는다. 적격 문장 제시형/정답/루브릭이 없으면 content_needed로 남긴다.

**E3 인수:** 기존 option-restate의 제한된 범위와 완전한 다섯 보기 판정의 차이를 표시하고, 확대할 때 각 보기 성립/과제 적합성·근거·전체 검수 조건을 따로 평가한다. 학습 효과는 별도 학생 검증 전까지 검증 부족이다.

콘텐츠 생산/공개는 별도 범위다. 이 감사는 도구·계약·현재 자산 재사용의 최단 경로만 확정한다.

## 7. LM-G1.6 — 승인안과 실제 공장 연결

| 승인안 | 실제 확인 상태 | 재사용할 것/남은 차이 | 현재 R5 필수 여부 |
|---|---|---|---|
| A3 | grade_dcp_item 설치, vocab_choice 분기 없음 | `_pending_grade_dcp_underline_choice.sql`; 서버 grader와 parser의 지원을 결속 | 아님 |
| A | 새 practice RPC/분류 미적용, old RPC 존재 | `_pending_textbook_practice_publish_gate.sql`; A3 지원 후 allowlist 정합 재생성. legacy fallback 공개 조건도 검증 | 아님 |
| C | qualification/release/revocation 3개 원장 없음 | `_pending_workspace_supply_c_qualification.sql`; 실제 승인/current revision/권리 서버 reader 필요 | 공장 공급 때 필수 |
| B | demand/order/delivery 5개 테이블 없음 | `_pending_workspace_supply_b_orders.sql`; canonicalDemand v2·계획/목표 버전·납품 결속 | 공장 주문 때 필수 |

위 안은 원문 SQL·권한·본문 hash·적용 순서의 재검토 후 사용자 승인 대상이다. A3→A 지원 정합→C 자격/reader→B 주문/납품의 의존성을 확인하고, 기존 안으로 표현되지 않는 목표/증거 변경은 별도 delta로 낸다. 현재는 어떤 SQL도 실행하지 않는다.

실제 API/manifest/활동 생산이 없으므로 Factory Gate C는 MOCK_ONLY/NOT_CONNECTED다. 타입/브랜드/boolean만으로 신뢰 승인이나 권리를 만들 수 없다. test_fixture는 어떤 mock 조합에서도 실사용 공급을 받지 못해야 한다. 기존 R5 자산 경로와 EXISTING 래퍼는 별개로 검증한다.

## 8. 최종 수용 게이트

| 게이트 | 닫는 조건 | 지금 판정 |
|---|---|---|
| T1 기존 경로 일관성 | LM-G1.1 반례 제거, 진행/준비 구별 | 완료 — PR #272 독립 T1 수용, 아래 범위 |
| T2 실제 수직/역사/권한 | LM-G1.2 live 증거, 저장 PLAN 복귀, 오류 보존 | 검증 부족 |
| T3 목표→요구→계획 | 전체 TargetSpec 버전과 실제 계산 소비 | 부분 완료 |
| T4 평가/교수 지원 | 역할·독립·전이·지연 분리, V2/S5/E3 범위 적격 | 부분 완료 |
| T5 실제 공장 공급 | 승인 원장·현재 검수·실제 주문/납품·노출 확인 | 외부 입력 대기 |
| T6 학습 효과 | 실제 학생·사전 고정 평가/비교/추적과 적절한 분석 | 검증 부족 |

각 PR은 자기 게이트만 닫는다. T1~T4와 기존 PC UI 회귀가 통과해도 T5/T6를 PASS로 승격하지 않는다. 실제 콘텐츠/평가 자료 부족은 코드 FAIL과 분리해 BLOCKED로 남긴다.


### T1 후속 판정 — 2026-10-15

PR #272의 G02 단계/실행 링크를 [독립 검증](../../research/lm-g1-1-independent/ACCEPTANCE.md)했다. 실패 REPAIR는 수행량2를 유지하며 repair에 남고, 기존 성공 기준을 충족한 뒤에만 넘어간다. 추가 TASK 간 링크 소진 반례도 수정했다. T1 수용은 최신 PR HEAD CI/safe-merge 게이트와 별도 결속한다. T2~T6 판정은 이번 결과로 변경하지 않는다.

LM-G1.2 시작 전에는 TRANSFER 경험1회와 운영계획량2회의 다음 행동 우선 출처, 근접 해설 노출의 uncertain 재계산·원자 제출 시각 검증을 계약으로 고정한다. 기존 정책을 이번 T1에서 변경하지 않았고 1회를 2회 완료라고 해석하지 않는다.

### T3 후속 판정 — 2026-10-16

PR #274의 지원 범위는 [독립 수용 보고](../../research/lm-g1-3a-independent/ACCEPTANCE.md)에서 ACCEPT_WITH_LIMITS로 판정했다. 점수·단일 평가원 시험 범위·목표 snapshot·PLAN 결속을 검증했고, 저장 경합과 오래된 편집기 문맥을 최소 수정했다. 최종 HEAD CI와 안전 병합은 PR 기록으로 확인한다. 전체 TargetSpec은 여전히 부분 완료다. 목표 등급/날짜는 저장·표시만 지원하며, 학평은 BLOCKED_CONTENT, grade-only·복합 범위·시간 예산은 BLOCKED_APPROVAL이다. LM-G1.4는 현재 지원 목표의 snapshot 계약을 재사용할 수 있다. T4~T6와 학습 효과를 이번 판정으로 완료하지 않는다.
