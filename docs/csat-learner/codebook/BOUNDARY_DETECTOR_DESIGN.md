# 경계 탐지기(Boundary Detector) 설계 — Error Cause Pilot blocker 2 (Track C)

> 상태: **구현 초안(G4) · 개발 DB 미적용** — 마이그레이션 `supabase/migrations/20261006120000_csat_ec_boundary_detector.sql` · 롤백 `scripts/db/rollback-20261006120000.sql`. 아래 §0 사용자 확정 결정(2026-10-06)이 v1 설계와 다르면 §0 이 이긴다(본문은 §0 에 맞게 고쳤다).
> 기준: `feat/ec-smoke` 00a99edab · 마이그레이션 `20261005130000_csat_ec_pilot_evidence` · `20261005150000_csat_ec_capture_support` · `20261005170000_csat_ec_reveal_gate` · seed `data/seed-v0.1-rows.json`.
> 라이브 확인(2026-10-06, dev DB 읽기 전용 트랜잭션): taxonomy `v0.1`(sealed) · `v99.0` · `v99.1`(TEST, sealed). `csat_ec_boundary` 3행 — `v0.1` `r.inference__v.wrong_sense` provisional · probe `r6_derivation_probe` / `v99.1` 같은 경계 · probe `test_boundary_probe` / `v99.1` `e.option_check__s.modifier_scope` accepted. `csat_ec_boundary_signal` 0행 · `csat_ec_capture_session` 0행 · `csat_ec_process_evidence` 0행. 탐지 함수 없음(`csat_ec_add_detector_signal` 만 있음).

## 0. 사용자 확정 결정(2026-10-06) — 구현 기준

1. **서버 결정론 감지기 우선.** AI 판정은 probe 를 띄우지 않는다(사후 비교 · 보조 신호). `csat_ec_my_pending_probes` 는 **detector 출처** 신호만 낸다 — ai_run · judgment 출처는 정답을 보는 경로라 학습자 대기 probe 에서 뺀다. probe 응답(`add_process_evidence` targeted_probe)도 활성 detector 신호가 요구한 것만 받는다.
2. **범주 없음 · 「모름」(unsure) 이면 감지하지 않는다** → 신호 없음, `csat_ec_detector_run.result = 'insufficient_evidence'`. v1 §3 의 「없거나 unsure 면 탐지」를 뒤집었다. 자유서술 예외는 **규칙 슬롯만**: 봉인 경계의 `provenance.detector.free_text_patterns`(결정론 정규식 배열)가 있을 때만 해석 글에 대어 본다. v0.1 seed 에는 없어 비활성이고, 코드에 패턴 문자열이 없다.
3. **증거 정정 → 재평가.** 과정 증거(새 행 · supersede)가 들어올 때마다 다시 돈다. 경계가 사라지면 probe **미응답** → `cancelled`(대기 목록에서 사라짐), **응답 뒤** → 응답 · 신호는 그대로 두고 `obsolete` 표시(`csat_ec_boundary_signal_retraction` 덧붙이기). 경계가 다시 생기면 새 신호. 같은 증거 상태로 다시 돌리면 행이 늘지 않는다.
4. **원인을 판정하지 않는다.** 출력은 `boundary_key`(봉인 taxonomy 의 provisional 경계에서 읽음) + `probe_required` 뿐. 원인 코드 · 판정 · mastery · verified_diagnosis 를 쓰지 않는다.
5. **정오 무관(오라클 금지).** 정오 · 고른 답 대비 정답 · 정답표 · 채점 결과를 입력에 쓰지 않는다. 같은 증거면 정답 · 오답 문항의 결과 · 시점 · 오류가 같다. Reveal Gate(G3) 계약 유지.

**구현에서 찾은 것** — `csat_ec_valid_process_evidence` 는 `category` 를 뺀다(판정 입력은 범주 보고를 보지 않는 설계). 그래서 감지기는 그 함수를 쓰지 않고 과정 증거 표를 직접 읽는다: 정정되지 않았고 **가장 최근 증거와 같은 입력 해시**인 행(해시는 같다/다르다만 비교 — `csat_ec_item_input_hash` 를 부르지 않아 정답을 풀지 않는다). 또 capture `config` 에 `probes` 가 없었다 — 앱이 capture 생성 때 `captureProbeConfig()`(저장소 probe 정의의 key · 판 · 해시)를 봉인한다.

## 1. 목적 · 하지 않을 것

**목적** — 학습자가 남긴 과정 증거(해석 · 막힌 곳 · 이유 · 자기 범주)를 보고, 봉인된 taxonomy 의 **provisional 경계**를 이 attempt 가 「만났을 수 있다」고 서버에서 표시한다. 결과는 `no_boundary` 또는 경계 키(예: `r.inference__v.wrong_sense`)이고, 경계면 `csat_ec_boundary_signal`(source `detector`) 행이 생기며 그 경계의 probe 가 학습자의 대기 probe 가 된다.

**하지 않을 것**
- 원인 판정이 아니다. 신호는 「추가 질문을 띄울 이유」일 뿐 claim · judgment · primary 를 만들지 않는다.
- 클라이언트 탐지 없음. 브라우저는 탐지 함수를 부를 수도, 결과를 미리 계산할 수도 없다.
- 코드 · SQL 에 경계 쌍 문자열(`r.inference__v.wrong_sense`) · probe 키(`r6_derivation_probe`)를 쓰지 않는다 — 대상 경계는 `csat_ec_boundary` 데이터에서 읽는다(예외: probe **문구 정의** `apps/web/src/lib/csat/ec-pilot/probes.ts` 는 저장소 산출물이라 키를 가진다 · seed JSON · 테스트 픽스처 · 문서).
- probe 응답 뒤에도 숙달 · 학습 지도(V/S/R/E 상태) · `verified_diagnosis` 를 바꾸거나 만들지 않는다(pilot_evidence 머리 주석 「경계 신호 · probe 응답 · 판정 어느 것도 V/S/R/E 상태를 바꾸지 않는다」 유지).
- 정오 오라클이 되지 않는다(§6).

## 2. 입력 — 정확한 출처

| 입력 | 출처 | 비고 |
|---|---|---|
| 유효 과정 증거 | `public.csat_ec_valid_process_evidence(p_session, p_item_no, 'pre_probe')` → `csat_ec_process_evidence(id, session_id, item_no, kind, value, supersedes_id, created_at)` | supersede 된 행 · `targeted_probe` 제외. 쓰는 kind: `interpretation`(`value.state` answered/unknown/skipped, state 없음 = answered) · `category`(`value.group` ∈ word/sentence/flow/evidence/choice/time/unsure) · `blocked_span` · `reason`(v1 은 근거 id 로만 기록) |
| 대상 여부 · taxonomy · 허용 probe | `public.csat_ec_capture_session(session_id, status, taxonomy_version, targets smallint[], config jsonb)` | `status = 'collecting'` 이고 `item_no = any(targets)` 일 때만 실행. `config->'probes'`(허용 probe {key, version, prompt_hash}) |
| 경계 메타데이터 | `public.csat_ec_boundary(version, boundary_key, code_a, code_b, status, probe_key, decision_note, provenance)` ⨝ `csat_ec_taxonomy_version(status = 'sealed')` | 후보 = `status = 'provisional' and probe_key is not null` |
| 코드 → 학생 범주 | `public.csat_ec_code(version, code, student_group)` | 경계 양쪽 코드의 `student_group` 집합이 탐지 범주 집합 G 가 된다(v0.1: `V.wrong_sense`→word · `R.inference`→flow) |

**읽지 않는 것(금지 입력)**: `csat_dx_response.is_correct` · `chosen_option` · `csat_items.answer` · `csat_items_public` · `csat_dx_snapshot` · `csat_ec_judgment` · `csat_ec_ai_run` · `csat_ec_claim`(AI) · 해설 · 분석 표. 탐지 함수 본문에 이 이름이 나오면 가드가 실패한다(§8).

## 3. 탐지 규칙 (`detector_version = 'bd-0.1.0'` — §0 결정 반영본)

seed 의 경계 행에는 기계가 읽는 「패턴」 열이 없다(PILOT_SEED_DESIGN §3 표의 `pattern` 은 SQL 에 들어가지 않았다 · `decision_note` 는 자연어). 그래서 v1 은 **이미 봉인된 구조 데이터만으로** 정의되는 넓은(재현율 우선) 규칙이다 — probe 는 건너뛸 수 있고 판정이 아니므로 과탐의 비용은 질문 한 번이다.

attempt (session, item) 에 대해, 봉인 taxonomy T(= capture 행의 `taxonomy_version`)의 각 후보 경계 b 마다:

1. G(b) = { `student_group(code_a)`, `student_group(code_b)` } (NULL 제외).
2. 유효 `interpretation` 중 최신 행의 state = `answered` — 아니면 `insufficient_evidence`(해석 글이 없으면 경계를 가를 재료가 없다).
3. 유효 `category` 중 최신 행의 `group ∈ G(b)` 이면 b 탐지. G 밖 범주(예: time)면 미탐지.
4. 범주가 없거나 `unsure` 면 **탐지하지 않는다** — 단 b 의 `provenance.detector.free_text_patterns` 가 있고 해석 글이 그중 하나에 맞으면(`~*`, 잘못된 패턴은 무시) 탐지(§0-2 슬롯).
5. `evidence_ids` = 판단에 쓴 유효 증거 id 전부(interpretation · category · blocked_span · reason).

결과: 후보 경계가 없거나 범주를 골랐는데 걸린 경계가 없으면 `no_boundary`, 해석이 answered 가 아니거나 범주 없음 · unsure(패턴 불일치)면 `insufficient_evidence`, capture 없음 · 수집 중 아님 · 대상 아님 · 봉인 안 됨이면 `skipped_*`(신호를 건드리지 않는다). **문항 · 선지 · 정답은 규칙에 들어가지 않는다**(문항 유형으로 거르는 것도 v1 에서는 하지 않는다 — 유형 표를 읽으면 금지 입력 경로가 늘어난다).

규칙을 바꾸면 `detector_version` 을 올린다. 같은 증거로 옛 판 · 새 판 결과를 나란히 남길 수 있다(§5 유일 키에 버전 포함).

## 4. 배치 — **DB 함수 + 증거 insert 뒤 트리거**

결정: `public.csat_ec_detect_boundaries(p_session, p_item_no, p_trigger uuid)` (plpgsql · security definer · `search_path = ''`) 를 `csat_ec_process_evidence` 의 **AFTER INSERT 행 트리거**(`kind <> 'targeted_probe'` — 이유 · 막힌 곳 · 정정도 다시 평가)가 같은 트랜잭션에서 부른다.

| 후보 | 판단 |
|---|---|
| **트리거(채택)** | 증거 저장과 탐지가 원자적 — 저장됐는데 탐지 호출이 빠지는 구멍이 없다. 정답 · 오답 · 정답 대조 문항 모두 같은 코드 경로 · 같은 시점(오라클 안전 §6). 클라이언트 · API 라우트가 관여하지 않는다. 기존 `csat_ec_resp|session|item` advisory 잠금 안에서 돈다(`add_process_evidence` 가 이미 잡는다) — 동시 insert 직렬화. |
| 명시 RPC(서버가 저장 뒤 호출) | 호출 누락 = 조용한 probe 0건. 라우트마다 호출을 붙여야 하고, 라우트가 정오를 이미 들고 있어(`server.ts` 가 service role 로 `is_correct` 를 읽는다) 조건 분기가 섞일 위험. 기각. |
| 비동기 잡(outbox) | 지연 시간이 처리량에 따라 달라져 타이밍 채널이 생기고, 학습자가 probe 를 받기 전에 수집을 끝낼 수 있다. 기각. |

실패 정책: 탐지 함수는 **무결성 위반에서만 예외**(봉인 안 된 taxonomy 등 — 증거 저장도 함께 실패해야 하는 경우). 「capture 행 없음 · 대상 아님 · 후보 경계 없음」은 예외가 아니라 실행 기록의 `result` 로 남기고 정상 반환한다. 이 분기들은 정오와 무관한 값(capture 상태 · targets)만 본다.

재실행: 서비스 전용 `public.csat_ec_detect_boundaries_rerun(p_session, p_item_no)` — `collecting` 세션에만(봉인 뒤 결과를 바꾸지 않는다). 탐지기 판 올림 · 장애 복구용.

**멱등**: 같은 (응답, taxonomy, 경계, 감지기 판)에 취소되지 않은 detector 신호가 있으면 새로 만들지 않는다(응답 잠금 안에서 확인 — 유일 인덱스는 「재출현 = 새 신호」와 맞지 않아 두지 않는다). 실행 기록은 직전 행과 (taxonomy · 결과 · 경계 · 입력 증거 · probe 경계)가 다르거나 신호가 바뀔 때만 1행.

## 5. 신호 · 실행 기록 스키마

**기존 그대로 쓰는 것** — `csat_ec_boundary_signal`(id · session_id · item_no · taxonomy_version · boundary_key · boundary_status · source · detector_version · ai_run_id · judgment_id · probe_required · evidence_ids · created_at). source `detector` 는 `detector_version` 필수(CHECK). `csat_ec_boundary_signal_guard` 가 봉인 · 상태 스냅샷 · `probe_required ⇒ provisional ∧ probe_key` · 같은 응답 증거만을 이미 강제한다. 수정 금지(`csat_ec_forbid_update`). 새 열은 **필요 없다**.

`probe_required` 결정: 후보 경계의 `probe_key` 가 capture 행 `config->'probes'` 의 key 목록에 있을 때만 true(저장소 문구 정의가 없는 probe 를 띄우지 않는다). 한 attempt 에 경계가 여럿 탐지되면 신호는 모두 남기고, `probe_required = true` 는 `boundary_key` 사전순 첫 경계 하나만(문항당 probe 1개 — PILOT_SEED_DESIGN §3).

**구현(20261006120000)**
- 표 `csat_ec_detector_run` — 「경계 없음 · 증거 부족」도 기록해야 P/N 비교 · 시점 검증이 된다(신호 표는 양성만 담는다).
- 표 `csat_ec_boundary_signal_retraction(signal_id PK, reason cancelled|obsolete, run_id)` — 신호 행을 고치지 않고 취소 · 낡음을 덧붙인다. 활성 신호 = 취소 행 없음.
- (v1 의 유일 인덱스 제안은 버렸다 — 경계 재출현 때 새 신호가 필요하다.)
- capture 쓰기 가드를 신호 표(detector 출처)에도: 완료 · `closed_incomplete` 뒤 새 신호 거부.
- `csat_ec_my_pending_probes` 를 **source = 'detector'** 신호로 한정. 지금은 `ai_run` · `judgment` 출처 신호도 `probe_required` 면 대기 probe 가 된다 — AI · 판정자는 정답을 보는 경로(검수 회차 자료)라 그 신호가 수집 중 학습자에게 질문으로 나타나면 정답 정보가 새는 통로가 된다.

## 6. 상태 기계

```
evidence insert(interpretation|category)
  └─ trigger → detect(session,item)
        ├─ capture 없음/≠collecting/대상 아님 → run(result='skipped_*')           [끝]
        ├─ 후보 경계 0 · 조건 불충족          → run(result='no_boundary')         [끝]
        └─ 경계 b 탐지 → run(result='boundary', keys) + signal(detector, probe_required?)
              ├─ probe_required=false → 기록만 [끝]
              └─ probe_required=true → my_pending_probes 에 (item, b, probe_key) 노출 = PENDING
                    ├─ add_probe_response(option A–D)      → ANSWERED  (targeted_probe 증거 1행)
                    ├─ add_probe_response(skipped=true)    → SKIPPED   (같은 행 형태 · 「질문 없음」과 구분)
                    ├─ 세션 상한 초과(서비스 설정 cap)       → 띄우지 않음 = NOT_ASKED(신호는 남음)
                    └─ capture_finish / capture_close      → 미응답이면 NOT_ASKED 로 봉인(완료를 막지 않음 — REVEAL_GATE §완료 조건 3)
```

정정 · 새 증거(§0-3): PENDING 인데 경계가 사라지면 → CANCELLED(취소 행 · 대기 목록에서 빠짐 · 응답 거부), ANSWERED/SKIPPED 뒤 사라지면 → OBSOLETE(응답 · 신호 보존 · 표시만), 다시 생기면 새 신호(이미 답한 probe 는 다시 묻지 않는다). 수집이 completed/closed_incomplete 면 대기 probe 를 내지 않는다.

probe 응답 뒤 하는 일은 **없다**: 재탐지 트리거 대상 kind 가 아니고(targeted_probe 는 트리거 조건 밖), judgment · claim · 숙달 쓰기 없음. 재판정은 검수 회차가 `evidence_profile = 'all'` vs `'pre_probe'` 로 따로 한다(기존 구조).

## 7. Reveal Gate 상호작용 · 오라클 안전 논증

- 탐지 입력에 정오 · 정답 · 선택 선지가 없다(§2 금지 입력 · §8 가드 1). 따라서 같은 증거면 정답 attempt 와 오답 attempt 의 결과 · `evidence_ids` · `probe_required` 가 비트 단위로 같다.
- 실행 여부를 가르는 값은 capture 상태와 `targets` 뿐이다. targets 는 정답 대조(`correctControls`)를 섞어 학습자에게 이미 보이는 목록이라 탐지가 새 정보를 더하지 않는다(대상 목록 자체의 역산 위험은 REVEAL_GATE §O-1 소관).
- 시점: 같은 트랜잭션 · 같은 경로라 성공/실패/지연이 정오에 의존하지 않는다. 오류 문구도 정오 분기가 없다.
- 학습자에게 보이는 것: probe 문구(`studentProbe` — 원인 · 경계 · taxonomy 용어 없음)뿐. 경계 키 · 신호 · 실행 기록은 학습자 SELECT 권한이 없다(`csat_ec_boundary_signal` 은 RLS 활성 · 학습자 정책 없음; 새 표도 같게).
- REVEAL_GATE 표 160행이 넘긴 조건 「보류 중에는 정오를 쓰지 않는 신호만」 — v1 탐지기는 보류 여부와 무관하게 **항상** 정오를 쓰지 않는다. 대기 probe 를 detector 출처로 한정(§5)해 다른 출처가 이 조건을 깨지 못하게 한다.

## 8. 실패 모드

| 상황 | 동작 |
|---|---|
| 세션 taxonomy 가 봉인 안 됨 · 경계 행 없음 | 후보 0 → `no_boundary`(seed 미적재는 정상 상태). taxonomy 버전 자체가 `csat_ec_taxonomy_version` 에 없으면 capture 생성 단계에서 이미 거부돼야 한다 — 탐지기는 예외 없이 `skipped_no_taxonomy` |
| probe_key 가 capture config 허용 목록에 없음 | 신호는 남기고 `probe_required = false`(문구 없는 질문을 띄우지 않는다). 가드 5 가 저장소 정의 누락을 CI 에서 잡는다 |
| 경계 여럿 | 모두 신호 · probe 는 사전순 첫 하나(§5) |
| 증거 supersede | 정정 insert 도 트리거를 탄다 → 최신 유효 증거로 재평가. 조건이 깨지면 미응답 신호는 `cancelled`(대기에서 빠짐), 응답 뒤면 `obsolete`(응답 · 신호 보존). 다시 맞으면 새 신호(§0-3) |
| 증거 순서(해석 먼저 → 나중에 G 밖 범주) | 마지막 증거 상태가 이긴다(순서 의존 없음). 지나간 상태는 `detector_run` 으로 재현 가능 |
| `completed` / `closed_incomplete` | 기존 `csat_ec_capture_write_guard` 가 증거 insert 를 막으므로 트리거가 돌지 않는다. 직접 신호 insert 도 제안 가드로 거부. rerun 은 collecting 만 |
| held(수집 열기 전) | capture 상태 ≠ collecting → `skipped_not_collecting` |
| 검수 중 문항 | `add_process_evidence` 가 이미 거부 → 트리거 안 돎 |

## 9. 자동 가드 — 반드시 FAIL 해야 하는 것

1. **금지 입력**: `pg_get_functiondef('csat_ec_detect_boundaries')` 와 rerun 본문에 `is_correct` · `chosen_option` · `answer` · `csat_items` · `csat_dx_snapshot` · `csat_ec_judgment` · `csat_ec_ai_run` 가 나오면 실패(격리 PG 테스트 + `node` 정적 검사로 마이그레이션 파일 본문).
2. **경계 쌍 하드코딩**: `supabase/migrations/**` 의 탐지 관련 함수 · `apps/web/src/**`(probes.ts 제외) · `scripts/**`(seed · 테스트 픽스처 제외)에서 정규식 `/[a-z]\.[a-z_]+__[a-z]\.[a-z_]+/` 또는 `r6_derivation_probe` 리터럴이 나오면 실패. 탐지 함수 본문에 코드 문자열(`'V.` · `'R.` 등)이나 범주 리터럴(`'word'` · `'flow'`)이 나와도 실패 — G 는 `csat_ec_code.student_group` 에서만 온다.
3. **정오 조건부 probe**: 행동 테스트 — 같은 증거를 정답 attempt · 오답 attempt 에 넣고 `detector_run.result` · 신호 집합 · `probe_required` · `my_pending_probes` 가 다르면 실패.
4. **클라이언트 탐지**: `'use client'` 파일 · `components/**` 에서 `csat_ec_detect` · `add_detector_signal` 문자열 또는 탐지 모듈 import 가 있으면 실패. DB 권한: `authenticated` · `anon` 이 `csat_ec_detect_boundaries*` · `csat_ec_add_detector_signal` 에 EXECUTE 를 가지면 실패.
5. **probe 정의 누락**: 봉인 taxonomy(비 TEST)의 provisional 경계 `probe_key` 마다 `PROBE_DEFINITIONS` 에 항목이 없으면 실패(seed JSON 기준 단위 테스트).
6. **판정 · 숙달 금지**: 탐지 · probe 경로 함수 본문에 `insert into public.csat_ec_judgment` · `csat_ec_claim` · 학습 지도/숙달 표 쓰기가 있으면 실패. 행동: probe 응답 전후로 `csat_ec_judgment` · `csat_ec_claim` · 학습 지도 표 행 수 불변.
7. **비탐지 출처 대기 probe**: `ai_run` 출처 `probe_required = true` 신호만 있는 응답에서 `my_pending_probes` 가 행을 돌려주면 실패.

## 10. 테스트 계획

**격리 PG**(`scripts/csat/error-evidence/isolated-pg/t_detector.mjs` 신설 · 기존 t_capture 하네스 재사용)
- 행동 오라클 P/N: P = answered 해석 + 범주 ∈ G(word · flow) / 범주 없음 / unsure → `boundary`. N = 해석 unknown · skipped / 범주 time · choice · sentence · evidence / 대상 아님 / held · completed 세션 → 신호 0. 각 P/N 을 **정답 attempt 와 오답 attempt 쌍**으로 돌려 결과 동일(가드 3).
- 데이터 구동 증명: 같은 시나리오를 `v99.1`(probe `test_boundary_probe`)로 — 키가 달라도 통과해야 하드코딩이 아님.
- 멱등: 같은 증거로 rerun 3회 → 신호 1행 · run 4행. 경계 둘(테스트 taxonomy 에 두 번째 provisional 경계) → 신호 2 · probe_required 1.
- supersede · 순서 의존 · 완료 뒤 신호 insert 거부 · 권한(학습자 JWT 로 detect · 신호 SELECT 0).
- probe 경로: pending → answered / skipped → pending 0, judgment · claim 행 수 불변.

**dev smoke**(`scripts/csat/error-evidence/dev-smoke/smoke-detector.mjs`, TEST taxonomy `v99.1` · 검증 계정 · 끝에 정리) — 실제 PostgREST 로 `add_process_evidence` → 신호 → `my_pending_probes` → `add_probe_response` → `capture_finish`. 다른 계정으로 신호 · run 조회 0.

**앱 단위 · e2e** — 증거 저장 API 응답 뒤 대기 probe 재조회(응답 모양이 정오와 무관), 가드 4 · 5 정적 테스트. 기존 `52-csat-ec-capture.spec.ts` 에 probe 단계 추가.

## 11. 제안 DB 변경 (v1 SQL 스케치 — 구현은 `20261006120000` 이 정본, 아래는 당시 기록)

```sql
-- 미적용 스케치 · 마이그레이션 번호는 만들 때 ls supabase/migrations 로 고른다
create unique index csat_ec_boundary_signal_detector_once on public.csat_ec_boundary_signal
  (session_id, item_no, taxonomy_version, boundary_key, detector_version) where source = 'detector';

create table public.csat_ec_detector_run (
  id bigint generated always as identity primary key,
  session_id uuid not null, item_no smallint not null,
  foreign key (session_id, item_no) references public.csat_dx_response(session_id, item_no) on delete cascade,
  detector_version text not null, taxonomy_version text,
  trigger_evidence_id uuid,                        -- rerun 이면 null
  input_evidence_ids uuid[] not null default '{}',
  result text not null check (result in ('boundary','no_boundary','skipped_no_capture','skipped_not_collecting','skipped_not_target','skipped_no_taxonomy')),
  boundary_keys text[] not null default '{}',
  created_at timestamptz not null default now(),
  check ((result = 'boundary') = (cardinality(boundary_keys) > 0))
);
-- 덧붙이기 전용(csat_ec_forbid_update) · RLS 활성 · 학습자 정책 없음

create or replace function public.csat_ec_detect_boundaries(p_session uuid, p_item_no smallint, p_trigger uuid)
returns text language plpgsql security definer set search_path = '' as $$
-- 1) capture 행(status · taxonomy_version · targets · config) 읽기 → skipped_* 분기
-- 2) 후보 = csat_ec_boundary ⨝ sealed taxonomy where status='provisional' and probe_key is not null
-- 3) G = csat_ec_code.student_group(code_a, code_b)
-- 4) csat_ec_valid_process_evidence(p_session, p_item_no, 'pre_probe') 로 §3 규칙
-- 5) signal insert ... on conflict do nothing (probe_required: config 허용 ∧ 사전순 첫 경계)
-- 6) csat_ec_detector_run insert · result 반환
-- (정오 · 정답 · 문항 표를 읽지 않는다 — 가드 1)
$$;

create or replace function public.csat_ec_process_evidence_detect() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform public.csat_ec_detect_boundaries(new.session_id, new.item_no, new.id); return null; end $$;
create trigger csat_ec_process_evidence_detect after insert on public.csat_ec_process_evidence
  for each row when (new.kind in ('interpretation', 'category'))
  execute function public.csat_ec_process_evidence_detect();

create or replace function public.csat_ec_detect_boundaries_rerun(p_session uuid, p_item_no smallint) returns text ...;  -- collecting 만
revoke all on function public.csat_ec_detect_boundaries(uuid,smallint,uuid) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_detect_boundaries_rerun(uuid,smallint) to service_role;

create trigger csat_ec_capture_write_guard before insert on public.csat_ec_boundary_signal
  for each row when (new.source = 'detector') execute function public.csat_ec_capture_write_guard();

-- csat_ec_my_pending_probes: where 절에 s.source = 'detector' 추가(본문 교체)
```

롤백: 트리거 · 함수 · 인덱스 · 표 drop, `my_pending_probes` 원 정의 복원. 기존 데이터 변경 없음(라이브 신호 0행).

**앱 변경** — 탐지 코드 없음. ① 증거 저장 API 가 저장 뒤 `pendingProbes` 를 같은 응답 모양으로 돌려 UI 가 probe 를 띄움(정오 필드 없음) ② capture 생성 때 `config.probes` 에 `studentProbe` {key, version, promptHash} 목록을 넣는지 확인 ③ 가드 2 · 4 · 5 정적 테스트 ④ admin 도움말(`lib/admin/help/`)에 탐지기 판 · rerun 은 collecting 만 · 신호는 판정 아님을 `cautions` 로(해당 화면이 생길 때 같은 커밋).

## 12. G4 수용 기준 — 실제 해석 → 신호 → probe 끝까지

1. dev 에서 Pilot 참가자(env `CSAT_EC_PILOT_USER_IDS`) · taxonomy `v0.1` 로 수집을 열고, 대상 문항에 실제 UI 로 answered 해석 + 범주 word 저장 → `csat_ec_detector_run` result `boundary` · `csat_ec_boundary_signal` 1행(source detector · `detector_version = 'bd-0.1.0'` · `probe_required = true` · evidence_ids ⊂ 그 응답 증거).
2. 같은 흐름이 **정답 대조 문항**에서도 같은 결과(정오 무관 증명).
3. 학습자 화면에 probe 문구가 뜨고(경계 · 원인 용어 없음) 응답/건너뜀 저장 → `my_pending_probes` 0행 → `capture_finish` completed, `counts.probes` 반영.
4. 범주 time 문항은 `no_boundary` · probe 없음.
5. 전 과정에서 `csat_ec_judgment` · `csat_ec_claim`(AI) · 학습 지도 표 행 수 불변, 학습자 JWT 로 신호 · run · 정답 조회 0.
6. §9 가드 7개가 각자 일부러 깬 입력에서 FAIL 하는 것을 한 번씩 확인(가드가 무력하지 않음).
7. 격리 PG · dev smoke 통과 결과와 `review.mjs` 반대 에이전트 리뷰를 PR 본문에 붙임.

## 13. 열린 질문 (증거가 충돌하는 곳만)

> 2026-10-06 사용자 결정(§0)으로 1 · 2 · 3 모두 닫혔다 — 1: 결정론 감지기 · AI 는 보조, 2: 범주 없음/unsure 는 감지 안 함(자유서술 슬롯만), 3: 철회한다(미응답 cancelled · 응답 뒤 obsolete). 아래는 당시 기록.

1. **AI 1차 판정으로 탐지할 것인가** — PILOT_SEED_DESIGN §3-3 은 「AI 1차 판정에서 경계 패턴이 감지되면 probe」라 썼고, 이번 결정은 서버 측 provisional 탐지기다. 이 설계는 결정론 규칙을 채택하고 AI 신호는 분석용으로만 둔다(대기 probe 에서 제외). AI 탐지로 바꾸려면 정답을 보지 않는 별도 export 가 먼저 필요하다.
2. **범주 없음 · unsure 를 탐지로 볼 것인가** — 재현율(연구 질문: 경계 만남 수)과 학습자 부담(세션 상한 미정 `probeCapPerSession: null`)이 충돌한다. v1 은 포함. 상한 값이 정해지면 다시 본다.
3. **신호 비철회** — 정정으로 조건이 깨진 뒤에도 probe 를 띄울지. 덧붙이기 전용 원칙(신호 표 머리 주석)과 「질문받은 이유가 사라진 질문」의 UX 가 충돌한다. v1 은 띄운다(건너뛰기 가능).
