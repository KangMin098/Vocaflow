# 학습 지도 rev4.0 — 관계 모델(설계 제안 · 2026-10-10)

> 원천 데이터: [v4/relations.json](./v4/relations.json)(관계 34 · 전부 `proposed`) · TASK: [v4/codebook.json](./v4/codebook.json). 무결성: `node --test scripts/csat/map/v4/__tests__/codebook.test.mjs`(타입 · 끝점 · 중복 · PREREQUISITE 순환 · 상태).
> 정본 근거: [LEARNING_MAP_VNEXT](./LEARNING_MAP_VNEXT.md) §5(LP 겹층) · §6(잠금 없음 · dominant_dependency) · §7(facet) · §8(paraphrase) · §10(원인 ≠ 능력).

## 1. 관계 대상 9종 — 무엇과 무엇의 관계인가

| 관계 대상 | 표현 | 저장 위치(제안) | 지금 |
|---|---|---|---|
| 영역 내부 | 축 → TASK 소속(`tasks[].axis`) | TASK 정의 칸 | 정본 §3 |
| 영역 간 | TASK 사이 관계로만 표현(축끼리 직접 잇지 않는다) | 공통 그래프 | 없음 — 축 간 「선수」를 두면 hard lock 이 된다(§6) |
| TASK 내부 | 통합 관찰 ← 원자 TASK(`PART_OF`) · facet(관계 · 기능 · 판단 차원) | 공통 그래프 + facet 어휘 | 정본 §3 · §7 |
| 같은 영역 TASK 간 | `PREREQUISITE` · `SUPPORTS` · `TRANSFERS_TO` · `ALTERNATIVE_PATH` | 공통 그래프 | 제안 |
| 다른 영역 TASK 간 | `PREREQUISITE`(LP 순서) · `INTEGRATES_WITH`(같은 문항에서 함께 작동) | 공통 그래프 | 제안 |
| TASK ↔ 문항 | `DIAGNOSE_WITH` — 문항 렌즈(B) · 확인 과제 키 · Evidence Anchor | `lines[B*].v4`(렌즈 단위) + `knowledge_applications.audience.items`(문항 단위) | 문항 단위는 확인 과제 20문항만 |
| TASK ↔ 학습 방법 | `REMEDIATES` 후보 — `tasks[].methods`(기존 I · D 라인 · 과제) | 코드북 | 효과 근거 0 → 가설 |
| TASK ↔ 교재 · 콘텐츠 | Workspace Template 의 `content_keys` → `knowledge_applications.surface_ref` | WORKSPACE_CONTRACT §5 | 4 키(claim-support · option-restate · evidence-locate · cohesion-link) |
| TASK ↔ Workspace | 중심 · 보조(`core` · `support`) | [v4/workspaces.json](./v4/workspaces.json) | 제안 |

## 2. 관계 타입 8

| 타입 | 방향 · 뜻 | 허용 용도 | 금지 | 확정 조건 |
|---|---|---|---|---|
| `PREREQUISITE` | from 이 불안정하면 to 의 학습 효과가 떨어진다 | **우선순위 낮춤만**(dominant_dependency) | 잠금 · 「from 완료 전 to 진입 불가」 · rule_proxy 근거로 발동 | from 에 `verified_diagnosis` 가 있을 때만 학습자 그래프에서 발동 |
| `SUPPORTS` | from 이 to 수행을 돕는다 | Workspace 보조 TASK 후보 | 필수 조건 취급 | 교육 근거 인용 + 사람 승인 |
| `PART_OF` | 원자 → 통합 관찰 | 통합 관찰 분해 · 다음 직접 확인 후보 | 통합 관찰의 숙달도 계산 | 정본 §3 정의(이미 승인된 구조) |
| `INTEGRATES_WITH` | 대칭 — 같은 문항에서 함께 작동 | Workspace 묶음 | 한쪽 결과로 다른 쪽 상태 변경 | 문항 공동 관찰(Anchor validated) |
| `TRANSFERS_TO` | from 의 숙달이 to 의 새 맥락으로 | TRANSFER 단계 자료 선택 | 전이 가정만으로 to 상태 변경 | 전이 시도 기록(`phase=transfer`)으로 검증 |
| `ALTERNATIVE_PATH` | 대칭 — 같은 목표의 다른 경로 | 학습자 자율 조정 대안 | 자동 경로 변경 | 교육 근거 |
| `DIAGNOSE_WITH` | 렌즈 · 확인 과제로 TASK 를 관찰 | 직접 확인 문항 선택 | 유형 정오 → TASK 숙달 | Evidence Anchor `validated_anchor` 이상 |
| `REMEDIATES` | 방법 · 활동이 TASK 결함을 고친다 | REPAIR 활동 선택 | 효과 주장 | `knowledge_trials` 사전 · 사후 최소 표본(기존 가드) |

금지 추론(정본 §3 E · §10 그대로): Choice Trap 선택 → E3 약함 ✕ · 오답 원인 확인 → TASK 상태 ✕ · 관계 존재 → 상태 전파 ✕. **관계는 「무엇을 먼저 확인 · 학습할까」의 순서에만 쓰고, 상태(근거 수준)는 바꾸지 않는다.**

## 3. 공통 교육 관계 그래프(제안 34)

| 타입 | 수 | 근거 분포 |
|---|---|---|
| PART_OF | 18 | 전부 정본 §3 |
| PREREQUISITE | 3 | 정본 §5 2(V→S-O1 · S-O1→R2) · 문헌 가설 1(E1→E2) |
| SUPPORTS | 7 | 정본 5 · 가설 1(R1→R2 — §20-1 보류와 묶임) · 정본 X(보류) 1 |
| INTEGRATES_WITH | 3 | 정본 §7 · §8 |
| TRANSFERS_TO | 2 | 문헌 가설 1 · 가설 1 |
| ALTERNATIVE_PATH | 1 | 가설(빈칸: 요지에서 내려오기 vs 근거에서 올라가기) |

전체 목록 · 근거 칸은 `relations.json`.

**2차(2026-10-10) 승인 결과 — PART_OF 18 을 정본과 하나씩 대조**: S-O1 ← S1–S5(5) · R-O1 ← R1–R6(6) · E-O1 ← E1–E3(3) = **14 approved**. 근거: 정본 §3 이 통합 관찰을 「S1–S5 가 합쳐져」(L93) · 「R1–R6 이 합쳐져」(L106) · 「E1–E3 가 합쳐져」(L116)로 구성 원자를 명시한다. 양 끝 TASK 유효 · 방향 원자 → 통합 · 구조적 포함(선수 · 인과 아님). **X 4 는 proposed 유지** — §3 X-O1(L143)은 「제한 시간 전체 수행의 안정성」만 쓰고 X1–X4 를 구성으로 명시하지 않으며, X 자체가 §20-4 보류다. 나머지 16(PREREQUISITE · SUPPORTS · INTEGRATES_WITH · TRANSFERS_TO · ALTERNATIVE_PATH)은 자동 승인하지 않았다 → approved 14 · proposed 20. 테스트(`codebook.test.mjs` · `definition.test.ts`)가 「승인 = 정본 인용이 있는 S/R/E PART_OF 뿐」을 지킨다. 승인된 관계도 근거 상태 · 학습 요구를 바꾸지 않는다 — 쓰임은 `partsOf()`(통합 관찰의 INTEGRATE 요구 판정)와 화면의 「구조적 연결」 표시뿐. 승인 절차: 관계 하나씩 `basis`·`ref` 를 사람이 확인 → `approved`(공통 그래프에 쓰임) → 학습자 기록으로 효과가 관찰되면 `verified`.

## 4. 공통 그래프 vs 학습자별 학습 필요 그래프

| | 공통 교육 관계 그래프 | 학습자별 학습 필요 그래프 |
|---|---|---|
| 무엇 | 교육 내용 사이의 일반 관계 | 「이 학습자가 목표에 가려면 무엇을 어떤 순서로」 |
| 노드 | rev4 TASK 30 | 그 학습자의 **필요가 있는** TASK(As-Is 근거 상태 + To-Be 요구) |
| 간선 | 위 34(approved 만 사용) | 공통 그래프의 approved 간선 중 **양 끝이 모두 필요 노드인 것** + 학습자 근거로 발동한 PREREQUISITE |
| 저장 | 정의 테이블(버전) | **저장하지 않는다** — 조회 때 `now` · 기준 시점으로 계산(정본 §10-1 원칙과 같다). 계획에 반영된 결정은 `learning_decisions` 에 남는다 |
| 바뀌는 계기 | 정의 버전 변경(승인) | 새 시험 · 직접 확인 결과 · 목표 변경 |

계산(2차 대상): `needGraph(commonGraph, asIs, toBe, asOf)` — 순수 함수. PREREQUISITE 는 from 이 `verified_diagnosis(still_needed)` 일 때만 to 의 우선순위를 한 단계 낮춘다(잠그지 않음).

## 5. 기존 연결선 160 의 처리

| 기존 kind | 수 | rev4 처리 |
|---|---|---|
| goal | 6 | 이관 없음 — 목표는 목표 모델(EXAM_INPUT_CONTRACT §5)이 맡는다 |
| member | 54 | 이관 없음 — 라인의 층 소속은 코드북 `lines[].layer` |
| reason | 87 | Rationale 층(P1–P8 근거). 교육 관계가 아니다 — `csat_map_edge_source` 근거 검토 후보로만 |
| route | 13 | 트랙 T1–T3 경로. `ALTERNATIVE_PATH` 후보로 **사람 검토** — 자동 승격 금지 |

기존 행은 지우지 않는다. 기존 지도 화면은 그대로 이 160 을 쓴다. `graph.ts pathOf` 가 pending 간선을 확정 경로처럼 진하게 강조하던 GAP-07 은 2차에서 고쳤다 — 탐색은 그대로, 경로 안의 미확정 간선(basis ≠ direct)을 `unconfirmed` 로 따로 돌려주고 화면은 점선 · 흐린 색으로만 강조한다(160 개 전부 pending 이라 빼면 경로가 사라진다).
