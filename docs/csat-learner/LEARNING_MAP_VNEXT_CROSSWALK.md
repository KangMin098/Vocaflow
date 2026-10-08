# 학습 지도 vNext — 대응표(crosswalk) rev2.1 (2026-10-04 · 설계안)

> 본문: [LEARNING_MAP_VNEXT.md](./LEARNING_MAP_VNEXT.md). 실측 기준: 개발 DB `csat_map_node`(72) · `csat_map_task`(162) · `csat_dx_item_attribute` · `lib/csat/map/core.ts`.
> **이 표는 제안이다.** 시드 · 라인 · 과제 · DB 행을 바꾸지 않았다.
> **데이터 보존 ≠ 개념 보존**(rev2): DB 행은 지우지 않아도 된다. 그러나 의미가 없는 legacy 개념을 vNext ontology 에 계속 살려 두지 않는다 — 「모든 항목을 어딘가에 보존하다가 결국 다시 모든 것을 모은 지도」가 되지 않게.

## A. A1–A9 → 축 · 하위 능력 후보

| 지금 | 지금 핵심 카드 | vNext | 하위 능력 후보 | 상태 |
|---|---|---|---|---|
| A1 어휘 | V | V | V1 · V2 · V3 · V4 | retain_core(정의를 「어휘 · 표현 의미」로 넓힘) |
| A2 구문 | S | S | S1 · S2 · S3 · S4 → S-O1 | retain_core |
| A8 어법 | S | S | S5(형태 · 범위) | retain_core — S 의 원자 하위 능력 S5 로(어법 **문항**은 Question Lens B9) |
| A3 논리 흐름 | R | R | R1 · R2 · R3 · R4 | retain_core — 「흐름」이 참조 · 관계 · 기능 · 구조로 나뉨 |
| A6 배경지식 | R | **K(축 밖)** | — | move_layer → Knowledge / Context Resource. 숙달 막대 · 목표 · 부족 판정 · 카드 없음. **지금 R proxy 계산(A3 + A6)은 legacy proxy only 로 유지** — 계산 변경은 별도 승인 |
| A4 재진술 | E | V · R · E 가로 | V4 · R2(restatement facet) · E3(semantic_equivalence) | retain_as_facet — paraphrase 세 층(본문 §8). 단일 능력으로는 retire |
| A5 근거 판단 | E | E | E1 · E2 · E3 → E-O1 | retain_core |
| A7 듣기 해독 | L | L | (v0.2 에서) | retain_core — 데이터 없음 |
| A9 속도 · 지구력 | X | X | X4 Attention/Stamina → X-O1 · 「속도」는 가로 측정 차원(fluency · latency) | retain_core |

> 지금 문항 태그 A1–A9 는 전부 `type_default`(유형 상속) — 이 대응을 바꿔도 하위 능력 근거는 생기지 않는다. 하위 능력 표시는 Evidence Anchor(본문 §17-2) → 문항 단위 태깅 이후.
> 지금 핵심 카드 R 은 A3 + A6 를 합쳐 계산한다(`core.ts`). vNext 에서 A6 를 K 로 내리면 R 카드의 근거에서 빠진다 — **계산 변경은 구현 단계에서 별도 승인**(지금 화면 · 계산은 그대로).

## B. 라인 54개 — 상태와 목적지

상태 5종:
- `retain_core` — vNext 축 · 하위 능력으로 남는다
- `retain_as_facet` — 능력이 아니라 facet · 속성으로 남는다
- `move_layer` — 개념은 유효하지만 다른 층(Question Lens · Item Feature · Pedagogy · Goal/Route · X · Context)으로 옮긴다
- `legacy_alias` — vNext 에서는 다른 개념의 별칭으로만 남는다(옛 화면 · 데이터를 읽기 위한 대응)
- `retire_from_vnext` — vNext ontology 에서 개념으로 쓰지 않는다(DB 행은 보존 가능)

| 라인 | 상태 | 목적지 · 이유 |
|---|---|---|
| A1–A9 | §A | |
| B1 듣기 대의 · B2 듣기 세부 · B3 듣기 계산 · B4 듣기 응답 · B5 듣기 세트 | move_layer | Question Lens(듣기) — 능력이 아니라 「어디서 관찰되나」. L 진단과 동일시하지 않는다 |
| B6 독해 대의 · B7 함축 의미 · B8 세부 정보 · B9 어법 · 어휘 · B10 빈칸 추론 · B11 흐름 · B12 요약 · B13 장문 | move_layer | Question Lens(독해). 유형 성과를 축 숙달로 읽지 않는다 |
| C1 단어 재활용 · C2 핵심 아님 · C3 부분을 전체로 · C4 인과 전도 · C5 범위 · 강도 변형 · C6 방향 반대 · C7 상식 개입 | move_layer | Item Feature(선지 함정, `C.*` namespace). E3 facet 과 어휘가 대응돼도 학생 능력으로 승격하지 않는다 — 「C 선지를 골랐다 → E3 facet 이 약하다」 금지 |
| C8 비유 선지 | legacy_alias | 대응 key 0(오답 원인 설계 §4-1) — 사례가 생기면 다른 C 계열로 들어가는지 본다. 독립 개념으로 키우지 않는다 |
| **D1 선지에 끌림** | **retire_from_vnext** | 너무 포괄적. 실제 증거가 있으면 오답 원인 `B.surface_match` · `B.no_verification` · `E.option_mismatch` 등으로 **분해**한다 |
| **D2 추측 풀이** | **retire_from_vnext** | 원인이 아니다(코드북이 `B.guess` 를 지운 원칙). 추측했다는 사실은 확신도 · 증거 부족 · 행동 관찰로 기록할 수 있으나 원인 · 능력으로 쓰지 않는다 |
| D3 상식 판단 | legacy_alias | 오답 원인 `B.outside_knowledge` 와 **관련**되지만 같은 객체가 아니다. 옛 화면 대응용 별칭 |
| **D4 해석은 되는데 틀림** | **retire_from_vnext** | 원인이 아니라 상태 묘사. 정확한 원인을 찾는 **진단 시작점**으로만 쓸 수 있다 |
| D5 시간 붕괴 | move_layer | X(X1 Time Allocation · X4 Attention/Stamina) |
| D6 오답 분석 없음 | move_layer | Pedagogy(Task · Method — 공부 습관). 학생 능력 아님 |
| **D7 90점 커트라인 전략** | **retire_from_vnext** | 학생 능력이 아니고, vNext 의 어느 층(Goal/Route 포함)에도 개념으로 두지 않는다. 옛 화면 · 데이터를 읽는 대응표에만 남는다 |
| D8 EBS 암기 의존 | move_layer | Pedagogy / Study Strategy |
| D9 듣기 소홀 | move_layer | 학습 배분 · 노출 · route 문제(Pedagogy · Goal/Route). **L 숙달과 동일시하지 않는다** |
| I1 기출 분해 | move_layer | Pedagogy — 기출 분석 Protocol(본문 §13)의 집 |
| I2 문장 풀어쓰기 · I3 오답 원인 분류 · I4 실전 모의고사 운영 · I5 EBS 논지 요약 · I6 어휘 간격 반복 · I7 받아쓰기 · 쉐도잉 · I8 주제별 묶음 읽기 · I9 셀프 설명 · I10 예상 답 먼저 쓰기 | move_layer | Pedagogy(처방 모듈). 「라인」으로 진단하지 않는다 |
| J1 시간 배분 | move_layer | X1 Time Allocation |
| J2 풀이 순서 | move_layer | X2 Sequence |
| J3 난이도 변동 대응 | move_layer | X3 Recovery / Adaptation |
| J4 시험 불안 | move_layer | **Performance Context**(정서 · 상황 맥락) — X 가 아니다. 숙달 막대 없음 |
| J5 컨디션 · 집중 | move_layer(분리) | 「집중 유지」 → X4 Attention/Stamina · 「당일 컨디션」 → Performance Context |

**집계(라인 54)**: retain_core 7(A1 · A2 · A3 · A5 · A7 · A8 · A9) · retain_as_facet 1(A4) · move_layer 40(A6 · B1–B13 · C1–C7 · D5 · D6 · D8 · D9 · I1–I10 · J1–J5 — J5 는 X4 와 Performance Context 로 나뉜다) · legacy_alias 2(C8 · D3) · retire_from_vnext 4(D1 · D2 · D4 · D7). 7 + 1 + 40 + 2 + 4 = 54.

**retire_from_vnext 의 뜻**: DB 행 · 과제 · 옛 스냅샷은 지우지 않는다. vNext 화면 · 진단 · 문서에서 그 이름을 개념으로 쓰지 않고, 필요하면 대응표로만 읽는다. 과제 162개는 라인 상태를 따라 재배치를 검토하되 **이번에는 바꾸지 않는다**.

## C. 오답 원인 rev3 → 「다음 진단 후보」(**1:1 대응 아님**)

> ⚠ 아래 「진단 후보」는 원인이 **확인(attempt 단위 `cause_adjudicated` · student × axis 누적 근거 `cause_confirmed` — 본문 §10-1)** 됐을 때 파생 **Diagnostic Priority Signal** 이 가리키는 **다음에 직접 확인해 볼 하위 능력**이다. 원인 확인만으로 그 능력의 상태를 바꾸지 않는다. 학습 지도 상태는 `verified_diagnosis` 만 바꾼다. 이름이 비슷해도 같은 객체가 아니다(본문 §10 · §10-1).
> 오답 원인 taxonomy(rev3)는 사람 dry run 을 위해 고정돼 있다 — 이 표는 rev3 를 바꾸지 않는다. 사람 판정 결과가 나온 뒤 이 대응을 다시 본다(두 ontology 를 동시에 바꾸지 않는다).

| rev3 원인 | 다음 진단 후보 | 비고 |
|---|---|---|
| `V.unknown_word` | V1 | |
| `V.wrong_sense` | V2 | |
| `V.multiword` | V3 | |
| `S.core_structure` | S1 · S2 · S4 | |
| `S.attachment` | S3 | rev3 에서 관찰 대기 코드 |
| `S.operator_scope` | S5 | |
| `S.form_rule` | S5 | |
| `R.reference` | R1 | |
| `R.relation` | R2(relation facet 기록) | |
| `R.main_point` | R5 Central Meaning | |
| `R.inference` | R6 Inference | |
| `E.task_misread` | E1 | |
| `E.evidence_location` | E2 | |
| `E.option_mismatch` | E3(judgment facet 기록) | 「E3 mastery 가 낮다」로 바꾸지 않는다 |
| `B.outside_knowledge` · `B.surface_match` · `B.no_verification` | **풀이 절차(행동) 진단 후보** — 축 하위 능력 아님 | 같은 행동이 반복되는지 직접 확인하는 진단 후보까지만. 과제 · 처방은 그 진단이 검증된 뒤. `B.outside_knowledge` 는 K(배경지식 자원)와 다른 객체다 |
| `X.time` | X1 · X2 | **의미상 대응만** — `cause_adjudicated` 까지만, Priority 자동화 없음(본문 §10-1: §9 대상 아님 · 시간 데이터 0 · 실행 근거 모델 뒤 별도 설계) |
| `X.attention` | X4 | **의미상 대응만** — Priority 자동화 없음(같은 이유) |
| 결과 `insufficient_evidence` · `multiple_plausible` · `inconsistent_evidence` | 없음 | 진단 후보를 만들지 않는다(multiple_plausible 은 후보들을 「구별 진단」으로 제안할 수 있다 — 구현 때 결정) |

- 우선순위 규칙(안): 독립된 시도에서 같은 원인이 검수 통과(§9 「코드 확인」)로 여러 번 확인될수록 그 진단 후보의 우선순위를 올린다 — **V · S · R · E 원인에만**. X 원인은 별도 결정까지 의미상 대응으로만 표시하고, B 원인은 축 · 하위 능력 후보를 움직이지 않는다. 몇 번 · 가중치 같은 수치는 오답 원인 사람 dry run · Pilot 뒤에 정한다(지금 정하면 근거 없는 상수다).
