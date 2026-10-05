# v0.1 conditional seed · R6 provisional 경계 · Pilot 증거 설계 (2026-10-05 · 설계 — 적용 전)

> 결정: [SEED_DECISION.md](./SEED_DECISION.md) 「제품 결정」. 구성안 데이터: [data/seed-v0.1-conditional.json](./data/seed-v0.1-conditional.json).
> 이 문서는 **설계**다. DB seed · 마이그레이션 · UI 구현 · Pilot 실행은 하지 않았다 — 각각 별도 승인. push/PR 보류.

## 1. conditional seed 구성안

| 항목 | 내용 |
|---|---|
| 이름 | `v0.1 conditional seed candidate` (validated · verified taxonomy 라고 부르지 않는다) |
| 코드북 기준 | `CODEBOOK.rev4.2.md` `c7001aff97b0` — §6/R9 · R12(+ 고정 표현 판별) 채택분 포함, R6 은 rev4 문구 |
| 코드 19개 | 모두 `accepted`(retire 없음) — V.wrong_sense · R.inference 도 코드 자체는 accepted |
| 규칙 | accepted: §6/R9 · R12 / provisional: R6 의 V.wrong_sense ↔ R.inference 경계 |
| 경계 상태 | `V.wrong_sense ↔ R.inference` = `provisional_boundary` |
| 사전 등록 결과 | 「rev4 did not pass the preregistered v0.1 seed gate」 — 그대로 둔다 |

rev4.3 의 R6 「의미 도달 경로」 문구는 채택되지 않았으므로 seed 코드북에 넣지 않는다. 다만 Pilot 판정 지시의 **provisional 경계 처리**(아래 2)와 probe 해석(4)에 그 구분(직접 선택 vs 도출)을 쓴다.

## 2. provisional 경계 표현

### 판정 규칙(Pilot 판정 지시에 추가)

provisional 경계 패턴 = 학생이 낱말 뜻을 언급하면서 그 뜻에서 문맥 · 비유적 해석을 도출하는 형태(「X 가 Y 라는 뜻이니까 …」)이고, 지금 증거가 「사전 뜻 직접 선택」 과 「기본 뜻에서 도출」 을 가르지 못할 때:

- primary 를 만들지 않는다 — 다수결 · 두 모델 합의 · 단계 우선(R3)만으로 V 를 앞세우지 않는다.
- 결과: 두 후보가 각각 최소 증거를 갖추면 `multiple_plausible`(V.wrong_sense · R.inference), 아니면 `insufficient_evidence`.
- 판정에 `boundary_flags: ["V.wrong_sense|R.inference"]` · `requires_targeted_probe: true` 를 남긴다.
- probe 응답(4)이 들어오면 그 증거를 더해 다시 판정한다. probe 응답만으로 verified diagnosis 를 만들지 않는다.

### 데이터 모델 — 지금 스키마로는 담을 수 없다(마이그레이션 필요 · 승인 전 적용 안 함)

| 필요 | 지금 (`20261003230000_csat_error_evidence.sql`) | 변경안 |
|---|---|---|
| 결과 `multiple_plausible` · `inconsistent_evidence` | `csat_ec_judgment.outcome` CHECK: code · no_cause · insufficient_evidence · no_fitting_code · `csat_ec_ai_run.outcome` CHECK 도 같음 | 두 CHECK 에 `multiple_plausible` · `inconsistent_evidence` 추가 · multiple 이면 후보 코드 배열(2개 이상) |
| 경계 상태 | 없음(`csat_ec_code.status` 는 active / deprecated — 코드 단위) | `csat_ec_boundary(taxonomy_version, code_a, code_b, status in ('accepted','provisional'), pattern, probe_key)` — 코드 상태와 분리 |
| 판정의 경계 표시 | 없음 | `csat_ec_judgment` 에 `boundary_flags text[]` · `requires_probe boolean` |
| 학생 해석 · probe 응답 | `csat_ec_process_evidence.kind` CHECK: confidence · reason · blocked_span · category · note | `interpretation`(해석 텍스트) · `probe`(`{probe_key, choice, free_text?}`) 추가 |

## 3. Pilot 증거 수집(학생 쪽)

지금 학생 증거: 확신도 · 고른 이유 · 막힌 곳 · 자기 분류. R6 경계를 가르려면 **해석**(그 부분을 어떻게 읽었나)이 필요하고, 경계가 감지되면 **probe** 를 하나 더 받는다.

흐름(한 문항, 틀린 경우):
1. 확신도 → 고른 이유 → 막힌 곳(지금과 같음)
2. **해석** — 「막힌 부분을 어떻게 이해했는지 적어 주세요」(선택 입력, 500자)
3. AI 1차 판정에서 provisional 경계 패턴이 감지되면 → **R6 probe**(4) 한 문항. 감지되지 않으면 끝.

부담 관리: probe 는 문항당 최대 1개 · 세션당 상한(예: 3개) · 건너뛰기 허용(건너뛰면 D 와 같게 처리).

## 4. R6 targeted probe — `R6_derivation_probe`

질문(개념안 — 최종 UX 문구 아님): 「여기서 ‘{학생이 쓴 뜻 Y/Z}’ 라는 의미는 어떻게 판단했나요?」

| 선택 | 의미 | 판정에 주는 증거 |
|---|---|---|
| A 그 단어 자체가 그런 뜻이라고 생각했다 | 사전 뜻 직접 선택 | V.wrong_sense 후보 강화(lexical sense selection evidence) |
| B 단어의 기본 뜻에서 문맥 · 비유적으로 그렇게 추론했다 | 기본 뜻에서 도출 | R.inference 후보 강화(figurative/contextual derivation evidence) |
| C 둘 다 영향을 줬다 | 두 실패 연쇄 가능 | primary/contributing 규칙(R6 ③ — 각각 독립 최소 증거일 때만) 또는 추가 증거 필요 |
| D 잘 모르겠다 | — | 자동 판정 안 함(provisional 유지) |

- 학생 자기보고 하나로 verified diagnosis 를 만들지 않는다 — attempt 단위 Error Cause 증거일 뿐이다(코드북 §2: 자기 분류는 증거가 아니라 주장 — probe 도 같은 위상으로, 다른 증거와 같은 방향일 때만 판정을 바꾼다).
- 질문에 코드 이름 · 「단어 문제 / 추론 문제」 같은 범주어를 쓰지 않는다(유도 방지).

## 5. Pilot 프로토콜(설계)

| 항목 | 내용 |
|---|---|
| 목적(연구 질문) | **추가 과정 증거(해석 + probe)를 받으면 V.wrong_sense 와 R.inference 를 안정적으로 구별할 수 있는가?** |
| 대상 | 실제 학생 attempt(규모 · 모집은 별도 결정) — 문항 원문이 DB 에 있는 읽기 문항만(듣기 · 도표 제외) |
| 판정 | 같은 Claude × Codex 절차(1차 · 반대검증 · Final · 봉인), seed 코드북 + provisional 경계 규칙. 이전 회차 결과는 판정자에게 주지 않는다 |
| 경계 별도 집계 | 경계 만남 수 · probe 발생 수 · 응답 분포(A/B/C/D/건너뜀) · probe 전 결과 · probe 후 결과 · Claude/Codex 일치 변화 · multiple/insufficient 감소 · V/R 분리 가능률 |
| 판정 규칙 | 같은 attempt 를 probe 전 증거 · probe 후 증거로 각각 판정해 비교(전후 비교가 핵심 지표) |
| 사람 검증 | 필수 게이트 아님. Pilot 의 개선된 증거에서도 반복적으로 갈리거나 Claude/Codex 가 체계적으로 갈리거나 처방 차이가 커 높은 확인이 필요할 때 좁게 설계 |
| R6 개정 | rev4.4 금지 — 다음 R6 변경은 Pilot 증거 결과만 근거로 |

## 6. 다음 승인이 필요한 것(순서)

1. 데이터 모델 변경(2의 표) — 마이그레이션 SQL 을 보여 드리고 승인 후 적용.
2. 학생 증거 수집 UI(해석 입력 · probe) — 별도 설계 · 구현.
3. conditional seed DB 적용 — 별도 승인.
4. Pilot 대상 · 규모 · 기간 결정.

## 보존

rev3 · rev4 · rev4.1 · rev4.2 · rev4.3 결과, C4-11 회차별 결과, HA · R4-H1 판정 갈림, 모든 adjudication 은 그대로 둔다. 기대 판정 · 결과를 덮어쓰지 않는다.
