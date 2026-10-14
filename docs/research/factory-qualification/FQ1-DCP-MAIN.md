# FQ1 DCP MAIN 독립 검수

입력 SHA256: `758558f756b72f04527e9578fac3b5dc3e39e28dff95beba676816426e96907a`. 첫 private 판정 SHA256: `baaf40723e2d3b21bd450f28cf88a5b86a57a819bad150654519fbe6efce4728`. 본문·정답·개별 Gold와 세부 근거는 ignored local에만 보존한다. 기존 판정이나 counter 집합을 읽지 않았다.

실제 MAIN 8건(문법 4·어휘 4)의 전체 로컬 원문과 ancestry, 생성 문장·표시·키·해설을 읽었다. 외부 정본·생성 당시 원문·실제 학습자 지시·Workspace 실행은 별도 확인되지 않았다. 생성 revision 전용 값은 8건 모두 없으며 timestamp를 revision으로 간주하지 않았다.

|축|pass|fail|unknown|not_applicable|
|---|---:|---:|---:|---:|
|A|0|0|8|0|
|B|6|2|0|0|
|C|0|6|2|0|
|D|0|0|8|0|
|E|4|4|0|0|
|F|0|2|6|0|
|G|0|0|8|0|
|H|0|0|8|0|

로컬 ID·본문 결속은 8건 확인했으나 A 전체의 외부 정본/이력 검증은 unknown이다. B의 실패 2건은 의도된 오답 자극이 아니라 해설 기능 불일치다. E 실패 4건은 해설 문제 2건과 제시 문맥의 비유일성 2건이며, 키 존재와 원문 복원 일치로 상쇄하지 않았다. 부분·동등 답·defer 루브릭은 8건 모두 unknown이다. F 실패 2건은 현재 archived/reject 원천의 운영 차단이다. 이는 법적 거절 판정이 아니다. 나머지 usable/unjudged 표본의 법적 공개 승인은 unknown이다.

요청 TASK 관련성은 supported_direct 2, indirect_or_redesign 6, unsupported 0, unknown 0이다. 직접 관련 2건도 실제 지시·응답·루브릭이 없어 TASK 자격 자체는 unknown이다. 문법 4건과 어휘 2건의 재설계 사유·실제 요구행동 관찰은 private에 보존했다. 공개 파일은 개별 원문·정답·Gold·지시안·실제 TASK 관찰·상세 문제 근거를 포함하지 않는다.

분류는 중복 가능하다: guided_practice_candidate 4 · explanation_candidate 4 · requires_task_redesign 6 · rights_or_source_hold 8 · assessment_not_qualified 8 · unusable_for_requested_role 6 · requires_semantic_repair 2. 후보는 제한 연구 검토에서의 활용 가능성을 뜻하며 현재 산출물의 공개 자격이나 요청 역할 자격이 아니다.

qualified_public 0 · qualified_assessment 0 · human_validated 0 · actual_students 0. 목적 표집 8건의 기술 결과이며 생산 전체의 품질 비율이나 학생 효과로 일반화하지 않는다. 상세 메타데이터는 [dcp-main-review.json](./data/dcp-main-review.json)에 있다.

