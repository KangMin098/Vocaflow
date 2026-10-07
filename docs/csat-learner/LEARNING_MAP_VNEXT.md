# 학습 지도 vNext — 정보 구조 설계 rev2.1 (2026-10-04 · 설계안 · 미구현 · 데이터 전 동결)

> rev2.1(같은 날 · 사용자 승인 반영): cause 상태 3단위(attempt · student×axis · learning map) · X 에서 Processing Fluency 제거 → 가로 측정 차원 · E-O1 관찰 조건 · R3/R4 정의 · A6 legacy proxy 분리 · Anchor 원문 정체성 · 영구 ID = semantic slug(번호는 표시 순서). 요약 §24. **이 판에서 vNext 문서를 멈춘다** — 다음 근거는 사람 dry run 과 Evidence Anchor 표본 연구에서 온다.
> rev2(같은 날): 통합 관찰 namespace(`*-O1`) · S7 흡수 · R5/R6 병합 · A6 → K · Performance Context · cause_confirmed 의 자리 · authoring/learning namespace · Evidence Anchor · 54라인 상태(retain/move/retire). 변경 요약 §23.

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
| X | Timed Performance | 실전 | 시험 실행 — 시간 배분 · 풀이 순서 · 막힘 회복 · 집중 유지를 제한 시간 안에서 안정적으로 | 처리 속도(자동화 · 유창성)는 X 가 아니라 가로 측정 차원(§4) |

## 3. 축별 하위 능력 후보(candidate — mastery 노드 아님) · rev2

> 이 목록은 **나중에 문항 태깅 · 직접 진단을 설계할 때의 후보 어휘**다. 지금은 측정도 표시도 하지 않는다(§16 · §18).
> 객체 종류를 이름으로 구별한다(rev2):
> - `V1` · `S3` … — **하위 능력 후보**(원자 처리). 나중에 직접 진단의 대상이 될 수 있다.
> - `S-O1` · `R-O1` · `E-O1` · `X-O1` — **통합 관찰(Integrated Observation / Outcome)**. 같은 축 하위 능력들이 **함께 작동한 결과**를 보는 자리다. 원자 능력이 아니며 **숙달도 · 퍼센트 · 막대를 계산하지 않는다**(번호를 하위 능력과 섞지 않은 이유 — 나중에 「S6 숙달도」가 생기지 않게).
> - `facet` — 판단 · 관계의 **차원 속성**. 능력 노드가 아니다(§7 · E3).
> - **영구 ID 는 semantic slug 이고, V1 · R2 같은 번호는 표시 순서(display_order)일 뿐이다**(rev2.1). 병합 · 분리 때문에 번호가 당겨져도 영구 ID 는 바뀌지 않게 한다 — rev2 에서 이미 R7 → R6 으로 번호가 바뀐 적이 있다. 아직 DB 가 없으므로 지금 정한다.

| 표시 | 영구 ID(slug) | 표시 | 영구 ID(slug) |
|---|---|---|---|
| V1 | `v.core_meaning` | R1 | `r.reference` |
| V2 | `v.contextual_sense` | R2 | `r.relation` |
| V3 | `v.multiword` | R3 | `r.discourse_function` |
| V4 | `v.semantic_relation` | R4 | `r.discourse_structure` |
| S1 | `s.sentence_core` | R5 | `r.central_meaning` |
| S2 | `s.chunk_boundary` | R6 | `r.inference` |
| S3 | `s.attachment` | R-O1 | `r.o.global_meaning_model` |
| S4 | `s.structural_relation` | E1 | `e.task_demand` |
| S5 | `s.form_scope` | E2 | `e.evidence_location` |
| S-O1 | `s.o.sentence_meaning_model` | E3 | `e.option_correspondence` |
| X1 | `x.time_allocation` | E-O1 | `e.o.final_judgment` |
| X2 | `x.sequence` | X-O1 | `x.o.whole_test_stability` |
| X3 | `x.recovery_adaptation` | K | `k.context_resource`(축 밖) |
| X4 | `x.attention_stamina` | | |

> 이 slug 들은 `learning.*` namespace 안의 이름이다(§17-1). 오답 원인 코드(`R.reference` 처럼 대문자 축 + 점)와 철자가 비슷해도 **다른 namespace · 다른 객체**다.

### V — 어휘 · 표현 의미(Lexical-Semantic Processing)
| | 후보 | 비고 |
|---|---|---|
| V1 | Core Meaning — 기본 의미 접근 | |
| V2 | Contextual Sense — 문맥에 맞는 다의 의미 선택 | |
| V3 | Multiword / Collocation — 구 · 숙어 · 연어를 한 의미 단위로 | |
| V4 | Semantic Relation / Lexical Paraphrase — 유의 · 반의 · 상하위 · 표현 사이 의미 동등성 | paraphrase 의 어휘 층(§8) |

V 에는 통합 관찰을 두지 않는다(V 의 결과는 S-O1 에서 함께 드러난다).

### S — 문장 이해(Sentence Processing)
| | 후보 | 비고 |
|---|---|---|
| S1 | Sentence Core — 주어 · 서술어 · 목적어 · 보어 | |
| S2 | Chunk / Boundary — 구 · 절 · 의미 단위 경계 | |
| S3 | Modification / Attachment — 무엇이 무엇을 꾸미나 | |
| S4 | Structural Relation — 병렬 · 종속 · 삽입 · 생략 · 도치 | |
| S5 | Form / Scope — 문법 형태, 부정 · 비교 · 조건 · 양보의 의미 범위 | 어법(A8)이 주로 여기 |
| **S-O1** | **Sentence Meaning Model** — S1–S5 가 합쳐져 「무엇이 무엇에 대해 무엇을 말하나」(명제)와 **문장 안의 핵심 vs 부가 정보**를 제대로 구성했나 | 통합 관찰. 이전 S6 Proposition 과 S7 Sentence Information Hierarchy 를 **흡수**(rev2) — 문장 안 위계는 명제 구성의 일부다 |

### R — 글 이해(Discourse Comprehension)
R 의 중심은 **관계 → 구조 → 중심 의미**다.

| | 후보 | 비고 |
|---|---|---|
| R1 | Reference / Cohesion — 대명사 · 지시어 · 같은 개념의 연결 추적 | |
| R2 | Local Semantic Relation — 인접 · 관련 문장 사이 의미 관계 구성 | 관계 종류는 **relation facet**(§7) |
| R3 | Discourse Function — **local functional role**: 이 문장 · 문단이 지금 무슨 역할을 하나(예시 · 근거 · 반론 · 설명 · 전환) | 기능 종류는 **discourse-function facet**(§7). 기존 출제 설계 주석 역할 9 는 **명시적 대응표로만** 참조한다 — 같은 객체 · 같은 ID 가 아니다(§17-1-1) |
| R4 | Discourse Structure — **global organization**: 그 역할 · 관계들이 모여 글 전체가 어떤 방식으로 전개되나(통념 → 반전 → 주장 → 근거) | 구조 종류는 기존 패턴 9 를 대응표로 참조 |
| R5 | **Central Meaning** — 중심 vs 부연 구별 · 글 전체에서 중요한 정보 선택 · 주제 · 핵심 주장 구성 · 나머지를 조직하는 중심 의미 판단 | 이전 R5 Information Hierarchy 와 R6 Theme / Central Claim 을 **병합**(rev2). 내부 facet: centrality · theme · central_claim — 별도 노드 아님 |
| R6 | Inference — 쓰이지 않은 의미를 글 근거로 도출 | 이전 R7 |
| **R-O1** | **Global Meaning Model** — R1–R6 이 합쳐져 글 전체의 일관된 의미 모델을 구성했나 | 통합 관찰(이전 R8) |

> 번호 호환: 1판의 R5 · R6 · R7 · R8 → rev2 R5(병합) · R5(병합) · R6 · R-O1. 1판 번호를 인용한 곳은 이 문서 안에서 모두 고쳤다(구현 · DB 에는 번호가 쓰인 곳이 없다).

### E — 근거 · 선지 판단(Evidence Judgment)
| | 후보 | 비고 |
|---|---|---|
| E1 | Task Demand — 발문이 요구하는 것 | |
| E2 | Evidence Location — 판단에 쓸 글 근거 특정 | |
| E3 | Option-Text Correspondence — 글과 선지가 같은 의미를 말하나 | **판단 facet**: `semantic_equivalence` · `scope_consistency` · `strength_consistency` · `polarity_consistency` · `relation_consistency`. option paraphrase(§8)는 `semantic_equivalence` |
| **E-O1** | **Final Answer Judgment** — E1–E3 가 합쳐져 최종 선택 · 배제를 제대로 했나 | 통합 관찰(이전 E8). **정답 여부만으로 성공이 아니다** — 정답 선택 **과** 충분한 과정 근거(근거 위치 · 선택 · 배제 이유)가 함께 있을 때만 관찰 후보가 된다. 추측으로 맞힌 사례(guess + correct)는 E-O1 성공 근거로 쓰지 않는다 |

**E3 facet 은 독립 능력이 아니다**(범위 · 강도 · 극성 · 관계 판단을 학생의 네 능력으로 두면 「어떤 함정 선지를 골랐다 → 그 능력이 약하다」는 잘못된 추론이 생긴다). 그리고 아래 세 객체는 **관련 있지만 서로 자동 변환하지 않는다**:

| 객체 | namespace | 뜻 | 출처 |
|---|---|---|---|
| `C.scope_strength` | Item Feature(선지 함정) | 이 오답 선지가 **어떻게 왜곡됐나** | 문항 · 선지 분석 |
| `E3.scope_consistency` | Learning Map facet | 글과 선지의 범위가 맞는지 확인하는 **판단 차원** — 학생에게 직접 물어볼 수 있다 | 진단 설계 |
| `E.option_mismatch` | Attempt Evidence(오답 원인 rev3) | 이 **시도**에서 실제로 일어난 실패 | 학생 과정 증거 + 검수 |

금지되는 추론(§10 과 같은 원칙):
- 학생이 `C.scope_strength` 선지를 골랐다 → `E3.scope_consistency` 가 약하다 **(금지)**
- `E.option_mismatch` 가 확인됐다 → E3 mastery 가 낮다 **(금지)**
- verified_diagnosis 전에는 어느 쪽도 능력 상태로 올리지 않는다.

R 과 E 는 합치지 않는다: R 은 「A → B 관계를 이해했나」, E 는 「선지가 그 관계를 B → A 로 뒤집었는지 가렸나」.

### L — 듣기
지금 후보를 정하지 않는다 — 대본 · 음성 · 막힌 시점 증거가 없다(오답 원인 코드북 §8 과 같은 이유). v0.2-listening 에서 정한다.

### X — 실전(Timed Performance)
| | 후보 | 비고 |
|---|---|---|
| X1 | Time Allocation — 문항 · 영역 시간 배분 | |
| X2 | Sequence — 풀이 순서 | |
| X3 | Recovery / Adaptation — 막힘 · 난이도 변동에서 빠져나오기 | |
| X4 | Attention / Stamina — 집중 유지 · 후반 안정성 | |
| **X-O1** | **Whole-Test Stability** — 제한 시간 전체 수행의 안정성 | 통합 관찰(이전 X6) |

X 는 **순수하게 시험 실행**이다 — 영어 지식 · 독해 능력과 분리한다. 「시간 부족」은 X 의 관찰이지 V/S/R/E 의 낮음이 아니다. rev2 의 X1 Processing Fluency 는 **X 에서 뺐다**(rev2.1): 어휘 인출 · 문장 처리 · 담화 통합 · 선지 판단의 속도는 서로 다른 V/S/R/E 처리의 속성이라 X 의 실행 능력과 성격이 다르다 → §4 가로 측정 차원.

### 축 밖 — K · Performance Context(핵심 지도 카드가 아니다)

**K — Knowledge / Context Resource**(이전 A6 배경지식)
- 학생이 글을 이해할 때 쓸 수 있는 **자원**(주제 친숙도 · 분야 친숙도 · 사전 지식의 유무). 능력 축이 아니라 **맥락 · 자원 · 조정 변수**다.
- 배경지식은 이해를 돕기도 하고, 글과 충돌하는 상식을 끼워 넣어 오답을 만들기도 한다 — 그래서 많을수록 좋은 「역량」으로 그리지 않는다.
- **금지**: 숙달 막대 · 목표 100% · 「부족 역량」 판정 · 핵심 지도 카드 · route 자동 결정.
- **ontology 와 지금 계산을 분리한다**: ontology 에서는 A6 ≠ R(K 로 확정). 그러나 지금 화면의 R 카드 rule_proxy 는 A3 + A6 로 계산된다(`lib/csat/map/core.ts`) — 이것은 **legacy proxy only** 로 남겨 둔다. vNext ontology 확정만으로 지금 proxy 계산을 바꾸지 않는다(지금 R 값은 애초에 유형 상속 proxy 라 정밀 진단값이 아니다). 계산 변경은 별도 구현 승인 때.
- 오답 원인 `B.outside_knowledge` 와 다르다: K = 배경지식이라는 자원이 **있는가**, `B.outside_knowledge` = 이 시도에서 글보다 외부 상식을 **우선해서** 틀렸다는 원인.
- 나중에 필요하면 topic familiarity · domain familiarity · prior knowledge availability 를 **맥락 증거**로 기록할 수 있다. 지금은 데이터가 없어 만들지 않는다.

**Performance Context**(이전 J4 시험 불안 · J5 의 「당일 컨디션」)
- 정서 · 상황 맥락. 영어 능력도, 안정적인 실행 능력(X)도 아니다.
- 나중에 필요하면 별도 metadata 층. **숙달 막대를 만들지 않는다.**

## 4. 가로 측정 차원(Cross-cutting Performance Dimensions) — 능력 노드가 아니다

`accuracy` · `fluency` · `latency` · `stability` 는 **V · S · R · E 각 처리의 측정 차원**이다(어휘 인출 속도 · 문장 처리 속도 · 담화 통합 속도 · 선지 판단 속도는 서로 다른 처리의 fluency 다). 「V 자동 인출」 「S 자동 해석」 같은 노드를 두지 않고, X 안에도 두지 않는다(rev2.1 — X1 Processing Fluency 제거).

- 지금은 **측정하지 않는다** — 문항별 시간을 담을 구조(`csat_session_attempts.sec` + 수집 API)는 **있지만 유효 데이터가 0**이다(2026-10-04 실측: 문항 기록 1행 · 그 시간 0초, 시험 기록 2회의 `total_minutes` 모두 NULL).
- 숫자 · mastery 를 계산하지 않는다. 나중에 쓸 때도 축 상태가 아니라 「그 축 처리를 어떤 조건에서 관찰했나」의 속성이다.
- 시간 제약에서 드러나는 **실행**(배분 · 순서 · 회복 · 집중)은 X 에서 본다.

## 5. Learning Progression(LP1–LP7) — 겹층

| LP | 이름 | 처리 단위 | 주 축 |
|---|---|---|---|
| LP1 | Lexical Access | 낱말 · 표현 → 의미 | V |
| LP2 | Sentence Meaning | 문장 구조 → 핵심 명제(S-O1) | V + S |
| LP3 | Local Coherence | 두 문장 이상의 참조 · 관계 | S + R |
| LP4 | Discourse Structure | 관계들 → 문단 · 글 구조 | R |
| LP5 | Central Meaning | 중심 · 부연 구별, 주제 · 주장 재구성 | R |
| LP6 | Evidence Judgment | 글 의미 ↔ 발문 · 선지 | R + E |
| LP7 | Timed Integration | 위 과정을 시간 제약에서 안정적으로 | V/S/R/E + X |

- **LP 는 mastery 노드도, 점수도 아니다.** 「학습의 처리 단위가 어떻게 넓어지나」를 나타낼 뿐이다. 학생 화면에 LP 7개의 퍼센트를 표시하지 않는다. Domain Map(축)과 별도다.
- 쓰임: 과제 · 지문의 난이도 설계, 진단 순서 제안, 설명 문구(「지금은 문장 단위를 단단히 하는 시기」)의 근거.
- 공식 근거와의 관계: 평가원 최소 성취수준 자료(ORM 2024-79-3)는 이해 성취기준을 세부 정보 → 주제 · 요지 → 논리적 관계 · 구조 → 의도 · 함축 추론의 **위계**로 설명하고, 「문장 구조 분석에 어려움」이면 의미 단위 끊어 읽기 → 문단 구조로 지도하라고 한다(코드북 [SOURCES](./codebook/SOURCES.md) A3). **LP 는 이 위계와 같은 것이 아니다.** 공식 위계는 **이해 기능의 성취 난이도**(무엇을 할 수 있나 — 주제 · 요지가 논리 관계 · 구조보다 먼저)이고, LP 는 **처리 단위의 확장**(낱말 → 문장 → 문장 사이 → 글 구조 → 중심 의미)이라 순서가 다르다(LP 는 관계 · 구조 LP3–4 를 중심 의미 LP5 앞에 둔다 — 중심 의미를 「구성」하려면 관계 · 구조 처리가 재료가 된다는 처리 모델의 가정). 공식 자료와 맞는 부분은 「문장 구조 → 문단 구조」 지도 순서와 함축 추론이 하위 역량 뒤라는 점뿐이다. 평가원 자료는 어휘 · 구문 · 담화를 오류 축으로 나누지도 않는다 — **LP 를 공식 분류 · 공식 위계라고 쓰지 않는다.**

## 6. 선수 관계 — hard lock 없음, dominant dependency

- 「V 완료 → S 해제 → R 해제 → E 해제」 같은 잠금을 쓰지 않는다. 학습은 나선형으로 겹친다(초등생도 because · but · for example 의 단순 관계를 배운다).
- 대신 `dominant_dependency`: V · S 가 매우 불안정하다는 **검증된** 근거가 있으면 고난도 R · E 과제의 **우선순위를 낮춘다**. 잠그지 않는다.
- rule_proxy 단계에서는 이 판단을 하지 않는다(근거가 유형 상속값이라).

## 7. facet — 관찰하는 특징이지 능력 노드가 아니다

| facet 묶음 | 값 | 어느 능력을 관찰하나 |
|---|---|---|
| relation facet | restatement · example/elaboration · cause/effect · contrast/comparison · condition · general/specific · claim/evidence | R2(관계를 이해했나) · E3 `relation_consistency`(선지가 그 관계를 유지했나) |
| discourse-function facet | claim · reason · evidence · example · elaboration · contrast · objection · transition | R3 · R4 — 화행 · 맺음(편지 · 안내문)은 **학습 쪽에 넣지 않는다**(출제 전용, §17-1-1) |
| central-meaning facet | centrality · theme · central_claim | R5 |
| E3 judgment facet | semantic_equivalence · scope · strength · polarity · relation consistency | E3 |

- 문항 태그 · 과제 · 오답 원인 메모에 **속성**으로 붙는다.
- **UI 에서 「인과 62%」 「예시 81%」 같은 숙달 막대를 만들지 않는다.** 필요하면 진단 근거를 facet 별로 **나눠 보여 주는 근거 내역**(evidence breakdown — 「인과 관계가 걸린 문항 3개에서 관찰」)까지만.

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

cue 어휘는 기존 출제 설계 주석의 **단서 6**(pronoun · connective · article · time · logic · repetition)을 **대응표(§17-1-1)를 거쳐** 후보로 쓰고, 부족하면 학습 쪽에 더한다(예: example marker). 강사의 독해 공식(「두 소재 사이 관계를 한 번은 잡아라」 등)도 이 cue · scaffold 층으로 흡수한다. 특정 강사의 공식을 핵심 지도로 만들지 않는다. **「핵심 문장 찾기」도 능력이 아니다** — 문장 의미 · 관계 · 기능 · 위계 · 중심 주장의 결과이고, 필요하면 R5(Central Meaning)를 관찰하는 진단 과제로 쓴다.

## 10. 오답 원인(Error Cause) ↔ 학습 지도(Skill) — 같은 객체가 아니다

| | Error Cause(rev3 `V.*` · `S.*` · `R.*` · `E.*` · `B.*` · `X.*`) | Skill(이 문서의 V1 · R1 …) |
|---|---|---|
| 무엇 | **한 번의 풀이**에서 확인된 실패 사건 | 여러 시도 · 직접 진단으로 쌓인 능력 상태 |
| 근거 | 그 시도의 과정 증거 | 누적 증거 + 직접 진단 |

**허용되는 연결은 하나뿐**: attempt 단위 근거(`cause_adjudicated` = 코드 확인 · 그리고 §9 의 영역 확인 · 영역 일치) → `cause_confirmed`(student × axis, §9 규칙 그대로 합산) → (파생) **Diagnostic Priority Signal** → 직접 진단 → `verified_diagnosis`. 직접 진단 앞에서 상태를 바꾸지 않는다(§10-1 구조도).
- 예: `R.reference` 원인이 확인됨 → 「R1(지시 · 응집)을 직접 확인하는 진단을 먼저 제안」.
- **금지**: 원인 확인만으로 R1 상태를 「취약」으로 바꾸기. 학습 지도의 진단 상태는 `verified_diagnosis` 만 바꾼다.
- 「`R.reference` 원인이 확인됐다」는 「reference 능력이 낮다」가 아니다. 「다음 진단에서 reference · cohesion 을 먼저 볼 이유가 생겼다」다.
- 이름이 비슷해도 1:1 대응이 아니다(대응 후보표: 짝 문서 §C).
- 선지 함정(C) · E3 facet · 오답 원인 사이에도 자동 추론 경로를 두지 않는다(§3 E 표).

### 10-1. 원인 상태의 세 단위 — attempt · student × axis · learning map

기존 설계([ERROR_EVIDENCE_DESIGN](./ERROR_EVIDENCE_DESIGN.md) §9)는 `cause_confirmed` 를 **한 학생 · 한 축에 대해 여러 응답을 누적한 상태**로 정의했다(조건 8 — 긍정 근거 ≥ 4 · 서로 다른 문항 ≥ 4 · 회차 ≥ 2 · 유형 ≥ 2 · 판정자 코드 확인 ≥ 1 · 120일 + 최근 3회 · 반증 ≤ 긍정 · 평가원/학평 출처, 적격 회차만 · 현재 taxonomy 판정만 · 철회 · 정정 제외 · `now` 주입으로 재계산). 이 문서는 그 정의와 이름을 **바꾸지 않는다** — 대신 언제나 **단위를 붙여** 쓴다.

| 상태 | 단위 | 뜻 | 정본 · 계산 |
|---|---|---|---|
| `cause_adjudicated` | **attempt**(응답 × 원인 코드) | 이 시도의 원인에 대한 사람 검수 결과 — §9 집계 ①의 「코드 확인」(현재 회차 · 현재 taxonomy 판정만, 하나라도 기각이면 기각 우선, 판정 갈림 보류) + 집계 ②의 판단 변경(공개 뒤 accept) 보류 줄 통과. 단순 blind 일치만으로는 아니다 | `csat_ec_judgment` · claim(§9 집계) |
| `cause_confirmed` | **student × axis**(V · S · R · E 만, 누적) | §9 집계 ②의 응답 × 축 결과 — **확인(= `cause_adjudicated` 코드 확인이 있는 응답) · 영역 확인 · 영역 일치**를 §9 규칙대로 합산해 8 조건을 채운 **Error Evidence 에서 파생된 누적 근거 상태**. `cause_adjudicated` 는 그 입력 가운데 하나(코드 수준)일 뿐이다. **attempt 상태가 아니고, Learning Map 진단도 아니다.** B · X 는 대상 아님 | §9 계산(저장값 아님 — 조회 때 `now` 로 재계산) |
| `verified_diagnosis` | **student × learning skill/axis** | **직접 진단**으로 확인된 학습 지도 진단 | 직접 진단 설계(미정) |

- 이름: 장기적으로 `axis_cause_confirmed` 처럼 단위가 드러나는 이름이 더 명확하다. 다만 §9 가 이미 쓰는 이름이라 지금 바꾸지 않고, 문서에서 늘 「student × axis」를 붙인다.
- `DiagnosisBasis` 는 `rule_proxy · item_tagged · verified_diagnosis` 셋뿐이다. `cause_adjudicated` · `cause_confirmed` 는 넣지 않는다.

**구조도 — 화살표 사이에 자동 승격이 없다**

```
ITEM ─────────── Question Type(B 렌즈) · Choice Trap(C, 선지 특성)            ← 문항 쪽. 학생 상태로 바뀌지 않는다
  │
ATTEMPT ──────── raw response → process evidence → Error Cause claim
  │                                                   │ 사람 검수(blind · reveal · adjudication)
  │                                                   ▼
  │                                             cause_adjudicated(코드 확인)    (attempt 단위)
  │                                             + 영역 확인 · 영역 일치(§9 ②)   (attempt × axis — 같은 attempt 층)
  │                                                   │ 여러 시도 누적 · §9 규칙 합산 · 8 조건(V/S/R/E 만)
  ▼                                                   ▼
STUDENT × AXIS ─────────────────────────────── cause_confirmed                  (student × axis 누적 근거 — 진단 아님)
                                                      │ 파생 계산(저장 안 함)
                                                      ▼
                                          Diagnostic Priority Signal            (「무엇을 먼저 직접 확인할까」만)
                                                      │
                                                      ▼
DIRECT DIAGNOSIS ─────────────────────────── 직접 진단 과제 수행 · 판정
                                                      │  ← 여기만 상태를 바꿀 수 있다
                                                      ▼
                                              verified_diagnosis                 (student × learning skill/axis)
                                                      │
                                                      ▼
LEARNING MAP ─────────────────────────────── V / S / R / E / L / X 상태

  ✕ cause_adjudicated → 학습 지도 상태      ✕ cause_confirmed → 학습 지도 상태
  ✕ Choice Trap 선택 → E3 facet 약함        ✕ Diagnostic Priority Signal → mastery
```

- 축 수준(**V · S · R · E** 카드의 「우선 확인 후보」 순서)은 §9 의 `cause_confirmed` 가 정한다 — §9 의 후보 상한(최대 2개 · 진단 최대 1개)도 그대로다. B 원인은 축 후보를 움직이지 않는다.
- **X 원인은 우선순위 자동화를 보류한다.** `X.time` · `X.attention` 은 `cause_adjudicated` 까지는 기록할 수 있지만 `cause_confirmed` · Diagnostic Priority Signal 에는 넣지 않는다 — §9 대상이 아니고, 문항별 시간 데이터가 0 이라 자동화하면 가짜 정밀성이 된다. 문항별 시간 · 중단/재시도 · 문항 순서 · 전체 시험 시간 · 집중 자기보고 같은 **실행 근거 모델**이 생긴 뒤 따로 설계한다. 지금은 짝 문서 §C 의 의미상 대응만.
- 하위 능력 수준(R1 · E3 …)의 진단 후보는 짝 문서 §C 대응으로 **§9 와 같은 적격 회차 · 현재 해시 · 현재 taxonomy · 철회 제외 규칙**을 통과한 `cause_adjudicated` 만 센다(V · S · R · E 원인만). 예: 독립된 시도에서 `R.reference` 가 여러 번 adjudicated → R1 직접 진단의 우선순위를 올릴 수 있다. 「R1 관찰 낮음 · 취약 · mastery = 2」로 바꾸면 안 된다.
- 별도 테이블을 만들지 않는다. 진실의 원천은 오답 원인 claim · judgment 와 §9 계산이고, Diagnostic Priority 는 그 위의 **계산된 downstream 모델로 문서에만 정의**한다. 하위 능력 수준의 반복 문턱 같은 수치는 사람 dry run · Pilot 뒤에 정한다.

## 11. DiagnosisBasis 별 허용 표현

| 근거 수준 | 표시해도 되는 것 | 금지 |
|---|---|---|
| `rule_proxy`(지금 전부) | V/S/R/E/L/X 상위 카드의 잠정 관찰 · 진단 근거 부족 · 데이터 없음 · 우선 확인 후보 | 세부 하위 능력 숙달도 · 확정 병목 · route 확정 |
| `item_tagged`(문항 단위 태깅 생긴 뒤) | 어떤 세부 능력이 어떤 문항에서 관찰됐는지 · 근거 수 · 근거 품질(출처 · 검수 여부) | mastery 확정 |
| `verified_diagnosis` | 세부 능력 상태 · route 결정 · 진단 기반 처방 | — |

`cause_adjudicated`(attempt 단위)와 `cause_confirmed`(student × axis 누적 근거, 기존 §9 정의)는 근거 수준(basis)이 아니다(§10-1) — 이 표에 넣지 않는다. 지도에는 파생된 Diagnostic Priority Signal 만 「우선 확인 후보」로 전달된다.

## 12. 최종 정보 구조 — 층을 섞지 않는다

| 층 | 내용 | 지금 어디 |
|---|---|---|
| Learning Map | V · S · R · E · L · X(+ 통합 관찰 S-O1 · R-O1 · E-O1 · X-O1) | 핵심 카드 |
| Progression Overlay | LP1–LP7 | (신규 — 표시 없음) |
| Knowledge / Context Resource | K(주제 · 분야 친숙도 · 사전 지식) — 축 아님 | (신규 — 데이터 없음, 표시 없음) |
| Performance Context | 시험 불안 · 당일 컨디션 — 축 아님 | (신규 — 표시 없음) |
| Question Lens | B 문항 유형(대의 · 함축 · 빈칸 · 순서 · 삽입 · 요약 …) | 라인 B1–B13 |
| Item Feature | C 선지 함정(선지가 의미를 어떻게 바꿨나) | 라인 C1–C8 · `csat_dx_option_trap` |
| Attempt Evidence | Learner Error Cause(학생이 왜 틀렸나) · `cause_adjudicated`(attempt) | `csat_ec_*`(검수 전) |
| Student × Axis Evidence | `cause_confirmed`(Error Evidence 에서 파생된 누적 근거, ERROR_EVIDENCE §9 — 진단 아님) → 파생 Diagnostic Priority Signal | §9 계산(구현 전) |
| Pedagogy | Task · Route · 공부 방법 · 학습 전략(오답 분석 습관 · EBS 활용 · 학습 배분) | 과제 162 · 라인 I1–I10 · 일부 D |
| Goal / Route | 목표 점수 · 경로(route) · 학습 배분 | 목표 · D9 |
| Rationale | P 원리 | 원리 P1–P8 · 트랙 T1–T3 |

지금 「라인」 층에 함께 있는 D(풀이 습관) · J(시험 운영)의 자리 · 라인별 상태(retain/move/retire)는 짝 문서 §B.

## 13. 기출 분석 Task Protocol — 과제 안의 절차

두 강사 영상에서 공통으로 유효한 부분(「줄거리 이해만으로는 오답 선지를 못 가린다 — 두 소재 사이의 관계를 한 번은 의식적으로 잡고, 그 관계로 선지를 가른다」, 그리고 평가원 학습 안내의 「논리적 관계를 파악해야」)은 **능력 노드가 아니라 기출 분석 과제의 절차**로 흡수한다.

| 단계 | 하는 일 | 주로 쓰는 능력 |
|---|---|---|
| 1 Sentence Meaning | 핵심 문장의 명제를 정확히 | S1–S5 → S-O1 |
| 2 Relation | 문장 사이 관계 확인(facet 기록) | R1 · R2 |
| 3 Structure | 전개 구조 재구성 | R3 · R4 |
| 4 Central Meaning | 필자의 핵심 주장 · 설명 압축 | R5 |
| 5 Function | 나머지 문장의 역할 설명 | R3 |
| 6 Semantic Correspondence | 정답 선지가 글의 어떤 의미를 재표현했나 | E3 |
| 7 Distortion | 오답 선지가 무엇을 바꿨나(C 함정 계열로 이름 붙임) | E3 + C |

이 7단계를 7개의 mastery 노드로 만들지 않는다.

## 14. FIND → REPAIR → TRANSFER → CHECK

> 저장소에서 이 생애주기 정의를 찾지 못했다(2026-10-04 grep — 지금 과제 162개는 라인마다 ord 1–3 묶음). **이 문서가 처음 정의한다.**

| 단계 | 뜻 | 예: R2 관계가 검증된 학생 |
|---|---|---|
| FIND | 어느 처리 단계에서 깨졌나를 증거로 찾는다 | 관계가 깨진 기출 위치 확인 |
| REPAIR | 7단계 기출 분석 Protocol(§13)로 다시 처리한다 | 관계 · 구조 재구성 |
| TRANSFER | 같은 기제를 새 자료에 옮긴다 | 같은 관계 facet 을 가진 다른 기출에 적용 |
| CHECK | 도움 없이 다시 확인 | 다른 지문에서 독립 확인 |

7단계 Protocol(과제 **안** 절차)과 4단계 생애주기(과제 **사이** 순서)는 다른 것이다.

**구현(2026-10-07 · `apps/web/src/lib/csat/map/prescription.ts`, DB 변경 없음)**
- 책임 경계: 관찰(observation) → 진단 필요(diagnostic_need) → 처방(prescription). `nextPhase` 는 한 칸씩만 가고, 처방은 `verified_diagnosis` 일 때만(§11). 지금(rule_proxy)은 진단 필요까지.
- 진단 전 화면: 팝업 「학습 활동 — 진단 전」, 「처방이 아니에요」 문구, **찾기만 「지금 해 볼 수 있는」 단계**(어디서 막혔나 확인 = 진단을 돕는 활동), 고치기 · 옮기기 · 확인은 「진단 뒤」 표시. 체크 기능은 유지한다.
- 과제 162 → 단계 대응표 `TASK_STAGE`(에이전트 판정 v1): FIND 38 · REPAIR 72 · TRANSFER 32 · CHECK 20. 다른 라인으로 보내는 과제 11개는 `LINKS`(3개는 「원인에 맞는 라인」 — 미리 정하지 않음). 대응표에 없는 과제는 「단계 미정」으로 남긴다(숨기지 않음). 라이브 테스트가 DB 과제 id = 대응표를 확인한다.
- **콘텐츠 공백**: 찾기 과제가 없는 라인 20개(A3 · A4 · A5 · B2 · B4 · B7 · B8 · B11 · B12 · B13 · C8 · D1 · D3 · D9 · I5 · I7 · I10 · J1 · J2 · J5) — 진단 전에 「지금 해 볼」 활동이 없다. 채우려면 과제 시드 추가(별도 작업 · SQL 검토).

## 15. 학년별 권장 노출(hard lock 아님)

| 학교급 | 중심 축 | 주 노출 LP | 핵심 경험 · 변화 |
|---|---|---|---|
| 초등 고학년 | V + S, 초기 R | LP1 – LP2(+ LP3 맛보기) | 문장이 의미로 들어온다 · because · but · for example 같은 단순 관계를 이해한다 |
| 중등 | S + R | LP2 – LP4 | **문장 → 문단**: 문장 관계 · 문단 기능 · 재진술 · 핵심과 부연 |
| 고등 | R + E + X | LP3 – LP7 | **문단 → 글 → 근거 판단**: 글 구조 · 중심 의미 · 선지 대응 · 시간 안의 통합 |

학년은 hard prerequisite 가 아니라 **교육적 권장 노출**이다. 실제 학생 경로는 학년이 아니라 진단 근거로 정한다(같은 고등학생이라도 근거에 따라 LP2 부터 다질 수 있다). 「초5 = LP1」 같은 고정 규칙을 만들지 않는다.

## 16. 지금 데이터로 측정할 수 있는 것 · 없는 것

| | 측정 가능 | 측정 불가(이유) |
|---|---|---|
| 축 카드 | 유형 상속 proxy 의 관찰 수준(V · S · R · E · X) | L(듣기 태그 0) |
| 하위 능력(V1 … X4) · 통합 관찰(*-O1) | — | 전부 불가(문항 태그가 `type_default` 뿐 · 관리자 수정 0 · 검수 0) |
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
| 중심 문장 · 재진술 사슬 | 지문 | R5 · paraphrase(R) |
| 선지 ↔ 근거 문장 대응 · 대응 facet | 선지 | E2 · E3(왜곡 종류는 C 와 같은 어휘) |
| 발문 요구 종류 | 발문 | E1 |
| 처리 단위(LP 후보) | 문항 | 난이도 설계 · 과제 배치 |
| 출처 · 검수 상태 | 모든 태그 | item_tagged 근거 품질 — 「유형 상속」과 「사람이 단 태그」를 구별 |
| 도표 · 그림 구조화 값 | 도표 문항 | 지금 없음 → 판정 제외 |
| 듣기 대본 · 시점 | 듣기 | L(v0.2) |
| 문항별 시간 · 답 변경 | 응답 | 가로 측정 차원(fluency · latency) · X 실행 근거 모델 |

### 17-1. 기존 자산 재사용 — 출제 설계 주석(`csat_item_analyses.answer_locus.passage_design`)

2026-10-04 실측: **447문항**(469행) · 키 `roles` · `pattern` · `transform` · `transform_note` · `cues` · `alternatives` · `selection` · `criteria` · `data_defect`. 정본 기준 [design-annotation-criteria.md](./design-annotation-criteria.md) v1.3. 문장 번호는 화면 지문 지도와 같은 분할기의 0-기반 번호.

| 기존 칸 | 값 | vNext 에서의 쓰임 | 부족분 |
|---|---|---|---|
| `roles`(문장마다) | 역할 9 | R3 discourse-function · R5 central-meaning 의 **후보 자산 — §17-1-1 대응표를 거친다**(직접 재사용 아님) | 주석 유형(목적 · 빈칸 · 순서 · 대의 6 · 삽입 · 무관 문장) 밖의 문항 · 문단 단위 기능 |
| `pattern` | 패턴 9 | R4 구조 유형의 **후보 자산 — 대응표를 거친다** | 같음 |
| `transform` · `transform_note` | 변환 8 | **문항 특성(출제 전용)** — E3 `semantic_equivalence` 를 관찰할 때의 재료 | 오답 선지 쪽은 C(선지 함정)가 맡는다 |
| `cues` | 단서 6(pronoun · connective · article · time · logic · repetition) | cue 층(§9)의 **후보 자산 — 대응표를 거친다**(부분 대응) | 다른 유형의 cue |
| `alternatives` | 역할 허용 대안 | 학습자 태그 채점 · 진단의 허용 집합 | |
| 문장 쌍 관계 facet(R2) | 없음 | 신규 필요 | 전부 |
| 정답 근거 위치 `answer_locus.sentence_index` · `quote`(설계 주석과 별개 키) | 3,408문항(분석 6,414행) | **E2 재사용 후보**(정답 쪽 근거 위치) | 정본 좌표(`csat_item_units`) 대응 · 검증 |
| 선지별 배제 설명 `choice_analysis[].how_to_reject` | 3,408문항(분석 6,616행) | **E3 오답 쪽 설명 재사용 후보** | 자유 서술 — 대응 facet(scope · strength · polarity · relation)은 신규 구조화 |
| 선지별 근거 좌표 `choice_analysis[].confirmed_at.sentence_index` | 최신 published 분석 기준 **정답 선지 2,629문항** · **오답 선지 112개(28문항)** | E2 · E3 좌표의 `legacy_candidate` — `checkUnitRefs` 가 이미 검사한다 | 오답 선지 좌표는 28문항뿐 — 검증 뒤 **부족분만** 새로 구조화 |

- **namespace 를 나눈다(rev2).** 출제 설계 주석은 **출제자 관점의 ontology**(`authoring.*`), 학습 지도는 **학생이 이해해야 할 처리의 ontology**(`learning.*`)다. 라벨이 같아도 같은 객체가 아니다 — `authoring.role.example` 과 `learning.discourse_function.example` 은 별도 ID 이고, 둘 사이에 **명시적 대응표**(아래 §17-1-1)를 둔다. 기존 주석 ID 를 학습 지도 ID 로 직접 쓰지 않는다. 대응은 **완전 동일한 것만 1:1**.
- **어휘 재사용과 좌표 재사용을 구분한다.** 역할 9 · 패턴 9 · 변환 8 · 단서 6 의 **어휘**는 그대로 쓴다. 그러나 **좌표는 아직 못 쓴다** — 설계 주석이 있는 447문항 중 `csat_item_units` 행이 있는 문항은 **0**이고(2026-10-04 실측), 주석의 문장 번호는 화면 분할기(`splitSentences`)의 0-기반 번호라 정본 단위(`u1…`)와 분할 규칙이 다르다. **좌표 대조 · 원문 검증 전에는 이 주석을 학습자 태그 채점이나 item_tagged 근거로 쓰지 않는다.**
- **기준 버전이 문항마다 다르다**: v1 26 · v1.1 172 · v1.2 20 · v1.3 229(최신 주석 기준 실측). 문항별 `passage_design.criteria` 를 보존하고 근거 품질을 버전별로 구분한다.
- 이 주석은 **문항 쪽** 근거다(출제자가 지문을 어떻게 설계했나). 학생 능력 근거가 아니다 — item_tagged 의 재료일 뿐, 학생 상태는 응답 · 직접 진단으로만.
- 검수 수준: 기준 문서에 두 판정자 일치율이 기록돼 있다(v1 역할 κ 0.83 · 허용 0.93 · 패턴 23/30 · 변환 22/30, v1.2 요지 역할 κ 0.59 · 변환 5/10). 주석은 드레인(에이전트)으로 채웠다 — 사람 검수 여부는 문항별로 확인되지 않는다. item_tagged 근거 품질에 「출처: 설계 주석 <문항별 기준 버전> · 사람 검수 없음」으로 남긴다.
- 원문 결함 22문항 등은 `data_defect` · [design-drain-defects.md](./design-drain-defects.md) 에 있다 — 태그 근거에서 뺀다.

#### 17-1-1. authoring ↔ learning 대응 분류(초안)

분류: **동일**(semantic equivalence — 정의 대조 뒤 1:1 허용) · **부분**(partial — 1:N 이나 경계가 다름, 대응표로만) · **출제 전용**(authoring-only) · **학습 전용**(learning-only).

| authoring | learning | 분류 | 이유 |
|---|---|---|---|
| role.example | discourse_function.example | 동일(정의 대조 후) | 둘 다 구체 사례 · 연구 · 일화. 단 출제 기준의 「고유명사 · 연구 · 실험이면 example」 조작 규칙은 출제 쪽 규칙이다 |
| role.topic | discourse_function.claim · central-meaning | 부분 | topic 은 설명문의 중심 진술도 포함 — claim(주장)보다 넓다 |
| role.support | discourse_function.reason · evidence · elaboration | 부분 | 하나가 셋으로 갈린다 |
| role.turn | discourse_function.contrast · transition | 부분 | |
| role.concession | discourse_function.objection | 부분 | 양보(반대 입장 일부 인정)와 반론 제기는 방향이 다르다 |
| role.conclusion | discourse_function.claim + relation.restatement | 부분 | |
| role.background | — | 출제 전용 | 학습 쪽 기능 facet 에 없다(필요하면 나중에 「도입 · 통념」 추가 검토) |
| role.speech_act · role.closing | — | 출제 전용 | 화행 글 전용 |
| pattern.myth_rebuttal · general_specific · problem_solution · contrast · cause_effect · study_implication · narrative | discourse_structure(R4) 구조 유형 | 부분 → 정의 대조 뒤 동일 후보 | 출제 기준이 v1–v1.3 로 바뀌었다 — 버전 고정 뒤 대조 |
| pattern.request_letter · other | — | 출제 전용 | |
| transform.*(변환 8) | — | **출제 전용(Item Feature)** | 정답 선지를 **어떻게 만들었나**는 문항 특성이다 — 오답 쪽 C(선지 함정)처럼 정답 쪽 문항 특성. 학습 쪽 E3 `semantic_equivalence` 의 관찰 재료일 뿐 같은 객체가 아니다 |
| cue.*(단서 6) | cue 층(§9) | 부분 | 학습 쪽 cue 는 example marker 등을 더한다. 둘 다 능력이 아니라 근거 특징 |
| — | discourse_function.reason vs evidence 구분 · elaboration | 학습 전용 | |

### 17-2. Evidence Anchor — 세부 태깅 전에 반드시 풀어야 할 전제

V/S/R/E 하위 능력을 문항에 태깅하기 **전에**, 문항 안의 근거 위치를 하나의 검증 가능한 체계로 표현해야 한다. 그렇지 않으면 taxonomy 가 정확해도 「어느 문장 · 어느 부분이 그 능력을 요구했나」를 일관되게 검증할 수 없다. 지금 위치 정보가 네 갈래로 흩어져 있다: 정본 문장 단위(`csat_item_units`) · 정답 근거 `answer_locus.sentence_index` · `quote` · 출제 설계 주석의 0-기반 문장 번호 · 오답 원인의 `blocked_span`(part · sentence · 문자 범위).

`EvidenceAnchor` 최소 요구(설계만 — DB 없음):

| 필드 | 뜻 |
|---|---|
| `item_id` | 문항 |
| `source_text_version` | **원문 정체성** — 이 Anchor 가 **어느 버전의 실제 본문**을 기준으로 만들어졌나(버전 식별자) |
| `source_text_hash` | 그 본문의 해시(`csat_item_units.input_hash` 와 같은 계열). **경계 해시(`units_hash`) 일치만으로 원문 검증을 인정하지 않는다** — `units_hash` 는 분할 버전 · 단위 경계만 해시한다 |
| `anchor_type` | passage · stem · option(n) · underline · blank · given_sentence |
| `unit_id` | 정본 단위(문장) 참조 — `validated_anchor` 이상이면 이것 또는 신뢰할 수 있는 문자 범위 중 하나가 **필수**(유일한 위치) |
| `char_start` · `char_end` | 문자 범위 — 신뢰할 수 있을 때만 |
| `quote_hash` | 인용 원문의 해시(원문을 복제하지 않고 대조) |
| `segmentation_version` | 분할 규칙 버전(정본 `units_version` · 화면 `splitSentences` 를 구별) |
| `provenance` | 어디서 왔나(정본 · 정답 근거 분석 · 설계 주석 v1.x · 학생 근거 · 사람 태깅) |
| `validation_status` | 아래 §17-3 |

목적: 정본 문장 단위 · 기존 sentence_index · 출제 설계 주석 · 정답 근거 quote · 학생 막힌 곳을 **같은 좌표**로 잇는다.

### 17-3. 기존 위치 정보의 상태 — 근거가 아니라 후보

| 상태 | 뜻 | 지금 해당 |
|---|---|---|
| `legacy_candidate` | 기존 sentence_index · quote · 설계 주석 위치 — 새 Anchor 기준의 검증 전 | 정답 근거 3,408문항 · 설계 주석 447문항 **전부**(아래 하위 구분) |
| `validated_anchor` | 정본 텍스트와 다시 대조해 위치 · 인용이 맞음을 확인. **위치를 유일하게 특정하는 좌표가 필수**(정본 `unit_id`, 또는 신뢰할 수 있는 `char_start` · `char_end`) | 0 |
| `reviewed_anchor` | 사람 검수까지 끝남 | 0 |

- legacy_candidate 안의 하위 구분(정답 근거 3,408문항 — 2026-10-04 실측, 문항별 최신 분석 기준):

  | 구분 | 문항 | 뜻 |
  |---|---|---|
  | **경계 해시 일치**(`csat_item_analyses.units_hash` = 최신 `csat_item_units.units_hash`) | **2,405** | 분석 때의 분할 버전 · 문자 경계가 지금과 같다. **원문이 같다는 증거는 아니다** — `unitsHash()` 는 분할 버전과 단위 시작 · 끝 위치만 해시한다(`scripts/csat/lib-evidence-units.mjs`). 분석 행에는 원문 해시가 없으므로 원문 결속(`csat_item_units.input_hash` 와 분석 시점 원문의 대조)은 따로 검증한다 |
  | 해시는 있으나 지금 단위와 다름 | 21 | 원문 · 분할이 바뀐 뒤 — 다시 대조 |
  | 해시 없음 | 982 | 정본 단위가 없는 802 포함 — 단위 생성부터 |

  선지별 좌표(`confirmed_at.sentence_index` — 정답 2,629 · 오답 112개/28문항)도 같은 `legacy_candidate` 다.

  기존 검사(`precheckAnalysis` · `checkUnitRefs` — `scripts/csat/lib-evidence-units.mjs` · 분석 · 검수 드레인 · 학평 검수 로더의 precheck 기록)와 검수 이력은 승격 1–2단계(§17-4)의 **근거로 재사용**한다. 그러나 해시 결속 · 기존 검사 통과를 이유로 `validated_anchor` 로 **자동 승격하지 않는다** — 새 Anchor 기준(필드 · 분할 버전 · 출처)으로 한 번 대조한 결과만 올린다.
- **승격 순서**(rev2.1):

  ```
  legacy_candidate
    → 원문 정체성 확인(source_text_version · source_text_hash 가 지금 본문과 같다 — 경계 해시 일치는 이 단계가 아니다)
    → 유일한 위치 확인(unit 또는 신뢰 가능한 문자 범위 · 중복 인용 아님)
    → validated_anchor
    → 사람 확인(표본 · 검수)
    → reviewed_anchor
  ```

  기존 `precheckAnalysis` · `checkUnitRefs` 통과는 위 단계의 **입력 근거**로 쓰지만, 통과만으로 자동 승격하지 않는다. 경계 해시 일치 2,405건도 자동으로 `validated_anchor` 가 아니다. 해시 불일치 21건은 **우선 조사 대상**이고, 해시 없음 982건은 그 자체로 오류라는 뜻이 아니다(분석 당시 정본 단위가 없었던 문항 포함).
- **승격 금지 조건**: 위치 좌표 없이 `quote_hash` 만 있는 후보, 같은 인용이 지문 안에 두 번 이상 나와 위치가 하나로 정해지지 않는 후보는 `validated_anchor` 로 올리지 않고 **보류**한다(인용 해시는 대조용이지 위치가 아니다).
- **item_tagged 근거로 쓸 수 있는 최소 상태는 `validated_anchor` 로 제안한다**(학생 진단에 영향을 주는 표시는 `reviewed_anchor` 부터 — 구현 때 결정). legacy_candidate 는 item evidence 로 승격하지 않는다.
- 실측 근거: 정본 단위 2,910문항 · 본문 온전한데 단위 없는 문항 802 · 설계 주석 447 · 주석과 정본 단위가 겹치는 문항 **0** · 주석 기준 v1–v1.3 혼재.

### 17-4. 정답 근거 3,408문항(`sentence_index` · `quote` · `how_to_reject`)의 승격 조건

E2 · E3 의 좋은 후보 원천이지만 바로 item_tagged 근거로 쓰지 않는다. 순서:
1. `quote` 가 정본 텍스트에 그대로 있는지 대조
2. `sentence_index` 가 어느 분할 기준의 번호인지 확인(정본 단위와 대응)
3. 정답 근거 · 오답 배제 설명의 출처(분석 버전 · 생성 방식) 확인
4. 일부를 사람이 표본 검증
→ 통과한 것부터 `validated_anchor`(→ 사람 검수 뒤 `reviewed_anchor`)로 올리고, 그때부터 E2 · E3 item evidence 후보로 쓴다.

## 18. UI — 지금 바꿔도 되는 것 · 보류

**별도 승인 후 바꿀 수 있는 것**(이 문서는 제안만 한다)
- 핵심 카드 표시명: 어휘 → **어휘 · 표현**, 문장해석 → **문장 이해**, 독해 → **글 이해**, 근거판단 → **근거 판단**, 듣기, 실전 실행 → **실전**.
- 카드 설명 문구를 §2 정의로(예: 글 이해 = 「문장들을 이어 글 전체의 의미를 만드는가」 — 「키워드 찾기」 느낌을 빼고).
- `.agent-goal.md` 에 vNext 목표 구조를 적는 것.

**데이터 확보 전 금지**
- 하위 능력(V1 … X4) · 통합 관찰(*-O1) · 가로 측정 차원 · LP · facet(관계 · 기능 · 중심 의미 · E3 판단)의 수치 · 막대 · 색 표시. K · Performance Context 의 막대.
- 「병목」 「취약」 「약점 확정」 표현 · route 확정.
- 오답 원인 확인 → 축 · 하위 능력 상태 변경.
- 54라인 지도를 하위 능력 지도로 바꿔 보여 주기(근거가 유형 상속이라 같은 문제가 반복된다).
- 하위 능력 DB · mastery 계산 · 마이그레이션.

## 19. 이번에 바꾸지 않은 것

Phase 1 핵심 지도 계산 · rule_proxy 관찰 로직 · 학생 기록 · Record Quality Guard · 오답 원인 DB · 코드북 rev3 · 사람 dry run 자료 · taxonomy seed · outcome 마이그레이션 · verified diagnosis · route 결정 · 과제 162 · Pilot.

## 20. 확정 · 보류(rev2.1)

**승인(사용자 2026-10-04)**: S7 → S-O1 · R5/R6 → Central Meaning · A6 → K(ontology — 지금 R proxy 계산은 legacy 유지) · D/J 재분류 · 54라인 retain/facet/move/alias/retire 구조 · `authoring.*` / `learning.*` namespace 분리 · Evidence Anchor 전제 · E4–E7 → E3 facet · 통합 관찰 namespace(*-O1) · `cause_adjudicated` 도입과 cause 상태 세 단위 · X 원인 우선순위 자동화 보류 · X 에서 Processing Fluency 제거(→ 가로 측정 차원) · 영구 ID = semantic slug.

**보류(데이터 · 다른 작업 결과가 와야 정한다)**
1. **R1 ↔ R2 변경** — 오답 원인 rev3 의 `R.reference` · `R.relation` 사람 dry run 결과 뒤. **사람 dry run 이 끝날 때까지 오답 원인 ontology 를 바꾸지 않고, 두 ontology 를 동시에 바꾸지 않는다.**
2. **R3 ↔ R4 병합 여부** — 지금 별도 유지(R3 local functional role · R4 global organization). **하향 조건**: Gold item tagging 에서 R4 가 R3 와 독립으로 관찰되지 않으면(같은 문항 · 같은 근거로만 함께 나타나면) R3 를 R4 의 facet 으로 내린다.
3. **E-O1 실제 관찰 가능성** — 정답 + 충분한 과정 근거가 있는 사례가 실제로 모이는지(§3 E).
4. **X 실행 근거 모델** — 문항별 시간 · 중단/재시도 · 순서 · 전체 시간 · 집중 자기보고. 그 전에는 X 원인 우선순위 없음.
5. **L 세부 ontology** — v0.2-listening.
6. **번호 표시 순서** — 영구 ID 는 slug 로 정했다. 표시 번호(V1 …)의 최종 순서는 구현 때.
7. **authoring 대응의 「부분」 항목**(§17-1-1) — 출제 기준 버전 고정 뒤 정의 대조.

**다음 우선순위(이 문서 밖)**: ① 사람 판정자 dry run(오답 원인 taxonomy 의 사람 간 판정 가능성) ② Evidence Anchor 표본 연구(정답 근거 3,408 · 정본 단위 2,910 을 실제로 얼마나 정규화할 수 있나 — 작은 표본으로) → 그 뒤 Gold item tagging 설계. 실제 데이터 없이 이 문서를 더 세분화하는 이익은 작다.

## 21. 자기 검토(Q1–Q13)

| 질문 | 답 · 조치 |
|---|---|
| Q1 다른 능력의 결과에 불과한 하위 능력이 있나 | **있었다** — 1판의 S6 · R8 · E8 · X6 은 통합 관찰로 내렸고(rev2 에서 S-O1 · R-O1 · E-O1 · X-O1 namespace), S7 은 S-O1 에 흡수, R5/R6 은 병합. R4 는 독립 근거와 하향 조건을 적어 유지(§20 보류 2), X1 Processing Fluency 는 rev2.1 에서 가로 측정 차원으로 내렸다 |
| Q2 문항 유형을 이름만 바꾼 능력이 들어왔나 | 축 · 하위 능력 이름에 유형(빈칸 · 순서 · 삽입 · 요약 · 함축)은 없다. 단 E4–E7(범위 · 강도 · 극성 · 관계 일관성)은 선지 함정 계열과 같은 축이라 능력으로 두면 C 를 다시 능력으로 섞는다 → **E3 facet 으로 내렸다** |
| Q3 cue 를 능력으로 올렸나 | 연결어 · 반복어 · 핵심 문장 찾기는 cue/과제로 분리(§9). 지금 과제 이름 중 「연결어 방향 표시」(A3) · 「인과 화살표 그리기」(C4)는 cue 훈련 과제다 — 과제로는 유지 가능, 능력 이름으로 쓰지 않는다 |
| Q4 여러 축을 가로지르는 기능을 한 곳에 넣었나 | paraphrase(V4 · R2/R3 · E3), 자동화(가로 측정 차원 — rev2.1 에서 X 밖으로), 관계 facet(R2 · E3)을 가로 개념으로 뒀다. A4 「재진술」 라인 해체 제안(짝 문서) |
| Q5 Error Cause 와 mastery 를 직접 잇나 | 잇지 않는다 — `cause_adjudicated` · `cause_confirmed → Diagnostic Priority Signal → next diagnostic candidate` 만(§10 · §10-1). 대응 후보표에 경고를 붙였다 |
| Q6 rule_proxy 가 증명 못 하는 세부 상태를 UI 가 보여 주게 되나 | 하위 능력 · LP · facet 표시를 데이터 전 금지(§18). 지금 태그는 유형 상속뿐이라는 실측을 근거로 적었다(§1 · §16) |
| Q7 학년별 hard lock 이 됐나 | 아니다 — 권장 노출 범위만, 경로는 진단 근거(§15). 선수 관계도 잠금 대신 우선순위(§6) |
| Q8 기출 분석 방법을 능력과 섞었나 | 7단계 Protocol 은 과제 안 절차(§13), 4단계는 과제 사이 생애주기(§14), 능력은 §3 — 셋을 분리했다 |
| Q9 legacy DB 행 보존을 이유로 의미 없는 개념을 vNext 에 남겼나 | 1판의 「54라인 폐기 0」이 그랬다 — **데이터 보존과 개념 보존을 분리**: 라인마다 retain_core · retain_as_facet · move_layer · legacy_alias · retire_from_vnext 상태를 매겼다(짝 문서 §B). D1 · D2 · D4 · D7 은 retire_from_vnext |
| Q10 출제 설계 주석 어휘와 학생 능력을 같은 객체로 취급했나 | 1판은 「역할 9 를 R3 기능 어휘 그대로」라고 썼다 → `authoring.*` / `learning.*` namespace 분리 + 동일 · 부분 · 출제 전용 · 학습 전용 대응표(§17-1-1). 변환 8 은 문항 특성(출제 전용)으로 분류 |
| Q11 통합 결과를 원자 능력처럼 번호화했나 | S6 · R8 · E8 · X6 → S-O1 · R-O1 · E-O1 · X-O1 로 바꿨다(§3 머리말) |
| Q12 기존 quote · sentence_index 를 검증 없이 근거로 올렸나 | 아니다 — 전부 `legacy_candidate`, item_tagged 최소 상태는 `validated_anchor` 제안, 승격 순서(§17-3 · §17-4) |
| Q13 오답 원인 · 선지 함정 · E3 facet 사이에 자동 추론 경로가 생겼나 | 금지를 명시했다(§3 E 표 · §10). C 와 E3 facet 은 어휘를 공유할 수 있어도 namespace · 출처가 다르다 |

## 22. (1판) 보고 형식 A–M · 지시 1–24 대응

> 1판 기준 기록이다. rev2 의 변경은 §23 에 있다 — 아래 표의 S6 · S7 · R7 · R8 · E8 · X6 · 「폐기 0」은 rev2 에서 바뀌었다.

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

## 23. rev2 변경 보고(A–L)

> rev2 시점 기록이다. rev2.1 에서 바뀐 것(X 번호 · cause 단위 · X1 제거 등)은 §24.

| | 결과 | 위치 |
|---|---|---|
| A S7 | S-O1 Sentence Meaning Model 에 흡수 — S 는 S1–S5 + S-O1 | §3 S |
| B R5/R6 | R5 Central Meaning 하나로(내부 facet centrality · theme · central_claim). Inference 는 R6 로 번호 이동 | §3 R |
| C A6 | 축 밖 K(Knowledge / Context Resource) — 막대 · 목표 · 부족 판정 · 카드 · route 자동 결정 없음. `B.outside_knowledge` 와 다른 객체 | §3 축 밖 · 짝 문서 §A |
| D D1–D9 | retire 4(D1 · D2 · D4 · D7) · legacy_alias 1(D3) · move 4(D5 → X · D6 · D8 → Pedagogy · D9 → 학습 배분/route) | 짝 문서 §B |
| E J1–J5 | J1 → X2 · J2 → X3 · J3 → X4 · J4 → Performance Context · J5 → X5(집중) + Performance Context(컨디션) | 짝 문서 §B |
| F cause_confirmed | Attempt Evidence 층의 상태 — 기존 §9 정의(축 단위 누적 · 8 조건)를 그대로 쓰고, 응답 단위 합의는 `cause_adjudicated` 로 구분. 지도에는 파생 Diagnostic Priority Signal 만(저장하지 않는 계산 모델, 문서 정의만). DiagnosisBasis 는 3값 유지 | §10-1 · §11 |
| G 통합 관찰 namespace | S-O1 · R-O1 · E-O1 · X-O1(O = integrated observation/outcome) — 숙달도 계산 없음 | §3 머리말 |
| H 54라인 | retain_core 7 · retain_as_facet 1 · move_layer 40 · legacy_alias 2 · retire_from_vnext 4. DB 행은 보존 가능, 개념은 보존하지 않음 | 짝 문서 §B |
| I authoring ↔ learning | `authoring.*` / `learning.*` 분리 · 동일 · 부분 · 출제 전용 · 학습 전용 분류 · 동일만 1:1 · 기존 ID 직접 재사용 금지. 변환 8 은 문항 특성(출제 전용) | §17-1 · §17-1-1 |
| J Evidence Anchor | 세부 태깅의 전제. 최소 필드 9 · 상태 legacy_candidate → validated_anchor → reviewed_anchor · item_tagged 최소 상태 validated_anchor 제안 · 정답 근거 3,408(경계 해시 일치 2,405 — 원문 결속은 별도 검증 · 불일치 21 · 해시 없음 982) 승격 4단계 · 기존 검사 재사용, 자동 승격 금지 | §17-2 · §17-3 · §17-4 |
| K 최종 후보 | V1–V4 · S1–S5 + S-O1 · R1–R6 + R-O1 · E1–E3(+ judgment facet 5) + E-O1 · L 보류 · X1–X5 + X-O1 · 축 밖 K · Performance Context | §3 |
| L 논쟁 | R3 ↔ R4(잠정 유지 · 하향 조건) · R1 ↔ R2(원인 쪽 사람 결과 뒤) · X1 과 자동화 가로 차원(잠정 유지 · 하향 조건) · E-O1 의 독립 관찰 여부 · 번호 확정 · authoring 대응 「부분」 항목 | §20 |

이번 rev2 도 문서만 바꿨다. 오답 원인 코드북 rev3 · 사람 dry run 자료 · 해시(코드북 `d19e04e8c70e…` · 기대 판정 `d662da16281d…`)는 그대로다.

### rev2 반대 에이전트(Codex) 설계 리뷰 — 2026-10-04 `review.mjs --plan` 6회

| 회 | 결과 | 주요 지적 → 조치 |
|---|---|---|
| 1 | P2 3 | 정답 근거 3,408 을 일괄 「검증 전」으로 둠 → 하위 구분 실측(§17-3) · A8 상태가 목적지(S5)와 모순 → retain_core · §7 화행/맺음과 대응표 불일치 → 학습 쪽에서 제외 |
| 2 | P2 3 · P3 1 | `units_hash` 는 경계만 해시(원문 아님) → 「경계 해시 일치」 · R4/X1 판단 미룸 → 잠정 유지 + 하향 조건 · `cause_confirmed` 가 기존 §9(축 단위 누적)와 충돌 → `cause_adjudicated`(응답)/`cause_confirmed`(축) 두 단계 · 「그대로 재사용」 표현 → 대응표 경유 |
| 3 | P2 3 | §9 는 V/S/R/E 만 → X 후보 미정 · `cause_adjudicated` 가 verify 기각 우선을 우회 → §9 「코드 확인」으로 정의 · 오답 선지 좌표 112개(28문항) 존재 → legacy_candidate 로 포함 |
| 4 | **P1 1** · P2 1 | D7 을 retire 하고도 Goal/Route 층 예시로 남김 → 모든 층에서 제거 · Anchor 위치 유일성 → `validated_anchor` 에 유일 좌표 필수 · 중복 인용 보류 |
| 5 | P2 2 | LP 순서가 공식 위계와 「부합」한다는 주장 → 다른 것(처리 단위 vs 성취 난이도)으로 고침 · 짝 문서가 X 원인에 우선순위 규칙 적용 → 의미상 대응만 |
| 6 | **NO_FINDINGS** | |

## 24. rev2.1 변경 요약

| | 변경 | 위치 |
|---|---|---|
| 1 | cause 상태 세 단위: `cause_adjudicated`(attempt) · `cause_confirmed`(student × axis 누적 근거, V/S/R/E, 진단 아님) · `verified_diagnosis`(student × learning skill/axis). 「cause_confirmed = Attempt Evidence 층 상태」 표현 삭제 | §10-1 · §11 · §12 |
| 2 | X 원인: `cause_adjudicated` 까지만, `cause_confirmed` · Priority Signal 에 넣지 않음 — 실행 근거 모델 뒤 별도 설계 | §10-1 · 짝 문서 §C |
| 3 | X1 Processing Fluency 제거 → 가로 측정 차원(accuracy · fluency · latency · stability, 측정 안 함). X = Time Allocation · Sequence · Recovery/Adaptation · Attention/Stamina + X-O1 | §3 X · §4 |
| 4 | E-O1: 정답 + 충분한 과정 근거일 때만 관찰 후보, 추측 정답은 근거 아님 | §3 E |
| 5 | R3 = local functional role · R4 = global organization, 하향 조건 = Gold tagging 에서 독립 관찰 안 되면 R3 → R4 facet | §3 R · §20 |
| 6 | A6: ontology 는 K 확정, 지금 R proxy(A3 + A6)는 legacy proxy only — 계산 변경은 별도 승인 | §3 축 밖 · 짝 문서 §A |
| 7 | Evidence Anchor: `source_text_version` + `source_text_hash`(원문 정체성) · 유일 위치 · 승격 순서(원문 정체성 → 유일 위치 → validated → 사람 확인 → reviewed) · 기존 검사 통과만으로 자동 승격 금지 | §17-2 · §17-3 |
| 8 | 영구 ID = semantic slug(`v.core_meaning` …), V1 · R2 번호는 display order | §3 머리말 |
| 9 | 구조도(ITEM → ATTEMPT → STUDENT × AXIS → DIRECT DIAGNOSIS → LEARNING MAP, 자동 승격 없음 표시) | §10-1 |
| 10 | 승인 · 보류 목록 · 문서 동결 · 다음 우선순위(사람 dry run · Anchor 표본 연구) | §20 |

오답 원인 코드북 rev3 · 사람 dry run 자료 · 해시는 그대로다.

### rev2.1 Codex 설계 리뷰 — 3회

| 회 | 결과 | 지적 → 조치 |
|---|---|---|
| 1 | P1 1 · P3 2 | 목적 파일이 rev2 표현(「cause_confirmed = Attempt Evidence 상태」)을 그대로 갖고 있었다 → 사용자 정정에 맞춰 목적 파일을 고침 · 짝 문서 집계의 J5 → X5 잔존 → X4 · §2 X 정의의 「자동화 관찰 자리」 → 시험 실행으로 |
| 2 | P1 1 | 경로를 `cause_adjudicated → cause_confirmed` 하나로 써서 §9 의 영역 확인 · 영역 일치가 빠짐 → `cause_adjudicated` 는 코드 확인 입력 하나, `cause_confirmed` 는 §9 ② 확인 · 영역 확인 · 영역 일치 합산 |
| 3 | **NO_FINDINGS** | |
