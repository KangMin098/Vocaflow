# FQ1 DCP 독립 반증 검토

독립 AI 문맥에서 metadata-first로 봉인된 실제 DCP 네 건(문법 2, 어휘 2)을 검토했다. main 판정·main packet·research8·Gold 저자 판정을 읽지 않았다. 네 원문 전체, 빈 ancestry 목록, 모든 실제 문장·밑줄·정답키·제공된 해설을 읽었다. 분할의 학생 미노출이나 모델 사전학습 미노출은 보장하지 않는다.

입력 SHA256: `b91160b193c979117b2f6a181d696e5b3e41a65eb3800221afeef38a95f5c288`.
변경하지 않는 private 첫 판정 SHA256: `e2d4503ed495c8664a5e87d4414e9500c8d7cb46e5c22464a9c9568a9e12770f`.
공개 판정 요약 SHA256: `3e52e70b2e0c08985bd207f7a67ee2fe730d804b510ac6fbdf613c48ee47d35f`.

첫 판정은 수정하지 않는다. 추가 검토는 새 버전으로 남겨야 한다. 상세 원문 인용·정답·사유는 ignored private JSON에만 있다. 공개 JSON은 ID·hash·불투명 issue ID·분류를 보존한다.

| 축 | pass | fail | unknown | not_applicable |
|---|---:|---:|---:|---:|
| A source | 2 | 0 | 2 | 0 |
| B semantics | 4 | 0 | 0 | 0 |
| C TASK | 2 | 2 | 0 | 0 |
| D instruction | 0 | 0 | 4 | 0 |
| E Gold | 0 | 0 | 4 | 0 |
| F rights + release | 0 | 0 | 4 | 0 |
| G learner | 0 | 0 | 4 | 0 |
| H runtime | 0 | 0 | 4 | 0 |

실제 문법 응답 두 건은 형태 정확도 선택이며 S5 범위 해석을 직접 요구하지 않는다. 두 건 모두 `indirect_or_redesign`이다. 실제 어휘 응답 두 건은 문맥상 어휘 부적합을 판별하므로 V2에 `supported_direct`다. 한 건의 병렬 문맥 노출 및 고정 표현으로 풀 수 있는 지름길은 진단력을 제한하나, 이를 틀린 정답이나 의미 훼손으로 꾸미지 않았다. 이 네 건의 목적 표집 결과는 전체 문항 분포나 학생 수행 추정치가 아니다.

| 중복 가능한 분류 | 건수 |
|---|---:|
| guided_practice_candidate | 4 |
| explanation_candidate | 3 |
| requires_semantic_repair | 0 |
| requires_task_redesign | 2 |
| rights_or_source_hold | 4 |
| assessment_not_qualified | 4 |
| unusable_for_requested_role | 2 |

`guided_practice_candidate`는 제한 연구에서 검토 가능한 조건부 후보이며 현재 공개/평가 자격을 뜻하지 않는다. `unusable_for_requested_role` 두 건은 지정 S5 역할의 현재 출력에 대한 분류이며 모든 학습 용도의 폐기를 뜻하지 않는다. 해설이 없는 한 건은 새 해설 없이 explanation 후보로 세지 않았다.

예외와 미확정: 의도된 표시 오류를 일반 의미 훼손으로 세지 않았다. 원문에서 물려받은 어색한 구문, 수식 자리 표시와 통계 수치 생략, 전문 지식 검증 한계는 의미 반례와 구별했다. 현 원문보다 오래된 source eligibility cache 두 건은 usable/blocked 양쪽 모두 현 권리·품질 승인을 증명하지 못한다. fresh blocked 한 건의 교육 수준 분류도 법적 금지를 증명하지 못한다. 키가 현 원문을 복원한다는 사실은 독립 E_rubric 또는 인간 검증 Gold를 대신하지 못한다.

후보 조건: 현 원문과 생성 revision 재결속, source cache 재검증, 실제 지시문 확인, 독립 Gold/rubric 검증, 저작권·출시 승인, 실제 runtime·학습자·인간 검증을 각각 확보해야 한다. 문법 두 건은 지정 TASK 재설계가 추가로 필요하다. 원문·제품·DB·v12–15 첫 원장은 변경하지 않았다.

공개 승인 **0**, 직접 평가 자격 **0**, 인간 검증 **0**, 학생 검증 **0**.
