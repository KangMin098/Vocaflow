<!-- docs/research/final-independent-20261018/FINDINGS.md -->
# 독립 결함 원장

## FI-001 · P2 · OPEN · Workspace/역할을 잃은 납품 선택

기준: main c3a03d168. 최초 독립 재현: 2026-10-18. 기존 #291의 재전송 최초 납품 보존 수정과는 별개인 **최초 결속의 선택** 문제다. 같은 결함을 회차마다 새로 제출하지 않는다.

- 재현: 동일 학습자·문항·TASK를 Workspace A에는 independent_check, 나중에 Workspace B에는 transfer로 각각 정상 SQL 납품한다. 처음 혼자 CHECK를 수행한 G2(activity=theater, phase=practice, help_level=independent)를 저장하고 앱 bindDeliveryAttempt를 호출한다.
- 실제: 앱은 user_id/artifact_kind/artifact_ref만 필터하고 delivered_at DESC LIMIT 1로 Workspace B를 선택한다. 실제 workspace_delivery_attempt_record SQL은 B에 결속을 추가하고 evidence=false/non_evidence_reason=help_state_mismatch로 남긴다. API binding=bound라서 학습자 화면의 성공과 결속 무결성 문제가 구분되지 않는다.
- 같은 역할 대조: 두 Workspace 모두 independent_check인 경우에도 앱은 B에 evidence=true를 기록한다. 수행 출발 Workspace A의 PLAN이 아니라 B의 PLAN에 근거가 남으므로, 역할만 필터하는 보완으로도 충분하지 않다. [같은 역할 실행 결과](./delivery-provenance-same-role.log).
- 대조: 같은 DB에서 SAVEPOINT까지 되돌린 후 A의 delivery ID를 명시해 동일 시도를 결속하면 independent_check/evidence=true이다. 근거·데이터·SQL은 같고 납품 선택만 다르다.
- 영향: 실제 수행한 Workspace/PLAN과 다른 공급 행에 이력이 영구 결속될 수 있다. UNIQUE(attempt_id) 때문에 뒤에 올바른 납품으로 다시 결속할 수도 없다. TASK/역할/Workspace 경계가 필요한 전체 E→F→G→H 수용의 핵심 P2다.
- 기대: Workspace에서 시작한 수행은 그 공급 정체성(delivery/workspace/plan/task/role)을 끝까지 보존하고 서버에서 검증한다. 명시 연결이 없는 경우 최신 행을 추측하지 말고 구별 가능한 미결속 상태와 복구 방법을 보존한다. SQL의 타인·주석·revision·역할 검증과 멱등성을 유지한다.
- 수정 소유: Claude-VOCAFLOW-FINAL-OWNER의 종단 연결. Workspace→과제→API 입력 계약과 복구가 함께 바뀌므로 이 독립 세션은 제품 인터페이스를 선점하지 않는다. 독립 실행기·증거만 소유한다.
- 재검증: 수정 HEAD에서 동일 격리 SQL 반례와 서로 다른 TASK/Workspace/역할·잘못된 명시 delivery·재전송·복구·PLAN 환류를 확인할 예정. 현재 FIXED로 판정하지 않는다.

증거: [실행기](../../../apps/web/scripts/final-independent/probe-delivery-provenance.ts), [원본 실행 결과](./delivery-provenance.log). 실행: 저장소 루트에서 pnpm --filter web exec tsx scripts/final-independent/probe-delivery-provenance.ts. PGlite만 사용하며 실제 개발 DB 연결·쓰기 없음. 기존 최소 의존 스텁을 재사용하므로 전체 Supabase 환경/동시성 결과로 확대하지 않는다.

## 재사용하는 기존 미해결 조건

- #291: G2 저장 뒤 결속 실패 시 재시도 큐 없음. 이미 알려진 한계를 새 결함으로 중복 제출하지 않고 전체 H 수용 조건에서 추적한다.
- #292: Gold 문장 5 필수 여부 및 사람 권리 근거 미확정. AI 검증으로 pass/출시 승격하지 않는다.

## 새 최종 구현 스냅샷의 독립 발견

| ID | 등급 · 상태 | 고정 대상 | 근거 |
|---|---|---|---|
| FI-002 | 핵심 P2 · OPEN | b4fbf4d5c 보류 SQL | 교수 등록 산출물의 평가 자격/납품 허용([SQL 검토](./AUTHORED_SQL_REVIEW.md)) |
| FI-003 | P1 · OPEN | b4fbf4d5c 보류 SQL | 동일 본문에 다른 그룹명으로 교수 노출을 회피하고 독립 근거 true([SQL 검토](./AUTHORED_SQL_REVIEW.md)) |
| FI-004 | 핵심 P2 · OPEN | b4fbf4d5c 보류 SQL | licensed 권리 범위에 assess가 없어도 평가 납품 허용([SQL 검토](./AUTHORED_SQL_REVIEW.md)) |
| FI-005 | 핵심 P2 · OPEN | 6b988d0f5 창작 문항 | r5-cm-ind-1 연구의 아동/독창성 서술과 식별된 원논문 모집단/측정 결과 불일치([콘텐츠 검토](./AUTHORED_CONTENT_REVIEW.md)) |
| FI-006 | 핵심 P2 · OPEN | b4fbf4d5c 보류 SQL | 실제 PostgreSQL 두 연결에서 같은 지문 묶음 동시 납품2행([동시성 원본](./authored-concurrency.log)) |

위 대상은 총괄 개발 worktree의 커밋된 조기 스냅샷이다. 실제 개발 DB에서 새 authored 표는 아직 없음을 [읽기 전용 확인](./authored-deployment-status.json)했다. 수정 소유권은 총괄 세션에 유지하며, 독립 세션은 같은 결함을 재제출하지 않고 수정 HEAD의 결과를 이 ID에 붙인다. 사용자 승인 없이 Gold/권리 결정을 기록하거나 SQL을 적용하지 않는다.

FI-001은 사용자의 명시 게시 승인 뒤 [GitHub #293](https://github.com/KangMin098/Vocaflow/issues/293)에 전달했다. 새 발견들의 추가 공개 요청은 자동 심사 거부 뒤 게시 범위 승인 대기이며, 로컬 공용 원장은 DL-0149다.