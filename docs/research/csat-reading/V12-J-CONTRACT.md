<!-- docs/research/csat-reading/V12-J-CONTRACT.md -->
# J. 학습지도 적용을 위한 논리 계약

2026-10-14 · 설계 권고(H), 제품 구현 아님. 연구 브랜치에만 보존하며 DB스키마·학습자 상태·MAP/PLAN/Workspace를 변경하지 않았다. 원천v6.1 파일과codebook의hash는 [audit](./data/v12/audit.json)에 있다. 아래는 사용자 요청의 여섯 모델과 실제v6.1 문서의 이름이 다르다는 점을 드러낸crosswalk다.

| 요청 모델 | 현재 설계의 대응 객체 | 연구에서 제공할 수 있는 입력 | 아직 제공할 수 없는 판단 |
|---|---|---|---|
| DomainTaskModel | codebook/관계·수행 프로필 | 영구TASK ID, atomic/integrated/hold, facet, 관찰 정의, 관계 기존승인/연구검토 분리 | 독립 잠재능력 확정·ID 즉시 개편 |
| ExamReasoningModel | ExamBlueprint + ExamItemReasoningPackage | 기관/학년도/형/문항/공유지문,source revision/hash, 발문·후보·근거, AI/FOV 경로,원문권리/결함/검수 | 실제 출제자의 기록되지 않은 의도·전수 타당도 |
| TaskEvidenceProfile | TaskEvidenceProfile | 관찰 과제 및 루브릭 후보, 도움/노출/시간/응답유형/근거범위의 조건 정의 | 실제학생의수행수준·숙달확률 |
| GoalRequirementModel | TargetSpec + ExamBlueprint 정책 | 목표시험/점수등급/시점/시간예산/개인초점의필드, 분석범위와 지원공백 | TASK 학습당예상점수·재고로추정한필요학습량 |
| InterventionModel | InterventionUnit |TASK/원문refs,설명·지도연습·독립확인·전이·지연역할,응답형식·난도조건·노출/권리/근거·검수·버전 | 개인별효과최적처방·검증전예상소요시간 |
| GoalCoverageLedger | GoalCoverageLedger | 8지원축 상태/분모/근거/미해결/기준버전 | 모든칸의존재를목표달성또는전시험지원으로판정 |

## 공통 필드와 유효성

원문 자료: item_id/exam_id/school_year/provider/paper_form/question_no/passage_group/source_revision/source_sha256/presentation_sha256/gloss_ids/rights_state/source_completeness를 결속한다. 연구 입력 complete와공식배포계보확정은 별도 상태다. 발문·선지·표셀·지시 대상은 각 source의unit/offset에 묶는다. 수정 시 원본을 덮지 않고 revision을 늘린다.

shared_stem_ids와passage_group은다르다. 여러문항이같은발문표제를쓰는것을같은지문이라고묶지않는다. 복원본의body/표시/offset이달라지면기존v3 units_hash의하이라이트와비교쌍binding을그대로새입력에붙이지않고재결속·재검증필요로표시한다. 현재원장은옛분석버전/units_hash와새연구입력hash를둘다보존하며자동일치/공개승격하지않는다.

이번검증의다문장block/한문장예산,질문요약틀,원문문장을반복하는후보문장은별도정보역할로표현한다. 본문unit수만으로총읽기량을계산하지않으며 stem/choice/question_fields도실제사용정보에기록한다. 유일정답가정과전역대표성가정은서로다른조건이다.

논리 자료: claim_level(O/L/H), context, textual_support, task_fit, content_truth, methods, AI/FOV, assumptions, alternative_paths, used_units/offsets/cells/glosses, first_review/후속검토, unresolved를 구별한다. 누락값은unknown이며 전체 글을 읽은 분석자의 짧은 anchor를 실제 좁은 읽기 행동 기록으로 사용하지 않는다.

학습 자료: material_role=source_analysis/model_explanation/guided_practice/independent_check/transfer/delayed_check, target_task/facet, response_mode, rubric_version, allowed_help, exposure_rule, difficulty_dimensions, rights, validation_status를 둔다. 교재역할이 달라지면 같은원문을다른학습자에게 쓸수있지만 이미본학습자에게 unseen이라고 배정하지 않는다.

관찰 자료: learner_response_ref/first_attempt_at/answered_task/rubric/evidence_range/help/exposure/elapsed_time/condition/validity_exclusions를 받은 뒤 평가한다. 시각·노출 정보가 없으면unknown을유지한다. 통합TASK에원자TASK평균을 넣지 않고, 정답률을 숙달확률로 바꾸지 않으며, 모든TASK에2문항 문턱을 공통 적용하지 않는다.

## MAP·PLAN·Workspace에 연결하는 방식

MAP은 지원 현황과 증거 범위를 표시할 수 있다. E1을 전 과제의 발문 facet으로 재분류하자는 제안, S5/V2의 내부 facet 구별, R3/R4의 잠정 독립성은 ‘연구 제안’으로 연결하고 기존ID/승인을 즉시 바꾸지 않는다. L/X공백은 읽기오답으로 채우지 않는다.

PLAN은 목표와 가용 자료의 제약을 맞출 수 있다. 목표날짜/예산은사용자입력, 교수unit은검토된후보이며 필요한학습량이나 점수상승은 별도학생검증이필요하다. 설명·연습·독립·전이·지연을 같은진도수치로 합산하지 않는다.

Workspace는 원문 제시형/각주/표/밑줄과 분석근거를 일치시켜 보여줄 수 있다. 정답을 찾는 연습과 각 후보의 성립을 설명하는 연습을 구별하고, 제한창 밖 지시 대상이 필요한 경우 범위를 확장하거나 판단을 보류하게 한다. 연구분류label을 학생이그수행을했다는기록으로 복제하지 않는다.

## 후속 적용의 검토 조건

새스키마·UI를 이번에 만들지 않았다. 제품에 적용하려면 원문권리/계보, 인간내용검토, 실제루브릭채점일치, 노출추적, 관찰조건의유효성, 학생전이/지연자료를 각각 확인해야 한다. AI연구일치도는 이 조건들을 대체하지 않는다. 연구결과를 연결할논리계약은 제시할수있지만 학생상태업데이트엔진은문항연구만으로완성할수없다.
