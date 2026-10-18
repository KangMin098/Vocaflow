# v6.2 P-F7b · c · d — 영속 수요 · 주문 · 공급 · 자격 원장 승인 패킷(승인안 B · C)

> 상태: **DB 미적용.** SQL 은 격리 Postgres(PGlite — 프로세스 안 WASM Postgres 17)에서 실제로 실행해 검증했다. 개발 DB 에 닿지 않았다.
> 학습자 효과 주장 없음 — 합성 fixture 검증만.

## 1. 파일 · 적용 순서

| 순서 | 파일 | 내용 |
|---|---|---|
| ① C | `supabase/migrations/_pending_workspace_supply_c_qualification.sql` | 자격 원장 · 출시/평가 승인 · 승인 철회(전부 추가 전용) · 기록/승인 함수 |
| ② B | `supabase/migrations/_pending_workspace_supply_b_orders.sql` | 기존 3표 복합 고유키 · 수요 · 수요 줄 · 주문 · 주문 이벤트 · 공급 · 함수 4 |
| ③ 앱 | (승인 뒤) 서버 액션이 위 함수만 호출 | 지금은 순수 계약 · 격리 테스트만 |

B 의 공급 행이 C 의 자격 · 승인 행을 FK 로 참조하므로 **C 먼저**. 적용 전후 `/db-checkpoint workspace-supply-bc`.
적용 시 실제 번호를 `ls supabase/migrations` 로 골라 `_pending_` 를 떼고 커밋한다.

## 2. B-1 소유권 · 관계 무결성

| 조건 | 강제 위치 |
|---|---|
| Workspace 가 그 학습자 것 | DB: `(workspace_id, user_id) → learner_workspace(id, user_id)` 복합 FK · 함수: `status='active'` |
| 목표 버전이 그 학습자 것 | DB: `(goal_version_id, user_id) → csat_map_goal_version(id, user_id)` |
| PLAN 버전이 그 Workspace · 학습자 것 | DB: `(workspace_id, plan_version, user_id) → learner_workspace_plan(...)` |
| 수요 · 줄 · 주문 · 공급의 사용자 · Workspace · TASK · 역할 일치 | DB: 줄 → 수요 `(id, user_id, workspace_id)`, 주문 · 공급 → 줄 `(id, user_id, workspace_id, role, task_id)` 복합 FK |
| 공급 산출물 · revision · TASK · 역할 = 자격 행 | DB: `(qualification_id, kind, ref, revision, task, role) → content_qualification` 복합 FK |
| 클라이언트 userId 불신 | 함수: 사용자 = `auth.uid()`, 정규 본문의 user ≠ 호출자면 거절 |

기존 표 변경은 **복합 고유키 3개 추가뿐**(id 가 이미 PK 라 위반 행 0 · 데이터 변경 0).

## 3. B-2 한 수요의 여러 주문 — `unique(demand_id, role)` 폐기

옛 설계는 한 수요 · 역할에 주문 하나만 허용해 다음을 막았다: 한 수요의 여러 TASK 줄 · 부분 공급 뒤 부족분 · 실패 뒤 재생산 · PLAN 개정 재주문.
대신:
- **수요 줄**(`workspace_content_demand_line`) — `unique(demand_id, role, task_id)`.
- **주문**은 줄에 달린다 — `order_seq` · 이유(`initial | shortfall | retry_after_failure | plan_revision`) · 부모 주문. initial 만 부모 없음(CHECK).
- **열린 주문은 줄마다 하나**(부분 고유 인덱스 `where state not in ('delivered','failed')`) → 중복 주문 0. 닫힌 뒤에만 새 주문.
- 실패는 그 주문의 끝(되살리지 않음). 앱 상태 기계도 같게 바꿨다(`failed → requested` 삭제) — `persist-contract.test.ts` 가 TS ↔ SQL 허용 전이 일치를 검사.
- PLAN 개정 · 목표 변경은 **새 수요**(정규 본문이 달라 새 서명) — 이전 수요의 공급을 상속하지 않는다.

## 4. B-3 원자적 주문 이벤트

- 상태 변경 경로는 `factory_order_transition()` 하나: 행 잠금(`for update`) → 같은 요청 키면 기존 seq 반환(멱등) → **기대 상태 비교**(다르면 `40001 conflict`) → 허용 전이 → 이벤트 삽입 → 주문 갱신. 한 트랜잭션이라 실패 시 부분 이력 0.
- 트리거: 주문의 state · event_seq 는 같은 seq 의 이벤트(from = 이전 상태, to = 새 상태)가 있을 때만 바뀐다 → **서비스 키 직접 UPDATE 도 거부**. 주문 정체성 열 불변 · 주문 삭제 금지.
- 이벤트 CHECK: producing ⇒ 실행 id · held/failed ⇒ 이유 · delivered ⇒ 자격 id. 함수: delivered 는 그 주문에 **그 자격의 공급 행**이 있을 때만.
- 이벤트 · 공급 · 자격 · 승인 · 철회 = 추가 전용(UPDATE/DELETE 트리거 거부).

## 5. B-4 공급 시점 재검증(`workspace_delivery_record`)

과거 자격이 있다는 사실만으로 공급하지 않는다. 공급 순간에 다시 본다:
① 줄 소유 ② Workspace active ③ 자격 정체성 = 줄 TASK · 역할 ④ 자격이 **현재 행**(대체 없음) ⑤ 역할 필수 축 pass(`fq_role_ok`) ⑥ 승인 존재 · **철회 없음** · 평가 역할은 assessment 범위 ⑦ 원천이 **지금** 적격(`csat_source_is_eligible`) ⑧ G — 평가 역할은 그 학습자의 시도 기록이 있으면 거절, 노출 기록이 없는 산출물 종류는 거절(fail-closed).
멱등: `(user_id, request_key)` · 같은 줄에 같은 산출물 두 번 공급 금지 `unique(line_id, kind, ref)`.

## 6. C — FQ A~H 자격 원장

보존 필드: 규칙 버전 · 산출물 종류/참조/revision · 원천 revision/hash · 분석 revision · Gold revision/hash · TASK · 역할 · 축별 상태(+결함) · 결함 코드 · 근거 id · 검수 방법 · 대체 관계(supersedes, 한 번만) · 기록자 · 시각.
- `fq_axes_valid`: 8축 × 4상태만. **A pass ⇒ 원천 revision · hash 필수**(FQ1.0 「생성 당시 원문 revision 미결속」) · **E pass ⇒ Gold 결속 필수**.
- 승인 `content_release_approval`: 현재 행 · 역할 필수 축 pass 일 때만, 승인자 권한(admin/curator) 기록. 철회는 별도 표.
- **연구자 `publicQualified` 플래그는 저장하지 않는다** — 출시 승인은 승인 행만.
- DCP 834,311행 일괄 판정 없음 — 검수된 산출물에만 행.

앱 쪽 `qualification.ts`(P-F7c): `toSupplyQualification(r, approvalState(...))` — 승인 기록이 없으면 rights · assessment 는 true 불가. `deliveryCheck(q, role, exposure)` — G 는 공급 시점 학습자별, 평가 역할은 노출 `none` 일 때만(모름 = 실패).

## 7. 격리 검증 결과(PGlite · 실행함)

`supply-c-qualification.pglite.test.ts` 11 · `supply-b-orders.pglite.test.ts` 24 — 모두 통과. 요지:
- DB 서명 = 앱 `demandSignature` (같은 SHA-256) · 같은 본문 재전송 같은 id · 남의 Workspace/목표/다른 Workspace 의 PLAN 거절 · 닫힌 Workspace 거절.
- 주문: 열린 주문 중복 거절 · 낡은 기대 상태 충돌 · 같은 요청 키 이벤트 1건 · 근거 없는 전이 거절 · 직접 UPDATE/이벤트 수정 · 삭제 거절 · 실패 전이 뒤 이벤트 수 불변 · 실패 뒤 retry 주문(부모 연결).
- 공급: 승인 재고 공급 · 중복 공급 거절 · TASK 불일치/승인 없음/남의 줄 거절 · 대체된 자격 · 철회된 승인 거절 · 원천 부적격 거절 · 평가 역할 assessment 승인 필요 · 시도한 문항 G 거절.
- R5 수직(격리): 수요 → 주문 → 재고 검색 → 승인 재고 공급 → delivered(다른 자격으로는 불가) · 다른 학습자 사용 불가 · 목표 변경 = 새 수요 · 공급 상속 없음.
- 실제 FQ1.0 20건을 원장에 넣으면 승인 0.
- FQ1 결함 fixture 11(V2-3 · S5-1/2/3 · S5-2 · DCP 의미 · 정답 근거 · cache stale/missing · revision 미결속 · 미관찰 루브릭 · 실행기 · 권리) — 승인을 가정해도 공급 0, 결함만 뺀 대조는 통과.

**한계(정직하게)**: PGlite 는 연결이 하나라 **진짜 동시 트랜잭션은 검증하지 못했다.** 동시성은 설계(행 잠금 · 부분 고유 인덱스 · unique(supersedes) · 요청 키 unique)와 순차 시뮬레이션(낡은 기대 상태)으로만 확인했다. 개발 DB 적용 뒤 두 연결 동시 시험이 남는다. 스텁(auth · 권한 함수 · 원천 적격)은 실제 정의의 최소 사본이다.

## 8. 승인 요청

| 승인안 | 범위 | 영향 | 되돌리기 |
|---|---|---|---|
| C | 표 3 · 함수 5 · 트리거 3 · 정책 3 | 새 표만. 기존 데이터 · 화면 무변경 | 파일 머리말 drop 문 |
| B | 기존 3표에 복합 고유키 · 새 표 5 · 함수 5 · 트리거 4 · 정책 5 | 새 표만 + 고유키(위반 0). 화면 무변경(앱 연결은 다음 단계) | 파일 머리말 drop 문 |

적용 뒤 검증: 이 두 테스트와 같은 시나리오를 개발 DB 에서 검증 계정으로 트랜잭션 · rollback 실행 + 두 연결 동시 주문 · 동시 전이.

## 9. 아직 아닌 것

- 영속 R5 공급 **완료** 주장 없음 — 표가 개발 DB 에 없다. 위 R5 는 격리 검증이다.
- 공유 지문 · 해설 열람 노출 기록 표 없음 → 평가 역할은 DCP 문항 외 공급 불가(fail-closed).
- V2 생산(D) · B7 · 계획 저장 DB 방어 · 신규 직접 평가 도구 — HOLD.
