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
## 새 종단 연결의 후속 발견

- FI-007 · 핵심 P2 · OPEN · `52a31d988`: 권리 철회로 DB 현재 납품 유효성=false인데 기존 본문 열기 허용, 같은 수요를 충족으로 계산해 대체 주문 없음.
- FI-008 · 핵심 P2 · OPEN · `52a31d988`: Chromium의 같은 답 재시도에서 ID는 같고 answeredAt은 달라 실제 G2 함수가 conflict를 반환.
- [종단 연결 독립 검토](./AUTHORED_INTEGRATION_REVIEW.md)에 재현 조건·기대 동작·원본 결과·1280/1440 격리 컴포넌트 화면을 연결했다. 과거 이력을 지우거나 SQL 멱등 검사를 완화하는 수정은 요구하지 않는다. FI-001은 새 링크/수행 경로에도 이어지며 동일 ID로 추적한다.

- FI-009 · 핵심 P2 · OPEN · `52a31d988`의 실제 교수 화면: `r5-cm-teach-1`의 자유 해설은 저장 인덱스(0부터)를 문장 번호로 쓰고 화면/구조화 참조는 1부터 표시하여 Yet/In fact/주장·이유·예시·재진술 참조가 어긋난다. [실제 화면과 대조표](./AUTHORED_INTEGRATION_REVIEW.md). FI-005의 연구 사실성 문제와 별개다.

- FI-002 범위 추가: 다른 TASK 자격 혼입(`r.central_meaning` 등록 → `r.reference` 유효 납품 → G2에서 뒤늦게 거절). 같은 등록↔FQ 결속 원인으로 [기존 ID에 추가](./AUTHORED_SQL_REVIEW.md).
- FI-010 · 핵심 P2 · OPEN · `52a31d988`: 본문만 열고 닫은 선행 페이지가 세션/노출 원장에 남지 않아 재열기 뒤 시도가 first_exposure/evidence=true. [열람 반례](./AUTHORED_INTEGRATION_REVIEW.md). 단순히 같은 수행 세션 안에서 문장을 다시 읽는 것을 금지하라는 요구는 아니다.

2026-10-18 후속: 사용자가 동일 최종 수용 임무의 검증 자료 계속 게시를 명시 승인했다. 이전 거부 이력은 보존하되, 추가 승인 대기는 해소됐다. 민감한 권한 침해 재현은 비공개 경로로 분리하고, 여기의 공개 자료는 합성 fixture와 관리자 입력 계약·교육/UX·무결성 반례 범위다.

- FI-011 · 핵심 P2 · OPEN · `52a31d988`: authored 확인 링크는 As-Is unseen에 있지만 Workspace check/next는 비어 있고, authored 전이 뒤 요구가 TRANSFER에 남으며 지문 로더 누락으로 전이 수행량도0이다. [세 계약 반례와 정상 대조군](./AUTHORED_INTEGRATION_REVIEW.md). 올바른 결속 후의 다음 단계 환류 문제로 FI-001과 구별한다.

- FI-012 · 핵심 P2 · OPEN · de5065b51 choice_evidence: 같은 닫는 시간을 직접 말하는 두 문장 중 evidenceAlt에 등록된 두 번째 문장만 고르면 choiceOk=true/extra0인데 decisive 인덱스가 없다는 이유로 오답. 실제 채점·두 폭 UI 재현과 기대 동작은 [형식 검토](./AUTHORED_FORMATS_REVIEW.md). 대표 근거만 맞게 하는 형식 계약의 문제이며 실제 콘텐츠 사람 승인으로 오인하지 않는다.

- FI-009 수정 추적: 4655e9be4의 교수7단계/오답 설명36건과 두 폭 실제 렌더링을 독립 대조하여 **FIX_VERIFIED_IN_CANDIDATE**로 갱신한다. [수정 증거](./AUTHORED_FORMATS_REVIEW.md#fi-009-수정-독립-확인--4655e9be4). 이전 OPEN은 수정 전 이력이다. 미병합·사람 승인 대기이며 FI-005/012와 구별한다.

- FI-013 · 핵심 P2 · OPEN ·4655e9be4 gs-transfer-1: 단수 irrigation ditch가 its의 선행사일 수 있는데 Gold는 반드시 복수 rivers를 가리킨다고 단정한다. 의도 정답은 추정 가능하나 유일한 문법 오류로 확정할 수 없다. [봉인 판독과 본문/Gold 대조](./EXPANSION_CONTENT_REVIEW.md). FI-012에는 같은 형식 문제의 실제 inf-guided-1/inf-teach-1 사례만 추가하며 새 중복 이슈를 만들지 않는다.

- FI-014 · 핵심 P2 · OPEN ·3c15ba23c segment_choice: cb-ind-2의 정확한 주어 덩어리+「문장의 주어」, cb-guided-1의 정확한 본동사 덩어리+「문장의 본동사」를 다른 단일 구조 라벨과 다르다는 이유로 오답 처리한다. [60문항 봉인 판독·실제 채점·두 폭 화면](./EXPANSION2_CONTENT_REVIEW.md). 이유 제거를 요구하지 않으며 겹치는 정당한 대안의 수용을 요구한다.
