# 32 — P6 SQL v3 개발 DB 적용 보고 · 사후 검증 · v3.1 보정 제안

> 개발 DB `jajenrevcbmrpaliomxv` 에만 적용. 실학습자 데이터 · 기존 표 · 기존 RPC 본문 변경 없음. T-0140 BLOCKED_AUTH · main 통합 · S2 수용 미승인 유지.

## 1. 적용

| 항목 | 값 |
|---|---|
| 승인 파일 | `p6-sql/20261024100000_learning_exposures.v3.sql` |
| 승인 · 적용 sha256 | `741e0585ac4dd606c997a2b8b8fd47456e10853957ecc0b3867579b3f3d6be8e` — 디스크 · 연구 브랜치 커밋 모두 같은 값, 같은 본문을 `apply_migration(name=learning_exposures)` 으로 전송 |
| 결과 | success |

## 2. 사전 확인(적용 전)

- 번호 충돌 없음: 개발 DB 마지막 마이그레이션 `20261023082930` · 2026-10-24 항목 없음.
- 신규 객체 이름 미존재(`to_regclass` · `pg_proc` · 열).
- 기준 상태: `learning_task_attempts` 129행 · md5 `5b9f118a6ef3f31598fbe03b7e8fdbce` · `learning_sessions` 359 · `learning_mutations` 504.
- 실제 정의 확보 → `p6-sql/real-bootstrap.sql`: 기존 RPC 5(`learning_attempt_record` · `learning_attempt_submit` · `learning_session_apply` · `learning_mutation_claim` 외) · 트리거 함수 6 · 트리거 7 · 실제 뷰 `learning_first_attempts` · 표 DDL 4(본문 무수정).
- **31 정정**: BEFORE INSERT 트리거는 이름순이라 새 `learning_task_attempts_exposure_order` 가 기존 `learning_trial_sample_frozen_attempt` 보다 **먼저** 돈다(31 은 반대로 적었다). frozen 이 거부하면 트랜잭션 전체가 롤백되어 잠금도 풀린다(AT-P6-02 확인).

### AT-P6-01~03(격리 PostgreSQL · 실제 정의 위 · 승인 SQL) — 18/18 PASS(`at-p6-results.json`)

| 시험 | 결과 |
|---|---|
| 적용 뒤 기존 시도 행 수 · 기존 열 내용 불변 · 새 열 NULL | PASS |
| AT-P6-01 실제 `learning_attempt_submit` 저장 · `exposure_order_at` 채움 · 재전송 duplicate · 다른 내용 conflict · `learning_attempt_record` 직접 저장 · authenticated 실행 불가 유지 | PASS ×5 |
| AT-P6-02 분석 완료 표본 시도 추가 frozen 거부 유지 · 거부 트랜잭션 잠금 미잔존(2ms) · update_guard · delete_guard 유지 · 합성 UPDATE 경로 무관 · 노출 원장 UPDATE 거부 | PASS ×6 |
| AT-P6-03 실제 RPC · 실제 뷰: K1 after_exposure · 대조 independent_candidate · K2 대기 405ms 후 independent_candidate · viewed_first → helped · 적용 전 행 legacy_unknown | PASS ×5 |

## 3. 사후 검증(실제 Supabase)

읽기 확인:
- 신규: 표 2 · 인덱스 3(pkey · UNIQUE · user_item) · 트리거 2(`learning_task_attempts_exposure_order` · `learning_exposures_append_only`) · 정책 2 · 함수 4(append_only 만 security definer, 넷 모두 `search_path=public, pg_temp`).
- 기존 데이터: 시도 129행 · 기존 열 md5 `5b9f118a…` **동일** · `exposure_order_at` 129행 모두 NULL · 세션 359 · mutation 504 동일 · 노출 0 · 추적 표식 1.
- 권한: anon 신규 표 권한 없음 · authenticated SELECT 만 · 기록 RPC 실행 service_role 만 · 판정 함수 authenticated · service_role.

동작 확인(한 트랜잭션 안에서 모두 실행 뒤 일부러 예외로 **전부 롤백** — 실행 후 노출 0 · 시도 129 · md5 동일 확인):

| 항목 | 결과 |
|---|---|
| 다른 학습자 행 조회(authenticated · 남의 sub) | 0행 |
| 본인 행 조회 | 2행(본인 것만) |
| authenticated INSERT · UPDATE · DELETE · RPC 실행 | 모두 거부 |
| anon SELECT · 판정 함수 | 거부 |
| service_role UPDATE · TRUNCATE | 거부 |
| 실학습자 행 DELETE | 거부(트리거) |
| 합성 행 DELETE | 허용 |
| 소유자 UPDATE | 거부(트리거) |
| kind · source 제약 | 위반 거부 |
| 기존 시도 저장 RPC(`learning_attempt_record`) | 정상 저장 · `exposure_order_at` 채움 |
| 판정: 노출 뒤 시도 after_exposure · 앞 시도 비소급 유지 · 기존 행 legacy_unknown | 정상 |
| **노출 기록 RPC `learning_exposure_record`(service_role)** | **실패 — `permission denied for table users` (42501)** |
| **`learning_exposure_tracking` service_role 권한** | SELECT 외 INSERT · DELETE · REFERENCES · TRIGGER 잔존(Supabase 기본 권한) |

### 결함과 원인
- 기록 RPC 는 security invoker 인데 「없는 사용자」 확인으로 `auth.users` 를 읽는다. **실제 Supabase 의 service_role 에는 `auth.users` SELECT 가 없다.** 격리 하네스가 스텁에서 이 권한을 줬기 때문에 PGlite · 격리 PG 시험이 놓쳤다(잘못된 가정). 하네스를 실제와 같게 고쳐(`real-bootstrap.sql`) v3 만으로 재현: 14/17(RPC 실패).
- 영향: 이 RPC 를 부르는 제품 코드는 아직 없다 — 지금 사용자 영향 없음. 다만 이대로는 노출을 기록할 수 없다(P1 · 기능 불가). 데이터 · 기존 기능 영향 없음.
- 조치: 추가 DB 변경은 하지 않았다(승인 범위 밖). RPC 가 실패만 하므로 실행 권한 회수 같은 복구는 불필요하다고 판단해 적용하지 않았다.

## 4. 보정 제안 v3.1(미적용 · 별도 승인 필요)

`p6-sql/20261024110000_learning_exposures_fix_v3_1.sql` — sha256 `3f8b9e996820f4d327a14634d3bdc50af121e75d1fa13789e85c5b202cc7f5b8`
1. `create or replace function learning_exposure_record` — `auth.users` 존재 확인 문만 삭제(존재는 외래 키가 보장 · 없는 사용자 → 23503 거부). 서명 · invoker · search_path · 권한 동일(`create or replace` 는 권한 유지).
2. `revoke insert, delete, references, trigger on learning_exposure_tracking from service_role`.
- 데이터 · 표 · 열 · 트리거 변경 없음.
- 격리 PG(실제 정의 · 실제와 같은 권한) v3 + v3.1: **21/21 PASS**(`at-p6-results-v3_1.json`) — RPC 동작 · 없는 사용자 FK 거부 · 추적 표식 SELECT 만 · AT-P6-01~03 전부.

## 5. 비파괴 복구 가능 여부

- 노출 기록 중단: `revoke execute on function public.learning_exposure_record(…) from service_role;` — 가능(현재 RPC 는 어차피 실패).
- 시도 순서 트리거 중단: `drop trigger learning_task_attempts_exposure_order on public.learning_task_attempts;` — 데이터 삭제 없음, 이후 새 시도는 legacy_unknown 으로 보수 판정.
- 판정 함수 교체: `create or replace` — 저장 데이터 무변경.
- `drop table` · 열 삭제 · 기존 행 삭제: 이번 승인 범위 밖.

## 6. 남은 일

- v3.1 승인 · 적용 · 같은 사후 검증 재실행.
- 적용된 v3(와 v3.1)를 저장소 `supabase/migrations/` 에 같은 본문으로 커밋 · `docs/DB_SCHEMA.md` · CHANGELOG — 대상 브랜치 · owner 결정 필요(T-0140 은 `supabase/` 금지). 그 전까지 개발 DB 이력과 저장소 마이그레이션이 어긋난 상태(`list_migrations` 에 `learning_exposures` 있음).
- 판단 장면 (b) 제품 구현 · 실계정 E2E: 별도 작업.
