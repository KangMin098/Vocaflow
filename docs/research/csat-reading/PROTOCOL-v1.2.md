# 수능 독해 본질·학습지도 연결 연구 PROTOCOL v1.2

2026-10-14, T-0026. 사용자 첨부 요청 R1~R8/A~J가 목적이다. v1.0/1.1/64문항 최초 판정과 등록 원장은 고치지 않는다. 복원24개와64문항의 재해석은 개발/반증 자료다. 새 표본 첫 분류 전에 본 파일·선정 규칙·입력 hash를 commit으로 동결한다. UI/공개 v3/DB/학습자 상태/다른 worktree/main을 변경하지 않는다.

## 범위·표본·추적

본 연구 핵심은2014~2026 평가원 읽기, 본시험 우선이다. 802보유 중774기간적격/28범위밖, 공개786은 운영 자산 분모이다. 전체45문항·듣기·실전 수행의 지원 분모로 바꾸지 않는다. 기관/시행연도/학년도/2014 A/B/공유지문/문항을 분리한다. 학평은 별도 확장이다.

새 파일럿은2014~2024 본시험의 기존64와 겹치지 않는16문항, 최소12공유지문으로 고정한다. 유형목적표집이고 대표성/최적표본크기를 주장하지 않는다. 기존32문항 최소 기준을 그대로 통과했다고 표현하지 않는 새 v1.2 개발 검증이다. 고정선정은16유형에서 각1개, 책자분산 우선/동률SHA256(seed csat-v12-20261014). 이전64의전체공유지문·정규화동일본문·기록된추가노출2019#27/28을 제외한다. 원문/정답/PDF/각주/표시를 분석 전에 복원·대조하고 결함은 원분모에 남긴다. 완전성이 부족하면 해당 주장을 보류한다. source 확인 완료가 인간 검수·공식 다운로드계보·교수 효과의 검증은 아니다.

2025~2026 본문/답/개별v3산문은 동결 전에 열지 않는다. R6의 전체786 자동 처리는 동결 이후에 수행하고 최근 산문을 분석자에게 출력하지 않는다. 사람/AI가 실제 읽은 검증 문항은 노출 원장에 기록한다. 기존 AI 사전학습 미노출은 보장하지 않는다.

## 9축 기본 분석

담화=practical/exposition/argument/narrative/data/mixed/unresolved. 우세 의사소통 목적을 주코드로, 형식은 보조메모로 기록한다. 전기는 사실정보를 제공하는 설명과 사건전개의 대안이 있음을 보존한다.

언어복잡성=scope/embedding/anaphora/polysemy/ellipsis/none_observed. 명제 성분은 **후보를 구별하는 결정 성분만** agent/predicate/object/polarity/time/condition/quantifier/modality로 기록한다. 등장한 모든성분을 자동 붙이지 않는다. 실제 인지 난도와 구문 길이/3점은 분리한다.

결정관계와 배경관계를 분리한다. 관계=contrast/causal/example/elaboration/restatement/sequence/reference/condition/concession/problem_solution/list/other/none. 표지어는 관계가 아니다. 서로 다른 충분 경로에 필요한 관계가 다르면 대안 경로로 보존한다. 관계의 존재와 제거시 답 구분이 유지되는지를 별도로 적는다. 그래프 수치 비교/국소형식 의존을 담화관계로 강제하지 않는다.

추론=explicit/local/global/contextual/visual_numeric/structural_grammar. 범위와 과정 성격은 중첩 가능하다. task=retrieve/stance/purpose/macro_compress/complete/coherence_order/coherence_insert/coherence_remove/referent/grammar/lexical_context/affect/quantitative. 유형명에서 의미축을 자동 도출하지 않는다.

설계 재구성은 observed/logical/hypothesis를 구분한다. 공식 개별출제기록 없이 official_documented를 사용하지 않는다.

## 판단의 기준 문맥

보기마다 context=`expression|sentence|candidate_inserted|whole_passage_role|remove_before_after|diagram|world|task`를 명시한다.

- content truth는 실제세계의 참·거짓이다. 별도 증거 없으면 `not_assessed`이며 시험지의 문장이 있다고 세계 사실을 입증하지 않는다.
- textual support=`supports|contradicts|not_determined|not_propositional`. 대상후보를 제외한 주변 확정텍스트를 기준으로 한다. 빈칸 표현자체는 not_propositional, 삽입후 명제는 candidate_inserted로 별도 평가한다. 어휘/어법의 오류표현과 제거 후보를 스스로의 진실 근거로 사용하지 않는다.
- task fit=`fits|fails|not_determined`. 불일치/잘못된 표현을 고르는 문제는 textual contradicts여도 fits일 수 있다. 주제이탈과 사실적거짓을 혼동하지 않는다.

전체 보기 검수의 각 후보 근거/실패조건은5개 모두 남긴다. 입력 경계가 손상되면 그 영향을 판정보류한다.

## 두 충분성과 정보 범위

Answer Identification(AI)은 **허용된 정보로** 정답 후보를 식별하는 논리 경로다. 공식시험의 유일정답 가정을 사용하면 반드시 `conditional` 및 assumption=`unique_correct_option`을 남긴다. 한모순/한일치로 정답 탐지는 설명할 수 있지만 미확인4개의 진위를 확정하지 않는다.

Full Option Verification(FOV)은5개 후보각각의 성립/불성립을 그 문항의 평가맥락에서 설명하는 과제다. 각 후보의 독립근거가 허용창 안에 없으면 sufficient로 두지 않는다. 시험 유일성만으로 네후보를 배제하는 것은 FOV의 입증이 아니다.

충분성 상태=`sufficient|conditional|insufficient|defer`. 실제 독립 대안 경로가 있으면 alternative_paths로 기록하고 최초판정을 강제로 합치지 않는다. 답 번호 일치는 충분성의 지표가 아니다.

인용 anchor와 실제 읽은 전체범위를 분리한다. 각 경로는 used_units(문장/절/블록 ID), 시작·끝offset, gloss IDs, 표 cells, 구문 의존, 지시구와 선행 대상, 필요한 관계, 발문·보기 조건을 기록한다. 해당source버전의ID만 쓴다. 원문텍스트/전체보기는 로컬전용이며 공개원장에는ID/offset/hash와 자체설명만 남긴다.

AI 분류자가 전체글을 본 뒤 특정창을 선정한 것은 **실제 선택적 읽기 행동이 아니라 설명상 경로 가설**이다. 논리검토 뒤, 가능하면 fresh window-only 검토자에게 일부 긍정경로의 창/발문/보기만 제공하여 외부정보 유입을 시험한다. 그런검사도 인간학생의 시간·정확도 효과는 아니다. 검사하지 않은 창은 `window_test:not_run`으로 보존한다.

## 비교할10방법과 입력 제한

1 contrast: 대비하는 두명제만 사용. 동일차원/주체/범위와방향을지정한다. 예시·인과·전역내용을몰래추가하지않는다.
2 core_sentence: 실제한완성문장. 외부지시대상복원은추가정보로표시한다.
3 selective: 제시순서상 연속최대2문장/실용항목 또는지정표2행/열. 확대읽기는별도적응적경로이며 제한전략성공으로소급하지않는다.
4 incremental: 제시순서대로 의미·참조를누적수정. 재배열·수치계산이필요하면추가행동으로기록한다.
5 syntax: 한국소구문 의존/수식/범위와어휘의미. 외부동일지시전제는명시한다.
6 meaning_units: 필요한절/구를의미단위로묶어주체/술어/대상/조건을구성. 경계만그리는것과이해를구별한다.
7 proposition_relations: 실제두명제와논리관계/방향을명시. 키워드일치는근거가아니다.
8 structure_reconstruction: 원문블록/문장역할·배열을복원. 필요한선행내용/단위와대안배열반례를지정한다.
9 evidence_option_comparison: 발문기준에따라각후보를실제근거와대조. FOV에는5개별검증이필수다.
10 type_specific: 유형은출발정책이며세부정오를보장하지않는다. 사용한유형규칙·실제추가이해·실패조건을기록한다.

각방법에 AI/FOV 상태,window/pathID,선행이해,적용조건,반례,대안경로,효과=`not_tested`를남긴다. 전체5보기검증이가능한방법조합은단독방법과구분한다.

## 독립 검증과 확대 gate

두 fresh AI 문맥에 같은 고정입력/프로토콜만 제공한다. key/v3/이전64판정/다른분류자는 첫 완성본 동결전 열지 않는다. 첫16행과 부분초안을 보존하고hash/시점을기록한 뒤정답을공개한다. source검토자는key를읽는별도역할이다. 같은 설정/사전학습노출/자기보고한계를밝힌다.

축별명목원시일치/κ/교차표,관계/추론Jaccard,희소범주·긍정판정일치를보고한다. 전략별AI/FOV를따로측정한다. 긍정=sufficient/conditional의두집합; positive agreement=2a/(2a+b+c), 긍정관찰없음은null이며통과가아니다. unresolved/defer와 빈 집합은확대성공에포함하지않는다.5선지는문항내종속이며지문군집구간은목적표집의기술적구간이다.

작업문턱: 담화/요구원시≥.80, 결정관계/추론평균Jaccard≥.70, 전략별AI/FOV exact≥.80 및긍정agreement≥.70. 양쪽각각긍정최소3문항,≥2유형, κ≥.40 또는미정의시미통과. 근거/범위/결속오류0, 미해결≤10%, 해당주장source입력complete. 실제논리검토에서반례가남는긍정경로는타당성통과로세지않는다.16소표본의수치문턱은준비판정이며전체독해법검증이아니다. 실패축은원자료보존·수정대상보고, 전수새의미분석을확대하지않는다. R6~R8의기존자료후보추출/교육설계는독립진행가능하나후보를검증관계로승격하지않는다.

## 기출→TASK·관계·원리·교수 계약

rev4영구30ID를유지한다.21비보류=원자후보18+통합관찰3, L/X9보류는측정공백이다. 기존34관계의14approved는구조승인을보존하고연구재검토상태를별도둔다. co-occurrence는인과선수/전이증거가아니다.

전체786×30은 relevance=direct/indirect/not_applicable/unknown. 미검토/태그부재는unknown, not_applicable은실제검토이유필수. 자동추출은 candidate_relevance만제안하고 relevance를승격하지않는다. 각행은item/분석버전/units_hash/source버전/TASK/관련이유/근거/충분성/반례/검수/이견/공개가능성을분리한다. 원리110은기존비교쌍의bounded110객체로,문항별786원리와분모가다르다. 교차유형749쌍0을확인하고실제개발표본의대조사례만추가후보로별도등록한다.

TASK독립성7쌍,전체30의교수/자료역할/직접확인/전이/지연확인 및R5/E3/S5/V2상세화를작성한다. TASK관찰 도구설계와 실제학습자 수준은다른층이며효과/숙달/점수기여량은추정하지않는다. 일괄2문항판정규칙·정답률→숙달확률·통합TASK원자평균을금지한다. 콘텐츠재고≠필요학습량,지원공백≠학생결손.

v6.1로연결할6논리모델은 DomainTaskModel,ExamReasoningModel,TaskEvidenceProfile,GoalRequirementModel,InterventionModel,GoalCoverageLedger이며 실제문서의다른이름은명시적crosswalk로연결한다.새DB나학습자엔진은만들지않는다. 기출/영역TASK/원리반례/교수/교재/직접확인/미노출전이/지연확인의8coverage는지원됨/일부지원/미지원/미확인으로분리한다. 정의/재고만으로지원됨을인정하지않는다.

## 산출과 미확정

A 본질v1.2, B 복원24, C 전략AI/FOV, D786×30원장, E TASK/34관계, F110원리/교차유형, G교수교재, H평가루브릭, I8coverage, J6모델적용계약을별도작성한다. 모든결과에원천버전/ID/검수/미해결을기록한다. 최종보고는확정가능한연구결과/설계활용결과/추가가설/문항연구로해결불가문제를구분한다. 인간전문가/학생실험/공식다운로드계보가없으면그대로미확정으로남긴다.
