# v0.1 conditional seed — 준비 · dry-run · 개발 DB 적용 (2026-10-05)

> **적용 완료(2026-10-05)** — E 축 결정 반영 → build · validate **32/32 PASS** · dry-run **16/16**(diff 0) → 조건부 승인 조건 충족 → `seed/apply-seed.mjs` COMMITTED(write 버전 1 · 코드 19 · 경계 1 · 봉인 1 = 예상). 봉인 해시 `303e5140…` = dry-run = 재계산. 적용 후: 코드 19 active · E 매핑 일치 · 경계 1 provisional(`r6_derivation_probe`) · 봉인 뒤 경계 수정 · 추가, 코드 수정 · 추가, 버전 삭제 5종 거부 · v99.0/v99.1 해시 · 학습 기록 불변 · checkpoint `seed-v0.1` diff 는 회전 표본뿐 · seed smoke(PostgREST) 12/12 · Security Advisor ERROR 0 · csat_ec 31(변화 없음). 아래 본문은 결정 전 기록이다(§4 미결은 해소).

> 사전 등록 결과는 그대로다: **「rev4 did not pass the preregistered v0.1 seed gate」**. 이것은 별도 제품 결정([SEED_DECISION.md](./SEED_DECISION.md) 「제품 결정」)의 seed 입력을 확정 · 검증한 기록이다. validated · verified taxonomy 가 아니다.
> 이 단계에서 하지 않은 것: 실제 seed commit · Pilot 회차 · UI · 사용자 대상 실행 · DB 구조 변경.

## 1. TEST fixture `v99.0` · `v99.1` — 개발 DB 상시 fixture(B)

| | |
|---|---|
| 결정 | **유지** — 개발 DB smoke 전용 상시 fixture. seed 대상 아님 |
| 이유 | ① 봉인된 taxonomy · 경계 행은 append-only 가드(`csat_ec_taxonomy_guard` · `csat_ec_boundary_guard`)가 지우지 못하게 한다 — 지우려면 가드를 끄는 것 말고 방법이 없고, 그것은 금지된 가드 약화다. ② 실제 seed(`v0.1`)가 들어가면 그 경계 행 때문에 `rollback-pilot.sql` 은 어차피 거부된다 — 지금 지워서 되찾는 rollback 가능성은 seed 직전까지만 유효하다. ③ `smoke-pilot.mjs` 재실행(seed 게이트)이 `v99.1` 을 재사용한다 |
| rollback 영향 | `rollback-pilot.sql` 은 경계 2행(`v99.1`) 때문에 **거부되는 것이 정상**이다(데이터 삭제 결정을 rollback 이 하지 않는 안전장치). seed 뒤에는 `v0.1` 경계 때문에도 거부된다. Pilot 모델을 되돌리려면 먼저 데이터 처리(보존 · 이관 · 삭제)를 별도로 결정한다 |
| 운영 · Pilot 격리 | fixture 는 **데이터로만** 개발 DB(`jajenrevcbmrpaliomxv`)에 있다 — 어떤 마이그레이션도 만들지 않으므로 마이그레이션으로 만든 다른 DB 에는 없다. smoke 스크립트는 개발 프로젝트가 아니면 시작하지 않는다. `validate-seed.mjs` 는 `v99.*` · note 「TEST」 를 seed 로 받지 않는다. 남은 요구: Pilot 회차를 만드는 단계(UI · 운영 도구)에서 taxonomy 를 seed 버전으로 고정할 것 — DB 구조 변경 없이 그 단계의 도구가 막는다 |

## 2. baseline — 다음 검토에서 회귀로 다시 잡지 않는다

| 값 | 상태 | 근거 |
|---|---|---|
| 개발 DB 회차 1(closed) · 2(cancelled) `csat_ec_round_inputs_intact = false` | **Pilot 마이그레이션 적용 전부터 false**, 적용 뒤에도 같다 | 첫 smoke(2026-10-03)가 끝나며 테스트 계정을 지워 대상 응답이 사라졌다. 닫힘 · 취소 회차라 판정 입력으로 쓰이지 않는다 |
| 기존 `smoke.mjs` 재실행 139/142 | 첫 실행 전용 스크립트의 재실행 결과 | v99.0 이 이미 봉인돼 「봉인 전 거부 · 봉인 · 학생 claim」 3건 실패. 감사 기록은 첫 실행 142/142(`results.json`) |
| `smoke-pilot.mjs` 109(첫 실행) · 104(재실행) | 둘 다 FAIL 0 | 재실행은 v99.1 생성 · 경계 형식 · 봉인 검사 5건을 건너뛴다(재사용) |
| row-write 기준선 143 | main 병합(19cfb8a17) 뒤 기준선 | 조상 137 + 브랜치 4(trade-import · report-lines-refold · type-report-recount · error-evidence dev-smoke RLS 거부 루프) + main 2(corpus-sync · source-repair). `row-write-budget.test.ts` 주석 |
| `REFLOW_VERSION = 6` | main 병합 뒤 기준선 | 브랜치의 「4」(요약문 화살표 · 선지 표 머리 · 「곳은?」) ≠ main 4 · 5 — 양쪽 캐시 모두 무효화. `reflow.ts` 주석 |
| Security Advisor csat_ec 경고 31 · ERROR 0 | Pilot 모델 적용 뒤 기준선 | 25 + 6(관찰 표 정책 없음 · 경계 GraphQL · authenticated definer RPC 4) |

## 3. seed 입력 — 정본에서 생성

`scripts/csat/error-evidence/seed/build-seed.mjs` 가 [CODEBOOK.rev4.2.md](./CODEBOOK.rev4.2.md)(sha256 `c7001aff97b0…` 고정) §5 와 [data/seed-v0.1-conditional.json](./data/seed-v0.1-conditional.json) 에서 [data/seed-v0.1-rows.json](./data/seed-v0.1-rows.json) 을 만든다(손으로 옮기지 않는다).

| 항목 | 값 |
|---|---|
| taxonomy | `v0.1` — note 에 「conditional · 사전 등록 FAIL · validated/verified 아님」 |
| 코드 | 19 (V 3 · S 4 · R 4 · E 3 · B 3 · X 2), 모두 `active`(= accepted). V.wrong_sense · R.inference 포함, retire 없음 |
| 경계 | 1 — `r.inference__v.wrong_sense` **provisional**, probe `r6_derivation_probe`, 자동 확정 금지(provenance) |
| accepted 규칙 | §6/R9 · R12(+② 고정 표현) — 코드북 문구(DB 객체 아님) |
| provisional | R6 경계 하나 |

결정 JSON 과 DB 형식의 불일치 3건 — 결정 내용은 바꾸지 않고 기계 필드를 더했다:
1. probe 이름 `R6_derivation_probe` 는 DB 형식(`^[a-z0-9_]+$`)이 아니다 → `probe_key: r6_derivation_probe`.
2. 경계 상태 `provisional_boundary` · 순서 `V.wrong_sense|R.inference` → 생성기가 `provisional` · `R.inference < V.wrong_sense` · 키 `r.inference__v.wrong_sense` 로 정규화.
3. taxonomy 버전 이름 없음 → `taxonomy_version: v0.1`.

## 4. 정적 검증 — `validate-seed.mjs` → [data/seed-v0.1-validation.json](./data/seed-v0.1-validation.json)

결정 전 30/30 · 미결 1 → **결정 반영 뒤 32/32 PASS**(E 매핑 정확 일치 · 학생 범주는 원인 라벨 아님 · task 범주 없음 검사 추가).
정본 해시 · 사전 등록 문구 · 규칙 상태 · rev4.4 없음 · 버전 형식 · TEST 버전 거부 · 코드 19(중복 · 형식 · 축 · 문구 · active · B 만 group 없음) · 학생 범주 6개 모두 대응 코드 · 정의 문구의 코드 참조가 모두 이 판에 있음(폐기된 `B.guess` · 다른 판 이름 없음) · 경계(코드 존재 · 순서 · 키 · 상태 · probe 는 provisional 만 · R6 하나뿐) · seed 에 런타임 값(outcome · candidate_codes · evidence_profile) 없음.
outcome · candidate_codes · evidence_profile 은 seed 입력이 아니다 — DB 제약과 `smoke-pilot.mjs`(오타 · 다른 판본 · 폐기 · 중복 · 1개 후보 거부)가 검증한다.

### E 축 학생 범주 — **확정(2026-10-05 사용자 결정)**: `E.evidence_location → evidence`(본문에서 근거를 찾는 단계) · `E.task_misread` · `E.option_mismatch → choice`(발문 · 선지 판단 단계, 내부 key 유지 · UI 표시명 「문제·선지 판단」). 학생 범주는 원인 라벨이 아니라 과정 증거 하나(자동 확정 금지). v0.1 에 task 범주 없음(Pilot 뒤 재검토). 정본 우선순위: 이 결정 > CODEBOOK.rev4.2 > 적용 DB 의미 > ERROR_EVIDENCE_DESIGN §7(superseded). 아래는 결정 전 기록

| 정본 | E 축 범주 |
|---|---|
| [ERROR_EVIDENCE_DESIGN](../ERROR_EVIDENCE_DESIGN.md) §7 | E 전체 = `choice`(선지 판단) |
| 적용된 DB(20261003230000) · 코드북 rev4.2 §2 A1 | 학생 범주 6개: 단어 · 문장 · 흐름 · **근거(evidence)** · 선지(choice) · 시간 |

§7 대로면 학생이 「근거」를 고를 때 대응 코드가 0 이라 그 범주 보고가 막힌다. **제안: `E.evidence_location → evidence`, `E.task_misread` · `E.option_mismatch → choice`**(seed 입력에 반영된 값). 확정 전까지 seed 게이트 미통과.

## 5. dry-run — `dryrun-seed.mjs` → [data/seed-v0.1-dryrun.json](./data/seed-v0.1-dryrun.json)

개발 DB 에서 한 트랜잭션으로 넣고 · 관리자 RPC 로 봉인하고 · 확인한 뒤 **ROLLBACK**. **16 / 16 통과**.

| 확인 | 결과 |
|---|---|
| 예상 write = 실제 | 버전 1 · 코드 19 · 경계 1 · 봉인 1 |
| 봉인 해시 | `303e5140a2d54b2d58a8df99bc7be6c1c55cceaa63294111bf17f02aeb934ced` = 코드 + 경계 재계산, 경계를 뺀 해시와 다름 |
| 봉인 뒤 | 경계 수정 · 코드 수정 · 경계 추가 거부 |
| 기존 데이터 | v99.0 · v99.1 봉인 해시 · 회차 · 응답 · 과정 증거 · probe 불변 |
| RLS · RPC | 로그인 사용자 코드 19 · 경계 읽기, 경계 관찰 표 거부 · `ai_taxonomy`(service_role) V/S/R/E 14 · 경계 1 · 해시 일치, service_role 코드 표 직접 거부 |
| 학생 범주 · 후보 | 6범주 모두 대응 코드 · R6 두 코드 active |
| 학습 지도 | seed 대상 표에 csat_ec 밖 트리거 없음 |
| ROLLBACK 뒤 | csat_ec 11표 행 해시 · 학습자 표 · 함수 정의 · 정책 · 트리거 · 제약 · 봉인 해시 **차이 0**, `v0.1` 없음 |

실제 seed 를 같은 입력으로 넣으면 봉인 해시는 위 값이어야 한다(코드 행 · 경계 행(created_at 제외)만으로 계산 — 결정적).

## 6. seed 실행 게이트

| 조건 | 상태 |
|---|---|
| TEST fixture 처리 방침 | 확정(B · 위 1) |
| rollback 가능성 / 의도된 불가 문서화 | 완료(위 1) |
| 정적 검증 | 30/30 · **미결 1(E 축 학생 범주)** |
| transaction dry-run | 16/16 · diff 0 |
| 기존 데이터 보존 | 확인 |
| smoke 재실행 | `smoke-pilot.mjs` 104/104 |
| Security Advisor | ERROR 0 · csat_ec 31(변화 없음) |

**판정(결정 전): 실행 불가(blocker 1) — E 축 학생 범주 결정. → 결정 뒤 해소 · 적용 완료(맨 위).** 결정 뒤: 결정 JSON 반영 → `build-seed` → `validate-seed`(PASS) → `dryrun-seed`(PASS, 해시가 바뀌면 새 값 기록) → 실제 seed 승인. 실제 seed 는 같은 입력 · 같은 순서의 별도 실행 스크립트로 하고 schema_migrations 가 아닌 데이터 적용으로 기록한다.

## 7. Fixture 격리 요구(사용자 승인 2026-10-05)

Pilot · seed 의 운영 유사 경로는 `v99.*` · note 「TEST」 · 회차 `eligibility.test` 를 명시적으로 걸러내고, 실제 Pilot 회차는 taxonomy `v0.1` 로 고정한다(UI · 운영 도구 단계의 구현 요구 — DB 구조 변경 없음).

## 8. 다음 단계(사용자 지정 순서)

seed smoke(완료) → 학생 interpretation 입력 UI → provisional 경계 감지 → R6 targeted probe UI → pre_probe / all 저장 검증 → end-to-end smoke → Pilot 규모 · 대상 · 기간 결정. 실제 Pilot 은 UI end-to-end 검증 전에는 시작하지 않는다. Learning Map · Evidence Anchor 동결 유지.
