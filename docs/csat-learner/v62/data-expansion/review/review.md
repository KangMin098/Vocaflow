# T-0089 독립 검증

판정은 **P1(보완 필요), P0 0건 · P1 3건**이다. 이 검토는 독립 AI 감사이며 사람 Gold·출시 승인·제품 relevance 확정이 아니다. 원문 인용은 각 20자 이내로 제한했고 본문 전체를 복사하지 않았다.

입력 HEAD: `76ea33d953ff6d17efb21f4a663281a99fcbf39c`. goal-data D1–D3는 `80fa4454023c6b7086ac5cf4d7c12d459d26b0a0`, D4는 `1b8f089e590536e2ef03c49cb3b6c85c0432ba85`에 결속했다. 다른 워크트리에 쓰거나 Git 신뢰 설정을 바꾸지 않고 이 저장소의 공유 Git 객체로 대조했으며, 비교한 goal-data 24파일은 지정 커밋과 바이트 단위로 일치했다. 상세 SHA는 verdict.json의 input.manifest와 goal_data_pinned_files에 있다.

## 수용 기준별 결론

| 항목 | 결론 | 근거와 한계 |
|---|---|---|
| AC1 | pass | 검토한 v2.1 수정 조항은 한 실제 판단 경로·경쟁 후보 특정 기준을 복구하여 기존 P1 두 건을 문서상 해소했다. 이 수정 조항에서 새 P0/P1은 확인하지 못했다. v2.1의 판정 타당성·재현성 통과를 의미하지 않는다. |
| AC2 | p1 | 60쌍 원문·A/B 경로·인용·구별 사유를 읽었다. 허위 인용 0, 완전 동일 why/dp 반복 그룹 0. 그러나 R4 오정의 16쌍(21판정), 유형 지름길 2쌍, R5 오설명 1쌍을 포함해 중복 제거 18쌍에서 내용 계약을 충족하지 못했다. R5/R6의 모든 관련성 값이 틀렸다는 뜻은 아니다. |
| AC3 | confirmed | DB 3,714행에서 공백·대소문자 정규화 후 같은 시험·60자 초과 동일 발문을 재계산해 정확히 3그룹 7문항을 확인했다. 삽입 4문항 발문에는 같은 시험 #40 지문의 영어가 섞였고, M2406#43–45에는 #45 질문·선지가 공통으로 섞였다. 14링크는 SOURCE_DEFECT·candidate null이며 κ 분모는 TASK별 755다. |
| AC4 | p1 | 262문항의 raw_block=null은 확인되지만 문장 결손의 증거가 아니다. 양 작업이 겹쳐 결손으로 지목한 8문항에는 삽입 대상 문장이 passage 선두에 저장되어 있어 해당 제외 판단을 반박한다. goal 계약 v2의 E2 거리 기준은 map v2.1과 충돌한다. 80문항·160 논리쌍이 겹치며 공개 레코드로 대조 가능한 53쌍 중 결과 불일치 5쌍과 중복 후보 44쌍을 확인했다. |
| AC5 | pass | 고정 seed·모집단·60 대상 ID·개별 판단·입력 SHA·DB 읽기 질의 원문·중복/충돌 목록을 이 두 파일에 기록했다. .agent-goal.md는 변경하지 않았다. 커밋·vfc 상태 변경·DB 쓰기·제품 변경을 하지 않았다. |

AC1은 이전 두 P1의 **문서상 해소**에 대한 pass다. v2.1 재판정의 실증 통과가 아니다. AC5는 산출·범위 준수의 pass이며 AC2·AC4의 P1을 지우지 않는다. 작업 상태는 조정자가 결정한다.

## P1과 필요한 조정

### P1-01 — 인접 TASK 오정의와 유형별 지름길이 의미 검증을 통과한다

검증기는 구별 사유 길이를 확인할 뿐 코드북 정의와의 일치를 검사하지 않는다. 18표본쌍을 재검토하고 R4를 구조 재구성과 실제로 대조해야 한다. 이는 형식 오류 0을 내용 타당성 0결함으로 읽지 못하게 하는 P1이며 제품 영향은 R1 후보 인계 신뢰성이다.

근거: `docs/csat-learner/v4/codebook.json:404` · `scripts/csat/map/v62/data/pilot-lib.mjs:52` · `D:/workspace/Vocaflow-map-data-expansion/scripts/csat/map/v62/data/local/r5r6/chunk-A-09.out.json:155` · `D:/workspace/Vocaflow-map-data-expansion/scripts/csat/map/v62/data/local/r5r6/chunk-A-16.out.json:745` · `D:/workspace/Vocaflow-map-data-expansion/scripts/csat/map/v62/data/local/r5r6/chunk-A-04.out.json:60`. 전체 개별 근거는 JSON의 findings·sampling.rows에 있다.

### P1-02 — 삽입 대상의 저장 위치를 빠뜨려 정상 8문항을 결손으로 취급한다

stem/raw_block만으로 결손을 판정하지 말고 passage 선두와 실제 위치 슬롯의 결합을 확인해야 한다. 확인한 8문항은 대상 문장 부재라는 이유로 제외하지 않는다. 다른 결함이나 정본 동일성까지 통과시킨 것은 아니다.

근거: `DB Q1–Q6` · `D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D1-source-audit/source-quality-report.md:28` · `D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:31`. 전체 개별 근거는 JSON의 findings·sampling.rows에 있다.

### P1-03 — 같은 문항↔TASK 계약 v2 명칭 아래 E2 기준이 서로 다르다

map v2.1의 거리 무관 후보 특정과 goal v2의 떨어진 근거 direct·대상 문장 내부 not_applicable는 같은 문장 안 후보 경쟁에서 상반된 값을 강제한다. 계약을 구분·합의하기 전 E2 κ와 링크를 같은 정의로 합치지 않는다.

근거: `docs/csat-learner/v62/data-expansion/RULES_V2.md:20` · `D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2.md:24`. 전체 개별 근거는 JSON의 findings·sampling.rows에 있다.

## 규칙 v2.1

한 실제 판단 경로의 결정성을 복구하고, 다른 합리적 경로의 존재만으로 direct를 배제하지 않도록 고쳤다. E2도 근거 거리가 아니라 경쟁 후보에서 특정하는 수행을 기준으로 고쳤다. 검토한 수정 조항에서는 새 P0/P1을 확인하지 못했다.

근거: `docs/csat-learner/v62/data-expansion/RULES_V2.md:9` · `docs/csat-learner/v62/data-expansion/RULES_V2.md:20` · `docs/csat-learner/v62/data-expansion/RULES_V2.md:52` · `docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md:11`.

같은 40문항의 v2.1 A/B 재판정은 없다. κ 0.8051 및 기본값 제외 κ 상승은 수정 전 v2 결과이므로 v2.1의 정확도·타당성으로 인계하면 안 된다. R-O1의 예외 문구와 공통 결정성 기준의 관계도 미정이며 RULES_V2 §8의 보류를 유지한다.

## 고정 seed 표본과 인용 검증

seed: `T-0089|76ea33d95|2026-10-23|v1`

모집단은 R1 direct 328쌍과 DISPUTED 196쌍이다. 각 stratum 모집단에서 sha256(UTF-8(seed + "|" + item_id + "|" + task_id))의 64자리 hex 오름차순, 동률은 item_id|task_id 순; 비복원 앞 30개. 표본 단위는 문항↔TASK 쌍으로 30+30=60쌍, 서로 다른 문항은 59개다. 2016#29는 서로 다른 두 TASK로 각각 뽑혔으므로 교체하지 않았다. 표본은 전체 정확도의 추정치가 아니다.

| 집계 | R1 direct 30쌍 | DISPUTED 30쌍 | 합계 |
|---|---:|---:|---:|
| 내용 계약 위반 쌍 | 16 | 2 | 18 |
| 관련성 내용 판단 unclear | 1 | 1 | 2 |
| 허위 인용 | 0 | 0 | 0 |

R4를 세부 사실 확인으로 오설명한 것은 16쌍·21판정이다. 유형 지름길은 2쌍(목적 유형을 이유로 R5를 낮춘 M2209#18, 빈칸/낱말 유형을 이유로 R6를 낮춘 M2706#42), 별도 R5 오설명은 2016#42 한 쌍이다. 중복 제거하면 18쌍이다. 같은 쌍에서 관련성 경로가 성립해도 인접 TASK 설명이 틀리면 계약 위반으로 분리했다.

원본 A/B 각 762문항을 순수 검증 함수로 검사하고, 공개 1,524링크의 값·why·인용 해시·입력 원문 SHA를 원본과 대조했다. 오류는 0건이다. 청크 내부뿐 아니라 트랙 전체의 not_applicable 제외 why와 decision_path 완전 동일 3회 이상 반복도 0그룹이다. 완전 동일 반복이 없다는 사실은 생성 스크립트 미사용이나 절차상 독립성의 증명이 아니다. 해당 이력은 unclear다. 표본 M2109#21 A의 짧은 anchor는 실재하지만 설명력이 약해 별도 표시했다.

아래 선호 판정은 이번 독립 AI의 내용 판단이다. 갈림의 제품 승격이나 기존 파일 수정으로 사용하지 않았다. NA는 not_applicable, D는 direct, I는 indirect다. 원문·A/B·공개 링크의 정확한 파일:줄은 각 행에 대응하는 verdict.json의 sampling.rows[].evidence에 모두 있다.

| 번호 | 층 | 문항 · TASK | A/B | 독립 선호 | 계약 | 판정 이유 |
|---|---|---|---|---|---|---|
| 1 | R1 direct | M2106#22 · R5 | D/D | D | p1 | 스포츠 정의가 참여와 건강을 바꾸는 두 결과를 함께 압축한다. |
| 2 | R1 direct | 2016#34 · R6 | D/D | D | pass | 시의 여신과 군중의 대조 및 대중의 환호에서 동시대인의 인정을 도출한다. |
| 3 | R1 direct | M1809#34 · R6 | D/D | D | pass | 산업 정체성에 대한 애착에서 관광 정체성으로의 교체에 저항할 행동을 도출한다. |
| 4 | R1 direct | M2609#32 · R6 | D/D | unclear | pass | 갈등 악화가 본문에 명시되어 있다. 역효과라는 환언을 R6의 미진술 의미 도출로 볼지는 경계가 불명확해 direct 확정 보류. |
| 5 | R1 direct | M2706#20 · R5 | D/D | D | p1 | 준비운동 예시를 부연으로 두고 활동 원리 이해를 돕는다는 주장을 압축한다. |
| 6 | R1 direct | 2019#23 · R5 | D/D | D | p1 | 원조와 보조금 개혁을 기후변화 대처라는 상위 주제로 묶는다. |
| 7 | R1 direct | 2018#20 · R5 | D/D | D | pass | 지도자의 자기 한계 도전을 중심으로 인용과 예시를 정리한다. |
| 8 | R1 direct | M2406#23 · R5 | D/D | D | p1 | 수익 압박과 수장고 쇠퇴를 원인·결과의 주제로 통합한다. |
| 9 | R1 direct | M2506#33 · R6 | D/D | D | pass | 환경·제도와 주관 경험의 결합을 사례에 대응해 빈칸의 기능을 복원하는 경로는 성립한다. |
| 10 | R1 direct | 2022#20 · R5 | D/D | D | p1 | 도구 집착 비판을 부연으로 두고 사업 목표 우선이라는 주장을 압축한다. |
| 11 | R1 direct | M2306#24 · R5 | D/D | D | p1 | 자율주행차 등 사례를 인간·기계 협력의 중심으로 묶는다. |
| 12 | R1 direct | M2509#31 · R6 | D/D | D | pass | 빛을 탈출하려다 맴도는 행동으로 갇힘이라는 상태를 도출한다. |
| 13 | R1 direct | M2609#24 · R5 | D/D | D | p1 | 고립과 사회 기여라는 양 축을 함께 담는 제목으로 압축한다. |
| 14 | R1 direct | M2309#34 · R6 | D/D | D | pass | 정원·황야 비유를 아동 연구에 확장해 심리학자의 행동 처방을 도출한다. |
| 15 | R1 direct | M2006#41 · R5 | D/D | D | p1 | 인물·역사를 부연으로 두고 정치 도덕주의의 가치 추구를 제목으로 묶는다. |
| 16 | R1 direct | M2409#24 · R5 | D/D | D | p1 | 기사 수명 연장과 맥락 확장을 함께 압축한다. |
| 17 | R1 direct | 2018#32 · R6 | D/D | D | pass | 인출 단서를 기억을 꺼내는 고리라는 비유에 대응시키는 경로가 성립한다. |
| 18 | R1 direct | M2209#34 · R6 | D/D | D | pass | 습관화 사례에서 무해한 자극 속에서도 활동하게 하는 학습 기능을 도출한다. |
| 19 | R1 direct | M2309#41 · R5 | D/D | D | p1 | 기후변화의 재현 곤란과 상상력의 한계를 중심으로 사례를 묶는다. |
| 20 | R1 direct | M2109#23 · R5 | D/D | D | p1 | 개인 창의성 통념을 반박하고 개인성의 사회적 본성을 압축한다. |
| 21 | R1 direct | 2016#42 · R6 | D/D | D | p1 | 겉보기의 비실용성과 실제 가치를 대조해 빈칸 의미를 도출한다. R5를 결론 낱말 복사로 설명한 A의 구별은 부정확하다. |
| 22 | R1 direct | 2014A#34 · R6 | D/D | D | pass | 흑백 화면 비유와 감정·즐거움 감소에서 삶의 풍요로움 상실을 도출한다. |
| 23 | R1 direct | M2509#41 · R5 | D/D | D | pass | 일상 언어를 새롭게 들리게 하는 시의 기능으로 압축한다. |
| 24 | R1 direct | 2020#31 · R6 | D/D | D | pass | 과학주의가 비과학적 접근을 주관적이라고 낮추는 인과를 빈칸의 중요성 저하로 연결하는 경로는 성립한다. |
| 25 | R1 direct | 2021#35 · R5 | D/D | D | p1 | 조직 결속이라는 중심을 기준으로 광고 유머 문장을 배제한다. |
| 26 | R1 direct | 2021#33 · R6 | D/D | D | pass | 사용에 따른 신경망 강화·가지치기에서 경험사에 의한 조각이라는 비유를 도출한다. |
| 27 | R1 direct | M2609#35 · R5 | D/D | D | pass | 다양한 멘토망의 필요성을 중심으로 고용주 발달 일반론을 배제한다. |
| 28 | R1 direct | M2409#22 · R5 | D/D | D | p1 | 이민사를 부연으로 두고 문화적 정체성을 유지할 권리를 결론으로 압축한다. |
| 29 | R1 direct | M2109#21 · R6 | D/D | D | p1 | 고정된 사고 틀과 비난하지 말라는 비유를 기능적 고착의 이점에 연결한다. A의 인용 위치는 실재하지만 짧아 단독 설명력이 낮다. |
| 30 | R1 direct | M2606#24 · R5 | D/D | D | p1 | 생존 필수품에서 음식 문화로의 전환을 제목으로 압축한다. |
| 31 | DISPUTED | 2021#24 · R6 | I/NA | NA | pass | 촉각의 시간성이 직접 진술되어 실험과 제목의 대응에 미진술 의미 도출이 별도로 필요하지 않다. |
| 32 | DISPUTED | 2016#19 · R5 | I/NA | NA | pass | 기대에 찬 심경 파악은 중심 주장 압축과 구별된다. A는 일반적인 전체 흐름을 R5로 확장한다. |
| 33 | DISPUTED | 2023#20 · R6 | I/NA | I | pass | 인생 선택을 갈림길에 대응시키는 비유 해석 경로는 존재하지만 확률 분석 주장은 명시되어 있다. |
| 34 | DISPUTED | 2025#31 · R5 | D/I | D | pass | 텍스트에 들어가 살고 감정을 나누는 부연을 개인적 관여로 압축하는 실제 결정 경로가 성립한다. R6 경로가 있어도 R5 direct를 배제하지 않는다. |
| 35 | DISPUTED | 2016#29 · R5 | NA/I | NA | pass | 각 어휘의 국소 문맥으로 판단한다. 논병아리 감소라는 배경만으로 R5 수행을 특정하기 어렵다. |
| 36 | DISPUTED | M2006#36 · R6 | I/NA | NA | pass | 단점 예고와 구전 전통의 명시적 연결은 R2·R4 등의 수행이다. A는 연결을 추론 일반으로 넓힌다. |
| 37 | DISPUTED | 2019#36 · R6 | NA/I | NA | pass | 관찰 반응성의 예시를 대응시키는 관계 판정과 R6를 구별한다. |
| 38 | DISPUTED | M2006#37 · R6 | I/NA | NA | pass | 생략 복원과 명시된 정신·유전자 대조로 순서를 닫을 수 있다. 새로운 함축 의미보다 구문·지칭 연결이다. |
| 39 | DISPUTED | 2014A#36 · R6 | I/NA | NA | pass | 고·저 집단 대조 및 예시 관계는 문장 관계 수행이다. 관계 이름이 생략되었다는 이유로 R6를 추가하지 않는다. |
| 40 | DISPUTED | 2020#43 · R6 | I/NA | NA | pass | 주차·관찰·도약 성공의 문면 사건 순서로 배열한다. |
| 41 | DISPUTED | 2018#23 · R6 | NA/I | I | pass | 의문형 제목의 비판적 함의를 읽는 경로는 성립하나 중심 압축을 보조한다. |
| 42 | DISPUTED | 2015#41 · R6 | NA/I | NA | pass | 집단 인원수의 효과가 명시되어 있다. 중요하다는 제목 대응만으로 새 의미 도출을 특정하기 어렵다. |
| 43 | DISPUTED | 2020#40 · R6 | I/NA | NA | pass | 친밀도·분리 기간을 동의 표현으로 대응하는 수행이며 미진술 의미 도출과 구별한다. |
| 44 | DISPUTED | M1809#43 · R6 | NA/I | NA | pass | 다른 일들이라는 지시어의 선행 내용을 찾는 수행이다. |
| 45 | DISPUTED | 2017#40 · R6 | I/NA | NA | pass | 엇갈림·변이를 다른 입장으로 환언하는 수행이다. |
| 46 | DISPUTED | M2606#19 · R6 | I/D | D | pass | 한숨과 사라지는 기대에서 앞 심경을 도출해야 변화 선지가 결정된다. 뒤 심경의 명시만으로 앞 수행이 보조가 되지는 않는다. |
| 47 | DISPUTED | M2206#36 · R6 | NA/I | NA | pass | 실험 결과와 비대칭이라는 지시 표현의 대응으로 순서를 닫는다. |
| 48 | DISPUTED | 2022#37 · R6 | I/NA | NA | pass | 다른 의식과 작가의 지칭 연결이 핵심이다. 연결 추적을 곧 R6로 넓히지 않는다. |
| 49 | DISPUTED | 2019#38 · R6 | NA/I | NA | pass | 삽입 대상은 passage 선두에 있다. 필사본과 뒤의 수작업 복제 대조가 명시되어 연결 수행으로 닫힌다. |
| 50 | DISPUTED | 2016#29 · R6 | I/D | D | pass | 어종 도입과 결함에서 기존 어종 부재를 복원하고 먹이 중복에서 경쟁을 도출하는 실제 결정 경로가 있다. 어휘 유형이라는 이유로 indirect로 낮추지 않는다. |
| 51 | DISPUTED | 2016#22 · R6 | I/NA | I | pass | 사이렌과 암초를 위험의 비유로 해석하는 경로는 존재하지만 끝의 명시 주장을 보조한다. |
| 52 | DISPUTED | M2209#18 · R5 | I/D | D | p1 | 모금 배경과 연주 초청 요청을 가르는 중심·부연 판단이 답을 결정한다. 목적 유형이라는 이유만으로 indirect로 낮춘 A는 계약 위반. |
| 53 | DISPUTED | M2006#30 · R5 | I/NA | I | pass | 첫 문장의 성찰 동기를 기준으로 삼아 낱말 방향을 판단하는 경로에서 중심 파악은 전제다. |
| 54 | DISPUTED | M2706#42 · R6 | I/NA | D | p1 | 이해 곤란에서 법칙을 거스르는 방향을 도출하는 경로가 낱말 반의 판정을 결정한다. 양쪽 값과 다르며 유형별 생성·선택 구분은 direct 기준이 아니다. |
| 55 | DISPUTED | 2015#37 · R6 | NA/I | NA | pass | 각 집단을 받는 지시어와 행동 묘사의 명시 연결로 순서를 닫는다. |
| 56 | DISPUTED | 2014B#37 · R6 | I/NA | NA | pass | 기후 영향의 대조와 시베리아 사례를 연결하는 담화 관계 판단이다. |
| 57 | DISPUTED | M2209#39 · R6 | NA/I | unclear | pass | 새 정체성과 소비자 공동체의 대응을 지칭 연결로 볼지 미진술 의미 도출로 볼지 경계가 남는다. 갈림 유지. |
| 58 | DISPUTED | 2025#36 · R6 | NA/I | NA | pass | 농부·지주의 명시된 유사 행동과 연결 표지를 대응하는 수행이다. |
| 59 | DISPUTED | 2017#22 · R6 | NA/I | NA | pass | 의문형 제목에 명시된 모호성·적응성을 대응한다. 질문 형식만으로 추론을 더하지 않는다. |
| 60 | DISPUTED | M2006#39 · R6 | I/NA | NA | pass | 선두 삽입 문장이 대각선 모서리 배치를 초점에 서는 것으로 직접 설명한다. 지시 연결과 R6를 구별한다. |

## DB 전수 읽기와 7문항 가드

프로젝트 ref는 `jajenrevcbmrpaliomxv`, 읽기 시각은 `2026-10-23T03:38:18.421Z`다. SQL 실행 MCP는 제공되지 않아 기존 개발 환경의 자격으로 **PostgREST GET의 SELECT만** 요청했다. RPC·POST·PATCH·DELETE는 사용하지 않았다. 인증정보·DB URL은 결과에 기록하지 않았다. 다음은 실제 실행한 질의 원문이다(프로젝트 호스트를 제외한 상대 요청 경로).

- Q1: `GET /rest/v1/csat_items?select=*&id=eq.2026%2338` → HTTP 200
- Q2: `GET /rest/v1/csat_exams?select=id,organizer&order=id.asc` → HTTP 200
- Q3: `GET /rest/v1/csat_items?select=id,exam_id,no,type_id,stem,passage,choices,raw_block,answer,answers,points,body_ok&order=id.asc&offset=0&limit=1000` → HTTP 200
- Q4: `GET /rest/v1/csat_items?select=id,exam_id,no,type_id,stem,passage,choices,raw_block,answer,answers,points,body_ok&order=id.asc&offset=1000&limit=1000` → HTTP 200
- Q5: `GET /rest/v1/csat_items?select=id,exam_id,no,type_id,stem,passage,choices,raw_block,answer,answers,points,body_ok&order=id.asc&offset=2000&limit=1000` → HTTP 200
- Q6: `GET /rest/v1/csat_items?select=id,exam_id,no,type_id,stem,passage,choices,raw_block,answer,answers,points,body_ok&order=id.asc&offset=3000&limit=1000` → HTTP 200

Q3–Q6은 ORDER BY id로 전수 페이지를 읽었다. DB의 134시험·3,714문항 중 평가원/수능은 802문항이고, 동결 입력 40+762문의 source 필드가 DB와 전부 일치했다. 전체 응답 필드의 SHA-256은 `499a5c0d90decd5eb51af6304037e960c8e044d6cea9fe1a839920ec8359c7fc`다. DB의 이후 변경까지 잠그는 스냅샷 트랜잭션은 아니며 관측 시점의 검증이다.

같은 시험·공백/대소문자 정규화·60자 초과 동일 발문을 독립 재계산한 결과:

| 그룹 | 판정 | DB 확인 |
|---|---|---|
| M2306#38·39 | confirmed | 발문 동일. 같은 시험 #40 지문 영어가 섞임 |
| M2406#38·39 | confirmed | 발문 동일. 같은 시험 #40 지문 영어가 섞임 |
| M2406#43·44·45 | confirmed | #45 질문·첫 선지가 공통 발문에 섞여 #43·44 고유 질문이 보존되지 않음 |

7문항의 14링크는 전부 SOURCE_DEFECT·candidateRelevance=null이며 κ 분모에서 빠졌다. 결함 링크 13개에 tier=R1 표기가 남으므로 **tier만으로 후보를 추출하면 안 된다**. 현재 산출의 후보값·배점 계산은 가드를 따른다. 가드 조건 밖 결함 부재는 unclear다. 7문항을 제외했다고 나머지 원천 전부의 정본 일치·정상성이 확인된 것은 아니다.

근거: `scripts/csat/map/v62/data/coverage-audit.mts:109` · `scripts/csat/map/v62/data/batch-run.mjs:107` · `docs/csat-learner/v62/data-expansion/coverage.json:137`.

## 삽입 262문항 주장 대조

DB에서 R-INSERT 262문항의 raw_block이 전부 null인 것은 confirmed다. 그러나 raw_block 부재·짧은 stem은 주어진 문장 부재와 동치가 아니다. 겹치는 8문항은 passage 선두 문장을 실제 연결 단서와 정답 슬롯에 대조했으며, 삽입 대상이 보존되어 있다.

| 문항 | passage 선두 인용(각 ≤20자) | stem 길이 | 위치 선지 |
|---|---|---:|---:|
| 2026#38 | `Sometimes these inte` | 41 | 5 |
| 2026#39 | `The difference is th` | 41 | 5 |
| M2706#38 | `To minimize vortex s` | 41 | 5 |
| M2706#39 | `It was also within t` | 41 | 5 |
| M2609#38 | `As winter approaches` | 41 | 5 |
| M2609#39 | `The problem of survi` | 41 | 5 |
| 2025#38 | `Without any special ` | 41 | 5 |
| 2025#39 | `In reality, objects ` | 41 | 5 |

따라서 이 8문항을 대상 문장 결손으로 제외한다는 판단과 262문항 전체의 대상 문장 부재로 일반화하는 주장은 **refuted**다. 262 모두의 저장 완전성·시험 PDF와의 동일성은 **unclear**로 남긴다. 2023#38의 choices=null은 실제 별도 결손이며 이번 반례로 정상화하지 않는다. 긴 발문 오염 4문항도 별도 가드 제외를 유지한다.

goal D2의 `b2-v2-agreement.json`에는 2025#38이 `use=independent_check_candidate`로 남아 있다. 삽입 8문항을 넘기지 않는다는 서술과 제외 상태 표현도 일치하지 않는다. 이 비교는 문서·데이터 계약 충돌이며 해당 파일들을 수정하지 않았다.

근거: `D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D1-source-audit/source-quality-report.md:28` · `D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:31` · `D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/b2-v2-agreement.json:900` 및 DB Q1–Q6.

## 두 작업의 계약·수치 중복·결과 충돌

| 계약 | map-data | goal-data | 판정 |
|---|---|---|---|
| direct | 한 실제 판단 경로에서 고유 수행이 결정적; 복수 direct 허용 | v1 전체 계승 | 공통 원칙은 호환. 실제 판정자의 유형 기준 적용은 별도 위반. |
| indirect | 구체 경로·근거·인접 TASK 구별 사유 | counterfactual choice/locus 추가 필수 | goal의 더 강한 증거 요구이며 자동 동치로 보지 않는다. v1 자료를 goal v2 계약 충족으로 승격할 수 없다. |
| E2 | 거리와 무관한 경쟁 후보 특정 | 거리 기준 direct/indirect; 같은 문장 근거는 not_applicable | 정의 동치 주장 불가: P1-03. |
| 통합 TASK | S-O1/E-O1 기본 unknown; R-O1 조건부 indirect | 세 통합 TASK를 18 TASK 판정에서 제외하고 원자값 파생은 제안만 | 미평가·unknown·무관의 서로 다른 상태를 보존한다. 21/18 TASK의 κ 직접 비교 금지. |
| E1/V1/R4 | E1 기본 unknown+예외, V1 밑줄/선지 기본 뜻 질문, R4 전개 구조 | E1 표준 발문 not_applicable 가능, V1 결정 낱말 뜻, R4 글 전체 배열 강조 | 경계가 같다는 보장이 없다. 공통 조작적 기준 확정 전 판정 효과·κ를 합치지 않는다. |
| 등급·제품 입력 | AI R0/R1 후보; relevance unknown | AI R0/R1 후보; relevance unknown | 호환. AI 일치·독립 AI 검토는 사람 Gold나 출시·NeedRank 승인과 다르다. |

E2의 같은 문장 안 후보 경쟁은 map v2.1에서 direct가 가능하지만 goal v2는 not_applicable로 강제한다. 따라서 goal의 E2 κ 0.9061을 map v2.1과 같은 정의의 검증 결과로 소비할 수 없다. indirect 반사실 추가는 강화된 증거 계약이고 direct의 대체 풀이 경로 배제와는 다른 규칙이다.

80문항·R5/R6 160논리쌍이 겹친다. 그중 pilot 40문항·80쌍은 같은 원본 재사용이고, b2 40문항·80쌍도 확대 762문항 안에 있다. 40+762+40을 842개의 서로 다른 문항으로 세면 안 된다. 공개 goal JSONL의 양성/갈림 레코드로 직접 비교 가능한 것은 53쌍(43문항)이다. 같은 양성 후보는 44쌍으로 중복 목록을 JSON에 남겼다. 공개되지 않은 음성 상태 107쌍은 부재를 not_applicable로 변환하지 않았고 개별 일치/충돌은 unclear다.

| 문항 · TASK | map-data A/B · 후보 | goal-data A/B · 후보 | 근거 |
|---|---|---|---|
| M2609#19 · R6 | I/D · DISPUTED | D/D · direct | `docs/csat-learner/v62/data-expansion/r5r6-links.json:37192` · `D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/item-task-links.jsonl:174` |
| 2025#31 · R5 | D/I · DISPUTED | I/I · indirect | `docs/csat-learner/v62/data-expansion/r5r6-links.json:17518` · `D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/item-task-links.jsonl:258` |
| 2025#34 · R5 | D/I · DISPUTED | D/D · direct | `docs/csat-learner/v62/data-expansion/r5r6-links.json:17698` · `D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/item-task-links.jsonl:269` |
| M2609#24 · R6 | I/I · indirect | D/NA · DISPUTED | `docs/csat-learner/v62/data-expansion/r5r6-links.json:37468` · `D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/disputed-links.jsonl:138` |
| 2025#34 · R6 | I/D · DISPUTED | D/NA · DISPUTED | `docs/csat-learner/v62/data-expansion/r5r6-links.json:17728` · `D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/disputed-links.jsonl:194` |

위 5건은 결과가 다르다는 사실의 confirmed다. goal v2의 판정이 자동으로 더 옳다는 뜻은 아니다. 공통 계약과 같은 입력으로 재판정하기 전 한쪽을 정답으로 덮어쓰지 않는다.

2014 A/B의 같은 지문 3쌍(2014A#32 ↔ 2014B#29, 2014A#24 ↔ 2014B#23, 2014A#35 ↔ 2014B#31)은 별도 시험의 문항이다. 시험별 배점은 해당 시험 안에서 산술상 유효하지만 전체 독립 지문·학습 근거로 합치면 중복을 분리해야 한다. 코드북 21개와 원자 18개, 저장소 20파일과 등록 18세트도 분모가 다르다. D4의 등록/파일 차이는 이 구분으로 설명되며 D4 제품 코드 결함의 타당성 검증은 이 TASK 범위에서 수행하지 않았다.

## 재계산·범위 확인과 미완료

R5/R6를 제외 문항 없이 재확장하지 않고, 지정 원본과 순수 함수로 재계산했다. 원본 export·agree·coverage-audit는 지정 산출물을 덮어쓸 수 있어 실행하지 않았다.

| 재계산 | 결과 |
|---|---|
| A/B 링크 원본 형식·인용·해시·공개 결속 | A/B 각 762문항, 오류 0 |
| R5 | n=755, κ 0.8885, direct 이분 κ 0.9353, direct 190·indirect 161·갈림 55 |
| R6 | n=755, κ 0.7005, direct 이분 κ 0.9527, direct 138·indirect 122·갈림 141 |
| exam-relevance | 29시험·802문항·1,807점, 시험별 건수·ID·배점 불일치 0 |
| 관련 배점 | R5 direct 418점(평균14.4), R5 indirect 428점, R6 direct 390점(평균13.4), 독해 평균62.3 |

배점은 AI R1 후보의 출처 결속 산술이며 사람 검수·정확도·NeedRank 입력이 아니다. R5와 R6의 점수를 더하면 동일 문항을 중복 계산할 수 있다.

산출은 `review/verdict.json`과 이 `review.md` 두 파일이다. .agent-goal.md·제품·기존 데이터 산출·DB는 변경하지 않았다. Git 커밋·통합·vfc 상태 변경은 사용자 지시대로 수행하지 않았다. 제품 코드의 단위/E2E는 **미실행**이며 통과로 보고하지 않는다.

남은 것은 v2.1 재판정, 18표본쌍의 내용 계약 보완, E2 공통 경계 합의, 8문항의 결손 사유/제외 상태 정정, 5쌍 재판정이다. 사람 Gold·학생 실측·정본 PDF 대조·262 전체 완전성·미공개 음성 107쌍 비교는 미확정으로 남는다. 검토 결과 파일 외 조치는 조정자와 해당 작업 담당자의 범위다.
