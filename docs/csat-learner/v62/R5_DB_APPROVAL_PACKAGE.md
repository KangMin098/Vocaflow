<!-- docs/csat-learner/v62/R5_DB_APPROVAL_PACKAGE.md -->
# R5 DB 승인 패키지 — 남은 DB 변경 전부를 한 곳에 (2026-10-18)

> **아무것도 적용하지 않았다.** 개발 DB(`jajenrevcbmrpaliomxv`)에는 이 문서의 어떤 단위도 들어가 있지 않다.
> **단위마다 따로, 명시적인 사용자 승인**이 필요하다. 한 단위를 승인했다고 다음 단위까지 승인된 것으로 보지 않는다.
> 적용 직전에 아래 SHA-256 을 정확한 파일 바이트로 다시 계산해 이 표와 같을 때만 실행한다(`sha256sum <file>`).

## 0. 순서 요약

| # | 단위 | 파일 | SHA-256 | 바이트 | 상태 |
|---|---|---|---|---|---|
| 1 | DB-1 공급 기반(C · B · I1-S) | `supabase/migrations/20261017200000_factory_i1_db1_supply_foundation.sql` (`origin/chore/factory-i1-deploy-package`) | `061a48a8b50b956762dedf171d3a8949d4f9bae4da4058b41d52227eb767c624` | 104,441 | 승인됨 · **BLOCKED_EXECUTION**(세션 메인 워크트리에서 승인 훅이 꺼져 있다) |
| 2 | DB-2 부분 납품(I1-P) | `supabase/deploy/factory-i1/db2/20261017200100_factory_i1_db2_partial.sql` (같은 브랜치) | `2165015d063ff67a56806e57dabbaa6aa7fe2bd07e8608beaa8a9323fba8896b` | 32,678 | 미승인 |
| 3 | I2 주석 hash 결속 v2 | `supabase/migrations/_pending_workspace_supply_c_annotation_binding.sql` | `e7f7c16facd30124ec8a668701037d926a67c61dc1c5283c9ccbc79ce00c0b8c` | 10,641 | 미승인 |
| 4 | 공급 ↔ G2 시도 결속 | `supabase/migrations/_pending_r5_delivery_g2_binding.sql` | `ab4cc960e39ee5372b93eb576d1b370c904f80fabd299bc8ebef3f1a1cfd9279` | 20,206 | 미승인 |
| 5 | 원자적 첫 노출 | — (별도 파일 없음) | — | — | **4번에 포함**(아래 §5) |

적용 순서: **1 → 2 → 3 → 4**. 2(DB-2)는 3 · 4 와 객체가 겹치지 않는다 — 4 는 2 없이도 적용 · 시험된다(2 를 미루어도 3 · 4 가능). 3 은 반드시 1 뒤, 4 는 반드시 1 + 3 뒤(파일이 스스로 확인하고 멈춘다).
DB-2 의 MANIFEST.json 은 배포 브랜치에서 찾지 못했다 — SHA 는 파일 바이트로 직접 계산했고 지시된 값(2165015d…)과 같다.

---

## 1. DB-1 — 공급 기반 (C 자격 원장 · B 수요/주문/공급 · I1-S 안전 delta)

- **파일 · SHA**: 위 표. 세그먼트는 바이트 그대로 — C `dd940568…3f66` · B `2957ecf7…aa02` · S `cc3d9100…b6de`(현재 `_pending_workspace_supply_*` 파일과 같은 값임을 R5 시험이 다시 확인).
- **추가 객체**: 표 8 — `content_qualification` · `content_release_approval` · `content_release_revocation` · `workspace_content_demand` · `workspace_content_demand_line` · `factory_order` · `factory_order_event` · `workspace_content_delivery`. 함수 16 — `forbid_ledger_mutation` · `fq_axes_valid` · `fq_role_ok` · `content_qualification_record` · `content_release_approve` · `content_release_revoke` · `ledger_writer_guard` · `factory_order_state_guard` · `workspace_demand_record` · `factory_order_open` · `factory_order_transition` · `supply_artifact_revision` · `supply_learner_exposure` · `workspace_delivery_record` · `supply_writer_guard` · `supply_delivery_valid`. RLS 정책 8 · 트리거 15 · 기존 표 3개에 고유 제약(`csat_map_goal_version(id,user_id)` · `learner_workspace(id,user_id)` · `learner_workspace_plan(workspace_id,plan_version,user_id)`).
- **기존 객체 변경**: `is_admin()` · `is_admin_or_curator()` 의 `search_path` 에 `pg_temp` 끝 고정(본문 · ACL 불변 — 에필로그가 다른 속성 변화를 거절).
- **기존 데이터 영향**: 없음(새 표는 0행 · 기존 행 일괄 판정 없음).
- **불변식**: 원장은 추가 전용(UPDATE/DELETE 트리거 거절) · 쓰기는 정의자 RPC 만(`vocaflow.supply_writer='rpc'`) · 평가 역할 공급은 노출 G='none' + public · assessment 유효 승인 · revision 바뀌면 자격 상속 없음.
- **적용**: `node scripts/db/factory-i1/deploy.mjs apply --stage db1` 만(한 트랜잭션 · 이력 행 같은 트랜잭션). 프롤로그가 전제 · 대상 부재 · helper drift 를 검사하고, 에필로그가 카탈로그 diff 를 허용 목록과 정확히 비교한다 — 어긋나면 `DEPLOY_BLOCKED[...]` 로 전체 롤백.
- **검증 SQL**:
  ```sql
  select version from supabase_migrations.schema_migrations where version = '20261017200000';
  select encode(sha256(convert_to(array_to_string(statements,''),'UTF8')),'hex') from supabase_migrations.schema_migrations where version = '20261017200000';  -- = 061a48a8…
  select relname, relrowsecurity from pg_class where relname in ('content_qualification','workspace_content_delivery');            -- RLS true
  select has_table_privilege('authenticated','public.workspace_content_delivery','INSERT');                                           -- false
  ```
- **실패 · 되돌리기**: 실패는 트랜잭션 전체 롤백(부분 커밋은 커밋 가드가 막는다). 적용 뒤 되돌리기는 행 0일 때만, 역순 DROP(B → C) — 별도 승인.
- **격리 시험**: `supply-i1.pglite.test.ts` 47/47 통과(2026-10-18, I1-P 포함 상태).

## 2. DB-2 — 부분 납품 정책 (I1-P)

- **파일 · SHA**: 위 표. 세그먼트 P = `_pending_workspace_supply_i1_partial.sql` sha256 `79807c38244982389ad2eb25b36350bc7121a84cc10b5ab54a1293b758e95041`.
- **변경 객체**: `factory_order.state` CHECK 에 `partial` 추가 · 부분 고유 인덱스 `factory_order_one_open_per_line`(닫힘 상태에 partial 포함) 재생성 · `factory_order_open` · `factory_order_transition` 본문 교체(같은 서명) · 새 함수 `workspace_line_fulfillment(uuid)`.
- **기존 데이터 영향**: 없음(DB-1 직후 주문 0행).
- **불변식**: delivered = 유효 공급 수 = 주문 수량 · partial = 1 ≤ 유효 공급 < 수량 + 이유 필수 · 재주문 수량 ≤ 남은 부족(줄 기준 현재 유효 공급으로 계산).
- **적용**: `deploy.mjs apply --stage db2`. 프롤로그가 DB-1 이력 행의 본문 sha256 = `061a48a8…` 를 요구한다(DB-1 실DB 검증 전 적용 불가).
- **검증 SQL**: `select pg_get_constraintdef(oid) from pg_constraint where conname = 'factory_order_state_check';` (partial 포함) · `select to_regprocedure('public.workspace_line_fulfillment(uuid)');` (not null).
- **실패 · 되돌리기**: 실패는 전체 롤백. 되돌리기는 partial 행 0일 때만 B 원본 CHECK · 인덱스 · 두 함수로 복원 + `drop function workspace_line_fulfillment` — 별도 승인.
- **격리 시험**: `supply-i1.pglite.test.ts` 47/47(P 적용 상태) 통과.

## 3. I2 — 채점 주석 hash 결속 v2

- **파일 · SHA**: 위 표. 전제: DB-1(I1-S 포함). I0 delta 와 함께 적용 금지.
- **추가 · 변경 객체**: `content_qualification` 에 열 `annotation_ref` · `annotation_hash` + CHECK `content_qualification_annotation_bound` · 인덱스 `content_qualification_identity` 재생성(주석 hash 포함) · `content_qualification_record` 서명 교체(옛 16인자 DROP → 18인자) · 새 표 `supply_current_annotation`(빈 상태 · 학습자/서비스 권한 0) · 새 함수 `supply_annotation_matches(uuid)` · `workspace_delivery_record` → `_i1` 로 이름 변경 후 wrapper 재생성 · `supply_delivery_valid` → `_i1` 로 이름 변경 후 wrapper 재생성.
- **기존 데이터 영향**: 없음(DB-1 직후 자격 0행 · 백필 없음). 단 **설치 즉시 csat_item 신규 공급은 모두 거절** — `supply_current_annotation` 이 비어 있고, 배포 동기화 절차가 별도 승인되어야 채워진다.
- **불변식**: B · C · E 중 pass 가 있는 csat_item 자격은 주석 ref/hash 필수 · 공급 시점 현재 배포 주석 = 자격 주석 · 주석이 바뀌면 상속 없음.
- **적용**: DB-1 뒤 한 트랜잭션. 파일 첫 블록이 `supply_delivery_valid(uuid)` 부재 시 멈춘다.
- **검증 SQL**: `select count(*) from pg_proc where proname = 'content_qualification_record';` (=1, 18인자) · `select to_regclass('public.supply_current_annotation');` · `select has_table_privilege('authenticated','public.supply_current_annotation','SELECT');` (false).
- **실패 · 되돌리기**: 실패는 전체 롤백. 기존 I1 rollback 은 이 v2 를 모른다 — 역순 복원은 별도 승인 전 실행 금지 · 이력 존재 후 열/표 DROP 금지.
- **격리 시험**: `supply-c-annotation-binding.pglite.test.ts` 7/7 통과.

## 4. 공급 ↔ G2 시도 결속 (R5 §6)

- **파일 · SHA**: 위 표. 전제: DB-1 + I2(없으면 `requires DB-1 first` / `requires DB-1 + I2` 로 멈춘다) · `learning_task_attempts` 의 `session_id` · `activity` · `help_level` · `content_hash` · `received_at` 열(기존 마이그레이션 20261008120000 · 160000 · 180000).
- **추가 객체**: 표 `workspace_delivery_attempt`(추가 전용 · RLS · 정책 `wda_owner_read`) · 인덱스 `workspace_delivery_attempt_first_exposure`(부분 고유: `(user_id, exposure_key) where first_exposure`) · `workspace_delivery_attempt_delivery` · 트리거 2(`forbid_ledger_mutation` · `supply_writer_guard` 재사용) · 함수 `r5_exposure_key(text,text)`(내부 · 실행권 없음) · `workspace_delivery_attempt_record(uuid, bigint, uuid)`(학습자 RPC · 정의자 · `search_path=public, pg_temp`).
- **기존 객체 변경**: **없음**. `learning_task_attempts` 열 · 제약 · 권한 그대로, 백필 없음 → 결속 행이 없는 레거시 시도는 지금처럼 유효.
- **기록 열**: user · workspace · plan version · demand · line · order · delivery · qualification · approval · 문항 ref · TASK · 역할 · artifact revision · 주석 ref/hash · 시도 id · 세션 id · 도움 상태(helped/practice/independent/transfer — 시도 행에서 서버가 정함) · 노출 키 · 첫 노출 여부/시각 · 근거 여부 · 비근거 사유 · 요청 키.
- **불변식**
  - 과제 키 → TASK 대응(P1-a): 시도 `task_key` 는 과제 키(예: `claim-support`), 공급 `task_id` 는 TASK id(예: `r.central_meaning`)라 직접 비교하지 않는다. 기존 신뢰 등록부 `supply_current_annotation`(I2 · 배포 소유자만 갱신 · 학습자/서비스 권한 0)의 (문항, TASK) 행을 기준으로, 시도 `content_hash` = 등록 주석 hash · `response.annotation` = 등록 주석 version · 그 version 이 `<과제 키>-` 로 시작해야 한다. 새 매핑 표를 만들지 않은 이유: 등록부가 이미 (문항, TASK) → 주석을 배포 manifest 로 고정하고, 주석 version 이 과제 키를 접두로 갖는다(item-tasks 레지스트리 규칙). csat_item 밖 종류는 대응 근거가 없어 거절.
  - 첫 노출(P1-b): 시도 서버 수신 전에 같은 문항 · 같은 지문을 본 기록 — G2 시도 · 다른 G2 세션(열람 · 해설 · 도움, 시각 없으면 앞선 것으로 간주) · 같은 세션의 답 전 해설/도움 · 함정 · 세션(문제지) 시도 · 복습 큐 · 진단 응답 · 같은 회차 응시 · 앞선 결속 — 이 하나라도 있으면 첫 노출 아님. 원장 표를 확인할 수 없으면 `exposure_unverifiable` 비근거(fail-closed).
  - 거절: 남의 공급 · 남의 시도(42501) · Workspace 비활성 · 다른 문항 · 과제 키 대응 실패 · 공급 전에 받은 시도 · 세션/내용 hash/activity 누락(unbound) · 시도 주석 hash ≠ 자격 주석 · 현재 revision ≠ 공급 revision · 현재 배포 주석 ≠ 자격 주석 · 한 시도 두 번 결속.
  - 비근거로 기록(이력 불변): 자격 대체 · 승인 철회 · 그 밖의 현재 공급 무효 · 노출 판정 불가 · 첫 노출 아님 · 도움 상태 ≠ 역할(독립/지연 확인 ↔ independent, 전이 ↔ transfer) · 근거 역할 아님.
  - 요청 키 멱등: 같은 키 + 같은 본문 → 같은 id · 다른 본문 → 23505.
  - 학습자는 RPC 만. 표 직접 INSERT/UPDATE/DELETE/TRUNCATE 권한 없음 · 소유자도 RPC 밖 쓰기는 가드 · 추가 전용 트리거가 거절.
- **적용**: 1 · 3 뒤 한 트랜잭션(`begin; \i …; commit;` 또는 승인된 러너). 버전 번호는 승격 시 `ls supabase/migrations` 로 정한다.
- **검증 SQL**:
  ```sql
  select to_regclass('public.workspace_delivery_attempt');
  select indexdef from pg_indexes where indexname = 'workspace_delivery_attempt_first_exposure';
  select proconfig, prosecdef from pg_proc where proname = 'workspace_delivery_attempt_record';            -- {search_path=public, pg_temp}, true
  select has_table_privilege('authenticated','public.workspace_delivery_attempt','INSERT,UPDATE,DELETE,TRUNCATE'),
         has_function_privilege('anon','public.workspace_delivery_attempt_record(uuid,bigint,uuid)','EXECUTE'); -- false, false
  select count(*) from public.workspace_delivery_attempt;                                                     -- 0 (백필 없음)
  ```
- **실패 · 되돌리기**: 실패는 전체 롤백. 행 0일 때만 `drop function workspace_delivery_attempt_record(uuid,bigint,uuid); drop function r5_exposure_key(text,text); drop table workspace_delivery_attempt;` — 별도 승인. 행이 생긴 뒤에는 DROP 하지 않고 `revoke execute … from authenticated` 로 중단.
- **격리 시험**: `apps/web/src/lib/csat/map/v62/__tests__/r5-delivery-g2-binding.pglite.test.ts` **30/30 통과**(Codex P1-a · P1-b 수정 반영)(PGlite · DB-1 세그먼트 C → B → S + I2 + 이 파일). 반례: 실제 G2 기록 모양(2020#24 전이 · task_key=claim-support · response.annotation=claim-support-2020-24.v1) 정상 결속 · 과제 키 대응 실패 3종 · 다른 세션 해설 열람 · 시각 없는 세션 · 같은 세션 답 전 해설 · 함정 · 세션 시도 · 복습 큐 · 진단 응답 · 같은 회차 응시 · 시도 뒤 노출(첫 노출 유지) · 원장 확인 불가(fail-closed) · 다른 학습자 · 중복 요청 키 · 같은 시도 재결속 · 순차 두 주장 · 같은 지문 다른 문항 · 고유 인덱스 위조 · 승인 철회 · 자격 대체 · 시도 hash/배포 주석/본문 revision 변경 · 비활성 Workspace · 레거시 호환 · 전제 부재.

## 5. 원자적 첫 노출 — 4번에 포함

- 별도 단위가 아니다. 4번 파일이 사용자 × 노출 키(`passage:<정규화 지문 md5>` 또는 `item:<kind>:<ref>`) `pg_advisory_xact_lock` 으로 직렬화하고, 부분 고유 인덱스 `workspace_delivery_attempt_first_exposure` 가 최종 방어선이다 — 동시 두 요청이 모두 첫 독립 노출이 될 수 없다(락을 우회해도 두 번째는 23505 로 실패).
- 첫 노출 판정 = §4 「첫 노출(P1-b)」 의 모든 원장에서 이 시도 수신 이전(같음 포함) 노출 0건 + 같은 노출 키 앞선 결속 0건.

## 6. 설계 한계(승인 전에 알아야 할 것)

1. **진짜 동시성은 PGlite 로 못 만든다** — 경합은 순차 두 주장 + 고유 인덱스 위조로만 검증했다. 실 Postgres 두 연결 시험은 `scripts/csat/map/v62/supply-i1-concurrency.mjs` 패턴으로 별도 실행이 필요하다.
2. **노출 원장 시각**: 복습 큐 · 진단 응답에는 시각이 없어 존재만으로 「앞선 노출」로 본다(보수적 — 시도 뒤 생긴 행도 비근거로 만들 수 있다). 함정 · 세션 시도는 `answered_at`(클라이언트 시각일 수 있음)으로 비교한다.
3. **쓰기는 두 단계**: G2 시도 행은 서버(service_role, `learning_attempt_record`)가 쓰고, 결속은 학습자 세션이 RPC 로 부른다. 앱 연결(`recordItemTaskAttempt` 뒤 결속 호출)은 이 패키지 밖이다.
4. **판정은 기록 시점 고정**: 기록 뒤 승인이 철회돼도 이미 근거로 남은 행은 바뀌지 않는다(이력 불변). 「지금도 근거인가」는 읽을 때 `supply_delivery_valid(delivery_id)` 와 함께 본다.
5. **사용자 삭제**: `attempt_id` · `user_id` FK 는 cascade 가 없고 표가 추가 전용이라, 결속 행이 있는 사용자의 auth 삭제는 막힌다(DB-1 원장과 같은 성격). 계정 삭제 절차는 별도 승인 사항.
6. **DB-2(P) 와 함께 적용한 상태로는 R5 시험을 돌리지 않았다** — 객체가 겹치지 않아 순서 독립으로 판단했다.
