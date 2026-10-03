# 코드북 검토 보고 — 20코드 초안 → v0.1 candidate (2026-10-04, 승인 게이트 자료)

> 이 문서는 승인 게이트(A–J)에 답한다. 코드 정의 본문은 [CODEBOOK.md](./CODEBOOK.md), 사례는 [CASES.md](./CASES.md), dry run 수치는 [DRY_RUN.md](./DRY_RUN.md), 근거는 [SOURCES.md](./SOURCES.md).
> DB 시드 · 마이그레이션 · Pilot 없음.
>
> **상태(2026-10-04)**: 사용자가 「사람 판정자 검증 전 v0.1 candidate」로 승인. seed 금지 유지. outcome 4종을 확신도가 아니라 증거 기준으로 다시 정의하고(CODEBOOK §2), rev3 를 고정해 사람 dry run 을 준비했다 — [HUMAN_DRY_RUN.md](./HUMAN_DRY_RUN.md). 아래 G 의 모델 수치는 개발 자료이며 사람 신뢰도 근거가 아니다. 사람 dry run 결과로 코드별 유지 · 병합 · 분리 · contributing 전용 · 은퇴를 정한다(R.reference/R.relation · S.attachment 는 그때까지 병합하지 않는다).

## A. 20코드 초안 → 후보 taxonomy

| 이전(20) | 후보 | 변화 |
|---|---|---|
| `V.unknown_word` | `V.unknown_word` | 유지 — 「뜻을 얻지 못함」으로 정의를 좁힘 |
| `V.word_sense` | `V.wrong_sense` | 이름 변경 — 「아는 다른 뜻으로 처리」(빈칸이 아니라 틀린 뜻이 있다는 증거) |
| `V.chunk` | `V.multiword` | 이름 변경 — 사전에 있는 고정 표현만(글쓴이 비유는 R.inference) |
| `S.core` | `S.core_structure` | 범위 넓힘 — 주어 · 동사 · **절 경계** · 생략 · 도치(이전 `S.clause_relation` 의 절 경계 부분 흡수) |
| `S.modifier_scope` | `S.attachment` | 이름 변경 — 꾸밈 · 병렬의 연결 대상(범위라는 말은 연산자와 겹쳐 뺐다) |
| `S.clause_relation` | — | **폐기** — 절 경계는 core_structure 로, 절 사이 의미 관계는 R.relation(문장 사이)과 같은 판정이 반복돼 경계가 서지 않는다 |
| `S.negation_comparison` | `S.operator_scope` | 넓힘 — 부정 · 비교 · 조건 · 양보 · 정도 연산자 |
| — | `S.form_rule` | **신규** — 어법 문항에서 구조는 맞게 보고 형태 규칙을 틀린 경우. 이전 초안은 어법 오답을 받을 코드가 없었다(「grammar_point 는 원인과 대응하지 않는다」만 있었음) |
| `R.reference` | `R.reference` | 유지 |
| `R.sentence_relation` | `R.relation` | 유지(이름만) |
| `R.main_idea` | `R.main_point` | 유지 — 정의를 「중심 · 위계 판정」으로 |
| `R.inference` | `R.inference` | 유지 — 글 안 근거에서의 추론만(글 밖은 B) |
| `E.question_demand` | `E.task_misread` | 유지 — X.attention 과의 경계 규칙 추가 |
| `E.evidence_location` | `E.evidence_location` | 유지 — dry run 에서 관찰 여부 확인 대상 |
| `E.paraphrase_match` | — | **폐기(병합)** — 재진술을 못 알아본 이유가 V · R · E 로 나뉘고 앞의 둘은 이미 따로 있다. 남는 경우만 `E.option_mismatch` 로 |
| `E.option_check` | `E.option_mismatch` | 넓힘 — 오답 수용 + 정답 재진술 거부. 「글 이해가 맞았다」는 증거가 없으면 primary 금지 |
| `B.guess` | — | **폐기** — 추측은 원인이 아니라 「무엇이 실패했는지 모름」 신호. 증거 충분성(§2) · X.time 으로 |
| `B.outside_knowledge` | `B.outside_knowledge` | 유지 — **글과 충돌하거나 글을 대신한** 배경지식으로 좁힘(공식 출제 방향이 배경지식 활용을 정상 독해로 본다) |
| `B.no_verification` | `B.no_verification` | 유지 — 시간 이유면 X |
| — | `B.surface_match` | **신규**(분리) — 이전 `B.no_verification` 이 품던 「같은 낱말이 있어서」. 이유 진술로 관찰되고 E.option_mismatch 와의 경계가 처방상 다르다 |
| `X.time_pressure` | `X.time` | 유지 |
| `X.concentration` | `X.attention` | 넓힘 — 순간 놓침 · 숫자 오독 · 표기 실수 |

합계: 유지 · 이름 변경 15 · 폐기 3(`S.clause_relation` · `E.paraphrase_match` · `B.guess`) · 신규 2(`S.form_rule` · `B.surface_match`) → **19**. 수는 목표가 아니다 — dry run 결과에 따라 아래 E · G 에서 다시 조정한다.

새로 정한 것(코드 밖):
- **증거 충분성 A0–A3**(코드와 따로 매김) · **판정 결과 4종**(identified · multiple_plausible · insufficient_evidence · inconsistent_evidence) — 「오답이니 원인을 하나 골라야 한다」는 압력을 없앤다.
- **primary = 근거로 확인되는 최초의 결정적 실패**, contributing ≤ 2, 연쇄 그래프는 만들지 않는다.
- **decision flow Q0–Q8** — 목록에서 고르지 않고 처리 단계 순서로 좁힌다.

## B. 삭제 · 병합 · 분리 이유

| 대상 | 결정 | 이유(관찰 가능성 → 개념 차이 → 처방 순) |
|---|---|---|
| `S.clause_relation` | 폐기 | 「절 경계」는 해석에서 문장 성분이 바뀐 것으로 관찰돼 core_structure 와 같은 증거를 쓴다. 「절 사이 의미 관계」는 R.relation 과 같은 질문(어떤 관계로 이어지나)이라 판정자가 둘을 가를 증거가 없다 |
| `E.paraphrase_match` | 병합 | 「재진술 실패」는 결과 이름에 가깝다. 왜 못 알아봤는지가 선지 낱말(V) · 글 이해(R) · 대조(E)로 나뉘어야 처방이 갈린다 |
| `B.guess` | 폐기 | 추측 = 실패 지점 불명. 원인 코드로 두면 「모르겠다」가 원인 집계에 섞인다 |
| `B.surface_match` | 분리 | 「같은 단어가 있어서」는 학생 이유에 자주 직접 나온다(사례 은행 77건 중 작성자가 이 기제로 쓴 것이 여럿). 「뜻을 대조했지만 차이를 못 봄」(E)과 처방이 다르다(대조 절차 vs 정밀 대조) |
| `S.form_rule` | 신규 | 어법 문항 오답의 일부는 구조 파악이 맞고 규칙만 틀렸다 — 구조 교정(S.core)과 규칙 학습은 처방이 다르다. 공식 출제 방향도 「언어형식 문항」을 따로 둔다(SOURCES A2') |

## C. 코드별 조작적 정의(한 줄 — 전문은 CODEBOOK §5)

모두 「이 attempt 에서 학생이 ___ 때문에 정답 판단에 실패했다는 증거가 있을 때」의 빈칸이다.

| 코드 | 빈칸 |
|---|---|
| `V.unknown_word` | 판단에 필요한 낱말의 뜻을 얻지 못해(모름 · 비워 둠) |
| `V.wrong_sense` | 낱말을 사전에 있는 다른 뜻(다의어 · 다른 극성 · 비슷한 철자)으로 처리해 |
| `V.multiword` | 사전에 있는 고정 표현을 낱말 합으로 처리해 |
| `S.core_structure` | 주어 · 동사 · 절 경계 · 생략 · 도치를 잘못 잡아 문장 성분이 바뀌어 |
| `S.attachment` | 수식어 · 병렬이 어느 말에 걸리는지 잘못 붙여(관찰 대기) |
| `S.operator_scope` | 부정 · 비교 · 조건 · 양보 · 정도 표현이 무엇을 얼마나 뒤집는지 잘못 처리해 |
| `S.form_rule` | 구조는 맞게 보고 문법 형태 규칙을 틀리게 적용해 |
| `R.reference` | 대명사 · 지시어 · 대용어가 가리키는 것을(문장 안팎) 잘못 이어 |
| `R.relation` | 각 문장은 맞게 읽었으나 문장 · 단락 사이 논리 관계를 잘못 이어 |
| `R.main_point` | 글 전체의 중심 · 뒷받침 위계를 잘못 정해 |
| `R.inference` | 글에 직접 없는 뜻(글이 만든 비유 · 태도 · 함축)을 글 근거에서 잘못 이끌거나 문자 그대로 읽어 |
| `E.task_misread` | 발문이 요구하는 기준(불일치 · 목적 · 밑줄의 의미 …)을 다르게 이해해 |
| `E.evidence_location` | 글은 맞게 읽었으나 판단에 글의 다른 부분을 대응시켜 |
| `E.option_mismatch` | 글을 맞게 이해했으나 선지와 글의 범위 · 강도 · 방향 · 관계 차이 또는 재진술을 못 가려 |
| `B.outside_knowledge` | 글과 충돌하거나 글을 대신한 상식 · 배경지식으로 골라 |
| `B.surface_match` | 내용어가 겹친다는 것만을 근거로 골라 |
| `B.no_verification` | (보조 전용) 그럴듯한 선지에서 멈추고 나머지를 확인하지 않아 |
| `X.time` | 남은 시간이 부족해 읽기 · 대조 단계를 건너뛰어 |
| `X.attention` | 읽었는데 순간 잘못 보거나 잘못 옮겨(not · 숫자 · 마킹) |

## D. 가장 헷갈린 코드 쌍

| 순위 | 쌍 | 근거 | 지금 처리 |
|---|---|---|---|
| 1 | **identified ↔ multiple_plausible**(코드가 아니라 확신 수준) | 2회차 경계 불일치 6건 중 5건 | R10 — 최소 증거를 갖춘 후보가 하나면 identified |
| 2 | **X.time ↔ E.task_misread ↔ X.attention** | C1-17 · C3-01 — 두 회차 모두 갈림 | R1(시간 수치만으로 X 금지) · R2(건너뜀 vs 잘못 봄) |
| 3 | **R.reference ↔ R.relation** | C3-15 · H-15 — family 는 늘 일치, 코드만 갈림 | R5 R 안 규칙. 사람 dry run 에서도 갈리면 **병합 1순위**(처방도 같다: 담화 응집 단서 훈련) |
| 4 | **R.relation · R.inference ↔ B.surface_match · B.outside_knowledge** | C2-08 · C2-09 · C2-16 | R3(앞 단계 우선) · R5(연결어 = R, 내용어 반복 = B) |
| 5 | **V.wrong_sense ↔ R.inference** | C2-01 · C2-02 · H-13 | R6(그 뜻이 사전에 있는가) |
| 6 | S.core_structure ↔ S.form_rule | C2-11 | R8(학생이 말한 구조가 틀렸나) |

## E. 평가원 · 학평 사례 범위

- 1회차 77건(문항 63): 평가원 44(57%) · 학평 33. 2회차 경계 24건: 전부 평가원. 합계 101건 중 평가원 68(67%).
- 읽기 유형 21종 전부(요지 · 주제 · 제목 · 주장 · 목적 · 심경 · 함축 · 내용 일치 · 안내문 · 도표 · 어휘 · 어법 · 빈칸 · 무관 문장 · 순서 · 삽입 · 요약 · 장문 4종).
- **같은 문항 · 다른 원인**: 평가원 빈칸 · 함축 · 순서 · 삽입 · 요약 · 어법 · 어휘 14문항은 학생 둘이 서로 다른 원인으로 틀리게 작성했고, 두 판정자 모두 14문항 전부에서 두 학생에게 서로 다른 결과(primary 코드 또는 판정 결과)를 매겼다(14/14 · 14/14) — 문항 유형이 원인을 정하지 않는다는 원칙이 표현 가능하다는 근거.
- 듣기 0 — §H.
- 도표 문항은 DB 본문에 표 값이 없어 「다른 행을 봄」 사례를 만들지 못했다(2회차 작성자 보고) — Pilot 전에 도표 문항의 증거 수집 방법이 따로 필요하다.

## F. 증거가 부족할 때

- 증거 충분성을 원인과 따로 매긴다: A0(결과만) · A1(자기보고만)은 **판정 금지 → insufficient_evidence**, A2 부터 원인 제안, A3 은 사람 확인 후보.
- dry run 에서 A0 · A1 로 설계한 8건을 두 판정자 모두 **8/8 보류**했고, 판정 가능한 사례를 보류한 것은 130건 중 1건.
- 결과 4종(identified · multiple_plausible · insufficient_evidence · inconsistent_evidence)을 정상 결과로 둔다. 자기진단과 구체 증거가 다르면 구체 증거(R4), 구체 증거끼리 동시에 참일 수 없을 때만 inconsistent(R3).
- `B.no_verification` 만 있는 경우도 원인 불명으로 본다(R11).
- **실제 학생 기록 90응답(M2409 · M2509)은 A0**(고른 번호뿐, 게다가 rq-1 일괄 입력) — 판정 대상이 아니다.

## G. dry run 일치 · 불일치(요약 — 전문 DRY_RUN.md)

| | 1회차 77건(rev1) | 2회차 경계 24건(rev2) |
|---|---|---|
| A0–1 vs A2–3 구분 | 100% | 100% |
| 결과 일치 | 90% (κ 0.72) | 79% |
| family 일치(둘 다 primary) | 96% (κ 0.96) | 100% |
| primary 정확 일치 | 93% (κ 0.92) | 94% |

**이 수치는 사람 판정자 일치도가 아니다** — 작성 · 판정 모두 언어 모델, 증거가 실제보다 깨끗하다(DRY_RUN §한계). 쓸 수 있는 것은 수치 자체보다 **반복해서 걸린 경계 목록(D)** 이다.

## H. 듣기 원인 — v0.1 에 넣지 않는다

`v0.1 = 읽기 전용`, 듣기는 `v0.2-listening` 으로 따로. 이유(CODEBOOK §8):
1. 듣기 대본 · 음성이 DB 에 없어 학생이 「어디서 못 들었나」를 남길 수 없다 → A2 증거를 만들 수 없다.
2. 코드 CHECK(`^[VSREBX]\.`)가 L 을 받지 않는다 → 마이그레이션 필요(이번 단계 금지).
3. 실패 단계가 다르다(소리 분절 · 연결 발화 · 기억 유지) — 공식 자료는 이를 다루지 않고(SOURCES A4 · 질문 3), 연구 근거(Field 2008 · Goh 2000)도 아직 검색 요약 수준이다.
v0.2 선행 조건: 대본 문장 참조 · 「못 들은 구간 / 들은 대로 받아 적기」 수집 형식 · CHECK 확장 · Goh(2000) 분류 원문 확인.

## I. v0.1 candidate — 19코드(rev3)

| family | 코드 | 상태 |
|---|---|---|
| V | `V.unknown_word` · `V.wrong_sense` | 안정 |
| V | `V.multiword` | 관찰 적음(primary 1) — 유지, Pilot 관찰 |
| S | `S.core_structure` · `S.operator_scope` · `S.form_rule` | 안정 |
| S | `S.attachment` | **관찰 0 — Pilot 에서도 0 이면 S.core_structure 로 병합** |
| R | `R.main_point` · `R.inference` | 안정(R6 보강) |
| R | `R.reference` · `R.relation` | **병합 1순위 감시** — 사람 dry run 에서 이 쌍의 일치가 낮으면 `R.cohesion` 하나로 |
| E | `E.task_misread` | 안정 |
| E | `E.evidence_location` · `E.option_mismatch` | primary 드묾 — 「글 이해가 맞았다」 증거 요건 때문. 수능 선지 판단의 핵심이라 유지, 수집 UX 에서 「글을 어떻게 이해했나」를 받아야 쓸 수 있다 |
| B | `B.outside_knowledge` · `B.surface_match` | 안정 |
| B | `B.no_verification` | **contributing 전용** |
| X | `X.time` · `X.attention` | R1 · R2 보강 |

코드 수가 20 → 19 인 것은 결과일 뿐이다. 감시 대상 둘(S.attachment · R.reference/relation)이 병합되면 17.

## J. 아직 풀리지 않은 것

1. **사람 판정자 dry run 이 없다.** 모델 판정 일치율은 상한 추정이다. 승인 전에 사람 2명 × 약 50건(합격선 제안 DRY_RUN 끝)을 권한다.
2. **rev3 미검증** — R1 · R5 · R6 보강과 R10 · R11 은 2회차 결과를 보고 넣었고 아직 판정자에게 돌리지 않았다.
3. **DB 결과값 부족** — `csat_ec_judgment.outcome` 은 `code · no_cause · insufficient_evidence · no_fitting_code` 뿐이다. `multiple_plausible` · `inconsistent_evidence` 를 저장하려면 v0.1 시드와 함께 CHECK 확장 마이그레이션이 필요하다(또는 `no_fitting_code`/메모로 임시 저장 — 권하지 않음). 판정 화면의 「여러 후보」 입력도 같은 결정에 묶인다.
4. **증거 수집 UX 가 판정 가능성을 정한다** — E family 와 R.reference ↔ R.relation 을 가르려면 학생이 「글을 어떻게 이해했나」(한 줄 요지 · 핵심 문장 해석)를 남겨야 한다. 지금 Pilot 입력(고른 이유 · 막힌 곳)만으로는 1회차의 clear 사례 수준 증거가 드물 것이다. Pilot UI 설계의 첫 질문.
5. **시간 증거** — R1 은 학생 진술을 요구한다. 앱이 문항별 풀이 시간을 자동으로 남기면 「지문을 다 못 읽었다」를 다른 방식으로 볼 수 있는지 정해야 한다(지금 기록은 시험 단위).
6. **도표 문항** — DB 본문에 표 값이 없어 위치 · 대조 증거를 받을 수 없다.
7. **공식 근거의 한계** — 평가원 성취수준 기술은 어휘 · 구문 · 담화를 오류 축으로 나누지 않는다(SOURCES 질문 2). 코드북의 V/S/R/E 구분은 공식 자료가 아니라 연구 문헌 · 기출 구조 · dry run 으로 정당화된다. EBSi 원 분석 · 학업성취도 고교 4수준 기술문은 원문을 열지 못했다.
8. **기대 판정 오류 가능성** — 기대(정답) 판정도 사람이 다시 봐야 한다(예: H-13).
