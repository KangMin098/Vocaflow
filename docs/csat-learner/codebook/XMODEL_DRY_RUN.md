# Cross-Model Blind Dry Run — 절차 (Claude Code × Codex 4중 교차검증, 2026-10-04)

> **사람 판정이 아니다.** 판정자는 Model Reviewer A(Claude Code) · Model Reviewer B(Codex)다. 결과는 **cross-model agreement** 이며 human reliability · human agreement · 사람 검증이라고 부르지 않는다.
> 목표는 「정확도 100%」가 아니라 **다중 독립 판정과 반대 검증을 통한 고신뢰 판정 체계** — 잘못된 자동 확정을 줄이고, 갈리는 사례는 `UNRESOLVED` 로 남긴다(실패가 아니라 안전장치).
> 사람 판정자 절차([HUMAN_DRY_RUN.md](./HUMAN_DRY_RUN.md))는 「향후 필요 시 human validation」 단계로 보존한다.

## 단계(로드맵)

```
rev3 candidate → cross-model 4중 검증(이 문서) → v0.1 seed candidate → 실제 학생 Pilot(실제 분포 · coverage · insufficient 비율) → 필요 시 human validation → v0.1 operational
```

통과해도 「사람이 같은 방식으로 판정한다」 · 「taxonomy 가 인간 판정으로 검증됐다」 · 「psychometrically validated」 를 주장하지 않는다. 통과의 뜻: **rev3 의 주요 경계를 서로 다른 두 모델이 독립 context 에서 재현했고, 반대가설 검증을 견뎠다**(high-confidence model reproducibility evidence).

## 고정값

코드북 rev3 `d19e04e8c70e…` · 말뭉치 `human-v1` 56건 · 연습 10건 · 기대 판정 봉인 `d662da16281d…`(최종 판정 봉인 뒤에만 연다) · 도구 `scripts/csat/error-evidence/codebook/xmodel.mjs`.

## 격리(blind 의 조건)

| | Claude(A1 · A2 · Final-Claude) | Codex(B1 · B2 · Final-Codex) |
|---|---|---|
| 실행 | `claude -p --tools ""` — 도구 전부 끔 · `--setting-sources ""`(설정 · 훅 미적재) · `--strict-mcp-config`(MCP 없음) · 세션 미저장 | `codex exec --ignore-user-config --ephemeral -s read-only` |
| 폴더 | 저장소 밖 실행 폴더의 단계별 하위 폴더(`a1/` · `a2/` …) — 다른 단계 결과와 분리 | 같음 |
| 감사 | `num_turns` = 1 이어야 한다(누락도 거부) | 허용 목록 — 이벤트는 thread/turn/item 종류만, item 은 `agent_message` · `reasoning` 만. 파싱 실패 · 알 수 없는 이벤트 · `turn.completed` 누락 = **누출 의심으로 결과를 버린다** |
| 문맥 | 단계마다 새 프로세스 = 새 context · 개발 대화 이력 없음 | 같음 |

- 실행 전 확인(2026-10-04): 두 엔진 모두 같은 설정에서 저장소 파일 읽기를 시켜 `NO_ACCESS` · 도구 이벤트 0.
- **한계**: Codex 의 `read-only` 샌드박스는 디스크 읽기 자체를 막지는 않는다 — 막는 것은 「명령을 실행하면 이벤트로 남는다」는 감사다. 완료 단계 재감사(허용 목록 기준): train-b · b1 · b2p 실행마다 이벤트 4개(시작 · 턴 · 메시지 · 완료)뿐, 명령 · 파일 이벤트 0. Claude 단계 전부 `num_turns=1`.
- 판정자에게 주는 것: 문항(발문 · 지문 · 선지 · 정답) · 학생 과정 증거 · 코드북 rev3 전문 · 연습 10건과 해설. **주지 않는 것**: 저장소 · CASES.md · 기대 판정 · 숨김 필드(true_mechanism · chain · evidence_design · boundaries) · 이전 모델 dry run · 다른 판정자 결과 · 모델 이름.
- 원래 사례 id(`C2-02` · `H-13`)는 출처 회차를 드러내므로 실행마다 불투명 id(`K01`…)로 바꾼다(대응표는 운영자 폴더에만).
- 모델 버전 기록: Claude `claude-opus-5-5`(CLI 2.1.289) · Codex `gpt-6.1-sol`(reasoning high, CLI 0.160.0).

## 지시 설계를 유지한 점(리뷰 지적과 다름 — 사용자 판단 대상)

- 반대검증자에게 **자기(같은 모델 · 별도 context) 사전 독립 판정**을 함께 준다 — 사용자 지시의 Step 1 → 2 순서. 다른 판정자 결과는 주지 않는다.
- open-set 2건은 패킷 형식이 달라 1차가 insufficient 로 갈렸거나 합의했음을 짐작할 수 있다 — 강제 후보를 만들지 않기로 한 사용자 결정(b)의 대가.
- Final 에 네 익명 의견을 그대로 준다 — 같은 판정의 반복 횟수가 보인다. 사용자 설계(익명 A1 · B1 · A2 · B2 + 근거), 다수결 금지를 지시문으로 명시.
- Final 두 판정의 contributing 만 다르면 확정하되 등급 상한 2 — 결과 · primary 가 같으면 원인 판정은 같다고 본다(contributing 은 선택 · 최대 2).

## 연습(training)

사람 절차의 「연습 10건 → 새 세션으로 본 판정」을 모델에 맞게 바꿨다: ① **blind 연습 세션** — 10건을 해설 없이 판정해 점수만 기록(calibration 확인) ② 본 판정 패킷에는 연습 10건을 **해설과 함께** 예시로 넣는다(본 사례와 겹치지 않아 사례별 답이 새지 않는다). 본 판정은 연습 세션과 다른 새 context 다.

## 흐름

| 단계 | 판정자 | 입력 | 출력 |
|---|---|---|---|
| A1 · B1 | Claude · Codex 1차(blind) | 56건 — 판정자마다 다른 순서 · 28 + 28 배치 | 증거 충분성 · outcome · primary · contributing(≤2) · confidence · 후보 · 근거 참조 · 배제 후보 · 규칙 · 짧은 근거 |
| Gate 1 | 운영 스크립트 | A1 · B1 | G1 합의 · G2 같은 family 경계 · G3 family 불일치 · G4 outcome 불일치 — **G1 도 확정이 아니다**, 전부 반대검증으로 |
| A2p · B2p | Claude · Codex 반대검증자의 **후보 없는 독립 판정**(새 context) | 56건 — 1차와 같은 패킷 형식, 다른 순서 | 후보 anchoring 제거 · 같은 모델 재판정 안정성(A1 ↔ A2p) 측정 |
| A2 · B2 | Claude · Codex 반대검증(새 context) | 사례 + 익명 후보 X · Y(순서 · 표지 사례마다 무작위). 자기 A2p/B2p 판정도 함께 준다(후보와 같은 무게의 가설). 1차가 합의면 Y = 두 판정자가 스스로 가장 강하게 배제한 경쟁 코드(코드북 밖 정보 없음). **insufficient_evidence 로 합의하고 경쟁 후보가 없으면 강제 Y 를 만들지 않는다 — open-set falsification**: 가설 X(증거 부족)를 코드북 전체에서 반증할 대안 Z 를 찾고, Z 의 직접 증거 · 최근접 경쟁 배제를 검사(`insufficient_falsified`) | 후보마다 `minimum_evidence_met` · 포함 증거 · 배제 증거 + 스스로 찾은 가장 강한 대안 Z(같은 시험) · challenge_result · 최종 제안 |
| 4-way | 운영 스크립트 | A1 · B1 · A2 · B2 | 아래 행렬 |
| Final | Claude · Codex 최종 판정(새 context) — **YELLOW · RED 만** | 사례 + 네 판정의 익명 의견(근거 요약 포함 · 다수 표시 없음 · 순서 무작위) | 판정 + `competing_excluded` |
| 봉인 | 운영 스크립트 | | `final.json` sha256 — 그 뒤에만 기대 판정을 연다 |

## 4-way 행렬 — 다수결보다 증거

| 상태 | 조건 | 처리 |
|---|---|---|
| GREEN-A strong consensus | A1 = B1 = A2 제안 = B2 제안, 두 반대검증 모두 그 판정 **하나만** 생존(대안 Z 도 기각) | 자동 확정 |
| GREEN-B independent convergence | A1 ≠ B1 인데 두 반대검증이 같은 판정으로 수렴하고 다른 후보 · 대안을 모두 기각 | 자동 확정 |
| YELLOW-A unresolved objection | 두 반대검증의 제안은 같지만 다른 후보나 대안이 최소 증거를 갖춰 살아남음 — 3:1 이어도 다수결로 확정하지 않는다 | Final |
| YELLOW-B same-family boundary | 반대검증 제안이 같은 family 안에서 갈림 | Final |
| RED-A family conflict | 제안 family 가 다름 | Final |
| RED-B evidence conflict | 제안 한쪽이 multiple_plausible · inconsistent_evidence | Final |
| RED-C evidence insufficient | 제안 한쪽이 insufficient_evidence | Final |

- 판정 순서(코드와 같음): GREEN-A → GREEN-B → RED-C(제안 한쪽이라도 insufficient) → RED-B(multiple · inconsistent) → YELLOW-A(제안 같음) → YELLOW-B(같은 family) → RED-A.
- 생존 = 최소 증거 충족(직접 증거 필수) + 배제되지 않음(배제 증거 필수). 대안 Z 도 정규 판정 구조로 받아 같은 시험을 한다. open-set 반증 여부는 모델의 불리언이 아니라 Z 검사에서 도출한다.
- GREEN 이라도 identified 는 두 반대검증 모두 증거 충분성 A2 이상이어야 한다(Q0) — 아니면 YELLOW-A. 두 제안의 contributing 이 다르면 확정은 하되 등급 상한 `verification_grade_2`.
- Final: 출력도 엄격 검증(identified 는 A2 이상 · 규칙 · 근거 필수 · `competing_excluded` 는 배제 후보 근거 필수). 결과 + primary(또는 후보 조합)가 같으면 `FINAL_VERIFIED`(contributing 이 다르면 등급 상한 2), 다르면 **`UNRESOLVED`**(자동 확정 금지 · 후속: 증거 추가 · 규칙 수정 후보 · 사례 검토 · 향후 사람 검토).

## 검증 등급(시스템 등급 — 판정자 확신도와 다르다)

Learning Map 의 V 축과 섞이지 않게 `verification_grade_N` 이름공간을 쓴다.

| 등급 | 뜻 |
|---|---|
| `verification_grade_4` | GREEN-A 로 identified — 반대가설까지 배제 |
| `verification_grade_3` | GREEN-B 로 identified, 또는 Final 두 판정이 같고 둘 다 경쟁 후보를 배제(`competing_excluded`) |
| `verification_grade_2` | 판정은 수렴했지만 경쟁 후보를 완전히 제거하지 못함, 또는 원인을 하나로 확정하지 않는 결과(multiple_plausible · inconsistent_evidence) |
| `verification_grade_1` | UNRESOLVED |
| `verification_grade_0` | insufficient_evidence · unsupported_stimulus 로 수렴(판정 불가가 합의된 것) |

## 기대 판정 · 이전 dry run

- 기대 판정은 정답이 아니다. **모델 합의가 기대와 다른 사례**는 기대 작성 오류 · 사례 구성 문제 · 코드북 규칙 문제 · **두 모델의 공통 편향**을 모두 후보로 둔다. 기대에 맞추려고 판정을 고치지 않는다.
- 이전 1 · 2회차 모델 dry run 은 개발 자료다 — 합산하지 않고, 반복 충돌 쌍이 겹치는지만 비교한다.

## 불일치 분류(adjudication)

blind 출력은 고치지 않는다. 분류: `model_interpretation_error` · `rule_gap` · `evidence_gap` · `case_problem` · `taxonomy_overlap` · `missing_cause` · `possible_shared_model_bias`.

## 핵심 KPI

critical error(최종 판정이 명백한 코드북 규칙과 모순) 0 · blind leakage 0 · 증거 없는 자동 확정 0 · unresolved 는 낮게 하되 0 을 강제하지 않는다. 내부 screening(1차 cross-model): family ≥ 0.80 · primary ≥ 0.70 · insufficient_evidence ≥ 0.80 — 탐색용이며 자동 seed 근거가 아니다. 반대검증 결과는 한 수치로 뭉치지 않는다 — **hard reversal**(합의안이 최소 증거 미충족 · 다른 후보만 충족) · **plausibility expansion**(합의안도 충족하지만 다른 후보도 충족 → 초기 판정이 지나치게 확정적) · **insufficient falsification**(open-set 사례). 함께 보고: G1 유지율 · A2 ↔ B2 일치 · 공격에 취약한 코드 · evidence adequacy 변화 · Claude/Codex 반대검증자 차이. confidence 는 모델별 보정이 달라(1차에서 Codex low 0회) 등급 산정에 쓰지 않는다.

## 무결성 장치

실행 폴더는 실제 경로 기준으로 `C:/vf-xmodel` 아래 · 저장소 밖만 허용 · 단계 결과는 현재 패킷 · 코드북 해시와 누출 감사 0 에 결속(다르면 거부) · 기대 판정 파일은 봉인 전 어떤 단계에서도 읽지 않는다(사전 등록 해시만 기록, 보고 단계에서 처음 읽으며 해시 검증) · 봉인은 한 번만 — 봉인 뒤 준비 · 실행 · 후보 생성 · 해결 · 재봉인 거부.

## 산출물

원문 · 판정 원본 · 대응표: 저장소 밖 실행 폴더에만. 저장소: 집계 보고 `XMODEL_RESULT.md` · `XMODEL_RESULT.json`(사례 id · 판정 코드 · 상태만, 원문 없음).

## 진행 중 금지

codebook rev3 · 사례 · 기대 판정 · Learning Map · Evidence Anchor 변경, taxonomy seed, outcome 마이그레이션, Gold tagging, push/PR. 한 회차가 끝난 뒤에만 수정 여부를 정한다.
