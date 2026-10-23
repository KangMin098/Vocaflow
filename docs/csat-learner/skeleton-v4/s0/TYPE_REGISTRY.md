# S0 실제 유형·판단 기능·증거 매체 등록부

측정: 2026-10-23T12:08:29.06415+00:00 / 기준 소스: `3f437e9b65e06c00a96f64890402500417377c92` / AI-Control: T-0131의 보완 실사.

원문·선지 전문·개인 학습기록은 저장하지 않았다. DB 관리자 SELECT의 관측이며 계정별 접근 가능성은 별도다. 분류의 내용 타당성·전체 기출의 완전성·학생 효과를 입증하지 않는다.

DB 저장 문항 **3,714**, 유형 원장 **26(독해 19 + 장문 7)**, 매핑 **3,698**, 미분류 **16**. 공개 카탈로그 3,412는 이 가운데 일부다. DB에는 듣기 문항 0이지만, 별도 로컬 수능 분류 자료에는 14회·630문항 중 듣기 **248문항·18유형**이 있다. 아래 합집합 44유형은 **저장소에서 관측한 분류**이며 전체 실존 기출의 공인 완전 분류가 아니다. 임시 R19/L07을 정본으로 승격하지 않는다.

## DB 유형 26개

판단 기능/증거 단위 열은 기존 `teaching-contract.ts#TEACHING_MODELS`에 **적혀 있는 내용을 옮긴 관측**이다. 그 모델의 재사용 여부는 S0에서 정하지 않으며(S1 심사), 문항별 내용 감수 결과도 아니다. 교수 모델 26개·DB 유형 26개·로컬 듣기 18유형은 서로 다른 분류다.

| 실제 type_id | 이름/상태 | S/M/H | 기존 판단 기능 | 증거 단위 | 표본 ID | 근거 경로 |
| --- | --- | --- | --- | --- | --- | --- |
| R-BLANK | 빈칸 추론 / active | 55/60/412 | 빈칸 문장이 요구하는 논리 조건(무엇의 재진술인가)과 그 조건을 채우는 앞뒤 근거 | blank, sentence, choice | 2026#34 | csat_types · csat_items.type_id · teaching-contract.ts#R-BLANK |
| R-BLANK2 | 빈칸 추론(2개·폐지) / retired | 4/0/0 | 두 빈칸이 각각 독립 제약을 갖고, 선지 쌍이 그 교집합에서만 성립한다 | blank, sentence, choice | 2014B#37 | csat_types · csat_items.type_id · teaching-contract.ts#R-BLANK2 |
| R-CHART | 도표 / active | 14/15/104 | 선지의 비교 · 배수 · 순위 · 전칭 조건을 실제 도표의 범주 · 단위 · 값으로 계산해 대조 | chart_series, table_cell, choice | M2706#25 | csat_types · csat_items.type_id · teaching-contract.ts#R-CHART |
| R-CLAIM | 필자 주장 / active | 10/15/102 | 당위 · 판단 표현(should · must · 평가어)이 주장을 만들고, 선지가 그 판단을 어떻게 옮기는가 | sentence, choice | M2706#20 | csat_types · csat_items.type_id · teaching-contract.ts#R-CLAIM |
| R-FACT | 내용 일치(글) / active | 13/15/103 | 선지 진술과 지문 진술의 성분별 대조(주체 · 행동 · 시점 · 수치) | sentence, choice | M2706#26 | csat_types · csat_items.type_id · teaching-contract.ts#R-FACT |
| R-GIST | 요지 / active | 14/15/103 | 중심 명제(범위 · 관점)가 선지에서 어떻게 추상화 · 압축되는가 | sentence, choice | 2026#22 | csat_types · csat_items.type_id · teaching-contract.ts#R-GIST |
| R-GRAMMAR | 어법 / active | 14/15/100 | 밑줄 자리가 절 구조(주어 · 정동사 · 수식 · 지배)에서 요구하는 형태와 실제 형태의 일치 | underline, choice | M2706#29 | csat_types · csat_items.type_id · teaching-contract.ts#R-GRAMMAR |
| R-IMPLY | 함축 의미 / active | 8/14/93 | 밑줄 표현의 비유가 문맥에서 가리키는 원관념이 무엇인가 | underline, sentence, choice | M2706#21 | csat_types · csat_items.type_id · teaching-contract.ts#R-IMPLY |
| R-INSERT | 문장 삽입 / active | 26/30/206 | 삽입문이 앞 · 뒤에 요구하는 조건과 그 자리 양쪽의 연결 | sentence, choice | 2026#38 | csat_types · csat_items.type_id · teaching-contract.ts#R-INSERT |
| R-IRRELEVANT | 무관한 문장 / active | 13/15/104 | 유지되는 논리 사슬과, 한 문장이 그 사슬의 관계를 바꾸는 지점 | sentence, choice | M2706#35 | csat_types · csat_items.type_id · teaching-contract.ts#R-IRRELEVANT |
| R-MOOD | 심경·분위기 / active | 13/15/104 | 사건 전환점을 기준으로 앞뒤 감정 근거 표현이 어떻게 바뀌는가 | sentence, choice | M2706#19 | csat_types · csat_items.type_id · teaching-contract.ts#R-MOOD |
| R-NOTICE | 안내문 일치 / active | 27/30/208 | 선지 항목과 안내문 항목의 주체 · 행동 · 수치 · 시점 · 허용/금지 조건 대조 | notice_item, choice | M2706#28 | csat_types · csat_items.type_id · teaching-contract.ts#R-NOTICE |
| R-ORDER | 글의 순서 / active | 26/30/206 | 각 단락이 앞에 요구하는 선행 조건(지시어 · 연결어 · 관사 · 시제)의 사슬 | paragraph, choice | M2706#37 | csat_types · csat_items.type_id · teaching-contract.ts#R-ORDER |
| R-PURPOSE | 글의 목적 / active | 12/15/104 | 배경 → 요청/행동 요구 문장이 글의 목적을 정하고, 선지가 그 화행을 어떤 동사로 옮기는가 | sentence, choice | M2706#18 | csat_types · csat_items.type_id · teaching-contract.ts#R-PURPOSE |
| R-REFER | 지칭 추론(단문·폐지) / retired | 5/1/12 | 등장 대상 · 행위자 · 소유자를 따라 각 대명사가 누구에 연결되는가 | underline, sentence, choice | M1809#30 | csat_types · csat_items.type_id · teaching-contract.ts#R-REFER |
| R-SUMMARY | 요약문 완성 / active | 13/15/102 | 원문 명제의 성분이 요약문 각 칸(의미 · 극성 · 한정)으로 어떻게 압축되는가 | summary_slot, sentence, choice | M2706#40 | csat_types · csat_items.type_id · teaching-contract.ts#R-SUMMARY |
| R-TITLE | 제목 / active | 16/15/106 | 중심 명제(범위 · 관점)가 선지에서 어떻게 추상화 · 압축되는가 | sentence, choice | M2706#24 | csat_types · csat_items.type_id · teaching-contract.ts#R-TITLE |
| R-TOPIC | 주제 / active | 15/15/104 | 중심 명제(범위 · 관점)가 선지에서 어떻게 추상화 · 압축되는가 | sentence, choice | M2706#23 | csat_types · csat_items.type_id · teaching-contract.ts#R-TOPIC |
| R-VOCAB | 어휘(문맥) / active | 14/15/103 | 밑줄 낱말의 극성이 문맥의 조건 · 인과 · 목적 방향과 맞는가 | underline, sentence, choice | M2706#30 | csat_types · csat_items.type_id · teaching-contract.ts#R-VOCAB |
| X-BLANK | 장문 빈칸(1개·폐지) / retired | 5/1/11 | 장문의 단락 흐름 속에서 빈칸이 요구하는 결론 · 원리 | blank, paragraph, sentence, choice | M1809#42 | csat_types · csat_items.type_id · teaching-contract.ts#X-BLANK |
| X-BLANK2 | 장문 빈칸(2개) / retired | 1/0/0 | 장문에서 두 빈칸의 독립 제약과 교차 | blank, paragraph, choice | 2017#42 | csat_types · csat_items.type_id · teaching-contract.ts#X-BLANK2 |
| X-FACT | 장문 내용 일치 / active | 14/15/104 | 이야기 단락의 사실과 선지 진술의 성분별 대조 | paragraph, sentence, choice | M2706#45 | csat_types · csat_items.type_id · teaching-contract.ts#X-FACT |
| X-ORDER | 장문 순서 / active | 14/15/104 | 이야기 단락의 사건 · 인물 · 시점 사슬 | paragraph, choice | M2706#43 | csat_types · csat_items.type_id · teaching-contract.ts#X-ORDER |
| X-REFER | 장문 지칭 / active | 14/15/104 | 단락을 넘는 인물 · 행위자 연결 | underline, paragraph, choice | M2706#44 | csat_types · csat_items.type_id · teaching-contract.ts#X-REFER |
| X-TITLE | 장문 제목 / active | 14/15/104 | 중심 명제(범위 · 관점)가 선지에서 어떻게 추상화 · 압축되는가 | paragraph, sentence, choice | M2706#41 | csat_types · csat_items.type_id · teaching-contract.ts#X-TITLE |
| X-VOCAB | 장문 어휘 / active | 8/14/93 | 장문 흐름의 방향과 밑줄 낱말 극성의 일치 | underline, paragraph, choice | M2706#42 | csat_types · csat_items.type_id · teaching-contract.ts#X-VOCAB |

## 별도 로컬 듣기 등록부 18개

근거: `scripts/csat/data/classified.json`의 rows/types, 분류기 `scripts/csat/classify-types.mjs`. 표본은 확보된 파일의 실제 문항 ID다. 2014A/B는 listening_end=22이며 다른 수능은 17이다. 모평·학평 듣기는 이 로컬 14회 표본의 분모 밖이므로 UNKNOWN. 원음/전사/권리·계정 공개는 확인되지 않았으며 TTS를 대체 원음으로 쓰지 않는다.

| 유형 | 이름 | 로컬 건수 | 판단 기능(설계 대응) | 요구 매체 | 정상 후보 | 경계 후보 | DB/콘텐츠 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L-PURPOSE | 담화 목적 | 15 | 담화 목적/화행 | AUDIO_RANGE · TRANSCRIPT_TURN | 2026#1 | 2014B#4 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |
| L-OPINION | 의견 | 13 | 화자 의견/평가 | AUDIO_RANGE · TRANSCRIPT_TURN | 2026#2 | 2014B#7 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |
| L-MAIN | 요지 | 3 | 담화 핵심/요지 | AUDIO_RANGE · TRANSCRIPT_TURN | 2026#3 | 2024#3 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |
| L-TOPIC | 담화 주제(단독) | 5 | 담화 중심 주제 | AUDIO_RANGE · TRANSCRIPT_TURN | 2015#4 | 2014B#5 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |
| L-RELATION | 관계 | 11 | 화자 역할·관계 추론 | AUDIO_RANGE · TRANSCRIPT_TURN · SPEAKER | 2023#3 | 2014B#9 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |
| L-PICTURE | 그림 | 15 | 발화와 그림 내용/위치 대조 | AUDIO_RANGE · IMAGE_REGION | 2026#4 | 2014B#8 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |
| L-TODO | 할 일 | 12 | 후속 행동·시점 판단 | AUDIO_RANGE · TRANSCRIPT_TURN | 2026#5 | 2014B#10 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |
| L-FAVOR | 부탁한 일 | 4 | 요청 대상·행동 | AUDIO_RANGE · SPEAKER | 2019#7 | 2014B#11 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |
| L-MONEY | 지불 금액 | 14 | 수량·할인 조건·최종 금액 | AUDIO_RANGE · NUMERIC_VALUE | 2026#6 | 2014B#14 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |
| L-REASON | 이유 | 14 | 행동 원인/이유 | AUDIO_RANGE · TRANSCRIPT_TURN | 2026#7 | 2014B#12 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |
| L-NOTMENTION | 언급되지 않은 것 | 13 | 언급 범위·없는 정보 | AUDIO_RANGE · TRANSCRIPT_TURN | 2026#8 | 2014B#13 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |
| L-MENTIONED | 언급한 것 고르기 | 1 | 언급 내용·오류 대조 | AUDIO_RANGE · TRANSCRIPT_TURN | 2014A#13 | DATA_GAP: 별도 경계 표본 없음 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |
| L-TABLE | 표 보고 선택 | 14 | 발화 조건과 표 항목의 교집합 | AUDIO_RANGE · CHART_CELL | 2026#10 | 2014B#17 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |
| L-ANNOUNCE | 담화 내용 불일치 | 15 | 담화 사실 일치/불일치 | AUDIO_RANGE · TRANSCRIPT_TURN | 2026#9 | 2014B#15 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |
| L-RESPONSE | 짧은 응답 | 58 | 직전 화행·응답 적합성 | AUDIO_RANGE · TRANSCRIPT_TURN · SPEAKER | 2026#14 | 2014B#1 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |
| L-SITUATION | 상황 후 할 말 | 14 | 상황·역할에 맞는 화행 | AUDIO_RANGE · SPEAKER | 2026#15 | 2014B#20 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |
| L-SET-TOPIC | 세트 주제 | 13 | 공유 담화의 주제 | SHARED_AUDIO · TRANSCRIPT_TURN | 2026#16 | 2014B#21 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |
| L-SET-NOT | 세트 불포함 | 14 | 공유 담화의 포함/불포함 | SHARED_AUDIO · TRANSCRIPT_TURN | 2026#17 | 2014B#22 | DB 미적재 / 로컬 메타만 / 원음·전사·시간·화자 UNKNOWN |

## 미분류 16개

| 문항 | type_id | body_ok | 선지 수(관리자) | 상태 |
| --- | --- | --- | --- | --- |
| H1803G1#29 | NULL | true | 5 | UNMAPPED · 공개 카탈로그 제외 |
| H1806G2#27 | NULL | true | 5 | UNMAPPED · 공개 카탈로그 제외 |
| H1806G2#28 | NULL | true | 5 | UNMAPPED · 공개 카탈로그 제외 |
| H1906G1#31 | NULL | true | 5 | UNMAPPED · 공개 카탈로그 제외 |
| H1906G1#32 | NULL | false | 5 | UNMAPPED · 공개 카탈로그 제외 |
| H1906G1#33 | NULL | true | 5 | UNMAPPED · 공개 카탈로그 제외 |
| H1906G1#34 | NULL | true | 5 | UNMAPPED · 공개 카탈로그 제외 |
| H1906G1#36 | NULL | false | 5 | UNMAPPED · 공개 카탈로그 제외 |
| H1906G1#38 | NULL | false | 5 | UNMAPPED · 공개 카탈로그 제외 |
| H1906G1#39 | NULL | false | 5 | UNMAPPED · 공개 카탈로그 제외 |
| H1803G3#29 | NULL | true | 5 | UNMAPPED · 공개 카탈로그 제외 |
| H1903G1#28 | NULL | false | 5 | UNMAPPED · 공개 카탈로그 제외 |
| H2403G2#20 | NULL | false | 5 | UNMAPPED · 공개 카탈로그 제외 |
| H2503G1#40 | NULL | true | 5 | UNMAPPED · 공개 카탈로그 제외 |
| H2603G1#40 | NULL | true | 5 | UNMAPPED · 공개 카탈로그 제외 |
| H1906G1#37 | NULL | false | UNKNOWN | UNMAPPED · 공개 카탈로그 제외 |

## A1~A9

A1 어휘 / A2 구문 / A3 논리흐름 / A4 재진술 / A5 근거판단 / A6 배경지식 / A7 듣기 / A8 어법 / A9 속도. `diagnosis/labels.ts#ATTRIBUTE_NAME`와 문항별 `csat_dx_item_attribute`를 구분한다. 9개 행 모두 reviewed_at을 갖는 문항은 140개. 유형 기본값·양수 태그는 문항별 검수나 역량 숙달을 뜻하지 않는다. A7의 실제 듣기 수행 근거는 이 DB 문항 범위에서 확보되지 않았다.

전체 문항/상태 행은 `ITEM_METADATA.json`에서 ID별 조회 가능하다. 로컬 수능 읽기 382개는 DB 수능 382개와 같은 ID 범위라 중복 합산하지 않는다. 전체 관측 ID 합집합은 3,962개(3,714 + 로컬 듣기 248)이며, 전 시험 전수 기출을 수집했다는 뜻이 아니다.

## 부록 A. 추가 관측(원 작업 T-0131 run1, 재검증해 유지한 항목)

- **로드맵 임시 ID 대응(추정):** R01 목적=R-PURPOSE · R02=R-MOOD · R03=R-CLAIM · R04=R-GIST · R05=R-TOPIC · R06=R-TITLE · R07=R-IMPLY · R08=R-BLANK(+R-BLANK2) · R09=R-IRRELEVANT · R10=R-ORDER · R11=R-INSERT · R12=R-CHART · R13=R-FACT · R14=R-NOTICE · R15=R-GRAMMAR · R16=R-VOCAB · R17=R-SUMMARY · R18=X-TITLE/X-VOCAB/X-BLANK* · R19=X-ORDER/X-REFER/X-FACT. R-REFER(폐지)는 대응 없음. R01~R19/L01~L07은 저장소·DB에 없고 사용자 Downloads 로드맵 초안에만 있다.
- **미분류 16의 형식별 원인(발문 앞부분 관측):** (A)(B)(C) 네모 어법 4(H1803G1#29·H1803G3#29·H1806G2#28·H1903G1#28 — 대응 유형 행 없음) · 내용 불일치 1(H1806G2#27, R-FACT 후보) · 요약문 2(H2503G1#40·H2603G1#40, R-SUMMARY 후보) · 발문 파싱 실패 9(H1906G1#31~34·#36~39·H2403G2#20). 분류 수정은 DB 쓰기라 승인 대상.
- **선지 언어(관리자 저장값, `choices::text ~ '[가-힣]'`):** 한글 선지 = R-PURPOSE·R-CLAIM·R-GIST·R-FACT·R-NOTICE·X-FACT 전량; 영문 = R-BLANK·R-IMPLY·R-MOOD·R-TITLE·R-TOPIC·R-ORDER·R-SUMMARY·X-*(FACT 제외); 혼재 = R-INSERT 162/262·R-GRAMMAR 64/129·R-VOCAB 72/132·R-IRRELEVANT 71/132. 삽입형은 선지 배열에 위치 사이 본문 조각이 저장된다(2026#38).
- **역량 가중치:** `csat_dx_type_attribute` 67행에서 A7은 어떤 유형에도 없다(DB에 듣기 유형이 없으므로 정합).
