<!-- docs/research/csat-reading/V12-D-MAPPING.md -->
# D. 기출→TASK 매핑 계약과 원장

2026-10-14 · 고정 원천은 [audit.json](./data/v12/audit.json)의codebook/inquiry/compare hash다. rev4 영구ID30개를 그대로 유지한다.786개 공개 분석은 한JSON의786객체이며 문항별TASK 태그는 없었다. 분석 버전은3~11의 여러 버전이고 공통v3 표현 계약을 사용한다. 운영verified 표시는 인간 독립 검수라는 의미가 아니다.

전수 조합 원장은 [item-task-map.jsonl](./data/v12/item-task-map.jsonl), 요약은 [mapping-summary.json](./data/v12/mapping-summary.json), 실제 사례 검토는 [item-task-reviewed.json](./data/v12/item-task-reviewed.json)이다. **786×30=23,580조합**을 모두 표현하지만 후보와 실제 검토 결과를 별도 필드로 저장한다. 한 행은 문항ID/시험ID/유형/analysis_version/units_hash/source binding/TASK ID/relevance/candidate_relevance/reason/evidence/sufficiency/counterexample/review_status/disagreement/public_learning_use를 가진다.

## 네 상태와 승격 조건

`direct`는 실제 판정에 직접 요구되는 수행, `indirect`는 지원 수행, `not_applicable`은 직접 검토 후 관련성이 없다고 판정한 상태, `unknown`은 근거 부족·미검토다. 원문을 확인한 AI 사례 검토도 인간 검증과는 구별한다. 아직 공개·학습 사용 승인을 받은 원장이 아니므로public_learning_use=false다.

자동 규칙은v3.requirement, 선택지별 근거 위치·판정, 의미 단위 기록과 유형 메타데이터에서 후보만 추출한다. E1의 발문 조건, E2의 근거 위치, E3의 다섯 후보 판단은 저장 필드에서 대응 후보를 만들 수 있다. 대의 유형의R5, 순서/삽입의R1/R4, 어법의S5, 어휘의V2는 **유형 기반 후보**이며 원문의 필요 충분성을 확인한 결과가 아니다. S2/S3/S4/V3의 주석이 없다고 무관하다고 채우지 않는다. L/X는 읽기 문항만으로 판단하지 않는다.

후보를 실제 관련성으로 바꾸려면 원문 binding, 수행을 요구하는 범위, 발문·정답·오답의 논리, 반례/대안 경로, 검수 상태를 별도로 입력해야 한다. 코드가원문을 읽지 않은태그나AI검수합의만으로direct를승격하지못하게검사한다. 실제 관계를 검토한 사례는 v1.1 source complete 및 별도복원본과 연결하며, 과거 최초 판정 자체를 수정하지 않는다.

## 해석과 금지되는 변환

단순히 정답을 골랐다는 응답은 V/S/R/E 여러 경로와 추측·사전 노출을 포함할 수 있다. 이 원장은 **문항이 제공하는 교육적 기회/판정 요구**를 설명한다. 학생의 TASK 결손·숙달확률·목표 등급·필요 학습량을 계산하는 원장이 아니다. 자동direct 후보 수를 실제 독립 검증된 문항 수나 TASK의 시험 중요도 순위로 읽지 않는다.

읽기 공개786은 범위 밖M2706도 포함한 운영 자산 분모다.2014~2026 범위의 공개758,전체보유774와 구분한다. 듣기와 실전 실행은 분석 공백이며 수능 전체45문항 지원율로 환산하지 않는다. 전체 분포는 매핑 요약에서 재계산할 수 있으나 목적표집 사례의 TASK 분포는 모집단 분포가 아니다.
