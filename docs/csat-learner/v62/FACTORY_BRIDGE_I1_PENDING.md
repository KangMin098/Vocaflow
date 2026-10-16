# I1 — 승인 대기(C/B SQL 감사 결과 · 최소 delta · 미적용)

> I0 에서 C(`_pending_workspace_supply_c_qualification.sql`) · B(`_pending_workspace_supply_b_orders.sql`)를 읽기 전용으로 감사했다. 최소 delta 는 `_pending_workspace_supply_b_delta_i0.sql` 이다.
> **어느 SQL 도 적용하지 않았다.** 개발 DB 에는 C/B 의 표 · 함수가 하나도 없다(`to_regclass` 2026-10-17: content_qualification · content_release_approval · workspace_content_demand · factory_order · workspace_content_delivery 모두 null). 같은 목적의 다른 표(`textbook_product_order` · `product_order`)도 없다.

## 1. 다섯 위험 판정

| # | 위험 | 판정 | 근거 |
|---|---|---|---|
| 1 | B 의 노출(G)이 G2 원장 · 세션을 누락 | **재현된 결함** | `supply_learner_exposure('csat_item')` 는 `csat_dx_*` 만 본다. 개발 DB 실측: `learning_task_attempts` 129행(사용자×문항 123쌍) **전부**가 dx 응답이 없어 'none' 으로 보인다. 시도 없이 해설만 연 세션 227건도 마찬가지다 → 이미 푼 R5 확인 문항이 「미노출」로 평가 공급될 수 있다 |
| 2 | 앱 `supplyFor` 가 교수 적합성 unknown 을 적격 공급으로 오인 | **재현된 계약 불일치(앱 진단 층)** | `supplyFor` 는 v3 해설을 `teaching: null` 인 채로 `available`, `fulfillmentOf` 는 `fully_supplied` 로 센다. SQL `fq_role_ok` 는 D pass 를 요구해 그 자료를 공급하지 못한다. 학습자 화면이 「쓸 수 있다」고 하는 것과 B 가 실제로 공급할 수 있는 것이 다르다. I0 해결기는 D pass 만 센다. `supplyFor` 수정은 화면 문구에 영향을 주므로 I1 결정으로 남긴다 |
| 3 | 공개 승인 · 평가 승인 요구가 앱 · SQL 에서 다름 | **재현된 불일치** | 앱은 모든 역할에 public, 평가 역할에 assessment 까지 요구한다. B `workspace_delivery_record` 는 승인 한 행만 보고, 평가 역할은 assessment 만, 교수 역할은 범위를 보지 않는다(assessment 승인으로 교수 공급 통과) |
| 4 | textbook_activity · workspace_bundle 의 revision reader · 실행기 | **확인된 지원 공백(결함 아님)** | B `supply_artifact_revision` 이 두 종류에 null → 공급 불가로 막는다(fail-closed). 앱 `runnerFor` 도 'none'. I0 해결기는 `blocked_runner` |
| 5 | held · failed · 부분 납품 · 재시도 · 공용 Product Order | **부분 결함** | held · failed · 재시도는 B 상태 기계(열린 주문 1 · 부모 · 이유)가 다룬다. 부분 납품: `delivered` 는 공급 행 1개로 충분해서 남은 부족은 새 `shortfall` 주문으로만 이어진다(의도 확인 필요). **공용 Product Order**: `factory_order` 가 학습자별 줄에 묶이고 공장 주문 결속 칸이 `production_run_id`(text)뿐이라 order_revision · order_hash 계보를 DB 에서 검증할 수 없다 |

## 2. 최소 delta(`_pending_workspace_supply_b_delta_i0.sql`)

- **D1**: `supply_learner_exposure` 에 `learning_task_attempts`(attempted) · `learning_sessions` 해설 열람/공개(explanation_seen)를 더한다. 같은 지문 판정에도 두 원장을 포함한다.
- **D2**: `workspace_delivery_record` 의 승인 블록을 앱 계약과 같게 고친다(모든 역할 public · 평가 역할 assessment · 둘 다 철회 없음). B 원본 sha256 확인 뒤 그 블록만 교체한다.
- **D3**: `factory_order_product_link`(order_id ↔ product_order_id · order_revision · order_hash · share_key)를 추가한다. 추가 전용 · 관리자 읽기 · 학습자 비노출.
- C 는 바꾸지 않는다.

## 3. 승인 패키지(적용 전 준비물)

| 항목 | 내용 |
|---|---|
| 해시 | C · B · delta 파일 sha256, 적용 직전 재계산. B 의 D2 대상 함수 본문 sha256 |
| 허용 객체 | C: content_qualification · content_release_approval · content_release_revocation + 함수 6. B: 수요 2 · 주문 2 · 공급 1 표 + 함수 5. delta: 함수 2 교체 + 표 1 |
| 권한 · RLS | 학습자는 본인 수요 · 주문 · 공급 읽기만. 자격 · 승인 · 공용 계보는 관리자 읽기만. 쓰기는 정의자 함수만. `supply_learner_exposure` 실행권은 public · anon · authenticated 에서 회수 |
| checkpoint | `/db-checkpoint before i1-supply-cb` → 적용 → `after` · `db_health_checkpoint_diff` |
| rollback | B · C 헤더의 drop 순서 + delta 표 drop · 함수 원본 복원(이력 표가 비어 있을 때만. 행이 있으면 보존 테이블로 복사 뒤) |
| 격리 시험 | PGlite: G2 시도 · 해설만 열람 · 같은 지문 다른 문항 → 노출 거절. public 만 · assessment 만 · 철회 → 공급 거절. 공용 주문 2 학습자 링크 · 학습자 RLS 비노출. 같은 요청키 다른 본문 23505 |

## 4. I1 결정 대기

1. 위 delta 승인 여부(D1 · D2 는 안전 결함 수정, D3 는 공용 생산 기능).
2. `supplyFor` 해설 줄의 「available」 을 「교수 검수 전」 으로 낮출지(학습자 문구 변화).
3. 부분 납품 시 주문 상태 의미(`delivered` = 하나라도 공급 vs 전량).
4. MaterialUnit 변환 근거(문항 → cell): 공장 cell 당 문항 수는 주문마다 다르다. 공장 계약이 정본을 돌려주기 전까지 UNKNOWN_UNIT.
5. Crosswalk 후보 검증(맹검 표본 · 검수자).
