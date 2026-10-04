# 사람 판정자 blind dry run — 절차 (human-v1, 2026-10-04 준비 완료 · 판정자 역할 요건 고정 · 섭외 대기 · 미실시)

> 2026-10-04: 사람 판정 대신 [Cross-Model Blind Dry Run](./XMODEL_DRY_RUN.md)(Claude × Codex)을 먼저 실시했다 — 결과 [XMODEL_RESULT.md](./XMODEL_RESULT.md). 이 사람 절차는 「향후 필요 시 human validation」 단계로 보존한다.

> 상태: **준비만 끝났다. 사람 판정은 아직 없다.** 판정자 두 명을 사용자가 정해야 시작할 수 있다.
> 목적: 코드별 신뢰도 추정이 아니라 **경계가 사람에게도 작동하는지** 확인한다(56건 · 19코드로는 코드별 신뢰도를 추정할 수 없다).
> 모델 dry run([DRY_RUN.md](./DRY_RUN.md))은 코드북 개발 자료로만 보존하고 **사람 신뢰도 근거로 쓰지 않는다.**

## 고정값(사전 등록)

| 항목 | 값 |
|---|---|
| 코드북 | [CODEBOOK.md](./CODEBOOK.md) **rev3** · sha256 `d19e04e8c70ec4c89c899435c2b52188c4ce9cab998f0b8acd33405e573c3b1c`(줄바꿈 LF 정규화) |
| 말뭉치 | [data/human-corpus.json](./data/human-corpus.json) `human-v1` — 본 판정 56건 |
| 연습 세트 | [data/human-training.json](./data/human-training.json) — 10건(본 판정과 겹치지 않음, 해설 포함) |
| 기대 판정 | [data/sealed/human-expected.json](./data/sealed/human-expected.json) · sha256 `d662da16281d…`(전체 값은 말뭉치 파일 `expected_sha256`) — **판정이 모두 끝난 뒤에만 연다** |
| 판정 도구 | `scripts/csat/error-evidence/codebook/build-packet.mjs`(판정자별 HTML) · `analyze-human.mjs`(분석) |

- 판정 패킷은 코드북 해시가 고정값과 다르면 **만들어지지 않는다**. 분석기는 다른 코드북으로 판정한 결과 파일을 **거부한다**.
- 판정 기간에 코드북을 고치지 않는다. 문제를 발견하면 메모만 하고, 회차가 끝난 뒤 rev4 를 만들어 **새 사례를 포함한 새 회차**로 검증한다. 사람 결과를 본 뒤 고친 규칙을 같은 사람 결과에 소급 적용해 「통과」로 만들지 않는다.

## 판정 결과(outcome) 정의 — 확신도가 아니다

| 결과 | 정의 |
|---|---|
| `identified` | 지금 과정 증거가 경쟁 원인을 실제로 배제해 한 원인을 지지한다 |
| `multiple_plausible` | 원인 판정을 시도할 증거는 있지만 둘 이상의 원인을 지금 증거로 구별할 수 없다 — 낮은 확신과 다르다 |
| `insufficient_evidence` | 원인을 판정할 과정 증거가 애초에 없다 |
| `inconsistent_evidence` | 서로 다른 증거가 동시에 참일 수 없는 원인을 지지해 하나의 설명이 안 된다 |
| `unsupported_stimulus` | 판정 대상 밖 — 학생 증거가 가리킬 자극(도표 값 · 듣기)이 DB 에 없다. taxonomy 의 coverage 실패로 세지 않는다 |

판정자 확신도(`judge_confidence`: low · medium · high)는 결과와 **따로** 적는다. DB outcome CHECK 변경(multiple_plausible · inconsistent_evidence 저장)은 taxonomy 확정 뒤에 결정한다 — 이번 dry run 은 파일로만 한다.

## 판정자

| | 권장 | 비고 |
|---|---|---|
| A — 수능 영어 도메인 전문가 | 현직/전직 고등학교 영어 교사 또는 수능 영어 강사 우선 · 고3/수능 영어 지도 경험 · 평가원 6월 · 9월 · 수능 기출 분석 경험 · 학생 오답을 어휘 / 문장 / 담화 / 근거 판단 수준에서 구별해 설명할 수 있음 | 이번 코드북 작성에 참여하지 않음 |
| B — 독립 판정자 | 충분한 영어 읽기 · 수능 기출 이해 · 가능하면 영어교육 · 영어평가 · 수능 영어 분석 경험 · **A 와 다른 학교 / 기관 / 팀 소속 우선** | taxonomy 설계 미참여 · A 의 보조자 · 제자 등 판단이 종속될 수 있는 사람은 피한다 |

B 는 A 의 보조자가 아니라 「같은 코드북을 독립적인 사람이 같은 방식으로 적용할 수 있는가」를 검증하는 판정자다. 실명보다 이 역할 요건을 먼저 고정한다 — 섭외 확정 시 판정자 배경(경력 연수 · 소속 유형 · A/B 독립성)만 기록하고 실명은 저장소에 적지 않는다.

**제공 허용**: 자기 판정 패킷 HTML 하나(rev3 판정 정의 · 같은 연습 10건 · 도구 사용법 포함).
**제공 금지**: 저장소 접근 · CASES.md · 기대 판정 · 모델 dry run 결과 · 상대방 JSON · 조정 결과.

- 서로의 결과 · 모델 dry run 결과 · 기대 판정 · 사례 은행 문서(CASES.md · data/round*.json)를 **보지 않는다**. 판정자에게는 **패킷 HTML 한 파일만** 준다(저장소 접근을 주지 않는다).
- 패킷에는 문항 원문이 들어 있다 — 판정자 두 명 밖으로 배포하지 않는다. 판정자에게 원문 재배포 금지를 안내한다.

## 진행

1. **패킷 만들기**(운영자):
   ```bash
   node --tls-max-v1.2 --env-file=apps/web/.env.local scripts/csat/error-evidence/codebook/build-packet.mjs --reviewer A --out <저장소 밖 폴더>
   node --tls-max-v1.2 --env-file=apps/web/.env.local scripts/csat/error-evidence/codebook/build-packet.mjs --reviewer B --out <저장소 밖 폴더>
   ```
   본 판정 순서는 판정자마다 다르게 섞인다. 문항 원문은 DB 에서 그때 읽는다.
2. **연습(약 30–45분 · 두 판정자 동일 10건)**: 판정자가 패킷의 「연습」 모드로 10건을 판정한다. 저장하면 정답과 해설(어느 규칙으로 정했나)이 보인다. 이 단계에서만 운영자가 질문에 답할 수 있다 — 답은 **코드북에 이미 있는 내용**으로만 한다. 본 판정이 시작되면 rev3 를 고치지 않는다. 코드 의미를 묻는 질문에는 본 사례 힌트 없이 코드북의 일반 정의만 다시 가리킨다.
3. **본 판정(blind)**: 「본 판정」 모드로 56건. 중간에 코드북 해석을 묻지 않는다(묻고 싶은 점은 「코드북이 불분명했던 점」 칸에). 예상 소요 2–3시간. 권장: **Session 1 약 28건 · Session 2 약 28건**(브라우저에 자동 저장 · 「불러오기」로 이어 하기). 두 세션 사이에도 상대방 결과 · 기대 판정을 공개하지 않는다. 문항 순서는 판정자마다 다르게 유지한다. 사례마다 최소 증거 충분성 · outcome · primary · contributing · 판정자 확신도를 적는다. `multiple_plausible` 은 확신이 낮다는 뜻이 아니다 — 둘 이상의 원인이 최소 증거를 충족하고 지금 증거로 서로 배제할 수 없을 때만 쓴다.
4. **내보내기**: 판정자가 「결과 내보내기」로 `human-review-A.json` · `human-review-B.json` 을 운영자에게 보낸다. 받은 파일은 고치지 않는다.
5. **분석**(A 와 B 가 **모두** JSON 을 제출하기 전에는 분석기를 실행하지 않고 어떤 결과도 공유하지 않는다):
   ```bash
   node scripts/csat/error-evidence/codebook/analyze-human.mjs docs/csat-learner/codebook/data/human-corpus.json human-review-A.json human-review-B.json <out> docs/csat-learner/codebook/data/sealed/human-expected.json
   ```
   기대 판정 파일은 이 단계에서 처음 연다(해시가 말뭉치의 `expected_sha256` 과 같은지 먼저 확인).
6. **판정 조정(adjudication)**: `adjudication.csv` 의 불일치마다 분류 하나 — `reviewer_mistake` · `rule_gap`(결정 규칙 부족) · `evidence_gap`(증거 부족) · `case_problem`(사례 작성 문제) · `taxonomy_overlap` · `missing_cause`. 최초 blind 결과는 고치지 않는다. 조정은 두 판정자 + 운영자가 함께, 조정 결과는 별도 열에만 적는다.

## 말뭉치 구성(56건 — 경계 중심, 무작위 쉬운 사례 아님)

| 경계 · 목적 | 건 | 출처 |
|---|---|---|
| V.wrong_sense ↔ R.inference | 5 | 1회차 3 · 경계 2 |
| R.reference ↔ R.relation | 4 | 1회차 3 · 경계 1 |
| R ↔ B | 5 | 1회차 4 · 경계 1 |
| E.task_misread ↔ X.time | 3 | 1회차 1 · 경계 2 |
| E.task_misread ↔ X.attention | 3 | 1회차 2 · 경계 1 |
| S.form_rule ↔ 다른 S | 4 | 1회차 2 · 경계 2 |
| identified ↔ multiple_plausible | 5 | 1회차 1 · 경계 4 |
| multiple_plausible ↔ insufficient_evidence | 4 | 신규 3 · 경계 1 |
| inconsistent_evidence | 4 | 신규 2 · 1회차 2 |
| 감시: S.attachment | 3 | 신규 3(수식 부착 · 병렬 묶음) |
| 감시: V.multiword | 2 | 신규 2 |
| 감시: 저빈도 E(evidence_location · option_mismatch) | 7 | 신규 5 · 경계 2 |
| 안정 코드 대표 | 5 | 1회차 5 |
| A0 · A1 | 2 | 1회차 2 |

- 출처 합계: 1회차 25 · 2회차 경계 16 · 신규 15(이번에 별도 작성 — 감시 코드 · outcome 경계용, 「특정 코드를 쓰게 만들려고 증거를 과하게 명시하지 않는다」 지시, 이유 대부분 한 문장 · 해석은 절반만).
- 제외: 도표 문항 사례 C4-09 — `unsupported_stimulus`(도표 값이 DB 에 없다).
- 모델 dry run 에서 이미 쉽게 맞힌 사례는 「안정 코드 대표」 5건만 넣었다.

## 지표 · 내부 게이트

**이 게이트는 이 프로젝트의 내부 screening 기준이다 — 보편 학술 기준이 아니다.** percent agreement 하나로 승인하지 않는다(우연 일치 보정 지표 병기 — ETS 의 채점자 일치 권고, NCME *Educational Measurement* 의 κ · Gwet AC1 소개를 따랐다). κ 는 범주가 한쪽으로 쏠리면 관찰 일치가 높아도 낮게 나오므로(prevalence) AC1 과 함께 본다 — 분석기 단위 테스트가 이 역설을 확인한다.

| 지표 | 계산 | 게이트 |
|---|---|---|
| family 정확 일치 | 두 판정자 모두 primary 를 고른 사례 | ≥ 80% |
| primary 정확 일치 | 같은 사례 | ≥ 70% · 65–70% 는 「코드북 수정 검토 구간」(자동 승인 아님) |
| insufficient_evidence 여부 일치 | 전 사례 | ≥ 80% |
| outcome 일치 | 전 사례 | 보고 |
| primary(전 사례 — 보류도 범주) | 전 사례 | 보고(「둘 다 primary」 기준이 보류 차이를 숨기지 않게) |
| Cohen κ · Gwet AC1 | 위 각 지표 | 보고 |
| 불일치 code-pair 표 | primary · outcome 쌍 | **같은 쌍 3건 이상 = 반복 충돌** — 핵심 경계에 반복 충돌이 없어야 통과 |
| 경계 묶음별 일치 · 확신도별 일치 | | 보고 |

## 기대 판정의 쓰임 — 정답이 아니다

세 가지를 따로 본다: **A ↔ B** · **A/B ↔ 기대** · **조정 결과**. A 와 B 가 서로 같고 기대와 다르면(분석기가 목록을 낸다) 기대 · 코드북 작성자의 가정을 다시 본다 — 판정자 오류로 처리하지 않는다. 모델 2회차에서 이미 하나 확인됐다(H-13 fiction 은 rev3 R6 기준으로 V.wrong_sense 가 맞을 수 있다 — 기대는 R.inference 로 고정해 두었다).

### 게이트 해석

수치를 넘었다고 자동 seed 하지 않는다 — 반복 충돌 code pair 와 조정 원인을 함께 본다. 별도 확인 경계: `R.reference` / `R.relation` · `S.attachment` · `V.multiword` · 저빈도 E 코드 · `V.wrong_sense` / `R.inference` · R / B 경계 · `identified` / `multiple_plausible`.

## dry run 뒤 결정(코드마다)

유지 · 병합 · 분리 · contributing 전용 · 은퇴 중 하나. **빈도만으로 삭제하지 않는다** — 관찰 가능성 · 판정 안정성 · 다른 코드와의 구별 · 처방(repair) 차이를 함께 본다. 특히:
- `S.attachment` — 사람도 다른 S 와 안정적으로 못 가르거나 처방 가치가 없으면 병합 후보.
- `R.reference` / `R.relation` — 사람도 반복 혼동하고 처방이 같으면 독립 코드 병합, 또는 `R.relation` + subtype `reference_tracking`.
- `V.multiword` 독립 필요성 · `B.no_verification` contributing 전용 유지 · 저빈도 E 유지.

## 다음 보고(A–L)

A 판정자 배경 · 연습 방식 · B 말뭉치 구성 · C family 일치 · D primary 일치 · E outcome 일치 · F κ · AC1 · G 불일치 쌍 표 · H 기대 판정과의 차이 · I 조정 결과 · J 유지/병합/삭제 제안 · K 최종 v0.1 candidate 코드 수 · L seed 전 남은 문제.

이 결과가 승인되기 전에는 taxonomy seed · 실제 학생 Pilot · outcome DB 마이그레이션 · verified diagnosis 구현 · Gold item tagging · Learning Map 변경 · Evidence Anchor 변경 · push/PR 을 하지 않는다(Learning Map ontology · Evidence Anchor Foundation · 코드북 rev3 는 동결 상태).
