# Pilot 데이터 모델 — 마이그레이션 (2026-10-05 · 개발 DB 적용)

> **적용 기록(2026-10-05)** — origin/main 병합(19cfb8a17) 뒤 격리 하네스 273/273 · rollback 11/11 재통과 → checkpoint `20261005130000` before → preflight(제약 이름 4 일치 · 이름 충돌 0) → 개발 DB 한 트랜잭션 적용(파일 sha256 `befdaec2…`, schema_migrations 버전 = 파일 번호) → after.
> 적용 직후: 기존 행 · `v99.0` 해시 · 회차 해시 · 상태 불변, 새 표 0행, 기존 회차 `evidence_profile = all`. 객체 csat_ec 함수 40→52 · 정책 5→6 · 트리거 14→17 · 인덱스 26→33 · 제약 83→110.
> 실제 PostgREST/Auth smoke `dev-smoke/smoke-pilot.mjs` **109/109**, 기존 smoke 139/142(실패 3 = v99.0 이 이미 봉인된 재실행 전제 문제, 마이그레이션 무관). Security Advisor ERROR 0 · csat_ec 경고 25→31(+6 모두 의도: 관찰 표 정책 없음 · 경계 GraphQL 노출 · authenticated definer RPC 4).
> 개발 DB 에 TEST taxonomy `v99.1`(경계 2) 이 남아 `rollback-pilot.sql` 은 정리 전까지 거부된다.
> **학생 증거 수집(2026-10-05)** — `20261005150000_csat_ec_capture_support` 적용(interpretation 3상태 · 재전송 멱등 · probe 세션 상한 · 본인 유효 증거). 수집 화면 · API 는 `lib/csat/ec-pilot` · `components/csat/diagnosis/capture`. 개발 Supabase smoke `dev-smoke/smoke-capture.mjs` 42/42 · e2e `tests/e2e/52-csat-ec-capture.spec.ts` 2/2.
> **실제 Pilot 전 blocker** ① 결과 · 해설 · 보고서의 **서버 측** 보류(수집이 끝나지 않은 세션 — 지금은 수집 화면 단계 보류뿐이라 해설 URL · 보고서로 우회 가능) ② 경계 **탐지기**(interpretation · 과정 증거 → csat_ec_boundary_signal → 대기 질문 — 지금은 smoke 가 service_role RPC 로 넣는다). 둘 없이 실제 Pilot 을 시작하지 않는다.
> 아래 본문은 적용 전 초안 그대로다.

> SQL: [`supabase/migrations/20261005130000_csat_ec_pilot_evidence.sql`](../../../supabase/migrations/20261005130000_csat_ec_pilot_evidence.sql) · 되돌리기: [`scripts/csat/error-evidence/rollback-pilot.sql`](../../../scripts/csat/error-evidence/rollback-pilot.sql)
> 상위 설계: [PILOT_SEED_DESIGN.md](./PILOT_SEED_DESIGN.md) · 기존 모델: `20261003230000_csat_error_evidence.sql`(테이블 9 · RPC 30+).
> **적용하지 않았다.** conditional seed · 학생 UI · Pilot · verified diagnosis · Learning Map · Evidence Anchor 변경 없음. 다음 승인 게이트 = 이 SQL 의 개발 DB 적용.
> 순서(사용자 결정): migration 적용 → conditional seed 적용 → UI 구현 · 통합 검증 → Pilot.

## 격리 PostgreSQL 실행 검증(개발 DB 아님)

| 실행 | 결과 |
|---|---|
| `isolated-pg/run-pilot.mjs` — 원래 마이그레이션 → 기존 흐름으로 데이터 생성 → Pilot 적용 → 기존 테스트 전부(회귀) → `t_pilot` | **273 / 273 통과** |
| `isolated-pg/rollback-pilot.mjs` — 새 클러스터: 적용 → (새 값 행 있으면 거부) → rollback → 스키마 완전 비교 → 재적용 | **11 / 11 통과** · rollback 뒤 스키마 차이 0 |

## A. 바꾸는 객체(정확히)

| 구분 | 객체 |
|---|---|
| 기존 제약 확장 | `csat_ec_judgment_outcome_check` · `csat_ec_ai_run_outcome_check`(→ `csat_ec_outcomes()` 단일 원천) · `csat_ec_claim_role_check`(+ candidate) · `csat_ec_process_evidence_kind_check`(+ interpretation · targeted_probe) |
| 새 제약 | `csat_ec_judgment_candidates_check` · `csat_ec_claim_candidate_ai_only` · `csat_ec_process_interpretation_check` · `csat_ec_process_probe_check` · 인덱스 `csat_ec_process_probe_once` |
| 기존 표 확장 | `csat_ec_judgment.candidate_codes text[] default '{}'` · `csat_ec_review_round.evidence_profile text default 'all'` |
| 새 표 | `csat_ec_boundary`(taxonomy 경계) · `csat_ec_boundary_signal`(attempt 경계 관찰) |
| 새 함수 | `csat_ec_outcomes` · 경계 가드 2 · 3인자 `valid_process_evidence` · `canonical_input` · `judgment_input_hash` · `my_pending_probes` · `add_detector_signal` · `attach_judgment_boundaries` · 5인자 `round_create` · 11인자 `submit_blind` · `submit_adjudication` |
| 본문 교체(같은 시그니처) | `round_inputs_intact` · `round_guard` · `judgment_insert_guard` · `add_process_evidence` · `round_set_targets` · `round_start_blind` · `submit_blind`(8인자 → 11인자 위임) · `submit_adjudication`(8인자 → 위임) · `round_advance` · `taxonomy_seal` · `ai_taxonomy` · `ai_export` · `ai_import` |

seed 없음 — v0.1 코드 · R6 경계는 이 마이그레이션에 넣지 않는다(별도 단계).

## B. outcome 확장

- 허용값은 `csat_ec_outcomes('judgment' | 'ai_run')` 한 곳에서 나오고 두 CHECK 가 같은 함수를 쓴다(코드북이 바뀌어도 한 곳만 고친다 — R1–R11 하드코딩 사고의 재발 방지).
- 기존 이름 유지: 판정 `code` · AI `proposed` = identified. 이름을 바꾸면 기존 행 · 클라이언트가 깨진다.
- 추가: `multiple_plausible`(primary 없음 · 후보 ≥ 2) · `inconsistent_evidence`(후보 0 또는 ≥ 2).
- **`unsupported_stimulus` 는 넣지 않는다** — attempt 결과가 아니라 대상 밖이다. 지금 `csat_ec_pilot_eligible` 이 원문 · 정답 · body_ok 없는 문항을 빼고 있고, 도표 문항은 자산 작업(`20261004234255_csat_chart_review_assets`)이 진행 중이라 적격 단계에서 정할 일이다.

## C. provisional 경계 — 물리 모델

`csat_ec_boundary(version, boundary_key, code_a, code_b, status, probe_key, decision_note, provenance)`

- 코드 상태(`csat_ec_code.status` active/deprecated)와 **분리** — V.wrong_sense · R.inference 코드는 accepted, 둘 사이 경계만 provisional.
- 순서 고정: `code_a < code_b`(C 정렬) · `boundary_key = lower(code_a)__lower(code_b)` → R6 = `r.inference__v.wrong_sense`. 역순 중복 불가.
- 상태: accepted · provisional · retired. probe 는 provisional 에만.
- 봉인된 버전의 경계는 추가 · 수정 · 삭제 불가(코드와 같은 가드). **봉인 해시에 경계 포함** — 경계가 없는 버전은 이전 공식과 바이트 단위로 같다(기존 봉인 `v99.0` · 테스트 `v9.0` 재계산 일치 확인).
- R6 하드코딩 없음 — SQL · RPC 어디에도 특정 코드 쌍이 없다(경계는 데이터).

## D. 판정 ↔ 경계 연결 — B안(관찰 표) 선택

| 기준 | A안: 판정 행에 `boundary_id` | **B안: `csat_ec_boundary_signal`** |
|---|---|---|
| 한 판정이 여러 경계 | 하나뿐 | 여러 개 |
| 출처 | 사람 판정만 | 탐지기 · AI 실행 · 사람 판정(probe 를 띄우는 건 판정 전 탐지기다) |
| FK 무결성 | 가능(하나일 때) | 가능 — (version, boundary_key) FK + 출처 FK |
| 수명주기 | 판정과 같음 | 덧붙이기 전용(판정 · 실행과 같은 event 규칙) |
| RLS | 판정과 함께 | 직접 권한 없음(RPC 만) — 판정 표와 같은 원칙 |
| 표 수 | +0 | +1 |

B안의 추가 비용(표 1개)은 「탐지기 신호가 판정보다 먼저 생긴다」는 Pilot 흐름 때문에 피할 수 없다 — A안으로는 probe 를 띄운 근거를 저장할 곳이 없다.
기록 의미: 경계 · probe 필요 여부 · **관찰 당시 경계 상태** · 출처(판정 · 실행 · 탐지기 버전) · 근거 과정 증거 id. 「해소됨」 상태는 없다 — 해소는 그 뒤 판정 결과로만 드러난다(두 모델 합의로 해소를 저장하지 않는다).

## E. interpretation · targeted_probe

기존 `csat_ec_process_evidence` 재사용(새 표 없음) · 덧붙이기 전용 · 정정은 supersede.
- `interpretation`: `{text}` 1–500자.
- `targeted_probe`: `{probe_key, probe_version, taxonomy_version, boundary_key, prompt_hash, option('A'..'Z' | null), skipped, free_text?}` — 건너뜀 ⇔ 선택 없음(CHECK).
- 학생 행에는 **선택지 글자만** — `V.wrong_sense` 같은 내부 원인 이름을 저장하지 않는다. A/B/C/D 의 뜻은 버전 붙은 probe 정의(F)와 분석 계층이 해석한다.
- RPC 가 거부: 봉인 사전에 없는 경계 · provisional 이 아닌 경계 · probe_key 불일치 · **이 attempt 에 probe 요구 관찰이 없는데 온 응답**(「질문 없음」과 「건너뜀」을 구분).
- DB 가 강제: attempt × probe_key 첫 응답 하나(unique). 서비스가 강제: 세션당 상한(정책이 바뀔 수 있다).

## F. probe 정의 버전

DB 표를 만들지 않는다(CMS 구조 없음). 정의는 저장소의 버전 산출물(문구 · 선택지 · 각 선택지의 해석)로 두고, 증거 행에 `probe_key · probe_version · prompt_hash` 를 봉인한다 — UI 문구가 나중에 바뀌어도 그 학생이 어떤 판에 답했는지 재현된다. probe 가 늘거나 관리 화면이 필요해지면 정의 표로 승격.

## G. multiple_plausible 후보 저장

- 사람 판정: `candidate_codes`(primary · contributing 과 다른 컬럼 — 「하나를 정하지 못한 후보들」). multiple 이면 ≥ 2 · primary NULL · contributing 없음, identified(`code`)면 후보 없음.
- AI: claim `role = 'candidate'`(AI 만). multiple = candidate ≥ 2 · primary/contributing 없음.
- 회차 닫기의 「A · B 완전 일치」 비교에 후보 집합 포함.

## H. probe 전 · 후 재현

회차에 `evidence_profile`(all | pre_probe)를 봉인한다. pre_probe 는 targeted_probe 를 뺀 증거로 판정 입력을 만든다.
- 같은 attempt 를 pre_probe 회차 · all 회차로 각각 판정 — 두 회차의 `process_evidence_ids` · `input_hash` 가 다르다(검증됨).
- 증거 행에 「전/후」 플래그를 두지 않는다 — 어떤 id 들이 들어갔는지는 봉인된 targets 가 재현한다.
- `all` 의 판정 입력 전문은 이전과 **바이트 단위로 같다** — 기존 회차 · AI 실행 해시가 그대로 유효(36건 동일 확인).
- 대상을 채운 뒤에는 증거 범위를 바꿀 수 없다(가드).

## I. RLS · 권한

| 대상 | 학습자 | 판정자 · 관리자 | service_role(AI · 탐지기) |
|---|---|---|---|
| `csat_ec_boundary` | 읽기(공개 정의 — 코드 사전과 같음) | 읽기 | 표 권한 없음(`ai_taxonomy` RPC 로) |
| `csat_ec_boundary_signal` | 권한 없음 · `my_pending_probes` 로 자기 대기 probe 만 | RPC 로만 | 권한 없음 · `add_detector_signal` · `ai_import` 로 쓰기만 |
| probe · interpretation 증거 | 자기 행만 읽기(기존 정책) · 쓰기는 RPC | 회차 봉인 자료로만 | 사람 판정 · 학생 범주 보고는 여전히 못 읽는다 |

## J. 파일

- `supabase/migrations/20261005130000_csat_ec_pilot_evidence.sql`(새 — 미적용)
- `scripts/csat/error-evidence/rollback-pilot.sql`(원래 마이그레이션에서 함수 원문을 기계적으로 뽑아 생성)
- `scripts/csat/error-evidence/isolated-pg/t_pilot.mjs` · `run-pilot.mjs` · `rollback-pilot.mjs`(새) · `lib.mjs`(`REPO` export)

## K. rollback · 안전

- 적용은 한 트랜잭션 · 기존 CHECK 이름을 먼저 확인하고 없으면 멈춘다(조용히 두 CHECK 가 남지 않게).
- rollback 은 새 모델을 쓰는 행(새 outcome · 후보 · candidate claim · interpretation · probe · 경계 · 관찰 · pre_probe 회차)이 하나라도 있으면 **멈춘다** — 데이터를 지우는 결정은 rollback 이 하지 않는다. 행이 없으면 적용 전 스키마로 정확히 돌아간다(격리 검증 차이 0).
- 적용 전 `/db-checkpoint` 스냅샷 권장.

## L. 하네스 테스트(`t_pilot` · `run-pilot` · `rollback-pilot`)

기존 행 보존 · 새 컬럼 기본값 · 기존 회차 무결성 · 판정 입력 해시 바이트 동일 · old outcome 허용(기존 테스트 전부 통과) · new outcome 허용 · invalid outcome 거부 · 경계 FK · 역순 중복 · 키 형식 · accepted 경계 probe 거부 · 봉인 해시(코드 + 경계) · 경계 없는 버전 해시 공식 불변 · 봉인 뒤 경계 추가 · 수정 · 삭제 차단 · 요구 없는 probe 거부 · probe 중복 방지 · probe 정정 supersede · probe 형식 · skip 보존 · interpretation · 교차 계정 읽기 0행 · 쓰기 거부 · 관찰 표 직접 권한 없음 · 관찰 UPDATE 거부 · all/pre_probe 해시 · pre/post 회차 봉인 증거 id 차이 · 대상 채운 뒤 범위 변경 거부 · AI multiple(후보 1 거부 · primary 섞임 거부 · 저장 + 관찰) · AI inconsistent 저장 · 실패 실행 관찰 거부 · pre_probe 회차 blind 시작 · 판정 multiple + primary 거부 · 후보 1 거부 · code 에 후보 거부 · multiple 저장 + 관찰 연결 · inconsistent 저장 · 기존 8인자 RPC 호환 · 판정 UPDATE 거부 · 새 표 트리거는 가드뿐(학습 지도 갱신 경로 없음) · rollback 거부 · 정확 복원 · 재적용.

## M. 개발 DB 적용 시 예상 변화

개발 DB 실측(2026-10-05): taxonomy `v99.0`(봉인 · 코드 6) · 회차 2 · 판정 · AI 실행 · claim · 과정 증거 · 학습자 확인 0행.
- 표 +2(빈 표) · 컬럼 +2(기존 회차 2행 → `evidence_profile = 'all'`, 판정 0행) · 제약 4 교체 + 4 추가 · 인덱스 +5 · 트리거 +4 · 정책 +1 · 함수 +14 · 본문 교체 13.
- 행 추가 0 · 기존 봉인 `v99.0` 해시 · 회차 대상 그대로.
