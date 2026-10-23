# 00 · 전 유형 학습자 분석 통합 설계 (통합·충돌 검증 J)

작성 2026-10-24 · 독립 통합 에이전트(입력 01~10 비작성자) · 읽기 전용(DB SELECT 1회 추가, 파일 2개만 작성).
상태 라벨: VERIFIED(이번에 재확인) · CITED(입력 문서 인용) · NOT_VERIFIED · DATA_GAP · UNDETERMINED(결정 근거 부족).
**학습 효과는 어떤 항목도 검증되지 않았다.** 출제 의도 서술은 전부 가설이다. 11_CROSS_REVIEW 반영 수정은 §12 에 표시.

---

## 1. D0 요약

### 1.1 자산 목록 (VERIFIED/CITED)

| 자산 | 값 | 출처 |
|---|---|---|
| `csat_items` 저장 문항 | **3,714** (suneung 382 · mock 420 · hakpyeong 2,912) · 미분류 16(수능 0) | VERIFIED(J SQL) · 01 |
| 분석 행이 하나라도 있는 문항 | **3,595** · 분석 0행 문항 **119** | VERIFIED(J SQL) |
| 최신 version published 3,409 / in_review 186(과거 published 3, 없음 183) | — | 03 VERIFIED |
| 공개 카탈로그(published 존재 문항) | 3,412 (=3,409+3) | 01·03 산술 일치 |
| DB 유형 26(active 22 · retired 4) = 교수 모델 26 키 1:1 | — | 01 VERIFIED |
| 듣기 분류 248문항 · 18유형 · 14회 | `classified.json` | 01·09 VERIFIED |
| 듣기 전사 272문항 · 16회 | `listening-all.json`(272, J 재계수) = `listening/*.json` 16파일 | VERIFIED |
| 분류∩전사 | 119문항(수능 2017–2023) | 09 CITED |
| 듣기 승인 유형 정본 | 6회×17=102, 14종 | 09 CITED |
| 듣기 원음·선지·정답·이미지 | 0 | 09 |
| 교수 모델 화면 소비 | relation 1문장 + 불리언 2(distractorsAreTrue, visual) | 04 (s0 9e73d7660) |

### 1.2 충돌 판정 (요청된 a~e + 추가)

| # | 충돌 | 판정 | 근거 |
|---|---|---|---|
| a | 3,714(01) vs 3,595(03) | **둘 다 맞음 · 분모가 다름.** 3,714=`csat_items` 전체, 3,595=`csat_item_analyses` 의 distinct item_id. 차이 119 = 분석 행 자체가 없는 문항. 따라서 학습자에게 공개 분석이 없는 문항은 03 의 "183" 이 아니라 **302 = 119(분석 없음) + 183(in_review 만)**. 03 §5 P0(a) 의 NO_DATA 대상 수를 302 로 정정 | J SQL: items 3714, analyzed 3595, no_analysis 119 |
| b | LectureStage `:271`(10) vs `:303`(04) | **커밋별로 둘 다 맞음.** main `design/replica-first` 8cd15b7b6 → `:271`; s0 worktree 9e73d7660 → `:303`. 같은 동작(cue 변경 시 `scrollIntoView center`). 자동 `selectScene(target)` 은 s0 `AnalysisTheater.tsx:851` 에만 있고 main HEAD 에는 `liveScene` 코드 자체가 없다 → 10 의 E4 "줄 불일치"는 줄 이동이 아니라 **브랜치 차이** | grep 양쪽 |
| c | S0 "듣기 전사 UNKNOWN" vs 272 | **S0 문서가 낡음.** 272 전사 VERIFIED. 단 "전사 존재"≠"검수된 전사"(검수·화자 `who`·권리 NOT_VERIFIED). 01 은 `listening/*.json`, 09 는 `listening-all.json` 을 인용 — 같은 272 집합의 두 형태(합본·회차별), 상충 아님 | ls + node 계수 |
| d | S1 LECTURE_CONTRACT "34 선지 전문 미확보" vs DB 존재 | **관리자 DB 에는 5개 선지 존재(VERIFIED, `jsonb_array_length=5`).** S1 문구는 "학습자 제공/공식 원지 대조 완료 선지"로 읽으면 여전히 미확보(원지 대조 NOT_VERIFIED). → 문구를 "DB 보유 · 원지 대조·학습자 노출 미검증"으로 고쳐야 함. **수정 소유=Codex(S1 문서)**, 여기서는 증거로만 기록 | J SQL · 02 CC-08 |
| e | 34② 분석 unknown vs 강의 "거짓" 단정 | **분석이 우선(검수 기록 있음), 강의가 과잉 단정.** 원문이 법의 옹호자 역할을 다루지 않는다는 분석 판단을 J 가 뒤집을 근거 없음. 강의 c7·c10 은 `contentValidation: NOT_VERIFIED`. 결론: ② 진위 = UNKNOWN 유지, 강의는 "지문은 이를 판단할 근거를 주지 않는다"류로 바꿔야 함(후보, 미승인). verified 라벨은 내용 무결 증명이 아님(02) | 02 CC-02 · LECTURE_CONTRACT |
| f(추가) | 01 "모델 26 = DB 26 1:1 VERIFIED" vs 04 "대응 미질의" | 01 이 키 대조를 수행 → 1:1 채택. 04 의 DATA_GAP 은 해소 | 01 §1.1 |
| g(추가) | 01 R-CHART "PARTIAL(DESIGNABLE 가까움)" vs 08 "도표 이미지·수치 0 → 133 전부 DATA_GAP" | **08 채택.** body_ok 은 텍스트 품질일 뿐 도표 자산 유무가 아님. R-CHART 는 BLOCKED | 08 §0 |
| h(추가) | 01 R-GRAMMAR DESIGNABLE vs 08 "밑줄 경계 미보존" | **08 채택 → PARTIAL.** ch5/body_ok 는 밑줄 토큰 정합을 측정하지 않음 | 08 §2.4 |
| i(추가) | 07 "DB 에 문항 번호 열 없음" vs 01·02 `i.no` 사용 | 07 오류. `csat_items.no` 존재(02 SQL). 07 의 정답 NOT_VERIFIED 는 DB `answer` 로 해소 가능(후속 SELECT) | 02 부록 |
| j(추가) | "in_review 186" 분모 | csat_item_state 가 아니라 analyses 최신 version 기준(03). 혼동 금지 | 03 |
| k(추가) | 듣기 분류 18(classified) vs 17(typeGuess) vs 14(approved) | **세 목록을 합치지 않는다.** 정본 결정 = 사용자/DB 적재 승인 사항 | 09 L-G10 |

### 1.3 유사·충돌 매트릭스 (병합: 01 §5 + 02 + 10)

| 묶음 | W/F/S | 판정 |
|---|---|---|
| R-GIST·R-TOPIC·R-TITLE·X-TITLE | 문구 동일/기능 동일/의미 부분 동일 | F-CENTRAL 공유는 **판정 언어**(참인가×중심인가)만. 범위·추상도·은유(제목) 차이는 유형 고유로 남김 |
| R-FACT·X-FACT·R-NOTICE·(듣기 F2) | 기능 동일(성분 대조) | 정렬 데이터(선지↔문장)가 공통 선행. 매체·순서 대응 가설 차이 유지 |
| R-CHART·L-TABLE·L-MONEY | F-CALC | 자산 0 → 공유 여부 UNDETERMINED |
| 삽입·순서·무관 | 이음매(요구/공급/기존 연결) | 07 공통 단위 제안 채택 후보(학습 효과 미검증) |
| 분석 v3 ↔ 강의 cue (22·34·38) | 02 표 14행 | CONTRADICTION 2(CC-01 범위, CC-02 진위) · 과잉 일반화 2 · 직접 누설 4 cue |
| 강의 원리 ↔ 분석 principle.when_not | — | 강의가 when_not 한정을 버림(34·38) — 같은 원리를 다른 범위로 정의한 대표 사례 |

### 1.4 버전·출처
원문 `skeletons.source_hash` → `units.units_hash` → `analyses.version/units_hash` → 검수 원장. revision 열 없음(=analyses.version). 강의는 DB 테이블 없음·파일 기반(`lecture-data/2026.json`@3f437e9b6), 분석 버전 결속 없음(CC-10). units_hash NULL 3,806행(published 비중 미측정 DATA_GAP). 비교 결속은 units_hash+version 만, source_hash 미포함(03 P1).

### 1.5 데이터 공백 (차단 순)
1. 듣기: 원음·권리·선지·정답·이미지 전무(18유형 전부).
2. R-CHART 도표 이미지·값 133 전무.
3. R-SUMMARY body_ok 29/130 · R-BLANK 354/527.
4. R-GRAMMAR 밑줄 경계 · R-VOCAB 밑줄 낱말 추출.
5. 선지↔근거 문장 정렬(정보 대조형 전체).
6. 공개 분석 없음 302문항.
7. 오답률 `official_error_rate` null(인용 문항 전부).
8. R-MOOD: 상세 연구 문서 **없음**(01 행만) · 의미지원 0.

---

## 2. 전 유형 × 판단 기능 매트릭스 · 커버리지

판단 기능 코드는 01 작업 라벨(정본 아님). 커버리지: **D**=상세 연구 있음 · **M**=매트릭스 행만 · **X**=연구 없음. 준비도: READY(관리자 DB 자료 충분, 학습자 노출·권리 별도) · PARTIAL · BLOCKED.

### 2.1 독해 26 (active 22 + retired 4)

| type | 판단 기능 | 상세 | 커버 | 준비도 |
|---|---|---|---|---|
| R-PURPOSE | F-ACT | 05 §3.3 | D | READY |
| R-MOOD | F-POLAR+전환점 | — | **X** | PARTIAL(의미 0, 연구 없음) |
| R-CLAIM | F-ACT+F-CENTRAL | 05 §3.2 | D | READY |
| R-IMPLY | 비유→일반 의미 | 06 S5(1문항) | D(얕음) | READY |
| R-GIST | F-CENTRAL | 05 §3.1 | D | READY |
| R-TOPIC | F-CENTRAL | 05 §3.4 | D | READY |
| R-TITLE | F-CENTRAL(+은유) | 05 §3.5 | D | READY |
| R-CHART | F-COMPARE+F-CALC | 08 §2.3 | D | **BLOCKED**(도표 0) |
| R-FACT | F-COMPARE | 08 §2.1 | D | PARTIAL(정렬 0) |
| R-NOTICE | F-COMPARE(허용/금지) | 08 §2.2 | D | PARTIAL(표 복원·bodyOK 92%) |
| R-GRAMMAR | F-FORM | 08 §2.4 | D | PARTIAL(밑줄 경계) |
| R-VOCAB | F-POLAR | 08 §2.5 | D | PARTIAL(밑줄 낱말) |
| R-BLANK | F-SLOT+F-CENTRAL | 06 S1–S4 | D | PARTIAL(bodyOK 67%) |
| R-IRRELEVANT | F-CHAIN | 07 §4(표본 1) | D(얕음) | READY |
| R-ORDER | F-CHAIN | 07 §3 | D | READY |
| R-INSERT | F-CHAIN+F-SLOT | 07 §2 | D | READY(38 C1 미승인) |
| R-SUMMARY | F-SLOT+F-CENTRAL+F-POLAR | 05 §3.6 | D | **BLOCKED 위험**(bodyOK 22%) |
| X-TITLE | F-CENTRAL | 05 §3.5 · 08 §2.6 | D | READY |
| X-VOCAB | F-POLAR | 08 §2.6 | D | PARTIAL |
| X-ORDER | F-CHAIN(사건) | 08 §2.6 | D(세트 공통만) | READY |
| X-REFER | F-REFER | 08 §2.6 | D(얕음) | READY |
| X-FACT | F-COMPARE | 08 §2.6 | D | READY(세트 묶음 키 NOT_VERIFIED) |
| R-BLANK2 · R-REFER · X-BLANK · X-BLANK2 (retired) | F-SLOT×2 · F-REFER · F-SLOT | — | M | 보관. 흡수 여부 UNDETERMINED |

### 2.2 듣기 18 (DB 미적재, 교수 모델 0)

| 묶음(09) | 유형 | 판단 기능 | 전사 | 준비도 |
|---|---|---|---|---|
| F1 담화 핵심 | PURPOSE·OPINION·MAIN·TOPIC | F-ACT/F-CENTRAL | 7/15·7/13·**0/3·0/5** | BLOCKED |
| F2 사실 대조 | NOTMENTION·MENTIONED·ANNOUNCE | F-COMPARE | 7/13·0/1·7/15 | BLOCKED(선지 선행) |
| F3 세트 | SET-TOPIC·SET-NOT | F1/F2+주의 분배 | 7/13·7/14 | BLOCKED |
| F4 대화 상태 | RELATION·TODO·FAVOR·REASON | 상태 추적(듣기 고유) | 7·6·1·7 | BLOCKED |
| F5 매체 교차 | PICTURE·TABLE·MONEY | F-COMPARE/F-CALC | 7/15·7/14·7/14 | BLOCKED(이미지 0) |
| F6 화행 응답 | RESPONSE·SITUATION | 화행 적합(고유) | 28/58·7/14 | BLOCKED |

커버리지 결론: 관찰된 44유형(독해 26 + 듣기 18) 중 **상세 연구 없음 = R-MOOD 1(+retired 4 매트릭스만)**. 듣기 18은 연구 D 이나 구현 자료 전부 BLOCKED. 2014A#21 분류 이상(09 L-G8) NOT_VERIFIED.

---

## 3. 공통 판단 기능 vs 유형 고유

공통으로 추출하는 기준: **의미적·교육적 동일성이 문서 근거로 보인 것만.** 같은 F-코드여도 학습자 행동이 다르면 공통으로 만들지 않는다(과잉 동질화 방지).

| 공통 요소 | 동일성 근거 | 적용 유형 | 공통으로 하지 않는 것 |
|---|---|---|---|
| C-1 선지 이원 판정(본문 참인가 × 요구 충족인가) | S1 22 시나리오, 05 §1, 06 34②(unknown 칸 필요) | B군 전부 · 빈칸 · 함축 | **3값 필요**: true/false/**unknown**(34②). 2칸 표로 고정 금지 |
| C-2 근거 문장 지목(해시 결속) | 03 §3-1 계약 | 독해 전 유형 | 듣기는 턴+시간 결속(09 §1) — 같은 필드에 섞지 않음 |
| C-3 이음매(앞 요구·뒤 공급·기존 연결) | 07 §5 | 삽입·순서·무관(+X-ORDER) | 무관 문장은 "제거 시 연결 개선" 판정이 추가 |
| C-4 성분 대조(선지 성분 ↔ 원문 위치) | 08 §1, 09 F2 | R-FACT·X-FACT·R-NOTICE·듣기 F2 | 언어 형식 판단(어법·어휘)과 **동질화 금지**(08 §1) |
| C-5 조건·한정 보존(If/may/often/Ideally) | 02 CC-03, 06 §2, 10 §3 | 모든 원리·강의 문구 | — (규칙이 아니라 검수 기준) |
| C-6 공개 단계 4단(SOURCE_ONLY→LOCATION_HINT→RELATION→OFFICIAL_ANSWER) | S1 LECTURE_CONTRACT, 10 §2 | 전 유형·전 매체(라벨·ARIA·target id 포함) | — |

유형 고유(공통화 금지): R-MOOD 전환점 · R-IMPLY 비유 대응 · R-GRAMMAR 구조-형태 · R-CHART 계산 · X-REFER 인물 추적 · 듣기 F4 대화 상태 · F6 화행 응답 · F3 이중 과제 · 요약문 (A)(B) 극성 결합.

---

## 4. 계열별 학습자 활동 요약 (상세는 해당 파일)

| 계열 | 핵심 학습자 행동(선택·지목·비교형) | 상세 |
|---|---|---|
| B 대의 | 문장 역할 태그(정의·진단·처방·양보…) 표시 → 선지가 덮는 역할 대조 → 이원 판정 | 05 §1·§3 |
| C 빈칸·함축 | 조건절×극성 결합해 완성 명제 대입 → 대입 대조판 → 과잉 일반화 반례 | 06 S1–S5 |
| D 담화 | 주어진 문장의 앞 요구/뒤 공급 표시 → 후보 자리 이음매 3개 판정 | 07 §2–§5 |
| E 정보 | 선지 성분 ↔ 원문 위치 연결 | 08 §2.1–2.3 |
| E 형식 | 밑줄 구조 띠·문맥 극성 판단 | 08 §2.4–2.6 |
| F 듣기 | 1차 청취(전사 숨김) 선택 → 결정 턴 지목 → 표적 재청취 → 전사 대조(지각/판단 실패 분리) | 09 §1-3·§3 |

공통 제약: 자유서술 평가 없음 · 탐색/클릭/강의 완주 숙달 산입 금지 · 키보드 동등 조작 · 자료 없음 상태 보존.

---

## 5. 강의 문법 연결

10 §5 T1~T8(과제→관찰→관계→**판단 정지점**→근거 대조→매력 오답→공식 답→범위 닫기)을 공통 차례 문법 후보로 둔다(미승인).

| 연결 | 규칙 |
|---|---|
| 분석 ↔ 강의 | cue 는 `{item_id, analysis_version, units_hash}` 참조, 자체 lecture_version. 분석 변경 시 STALE_LECTURE(03 §1). 현재 미구현 |
| 원리 범위 | 강의 원리는 분석 `principle.when_not` 을 생략할 수 없음(C-5) |
| 공개 | 정답 번호는 T7 에만. 소거 4연속은 OFFICIAL_ANSWER 동급(10 P0-2) |
| 소유권 | target=위치 데이터, 이동은 학습자 클릭. 자동 selectScene·scrollIntoView 제거 대상(04 P0-1) |
| 계열 적응 | 10 §6 표. 듣기 강의는 TTS 와 원음 상호 배타, 원음 없으면 대본 TTS 를 원음 대용 금지 |

---

## 6. 데이터·권한 계약 (03 채택 + J 보정)

1. 화면 상태 분리: NO_DATA(302) · NO_PERMISSION · VERIFICATION_FAILED · STALE(3) · HELD. 0 으로 삼키지 않음.
2. 학습자 노출은 마지막 published version 만. in_review 노출 금지.
3. 근거 결속 `{item_id, analysis_version, units_hash, unit_id, unit_text_sha256, option_no?}`.
4. 비교 쌍 공개 AND 조건에 **source_hash 추가**, binding 누락 쌍은 비공개(현재 코드는 통과 — 03 P1).
5. `csat_items_public.answer` 가 authenticated 에 열림 — 풀이 전 노출 의도 결정 필요(정책 결정, 코드 아님).
6. 활동/숙달 기록 5종 분리(ACTIVITY…MASTERY_DECISION).
7. `audio_kind ∈ {LECTURE_TTS, EXAM_ORIGINAL}`, EXAM_ORIGINAL 은 권리·전사·화자·시간 결속 없으면 재생 불가. 결속 키 `exam_id+item_no+transcript_sha256+audio_sha256`, 2014 `listening_end=22`.
8. "검수 verified"·"schema 가드"·"contentValidation" 라벨을 한 화면에서 같은 등급으로 보이지 않게 구분(02).

---

## 7. F01~F10 후보표 (S1 선택과의 차이)

S1 FEATURE_DECISIONS 의 선택 상태는 입력 문서 인용(CITED). J 는 결정하지 않는다.

| F | 기능 | S1 상태(CITED) | 이번 연구가 더한 증거 | J 판정 |
|---|---|---|---|---|
| F01 | 문항 진입·상태 | (미인용) | NO_DATA 302 · STALE 3 분리 필요 | UNDETERMINED · 계약 §6-1 선행 |
| F02 | 원문·의미 | BLOCKED | 34 선지 DB 보유(d) — 그러나 원지 대조·크롭 증거 없음 | **BLOCKED 유지** |
| F03 | 근거 지목 | (CITED: 근거 단위 후보) | units 9종 화면 소비 0(04) · 정보형 정렬 데이터 0 | IMPROVE/NEW UNDETERMINED |
| F04 | 선지 비교 | C안(2개 고정 비교) 근거 | 3값 판정(unknown) 필요 · 형식/정보형 별도 | S1 C안과 차이: unknown 칸 추가 필요 — UNDETERMINED |
| F05 | 원리·노트 | (CITED) | when_not 생략 사례 2 | IMPROVE 후보, UNDETERMINED |
| F06 | 실기출 비교 | BLOCKED | source_hash 부재 · binding 누락 통과 · main 브랜치에 코드 없음 | **BLOCKED 유지** |
| F07 | 강의 플레이어 | REUSE ELIMINATED · 4후보 | main 8cd15b7b6 엔 자동 selectScene 없음, s0 에 있음 → 기준 브랜치 명시 필요 | UNDETERMINED(4후보 유지) |
| F08 | 작업면 Shell | selected=null · 다음 후보 REPLACE(2면) | 04 C1~C12 판정 기준. IMPROVE 증거가 기존 Shell 수정이 아님(04 P1-4) | **Codex 소유 · UNDETERMINED** — J 는 기준만 증거로 제공 |
| F09 | 학습지도 왕복 | BLOCKED | 추가 증거 없음 | **BLOCKED 유지** |
| F10 | 듣기 | BLOCKED | 전사 272 존재(c) — 원음·권리·선지 0 | **BLOCKED 유지**(전사만으로 해제 불가) |

---

## 8. 통합 P0 / P1 (중복 제거)

| ID | 등급 | 내용 | 근거(원 ID) |
|---|---|---|---|
| P0-1 | P0 | 강의 재생 중 자동 selectScene 이 장면·학습자 선택(ms*) 초기화 (s0 `AnalysisTheater.tsx:846-852`) | 04 P0-1 · LECTURE_CONTRACT |
| P0-2 | P0 | 정답 직접 낭독 cue(34:c4·c5, 22:c5, 38:c4)에 OFFICIAL_ANSWER 게이트 없음 + 소거 누적·intro 위치 선언으로 간접 확정 | 10 P0-1·P0-2 · 02 CC-05·CC-06 |
| P0-3 | P0 | 공개 분석 없는 302문항(119+183)·STALE 3 — in_review 노출 금지·NO_DATA 상태 필요 | 03 P0(a) + J 정정 |
| P0-4 | P0 | 권한/RLS 실세션 검증 0 — "권한 확인됨" 주장 금지(F02/F06/F09) | 03 P0(b) |
| P0-5 | P0 | 26 교수 모델을 "유형별 판단 도구"로 오인 → 텍스트 덤프 위험 | 04 P0-2 |
| P1-1 | P1 | 34② 진위: 강의 "거짓" 단정 vs 분석 unknown | 02 CC-02 · (e) |
| P1-2 | P1 | 38⑤ `these` 과잉 한정 (C1 후보 미승인, **Codex 소유**) | 02 CC-01 · 07 |
| P1-3 | P1 | 원리 과잉 일반화(34 c1·c12, 38 c1·c12, 22 c13, 34 c6·c9, 22 c5 may) | 02 CC-03·04 · 10 §3 |
| P1-4 | P1 | cue 자동 scrollIntoView(main :271 / s0 :303) · 레일 :873 | 04 P1-1 · 10 P1-1 |
| P1-5 | P1 | 전역 ←/→ 바인딩과 listbox 충돌 가능 | 04 P1-2 |
| P1-6 | P1 | 비교 결속에 source_hash 없음 · binding 누락 쌍 통과 · 코드 main 부재 | 03 P1 |
| P1-7 | P1 | authenticated 에 answer 컬럼 노출 의도 미결 | 03 |
| P1-8 | P1 | 자료 결함: R-SUMMARY 22% · R-BLANK 67% · R-CHART 0 · R-GRAMMAR 밑줄 · 2026#38 choices 조각/각주 혼입 | 01 · 08 · 02 CC-07 |
| P1-9 | P1 | 듣기 원음·권리·선지·정답 0 · 분류 3종 불일치 · S0 "전사 UNKNOWN" 낡음 | 09 · (c) |
| P1-10 | P1 | verified 라벨과 내용 무결 혼동 · 강의-분석 버전 결속 없음 | 02 · CC-10 |
| P1-11 | P1 | 학생 행동 0 인 강의 차례 37/37 | 10 P1-3 |
| P1-12 | P1 | "들은 큐" 계수가 숙달·진단으로 흐르는지 미확인 | 04 P1-3 |
| P1-13 | P1 | R-MOOD 상세 연구 부재 · 무관/지칭/함축 표본 1~소수 | J 커버리지 |
| P1-14 | P1 | units_hash NULL 3,806행 published 비중 미측정 | 03 |

---

## 9. 지금 구현 가능 vs 차단

| 지금 가능(자료·권한 결정 불필요, L2~L3 검증) | 차단(증거 필요) |
|---|---|
| 자동 selectScene·scrollIntoView 제거(학습자 소유권) | F02 원문 크롭(원지 sha·좌표) |
| 강의 공개 게이트(정답 cue·소거 묶음·라벨/ARIA 필터) — 대본 수정 없이 재생 제어만 | F06 비교(RLS 실관측·source_hash) |
| NO_DATA/STALE/HELD 상태 분기, in_review 비노출 가드 | F09 지도 왕복(정상 계정) |
| 이원(3값) 판정 UI — 2026-22·34·38 데이터로 | F10 듣기 전체 |
| 이음매 판정 UI — 2026-36~39 v3 데이터로 | R-CHART · R-SUMMARY 대량 · R-GRAMMAR 밑줄 |
| 전역 단축키 범위 축소 | 강의 대본·C1 내용 수정(사용자/Codex 승인) |
| 유형별 준비도 SELECT(03 §3-8) | 미분류 16 재분류·듣기 DB 적재(DB 쓰기 승인) |

---

## 10. 유형 구현 우선순위 (근거)

1. **R-GIST·R-TOPIC·R-TITLE·X-TITLE·R-CLAIM·R-PURPOSE** — bodyOK ≥94%, 22 시나리오 자산, C-1 공통 판정 재사용 가능. 단 유형별 범위 차이는 별도 칸.
2. **R-INSERT·R-ORDER·R-IRRELEVANT·X-ORDER** — v3·이음매 데이터 존재, 38 C1 승인 전에는 38⑤ decisive 문구 노출 보류.
3. **R-BLANK(body_ok 행만)·R-IMPLY** — 34 자산 존재하나 bodyOK 67%·34 강의 충돌 해결 선행.
4. **R-FACT·X-FACT·R-NOTICE·R-VOCAB·X-VOCAB·X-REFER** — 정렬·밑줄 데이터 보강 후.
5. **R-MOOD** — 연구 먼저(현재 X).
6. **R-GRAMMAR·R-SUMMARY·R-CHART** — 자산 결함 해소 후.
7. **듣기 18** — 원음 권리 확보 전 착수 불가. 전사 기반 연구 시안만.
근거는 자료 준비도·기존 검수 자산·충돌 수이며, 학습 효과 우위 근거가 아니다.

---

## 11. 다음 단계 수용 테스트

| AT | 검사 | 통과 기준 |
|---|---|---|
| AT-1 | 재생 중 학습자 선택/스크롤/포커스 후 cue 3개 진행 | 장면·ms 선택·scrollTop·activeElement 100% 불변(04 C2) |
| AT-2 | reveal=SOURCE_ONLY 에서 DOM·ARIA·레일 라벨·target id·재생 순서 | 정답 신호 0, 소거 cue 묶음 비재생 |
| AT-3 | NO_DATA 302 표본·STALE 3 전수 | in_review 텍스트 0, 상태 문구 구분 |
| AT-4 | 34② 표시 | true/false 대신 UNKNOWN 칸 |
| AT-5 | 근거 하이라이트 해시 불일치 주입 | VERIFICATION_FAILED, 하이라이트 0 |
| AT-6 | 키보드 완주(04 C6)·44px(C7)·중첩 ≤1(C8) | 전부 |
| AT-7 | 비교 쌍 binding 누락·source_hash 변경 주입 | 비공개 |
| AT-8 | 숙달 불변: 강의·탐색 전후 mastery/independent evidence DB 조회 | 변화 0 |
| AT-9 | 유형별 준비도 SELECT 산출 | 44유형 전 행, 0 은 원인 표시 |
학습자 효과 검증은 이 목록에 없다(합성 학습자 역할극은 사용성 신호일 뿐).

---

## 12. Codex 소유 범위 충돌 (증거만 기록, 수정·결정 안 함)

| 소유 | J 가 찾은 증거 |
|---|---|
| F08 선택 | 04 C1~C12 · IMPROVE 측 증거가 기존 Shell 수정 아님 · F07 기준 브랜치에 따라 자동 selectScene 유무가 다름(b) |
| 2026-38 C1 원문 교정 | 02·07 독립 판독 모두 4~7 포괄 해석이 원문과 정합, 정답 ⑤ 불변. 별도로 DB 2026#38 choices 에 본문 조각·각주 "* anecdote… 7" 혼입(CC-07) — C1 범위 밖 데이터 결함 |
| S1 수용 문서 | LECTURE_CONTRACT "34 선지 전문 미확보" → DB 보유로 문구 정정 필요(d) · S0 READINESS "전사 UNKNOWN" 낡음(c) · AnalysisTheater 줄 번호는 s0 9e73d7660 기준임을 명시 필요 |
| 34 제품 파일 | 강의 c7·c10 진위 단정(e) · c6·c9 조건 생략 · c4·c5 직접 공개 |

### 11_CROSS_REVIEW 반영 수정 기록
- R1: §3 C-1 을 2값→**3값(unknown)** 으로 수정(심사 B·E).
- R2: §10 에 "학습 효과 근거 아님" 명시, §11 에서 효과 검증 제외 명시(심사 E).
- R3: §1.2(a) NO_DATA 수를 183→302 정정 반영(심사 C).
- R4: §3 "공통화 금지" 목록 추가로 과잉 동질화 차단(심사 D).
- R5: §8 P1-13 R-MOOD·얕은 표본 추가(심사 D).
- R6: §4 공통 제약에 "자료 없음 상태 보존"·기초 학습자용 다음 행동 1개 원칙은 04 §3.2 지시로만 연결(심사 A) — 새 결정 아님.
