# T-0111 b7-v24 독립 검증

조건부 진행 가능 — 연구 배치로만 확대하고 §4 결정 대기·공개 relevance unknown·NeedRank 금지 및 문항별 outside 검토를 유지; v2.5 세 후보는 별도 미관측 검증 전 봉인하지 않는다.

입력 78ff7df39..e87bdc173; owner goal-data-independent · session t-0111-codex. 최초 조회 IN_PROGRESS·세션 일치. PID 조회 없음. 중앙 dev-minimal-20261020 확인. 패킷 관찰 2026-10-23T07:31:30.030Z. 입력은 읽기 전용·DB 접근 없음.

검증 수행 완료(pass), skip_count=0. 새 P0 0 · P1 0. pass는 데이터 전부 승인·제품 관련도·진단 투입 승인이 아니다.

## 수용 기준

### 0. confirmed

v2.4 봉인은 §4 결정 대기·97→96 예외·relevance unknown·NeedRank 금지를 보존. 이전 selection 전량 수집을 읽었고 range 기존/신규 및 fixed 재판정 3대조 반례 통과.

- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_4.md:3
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-export.mjs:52
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-export.mjs:60

### 1. confirmed

40=15+15+10, 제외3의 source/passage 해시 일치, selection 및 모든40 입력 해시 일치. 224/240=.933333 κ=.8781958, primary31/40, 후보83 갈림16. 안정5 경보 ok. b2–b7 D2/D3 현행 계약 회귀 결함0. 제외 유형의 독립 검증은 P2-01 별도 unclear.

- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/b7-v24-selection.json:13
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/b7-v24-agreement.json:43
- docs/research/goal-data-batches/review-b7/recalculation.json:1

### 2. unclear

A-02 전부true 변이: 구검사20행 수용, 신규12행 거부, D2와 D3 전파 재현. 13 유형 ID는 정본과 일치. 재표시7행은 B-02와 일치하고 내용상 타당. 그러나 당시20/20 이력과 복사 부재를 인증할 수정 전 출력·생성로그 없음. R-IMPLY 등 가드 밖은 문항 검토를 요구하며 유형 정본 자체가 outside 자유를 보증하지 않음.

- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-validate.mjs:12
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:2774
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:2148
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:2120
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:4684
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:1298
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:1284

### 3. unclear

후보10·갈림10 및 추가5 고유25문항 원문 대조 완료. E3 일치 예와 E2↔E3/함축 반대 방향/primary null indirect R4를 확인. E2 κ .9526의 인과와 v2.5 세 후보의 최종 타당성은 미확정. 후보들은 추가 관측을 위한 합리적 가설이며 봉인된 정답 규칙으로 승인하지 않음.

- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/b7-v24-review-sample.json:4
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:182
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:496
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:352
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:354
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:2774
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:2148
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:2120

### 4. confirmed

verdict.json와 review.md에 각 기준·새 P0/P1·unclear 및 b8 판단을 기록. pass는 검증 수행 완료.

- docs/research/goal-data-batches/review-b7/verdict.json:1
- docs/research/goal-data-batches/review-b7/review.md:1

## 재계산과 변경분 검토

18파일 diff를 고정 커밋으로 읽었다. 코드·봉인·§12는 직접 대조하고 JSONL은 모든 기존 행 유지/추가 필드를 분해 대조했다. D2 기존 변경·삭제0, 후보+83·갈림+16; D3 기존 변경·삭제0, 사고과정+40·오답+160. 결합238문항·R1 687·갈림359. D3 primary197/238·전체오답644/952와 원문확인632/940을 구별한다. README의 .672는 후자다. 40행 설명·오답·primary 전파 일치. D2 4산출은 메모리 재생성 바이트 일치.

40문항 source/passage/selection 해시와 3제외 source/passage/body_ok를 확인. 제외 raw에 type_id가 없어 도표 유형 자체의 독립 재계산은 unclear다. 선정 스캔은 앞선 배치 및 pilot selection을 전량 읽고 본 배치를 제외하며, 기존 입력이 있으면 덮어쓰기 전에 중단한다. 범위배치 기판정은 차단, 신규와 고정 재판정은 수용하는 3대조군을 확인했다. DB를 호출한 export 전체 실행과 현재 DB 동일성 인증은 하지 않았다.

13개 ID는 R-FACT·R-NOTICE·X-FACT·R-BLANK·R-SUMMARY·R-GIST·R-TOPIC·R-TITLE·X-TITLE·R-CLAIM·R-PURPOSE·R-ORDER·X-ORDER. 정본의 정보 대조·중심·추론·배열 수행과 여섯 TASK는 양립한다. 유형별 근거는 verdict.json canonTypes에 남겼다. guard 밖 어휘·지칭·무관·심경은 V/S/R2/R3와 경계가 있어 문항 판단을 유지하는 것이 타당. 삽입도 R4/범위 밖 연결과 관찰 부적격을 구별한다. 함축은 정본상 추론이므로 이번 세 문항 false가 맞으며, guard가 true를 허용한다고 의미적으로 승인된 값은 아니다.

## 분석자 스크립트·복사 탐지

이전 b6의 고정 우선순위 R5>R4>E3>E2>R6>E1로 예측했다. A-01 19/20(복수4/5), A-02 17/20(7/10), B-01 17/20(6/9), B-02 16/20(7/11). 이번에는 해당 고정 우선순위로 전량 선택된 패턴이 아니다. 이 검사는 다른 스크립트 부재의 증명이 아니다.

A/B 모두 전체40에서 true13; 그중 A-02/B-02 true7은 2025#30·35·42·44 및 2023#19·30·35로 일치한다. 어휘3·지칭1·무관2·심경1이라는 근거로 설명할 수 있다. 현재 primary_reason·decision_path·answer_logic·links의 행 전체 A/B 완전 일치0/40, primary_reason 청크 내 숫자·공백 정규화 반복0. 링크 why/task_distinction의 반복은 별도로 detail.local.json에 보존했다. B 입력은 분석/traps 0, A는40개다. 독립 입력 설계는 confirmed이나 생성 독립성·복사 부재는 로그가 없어 unclear. 수정 전 A-02 20행 true 이력은 §12의 자진 보고이며 반례 재현과 구별한다.

## 원문 대조

- candidate 2023#26 / e.task_demand: **confirmed** — 부정 발문과 번역의 평판/실제 구별로 ⑤. E1과 E3 일치 후보를 지지한다.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:5328 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:1804 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:1768
- candidate 2023#27 / e.task_demand: **confirmed** — 매일 공사와 주말 한정이 모순이므로 ②. E1/E3 일치는 지지. 일정 줄 탐색 E2와 한정어 대조 E3 중 primary 우열은 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:5464 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:1923 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:1891
- candidate 2023#30 / e.task_demand: **confirmed** — 기술과 생활 융합을 지연하는 문맥에서 유지 동사가 부적절한 ⑤. E1 후보는 타당하며 낱말 판정은 V축 범위 밖.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:5768 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:2155 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:2127
- candidate 2023#35 / e.task_demand: **confirmed** — 교사 목소리 조절에서 공동 소음 해결로 옮겨간 ③을 고른다. E1 부정 요구는 지지하나 R5/문장기능 경계는 문항별 판단.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:5907 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:2273 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:2242
- candidate 2024#26 / e.task_demand: **confirmed** — 박사 취득 뒤 연구소 입사인데 취득 전으로 바꾼 ②. E1과 E3 일치 후보를 지지.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:833 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:612 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:608
- candidate 2024#27 / e.task_demand: **confirmed** — 예약은 이틀 전까지라 당일 예약 ③이 모순. E1 후보는 지지. 발문 끝 잘림·시간표 평탄화는 독립평가 적격 확정과 구별.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:969 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:733 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:729
- candidate 2024#30 / e.task_demand: **confirmed** — 비필수품에 매우 높은 가격을 요구하지 않는 문맥에서 low를 쓴 ④. 부정 요구 E1은 지지하며 V축 주 수행.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:1257 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:967 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:963
- candidate 2024#35 / e.task_demand: **confirmed** — 빠른 말과 두뇌 지연의 충돌을 설명하는 흐름에 빠른 발화를 돕는다는 ③이 반대. E1은 지지하며 문장 기능의 전체 주 수행은 범위 밖 가능.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:1396 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:1083 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:1067
- candidate 2024#42 / e.task_demand: **confirmed** — 언론 접촉을 피하면 잘못 인용될 위험도 피하는데 위험을 감수한다고 한 (e). E1은 지지, 낱말 수행은 V축.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:1703 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:1343 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:1323
- candidate 2024#44 / e.task_demand: **confirmed** — 대화 상대 Emma를 가리키는 (c)만 나머지 Clara와 다르다. E1은 지지, 지칭 추적은 범위 밖.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:1993 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:1563 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:1544
- disputed 2023#21 / e.option_correspondence: **unclear** — 일기 쓰기와 자기 검토를 이어 ① 자기 성찰. R6 주 판단은 타당하지만 E3 direct/indirect 구분은 두 조건이 함께 성립해 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:4996 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:1541 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:1513
- disputed 2024#20 / e.option_correspondence: **unclear** — 가치를 반영한 행동을 명시적 지침으로 공유하는 ⑤. E3가 부수 대조인지 별도 결정인지 계약 경계는 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:330 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:223 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:230
- disputed 2024#21 / e.option_correspondence: **unclear** — 스트레스 부분에 붙들리지 않는 넓은 경험 시야가 ④. 완성된 비유 해석에 원인 규명은 포함되지 않아 A의 R6가 설득력 있지만 E3 우열 규칙이 미봉인이라 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:496 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:352 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:354
- disputed 2024#24 / e.option_correspondence: **unclear** — 사람 수·물리적 장소만으로 설명되지 않는 과잉관광이 ⑤. R5 일치는 지지. E3 직접성은 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:666 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:483 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:484
- disputed 2024#41 / e.option_correspondence: **unclear** — 언론 접촉의 장단점과 개인 선택이 ②. R5 일치는 지지. 위험만 재사용한 제목의 E3 직접성은 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:1564 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:1214 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:1199
- disputed 2025#21 / e.option_correspondence: **unclear** — 이론만 추구하고 실무를 결여한 건축을 뜻하는 ③. 해석이 완성되면 ⑤의 전통 지식과 구별돼 B R6가 설득력. 2024와 반대 방향의 primary 갈림을 확인, 우열 확정은 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:2774 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:2148 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:2120
- disputed 2025#24 / e.option_correspondence: **unclear** — 자화상 역사를 확장하는 셀피의 표현 혁신이 ⑤. 자기중심적 세계문화 ③은 중심 명제에 불충분하지만 primary R5/E3 경계는 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:2934 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:2260 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:2234
- disputed 2025#41 / e.option_correspondence: **unclear** — 인간 손이 진화·역사를 이룬 결정적 도약인 ②. R5 일치는 지지하고 E3 direct/indirect는 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:3807 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:608 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:616
- disputed 2023#19 / r.central_meaning: **unclear** — 실패의 실망에서 격려 뒤 자신감으로 바뀌어 ③. 명시 정서어 대응이므로 B primary null도 타당, A의 R5 압축을 배제할 규칙은 없어 unclear. B R4 indirect가 있는데 secondary []인 계약 충돌 확인.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:4684 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:1298 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:1284
- disputed 2024#19 / r.discourse_structure: **unclear** — 첫 출근 지각 걱정에서 제때 도착한 다른 버스 탑승 뒤 안도로 변하는 ①. B R4 indirect와 A 무관의 경계는 unclear. 두 트랙 primary null과 secondary []를 확인.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:187 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:122 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:122
- extra 2025#19 / 추가: **unclear** — 예약 전 확신에서 만석 통보 뒤 실망으로 변하는 ③. B R4 indirect/primary null/secondary []는 같은 계약 경계. 정서가 명시돼 R6를 강제하지 않는다.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:2458 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:1918 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:1883
- extra 2024#28 / 추가: **unclear** — 길이 상한 3분인 ③이 맞다. 항목별 위치와 수치·주체 대조가 모두 필요하므로 E2/E3 primary 우열은 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:1105 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-01.out.json:854 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-01.out.json:850
- extra 2025#26 / 추가: **confirmed** — 마지막 방송 이듬해 사망이므로 3년 뒤라는 ④가 틀리다. E3 일치는 지지.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:3082 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:4 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:4
- extra 2025#27 / 추가: **unclear** — 5일권만 할인이라는 ③은 공통 혜택과 모순. E2/E3 primary 우열은 unclear이고 표의 원래 시각적 셀 범위는 평탄화 원문만으로 독립 인증 못함.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:3218 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:123 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:127
- extra 2025#28 / 추가: **confirmed** — 눈 조각 11팀 ③이 일치. 연간·7일·주차 불가·유료 셔틀과 비교하는 E3 일치는 지지.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:3354 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:242 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:250

## v2.5 후보 판단

1. 일치·안내문의 E2/E3 우열: 위치와 표현 대조가 모두 필요한 구조를 짚은 연구 후보로 타당하다. 실제 렌더의 표·항목 난도와 문항별 대조 없이 남는 선지를 관측하기 전 어느 수행이 더 어렵다는 원인 주장은 unclear.
2. 함축까지 §4 확대: 2024#21과 2025#21의 반대 방향 갈림이 필요성을 보이지만 완성된 의미를 어디까지 제공하는지에 따라 남는 선지 수가 달라진다. 고정된 명제·남는 번호로 새 배치에서 검증해야 한다. 현 판정에 소급 봉인하지 않는다.
3. primary null + indirect secondary: 2023#19·2024#19·2025#19 B에서 실제 발생. 현 계약은 secondary []를 요구하므로 현재 행은 계약 통과다. indirect를 보존할 후보는 합리적이지만 direct0 면제와 base validator·D2/D3 소비 계약을 함께 정해야 하며 현재 데이터를 결함으로 뒤집지 않는다.

## 불확실성과 실행

- B7-U1 (unclear): true 7행 일치 재현. 이유·decision_path·answer_logic·links 행 전체 일치0/40. B 입력에 기존 분석·traps 없음. 수정 전 A-02 및 독립 세션 로그가 없어 복사 여부와 당시20/20 true 이력은 독립 확정 불가.
- B7-U2 (unclear): 높은 κ는 고정표·구성 차이·동일 AI 조건을 포함한다. 독립 대조 실험이 없어 학습 효과와 인과는 unclear.
- B7-P2-01 (unclear): 제외3의 본문·source hash·body_ok는 일치하나 excluded_raw.source에는 type_id가 없다. R-CHART 유형은 독립 재대조 불가. 기존 제약이며 새 P0/P1이 아니다.
- B7-P2-02 (confirmed): R-IMPLY는 정본상 추론형. 이번3문항 모두false는 타당하나 true 변이를 가드는 허용한다. 유형별 outside를 항상 자유라고 인증하지 않는다. b8에서도 문항 근거로 false/true를 확인해야 한다.

구현·검증 스크립트는 check.mjs 및 write-review.mjs. 원문·패킷·diff·명령 출력은 ignored *.local.json에만 둔다. 초기 보조 명령의 인용 실패·경로 오류와 검사 스크립트 구문 오류는 교정 후 assertions를 재실행했다. DB·제품 E2E·사람 검수·학생 측정·입력 수정·main/원격 통합은 범위 밖 미실행이며 통과가 아니다. Git add/commit와 evidence/submit 출력은 command-output.local.json에 기록한다.

## A-02 재표시 7행

- 2025#30 (confirmed): 경쟁의 죄책감이 동기를 낮추는 문맥에 stronger를 둔 ④는 V축 반의 방향 판단. true 타당.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:3498 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:355 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:363
- 2025#35 (confirmed): 자동차의 스포츠 관광 기여에서 숙박·식당으로 이탈한 ④. 청크의 R5 압축과 별도로 문장 기능·통일성 R3 수행을 주 수행으로 보면 true가 양립. 유일한 분해라고 확정하지 않음.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:3637 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:484 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:493
- 2025#42 (confirmed): 석기 제작에 강한 쥐기 등이 필요한데 excludes를 둔 (e). V축 판정이므로 true 타당.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:3954 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:726 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:729
- 2025#44 (confirmed): (c)만 Sean이고 나머지는 Ethan. 지칭 추적이 청크 밖이므로 true 타당.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:4241 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:948 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:935
- 2023#19 (confirmed): 명시 정서어 실망→자신감 대응이 V축일 수 있어 true 양립. R5 압축과의 경계는 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:4684 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:1298 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:1284
- 2023#30 (confirmed): 생활 융합을 막는 문맥에서 maintain을 둔 ⑤는 V축 방향 판정. true 타당.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:5768 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:2155 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:2127
- 2023#35 (confirmed): 목소리 조절에서 소음 공동 해결로 이탈한 ③. 통일성·문장 기능 R3을 주 수행으로 보면 true 양립.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/input.json:5907 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-A-02.out.json:2273 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b7-v24/chunk-B-02.out.json:2242

Git add/commit 시도 실패. 오류 원문은 scripts/research/goal-data/review-b7/command-output.local.json에 보존. 커밋·통합 미완료.
