<!-- docs/research/csat-reading/V12-I-COVERAGE.md -->
# I. 목표 커버리지·지원 공백

2026-10-14 · [기계판독 원장](./data/v12/coverage.json). 지원됨/일부지원/미지원/미확인을 구별한다. 학생자료를수집하지않았으며 콘텐츠공백을학생결손으로보지않는다.

| 지원축 | 상태 | 분모 | 근거·남은공백 |
|---|---|---|---|
| 기출 유형·문항 | 일부 지원 | 운영786/기본범위공개758/기본보유774/전체45별도 | 전체운영분석은 존재하지만 원문 완전 대조·같은형 검증·새분류가 전수 완료된 것은 아니다. |
| 영역·TASK 관련성 | 일부 지원 | 786×30=23580;비보류21/hold9 | 후보전수표현과원문결속사례를분리. L/X 및미검토조합unknown. |
| 출제원리·반례 | 일부 지원 | bounded비교원리110/기존749;교차유형기존0 | 원리문구전량검토는원문쌍전량검증·교차유형재현과다르다. |
| 교수방법 | 일부 지원 | 30설계명세;비보류21효과미검증/hold9 | 방법·조건·기출예제후보를정의했으나실제학생효과검증없음. |
| 학습교재 | 일부 지원 | source완전복원24+기존완전8,새16별도;역할6 | 연구입력/예제후보는있으나교재권리·허용답·역할별콘텐츠검수와분량확정은미완료. |
| 직접확인과제 | 일부 지원 | 정적선언live5/ready2/content_needed14/blocked9 | 루브릭설계와코드북정적상태. 이번연구의현재실행·학생채점·유효응답검증0. |
| 미노출전이과제 | 미지원 | 학생별미노출검증된전이풀0;후보설계별도 | 원문및평행과제명세만으로학생의미노출및전이성공을확정못함. |
| 지연재확인과제 | 미지원 | 실제지연수행검증0 | 다른날새과제조건제안뿐;실제학생응답과간격타당성자료없음. |

## TASK별 공백

- V1 (v.core_meaning): ASSESSMENT_GAP: 뜻 인출용 미노출 카드와 채점 허용 답 미검수; CONTENT_GAP: shared_dictionary/FSRS 자산 정적 목록만 확인; 재고·권리·현재 도구 실행 재검증 안 함; VERIFICATION_GAP: 실제 학생 인출·지연 유지 자료 없음
- V2 (v.contextual_sense): CONCEPT_GAP: 다의어 의미 선택과 담화 어휘 적합성의 세부 매핑 미확정; ASSESSMENT_GAP: 미노출 다의어 평행 문장·루브릭 인간 검수 없음; TRANSFER_GAP/VERIFICATION_GAP: 전이·지연 과제 실사용 기록 없음
- V3 (v.multiword): CONTENT_GAP: codebook assets 빈 목록; 실제 표현 카드 풀·권리 검수 없음; ASSESSMENT_GAP: V2/S2 구별 문항 미확보; VERIFICATION_GAP: 지연·전이 기록 없음
- V4 (v.semantic_relation): ASSESSMENT_GAP: V4-E3 구별 평행쌍 미검수; CONTENT_GAP: assets 빈 목록; 표현 재진술 풀 실행 검증 없음; VERIFICATION_GAP: 실제 전이 확인 없음
- S1 (s.sentence_core): ASSESSMENT_GAP: csat_item_units는 경계 자산일 뿐 정답 성분/허용 답 검수 미확인; CONTENT_GAP: 미노출 핵심 문장 풀이 카드 필요; VERIFICATION_GAP: 실제 학생 구조 응답 없음
- S2 (s.chunk_boundary): CONCEPT_GAP: S2-S3 독립 관찰 미검증; ASSESSMENT_GAP: 경계·부착 교차 구별 과제 없음; VERIFICATION_GAP: 학생 오류 패턴/지연 자료 없음
- S3 (s.attachment): CONCEPT_GAP: S2-S3 독립성 아직 보류; CONTENT_GAP: 구조 중의성·최소쌍 검수 풀 없음; ASSESSMENT_GAP: 부착별 응답 루브릭 인간 검수 없음
- S4 (s.structural_relation): CONTENT_GAP: 구조별 모델·반례 자료 assets 빈 목록; ASSESSMENT_GAP: 구조 복원 답/허용 풀이 미검수; VERIFICATION_GAP: 미노출 전이·지연 수행 없음
- S5 (s.form_scope): CONCEPT_GAP: 형태·범위 응답 분리 정의 제안의 승인 없음; ASSESSMENT_GAP: 지시 대안/경계값 평행 과제 인간 검수 없음; CONTENT_GAP: 어법 문항 재고는 범위 진단 풀과 다름; VERIFICATION_GAP: 학생 반례/지연 응답 없음
- S-O1 (s.o.sentence_meaning_model): ASSESSMENT_GAP: 통합 명제 채점·허용 답 미검수; LEVEL_GAP: 통합 관찰 상태 정책은 원자 평균이 아님; VERIFICATION_GAP: 실제 학생 과정 응답 없음
- R1 (r.reference): EXECUTION_GAP: direct_check=ready 정적 정의; 이 감사에서 cohesion-link 실행 안 함; ASSESSMENT_GAP: 독립 대상/관계 구별 과제 필요; VERIFICATION_GAP: 학습자 지시 응답 없음
- R2 (r.relation): EXECUTION_GAP: direct_check=ready를 현재 도구 실행 성공으로 검증 안 함; ASSESSMENT_GAP: 관계 facet 허용 답·두 단위 범위 검수 필요; VERIFICATION_GAP: 실제 학생 관계 생성 자료 없음
- R3 (r.discourse_function): CONCEPT_GAP: R3-R4 구별 학생/Gold 관찰 없음; EXECUTION_GAP: direct_check=live는 정적 정의; claim-support 현재 실행 검증 안 함; ASSESSMENT_GAP: 역할/전개 구별 루브릭 미검수
- R4 (r.discourse_structure): CONCEPT_GAP: R3-R4 독립성 잠정; EXECUTION_GAP: direct_check=live 현재 실행 재검증 안 함; TRANSFER_GAP: 다른 조직/주제 미노출 풀·재확인 없음
- R5 (r.central_meaning): EXECUTION_GAP: direct_check=live는 코드북 정적 상태; claim-support 9문항이 현재 실행·유효 미노출 풀이라는 확인 안 함; ASSESSMENT_GAP: 요지 허용 답/대표성 루브릭 인간 검수 없음; TRANSFER_GAP/VERIFICATION_GAP: 주제·구조가 다른 학생 전이·지연 관찰 없음
- R6 (r.inference): ASSESSMENT_GAP: 추론 허용 연결·상대적 적합성 검수 필요; CONTENT_GAP: 빈칸/함축 재고는 추론 독립 풀 아님; VERIFICATION_GAP: 실제 학생 과잉 추론/전이 기록 없음
- R-O1 (r.o.global_meaning_model): ASSESSMENT_GAP: 전체 모델 질적 채점 검수 없음; LEVEL_GAP: 통합 관찰은 원자 평균 없음; TRANSFER_GAP: 담화가 다른 미노출 풀 확인 안 함
- E1 (e.task_demand): CONCEPT_GAP: 독립 원자/과제 facet/전략 재분류 미확정; ASSESSMENT_GAP: 발문만/자료 포함 교차 과제 없음; VERIFICATION_GAP: 실제 학생 방향 오해와 다른 원인 구별 자료 없음
- E2 (e.evidence_location): EXECUTION_GAP: direct_check=live 현재 실행 안 함; 5문항 묶음은 유효 재고 검증이 아님; ASSESSMENT_GAP: 표/안내/본문 anchor 검수·허용 범위 도구 필요; TRANSFER_GAP/VERIFICATION_GAP: 미노출 형식 전이/지연 기록 없음
- E3 (e.option_correspondence): EXECUTION_GAP: direct_check=live 및 6문항 묶음은 정적 정의; 현재 option-restate 실행/유효 미노출 풀 검증 안 함; ASSESSMENT_GAP: 내용-fit/후보 단위/허용 답 인간 검수 필요; TRANSFER_GAP: 표·실용문·제목 조건별 미노출 풀 확인 안 함; VERIFICATION_GAP: 학생 후보 논증·지연 관찰 없음
- E-O1 (e.o.final_judgment): ASSESSMENT_GAP: 충분한 과정 근거의 실제 수집/검수 미확인; EXECUTION_GAP: content_needed; reveal-gate 현재 동작 검증 아님; VERIFICATION_GAP: 학생 통합 과정 없음
- L1 (l.sound): CONCEPT_GAP: 보류 ontology/관찰 조건 별도 승인 필요; ASSESSMENT_GAP: 읽기 문항은 이 TASK 측정 근거 아님; CONTENT_GAP: 음성/실행 조건 자료 미확보는 제품 지원 공백; 학생 결손 아님; EXECUTION_GAP/TRANSFER_GAP/VERIFICATION_GAP: 본 연구에서 해당 modality/실행·전이·지연 수행 안 함
- L2 (l.sentence): CONCEPT_GAP: 보류 ontology/관찰 조건 별도 승인 필요; ASSESSMENT_GAP: 읽기 문항은 이 TASK 측정 근거 아님; CONTENT_GAP: 음성/실행 조건 자료 미확보는 제품 지원 공백; 학생 결손 아님; EXECUTION_GAP/TRANSFER_GAP/VERIFICATION_GAP: 본 연구에서 해당 modality/실행·전이·지연 수행 안 함
- L3 (l.retain): CONCEPT_GAP: 보류 ontology/관찰 조건 별도 승인 필요; ASSESSMENT_GAP: 읽기 문항은 이 TASK 측정 근거 아님; CONTENT_GAP: 음성/실행 조건 자료 미확보는 제품 지원 공백; 학생 결손 아님; EXECUTION_GAP/TRANSFER_GAP/VERIFICATION_GAP: 본 연구에서 해당 modality/실행·전이·지연 수행 안 함
- L4 (l.respond): CONCEPT_GAP: 보류 ontology/관찰 조건 별도 승인 필요; ASSESSMENT_GAP: 읽기 문항은 이 TASK 측정 근거 아님; CONTENT_GAP: 음성/실행 조건 자료 미확보는 제품 지원 공백; 학생 결손 아님; EXECUTION_GAP/TRANSFER_GAP/VERIFICATION_GAP: 본 연구에서 해당 modality/실행·전이·지연 수행 안 함
- X1 (x.time_allocation): CONCEPT_GAP: 보류 ontology/관찰 조건 별도 승인 필요; ASSESSMENT_GAP: 읽기 문항은 이 TASK 측정 근거 아님; CONTENT_GAP: 음성/실행 조건 자료 미확보는 제품 지원 공백; 학생 결손 아님; EXECUTION_GAP/TRANSFER_GAP/VERIFICATION_GAP: 본 연구에서 해당 modality/실행·전이·지연 수행 안 함
- X2 (x.sequence): CONCEPT_GAP: 보류 ontology/관찰 조건 별도 승인 필요; ASSESSMENT_GAP: 읽기 문항은 이 TASK 측정 근거 아님; CONTENT_GAP: 음성/실행 조건 자료 미확보는 제품 지원 공백; 학생 결손 아님; EXECUTION_GAP/TRANSFER_GAP/VERIFICATION_GAP: 본 연구에서 해당 modality/실행·전이·지연 수행 안 함
- X3 (x.recovery_adaptation): CONCEPT_GAP: 보류 ontology/관찰 조건 별도 승인 필요; ASSESSMENT_GAP: 읽기 문항은 이 TASK 측정 근거 아님; CONTENT_GAP: 음성/실행 조건 자료 미확보는 제품 지원 공백; 학생 결손 아님; EXECUTION_GAP/TRANSFER_GAP/VERIFICATION_GAP: 본 연구에서 해당 modality/실행·전이·지연 수행 안 함
- X4 (x.attention_stamina): CONCEPT_GAP: 보류 ontology/관찰 조건 별도 승인 필요; ASSESSMENT_GAP: 읽기 문항은 이 TASK 측정 근거 아님; CONTENT_GAP: 음성/실행 조건 자료 미확보는 제품 지원 공백; 학생 결손 아님; EXECUTION_GAP/TRANSFER_GAP/VERIFICATION_GAP: 본 연구에서 해당 modality/실행·전이·지연 수행 안 함
- X-O1 (x.o.whole_test_stability): CONCEPT_GAP: 보류 ontology/관찰 조건 별도 승인 필요; ASSESSMENT_GAP: 읽기 문항은 이 TASK 측정 근거 아님; CONTENT_GAP: 음성/실행 조건 자료 미확보는 제품 지원 공백; 학생 결손 아님; EXECUTION_GAP/TRANSFER_GAP/VERIFICATION_GAP: 본 연구에서 해당 modality/실행·전이·지연 수행 안 함

목표점수·등급·날짜와의관련성을정리할수있지만 학습당예상점수·개인필요량은미확정이다. 현재재고와필요학습량을구별한다. 읽기만으로듣기/실전지원율을추정하지않으며45문항전체학습지원완료는아니다. static live는현재실행확인과별개로미확인이다.
