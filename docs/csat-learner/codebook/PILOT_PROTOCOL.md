# 오답 원인 Pilot 프로토콜 — G5 (v0.1 operational pilot)

> 2026-10-06 초안 · **승인 전 · 실제 Pilot 미시작**. G1~G4 는 완료 상태로 고정한다(함수 권한 · Reveal Gate · 경계 감지기 — DB/UI/Reveal Gate/Detector 구조는 새 증거 없이 바꾸지 않는다).
> 이 문서가 승인돼야 G6(실제 Pilot)을 시작한다. 근거 자료: `PILOT_DATA_MODEL.md` · `PILOT_SEED_DESIGN.md` · `REVEAL_GATE_DESIGN.md`(§G3 종료) · `BOUNDARY_DETECTOR_DESIGN.md`(§G4 종료).
> 상태 표현은 끝까지 **「v0.1 operational pilot evidence」** 로 제한한다.

## 0. 승인할 결정 (A–H)

| | 결정(제안) | 근거 |
|---|---|---|
| **A. 참가자 수** | 1차 run **5명**(최소 3명 · 최대 8명). 영어 수준이 한쪽으로 몰리지 않게 모집하되 점수대 분포를 강제하지 않는다 | 통계 검증이 아니라 실제 학생 증거가 들어올 때 파이프라인이 도는지 보는 단계 |
| **B. 시험 회차** | 평가원(kice · 고3) **2회차** 고정 — 참가자가 **아직 풀지 않은** 회차를 사전 설문으로 고른다(후보: 2023~2024 6·9월 · 수능). 독해 28문항(18–45번) · 정답표 · 원문은 DB 실측으로 모두 있음 | 이미 푼 회차는 「처음 읽은 해석」이 아니라 기억이 들어가 증거가 오염된다. `took_exam` 확인 질문이 보조 관문 |
| **C. probe 상한** | attempt 당 같은 probe **1회**(현재 구현) · 세션당 **3회**(`probeCapPerSession = 3`). 건너뛰기 허용 | 대상 문항 수 대비 부담 · 첫 run 뒤 건너뜀 비율로 다시 정한다(다음 run 에서만 변경) |
| **D. 판정 운영** | 적응형 교차 모델: 모든 대상 attempt 를 Claude · Codex **독립 2판정** → 일치하면 provisional accept, 불일치 · 경계(R6) 사례만 4-way(challenger 포함) → 그래도 갈리면 final adjudication 또는 **unresolved 유지** | 모든 attempt 4~6중 판정은 비용 대비 이득이 없다. 모델 판정은 human validation 이라 부르지 않는다 |
| **E. 기간 · 종료** | 기간은 상한만 둔다(**최대 3주**). 종료는 §11 조건을 **모두** 만족할 때 — 「N명 끝남」 만으로 종료하지 않는다 | 종료 조건 우선 |
| **F. 중단 기준** | §12 중 하나라도 발생하면 즉시 중단 · 수정 · 새 run | Reveal Gate · 감지기 계약 |
| **G. 데이터 보존** | 원 증거는 개발 DB 안에만(append-only). 저장소에는 집계 · 코드 분포 · 경계 통계 · 운영 실패 · 판정 요약만. 학생 자유서술 원문 · raw packet 은 저장소에 넣지 않는다 | §19 |
| **H. 성공/실패** | 한 숫자로 정하지 않는다 — §13 네 층 각각 「다음 run 으로 갈 수 있음 / 고쳐야 함」 판정 | §13 |

## 1. 목적 — 네 가지로 제한

1. 실제 학생이 process evidence(막힌 곳 · 이유 · 해석 · 범주)를 충분히 남길 수 있는가
2. 오답 원인 taxonomy **v0.1 conditional seed** 가 실제 attempt 를 설명하는 데 쓸 수 있는가
3. provisional 경계 `V.wrong_sense ↔ R.inference`(`r.inference__v.wrong_sense`)에서 targeted probe(`r6_derivation_probe`)가 판정 가능성을 높이는가
4. Capture → Detector → Probe → Review 파이프라인이 실제 사용자 흐름에서 안정적으로 도는가

**주장하지 않는 것**: taxonomy 최종 타당성 · 전국 학생 일반화 · 학년별 난도 타당성 · verified diagnosis 정확도 · Learning Map mastery 검증 · 점수 상승 효과 · Gold/verified taxonomy.

## 2. 참가자

- 모집 대상은 실제 학생(고등학생 이상). **모집 · 동의 절차는 운영자(사용자) 몫**이다 — 이 문서는 §15 안내 항목만 정한다. 학교 · 기관에서 진행하면 그 기관의 동의 절차를 별도로 확인한다.
- 참가자는 각자 독립적으로 푼다(함께 풀거나 답을 공유하지 않는다).
- 등록: `EC_PILOT.participants`(저장소 설정)에 user id 를 넣는다. env `CSAT_EC_PILOT_USER_IDS` 는 개발 · 검증 전용 — **실제 run 에서는 쓰지 않는다**(누가 참가자였는지가 커밋에 남아야 한다).
- 제외: 운영자 · 개발 계정 · 테스트 계정(`@example.com`) · 이전 DB 의 일괄 입력(전부 ②/③ 같은 입력) — Pilot 대상 아님. 기록 품질 관문(`recordQuality` = trusted)이 일괄 입력을 걸러낸다.

## 3. 시험 자료 · 고정

- run 시작 전에 회차 2개를 정하고 run 메타데이터에 봉인한다(§16). 회차는 `csat_exams.organizer = 'kice'` Gold 원천만.
- run 중 바꾸지 않는 것: 문항 원문 · 정답 · taxonomy version · probe 정의(판 · prompt_hash) · capture config. 하나라도 바뀌어야 하면 **새 run** 으로 분리한다(문항 입력 해시가 바뀌면 기존 증거는 판정 입력에서 자동으로 무효가 된다 — 그 상태로 같은 run 을 이어가지 않는다).

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
- 적응형 단계(결정 D):
  - 명확 — 2-way 일치 → provisional accept
  - 경계(R6) 또는 불일치 → 4-way(challenger 2 추가)
  - 그래도 불일치 → final adjudication 또는 unresolved 유지(억지로 닫지 않는다)
- 표현: 「모델 판정」 · 「교차 모델 일치」. **human validation 이라고 부르지 않는다.**

## 10. cause_confirmed · verified_diagnosis 경계

- attempt 하나: `cause_adjudicated` 까지. 여러 attempt 누적: `cause_confirmed` 가능.
- `cause_confirmed` 는 **Learning Map 을 바꾸지 않는다.** verified_diagnosis 가 없으면 학습 지도 mastery · 상태를 건드리지 않는다(G4 가드가 감지기의 판정 · mastery 쓰기를 막는다).
- 이번 Pilot 에서 verified_diagnosis 는 구현하지 않는다.

## 11. 종료 조건 (모두 만족)

| 조건 | 기준 |
|---|---|
| 참가자 | 완료 참가자 ≥ 5(최소 3 이면 「축소 종료」로 표기) |
| 수집량 | completed 세션 ≥ 참가자 수 × 1, 대상 attempt ≥ 60 |
| 해석 증거 | answered 해석 비율을 측정할 수 있을 것(분모 ≥ 60) |
| R6 경계 | 경계 encounter ≥ **8** attempt, 그중 probe answered ≥ **5** |
| 경로 확인 | 감지기 · probe · pre/post 회차 · 교차 판정이 실제 데이터로 각 1회 이상 돈 기록 |
| 안전 | critical leak 0 · reveal 우회 0 · 데이터 무결성 결함 0(§12 미발생) |

기간 상한 3주 안에 R6 조건을 못 채우면 「R6 미충족 종료」로 기록하고 경계 통계는 기술만 한다(확대 해석 금지).

## 12. 즉시 중단 기준

하나라도 발생하면 수집을 멈추고, 원인을 고친 뒤 **새 run** 을 만든다(같은 run 재개 금지):

- 정답 · 해설 · 점수 공개 우회 발견 · 수집 완료 전 answer-sensitive 정보 노출
- taxonomy · TEST fixture 혼입(v99.* · eligibility.test · @example.com 증거가 run 데이터에 섞임)
- 다른 학생 증거 접근 가능
- 감지기가 정오를 참조(정답/오답 attempt 결과 차이)
- probe 가 잘못된 경계에서 반복 발생
- 증거 저장 · 봉인 무결성 깨짐(append-only 위반 · 부분 상태)

감시: run 중 매일 canary(`canary-scan --app --bundle`) · 표면 검사 · 함수 권한 가드 · `smoke-detector` 를 돌린다(운영 데이터에 쓰지 않는 TEST 시험 M2099 / 임시 계정만 — 스크립트가 자기 객체만 정리).

## 13. 성공 판정 — 네 층 (결정 H)

| 층 | 지표 | 「다음 run 가능」 기준(제안) |
|---|---|---|
| Operational | 수집 완료율 · probe 완료율 · UI 실패율 · 재시도/오류율 | 완료율 ≥ 70% · 저장 실패 오류율 ≤ 2% |
| Evidence | usable(answered) 해석률 · insufficient · skipped 비율 | answered ≥ 50% |
| Taxonomy | 코드 coverage · 반복 unresolved 경계 · 원인 분포 · 교차 모델 일치 | 미설명(no code fits) 사례가 특정 영역에 몰리면 v0.2 후보로 기록 |
| R6 | pre/post 해소 개선 · V/R 분리 · probe 유도 충돌률 | 개선 방향 · 편향 여부를 기술(유의성 주장 없음) |

기준 미달은 실패가 아니라 「고쳐야 할 곳」 목록이다. 하나의 숫자로 성공을 선언하지 않는다.

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

run 마다 고유 id(`ec-pilot-run-<YYYYMMDD>-<n>`)와 아래를 시작 시 기록한다. 하나라도 바뀌면 같은 run 으로 계속하지 않는다.

| 항목 | 출처 |
|---|---|
| taxonomy 해시 | `csat_ec_taxonomy_version.definitions_hash`(v0.1) |
| capture config 해시 | `csat_ec_capture_session.config`(probes · probe_cap) 정규화 sha256 |
| probe config 해시 | `captureProbeConfig()` 의 key · version · prompt_hash |
| detector 판 | `csat_ec_detector_run.detector_version`(bd-0.1.0) |
| 앱 커밋 | 배포 커밋 해시 |
| DB 마이그레이션 상태 | `schema_migrations` 최신 버전 · 개수 |
| 시험 회차 | 2개 id · 문항 입력 해시 |
| 참가자 목록 | `EC_PILOT.participants` 를 담은 커밋 |

(run 메타는 저장소 `docs/csat-learner/pilot-runs/<run id>.md` 에 집계 · 해시만 — 학생 원문 없음.)

## 17. 분석 단위

student · exam/session · attempt/item 을 따로 보고한다. 전체 집계만 내지 않는다. 한 학생의 attempt 가 전체를 지배하지 않게 학생 단위 평균(학생당 동일 가중)을 함께 낸다.

## 18. 실제 Pilot 직전 마지막 smoke

테스트 계정으로 production 빌드에서 end-to-end 한 번: participant · non-participant · 경계 감지 · 경계 없음 · probe 응답 · probe 건너뜀 · 증거 정정 · 수집 완료 · 공개. 기존 `smoke-detector`(17) · `smoke-capture`(42) · `smoke-pilot`(104) · canary(392) 에 더해 **화면(Playwright)** 으로 같은 흐름을 한 번 더 확인한다 — 그 e2e 를 G6 시작 체크리스트의 첫 항목으로 둔다.

## 19. 종료 후 산출물

run 메타데이터 · 집계 통계 · 코드 coverage · 경계/probe 통계 · unresolved 요약 · 운영 실패 · 판정 요약 · 다음 revision 제안. **학생 자유서술 원문 · raw packet 은 공개 저장소에 넣지 않는다.**

## 20. G6 시작 체크리스트 (승인 뒤)

1. 이 문서 결정 A–H 승인
2. 참가자 모집 · 동의 완료(운영자) → `EC_PILOT.participants` 커밋 · `probeCapPerSession = 3` 커밋
3. 회차 2개 확정(참가자 미응시 설문) · run 메타 봉인(§16)
4. production 배포 커밋 고정 · §18 e2e(화면 포함) 통과
5. 감시 일정(§12) 시작 → 수집 시작
