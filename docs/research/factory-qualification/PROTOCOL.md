# Factory Qualification v1.0 사전 규칙

2026-10-14, 기준56876763a, T-0030, 연구 브랜치 research/factory-qualification-v1. 기존 제품/DB/생산/출시와 분리한다. 모든 실제 원문·정답·Gold·개별 상세검수는 ignored local에만 둔다.

1. v15 인덱스와 private 입력·첫 판정을 해시 확인하고 v12~15 원장은 변경하지 않는다. 최신 main/Claude worktree는 읽기만 하며 계약별 observed HEAD/file hash를 기록한다.
2. QualificationSpecification은 A source/B semantics/C TASK/D instruction/E Gold/F rights+release/G learner/H runtime을 pass/fail/unknown/not_applicable와 증거ID·대상revision/hash·검수방법·사유로 분리한다. 검증 스크립트는 근거 결속과 형식/명시 충돌을 검사하며 자동으로 의미나 인간 승인을 만들지 않는다. AI semantic pass는 공개/평가 승인과 다르다.
3. 8연구활동·14역할은 원문 결속 AI내용 검토를 재사용한다. F/G/H와 인간 평가 검증은 실제 기록이 없으면unknown, 직접 평가 승인0을 유지한다. 활동/역할/지문/응답을 별도 분모로 센다.
4. DCP 먼저 metadata/type/revision/source/권리/구조를 조사한다. 실제 vocab_choice/grammar_choice에서 타입×원천 적격상태의 제한 층을 만들고 전체 metadata 후보를 고정seed SHA256 순위로 선정한다. 가능하면12개(유형별6)를 선정하며 공유source/정규화본문/동일생성revision을 중복 독립문항으로 세지 않는다. metadata hash와 선정 규칙을 봉인한 뒤 본문/생성물/키/해설을 읽는다. 후보 부족 층은 부족을 기록하고 다른 층에 임의 전가하지 않는다.
5. 유형별4 main검사 +2 별도 counterexample 확인집합을 분리한다. 자동검사는 두 집합 공통의 source/구조/hash만 계산하며 main 내용 판단은8개, 독립 반증 분석은4개를 별도 AI문맥에서 수행한다. counter 문맥은 main verdict/예상정답을 읽지 않는다. 이 split은 학생 미노출·모델 사전학습 미노출을 보장하지 않는다. n/지지/반례는 목적 표집의 기술 결과다.
6. TASK 적합은 실제 요구행동과 제공정보/응답으로 판단한다. 유형 라벨·정답키·페르소나합의만으로 TASK/Gold 자격을 확정하지 않는다. factory guided/explanation 후보와 semantic_repair/task_redesign/source_rights_hold/assessment_not_qualified/unusable는 중복 가능하다. 권리 미확정 표본의 내용 검토는 제한 연구 분석이며 공개 후보 승인으로 쓰지 않는다.
7. Q4 5경계는 새운영version에 명시한다. proper subset vs unobservable, 유일한 지시적 생략, numeric ground vs unit, wrong reasoning의facet귀속, meaning vs exposure를 구분한다. 새 합성 반례와 독립판정을 보존하고 기존16/64/첫값을 고치지 않는다. 실제 학생·인간0이면직접평가자격0.
8. source guards: 2014A/B 22듣기·23읽기 및형/동일키, M2009↔M2106 머리글/hash충돌, 정답표vs대본 내용, exactsource/analysis/Gold/artifactrevision을 검사한다. pinned older analysis와latest reference는 구별하며 latest만으로oldGold를덮지않는다. 불명확은unknown, 확인된충돌은fail/생산입력차단.
9. 역할source/model/guided/check/transfer/delay의 요구축을 개별 계산한다. not_applicable는필수축 면제가 아니며출시모든역할 F와H필요. check/transfer/delay는검증된Gold/인간채점·무도움·첫봉인·미노출, transfer는다른본문/수행동일성, delay는실제경과와중간노출로그도필요하다. research_candidate와qualified_public/assessment를구별한다.
10. 공급 제품 boolean|null crosswalk는unknown을null, fail을false로유지하고 semantic/source/TASK를 content에결합하되A–H별근거를손실없이남긴다. schema/result간모순과연구후보의무단승격은가드로차단한다. 결과/수정버전/예외/미확정을별도보존하며최종검사·문서·commit/push/검토제출까지수행한다.
