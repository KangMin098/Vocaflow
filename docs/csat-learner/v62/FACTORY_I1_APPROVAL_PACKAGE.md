# Factory I1 — 개발 DB 적용 전 승인 패키지

> **상태: 승인 대기 · 미적용.** 개발 DB(`jajenrevcbmrpaliomxv`)에 이 패키지의 어떤 SQL 도 적용하지 않았다. RLS · RPC · 데이터 변경 0.
> 격리 PostgreSQL(PGlite · 실제 PostgreSQL 17 임시 클러스터)에서만 검증했다 — **격리 통과는 개발 DB 적용 성공이 아니다.**
> 보안 감사: [FACTORY_I1_SECURITY_AUDIT.md](./FACTORY_I1_SECURITY_AUDIT.md) · 결정 대기: [FACTORY_I1_PENDING_DECISIONS.md](./FACTORY_I1_PENDING_DECISIONS.md)
> 선행: I0(PR #277, 미병합) 의 [FACTORY_BRIDGE_I1_PENDING](https://github.com/KangMin098/Vocaflow/pull/277) 감사 · `_pending_workspace_supply_b_delta_i0.sql`. 이 패키지는 그 delta 를 **대체**한다(함께 적용하지 않는다).

## 1. 승인 단위 — 따로 승인할 수 있다

| 승인 | 파일 | 무엇 | 다른 승인 없이 완결되나 |
|---|---|---|---|
| **A. 기반(기존 승인안)** | C `_pending_workspace_supply_c_qualification.sql` · B `_pending_workspace_supply_b_orders.sql` | 자격 · 승인 · 철회 원장 / 수요 · 주문 · 이벤트 · 공급 | 아니오 — B 단독은 D1/D2 결함을 가진 채 열린다. **A 는 I1-S 와 같은 트랜잭션에서만 적용 권고** |
| **I1-S. 안전(D1 + D2)** | `_pending_workspace_supply_i1_safety.sql` | 노출 판정 보완 · 승인 범위 · 철회 직렬화 · 수량 상한 | 예(A 위에서) |
| I1-P. 부분 납품 | `_pending_workspace_supply_i1_partial.sql` | `partial` 닫힘 상태 · 전량 delivered · 줄 충족도 · 재주문 수량 | 예(A + I1-S 위에서). 미승인이어도 I1-S 는 안전 |
| I1-D3. 공용 계보 | `_pending_workspace_supply_i1_d3_lineage.sql` | 공용 Product Order 등록부 · 학습자 주문 링크 | 예(A + I1-S, P 와 독립). **D1/D2 를 지연시키지 않는다** |
| 되돌리기 | `_pending_workspace_supply_i1_rollback.sql`(생성물) | D3 → P → S 역순 원본 복원 · 보존 조건 선검사 | — |

## 2. 적용 SQL 원문 SHA-256 (2026-10-17, 적용 직전 재계산 필수)

| 파일 | sha256 |
|---|---|
| C `_pending_workspace_supply_c_qualification.sql` | `dd940568ef7170212bf23ac9f7fb89bb090e8f529eeb4c26bb9ccdbc1e503f66` |
| B `_pending_workspace_supply_b_orders.sql` | `e3f929d06f20518495682a36e0d1f8f483988f2a39feabd3e5d490c02a5293b2` |
| I1-S `_pending_workspace_supply_i1_safety.sql` | `72af4f76b279f691919186176ae5b5f162640206d05714c12718c3c5fff52813` |
| I1-P `_pending_workspace_supply_i1_partial.sql` | `2976266b7c635b482a9de5dfe856c8b30308b66c648fa06baa2f9404df43deb9` |
| I1-D3 `_pending_workspace_supply_i1_d3_lineage.sql` | `f19147acd2f7a3be13a3eac170faacc0dad689dcd2d2926c118c1d9a6acd720f` |
| 되돌리기 `_pending_workspace_supply_i1_rollback.sql` | `d0e46df18c55367eb945aeb8cebb7326560e6b16ef085bbf2c2f10a6ee18fdf8` |
| (대체됨) I0 delta `_pending_workspace_supply_b_delta_i0.sql`(PR #277) | `db33188031b3043daa5b301bcf7bb128d0459cf1d0254055573e103db95e4e20` — 적용하지 않음 |

되돌리기 파일은 `node scripts/csat/map/v62/gen-supply-i1-rollback.mjs` 가 B · C 원본에서 함수 정의를 글자 그대로 잘라 만든다(머리에 B · C sha256 기록). 손으로 고치지 않는다.

## 3. 허용 객체 — 이 목록 밖의 객체를 만들거나 바꾸면 적용 중단

| 승인 | 새로 만듦 | 바꿈(create or replace · alter) |
|---|---|---|
| A-C | 표 `content_qualification` · `content_release_approval` · `content_release_revocation` / 함수 `forbid_ledger_mutation` · `fq_axes_valid` · `fq_role_ok` · `content_qualification_record` · `content_release_approve` · `content_release_revoke` · `ledger_writer_guard` / 트리거 6 / 정책 3 | — |
| A-B | 표 `workspace_content_demand` · `workspace_content_demand_line` · `factory_order` · `factory_order_event` · `workspace_content_delivery` / 함수 `factory_order_state_guard` · `workspace_demand_record` · `factory_order_open` · `factory_order_transition` · `supply_artifact_revision` · `supply_learner_exposure` · `workspace_delivery_record` · `supply_writer_guard` / 부분 고유 인덱스 1 / 정책 5 | 기존 표에 **복합 고유키 3**(`learner_workspace(id,user_id)` · `csat_map_goal_version(id,user_id)` · `learner_workspace_plan(workspace_id,plan_version,user_id)`) — 데이터 변경 없음(id 가 이미 PK) |
| I1-S | 함수 `supply_delivery_valid` | 함수 `supply_learner_exposure` · `workspace_delivery_record` · `content_release_revoke` |
| I1-P | 함수 `workspace_line_fulfillment` | `factory_order.state` CHECK(+`partial`) · 인덱스 `factory_order_one_open_per_line`(닫힘에 partial) · 함수 `factory_order_open` · `factory_order_transition` |
| I1-D3 | 표 `factory_product_order` · `factory_order_product_link` / 함수 `factory_product_order_is_current` · `factory_product_order_register` · `factory_order_link_product` / 트리거 4 / 정책 2 | — |

표 · 열 삭제, 기존 데이터 UPDATE/DELETE, 기존 RLS 정책 변경은 **없다**.

## 4. 기존 DB 의존성(2026-10-17 읽기 전용 실측)

| 의존 | 실측 | 쓰는 곳 |
|---|---|---|
| `auth.users` · `auth.uid()` | 있음 | 전 함수 |
| `public.is_admin_or_curator()` · `is_admin()` | 있음(인자 없음) | 관리자 함수 · RLS |
| `public.csat_source_is_eligible(uuid)` | 있음 | DCP 공급 |
| `learner_workspace`(status CHECK active/paused/closed · 0행) · `learner_workspace_plan` · `csat_map_goal_version` | 있음 · RLS on | B 소유 FK |
| `csat_items` · `csat_dcp_items` | 있음 | revision 계산 |
| 노출 원장 `csat_dx_response`(item_id NULL 허용 · 135행 중 51 NULL — 모두 듣기 1–17번, 회차는 있음) · `csat_dx_session` · `learning_task_attempts`(129행 · item_ref 모두 `csat_items.id` 형식) · `learning_sessions`(358행 · help_level independent/viewed_first) · `csat_trap_attempts`(83) · `csat_session_attempts`(1) · `csat_review_queue`(1) · `csat_item_attempts` | 모두 있음 · RLS on | D1 |
| C/B/I1 대상 표 · 함수 | **모두 없음**(`to_regclass` null 11개 · `textbook_product_order` · `product_order` 포함) | 충돌 없음 |

## 5. 적용 순서 · 절차(사용자 승인 뒤에만 — 이 PR 은 실행하지 않는다)

1. `git merge origin/main` 최신 · 이 PR 병합 상태 확인. 각 파일 sha256 을 §2 와 대조(다르면 중단).
2. `/db-checkpoint before i1-supply` — `db_health_metrics` 스냅샷 · `get_advisors(security · performance)` 기록.
3. 한 트랜잭션: **C → B → I1-S**. (I1-P · I1-D3 은 각각 승인됐을 때만 이어서, 같은 트랜잭션 또는 별도 트랜잭션.)
   - 이유: B 만 커밋된 순간이 있으면 그 사이 공급 경로가 D1/D2 결함을 가진다(현재 공급 0행이라 실제 위험은 낮지만 순서를 고정한다).
4. 적용 직후 검증 SQL(§8) → `/db-checkpoint after i1-supply` → `db_health_checkpoint_diff`.
5. 같은 날 E2E(§9) → 결과 · 화면 해시를 이 문서 §10 에 기록 · CHANGELOG · DB_SCHEMA 갱신 · `pnpm docs:db-stats`.

## 6. 적용 전후 health 비교

| 항목 | 기대 |
|---|---|
| advisor security | 새 경고 0. 특히 `function_search_path_mutable` 0(모든 새 · 바뀐 함수 `set search_path to 'public'`), `rls_disabled_in_public` 0(새 표 5+2 모두 RLS on) |
| advisor performance | `unindexed_foreign_keys` 신규는 허용 목록과 대조(B 의 복합 FK 는 고유키로 인덱스됨) |
| 행 수 | 기존 표 행 수 불변(학습 원장 129 · 세션 358 등). 새 표 0행 |
| 함수 실행권 | `supply_learner_exposure` · `supply_delivery_valid` · `factory_product_order_is_current` · `supply_artifact_revision`: authenticated · anon · public 실행권 없음 |

## 7. 롤백 계획 · 데이터 보존

- **I1-S 되돌리기**: 데이터 무관, 언제든 가능. 단 되돌리면 D1/D2 결함이 다시 열린다 → 공급을 막아 두고(B 함수 실행권 회수) 되돌린다.
- **I1-P 되돌리기**: `factory_order.state = 'partial'` 행이 0일 때만. 있으면 되돌리지 않는다(닫힌 주문이 열린 주문처럼 보여 중복 주문 차단이 깨진다).
- **I1-D3 되돌리기**: 두 표가 비어 있을 때만. 행이 있으면 `create table … _preserve_<날짜> as select` 로 복사한 뒤.
- **A(C · B) 되돌리기**: 각 파일 머리의 drop 순서. 원장(자격 · 승인 · 철회 · 이벤트 · 공급)은 **추가 전용** — 행이 있으면 보존 표 복사 뒤에만.
- 생성된 되돌리기 파일은 **모든 보존 조건을 무엇이든 지우기 전에 한 번에 검사**하고 `begin … commit` 으로 감싼다. 격리 검증: 빈 DB 적용 → 되돌리기 → B 원본 동작 복귀 · 새 객체 0 / partial 행이 있으면 전체 거절 · 아무것도 지우지 않음.
- 기존 학생 기록(학습 원장 · 세션 · dx · 함정 시도)은 어떤 단계에서도 읽기만 한다.

## 8. 적용 직후 검증 SQL(읽기 전용)

```sql
-- 객체 · 보안 속성
select p.proname, p.prosecdef, p.proconfig, has_function_privilege('anon', p.oid, 'execute') anon,
       has_function_privilege('authenticated', p.oid, 'execute') authd
from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in
 ('supply_learner_exposure','supply_delivery_valid','workspace_delivery_record','content_release_revoke',
  'workspace_line_fulfillment','factory_order_open','factory_order_transition',
  'factory_product_order_is_current','factory_product_order_register','factory_order_link_product');
select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname in
 ('content_qualification','content_release_approval','content_release_revocation','workspace_content_demand',
  'workspace_content_demand_line','factory_order','factory_order_event','workspace_content_delivery',
  'factory_product_order','factory_order_product_link');
-- D1 실측 재현(개발 DB): 2026-10-17 B 에서 'none' 이던 G2 쌍이 이제 노출로 보이는가 — 서비스 키로 1회
select public.supply_learner_exposure('csat_item', t.item_ref, t.user_id) e, count(*)
from (select distinct user_id, item_ref from learning_task_attempts) t group by 1;   -- 기대: none 0
```

## 9. 실제 DB 적용 후 수행할 E2E(적용 승인 뒤 · 같은 날)

1. `scripts/csat/map/v62/e2e-map-supply.mjs`(이 PR 에서 ⑥ REPAIR 교수 역할 검사 추가) — 1280 · 1440.
2. 합성 학습자 A/B · 관리자 1: 수요 기록 → 주문 → 자격 · public/assessment 승인 → 공급 → Inspector 「공급 완료 / 일부 공급됨 · 남은 n」 → 철회 → 「일부」로 내려감 → 부족분 재주문. 학습자 B 화면에 A 기록 0.
3. G2 로 푼 문항 · 해설만 연 문항 · 같은 지문 문항이 평가 공급에서 거절(실제 원장 행으로).
4. 끝에 합성 계정 삭제 · 남은 행 0 확인(추가 전용 원장의 cascade 경로 포함).

## 10. 격리 검증 결과(이 PR)

| 실행 | 결과 |
|---|---|
| PGlite `supply-i1.pglite.test.ts`(C+B+I1-S+P+D3+되돌리기) | **37/37** |
| PGlite 기존 B · C 회귀(I1 미적용) | 26/26 · 11/11 |
| PGlite 기존 B 시험을 **I1 위에서** 그대로(`SUPPLY_I1_OVERLAY=1`) | 24/26 — 다른 2건은 의도된 D2 변경(평가 역할에 assessment 승인 하나로 공급하던 기대 → 이제 `public approval required`) |
| 실제 PostgreSQL 17 다중 연결 `supply-i1-concurrency.mjs` | **8/8** |
| 같은 스크립트 B 기준선(`--baseline-b`) | 2/5 — B 결함 재현: 수량 3 줄 동시 공급 20 → **20행** · 철회 진행 중 공급 통과 → 철회된 승인으로 공급 1행 |
| 기존 `supply-concurrency.mjs`(main, 수요 본문 v1 → v2 로 갱신 — B 가 8af914add 에서 v2 를 요구하게 된 뒤 낡아 0/7 로 멈춰 있었다) | 7/7 |
| 앱 단위(v62 · csat 컴포넌트 · app) | 1545 통과 · 5 건너뜀 |
| 실제 PC(Next dev · 이 worktree · 1440×1000) `e2e-map-supply.mjs` | **8/8** · 합성 계정 3 생성 · 삭제 뒤 0 · 증거 `evidence/factory-i1-20261017/supply-run2/results.json`(DOM 의 실제 문구 포함). 첫 실행(`supply/results.json`, 6/8)은 새 검사 ①c · ③b 가 확인 단계에 교수 역할 줄이 없어 공허 실패 — 검사를 ⑥ REPAIR 로 옮겨 다시 돌렸다. 첫 실행 기록은 지우지 않았다. Inspector 요소 캡처는 공급 목록 위에서 잘려 바뀐 문구를 보여 주지 않아 커밋하지 않았다(근거는 DOM 단언) |

## 11. I1 적용 준비 판정

- **I1-S(D1 + D2) + A: 적용 준비 완료(사용자 DB 변경 승인 대기).** 실행 가능한 완전한 함수 · 격리 단위 · 실제 Postgres 동시성 · 되돌리기 실측까지 있다.
- **I1-P: 적용 가능, 단 정책 결정 P-1 · P-2 확인 뒤**([PENDING_DECISIONS](./FACTORY_I1_PENDING_DECISIONS.md)).
- **I1-D3: SQL 은 완성 · 격리 통과, 그러나 적용 보류 권고** — 공장 쪽 Product Order 발행 주체 · 등록 경로(D3-1 · D3-2)가 정해지지 않았다. 표만 만들어 두면 빈 등록부가 「계보 검증됨」처럼 읽힐 수 있다.
- 실제 개발 DB 적용 성공 · RLS 실동작 · 실제 학생 데이터에서의 노출 판정은 **아직 검증되지 않았다**(적용 뒤 §8 · §9).
