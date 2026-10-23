# 01 유형 × 판단 기능 × 자료 준비도 매트릭스 (D0-A + A)

작성 2026-10-24 · 읽기 전용 조사(에이전트 1/10). DB=`jajenrevcbmrpaliomxv` SELECT 만. 원문·선지 문자열은 옮기지 않았다.
표기: **VERIFIED**=이번에 직접 SQL/파일로 재확인 · **CITED**=S0 문서 인용(재확인 안 함) · DATA_GAP / NOT_VERIFIED.

## 0. 보고 수치 재검증

| 주장 | 재검증 결과 | 근거 |
|---|---|---|
| DB 유형 26 (독해 19 · 장문 7) | VERIFIED | Q1 |
| active 22 / retired 4 | VERIFIED (retired = R-BLANK2 · R-REFER · X-BLANK · X-BLANK2) | Q1 |
| 저장 문항 3,714 · 미분류 16 · 공개 카탈로그 3,412 | VERIFIED | Q2 |
| 시험 구분 | suneung 382 · mock 420 · hakpyeong 2,912 (합 3,714) VERIFIED | Q2 |
| in_review 186 (이전 published 3 / 없음 183) | VERIFIED 186 / 3 / 183 | Q2 (S0 REPRODUCE.sql 과 같은 논리) |
| 로컬 듣기 18유형 · 248문항 · 14회 | VERIFIED: `scripts/csat/data/classified.json` rows 630 중 L- 248, exam 14종, 유형 18, unassigned_rows 0, multi_rows 0 | node 집계 |
| 듣기 전사 UNKNOWN (S0 READINESS_MATRIX) | **불일치**: `scripts/csat/data/listening/*.json` 16회(수능 2017–2023 7회 + 모평 9회) × 17 = **272문항에 turns/script 존재**, choices 필드 없음. 도입 커밋 `1b221c714` | §2 |
| 유형별 v3/강의/의미 수 | CITED(S0 READINESS_MATRIX), 재검증 안 함 | — |

## 1. ASSET_INVENTORY

### 1.1 ID·코드 체계
- 문항 ID `<exam>#<no>` (예 `2026#34`, `M2706#25`, `H1906G1#31`). exam kind = suneung / mock / hakpyeong (Q2).
- DB type_id 26 (`csat_types`).
- 교수 모델 26 = `D:/workspace/Vocaflow-csat-v4-s0/apps/web/src/lib/csat/teaching-contract.ts#TEACHING_MODELS` (51행, 키 26개 — **DB type_id 와 같은 키 1:1**). 현재 워크트리(`design/replica-first`)에는 이 파일이 없다(`git ls-files | grep teaching-contract` 0건).
- 로컬 듣기 L- 18: `scripts/csat/data/classified.json` (분류기 `scripts/csat/classify-types.mjs`, CITED).
- 로드맵 임시 R01~R19 / L07: 정본 아님 (S0 TYPE_REGISTRY 부록 A, CITED). 채택하지 않는다.
- 역량 코드 A1~A9: A1 어휘 · A2 구문 · A3 논리흐름 · A4 재진술 · A5 근거판단 · A6 배경지식 · A7 듣기 · A8 어법 · A9 속도 (`diagnosis/labels.ts#ATTRIBUTE_NAME`, CITED). `csat_dx_type_attribute` 에 A7 행 0 (CITED, T-0131 appendix). 9개 행 모두 reviewed 인 문항 140 (CITED).

### 1.2 미분류 16 (수 VERIFIED, ID 목록 CITED S0 TYPE_REGISTRY)
H1803G1#29, H1806G2#27, H1806G2#28, H1906G1#31~#34, H1906G1#36~#39, H1803G3#29, H1903G1#28, H2403G2#20, H2503G1#40, H2603G1#40. 선지 5개 15/16, body_ok 9/16 (Q4). 원인(네모 어법·요약문·발문 파싱 등) NOT_VERIFIED. 재분류는 DB 쓰기 → 승인 대상.

## 2. 로컬 듣기 자료 실측
- `classified.json`: `scope.primary`='13개년(2014=B형)', `out_of_scope`=['2014A'] 인데 rows 에는 2014A 문항이 들어 있다(예 L-MENTIONED 1건 = 2014A#13). 248 이 2014A 를 포함한 수다.
- `listening/*.json` 16파일: 2017–2023(수능 7) + M1906·M1909·M2109·M2206·M2209·M2306·M2309·M2406·M2409(모평 9). 필드 exam,no,stem,turns,script,words,nTurns,speakers,isDialogue,typeGuess. **선지 전문 없음** → 듣기 전 유형 선지 DATA_GAP.
- 수능 2014–2016 · 2024–2026 전사 DATA_GAP. 원음 0, 전사 출처·검수·권리 NOT_VERIFIED. DB 적재 0. `listening/` 의 typeGuess 와 classified.json 유형의 일치 여부 NOT_VERIFIED.

## 3. 유형 매트릭스 — DB 26

판단 기능 코드(이 문서의 작업 라벨, 정본 아님): **F-CENTRAL** 중심명제 추상화 · **F-COMPARE** 선지↔근거 성분 대조 · **F-CHAIN** 담화 연결 사슬 · **F-SLOT** 자리 조건 충족 · **F-POLAR** 극성/방향 · **F-FORM** 구조-형태 일치 · **F-REFER** 지시 추적 · **F-ACT** 화행/태도 · **F-CALC** 수치 계산. 기능 서술은 teaching-contract.ts 문구(S0 인용)를 압축한 것.

열: N/S = 전체/수능 문항(Q1·Q3) · ch5 = 관리자 DB 선지 5개 · bodyOK = `body_ok` (Q4) · v3/강의/의미 = CITED. 학습자 측 원문·선지 제공 상태는 전부 unknown(S0).

| type | 상태 | 발문이 판단시키는 것 | 판단 기능 | N/S | ch5/bodyOK | v3/강의/의미 | 대표 ID | 경계 ID | 분류 |
|---|---|---|---|---|---|---|---|---|---|
| R-PURPOSE | active | 글의 목적 | F-ACT | 131/12 | 131/125 | 26/27/1 | M2706#18 | NOT_VERIFIED | DESIGNABLE |
| R-MOOD | active | 심경 변화 | F-POLAR + 전환점(고유) | 132/13 | 132/131 | 21/28/0 | M2706#19 | NOT_VERIFIED | PARTIAL(의미 0) |
| R-CLAIM | active | 필자 주장 | F-ACT + F-CENTRAL | 127/10 | 127/126 | 25/23/1 | M2706#20 | NOT_VERIFIED | DESIGNABLE |
| R-IMPLY | active | 밑줄 함축 | 비유→원관념(고유) | 115/8 | 115/115 | 22/22/1 | M2706#21 | NOT_VERIFIED | DESIGNABLE |
| R-GIST | active | 요지 | F-CENTRAL | 132/14 | 132/131 | 27/29/1 | 2026#22 | NOT_VERIFIED | DESIGNABLE |
| R-TOPIC | active | 주제 | F-CENTRAL | 134/15 | 134/132 | 30/29/1 | M2706#23 | NOT_VERIFIED | DESIGNABLE |
| R-TITLE | active | 제목 | F-CENTRAL | 137/16 | 137/134 | 31/31/1 | M2706#24 | NOT_VERIFIED | DESIGNABLE |
| R-CHART | active | 도표 불일치 | F-COMPARE + F-CALC | 133/14 | 133/130 | 29/29/1 | M2706#25 | NOT_VERIFIED | PARTIAL(도표 셀 결속 DATA_GAP · 해설 30/133 CITED) |
| R-FACT | active | 내용 불일치 | F-COMPARE | 131/13 | 131/126 | 28/28/1 | M2706#26 | NOT_VERIFIED | DESIGNABLE |
| R-NOTICE | active | 안내문 일치 | F-COMPARE(허용/금지 조건) | 265/27 | 265/244 | 57/57/2 | M2706#28 | NOT_VERIFIED | PARTIAL(bodyOK 92%) |
| R-GRAMMAR | active | 어법 | F-FORM(고유) | 129/14 | 129/129 | 29/28/1 | M2706#29 | 네모형 후보가 미분류 16에 있다는 주장 NOT_VERIFIED | DESIGNABLE |
| R-VOCAB | active | 문맥 어휘 | F-POLAR | 132/14 | 132/124 | 28/29/1 | M2706#30 | NOT_VERIFIED | DESIGNABLE |
| R-BLANK | active | 빈칸 | F-SLOT + F-CENTRAL | 527/55 | 527/**354** | 115/115/4 | 2026#34 | NOT_VERIFIED | PARTIAL(bodyOK 67%) |
| R-IRRELEVANT | active | 무관 문장 | F-CHAIN | 132/13 | 132/132 | 28/28/1 | M2706#35 | NOT_VERIFIED | DESIGNABLE |
| R-ORDER | active | 글의 순서 | F-CHAIN(단락 선행조건) | 262/26 | 262/256 | 56/55/2 | M2706#37 | NOT_VERIFIED | DESIGNABLE |
| R-INSERT | active | 문장 삽입 | F-CHAIN + F-SLOT | 262/26 | 262/261 | 55/56/2 | 2026#38 | NOT_VERIFIED | DESIGNABLE |
| R-SUMMARY | active | 요약문 (A)(B) | F-SLOT + F-CENTRAL + F-POLAR | 130/13 | 130/**29** | 28/28/1 | M2706#40 | NOT_VERIFIED | **PARTIAL (bodyOK 22% → DATA_GAP 위험)** |
| R-BLANK2 | retired | 빈칸 2개 | F-SLOT ×2 | 4/4 | 4/4 | 2/4/0 | 2014B#37 | — | 보관 |
| R-REFER | retired | 단문 지칭 | F-REFER | 18/5 | 18/17 | 6/6/0 | M1809#30 | — | 보관 |
| X-TITLE | active | 장문 제목 | F-CENTRAL | 133/14 | 133/124 | 29/28/1 | M2706#41 | NOT_VERIFIED | DESIGNABLE |
| X-VOCAB | active | 장문 어휘 | F-POLAR | 115/8 | 115/109 | 22/22/1 | M2706#42 | NOT_VERIFIED | DESIGNABLE |
| X-ORDER | active | 장문 순서 | F-CHAIN(사건) | 133/14 | 133/133 | 29/29/1 | M2706#43 | NOT_VERIFIED | DESIGNABLE |
| X-REFER | active | 장문 지칭 | F-REFER | 133/14 | 133/133 | 27/29/1 | M2706#44 | NOT_VERIFIED | DESIGNABLE |
| X-FACT | active | 장문 내용 일치 | F-COMPARE | 133/14 | 133/133 | 29/29/1 | M2706#45 | NOT_VERIFIED | DESIGNABLE |
| X-BLANK | retired | 장문 빈칸 | F-SLOT | 17/5 | 17/14 | 6/6/0 | M1809#42 | — | 보관 |
| X-BLANK2 | retired | 장문 빈칸 2 | F-SLOT ×2 | 1/1 | 1/1 | 1/1/0 | 2017#42 | — | 보관 |

대표 ID 는 S0 TYPE_REGISTRY 표본(CITED). 경계 표본은 S0 `REPRESENTATIVE_EDGE_CASES.md` 와 재대조하지 않아 NOT_VERIFIED. DESIGNABLE 은 "관리자 DB 에 원문·선지 5개·body_ok 가 대부분 있다" 수준이며 학습자 제공 자료·내용 감수·권리는 별도 미검증.

## 4. 로컬 듣기 18 (건수 VERIFIED · 표본 ID CITED S0)

| type | 발문 판단 | 판단 기능 | 건수 | 대표 | 경계 | 전사 | 선지 | 분류 |
|---|---|---|---|---|---|---|---|---|
| L-PURPOSE | 담화 목적 | F-ACT | 15 | 2026#1 | 2014B#4 | 부분 | GAP | DATA_GAP |
| L-OPINION | 의견 | F-ACT / F-CENTRAL | 13 | 2026#2 | 2014B#7 | 부분 | GAP | DATA_GAP |
| L-MAIN | 요지 | F-CENTRAL | 3 | 2026#3 | 2024#3 | 부분 | GAP | DATA_GAP |
| L-TOPIC | 주제(단독) | F-CENTRAL | 5 | 2015#4 | 2014B#5 | 부분 | GAP | DATA_GAP |
| L-RELATION | 관계 | 화자 역할 추론(고유) | 11 | 2023#3 | 2014B#9 | 부분 | GAP | DATA_GAP |
| L-PICTURE | 그림 불일치 | F-COMPARE(이미지) | 15 | 2026#4 | 2014B#8 | 부분 | GAP + 이미지 | DATA_GAP |
| L-TODO | 할 일 | 후속 행동(고유) | 12 | 2026#5 | 2014B#10 | 부분 | GAP | DATA_GAP |
| L-FAVOR | 부탁한 일 | F-ACT | 4 | 2019#7 | 2014B#11 | 부분 | GAP | DATA_GAP |
| L-MONEY | 지불 금액 | F-CALC | 14 | 2026#6 | 2014B#14 | 부분 | GAP | DATA_GAP |
| L-REASON | 이유 | 인과(고유) | 14 | 2026#7 | 2014B#12 | 부분 | GAP | DATA_GAP |
| L-NOTMENTION | 언급 안 된 것 | F-COMPARE(범위) | 13 | 2026#8 | 2014B#13 | 부분 | GAP | DATA_GAP |
| L-MENTIONED | 언급한 것 | F-COMPARE | 1 | 2014A#13 | 없음 | 없음 | GAP | DATA_GAP |
| L-ANNOUNCE | 담화 불일치 | F-COMPARE | 15 | 2026#9 | 2014B#15 | 부분 | GAP | DATA_GAP |
| L-TABLE | 표 선택 | F-COMPARE 조건 교집합 | 14 | 2026#10 | 2014B#17 | 부분 | GAP + 표 | DATA_GAP |
| L-RESPONSE | 응답 | 화행 적합(고유) | 58 | 2026#14 | 2014B#1 | 부분 | GAP | DATA_GAP |
| L-SITUATION | 상황 후 할 말 | F-ACT | 14 | 2026#15 | 2014B#20 | 부분 | GAP | DATA_GAP |
| L-SET-TOPIC | 세트 주제 | F-CENTRAL | 13 | 2026#16 | 2014B#21 | 부분 | GAP | DATA_GAP |
| L-SET-NOT | 세트 불포함 | F-COMPARE | 14 | 2026#17 | 2014B#22 | 부분 | GAP | DATA_GAP |

"부분": `listening/` 의 2017–2023 수능 7회 해당 문항만 turns 존재. 원음 0 · 검수 0 · 권리 NOT_VERIFIED. TTS 대체 금지(S0). 해설/v3/강의/의미/교수 모델 모두 없음.

## 5. SIMILARITY — 유형 수준 중복

| 묶음 | 근거 | 판정 |
|---|---|---|
| R-GIST · R-TOPIC · R-TITLE · X-TITLE (+ L-MAIN · L-TOPIC · L-SET-TOPIC) | teaching-contract.ts 의 판단 기능 문구가 4유형에서 **글자 그대로 동일**(S0 TYPE_REGISTRY 인용) | F-CENTRAL 공유. 차이는 선지 언어(한글 포함 R-GIST 132/132 vs R-TOPIC 1/134, CITED)와 추상도. 유형은 유지, 판단 모듈 공유 후보 |
| R-FACT · X-FACT · R-NOTICE · L-ANNOUNCE · L-NOTMENTION · L-SET-NOT · L-PICTURE | 모두 성분별 대조 | F-COMPARE 공유, 매체만 다름 |
| R-CHART · L-TABLE · L-MONEY | 수치·조건 계산 | F-CALC 공유 |
| R-BLANK/R-BLANK2/X-BLANK/X-BLANK2 · R-REFER/X-REFER · R-VOCAB/X-VOCAB · R-ORDER/X-ORDER | 단문↔장문 쌍 | 판단 동일, 범위(단락 넘김)만 차이. retired 4종은 활성 쌍으로 흡수 후보(결정 아님) |
| R-PURPOSE · R-CLAIM · L-PURPOSE · L-OPINION · L-FAVOR · L-SITUATION | 화행/태도 | F-ACT 공유 |

교수 모델 26 과의 관계: 모델 26 = DB 26 type_id 와 키 1:1 이므로 "모델 26 · 유형 26" 은 같은 축이다(S0 의 "서로 다른 분류" 서술은 듣기 18 에만 해당). 판단 기능 기준 서로 다른 기능은 26보다 적다(F-CENTRAL 4중복 등). 듣기 18 은 교수 모델 없음.

## 6. 결함 후보

- **P1** R-SUMMARY `body_ok` 29/130(22%), R-BLANK 354/527(67%) — 유형 설계 시 원문 품질 DATA_GAP (Q4). 원인 NOT_VERIFIED.
- **P1** S0 의 "듣기 전사 UNKNOWN" 은 저장소 실태와 다름: 272문항 전사 존재(출처·검수 미확인). 반대로 선지 전문은 0 → 듣기 선택지 판단 설계 불가.
- **P2** teaching-contract.ts 가 현재 워크트리(`design/replica-first`)에 없다 — 다른 브랜치 자산 의존.
- **P2** classified.json `out_of_scope: ['2014A']` 인데 rows 에 2014A 포함.
- 미분류 16 재분류는 DB 쓰기 → 사용자 승인 필요.

## 부록 Q — 실행한 SQL (모두 SELECT)
- Q1 `select t.id,t.section,t.status,count(i.id) … from csat_types t left join csat_items i on i.type_id=t.id left join csat_exams e on e.id=i.exam_id group by 1,2,3`
- Q2 kind 별 문항 수(csat_exams⋈csat_items), `count(*) from csat_items`, type_id null 수, `count(*) from csat_items_public`, in_review CTE(`distinct on(item_id) … order by item_id,version desc` + published 존재), `count(distinct item_id) … status='published'`(=3,412)
- Q3 `select i.type_id,count(*) from csat_items i join csat_exams e on e.id=i.exam_id where e.kind='suneung' group by 1`
- Q4 `select type_id,count(*),count(*) filter(where jsonb_typeof(choices)='array' and jsonb_array_length(choices)=5),count(*) filter(where coalesce(length(passage),0)>50),count(*) filter(where body_ok) from csat_items group by 1`
