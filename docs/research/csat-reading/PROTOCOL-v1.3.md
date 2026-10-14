# 수능 독해 본질·v6.2 교육 엔진 연구 PROTOCOL v1.3

2026-10-14 · T-0027. 새 문항 의미 분류 전에 문서·선정코드 commit/hash 등록, source/key/input 별도 추가 동결. v1.2 전체 원장·입력·최초판정·실패·노출을 수정하지 않는다. 이전80 재해석은 개발/반증이고 새 확인자료가 아니다.

## 질문·선정

Q1 추론 종류와 실제 도출을 구별할 수 있는가? Q2 원표현/해석명제/본문지지/과제적합을 구별하는가? Q3 관계 존재와 특정 충분경로의 필요성을 구별하는가? Q4 제한 정보 경로가 실제 공급 정보에서 성립하는가? Q5 우선4TASK의 실제 관련성과 구별 경계는? Q6 양쪽 원문에서 기존 원리/교차유형의 성립과 실패는? Q7 어떤 산출물로 학생 수행을 관찰할 수 있는가?

연구기본2014~2026평가원 읽기, 본시험 우선/2014A·B 별도. 새12파일럿은2014~2024 discovery/suneung/public_v3/DB본문·발문·답일치 메타데이터 중 이전80·그 공유지문·정규화동일본문·기록된노출 제외. 목적/주제/제목/빈칸/순서/삽입/요약/어휘/어법/사실/도표/무관 각1. 책자별 선정 수 최소, 동률 SHA256(`csat-v13-20261014:`+ID) 오름차순. 답/본문 의미를 선정에 쓰지 않는다. 복원 실패는 원분모12에 보류, 임의대체금지. 목적표집이므로 모집단 빈도/효과/성공률 추정 금지. 문항·공유지문·책자 분모 분리. 2025~2026 기존 노출 보존, 미노출 선언 금지. 학평·듣기·실전 실행 검증은 별도.

원문/발문/5후보/각주/표시/도표/동일형답을 source 역할이 local PDF hash·쪽·형에 결속. 불완전성이 영향을 주는 축은 defer. 공식 다운로드계보/권리승인/인간검수와 source대조를 구별한다.

TASK 목적검토와 별도 seeded 확률표집을 구별한다. 확률감사는 가용 source-complete 제한 프레임의 우선4TASK×기존46제외, TASK별6조합을 seed202610143 균등무복원 선정. 실제N·포함확률6/N·자동positive/unknown 층분모 및선정ID를 본문읽기전 별도등록. 전체786×30을 대표하지 않는다. 원리110 중 양끝2014~2024본시험/PDF가용/우선4관련 쌍 최대8 목적선정, 적격수 부족하면 전부. 선정전본문분류금지, 나머지미검토.

## 수리한 코드

추론 다중코드: explicit_recognition(명시명제 동일의미 인식), local_bridge(국소명제 사이 빠진 연결/동일지시 도출), global_integration(비인접명제/글역할 통합 결과), background_knowledge(외부사실/관습전제 필요), numeric_operation(비교/배율/합/순위), syntax_semantics(부착/형태/부정/양화/조건 의미범위). 각코드에 target_result/missing_information/premise_anchors/derivation/external_assumption. 읽은 문장수가 local/global을 결정하지 않음. explicit+다른코드는 서로 다른 결과에 해당할 때만 병존.

후보마다 raw_expression_kind=proposition/fragment/location, normalized_proposition(연구자재진술), reference_context/확정텍스트범위. textual_support=supports/contradicts/not_determined/not_propositional. 명사구/위치 자체와 삽입후 완성명제는 별도레코드. task_fit=fits/fails/undetermined는 발문극성과 비교판단, world_truth=not_assessed(외부검증 없을때). 제거/어휘/빈칸후보를 자기지지전제로 사용금지. 주제이탈≠사실모순, 덜적합≠논리불가능. 다른정규화대상을 같은일치도 분모에 합치지 않는다.

Answer Identification(AI)와 Full Option Verification(FOV)은 다른결과; 상태 sufficient/conditional/insufficient/defer. 유일정답 관행은 AI conditional의 명시전제이며 FOV나머지4근거를 대체하지 못함. 정답일치≠충분성타당도.

충분경로는 사용문장·offset/후보/발문/각주/주어진문장/요약틀/labels/표cells·외부지시/전제·결과·허용행동(read/reorder/insert/remove/calculate/compare_options)을 기록. 관계별 두명제/방향/조건/근거, removal_test(그연결 없이 같은창에서 결과가 성립하는가), alternative_path, extra_information 기록. 관계 존재 집합과 필요집합 지표 분리. 다른충분경로를 강제합의하지 않는다.

## 파생단위·제한방법

sentence와block별개, block실제문장수·membership. Ms./Mr./Dr./약어/소수점 기계분할 뒤수동대조. boxed summary/given sentence는 의미 task stimulus이고 무료정보아님. labels는 presentation정보. 후보본문복제는 union offset 실제공급범위. 연구용표행렬≠원래시각그래프. 원문바이트보존한 새derived version만 생성, 이전ID/hash불변.

새파일럿은 수리3축과 restricted path를 집중검증하며10교수법 효과전수 재평가가 아니다. 각분류자는 AI/FOV 최소충분경로1개(가능시), 그경로의 core_sentence(완성1문장)와 selective(실제연속최대2문장/표2행·열) 상태를 기록. 전체본문을 본 뒤 고른창은 선택적읽기행동 증거가 아닌 논리경로가설. 정보/행동혼합은 단독방법으로 승격금지. TASK교육계약은10방법의 조건/반례/학생행동/확인과6자료역할을 비교, 효과모두not_tested.

## 독립·통계·반증

새문맥A/B는 동일 protocol+blindinput만 읽고 key/v3/이전판정/타분류자 결과를 첫12행 봉인전에 금지. 첫전체/부분제출 hash·시점보존후 key공개. 같은모델계열/사전학습미노출 미보장, 인간전문가 독립성 아님. 소스역할은 분류자로세지않음. 논리검토는 최초원장 별도에 결함/반례/미해결, 사후수정으로 최초일치도를 올리지 않음. 제한긍정창의 별도반증은 창정보/검토문맥 종류를 밝힘.

분모12/후보60(문항내종속). 담화·과제 요구 일치≥80%; 추론/필요관계 평균Jaccard≥70%(공집합 별도); 같은정규화대상 textual_support≥80%·κ≥.60; core/selective 상태≥80%·긍정일치≥70%·분류자별positive≥3. 단일코드κ미정은 통과 강제금지. v1.2와 코드/표본달라 개선인과로비교금지. 논리gate=(a)source완전성(b)동일판단대상(c)claimed sufficient의 실제전제·정보·범위(d)FOV5근거(e)관계제거검사. 결함/미해결주장은 numeric pass여도 VALIDITY_BLOCKED. 실패축보류후 TASK/원리/교육작업계속, 전수확인확대금지.

## 보존·제품전달

30ID/34관계/기존46검토/23580조합/110문구/749비교 역사불변. direct/indirect/not_applicable/unknown과candidate분리. R0후보/R1원문AI/R2콘텐츠검수공개/R3직접과제/R4학생관찰/R5교수효과를 주장별 구별. 이번결과 최고R1 또는계약후보이며 학생상태·숙달률·점수예측·총필요량·자동처방 근거아님. RESEARCH_COMPLETED/VALIDITY_SUPPORTED/VALIDITY_BLOCKED/PRODUCT_HANDOFF_READY 범위별독립보고. UI/DB/v3/다른worktree/main 변경하지 않는다.
