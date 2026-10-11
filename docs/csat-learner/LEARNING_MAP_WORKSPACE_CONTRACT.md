# 학습 지도 rev4.0 — Workspace 계약(설계 제안 · 2026-10-10)

> 원천: [v4/workspaces.json](./v4/workspaces.json)(Template 후보 9 — 고정 카탈로그 아님). 준비 상태는 중심 TASK 의 직접 확인 상태에서 **계산**되고, 테스트가 과장을 막는다.
> 정의: **Workspace = 연관된 TASK 하나 이상을 학습 목적에 따라 묶고, 계획 · 교재 · 활동 · 평가 · 진행 · 성과를 관리하는 단위.**

## 1. Workspace Template(공통 · 버전 있음)

| 칸 | 뜻 | 원천 · 제약 |
|---|---|---|
| `id` · `version` | 영구 slug · 정의 버전 | 버전이 바뀌어도 학습자 기록은 당시 버전을 가리킨다 |
| `goal` | 학습 목표(학습자 말로) | |
| `core` · `support` | 중심 TASK(≥1) · 보조 TASK | 코드북 TASK id 만 |
| `relations` | 이 묶음을 정당화하는 관계 id | `relations.json` — approved 전에는 「제안 묶음」 표시 |
| `entry` | 진입 조건 | As-Is 근거 상태 · 직접 확인 결과 · 학습자 선택 |
| `method` · `protocol` | 권장 교수 · 학습 방법 · §13 절차 번호 | 기존 I 라인 · 과제 재사용 |
| `content_req` · `content_keys` | 교재 · 콘텐츠 요구 · 확인 과제 키 | `knowledge_applications.surface_ref`(§5) |
| 활동 구성 | FIND → REPAIR → TRANSFER → CHECK 칸(정본 §14) | `prescription.ts` `ActivityFrame` 재사용 |
| `quantity_policy` | 정량 계획량 편성 정책 | **규칙만** — 숫자는 학습자 기록에서 계산(§3) |
| `criterion` | 정성 성취 기준 | 「서로 다른 문항 · 독립 첫 시도 · 다른 날 재확인」 |
| `independent_check` | 독립 평가 · 전이 조건 | `skill-diagnosis.ts` 규칙 재사용 |
| `readiness` | live · ready · content_needed · blocked | 중심 TASK 중 **가장 낮은** 직접 확인 상태 |

## 2. 후보 9종

| id | 이름 | 중심 | 보조 | 준비 | 콘텐츠 키 |
|---|---|---|---|---|---|
| ws.central-meaning | 글의 핵심 잡기 | R5 | R3 · R4 | **live** | claim-support(9) |
| ws.option-match | 선지와 본문 맞대기 | E3 | V4 · R5 | **live** | option-restate(6) |
| ws.evidence-locate | 근거 문장 찾기 | E2 | E1 | **live** | evidence-locate(5) |
| ws.cohesion | 문장 잇기 | R2 | R1 | ready | cohesion-link(1 — 2개 이상 필요) |
| ws.sentence-core | 긴 문장 뼈대 | S-O1 | S1 · S2 · S4 | content_needed | — |
| ws.vocab-context | 문맥 속 어휘 | V2 | V1 · V3 | content_needed | — (WordVault FSRS 재사용 후보) |
| ws.grammar-scope | 어법 포인트 | S5 | — | content_needed | — |
| ws.inference | 함축 · 추론 | R6 | S-O1 · V2 | content_needed | — |
| ws.timed | 실전 운영(**보류 템플릿**) | X-O1 | X1 · X2 | blocked | — |

`ws.timed` 는 `hold: true` — 중심 · 보조가 모두 보류 TASK 라 요구 · 편성 대상이 아니다(「hold TASK 에 요구 0」 불변식). 자리만 남긴 이유: X 는 원자 TASK 넷 모두 보류라 묶을 원자가 없고, 정본 §20-4 의 실행 근거 모델이 생기면 이 템플릿이 첫 대상이다. 테스트가 `hold` 표시 = 중심 TASK 보류 여부를 강제한다.

Workspace 밖에 남은 비보류 TASK 3: `s.attachment`(S3) · `r.o.global_meaning_model`(R-O1) · `e.o.final_judgment`(E-O1). 통합 관찰 두 개는 여러 Workspace 를 거친 뒤의 관찰 자리라 독립 묶음을 만들지 않았고, S3 는 확인 도구가 생길 때 ws.sentence-core 보조로 더한다(테스트가 이 목록을 고정).

## 3. 정량 계획량 · 정성 기준 — 계산 규칙

정량(학습자별 계산, 저장 안 함 — 계획 확정 때만 스냅샷):
- 확인(FIND): Template 의 확인 묶음 문항 중 **그 학습자가 아직 독립 첫 시도를 하지 않은 것** 수.
- 바로잡기(REPAIR): 확인에서 막힌 문항 수(`lifecycle-evidence.ts` 판정 그대로).
- 적용(TRANSFER): 묶음 밖 같은 과제 키 문항 — 지금 evidence 는 0(GAP-04).
- 다시 확인(CHECK): 다른 날 · 서로 다른 2문항(skill-diagnosis resolved 조건).
- 예상 일정: 문항당 시간은 **실측 중앙값이 생기기 전까지 표시하지 않는다**(`learning_task_attempts.sec` 실제 기록 0). 상수 금지(I5).

정성: `criterion` 문장 + 근거 수준 표기(rule_proxy · item_tagged · verified). 「완료」 = 기준 충족 기록이 있을 때만. 효과(점수 상승) 주장 없음.

### 3-1. 단계별 준비 상태(2차 구현 · `lib/csat/map/v4/workspace.ts`)

Template 의 단일 `readiness` 와 별도로 학습자마다 네 칸을 계산한다 — 확인 과제가 있다는 사실만으로 Workspace 전체를 완료 가능으로 보이지 않는다.

| 칸 | 열리는 조건 | 학습량(실제 수만) | 닫힌 이유 코드 |
|---|---|---|---|
| `check_ready` | 확인 문항 연결이 있고 아직 안 본 확인 문항이 있다 · 판정 전 | 안 본 확인 문항 수 | `no_check_link` · `no_unseen_items` · (판정 뒤 = 마침) |
| `repair_ready` | 직접 확인 확정(verified · still_needed) | 확정에 쓴 문항 + 다시 확인에서 막힌 문항 | `after_check` |
| `transfer_ready` | 확정 · 해소 뒤 + 확인 묶음 밖 실제 적용 문항 > 0 | 적용 문항 수(claim-support = 실학습 Practice 풀, 그 밖 = 활성 `csat_item_task` 적용 − 확인 묶음, 보류 문항 제외) | `after_repair` · `no_transfer_items` |
| `recheck_ready` | 확정 뒤 · 안 본 확인 문항 ≥ 2(skill-diagnosis CHECK_ITEMS) | 2 | `after_check` · `not_enough_unseen` · `resolved` |

대표 Workspace 는 live 이고 열린 칸이 하나라도 있는 것 중에서: 목표가 있으면 To-Be 1순위 요구의 TASK 를 중심으로 하는 것, 없으면 As-Is(확인된 요구 > 확인 진행 중 > 축 기록상 먼저 확인 > 지금 할 수 있는 것). 단계 판정은 As-Is 의 TASK 확인 판정 하나를 **참조**한다 — 같은 TASK 를 보조로 가진 다른 Workspace 는 그 판정으로 단계를 열지 않는다(증거 중복 금지, `v4.test.ts` 불변식 4).

## 4. Learner Workspace(학습자 인스턴스)

| 칸 | 뜻 | 저장(제안) |
|---|---|---|
| `id` · `user_id` · `template_id` · `template_version` | | 신규 `learner_workspace`(MIGRATION_PLAN §2) |
| `goal_ref` | 연결된 목표(목표 스냅샷 id) — 없으면 null(As-Is 기반 Workspace 허용) | |
| `need_refs` | 이 Workspace 를 만든 학습 요구(To-Be 요구 id 들) | 계산값의 결정 기록 → `learning_decisions` |
| `selected_tasks` | 실제 선택된 TASK(템플릿 중심 · 보조 중) | |
| `plan` | 개인별 계획량 · 일정(§3 계산의 확정 사본) + `plan_version` | 신규 `learner_workspace_plan`(append-only) |
| 배정 자료 | `knowledge_applications` id · 문항 id 목록 | 계획 행 안 jsonb |
| 실행 기록 | **새로 만들지 않는다** — `learning_sessions` · `learning_task_attempts` 를 `task_key` · `item_ref` 로 조회 | 기존 |
| 확인 · 재확인 결과 | `skill-diagnosis` 계산(저장 안 함) | 기존 |
| 남은 요구 | 계산 | — |
| 계획 변경 이력 | `plan_version` 증가 + 사유(새 시험 · 확인 결과 · 학습자 조정 · 목표 변경) | append-only |

**증거 중복 금지 규칙**: 하나의 TASK 가 여러 Workspace 에 들어 있어도 수행 기록은 `learning_task_attempts` 한 행이다. Workspace 는 기록을 복사하지 않고 조회한다. 확인 판정은 `(user, task_key)` 단위로 한 번 계산되고, 여러 Workspace 가 같은 판정을 **공유**한다 — 같은 시도를 두 Workspace 의 독립 증거로 두 번 세지 않는다(독립성 = 서로 다른 `item_ref` 기준).

## 5. 교재 · 콘텐츠 파이프라인 연결 규격

| 계층 | 계약 | 근거 |
|---|---|---|
| 확인 · 연습 콘텐츠 | `knowledge_applications(surface ∈ {csat_item_task, learning_map_find}, surface_ref = 과제 키, status=active, audience.items)` | `20261008120000_knowledge_vnext.sql` · `loadMapPracticeLinks`(product-server.ts) |
| Workspace ↔ 콘텐츠 | Template `content_keys[]` = `surface_ref`. **새 surface 를 만들지 않는다**(체크 제약 변경 = 마이그레이션) — 2차는 기존 두 surface 만 | |
| 교재(드레인 생성물) | 교재 단위에 `task_ids[]`(rev4 TASK slug) · `source_policy` · `content_hash` 를 붙이는 **제안**. 교재 → Workspace 배정은 `knowledge_applications` 를 거쳐야 노출된다(교재가 직접 학습자 화면에 붙지 않는다) | `scripts/textbook/*` — 현재 키 없음(감사 Q8) |
| 기록 | `learning_task_attempts(task_key, item_ref, content_hash, phase ∈ pre/practice/post/delayed/transfer)` | 채점에 쓴 원문 revision 이 `content_hash` 로 묶인다 |

우회 금지 관문(Workspace 가 반드시 거친다):
1. **Embargo gate**(`lib/csat/embargo-gate.ts`, fail-closed · 423) — 보류 시험 · 문항 정답 민감 산출물.
2. **Reveal gate**(`lib/csat/reveal-gate.ts`) — 학습자 확정(GateCommit) 전 정답 · 근거 · 설계 비공개.
3. **`csat_items_public` 컬럼 ACL** — stem 비공개 · table GRANT 금지.
4. **학평 보류**(edu_office 분석 in_review) — published 만 집계.
5. **적용 생애주기** — active 는 `released_at` 필요 · `knowledge_items_applied_guard` · `knowledge_trials_analyzed_guard`.
6. **Evidence Anchor 관문**(`anchorGate`) — 원문 결속이 깨지면 채점 · 기록 · 링크 닫음.
7. 교재 원문 권리 — `source-policy-*`(교재 드레인) · [source-check criteria](../source-check/criteria.md).

## 6. 화면 책임(요약 — 상세 ARCHITECTURE §5)

Workspace 화면은 학습 목표 · TASK 묶음 · 교재/가이드 · 실제 수행 · 피드백 · 새 지문 적용 · 독립 재확인 · MAP/PLAN 반영 상태를 보여 준다. 판정은 화면이 하지 않는다 — 순수 함수(`skill-diagnosis` · `lifecycle-evidence` · 2차 `needGraph`)가 하고 화면은 그 결과를 읽는다.
