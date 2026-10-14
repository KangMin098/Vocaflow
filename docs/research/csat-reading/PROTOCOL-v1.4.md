# PROTOCOL v1.4 — 판단 대상·관계 필요성과 교육 과제

2026-10-14 · T-0028 · research/csat-reading-v14. v1.3base0810d44ef의98artifact와 최초판정/노출은 불변. 새본문의 의미 분류 전에 이 규칙·selector·metadata선정hash를commit으로 동결하고 source/input/keyhash를 추가 동결한다. 과거91독립문항/노출자료는 개발·반례이며 새확인자료가 아니다.

## 질문·자료·선정

Q1 동일 raw후보에서 주체/술어/대상/한정·조건을 보존한 동일판단대상을 식별하는가? Q2 entailment/contradiction/undetermined와 best-fit/task polarity를 구별하는가? Q3 존재/사용/경로필수/대체가능/미확정을 구별하는가? Q4 실제유효정보로 AI와FOV를 각각 설명하는가? Q5 핵심4TASK 구별·교수·직접응답·루브릭은 무엇을 관찰하며 어떤 원문이 지지하는가?

2014~2024 본시험의 이전분류91·공유지문·정규화동일본문·명시노출·source원장에 기록된 인접페이지·원리문구의 기존끝점노출을 제외한다. 2025~2026/학평/듣기는 새표본밖이며 최근70전파노출을 유지한다. source metadata 조사 revision을 보존한다. 최종selector는 topic/title/blank/order/insert/remove/vocab/summary 각1을 계획하고 책자별선정수최소/동률SHA256(seed csat-v14-20261014:+ID)로 선정한다. 해당type 적격0이면 사전missing층으로등록하고 허위8을채우지 않는다. 본문/답/해설의미는 선정에 사용금지. 원문복원이 실패하면 첫선정분모에defer, 임의대체금지. 목적표집·소표본이라 모집단분포/효과/최적표본수 주장금지.

선정전 노출확인은 metadata-only이다. 기존공식PDF원천의 어느문항이 어느쪽에 있는지를 기계탐지할 수 있지만 문항본문을 연구자의미입력으로 출력하지 않는다. 이전source전체페이지 접근은 보수적제외, 기존110문구검토의끝점도제외한다. 문항·공유지문·책자 분모를 분리한다. 전자료원문/발문/5후보/각주/제시형/동일형키/hash를 source역할이 대조한다. 완전성검사는 공개권리/인간전문가검수/학생효과가 아니다.

## 동일 판단 대상 계약

각후보 `semantic_target={raw_kind,raw_reference,action,target_class,normalized_assertion,facets,source_context,comparison_standard}`를 기록한다. facets는 agent/predicate/object/polarity/comparison/quantifier/time/condition/scope/modality(없으면null). 본문영역과 시험 발문범위는 별도이다. 자료주장에 없는 원인·강도·전체성·동일성·시점을 정규화에 추가하지 않는다. 조건when과because, 개선과동일성, 내용사실과삭제적합성이 같지 않다.

target_class=`content_assertion|completion_assertion|macro_coverage|lexical_assertion|placement|form`.
- remove: 다섯원문문장의 내용은 content_assertion이며 삭제적합성은 task_fit에만 기록한다. ‘이문장을삭제해야한다’를 본문내용의 textual_support로 평가하지 않는다.
- order/insert: 위치/배열은 placement이고 normalized_assertion=null/textual_support=not_propositional. 별도 `coherence_reason`에서 지시/순서/역할 제약을 검토한다. 연구자의배열조작명제를 원래내용명제처럼 만들지 않는다.
- title/topic: 원명사구는raw_kind=fragment. macro_coverage의 대상·범위·중심서술을 자체풀어쓰기하며 원표현과재구성대상을 구별한다. 논리적내용지지와 글전체에가장맞는후보를 구별한다.
- blank/summary: raw fragment와후보삽입후의완성명제를 별개로 기록한다. 원래본문의 불완전구문과 완성명제의unit재구성도 구별한다. 의미정보인요약틀/주어진문장은 무료부가자료가 아니다.
- vocab: 대상단어의뜻/문장의그단어포함명제/그표현의담화적합성을 구별한다. 뜻의불일치나덜적합이 항상 사실적모순은 아니다.

textual_support=`supports|contradicts|not_determined|not_propositional`, task_fit=`fits|fails|undetermined`, world_truth=`not_assessed`(별도외부검증없으면). tested 후보를 자기지지전제로 사용하지 않는다. 실제세상의참거짓과 글의주장은 별개. comparator가best_fit면 덜적합을 entailment반례로 바꾸지 않는다. 해당정규화에둘이의미동등한지는 context_key외에 action/주체/조건/범위/평가표준을 제3AI가 직접검토한다.

## 관계·충분경로 계약

매관계는source proposition IDs/방향/조건·target/path별 `exists/used/necessary_in_path/replaceable/unknown`을 독립필드로기록한다. necessary라면 분명한removal_test가 있어야 한다. 테스트의 preserved_propositions/preserved_scope/disabled_inference/changed_other_information/target_after를 기록한다. 관계를쓰지않는 경로가 같은자료에서 같은AI/FOV목표를 달성하면 그목표에필수라고 하지않는다. 다른경로가추가자료를요구하면범위차이를적는다.

글의일부나부정/조건을삭제해명제가바뀐검사는 관계하나제거검사로계산금지. 관계가문장내용에통합돼독립제거불가능하면 `test_validity=not_identifiable`/필요성unknown이다. 내용명제는보존하면서 관계도출만억제한 계산검사와, 문구를바꾼가상본문은 다른객체. 일반부정논리나모든인간경로에대한필요성증명이아니다. 보기와같은명시명제가있으면 직접대응대안도허용한다. 대안경로를사후강제합의로삭제하지 않는다.

AI(한정답식별)/FOV(각5내용·적합검수)는別목표. sufficient/conditional/insufficient/defer. 유일정답관행은AI의명시conditional전제이지나머지4근거가아니다. `used_units∪stimulus_units`중복제거/본문복제후보union/각주/labels/표행·열·단위와값/외부지시를 실제정보로 기록한다. 모든선택후보정보와본문정보를 구별하고숫자열2개가전체표일수있음을밝힌다. 정답찾기가최소정보·읽기속도증명이아니다.

8전략(core/contrast/incremental/syntax/selective/proposition_relations/structure/evidence_compare)은 같은정보·AI/FOV·허용연산·숨은전제·대안/반례 조건으로 기술한다. 실제선택적읽기학생행동·교수효과는측정하지않는다. 전체8방법을새표본마다전수효과실험했다고하지않으며경로별실제로쓴방법만검토한다. 교육4패키지는 기존10방법을재사용해조건과산출물을고도화한다.

## 독립성과 게이트

새A/B는fork-none AI문맥에서 동일blindsource+protocol+instructions만읽고 key/v3/기존판정/타분류를첫전체봉인전금지. 첫부분/첫완성hash·시점과답공개시점을기록한다. 동일모델계열·사전학습미노출/인간전문가 독립성 미보장. source/교육/원리연구자와분류자를분리한다. 이후새논리검토자는두최초판정의동일대상/반례를별도원장으로판정, 최초수치를덮지않는다.

등록 gate: 동일target 판정가능비율≥90%; 동등대상의 propositional textual_support 일치≥80%·κ≥.60·검증가능한내용type≥3; placement의형식적not_propositional일치를내용타당성수치에넣지않는다. task_fit≥80%. 동일AI목표의경로필요관계집합Jaccard≥70%, 공집합별도; 경로/명제/방향이비교불가능하면모두분모에서지워PASS로복구하지않고미확정기록. 복수충분경로합의도를능력성공률로부르지않는다. source완전/정규화의미보존/동일목표/모든sufficient근거범위/FOV5unique/관계제거불변성의논리gate를각각보고한다. 수치PASS만으로확인확대하지않는다.

개발3반례(2019#35/2021#30/2015#32)는기준개발·합성변형/최소반례, 새검증분자0이다. 지지·불일치·보류·최초와사후차이를보존한다. 실패축은차단후교육패키지/매핑/교차원리연구계속. 학생/인간자료없으면해당검증단계는미지원이다.

## 교육·매핑·제품 계약

핵심4교육패키지는14필드와6자료역할, 실제기출기반prompt/자체gold/부분답/동등대안/잘못된답/판정보류·facet루브릭·혼동대조를 만든다. 직접확인/전이/지연은public·권리·채점·학생별미노출자격확보전설계후보. 이전자료를훈련후같은학생미노출로배정금지. 연구노출≠학생노출, 실제응답0/효과0/공통숙달cut점없음.

매핑은source완전기존59문항×4/이전74조합제외의제한프레임197에서TASK별목적2+seeded random4=24(등록map-selection.json). 목적층과조건부무작위층/포함확률을따로보존한다. 첫수동24와새문맥24재검토의불일치/원문완전/자동후보과잉·미후보직접·보류를분리하며 전체precision누락률이아니다. 과거74불변·최신revision은독립결과를삭제하지않는별도견해다.

bounded110의가용층은v13검증1/키보류1/미시도108로보존, 다시읽기를새검증분자에합치지않음. 신규교차비교는별도후보. 30ID/34관계 승인/공개v3/UI/DB/학생상태/다른worktree/main불변. A교육구조/B기출판단/C교수교재/Dcoverage/E금지해석을JSON+문서로전달한다. R0설계/R1원문AI/독립논리검토/콘텐츠공개/직접과제/학생반응/교육효과는별도상태이며R1을자동NeedRank·학생결손·숙달·예측점수·총필요량으로승격하지않는다.

새원문·원래정답·후보별fit/상세Gold는 ignored local/v14에만 저장한다. 공개Git 원장은출처hash/비식별판정집계/자체합성 예와설계계약으로제한하고상세private자료의참조/hash를결속한다. 공개파일에서answer/solved_answer/selected_option/원래정답키/기출Gold·전체본문/후보별task_fit을재배포하지않는다. 기존v1.3자료를지우는변경은하지않는다.
