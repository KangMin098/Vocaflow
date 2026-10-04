# 학습 지도 vNext — 정보 구조 설계 (2026-10-04 · 설계안 · 미구현)

> 상태: **설계 문서만.** DB · 마이그레이션 · mastery 계산 · UI 변경 없음. 지금 화면(Phase 1 핵심 지도 · rule_proxy 관찰)은 그대로다.
> 오답 원인 Evidence(코드북 rev3 · 사람 dry run 준비)와 **독립 작업**이다 — rev3 · 사례 · 기대 판정 · 판정 도구 · 해시를 바꾸지 않는다.
> 짝 문서: [LEARNING_MAP_VNEXT_CROSSWALK.md](./LEARNING_MAP_VNEXT_CROSSWALK.md)(지금 72노드 · 54라인 · A1~A9 · rev3 원인 코드와의 대응).

## 0. 한 줄 결론

학생이 보는 축은 **V · S · R · E · L + X 그대로** 둔다. 「어휘 → 문장 → 관계 → 구조 → 핵심 → 선지 → 실전」은 새 영역이 아니라 이 축들을 **가로지르는 Learning Progression(LP1–LP7) 겹층**이다. 둘을 같은 계층의 노드로 만들지 않는다.

## 1. 지금 구조 — 유지할 것과 문제

**실측(2026-10-04, 개발 DB)**

| 항목 | 값 | 뜻 |
|---|---|---|
| 지도 노드 | 72 = 목표 1 · 축 6(A · B · C · D · I · J) · 라인 54 · 원리 8 · 트랙 3 | |
| 라인 | A 9 · B 13 · C 8 · D 9 · I 10 · J 5 | 성격이 다른 것(역량 · 문항 유형 · 선지 함정 · 습관 · 공부법 · 시험 운영)이 같은 「라인」 층에 있다 |
| 과제 | 162 = 라인 54 × 3(ord 1–3) | 라인마다 과제 3개. 단계(찾기 · 고치기 · 옮기기 · 확인) 구분은 없다 |
| 문항 역량 태그(`csat_dx_item_attribute`) | A1 1,416 · A2 1,577 · A3 2,530 · A4 1,588 · A5 1,184 · A6 779 · A8 129 · A9 1,063 · **A7 0** — **전부 `source=type_default`, 관리자 수정 0 · 검수 0** | 문항 유형에서 상속한 값이다. **문항 단위 하위 능력 정보는 지금 0** |
| 선지 함정(`csat_dx_option_trap`) | 847문항 · 3,387행 | 문항 쪽 특성(C) |
| 핵심 지도 대응(`lib/csat/map/core.ts`) | V=A1 · S=A2+A8 · R=A3+A6 · E=A4+A5 · L=A7 · X=A9 | 지금 핵심 카드의 근거 |
| 문항 | 3,714(본문 온전 3,329 → 같은 날 재실측 3,347 — 다른 작업이 갱신 중) | |

**유지**: V/S/R/E/L + X 핵심 카드 · DiagnosisBasis 3단계(rule_proxy · item_tagged · verified_diagnosis) · 관찰 수준 표현(관찰 낮음/중간/높음 · 진단 근거 부족 · 데이터 없음) · Record Quality Guard · B(문항 유형) · C(선지 함정)를 역량과 분리한 것.

**문제**
1. 라인 54개가 서로 다른 종류(역량 · 유형 · 함정 · 습관 · 방법 · 운영)인데 같은 층에 있다 — 학습자에게 「54개 세부 항목 지도」로 읽힌다.
2. A4 「재진술」 · A6 「배경지식」처럼 **여러 축을 가로지르는 기능**이나 **지식 자원**이 역량 라인 하나로 서 있다.
3. 「핵심 문장 찾기」 · 「연결어 표시」 같은 **방법 · 단서**가 라인 · 과제 이름에 섞여 역량처럼 보인다(예: A3 과제 「연결어 방향 표시」).
4. 문항 태그가 유형 상속뿐이라 세부 능력을 보여 줄 근거가 없다 — 세부 표시를 늘리면 근거 없는 수치가 된다.

## 2. 축 정의(Domain Map)

| 축 | 내부 이름 | 학생 표시명 후보 | 정의 | 바뀐 점 |
|---|---|---|---|---|
| V | Lexical-Semantic Processing | 어휘 · 표현 의미 | 낱말 · 표현에서 문맥에 맞는 의미를 얻는 처리. 암기량이 아니다 | 「어휘」 → 「어휘 · 표현 의미」(다의 · 덩어리 · 의미 관계 포함) |
| S | Sentence Processing | 문장 이해 | 영어 문장의 구조를 써서 **하나의 의미 명제를 구성**하는 처리. 문법 표지가 목적이 아니다 | 「문장해석」 → 「문장 이해」. 어법(A8)도 여기 |
| R | Discourse Comprehension | 글 이해 | 문장들을 참조 · 관계 · 기능 · 위계로 이어 글 전체의 의미 모델을 구성 | 「독해」 → 「글 이해」. 키워드 · 핵심 문장 찾기가 아니다 |
| E | Evidence Judgment | 근거 · 선지 판단 | 글의 의미를 발문 · 선지와 대응시켜 고르고 버리는 판단 | R(글 이해)과 분리 유지 |
| L | Listening | 듣기 | 음성을 실시간으로 의미로 바꾸는 처리 | 변화 없음 — 데이터 없음 유지 |
| X | Timed Performance | 실전 | 위 처리를 시간 · 순서 · 집중 조건에서 안정적으로 수행 | 자동화 · 유창성의 관찰 자리 |

## 3. 축별 하위 능력 후보(candidate — mastery 노드 아님)

> 이 목록은 **나중에 문항 태깅 · 직접 진단을 설계할 때의 후보 어휘**다. 지금은 측정도 표시도 하지 않는다(§14 · §16). §21 자기 검토에서 다른 능력의 결과에 불과한 것은 「통합 관찰」로 내렸다.

### V — 어휘 · 표현 의미
| | 후보 | 비고 |
|---|---|---|
| V1 | Core Meaning — 기본 의미 접근 | |
| V2 | Contextual Sense — 문맥에 맞는 다의 의미 선택 | |
| V3 | Multiword / Collocation — 구 · 숙어 · 연어를 한 의미 단위로 | |
| V4 | Semantic Relation — 유의 · 반의 · 상하위 · 의미 동등성 | lexical paraphrase(§8)가 여기 |

### S — 문장 이해
| | 후보 | 비고 |
|---|---|---|
| S1 | Sentence Core — 주어 · 서술어 · 목적어 · 보어 | |
| S2 | Chunk / Boundary — 구 · 절 · 의미 단위 경계 | |
| S3 | Modification / Attachment — 무엇이 무엇을 꾸미나 | |
| S4 | Structural Relation — 병렬 · 종속 · 삽입 · 생략 · 도치 | |
| S5 | Form / Scope — 문법 형태, 부정 · 비교 · 조건 · 양보의 의미 범위 | 어법(A8)이 주로 여기 |
| S6 | **Proposition — 「무엇이 무엇에 대해 무엇을 말하나」 구성** | **S 의 통합 관찰 지점**(S1–S5 의 결과). 별도 숙달도로 세지 않는다 — §21 Q1 |
| (S7) | Sentence Information Hierarchy — 문장 안 핵심 vs 부가 정보 | **S6 에 흡수 후보** — 문장 안 위계는 명제 구성의 일부이고, 글 수준 위계(R5)와 이름이 겹친다 |

### R — 글 이해(가장 크게 바뀜)
R 의 중심은 **관계 → 구조 → 중심 의미**다.

| | 후보 | 비고 |
|---|---|---|
| R1 | Reference / Cohesion — 대명사 · 지시어 · 같은 개념의 연결 추적 | |
| R2 | Local Semantic Relation — 인접 · 관련 문장 사이 의미 관계 구성 | 관계 종류는 **facet**(§7) — 「인과 70% · 대조 80%」 같은 축을 만들지 않는다 |
| R3 | Paragraph Function — 문장 · 문단이 글에서 하는 일 | 기능 어휘는 **새로 만들지 않고 기존 출제 설계 주석의 역할 9 를 쓴다**(topic · support · example · turn · concession · conclusion · background · speech_act · closing — §17-1). 제안 원문의 claim · reason · evidence · example · elaboration · contrast · objection · transition 은 이 9 개로 대응된다(claim=topic, reason · evidence · elaboration=support, contrast=turn, objection=concession, transition=turn) |
| R4 | Discourse Structure — 기능 · 관계를 이어 전개 구조 구성 | 구조 어휘는 기존 **패턴 9**(myth_rebuttal · general_specific · problem_solution · contrast · cause_effect · study_implication · request_letter · narrative · other) |
| R5 | Information Hierarchy / Centrality — 중심과 부연 구별 | |
| R6 | Theme / Central Claim — 글 전체가 결국 말하는 것 | R5 와 가깝다 — 사람 진단에서 갈리지 않으면 합친다 |
| R7 | Inference — 쓰이지 않은 의미를 글 근거로 도출 | |
| (R8) | Global Meaning Model — 글 전체의 일관된 의미 모델 | **R 의 통합 관찰 지점**(R1–R7 의 결과). 별도 숙달도로 세지 않는다 |

### E — 근거 · 선지 판단
| | 후보 | 비고 |
|---|---|---|
| E1 | Task Demand — 발문이 요구하는 것 | |
| E2 | Evidence Location — 판단에 쓸 글 근거 특정 | |
| E3 | Semantic Correspondence — 글과 선지가 같은 의미인가 | option paraphrase(§8 — 정답 쪽 변환 어휘는 기존 **변환 8**: abstraction · paraphrase · negation_flip · perspective · speech_act_verb · compression · inference · none) · **대응 facet**: scope(일부/전체) · strength(may/often/always) · polarity(긍정/부정 · 방향) · relation consistency(인과 · 비교 · 조건 유지) |
| (E8) | Selection / Elimination | **통합 관찰 지점**(E1–E3 의 결과) |

> 제안 원문은 E4 Scope · E5 Strength · E6 Polarity · E7 Relation Consistency 를 각각 능력으로 두었다. 이 문서는 **E3 의 facet 으로 내렸다** — 네 가지는 선지 함정(C)의 왜곡 방식과 같은 축이라 능력 노드로 두면 「C 함정 계열 = 학생 능력」으로 다시 섞인다(§21 Q2 · Q3). 오답 원인 코드북 rev3 도 같은 이유로 `E.option_mismatch` 하나에 facet 을 묶었다.
> R 과 E 는 합치지 않는다: R 은 「A → B 관계를 이해했나」, E 는 「선지가 그 관계를 B → A 로 뒤집었는지 가렸나」.

### L — 듣기
지금 후보를 정하지 않는다 — 대본 · 음성 · 막힌 시점 증거가 없다(오답 원인 코드북 §8 과 같은 이유). v0.2-listening 연구에서 정한다.

### X — 실전
| | 후보 | 비고 |
|---|---|---|
| X1 | Processing Fluency — 정확도를 유지하며 처리하는 속도 | 자동화 · 유창성이 **시간 조건에서 관찰되는 자리**(§4) |
| X2 | Time Allocation — 문항 · 영역 시간 배분 | |
| X3 | Sequence — 풀이 순서 | |
| X4 | Recovery — 막힘에서 빠져나오기 | |
| X5 | Attention / Stamina — 집중 유지 · 후반 안정성 | |
| (X6) | Whole-Test Stability | **X 의 통합 관찰 지점**(X1–X5 의 결과) |

X 는 영어 지식 · 독해 능력과 분리한다. 「시간 부족」은 X 의 관찰이지 V/S/R/E 의 낮음이 아니다.

## 4. 자동화 · 유창성 — 능력 노드가 아니라 가로 차원

「V 자동 인출」「S 자동 해석」은 노드로 두지 않는다. 모든 축의 처리는 **accuracy · fluency · latency · stability** 차원을 가질 수 있다. 지금은 숫자로 만들지 않는다 — 문항별 시간을 담을 구조(`csat_session_attempts.sec` + 수집 API)는 **있지만 유효 데이터가 0**이다(2026-10-04 실측: 문항 기록 1행 · 그 시간 0초, 시험 기록 2회의 `total_minutes` 모두 NULL). 시간 제약에서 드러나는 통합 수행은 X 에서 관찰한다.

## 5. Learning Progression(LP1–LP7) — 겹층

| LP | 이름 | 처리 단위 | 주 축 |
|---|---|---|---|
| LP1 | Lexical Access | 낱말 · 표현 → 의미 | V |
| LP2 | Sentence Proposition | 문장 구조 → 핵심 명제 | V + S |
| LP3 | Local Coherence | 두 문장 이상의 참조 · 관계 | S + R |
| LP4 | Paragraph / Discourse Structure | 관계들 → 문단 · 글 구조 | R |
| LP5 | Central Meaning | 중심 · 부연 구별, 주제 · 주장 재구성 | R |
| LP6 | Evidence Judgment | 글 의미 ↔ 발문 · 선지 | R + E |
| LP7 | Timed Integration | 위 과정을 시간 제약에서 안정적으로 | V/S/R/E + X |

- **LP 는 mastery 노드가 아니다.** 학생 화면에 LP 7개의 퍼센트를 표시하지 않는다.
- 쓰임: 과제 · 지문의 난이도 설계, 진단 순서 제안, 설명 문구(「지금은 문장 단위를 단단히 하는 시기」)의 근거.
- 공식 근거와의 관계: 평가원 최소 성취수준 자료(ORM 2024-79-3)는 이해 성취기준을 세부 정보 → 주제 · 요지 → 논리적 관계 · 구조 → 의도 · 함축 추론의 **위계**로 설명하고, 「문장 구조 분석에 어려움」이면 의미 단위 끊어 읽기 → 문단 구조로 지도하라고 한다(코드북 [SOURCES](./codebook/SOURCES.md) A3). LP 순서는 이와 어긋나지 않는다. 다만 평가원 자료는 어휘 · 구문 · 담화를 **오류 축**으로 나누지 않는다 — LP 를 공식 분류라고 쓰지 않는다.

## 6. 선수 관계 — hard lock 없음, dominant dependency

- 「V 완료 → S 해제 → R 해제 → E 해제」 같은 잠금을 쓰지 않는다. 학습은 나선형으로 겹친다(초등생도 because · but · for example 의 단순 관계를 배운다).
- 대신 `dominant_dependency`: V · S 가 매우 불안정하다는 **검증된** 근거가 있으면 고난도 R · E 과제의 **우선순위를 낮춘다**. 잠그지 않는다.
- rule_proxy 단계에서는 이 판단을 하지 않는다(근거가 유형 상속값이라).

## 7. 관계 facet — R2 · E3 의 속성, 독립 축 아님

restatement · example/elaboration · cause/effect · contrast/comparison · condition · general/specific · claim/evidence.

- 문항 태그 · 과제 · 오답 원인 메모에 **속성**으로 붙는다. 「인과 숙달도」 같은 축을 만들지 않는다.
- 같은 facet 이 R2(관계를 이해했나)와 E3(선지가 그 관계를 유지했나)에 모두 쓰인다.

## 8. paraphrase — 세 층에 걸친 개념

| 층 | 어디 | 무엇 |
|---|---|---|
| Lexical paraphrase | V4 | 표현 A 와 B 의 의미 동등성 |
| Discourse restatement | R2(facet restatement) · R3 | 앞에서 한 말을 뒤에서 다르게 다시 말함 |
| Option paraphrase | E3 | 글의 내용을 선지가 다른 표현으로 재구성 |

지금 A4 「재진술」 라인 하나를 이 세 층으로 나눈다. **paraphrase 를 독립 축 · 단일 mastery 노드로 두지 않는다.** 오답 원인 코드북이 `E.paraphrase_match` 를 폐기한 것과 같은 판단이다(「재진술 실패」는 결과 이름이고, 원인은 V · R · E 로 갈린다).

## 9. cue(단서)와 skill 의 구분

however · because 찾기, 반복어 찾기, 질문문 찾기, 핵심어 표시, 예시 표지 찾기 — **능력이 아니라 R 을 수행할 때 쓰는 cue(증거 특징)**다.

| cue | 주로 쓰는 판단 |
|---|---|
| lexical repetition | R1 · R5 |
| contrast marker | R2(contrast) · R3 |
| causal marker | R2(cause/effect) |
| reference expression | R1 |
| example marker | R2(example) · R3 |
| discourse transition | R3 · R4 |

cue 어휘는 기존 출제 설계 주석의 **단서 6**(pronoun · connective · article · time · logic · repetition — §17-1)을 그대로 쓰고, 부족하면 거기에 더한다(예: example marker). 강사의 독해 공식(「두 소재 사이 관계를 한 번은 잡아라」 등)도 이 cue · scaffold 층으로 흡수한다. 특정 강사의 공식을 핵심 지도로 만들지 않는다. **「핵심 문장 찾기」도 능력이 아니다** — 문장 의미 · 관계 · 기능 · 위계 · 중심 주장의 결과이고, 필요하면 R5 · R6 을 관찰하는 진단 과제로 쓴다.

## 10. 오답 원인(Error Cause) ↔ 학습 지도(Skill) — 같은 객체가 아니다

| | Error Cause(rev3 `V.*` · `S.*` · `R.*` · `E.*` · `B.*` · `X.*`) | Skill(이 문서의 V1 · R1 …) |
|---|---|---|
| 무엇 | **한 번의 풀이**에서 확인된 실패 사건 | 여러 시도 · 직접 진단으로 쌓인 능력 상태 |
| 근거 | 그 시도의 과정 증거 | 누적 증거 + 직접 진단 |

**허용되는 연결은 하나뿐**: `cause_confirmed` → `next diagnostic candidate`.
- 예: `R.reference` 원인이 확인됨 → 「R1(지시 · 응집)을 직접 확인하는 진단을 먼저 제안」.
- **금지**: 원인 확인만으로 R1 상태를 「취약」으로 바꾸기. 학습 지도의 진단 상태는 `verified_diagnosis` 만 바꾼다.
- 「`R.reference` 원인이 확인됐다」는 「reference 능력이 낮다」가 아니다. 「다음 진단에서 reference · cohesion 을 먼저 볼 이유가 생겼다」다.
- 이름이 비슷해도 1:1 대응이 아니다(대응 후보표: 짝 문서 §C).

## 11. DiagnosisBasis 별 허용 표현

| 근거 수준 | 표시해도 되는 것 | 금지 |
|---|---|---|
| `rule_proxy`(지금 전부) | V/S/R/E/L/X 상위 카드의 잠정 관찰 · 진단 근거 부족 · 데이터 없음 · 우선 확인 후보 | 세부 하위 능력 숙달도 · 확정 병목 · route 확정 |
| `item_tagged`(문항 단위 태깅 생긴 뒤) | 어떤 세부 능력이 어떤 문항에서 관찰됐는지 · 근거 수 · 근거 품질(출처 · 검수 여부) | mastery 확정 |
| `cause_confirmed`(오답 원인 검수 통과) | 다음 진단 우선순위 | mastery 상태 직접 변경 |
| `verified_diagnosis` | 세부 능력 상태 · route 결정 · 진단 기반 처방 | — |

`cause_confirmed` 는 지금 코드(`DiagnosisBasis = rule_proxy | item_tagged | verified_diagnosis`)에 없는 수준이다 — 축 상태를 바꾸지 않으므로 DiagnosisBasis 값으로 넣지 않고, 「진단 후보 제안」의 입력으로만 둔다(구현 시 별도 결정).

## 12. 최종 정보 구조 — 층을 섞지 않는다

| 층 | 내용 | 지금 어디 |
|---|---|---|
| Learning Map | V · S · R · E · L · X | 핵심 카드 |
| Progression Overlay | LP1–LP7 | (신규 — 표시 없음) |
| Question Lens | B 문항 유형(대의 · 함축 · 빈칸 · 순서 · 삽입 · 요약 …) | 라인 B1–B13 |
| Item Feature | C 선지 함정(선지가 의미를 어떻게 바꿨나) | 라인 C1–C8 · `csat_dx_option_trap` |
| Attempt Evidence | Learner Error Cause(학생이 왜 틀렸나) | `csat_ec_*`(검수 전) |
| Pedagogy | Task · Route · 공부 방법 | 과제 162 · 라인 I1–I10 |
| Rationale | P 원리 | 원리 P1–P8 · 트랙 T1–T3 |

지금 「라인」 층에 함께 있는 D(풀이 습관) · J(시험 운영)의 자리는 짝 문서 §B.

## 13. 기출 분석 Task Protocol — 과제 안의 절차

두 강사 영상에서 공통으로 유효한 부분(「줄거리 이해만으로는 오답 선지를 못 가린다 — 두 소재 사이의 관계를 한 번은 의식적으로 잡고, 그 관계로 선지를 가른다」, 그리고 평가원 학습 안내의 「논리적 관계를 파악해야」)은 **능력 노드가 아니라 기출 분석 과제의 절차**로 흡수한다.

| 단계 | 하는 일 | 주로 쓰는 능력 |
|---|---|---|
| 1 Sentence Meaning | 핵심 문장의 명제를 정확히 | S6 |
| 2 Relation | 문장 사이 관계 확인(facet 기록) | R1 · R2 |
| 3 Structure | 전개 구조 재구성 | R3 · R4 |
| 4 Central Meaning | 필자의 핵심 주장 · 설명 압축 | R5 · R6 |
| 5 Function | 나머지 문장의 역할 설명 | R3 |
| 6 Semantic Correspondence | 정답 선지가 글의 어떤 의미를 재표현했나 | E3 |
| 7 Distortion | 오답 선지가 무엇을 바꿨나(C 함정 계열로 이름 붙임) | E3 + C |

이 7단계를 7개의 mastery 노드로 만들지 않는다.

## 14. FIND → REPAIR → TRANSFER → CHECK

> 저장소에서 이 생애주기 정의를 찾지 못했다(2026-10-04 grep — 지금 과제 162개는 라인마다 ord 1–3 묶음). **이 문서가 처음 정의한다.**

| 단계 | 뜻 | 예: R2 관계가 검증된 학생 |
|---|---|---|
| FIND | 실패 지점을 증거로 찾는다 | 관계가 깨진 기출 위치 확인 |
| REPAIR | 그 지점을 고친다 | 기출 분석 Protocol(§13)로 관계 · 구조 재구성 |
| TRANSFER | 같은 기제를 새 자료에 옮긴다 | 같은 관계 facet 을 가진 다른 기출에 적용 |
| CHECK | 힌트 없이 다시 확인 | 다른 지문에서 독립 확인 |

7단계 Protocol(과제 **안** 절차)과 4단계 생애주기(과제 **사이** 순서)는 다른 것이다.

## 15. 학년별 권장 노출(hard lock 아님)

| 학교급 | 주 노출 LP | 비고 |
|---|---|---|
| 초등 고학년 | LP1 – LP2 | because · but 의 단순 관계(LP3)도 다룬다 |
| 중등 | LP2 – LP4 | |
| 고등 | LP3 – LP7 | |

실제 학생 경로는 진단 근거로 정한다. 「초5 = LP1」 같은 고정 규칙을 만들지 않는다.

## 16. 지금 데이터로 측정할 수 있는 것 · 없는 것

| | 측정 가능 | 측정 불가(이유) |
|---|---|---|
| 축 카드 | 유형 상속 proxy 의 관찰 수준(V · S · R · E · X) | L(듣기 태그 0) |
| 하위 능력 V1–X6 | — | 전부 불가(문항 태그가 `type_default` 뿐 · 관리자 수정 0 · 검수 0) |
| LP | — | 불가(문항 · 지문의 처리 단위 정보 없음) |
| 관계 facet | — | 불가(문장 쌍 · facet 태그 없음) |
| 선지 함정(C) | 847문항의 선지별 함정 | 나머지 문항 |
| 오답 원인 | — | 실제 학생 과정 증거 0(Pilot 미시작) · 기록 2회는 rq-1 제외 |
| 자동화 · 시간 | — | 수집 구조는 있음(`csat_session_attempts.sec` · 시험 `total_minutes`), **유효 데이터 0**(문항 기록 1행 0초 · `total_minutes` 2회 모두 NULL). 답 변경 기록 없음 |
| 문장 좌표 | `csat_item_units` 2,910문항(2,931행 · `units_version` · `input_hash` · `units_hash`) · 조회 `csat_current_units_many` · `csat_current_units_hash` | 본문 온전 3,347 중 **802** 문항은 단위가 없다(같은 날 재실측) |
| 지문 기능 · 구조 · 정답 변환 · 단서(문항 쪽) | 출제 설계 주석 447문항(§17-1) — R3 · R4 · E3 · cue 의 **문항 쪽** 근거 | 나머지 유형 · 문항. 학생 능력 근거는 아니다 |

## 17. 문항 태깅에 필요한 필드(향후 — item_tagged 의 전제)

| 필드 | 대상 | 쓰임 |
|---|---|---|
| 문장 좌표 | 지문 | **새로 만들지 않는다** — 정본 `csat_item_units`(단위 id · `units_version` · 원문 해시 `input_hash` · `units_hash`)와 조회 `csat_current_units_many` 를 쓴다. 모든 태그 · 학생 근거(막힌 곳)가 같은 단위 id + 버전 + 해시에 묶인다(원문이 바뀌면 태그가 무효임을 알 수 있게). 부족분: 본문 온전 문항 중 단위가 없는 802 |
| 표현 대상(target expression) · 종류(다의 · 덩어리 · 의미 관계) | 낱말 · 구 | V2 · V3 · V4 |
| 문장 구조 지점(문법 포인트 · 연산자 범위) | 문장 | S3 · S4 · S5 |
| 문장 쌍 관계(i ↔ j, facet) | 문장 쌍 | R1 · R2 |
| 문장 · 문단 기능 | 문장 · 문단 | R3 · R4 |
| 중심 문장 · 재진술 사슬 | 지문 | R5 · R6 · paraphrase(R) |
| 선지 ↔ 근거 문장 대응 · 대응 facet | 선지 | E2 · E3(왜곡 종류는 C 와 같은 어휘) |
| 발문 요구 종류 | 발문 | E1 |
| 처리 단위(LP 후보) | 문항 | 난이도 설계 · 과제 배치 |
| 출처 · 검수 상태 | 모든 태그 | item_tagged 근거 품질 — 「유형 상속」과 「사람이 단 태그」를 구별 |
| 도표 · 그림 구조화 값 | 도표 문항 | 지금 없음 → 판정 제외 |
| 듣기 대본 · 시점 | 듣기 | L(v0.2) |
| 문항별 시간 · 답 변경 | 응답 | X1 · 자동화 차원 |

### 17-1. 기존 자산 재사용 — 출제 설계 주석(`csat_item_analyses.answer_locus.passage_design`)

2026-10-04 실측: **447문항**(469행) · 키 `roles` · `pattern` · `transform` · `transform_note` · `cues` · `alternatives` · `selection` · `criteria` · `data_defect`. 정본 기준 [design-annotation-criteria.md](./design-annotation-criteria.md) v1.3. 문장 번호는 화면 지문 지도와 같은 분할기의 0-기반 번호.

| 기존 칸 | 값 | vNext 에서의 쓰임 | 부족분 |
|---|---|---|---|
| `roles`(문장마다) | 역할 9 | **R3 기능 어휘 그대로** · R5(topic · conclusion 이 중심) | 주석 유형(목적 · 빈칸 · 순서 · 대의 6 · 삽입 · 무관 문장) 밖의 문항 · 문단 단위 기능 |
| `pattern` | 패턴 9 | **R4 구조 어휘 그대로** | 같음 |
| `transform` · `transform_note` | 변환 8 | **E3 의 정답 쪽 대응(option paraphrase) 어휘** | 오답 선지 쪽은 C(선지 함정)가 맡는다 |
| `cues` | 단서 6(pronoun · connective · article · time · logic · repetition) | **cue 층(§9) 어휘 그대로** — 순서 · 삽입 · 무관 문장 | 다른 유형의 cue |
| `alternatives` | 역할 허용 대안 | 학습자 태그 채점 · 진단의 허용 집합 | |
| 문장 쌍 관계 facet(R2) | 없음 | 신규 필요 | 전부 |
| 정답 근거 위치 `answer_locus.sentence_index` · `quote`(설계 주석과 별개 키) | 3,408문항(분석 6,414행) | **E2 재사용 후보**(정답 쪽 근거 위치) | 정본 좌표(`csat_item_units`) 대응 · 검증 |
| 선지별 배제 설명 `choice_analysis[].how_to_reject` | 3,408문항(분석 6,616행) | **E3 오답 쪽 설명 재사용 후보** | 자유 서술 — 선지별 근거 좌표 · 대응 facet(scope · strength · polarity · relation)은 **신규 구조화** 필요 |

- **어휘 재사용과 좌표 재사용을 구분한다.** 역할 9 · 패턴 9 · 변환 8 · 단서 6 의 **어휘**는 그대로 쓴다. 그러나 **좌표는 아직 못 쓴다** — 설계 주석이 있는 447문항 중 `csat_item_units` 행이 있는 문항은 **0**이고(2026-10-04 실측), 주석의 문장 번호는 화면 분할기(`splitSentences`)의 0-기반 번호라 정본 단위(`u1…`)와 분할 규칙이 다르다. **좌표 대조 · 원문 검증 전에는 이 주석을 학습자 태그 채점이나 item_tagged 근거로 쓰지 않는다.**
- **기준 버전이 문항마다 다르다**: v1 26 · v1.1 172 · v1.2 20 · v1.3 229(최신 주석 기준 실측). 문항별 `passage_design.criteria` 를 보존하고 근거 품질을 버전별로 구분한다.
- 이 주석은 **문항 쪽** 근거다(출제자가 지문을 어떻게 설계했나). 학생 능력 근거가 아니다 — item_tagged 의 재료일 뿐, 학생 상태는 응답 · 직접 진단으로만.
- 검수 수준: 기준 문서에 두 판정자 일치율이 기록돼 있다(v1 역할 κ 0.83 · 허용 0.93 · 패턴 23/30 · 변환 22/30, v1.2 요지 역할 κ 0.59 · 변환 5/10). 주석은 드레인(에이전트)으로 채웠다 — 사람 검수 여부는 문항별로 확인되지 않는다. item_tagged 근거 품질에 「출처: 설계 주석 <문항별 기준 버전> · 사람 검수 없음」으로 남긴다.
- 원문 결함 22문항 등은 `data_defect` · [design-drain-defects.md](./design-drain-defects.md) 에 있다 — 태그 근거에서 뺀다.

## 18. UI — 지금 바꿔도 되는 것 · 보류

**별도 승인 후 바꿀 수 있는 것**(이 문서는 제안만 한다)
- 핵심 카드 표시명: 어휘 → **어휘 · 표현**, 문장해석 → **문장 이해**, 독해 → **글 이해**, 근거판단 → **근거 판단**, 듣기, 실전 실행 → **실전**.
- 카드 설명 문구를 §2 정의로(예: 글 이해 = 「문장들을 이어 글 전체의 의미를 만드는가」 — 「키워드 찾기」 느낌을 빼고).
- `.agent-goal.md` 에 vNext 목표 구조를 적는 것.

**데이터 확보 전 금지**
- 하위 능력(V1 … X6) · LP · 관계 facet 의 수치 · 막대 · 색 표시.
- 「병목」 「취약」 「약점 확정」 표현 · route 확정.
- 오답 원인 확인 → 축 · 하위 능력 상태 변경.
- 54라인 지도를 하위 능력 지도로 바꿔 보여 주기(근거가 유형 상속이라 같은 문제가 반복된다).
- 하위 능력 DB · mastery 계산 · 마이그레이션.

## 19. 이번에 바꾸지 않은 것

Phase 1 핵심 지도 계산 · rule_proxy 관찰 로직 · 학생 기록 · Record Quality Guard · 오답 원인 DB · 코드북 rev3 · 사람 dry run 자료 · taxonomy seed · outcome 마이그레이션 · verified diagnosis · route 결정 · 과제 162 · Pilot.

## 20. 남은 결정

1. S7 을 S6 에 흡수할지 · R5/R6 을 합칠지 — 직접 진단 설계 때 사람 판정으로 정한다(지금 데이터로는 못 가른다).
2. A6 「배경지식」의 자리 — 능력이 아니라 **지식 자원**(누적 노출, 원리 P4)으로 본다. 화면에서는 R 카드의 설명 · 과제(주제별 묶음 읽기)로만 남기는 안을 제안(짝 문서 §A).
3. D(풀이 습관) 중 행동 관찰(선지에 끌림 · 상식 판단 · 추측)을 Attempt Evidence 의 B 계열 패턴으로 옮길지 — 오답 원인 Pilot 데이터가 생긴 뒤.
4. `cause_confirmed` 를 시스템 어디에 두나(DiagnosisBasis 밖 · 진단 후보 입력) — 구현 단계.

## 21. 자기 검토(Q1–Q8)

| 질문 | 답 · 조치 |
|---|---|
| Q1 다른 능력의 결과에 불과한 하위 능력이 있나 | **있었다** — S6 Proposition · R8 Global Meaning · E8 Selection · X6 Whole-Test Stability 는 같은 축 하위 능력들의 결과다 → 「통합 관찰 지점」으로 내리고 숙달도로 세지 않는다. S7 은 S6 흡수 후보, R5/R6 은 병합 후보로 표시 |
| Q2 문항 유형을 이름만 바꾼 능력이 들어왔나 | 축 · 하위 능력 이름에 유형(빈칸 · 순서 · 삽입 · 요약 · 함축)은 없다. 단 E4–E7(범위 · 강도 · 극성 · 관계 일관성)은 선지 함정 계열과 같은 축이라 능력으로 두면 C 를 다시 능력으로 섞는다 → **E3 facet 으로 내렸다** |
| Q3 cue 를 능력으로 올렸나 | 연결어 · 반복어 · 핵심 문장 찾기는 cue/과제로 분리(§9). 지금 과제 이름 중 「연결어 방향 표시」(A3) · 「인과 화살표 그리기」(C4)는 cue 훈련 과제다 — 과제로는 유지 가능, 능력 이름으로 쓰지 않는다 |
| Q4 여러 축을 가로지르는 기능을 한 곳에 넣었나 | paraphrase(V4 · R2/R3 · E3), 자동화(가로 차원 · X1), 관계 facet(R2 · E3)을 가로 개념으로 뒀다. A4 「재진술」 라인 해체 제안(짝 문서) |
| Q5 Error Cause 와 mastery 를 직접 잇나 | 잇지 않는다 — `cause_confirmed → next diagnostic candidate` 만(§10). 대응 후보표에 경고를 붙였다 |
| Q6 rule_proxy 가 증명 못 하는 세부 상태를 UI 가 보여 주게 되나 | 하위 능력 · LP · facet 표시를 데이터 전 금지(§18). 지금 태그는 유형 상속뿐이라는 실측을 근거로 적었다(§1 · §16) |
| Q7 학년별 hard lock 이 됐나 | 아니다 — 권장 노출 범위만, 경로는 진단 근거(§15). 선수 관계도 잠금 대신 우선순위(§6) |
| Q8 기출 분석 방법을 능력과 섞었나 | 7단계 Protocol 은 과제 안 절차(§13), 4단계는 과제 사이 생애주기(§14), 능력은 §3 — 셋을 분리했다 |

## 22. 보고 형식 A–M · 지시 1–24 대응

| 보고 | 답 | 위치 |
|---|---|---|
| A 유지 · 수정된 축 정의 | 6축 유지, V → 어휘 · 표현 의미 · S → 문장 이해(명제 구성) · R → 글 이해(관계 → 구조 → 중심) · E 유지 · L 유지 · X → 실전(자동화 관찰 자리) | §2 |
| B 삭제 · 하향한 개념 | 자동화 노드 → 가로 차원 · paraphrase 단일 능력 → 세 층 · 관계 종류 축 → facet · 핵심어/반복어/핵심 문장/연결어 찾기 → cue · E4–E7 → E3 facet · S6 · R8 · E8 · X6 → 통합 관찰 지점 · A6 배경지식 → 지식 자원 | §3 · §4 · §7–§9 · 짝 문서 §A |
| C 하위 능력 후보 | V1–V4 · S1–S5 (+S6 통합 · S7 흡수 후보) · R1–R7 (+R8 통합) · E1–E3 (+E8 통합) · X1–X5 (+X6 통합) · L 미정 | §3 |
| D LP1–LP7 | 겹층 · mastery 아님 · 표시 없음 | §5 |
| E 관계 facet | restatement · example/elaboration · cause/effect · contrast/comparison · condition · general/specific · claim/evidence | §7 |
| F paraphrase | V4 · R2/R3 · E3 세 층, E3 정답 쪽은 기존 변환 8 | §8 · §17-1 |
| G Error Cause ↔ Skill | `cause_confirmed → next diagnostic candidate` 만, 상태 변경은 verified_diagnosis 만 | §10 · 짝 문서 §C |
| H A1–A9 crosswalk | 짝 문서 §A | |
| I 54라인 처리 | 이름 그대로 폐기 0 — 층 이동(B 렌즈 · C 문항 특성 · D 일부 원인 패턴/X/교수법 · I 교수법 · J → X) | 짝 문서 §B |
| J 지금 측정 가능 수준 | 축 카드의 유형 상속 proxy 뿐 · 하위 능력 · LP · facet 0 · 시간 데이터 0 · 문항 쪽 설계 주석 447 · 문장 좌표 2,910 | §1 · §16 |
| K 태깅에 필요한 필드 | 문장 좌표(기존 재사용) · 표현 대상 · 구조 지점 · 문장 쌍 facet · 기능(기존 역할 9) · 중심 · 재진술 사슬 · 선지 ↔ 근거 대응 · 발문 요구 · 처리 단위 · 출처/검수 · 도표 값 · 듣기 대본 · 문항별 시간 | §17 · §17-1 |
| L 지금 바꿔도 되는 UI | 표시명 · 설명 문구 · `.agent-goal.md`(별도 승인) | §18 |
| M 데이터 전 금지 | 하위 능력 · LP · facet 수치, 병목 · 취약, 원인 → 상태 변경, 54라인 세부 지도, mastery DB | §18 |

지시 1–24 → 1 §0 · 2 §2 · §3 V · 3 §3 S · 4 §4 · 5 §3 R · 6 §9 · 7 §9 · 8 §3 E · 9 §8 · 10 §3 X · 11 §5 · 12 §6 · 13 §15 · 14 §10 · 15 §11 · 16 §12 · 17 §13 · 18 §14 · 19 §19 · 20 이 문서 + 짝 문서 · 21 짝 문서 §B · 22 §21 · 23 §18 · 24 이 표.

### 반대 에이전트(Codex) 설계 리뷰 — 2026-10-04 `review.mjs --plan`

| 등급 | 지적 | 조치 |
|---|---|---|
| P1 | 짝 문서에서 B 계열 원인 → 과제(I9 · I10)로 바로 이었다(원인 확인은 진단 후보까지만이라는 기준 위반) | 「풀이 절차(행동) 진단 후보」까지만, 과제는 그 진단 검증 뒤로 고침 |
| P2 | A–M · 지시 1–24 대응이 없다 | 이 절 추가 |
| P2 | 문장 좌표를 새로 만들려 했다 — 정본 `csat_item_units` · `csat_current_units_many` 가 있다 | 재사용으로 고침 · 실측 부족분 802 |
| P2 | 기존 출제 설계 주석(`passage_design`)을 조사하지 않았다 | §17-1 추가 — R3 · R4 · E3 · cue 어휘를 기존 것으로 바꿈 |
| P2 | 문항별 시간 구조가 없다고 썼다 — `csat_session_attempts.sec` 와 수집 API 가 있다 | 「구조 있음 · 유효 데이터 0」으로 고침(문항 기록 1행 0초 · total_minutes 모두 NULL) |
| P3 | paraphrase 참조가 §6 으로 잘못 걸림 | §8 로 고침 |

2회차 리뷰(같은 날 재실행): **P0 0 · P1 0**, P2 3 — 모두 실측 확인 뒤 §17-1 에 반영.

| 등급 | 지적 | 실측 · 조치 |
|---|---|---|
| P2 | 설계 주석 447문항에 정본 단위가 없고 분할 규칙이 다르다 | 단위 있는 문항 **0** 확인 — 어휘 재사용 · 좌표 재사용을 구분, 좌표 대조 전 채점 근거 사용 금지 명시 |
| P2 | 주석 기준 버전이 섞여 있다 | v1 26 · v1.1 172 · v1.2 20 · v1.3 229 확인 — 문항별 버전 보존 · 버전별 근거 품질 |
| P2 | 정답 근거(`sentence_index` · `quote`) · 선지 배제 설명(`how_to_reject`)을 빠뜨렸다 | 각 3,408문항 확인 — E2 · E3 재사용 후보로 추가, 선지별 좌표 · facet 은 신규 |
