<!-- docs/research/csat-reading/V12-E-TASKS.md -->
# E. TASK 구조·관계 감사

2026-10-14 · [정본 원장](./data/v12/task-relation-review.json). 원천 rev4 영구ID 유지.21비보류=18원자후보+3통합관찰, hold9=L4+X5. 단일 AI의 원문 결속 논리 감사이며 심리측정 독립성·학생 효과 검증은 아니다.

## TASK30 판정

| TASK | 영구ID | 종류/기존상태 | 연구판정 | 근거와 제한 |
|---|---|---|---|---|
| V1 | v.core_meaning | atomic/canon_candidate | 유지 | 독해의 정답은 V1 인출 성공 증거가 아니다. 의미 카드 인출의 정성 응답과 S/R/E 통합 수행을 각각 남긴다. |
| V2 | v.contextual_sense | atomic/canon_candidate | 정의 수정 | V2는 뜻 후보 선택, R2는 선택된 명제의 관계, E3는 후보 적합성 판정. 문맥 범위가 넓을수록 V2 단독 관찰의 혼입을 기록한다. |
| V3 | v.multiword | atomic/canon_candidate | 유지 | 덩어리의 관습 의미(V3)와 문법 단위 경계(S2)는 다르다. 배틀/회복의 글 의미를 맞혔다는 결과만으로 덩어리 접근을 확인하지 않는다. |
| V4 | v.semantic_relation | atomic/canon_candidate | 유지 | V4는 표현 쌍 수준, R2는 두 명제의 재진술 관계, E3는 주체·범위·극성·발문을 보존한 후보 적합성. 세 namespace 자동 통합 금지. |
| S1 | s.sentence_core | atomic/canon_candidate | 유지 | 뼈대 표시는 S1 관찰; 전체 명제·핵심/부가 구성은 S-O1. 수식/범위 오류가 있는지 별도 응답으로 확인한다. |
| S2 | s.chunk_boundary | atomic/canon_candidate | 판단 보류 | 경계(S2)와 피수식 대상(S3)을 분리해 묻는 구별 과제 전 독립 원자성 확정 안 함. ID 보존; 통합 승인 없음. |
| S3 | s.attachment | atomic/canon_candidate | 판단 보류 | 피수식 연결(S3)은 경계(S2)와 분리 관찰할 가치가 있으나 통계적 독립성/교육 효과 없음. S-O1의 올바른 풀이만 보고 S3 정답을 역산하지 않는다. |
| S4 | s.structural_relation | atomic/canon_candidate | 유지 | S4는 문장 내부 조립 관계, R2는 명제 사이 관계. S5의 극성/범위와 겹치는 경우 서로 다른 응답으로 기록한다. |
| S5 | s.form_scope | atomic/canon_candidate | 정의 수정 | 어법 전체 정오는 여러 문법 위치의 통합 판단이다. S5 형태/범위별 설명을 직접 묻고 원자 점수 평균·하위 facet 막대를 만들지 않는다. |
| S-O1 | s.o.sentence_meaning_model | integrated/canon_candidate | 유지 | kind=integrated. 원자 성취 평균·숙달 막대 없음. 올바른 번역의 누적만으로 각 S 원자의 결손/성공을 역산하지 않는다. |
| R1 | r.reference | atomic/canon_candidate | 유지 | 지시 대상 응답은 R1; 두 명제 관계는 R2. 지시구가 배열 단서를 준다는 사실만으로 전체 R4 성취를 주장하지 않는다. |
| R2 | r.relation | atomic/canon_candidate | 유지 | 관계 facet를 원자 능력으로 늘리거나 막대화하지 않는다. E3 relation_consistency는 선지 비교 차원이며 R2와 자동 변환 안 함. |
| R3 | r.discourse_function | atomic/canon_candidate | 판단 보류 | rev2.1의 R3 local/R4 global 잠정 분리 유지. Gold 독립 관찰 없고 같은 근거·동일 응답만 반복되면 R4 facet로 하향하는 기존 조건을 재검토한다. 승인 아님. |
| R4 | r.discourse_structure | atomic/canon_candidate | 판단 보류 | R4 전체 조직과 R3 국소 역할/R5 중심 의미 응답을 분리한다. 원문 패턴 annotation을 학습자 R4 성취로 변환하지 않는다. |
| R5 | r.central_meaning | atomic/canon_candidate | 유지 | R5는 선지 없이 중심 의미 생성, E3는 본문과 후보의 대응. 잘 만든 요지도 모든 후보의 범위/극성 판정을 확인하지 못한다. R4 조직 라벨 정오에서 R5를 역산하지 않는다. |
| R6 | r.inference | atomic/canon_candidate | 유지 | 추론은 표현되지 않은 연결/함축의 직접 응답으로 관찰한다. 빈칸 정오에서 R6를 자동 판정하거나 S-O1→R6 전이를 확정하지 않는다. |
| R-O1 | r.o.global_meaning_model | integrated/canon_candidate | 유지 | kind=integrated. R1~R6 성취 평균 없음; 구조도와 요지 관찰을 분리 보존하고 정답 번호에서 의미 모델을 추정하지 않는다. |
| E1 | e.task_demand | atomic/canon_candidate | 재분류 후보 | 발문 파악을 E-O1의 구성 정의로는 유지하되, 독립 능력/메타전략/과제표현 facet 여부는 미확정. 영구 ID 변경·하향 승인 없음. |
| E2 | e.evidence_location | atomic/canon_candidate | 유지 | 위치 E2와 의미 대응 E3를 별도 응답. 짧은 인용은 사용한 문장/행/열 범위가 아니며 anchor hash/좌표가 의미 근거 검수를 대신하지 않는다. |
| E3 | e.option_correspondence | atomic/canon_candidate | 유지 | V4 표현 동등성·S5 범위 이해·R5 중심 의미가 도움이 될 수 있으나 E3는 후보를 실제 자료/발문과 대조하는 별도 응답이다. judgment facets는 성취 노드가 아니다. |
| E-O1 | e.o.final_judgment | integrated/canon_candidate | 유지 | kind=integrated. E1/E2/E3 평균 없음. correct+guess는 성취 근거가 아니며 근거 있는 정답 탐지와 전체 검수를 조건별 보존. |
| L1 | l.sound | atomic/hold | 판단 보류 | 읽기 문항 정오/과정으로 L 측정 불가. 음원·대본·타임스탬프의 독립 입력 모델이 필요하며 콘텐츠 부재는 학습자 능력 결손이 아니다. |
| L2 | l.sentence | atomic/hold | 판단 보류 | 읽기 문항 정오/과정으로 L 측정 불가. 음원·대본·타임스탬프의 독립 입력 모델이 필요하며 콘텐츠 부재는 학습자 능력 결손이 아니다. |
| L3 | l.retain | atomic/hold | 판단 보류 | 읽기 문항 정오/과정으로 L 측정 불가. 음원·대본·타임스탬프의 독립 입력 모델이 필요하며 콘텐츠 부재는 학습자 능력 결손이 아니다. |
| L4 | l.respond | atomic/hold | 판단 보류 | 읽기 문항 정오/과정으로 L 측정 불가. 음원·대본·타임스탬프의 독립 입력 모델이 필요하며 콘텐츠 부재는 학습자 능력 결손이 아니다. |
| X1 | x.time_allocation | atomic/hold | 판단 보류 | 읽기 정오와 실제 시간/순서/막힘/집중 로그를 분리. 언어 속도와 운영 능력은 같은 점수가 아니다. 보류는 학습자 결손을 뜻하지 않는다. |
| X2 | x.sequence | atomic/hold | 판단 보류 | 읽기 정오와 실제 시간/순서/막힘/집중 로그를 분리. 언어 속도와 운영 능력은 같은 점수가 아니다. 보류는 학습자 결손을 뜻하지 않는다. |
| X3 | x.recovery_adaptation | atomic/hold | 판단 보류 | 읽기 정오와 실제 시간/순서/막힘/집중 로그를 분리. 언어 속도와 운영 능력은 같은 점수가 아니다. 보류는 학습자 결손을 뜻하지 않는다. |
| X4 | x.attention_stamina | atomic/hold | 판단 보류 | 읽기 정오와 실제 시간/순서/막힘/집중 로그를 분리. 언어 속도와 운영 능력은 같은 점수가 아니다. 보류는 학습자 결손을 뜻하지 않는다. |
| X-O1 | x.o.whole_test_stability | integrated/hold | 판단 보류 | kind=integrated; X 원자 평균/안정성 점수 없음. 읽기 연구로 실제 시간 조건 전체 실행을 측정하지 못한다. |

## 특히 구별해야 할7쌍

### S2-S3: 판단 보류

S2는 단위 경계, S3는 그 단위가 꾸미는 대상/사건. 경계는 동일한데 대상이 다른 응답, 경계는 잘못되었지만 대상을 의미상 맞힌 응답을 각각 관찰할 수 있는지 확인한다.

근거: 2016#23: measurable changes와 관계절의 경계 표시/changes를 꾸민다는 부착 답을 별도 요구. (main-v1.1:2016#23; L) / 2016#30: standing among the spectators 구간 경계와 Dan Tres 부착 대상은 다른 질문. (restored-v1.2:2016#30; L)

반례/중복: 올바른 전체 번역만 있으면 두 TASK가 같은 근거로 동시 성공하며 독립성 지지가 아니다.

구별 관찰: 같은 경계+다른 피수식 대상 최소쌍, 경계 제공/미제공 교차. 각 응답·도움 분리; 미노출 과제와 학생 오류 분포 아직 없음.

통합/ID 변경 승인 아님. 구별 관찰 불가능하면 통합 후보 또는 부착/경계 facet를 재검토.

### R3-R4: 판단 보류

국소 문장 역할과 전체 조직의 단위·응답이 다르다. 동일한 역할 카드 집합도 순서·위계가 달라질 수 있다.

근거: 2014A#36: 회의 사례 역할은 국소 예시, 전체는 높은/낮은 자기감시 설명 비교. (restored-v1.2:2014A#36; L) / 2023#41: 가석방·채용 사례 역할과 예측 공식→체크리스트 확장 조직을 별도 구성. (restored-v1.2:2023#41; L)

반례/중복: passage_design.roles/pattern을 그대로 재사용해 두 정답을 같은 설명으로 붙이면 독립 관찰이 아니다.

구별 관찰: 지정 구간 역할만 질문→전체 조직을 별도 질문. 역할 같고 조직 다른 평행 글 및 전체 순서 지원/비지원 조건. 현재 학생/Gold 구별 자료 없음.

rev2.1 독립 Gold 관찰 실패시 R3→R4 facet 하향 조건 유지; 이번 AI 사례로 승인/통합하지 않음.

### R4-R5: 유지

R4는 구간 연결/위계의 전체 조직, R5는 중심 명제·범위·핵심/부연 선택. 조직을 비슷하게 설명해도 중심 범위가 다르거나 요지 생성이 가능해도 조직도 일부 미완성일 수 있다.

근거: 2023#41: 공식→체크리스트 확장의 조직을 그리고 의료 사례에만 좁힌 요약을 따로 반박. (restored-v1.2:2023#41; L) / 2015#18: 명시 요약이 중심 후보를 제공하므로 완전 구조도 선행 필수라고 단정 못 함. (main-v1.1:2015#18; L)

반례/중복: 한 줄 요지와 패턴 이름만 같은 답으로 요구하면 인위적인 TASK 중복이다.

구별 관찰: 전체 구조도/요지·부연 설명을 각각 응답. 같은 중심을 다른 전개로 쓴 검수 평행 글; 동등성 아직 미확보.

개념 구별 지지이며 학생 능력의 통계 독립성/인과 선수/학습 효과 미확정.

### R5-E3: 유지

R5는 후보 없이 중심 의미 구성, E3는 실제 후보가 그 의미·범위·요구를 보존하는지 비교. 사실/안내 과제는 R5 전역 중심 없이도 E3 후보 대응 가능.

근거: 2017#21: 선지 전에 중심 의미 생성 후 객관성 요소/이데올로기 범위 후보를 대조. (restored-v1.2:2017#21; L) / 2024#28: 길이 상한 후보는 세부 항목 대응이며 중심 요지 성공을 요구하지 않는다. (main-v1.1:2024#28; L)

반례/중복: 제목 정답 하나로 R5/E3 동시 성취 추정은 불허. 선지가 제공한 중심을 반복하면 R5 독립 응답 아님.

구별 관찰: 선지 가린 요지 확정→선지 대응, 자료 의미를 미리 제공한 E3 과제도 비교. 같은 답을 중복 성취로 세지 않음.

R5가 E3를 지원할 수 있다는 논리 후보; 전 유형 필수 선수/효과 확정 아님.

### E2-E3: 유지

E2는 근거 문장/행·열의 위치·범위, E3는 후보의 의미가 자료와 같거나 바뀐 지점의 판정. 위치가 맞아도 극성/결합 절을 틀릴 수 있다.

근거: 2019#25: 중국·인도 행 찾기와 후보3의 배율/순위 절 내용-fit 판정 분리. (restored-v1.2:2019#25; L) / 2017#25: 마지막 공저 문장 위치와 단독 명제 모순/불일치 fit를 따로 설명. (main-v1.1:2017#25; L)

반례/중복: 정답 근거를 사후로 한 구절 베껴 쓰기만 요구하면 위치/대응 모두 독립 관찰 불가.

구별 관찰: 근거 제공/미제공×후보 절 제공/전체 후보 비교. all5에서는 모든 절의 근거 범위 확인. 현재 학생 교차 응답 없음.

위치 검색 지원이 의미 판단을 향상시킨다는 인과/학생 효과 미검증.

### V4-E3: 유지

V4는 표현 쌍의 의미 관계, E3는 주체·시점·범위·발문 조건까지 포함한 자료-후보 대응. 동의 표현이어도 주체/조건이 바뀌면 후보는 부적합할 수 있다.

근거: 2015#18: recover/bounce back의 가까운 뜻과 quickly가 빠진 후보의 강도/범위 보존은 다름. (main-v1.1:2015#18; L) / 2017#25: with/단독 표현 차이를 알아도 실제 공저자·책/행위 대응과 불일치 요구를 따로 판정해야 함. (main-v1.1:2017#25; L)

반례/중복: 선지 재진술의 모든 성공을 V4로 분류하면 명제·관계·과제 판단이 표현 의미 안에 과대 포함된다.

구별 관찰: 주체/문맥 고정 표현 쌍→같은 표현이나 주체/양화가 다른 후보 명제. V4/E3 응답 별도 보존.

paraphrase는 세 층의 교차 개념; namespace 자동 통합/성취 변환 금지.

### E1-independence: 재분류 후보

발문 대상·방향·판정 기준을 설명하는 수행이 독립 능력인지, 과제표현 facet/메타전략인지 검증되지 않았다.

근거: 2017#25: 거짓 후보가 불일치 과제의 정답이 되는 방향 차이. (main-v1.1:2017#25; L) / 2022#35: 주변 흐름 부적합과 사실 거짓은 다른 요구. (main-v1.1:2022#35; L) / 2024#28: 일치 발문은 참인 상한 후보를 선택. (main-v1.1:2024#28; L)

반례/중복: 유형 이름이나 부정어만 말하는 것은 발문 요구 성취가 아니다. 정답 선택만으로 요구 이해를 역산 못 함.

구별 관찰: 같은 자료/후보의 일치·불일치·대표성 발문, 발문 단독/자료 포함 조건 교차. 요구 재진술→실제 판단의 일관성을 별도 확인.

ID/기존 시도 유지. 전략/facet 재분류는 후속 판정 후보이며 이번 연구가 승인하지 않음.

## 교육 관계34 전량 검토

기존approved14는 정의상 구성 관계의 승인을 보존한다. 연구의 추가 지지는 논리적 수행 연결이며 인과·전이·학생 진단의 승인이 아니다. SUPPORTS는 필수선수가 아니므로 다른 충분 경로의 존재만으로 반증하지 않는다. PREREQUISITE·TRANSFERS_TO의 경험적 주장은 학생 자료가 없으면 증거 부족이다.

| ID | 유형·방향 | 기존 | 연구검토 | 사례 | 제한 |
|---|---|---|---|---|---|
| rel-001 | PART_OF: s.sentence_core → s.o.sentence_meaning_model | approved | 기존 승인 | 2017#21: 여러 지도 요소의 주어-서술을 보존해야 한 문장 명제를 구성한다. (restored-v1.2:2017#21; L) | 정본 §3의 명시적 통합 구성 정의 지지. 이 사례는 AI 논리 재구성일 뿐 원자들의 경험적 독립성·매 문항 필수성·인과 선수·교수/전이 효과·성취 평균을 확정하지 않는다. |
| rel-002 | PART_OF: s.chunk_boundary → s.o.sentence_meaning_model | approved | 기존 승인 | 2017#21: although 종속절과 주절 경계가 한 문장의 명제 연결을 조직한다. (restored-v1.2:2017#21; L) | 정본 §3의 명시적 통합 구성 정의 지지. 이 사례는 AI 논리 재구성일 뿐 원자들의 경험적 독립성·매 문항 필수성·인과 선수·교수/전이 효과·성취 평균을 확정하지 않는다. |
| rel-003 | PART_OF: s.attachment → s.o.sentence_meaning_model | approved | 기존 승인 | 2016#23: changes를 꾸미는 mirror관계절이 지표 명제의 조건을 한정한다. (main-v1.1:2016#23; L) | 정본 §3의 명시적 통합 구성 정의 지지. 이 사례는 AI 논리 재구성일 뿐 원자들의 경험적 독립성·매 문항 필수성·인과 선수·교수/전이 효과·성취 평균을 확정하지 않는다. |
| rel-004 | PART_OF: s.structural_relation → s.o.sentence_meaning_model | approved | 기존 승인 | 2021#42: 삽입 설명과 주절을 복원해야 첫 문장의 부정 명제를 보존한다. (restored-v1.2:2021#42; L) | 정본 §3의 명시적 통합 구성 정의 지지. 이 사례는 AI 논리 재구성일 뿐 원자들의 경험적 독립성·매 문항 필수성·인과 선수·교수/전이 효과·성취 평균을 확정하지 않는다. |
| rel-005 | PART_OF: s.form_scope → s.o.sentence_meaning_model | approved | 기존 승인 | 2024#28: cannot exceed의 경계 범위가 길이 제한의 문장 명제에 포함된다. (main-v1.1:2024#28; L) | 정본 §3의 명시적 통합 구성 정의 지지. 이 사례는 AI 논리 재구성일 뿐 원자들의 경험적 독립성·매 문항 필수성·인과 선수·교수/전이 효과·성취 평균을 확정하지 않는다. |
| rel-006 | PART_OF: r.reference → r.o.global_meaning_model | approved | 기존 승인 | 2020#37: This/Nor의 선행 명제를 연결하는 과정이 전체 비판 모델의 결속에 참여한다. (main-v1.1:2020#37; L) | 정본 §3의 명시적 통합 구성 정의 지지. 이 사례는 AI 논리 재구성일 뿐 원자들의 경험적 독립성·매 문항 필수성·인과 선수·교수/전이 효과·성취 평균을 확정하지 않는다. |
| rel-007 | PART_OF: r.relation → r.o.global_meaning_model | approved | 기존 승인 | 2014A#36: 예시와 집단 대조 관계가 전체 자기감시 설명 모델에 참여한다. (restored-v1.2:2014A#36; L) | 정본 §3의 명시적 통합 구성 정의 지지. 이 사례는 AI 논리 재구성일 뿐 원자들의 경험적 독립성·매 문항 필수성·인과 선수·교수/전이 효과·성취 평균을 확정하지 않는다. |
| rel-008 | PART_OF: r.discourse_function → r.o.global_meaning_model | approved | 기존 승인 | 2023#41: 예측·의료 예시와 일반 설명의 역할을 전체 모델에 배치한다. (restored-v1.2:2023#41; L) | 정본 §3의 명시적 통합 구성 정의 지지. 이 사례는 AI 논리 재구성일 뿐 원자들의 경험적 독립성·매 문항 필수성·인과 선수·교수/전이 효과·성취 평균을 확정하지 않는다. |
| rel-009 | PART_OF: r.discourse_structure → r.o.global_meaning_model | approved | 기존 승인 | 2020#37: 전통 목표/결함 전개 조직을 전체 의미 모델에 배치한다. (main-v1.1:2020#37; L) | 정본 §3의 명시적 통합 구성 정의 지지. 이 사례는 AI 논리 재구성일 뿐 원자들의 경험적 독립성·매 문항 필수성·인과 선수·교수/전이 효과·성취 평균을 확정하지 않는다. |
| rel-010 | PART_OF: r.central_meaning → r.o.global_meaning_model | approved | 기존 승인 | 2017#21: 지도 이데올로기의 중심 범위와 객관성 인상 설명이 전체 모델에 참여한다. (restored-v1.2:2017#21; L) | 정본 §3의 명시적 통합 구성 정의 지지. 이 사례는 AI 논리 재구성일 뿐 원자들의 경험적 독립성·매 문항 필수성·인과 선수·교수/전이 효과·성취 평균을 확정하지 않는다. |
| rel-011 | PART_OF: r.inference → r.o.global_meaning_model | approved | 기존 승인 | 2024#21: 프라이팬 비유 대응을 주의·스트레스 명제의 전체 의미 모델에 연결한다. (restored-v1.2:2024#21; L) | 정본 §3의 명시적 통합 구성 정의 지지. 이 사례는 AI 논리 재구성일 뿐 원자들의 경험적 독립성·매 문항 필수성·인과 선수·교수/전이 효과·성취 평균을 확정하지 않는다. |
| rel-012 | PART_OF: e.task_demand → e.o.final_judgment | approved | 기존 승인 | 2017#25: 불일치 요구의 방향이 최종 선택 논증의 구성 조건이다. (main-v1.1:2017#25; L) | 정본 §3의 명시적 통합 구성 정의 지지. 이 사례는 AI 논리 재구성일 뿐 원자들의 경험적 독립성·매 문항 필수성·인과 선수·교수/전이 효과·성취 평균을 확정하지 않는다. |
| rel-013 | PART_OF: e.evidence_location → e.o.final_judgment | approved | 기존 승인 | 2024#28: 후보별 안내 항목 위치를 최종 지지·배제 논증에 결속한다. (main-v1.1:2024#28; L) | 정본 §3의 명시적 통합 구성 정의 지지. 이 사례는 AI 논리 재구성일 뿐 원자들의 경험적 독립성·매 문항 필수성·인과 선수·교수/전이 효과·성취 평균을 확정하지 않는다. |
| rel-014 | PART_OF: e.option_correspondence → e.o.final_judgment | approved | 기존 승인 | 2019#25: 순위/배율 절의 내용과 불일치 fit 비교를 최종 논증에 결속한다. (restored-v1.2:2019#25; L) | 정본 §3의 명시적 통합 구성 정의 지지. 이 사례는 AI 논리 재구성일 뿐 원자들의 경험적 독립성·매 문항 필수성·인과 선수·교수/전이 효과·성취 평균을 확정하지 않는다. |
| rel-015 | PART_OF: x.time_allocation → x.o.whole_test_stability | proposed | 증거 부족 | 읽기 자료에서 지지 사례 미확보 | 전체 시간 모델/응시 규격·구성 정의 승인 전 PART_OF 승격 없음. |
| rel-016 | PART_OF: x.sequence → x.o.whole_test_stability | proposed | 증거 부족 | 읽기 자료에서 지지 사례 미확보 | 문항 이동/재진입 로그 및 구성 정의 필요; 읽기 배열 정오로 대체 안 함. |
| rel-017 | PART_OF: x.recovery_adaptation → x.o.whole_test_stability | proposed | 증거 부족 | 읽기 자료에서 지지 사례 미확보 | 2015#18 회복 지문의 의미를 시험 운영의 관찰로 삼지 않음. |
| rel-018 | PART_OF: x.attention_stamina → x.o.whole_test_stability | proposed | 증거 부족 | 읽기 자료에서 지지 사례 미확보 | 후반 오답·자가 집중 보고만으로 구성/원인 관계 확정 안 함. |
| rel-019 | PREREQUISITE: v.core_meaning → s.o.sentence_meaning_model | proposed | 증거 부족 | 2015#30: fuses/precision 의미는 문장 명제에 언어 자원으로 쓰이지만 기본 뜻 독립 인출의 필요량/선수 효과는 미측정. (restored-v1.2:2015#30; L) | 기본 뜻 지원/미지원의 과정·학습 비교 및 학생 자료 없음; 선수 잠금 금지. |
| rel-020 | PREREQUISITE: s.o.sentence_meaning_model → r.relation | proposed | 증거 부족 | 2014A#36: 사회신호 조절 명제와 회의 사례를 이해하여 예시 관계를 구성하는 경로가 있다. (restored-v1.2:2014A#36; L) | 명제 의미를 제공한 지원 조건에서 관계를 바로 배울 대안 경로; 인과 선수 확정 안 함. |
| rel-021 | SUPPORTS: r.relation → r.discourse_structure | proposed | 추가 검증 지지 | 2020#37: 도입-This, 질문-구체 응답, 추가 비판 관계가 전통 관점→비판 전개 조직을 제약한다. (main-v1.1:2020#37; L) / 2018#36: 추가 설명/전문 잡지 예시 연결을 전체 전개에 묶는 경로. (restored-v1.2:2018#36; L) | L 단계의 구조적 지원이며 R2 지도 효과→R4 향상/독립 숙달·전이 인과는 미검증. |
| rel-022 | SUPPORTS: r.discourse_structure → r.central_meaning | proposed | 추가 검증 지지 | 2023#41: 예측 공식→체크리스트 확장 구조는 의료 예시만을 중심으로 좁힌 제목을 재검토하게 한다. (restored-v1.2:2023#41; L) / 2015#18: 명시 요약으로 중심 후보를 구별하는 경로도 있어 완전 구조도를 매번 먼저 요구할 수 없다. (main-v1.1:2015#18; L) | 일률적 구조→중심 학습 순서/선수 잠금은 지지하지 않음. 구조 도움의 학생 효과·전이 및 적용 범위 미검증. |
| rel-023 | SUPPORTS: r.discourse_function → r.discourse_structure | proposed | 추가 검증 지지 | 2023#41: 예측 사례·일반 설명·체크리스트 유사 적용이라는 국소 역할들이 전체 확장 조직 설명에 쓰인다. (restored-v1.2:2023#41; L) / 2014A#36: 높은 자기감시의 일반 설명/예시와 낮은 집단 전환을 전체 비교로 묶는다. (restored-v1.2:2014A#36; L) | R3-R4 독립성은 별도 미확정. 같은 근거·응답 중복은 지원의 검증이 아님; 효과 미검증. |
| rel-024 | SUPPORTS: r.reference → r.relation | proposed | 추가 검증 지지 | 2020#37: This의 선행 목표 명제를 알아야 이를 누적 발견 서술로 연결한 관계를 설명할 수 있다. (main-v1.1:2020#37; L) / 2016#30: ④ he의 대상 Dan Tres를 알면 because절의 관중 반응 원인과 Linx 대비를 구별할 수 있다. (restored-v1.2:2016#30; L) | 원인 ontology R.reference/R.relation 변경 아님. 지시가 필요 없는 관계도 있고 학생 지도 효과 없음. |
| rel-025 | SUPPORTS: r.central_meaning → e.option_correspondence | proposed | 추가 검증 지지 | 2017#21: 객관성 인상과 이데올로기 중심을 구성하면 주제 후보의 범위를 대조하는 경로가 있다. (restored-v1.2:2017#21; L) / 2024#28: 세부 길이 상한 후보는 전역 중심 구성 없이 자료와 대응할 수 있다. (main-v1.1:2024#28; L) | 대의/전체 대표성 조건과 사실/세부 조건을 구분. 모든 E3에 R5 선행 잠금·학생 약점 추론/교수 효과 확정 금지. |
| rel-026 | SUPPORTS: e.evidence_location → e.option_correspondence | proposed | 추가 검증 지지 | 2017#25: 마지막 공저 근거 위치를 찾은 뒤 단독 후보와 의미를 비교한다. (main-v1.1:2017#25; L) / 2019#25: 중국·인도 행 및 시점을 특정해야 순위/배율 절을 대조할 수 있다. (restored-v1.2:2019#25; L) | 위치가 맞아도 극성/결합 절 판정이 틀릴 수 있음. E2 지원의 E3 교육 효과 미검증. |
| rel-027 | INTEGRATES_WITH: r.relation → e.option_correspondence | proposed | 추가 검증 지지 | 2014A#36: 예시/대조 관계를 구성하면서 연결어 쌍의 relation consistency를 비교한다. (restored-v1.2:2014A#36; L) / 2021#40: 정치 권력이 문화 간 같지 않다는 근거 관계와 not 범위를 삽입된 요약 후보에 대응한다. (restored-v1.2:2021#40; L) | 공동작동 L은 능력 동일성/학생 인과 의존·모든 유형 공동 필요를 뜻하지 않음. |
| rel-028 | INTEGRATES_WITH: v.semantic_relation → e.option_correspondence | proposed | 추가 검증 지지 | 2015#18: recover/bounce back의 표현 관계와 빠른 회복/성취 후보의 의미 대응을 함께 쓴다. (main-v1.1:2015#18; L) / 2016#23: mirror/대표 지표 표현과 제목의 탐색 상태 대응을 구별하며 함께 비교한다. (main-v1.1:2016#23; L) | V4는 표현층, E3는 명제/발문층; 동의 표현만으로 후보 전체 정답 아님. 교육/전이 효과 미검증. |
| rel-029 | INTEGRATES_WITH: v.semantic_relation → r.relation | proposed | 추가 검증 지지 | 2015#18: recover quickly와 bouncing back의 표현 연결이 회복 중요성을 다시 말하는 문장 관계의 설명 자원이 된다. (main-v1.1:2015#18; L) | quickly처럼 누락된 성분이 있어 모든 표현 쌍을 동등 명제로 승격 못 함. 공동작동 사례의 범위가 좁고 효과 미검증. |
| rel-030 | TRANSFERS_TO: v.core_meaning → v.contextual_sense | proposed | 증거 부족 | 2016#29: lacked/supported 등의 기본 뜻과 실제 호수/어업 문맥의 적합성 연결은 설명할 수 있다. (restored-v1.2:2016#29; L) | 어휘 후보 적합성은 다의어 V2와도 다름. TRANSFERS_TO 확정에는 학습→미노출 다른 문맥 과정·결과 필요. |
| rel-031 | TRANSFERS_TO: s.o.sentence_meaning_model → r.inference | proposed | 증거 부족 | 2024#21: 주의·스트레스 명제를 이해해 비유 의미를 도출하는 논리 경로가 있다. (restored-v1.2:2024#21; L) | 추론의 연결·비유 대응·외부 대안은 문장 명제만으로 보장 안 됨. |
| rel-032 | ALTERNATIVE_PATH: r.central_meaning → e.evidence_location | proposed | 증거 부족 | 2024#34: 후속 주차/통근 사례를 중심 요약으로 묶거나 빈칸 관련 근거에서 넓혀 읽는 복수 설명 후보가 있다. (restored-v1.2:2024#34; L) | R5와 E2는 과제 구성요소이지 대안 방법 그 자체가 아님. 방법 객체·경로별 범위/성공 조건을 재정의해야 함. |
| rel-033 | PREREQUISITE: e.task_demand → e.evidence_location | proposed | 증거 부족 | 2017#25: 불일치 요구를 알면 반박 근거를 찾는 방향을 정할 수 있다. (main-v1.1:2017#25; L) / 2024#28: 일치 요구는 지지 항목 검색 방향과 연결된다. (main-v1.1:2024#28; L) | 요구를 제공한 지원 조건에서 E2를 바로 평가할 수 있음. 독립 E1 진단/선수 잠금 금지. |
| rel-034 | SUPPORTS: r.o.global_meaning_model → x.o.whole_test_stability | proposed | 증거 부족 | 읽기 자료에서 지지 사례 미확보 | R-O1 독해 관찰에서 X-O1 시간·순서·회복/지속으로의 효과 자동 추론 금지; X hold 유지. |

유형 정의8개와 실제관계 기록은 다른 분모다. 현재34에는PART_OF18·PREREQUISITE3·SUPPORTS7·INTEGRATES_WITH3·TRANSFERS_TO2·ALTERNATIVE_PATH1이 있고 DIAGNOSE_WITH/REMEDIATES 실기록은0이다. 교수·평가 설계 후보를 이 유형에 연결할 수 있지만 기존34를 자동 증가·승인하지 않았다.
