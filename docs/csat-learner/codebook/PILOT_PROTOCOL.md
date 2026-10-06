# 오답 원인 Pilot 프로토콜 — G5 (v0.1 operational pilot)

> **2026-10-06 승인(조건부 수정 반영) · 실제 Pilot 미시작.** G1~G4 는 완료 상태로 고정한다(함수 권한 · Reveal Gate · 경계 감지기 — DB/UI/Reveal Gate/Detector 구조는 새 증거 없이 바꾸지 않는다).
> G6(실제 Pilot)은 §20 체크리스트를 마치고 **별도 시작 승인**을 받은 뒤에 연다. 근거 자료: `PILOT_DATA_MODEL.md` · `PILOT_SEED_DESIGN.md` · `REVEAL_GATE_DESIGN.md`(§G3 종료) · `BOUNDARY_DETECTOR_DESIGN.md`(§G4 종료).
> 상태 표현은 끝까지 **「v0.1 operational pilot evidence」** 로 제한한다.

## 0. 승인된 결정 (A–H · 2026-10-06)

| | 결정 |
|---|---|
| **A. 참가자** | 목표 5명 · 최소 3 · 최대 8. 영어 수준이 한쪽으로 몰리지 않게 모집(점수대 분포 강제 없음). **완료 참가자 3명 미만이면 exploratory run 으로 종료하고 결과를 일반화하지 않는다** |
| **B. 시험** | 참가 전 미응시 여부 조사. 우선순위 ① 참가자 **모두**에게 처음인 평가원 공통 2회차 → ② 불가하면 최대 다수에게 공통인 2회차 → ③ 그래도 안 되면 작은 고정 pool 에서 block assignment. ③이면 결과를 **exam_id 별로 분리**하고 서로 다른 시험을 같은 조건으로 합쳐 해석하지 않는다. 시작 뒤 시험 · 문항 · 정답 변경 금지 |
| **C. probe** | attempt 당 같은 probe 1회 · 세션당 최대 3회(`probeCapPerSession = 3`) · 건너뛰기 허용. 첫 run 이후에만 조정 |
| **D. 판정** | Claude · Codex 독립 2-way → 불일치 또는 provisional 경계(R6)만 4-way → 최종 불일치는 unresolved. human validation 이라 부르지 않는다. **모델 입력에서 학생 식별정보를 제거한다**(§9) |
| **E. 기간 · 종료** | 최대 3주. 모든 evidence target 충족 → `COMPLETED`. 3주 도달 시 일부 미충족 → `TIMEBOX_EXHAUSTED`(실패가 아니라 「운영은 끝났고 일부 연구 질문은 증거 부족」). **같은 run 을 연장하거나 참가자를 추가하지 않는다** — 추가 모집은 새 run |
| **F. 중단** | critical incident 1건이면 즉시 중단(§12) · 수정 뒤 새 run id 로 다시 시작 |
| **G. 데이터** | 저장소: 익명 participant key · 집계 · 해시 · config · 판정 요약. 저장소 밖: 실제 계정 매핑 · 이름/이메일/학교 등 식별정보 · 학생 자유서술 원문 · raw reviewer/model packet. **실제 참가자 identity(계정 id 포함)는 저장소에 커밋하지 않는다** |
| **H. 평가** | 네 층 각각 판정(§13). **Pilot 전체(운영) 판정과 R6 evidence 충분성은 따로 판정한다** |

## 1. 목적 — 네 가지로 제한

1. 실제 학생이 process evidence(막힌 곳 · 이유 · 해석 · 범주)를 충분히 남길 수 있는가
2. 오답 원인 taxonomy **v0.1 conditional seed** 가 실제 attempt 를 설명하는 데 쓸 수 있는가
3. provisional 경계 `V.wrong_sense ↔ R.inference`(`r.inference__v.wrong_sense`)에서 targeted probe(`r6_derivation_probe`)가 판정 가능성을 높이는가
4. Capture → Detector → Probe → Review 파이프라인이 실제 사용자 흐름에서 안정적으로 도는가

**주장하지 않는 것**: taxonomy 최종 타당성 · 전국 학생 일반화 · 학년별 난도 타당성 · verified diagnosis 정확도 · Learning Map mastery 검증 · 점수 상승 효과 · Gold/verified taxonomy.

## 2. 참가자

- 실제 학생(미성년자일 수 있다). **모집 · 동의 절차는 운영자(사용자) 몫** — 이 문서는 §15 안내 항목만 정한다. 학교 · 기관이면 그 기관의 동의 절차를 별도로 확인한다.
- 참가자는 각자 독립적으로 푼다(함께 풀거나 답을 공유하지 않는다).
- **익명 key**: 저장소에는 `P001`, `P002`, … 만 남긴다. `P00n ↔ 실제 계정` 매핑은 **저장소 밖**(운영자 보관)에만 둔다.
- **등록 경로**: 실제 계정 id 는 배포 환경의 서버 env `CSAT_EC_PILOT_USER_IDS`(저장소 밖)로만 넣는다. 저장소 설정 `EC_PILOT.participants` 는 **비워 둔다**(계정 id 도 식별정보다). 어떤 run 에 누가 참가했는지는 운영자 매핑 + run 메타의 익명 key 로 재구성한다.
- 제외: 운영자 · 개발 계정 · 테스트 계정(`@example.com`) · 이전 DB 의 일괄 입력(전부 ②/③ 같은 입력) — 기록 품질 관문(`recordQuality` = trusted)이 일괄 입력을 걸러낸다.

## 3. 시험 자료 · 고정

- 회차 선택은 결정 B 우선순위를 따른다. 원천은 `csat_exams.organizer = 'kice'` Gold 만(최근 12회차 모두 독해 18–45번 28문항 · 정답표 · 원문 DB 실측 확인).
- 시작 전에 회차와 **시험 내용 identity**(§16 — exam id · item set 해시 · 정답표 해시 · 원문/코퍼스 판)를 봉인한다.
- run 중 바꾸지 않는 것: 문항 원문 · 정답 · taxonomy version · probe 정의(판 · prompt_hash) · capture config. 하나라도 바뀌면 같은 run 으로 계속하지 않는다(문항 입력 해시가 바뀌면 기존 증거는 판정 입력에서 자동 무효 — 그 상태로 이어가지 않는다).

## 4. taxonomy 고정

- run 은 `taxonomy = v0.1`(봉인 · 해시 `definitions_hash` 기록)로 고정한다. 앱 설정 `EC_PILOT.taxonomyVersion = 'v0.1'` · DB 봉인 확인 · TEST 표기 거부가 이미 관문으로 있다.
- 금지: 최신 버전 자동 선택 · `v99.*` · TEST taxonomy · `eligibility.test` 가 있는 회차.
- run 도중 v0.1 을 고치지 않는다. 수정이 필요하면 결과를 보존하고 다음 run(다음 taxonomy 버전)에서 쓴다.

## 5. 수집 흐름 (구현 그대로)

시험 응시 → 답 제출(`csat_ec_record_session_held` — 저장과 동시에 대상 봉인, 정오 무관) → **결과 보류**(423) → 수집 시작(held → collecting) → 확인 질문(`took_exam` · `judged_each`) → 막힌 곳 · 이유 → 해석(answered | unknown | skipped) → 범주 → **서버 감지기**(증거 저장 트랜잭션 안) → 필요하면 targeted probe → 수집 완료(collecting → completed) → **결과 공개**.

정답 · 해설 · 점수 공개 전에 수집이 끝나야 한다(Reveal Gate G3). 「나중에」를 고르면 보류가 유지된다. 미완료로 끝나면 운영자가 `closed_incomplete` 로 닫는다(사유 필수 · 공개).

## 6. 해석 최소 증거

- 대상 attempt 마다 해석 상태 하나가 있어야 완료된다(answered · unknown · skipped 모두 허용 — `capture_finish` 가 강제).
- **unknown · skipped 는 「원인 증거 충분」으로 치지 않는다.** answered 만 richer evidence. 감지기도 해석 「모름」 · 범주 없음 · unsure 에서는 probe 를 띄우지 않는다(`insufficient_evidence`).

## 7. probe 운영

- 감지기가 provisional 경계를 감지했을 때만 제시(AI · 판정 출처 신호는 학습자에게 가지 않는다 — G4).
- attempt 당 같은 probe 1회 · 세션당 3회(결정 C) · 건너뛰기 가능. capture config 에 허용 probe(판 · 해시)를 봉인한다 — 설정에 없으면 띄우지 않는다.
- 증거를 고치면 재평가: 미응답 probe 는 취소, 응답한 probe 는 기록 보존 + obsolete.

## 8. provisional R6 연구 — pre/post 비교

같은 attempt 를 두 번 판정한다(회차 `evidence_profile` 로 봉인):

- **pre-probe** 회차: `evidence_profile = pre_probe`(targeted_probe 를 뺀 증거)
- **post-probe** 회차: `evidence_profile = all`

지표(attempt 단위 · 학생 단위 모두):

| 지표 | 정의 |
|---|---|
| boundary encounter | 감지기 신호가 생긴 attempt 수 |
| probe offered / answered / skipped | 대기 probe 제시 · 응답 · 건너뜀 |
| pre / post 결과 분포 | identified · multiple · insufficient |
| V/R 분리 가능률 | 경계 attempt 중 V 또는 R 하나로 판정된 비율(pre → post) |
| 교차 모델 일치 변화 | Claude · Codex 일치율 pre → post |
| unresolved 감소 | 경계 attempt 의 unresolved pre → post |
| **probe 유도 편향** | post 에서 한쪽(V 또는 R)으로만 쏠리는지 — 선택지 분포와 판정 분포를 함께 본다 |

probe 가 판정을 억지로 한쪽으로 몰아가면(편향) 그 자체가 결과다 — 성공으로 포장하지 않는다.

## 9. 판정 운영

- 판정자: Claude · Codex 독립(서로의 판정을 보지 않음 — blind 회차). 결과는 `csat_ec_judgment` 에 모델 · 판 · 입력 해시와 함께.
- 단계(결정 D): 명확 → 2-way 일치면 provisional adjudication / 불일치 · R6 경계 → 4-way(challenger 2) / 그래도 불일치 → unresolved(억지로 닫지 않는다).
- 표현: 「모델 판정」 · 「교차 모델 일치」. 모델 합의율을 human reliability 라 부르지 않는다.
- **식별정보 제거(모델 입력)**: 현재 내보내기(`csat_ec_ai_export`)에는 이름 · 이메일 · user id 가 없지만 `session_id`(계정과 이어지는 UUID)와 학생 자유서술이 들어간다. 모델에 보내기 직전 운영 스크립트가
  1. `session_id` · 증거 id 를 익명 attempt key(`P001-E1-#21` 꼴)로 바꾸고 매핑은 저장소 밖에 둔다
  2. 자유서술(이유 · 해석)에서 이름 · 학교 · 반 · 연락처 · 이메일 꼴을 검사해 걸리면 그 packet 을 보내지 않고 운영자가 가린 뒤 보낸다
  3. 보낸 packet 원본은 저장소에 남기지 않는다(판정 결과 · 입력 해시만 DB 에)
  이 스크립트와 그 가드(식별정보 꼴이 남은 packet 은 실패)는 G6 시작 체크리스트 항목이다 — DB 구조는 바꾸지 않는다.
  **구현(2026-10-06)**: `scripts/csat/error-evidence/model-input/model-packets.mjs`(export · rehydrate · selftest) + `deidentify.mjs` · `pii-rules.mjs`. AI 판정 RPC 를 부르는 파일은 이 모듈을 import 하거나 모델을 부르지 않는 검증 하네스여야 한다(`ec-pilot/__tests__/model-input-enforcement.test.ts` 기본 거부).

## 10. cause_confirmed · verified_diagnosis 경계

- attempt 하나: `cause_adjudicated` 까지. 여러 attempt 누적: `cause_confirmed` 가능.
- `cause_confirmed` 는 **Learning Map 을 바꾸지 않는다.** verified_diagnosis 가 없으면 학습 지도 mastery · 상태를 건드리지 않는다(G4 가드가 감지기의 판정 · mastery 쓰기를 막는다).
- 이번 Pilot 에서 verified_diagnosis 는 구현하지 않는다.

## 11. 종료 상태 · evidence target

**종료 상태 두 가지**(결정 E):

| 상태 | 뜻 |
|---|---|
| `COMPLETED` | 아래 evidence target 을 **모두** 충족 |
| `TIMEBOX_EXHAUSTED` | 3주 도달 · 일부 target 미충족 — 실패가 아니라 「운영은 끝났지만 일부 연구 질문은 증거 부족」. 같은 run 연장 · 참가자 추가 금지(새 run) |

완료 참가자가 3명 미만이면 위 상태와 별개로 **exploratory run** 으로 표기하고 결과를 일반화하지 않는다(결정 A).

**evidence target**:

| target | 기준 |
|---|---|
| 완료 참가자 | ≥ 5 |
| 대상 attempt | ≥ 60 |
| R6 경계 encounter | ≥ 8 |
| R6 probe answered | ≥ 5 |
| critical incident | = 0 |

R6 두 target 은 첫 Pilot 이라 발생률을 모른다 — **R6 분석 가능성의 최소 target** 이지 Pilot 전체 성공의 절대 조건이 아니다. 미달이면 보고를 둘로 나눈다:

```
Operational pilot: pass | fail
R6 evidence target: sufficient | insufficient
```

## 12. 즉시 중단 기준

하나라도 발생하면 수집을 멈추고, 원인을 고친 뒤 **새 run** 을 만든다(같은 run 재개 금지):

- 정답 · 해설 · 점수 공개 우회 발견 · 수집 완료 전 answer-sensitive 정보 노출
- taxonomy · TEST fixture 혼입(v99.* · eligibility.test · @example.com 증거가 run 데이터에 섞임)
- 다른 학생 증거 접근 가능
- 감지기가 정오를 참조(정답/오답 attempt 결과 차이)
- probe 가 잘못된 경계에서 반복 발생
- 증거 저장 · 봉인 무결성 깨짐(append-only 위반 · 부분 상태)

감시: run 중 매일 canary(`canary-scan --app --bundle`) · 표면 검사 · 함수 권한 가드 · `smoke-detector` 를 돌린다(운영 데이터에 쓰지 않는 TEST 시험 M2099 / 임시 계정만 — 스크립트가 자기 객체만 정리).

## 13. 평가 — 네 층 (결정 H)

**Pilot 전체(Operational) 판정과 R6 evidence 충분성은 따로 판정한다.** 하나의 숫자로 성공을 선언하지 않는다.

| 층 | 지표 | 기준 |
|---|---|---|
| Operational | 수집 완료율 · probe 완료율 · 재시도로 복구된 일시 오류(비율 별도 보고) | **critical integrity error = 0 (필수)** · 완료율은 보고(목표 ≥ 70%) |
| Evidence | answered 해석률 · unknown · skipped 각각 | **answered 해석률 = 대상 attempt 의 interpretation 중 `answered` 상태 비율 ≥ 50%** (unknown · skipped 는 answered 로 세지 않고 따로 보고) · **복구되지 않은 증거 유실 = 0 (필수)** |
| Taxonomy | 코드 coverage · unresolved 분포 · 교차 모델 일치 | 기술 보고(미설명 사례가 특정 영역에 몰리면 v0.2 후보) |
| R6 | 경계 encounter · probe 응답 · pre/post 해소 · V/R 분리 · probe 유도 편향 | §11 target 충족 여부 + 기술 보고(유의성 주장 없음) |

- **critical integrity error**: append-only 위반 · 부분 상태(증거 저장 · 감지 · 봉인 중 일부만 남음) · 봉인 해시 불일치 · 다른 학생 행 노출.
- **복구되지 않은 증거 유실**: 학생이 저장 성공을 본 증거가 DB 에 없거나, 저장 실패 뒤 재시도로도 남지 않은 것. 소표본(60 attempt 이면 1건 = 1.7%)에서 비율 기준은 흔들리므로 **건수 0** 으로 본다.
- 재시도로 복구된 일시 오류(네트워크 등)는 실패로 세지 않고 운영 지표로 따로 보고한다.

## 14. 일반화 금지

이번 결과로 Gold taxonomy · verified taxonomy · 학년별 난도 · 전국 일반화를 주장하지 않는다. 산출물 제목 · 요약에 「v0.1 operational pilot evidence」 를 붙인다.

## 15. 학생 안내 · 보호

참가 전 안내(운영자가 학생에게 전달 · 기관 동의 절차는 별도 확인):

- 목적: 오답이 생기는 과정을 이해해 학습 도구를 개선하는 운영 시험이다
- 수집 데이터: 고른 답 · 막힌 곳 · 이유 · 「이렇게 읽었다」 해석(자유서술) · 범주 선택 · 추가 질문 응답 · 시각
- 자유서술은 저장된다(개발 DB 안 · 공개 저장소에는 원문을 넣지 않는다)
- 정답 · 해설 · 점수는 기록을 다 남긴 뒤에 열린다(공개 지연)
- 언제든 중단할 수 있다(중단한 회차는 운영자가 미완료로 닫고 결과를 연다)
- Pilot 결과는 학습 평가 · 성적에 불이익으로 쓰이지 않는다

## 16. run identity — 봉인 항목

run 마다 고유 id(`ec-pilot-run-<YYYYMMDD>-<n>`)와 아래를 시작 시 기록한다. **하나라도 바뀌면 같은 run 으로 계속하지 않는다.**

| 항목 | 출처 |
|---|---|
| taxonomy 해시 | `csat_ec_taxonomy_version.definitions_hash`(v0.1) |
| capture · probe config 해시 | capture config(probes · probe_cap) 정규화 sha256 · `captureProbeConfig()` 의 key · version · prompt_hash |
| detector 판 | `csat_ec_detector_run.detector_version`(bd-0.1.0) |
| 앱 커밋 | 배포 커밋 해시 |
| DB 마이그레이션 상태 | `schema_migrations` 최신 버전 · 개수 |
| **시험 내용 identity** | exam id · **item set 해시**(문항 id · 입력 해시 정렬 sha256) · **정답표 해시**(`csat_dx_answer_key`) · 원문/코퍼스 판(문항 원문 입력 해시 · 원천 판) |
| 참가자 | **익명 key 목록**(P001…) 과 각 key 의 시험 assignment — 실제 계정 id 는 넣지 않는다 |

run 메타는 저장소 `docs/csat-learner/pilot-runs/<run id>.md` 에 해시 · 익명 key · assignment · 집계만 둔다. 매일 감시(§12) 때 봉인 해시를 다시 계산해 바뀌었으면 중단 기준(무결성)으로 처리한다 — Evidence Anchor 연구의 원천 drift 문제를 되풀이하지 않는다.

**구현(2026-10-06)**: 형식 · 해시 정의 · E2E 통과 기록 형식 · 개발/검증 모드는 [`../pilot-runs/README.md`](../pilot-runs/README.md). 봉인 `scripts/csat/pilot/seal-run.mjs`(json + md) · 점검 `start-check.mjs`(읽기 전용 · 매일 감시에도 사용). 앱은 `apps/web/src/lib/csat/ec-pilot/gate.ts` 가 활성 메타(`active-run.ts`)와 live 값을 대조해 **모두 맞을 때만** 수집을 연다(fail-closed · 학습자 응답은 404).

## 17. 분석 단위

student · exam/session · attempt/item 을 따로 보고한다. 전체 집계만 내지 않는다. 한 학생의 attempt 가 전체를 지배하지 않게 학생 단위 평균(학생당 동일 가중)을 함께 낸다.

## 18. 실제 Pilot 직전 마지막 smoke

테스트 계정으로 production 빌드에서 end-to-end 한 번: participant · non-participant · 경계 감지 · 경계 없음 · probe 응답 · probe 건너뜀 · 증거 정정 · 수집 완료 · 공개. 기존 `smoke-detector`(17) · `smoke-capture`(42) · `smoke-pilot`(104) · canary(392) 에 더해 **화면(Playwright)** 으로 같은 흐름을 한 번 더 확인한다 — 그 e2e 를 G6 시작 체크리스트의 첫 항목으로 둔다.

## 19. 종료 후 산출물

저장소에 남기는 것: run 메타(§16) · 종료 상태(`COMPLETED` | `TIMEBOX_EXHAUSTED` · exploratory 여부) · 집계 통계(학생 · 시험 · attempt 단위) · 코드 coverage · 경계/probe 통계 · unresolved 요약 · 운영 실패 · 판정 요약 · 다음 revision 제안 — 모두 **익명 key** 로.

저장소에 넣지 않는 것: 이름 · 이메일 · 학교/반 · 계정 id · 학생 자유서술 원문 · raw reviewer/model packet · 익명 key ↔ 계정 매핑.

## 20. G6 시작 체크리스트

G5 는 이 문서로 닫는다. 아래를 마친 뒤 **G6 시작 승인**을 따로 받는다.

1. 참가자 모집 · 동의(운영자)
2. 미응시 회차 조사 → 공통 2회차 결정(결정 B 우선순위)
3. 익명 participant mapping(P00n ↔ 계정, 저장소 밖) · 배포 env `CSAT_EC_PILOT_USER_IDS` 설정 · `probeCapPerSession = 3` 커밋
4. 모델 입력 식별정보 제거 스크립트 + 가드(§9)
5. run metadata 봉인(§16 — 시험 내용 identity 포함)
6. production 배포 커밋 고정 · 마지막 Playwright E2E(§18)
7. G6 시작 승인 → 감시(§12) 시작 → 수집 시작
