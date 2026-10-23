# CSAT v4.0 S0 — TYPE_REGISTRY (실제 유형 등록부)

- 기준서: `Vocaflow_CSAT_전역_기본골격_최종합의기준_v4.0_20261023.md` (§7, AT17)
- 측정: 2026-10-23, 개발 DB `jajenrevcbmrpaliomxv` 읽기 전용 SELECT, 소스 커밋 `3f437e9b6`(로컬 main). AI-Control T-0131.
- 판정 규칙: DB에 있는 값만 수치로 쓴다. 근거가 없는 칸은 `UNKNOWN`, 자료 자체가 없으면 `DATA_GAP`, 정본 분류에 대응이 없으면 `UNMAPPED`.

## 0. 사실과 추정의 분리

| 구분 | 내용 |
|---|---|
| 사실(DB) | `csat_types` 26행(독해 20 · 장문 6, active 21 · retired 5). **듣기 유형 행 0**. |
| 사실(DB) | `csat_exams` 134회(suneung 14 · mock 16 · hakpyeong 104). 선언 문항 수 합 5,982 · `csat_items` 3,714. 차이 2,268 ≈ 134회 × 듣기 17문항(2,278) − 10. 즉 **듣기 문항은 적재되지 않았다**. |
| 사실(DB) | `csat_items.type_id IS NULL` 16건(학평 8회). |
| 사실(파일) | R01~R19/L01~L07은 저장소·DB 어디에도 없고 `vocaflow_csat_all_types_design_roadmap_20261023.md`(사용자 Downloads, "설계용 초안")에만 있다. 공인 분류가 아니다. |
| 추정 | DB 26유형의 정본은 `scripts/csat/classify-types.mjs` 규칙표(테이블 주석). 규칙표의 발문 패턴이 "(A),(B),(C) 네모 어법" 등 변형 발문을 놓친다(§3). |

## 1. 등록부 — DB 유형 × 판단 기능 × 증거 매체

판단 기능(J*)과 증거 매체(M*)는 v4.0 §5.2·§7의 어휘를 DB 유형에 **설계상 대응**시킨 것이며(추정), A* 역량 가중치는 DB `csat_dx_type_attribute` 실측(사실)이다. 문항 수 = suneung/mock/hakpyeong.

판단 기능: J-INTENT 발화·서술 의도 · J-AFFECT 정서 흐름 · J-CENTRAL 중심성·포괄 범위·표현 강도 · J-COND 조건·부정 범위·완성 명제 · J-LINK 앞·뒤 연결/기존 연결 보존 · J-COHERE 화제 사슬 이탈 · J-MATCH 주체·시간·수치·단위·예외 대조 · J-SYNTAX 구문 의존 · J-LEXSEM 문맥 의미 · J-COMPRESS 두 축 압축 · J-REFER 지시 대상 추적.
증거 매체: M-SENT 문장 번호 · M-SLOT 삽입/순서 위치(문장 번호와 다른 타입) · M-MARK 본문 내 표지(①~⑤, (A)(B)(C)) · M-CHART 도표 셀 · M-NOTICE 실용문 필드 · M-SHARED 공유 장문.

| DB type_id | 이름 | 상태 | 문항 S/M/H | 로드맵 임시 ID | 판단 기능 | 증거 매체 | 선지 언어 | DB 역량(A*:가중) | 표본(정상) |
|---|---|---|---|---|---|---|---|---|---|
| R-PURPOSE | 글의 목적 | active | 12/15/104 | R01 | J-INTENT | M-SENT | 한(131/131) | A1:1 A3:1 A4:1 A5:1 | 수능 각 회 18번 계열 |
| R-MOOD | 심경·분위기 | active | 13/15/104 | R02 | J-AFFECT | M-SENT | 영(0/132 한) | A1:2 A5:1 | |
| R-CLAIM | 필자 주장 | active | 10/15/102 | R03 | J-CENTRAL | M-SENT | 한 | A3:1 A4:2 A5:1 | |
| R-GIST | 요지 | active | 14/15/103 | R04 | J-CENTRAL | M-SENT | 한 | A3:1 A4:2 A5:1 | **2026#22** |
| R-TOPIC | 주제 | active | 15/15/104 | R05 | J-CENTRAL | M-SENT | 영 | A1:1 A3:1 A4:2 | |
| R-TITLE | 제목 | active | 16/15/106 | R06 | J-CENTRAL | M-SENT | 영 | A3:1 A4:2 A6:1 | |
| R-IMPLY | 함축 의미 | active | 8/14/93 | R07 | J-COND | M-SENT(밑줄) | 영 | A1:1 A2:1 A4:2 A6:1 | |
| R-BLANK | 빈칸 추론 | active | 55/60/412 | R08 | J-COND | M-SENT | 영 | A1:1 A2:1 A3:2 A4:2 A6:1 | **2026#34** |
| R-BLANK2 | 빈칸 2개 | retired | 4/0/0 | R08(하위) | J-COND | M-SENT | 영 | A3:2 A4:1 | |
| R-IRRELEVANT | 무관한 문장 | active | 13/15/104 | R09 | J-COHERE | M-MARK | 혼재(71/132 한) | A3:2 | |
| R-ORDER | 글의 순서 | active | 26/30/206 | R10 | J-LINK | M-SLOT·M-MARK(A)(B)(C) | 영 | A2:1 A3:2 | |
| R-INSERT | 문장 삽입 | active | 26/30/206 | R11 | J-LINK | M-SLOT | 혼재(162/262 한) | A2:1 A3:2 | **2026#38** |
| R-CHART | 도표 | active | 14/15/104 | R12 | J-MATCH | M-CHART(+M-MARK) | 영 | A5:2 A9:1 | |
| R-FACT | 내용 일치(글) | active | 13/15/103 | R13 | J-MATCH | M-SENT | 한 | A2:1 A5:2 | |
| R-NOTICE | 안내문 일치 | active | 27/30/208 | R14 | J-MATCH | M-NOTICE | 한 | A5:2 A9:1 | |
| R-GRAMMAR | 어법 | active | 14/15/100 | R15 | J-SYNTAX | M-MARK | 혼재(64/129 한) | A2:1 A8:2 | |
| R-VOCAB | 어휘(문맥) | active | 14/15/103 | R16 | J-LEXSEM | M-MARK | 혼재(72/132 한) | A1:2 A3:1 | |
| R-SUMMARY | 요약문 완성 | active | 13/15/102 | R17 | J-COMPRESS | M-SENT+(A)(B) | 영 | A1:1 A4:2 | |
| R-REFER | 지칭(단문) | retired | 5/1/12 | (없음) | J-REFER | M-MARK | 혼재 | A2:1 A3:1 | |
| X-TITLE | 장문 제목 | active | 14/15/104 | R18 | J-CENTRAL | M-SHARED | 영 | A3:1 A4:2 A9:1 | |
| X-VOCAB | 장문 어휘 | active | 8/14/93 | R18 | J-LEXSEM | M-SHARED·M-MARK | 영 | A1:2 A3:1 A9:1 | |
| X-BLANK | 장문 빈칸(1) | retired | 5/1/11 | R18 | J-COND | M-SHARED | 영 | A3:2 A4:1 A9:1 | |
| X-BLANK2 | 장문 빈칸(2) | retired | 1/0/0 | R18 | J-COND | M-SHARED | 영 | A3:2 A4:1 A9:1 | |
| X-ORDER | 장문 순서 | active | 14/15/104 | R19 | J-LINK | M-SHARED·M-SLOT | 영 | A3:2 A9:1 | |
| X-REFER | 장문 지칭 | active | 14/15/104 | R19 | J-REFER | M-SHARED·M-MARK | 영 | A2:1 A3:1 A9:1 | |
| X-FACT | 장문 내용 일치 | active | 14/15/104 | R19 | J-MATCH | M-SHARED | 한 | A5:2 A9:1 | |

선지 언어 열: `choices::text ~ '[가-힣]'` 행 수(사실). "혼재"는 삽입·어법·어휘·무관 문장에서 선지 배열이 번호 표지/본문 조각으로 저장되는 경우가 섞여 있다는 뜻이며 의미는 S1에서 확인(UNKNOWN).

## 2. 듣기 — 전부 DATA_GAP

사실: 분류 규칙표 `scripts/csat/classify-types.mjs:42-61`에는 듣기 18유형이 정의돼 있다 — L-PURPOSE·L-OPINION·L-MAIN·L-TOPIC·L-RELATION·L-PICTURE·L-TODO·L-FAVOR·L-MONEY·L-REASON·L-NOTMENTION·L-MENTIONED·L-TABLE·L-ANNOUNCE·L-RESPONSE·L-SITUATION·L-SET-TOPIC·L-SET-NOT. 그러나 **DB `csat_types`에는 L-* 행이 없고 듣기 문항 0건**이다(규칙표와 DB 원장 불일치 = mismatch).

| 로드맵 임시 ID | 규칙표 L-* (설계상 대응, 추정) | 판단 기능 | DB 문항 | 원음 | 전사 | 화자/시간 구간 | 상태 |
|---|---|---|---|---|---|---|---|
| L01 의도 | L-PURPOSE · L-OPINION · L-MAIN · L-TOPIC | 발화 의도·중심 | 0 | DATA_GAP | DATA_GAP | DATA_GAP | UNMAPPED(DB)·DATA_GAP |
| L02 관계·행동 | L-RELATION · L-TODO · L-FAVOR · L-REASON | 화자 역할·행동·원인 | 0 | DATA_GAP | DATA_GAP | DATA_GAP | 동일 |
| L03 사실 | L-PICTURE · L-NOTMENTION · L-MENTIONED · L-ANNOUNCE | 들린 정보 대조 | 0 | DATA_GAP | DATA_GAP | DATA_GAP | 동일 |
| L04 수량 | L-MONEY · L-TABLE | 단위·조건 계산 | 0 | DATA_GAP | DATA_GAP | DATA_GAP | 동일 |
| L05 응답 | L-RESPONSE | 직전 발화 기능 | 0 | DATA_GAP | DATA_GAP | DATA_GAP | 동일 |
| L06 상황 | L-SITUATION | 화행 적합 | 0 | DATA_GAP | DATA_GAP | DATA_GAP | 동일 |
| L07 복합 | L-SET-TOPIC · L-SET-NOT | 공유 담화 | 0 | DATA_GAP | DATA_GAP | DATA_GAP | 동일 |

수능·모평·학평 각 17문항(1~17번)은 `csat_exams.listening_end`로 범위만 알 수 있고 문항·발문·선지·정답이 적재되지 않았다. 듣기 하위 유형 분류는 이 S0에서 확정하지 않는다.

## 3. UNMAPPED — 분류되지 않은 실제 문항 16건

| item | 발문(앞부분) | 실제 형식 | 판정 |
|---|---|---|---|
| H1803G1#29 · H1803G3#29 · H1806G2#28 · H1903G1#28 | (A),(B),(C) 네모 안 어법 | **어법 네모 선택형** — `csat_types`에 대응 행 없음 | UNMAPPED(형식 변형) |
| H1806G2#27 | ~에 대한 글의 내용과 일치하지 않는 것 | 내용 불일치 → R-FACT 후보 | UNMAPPED(분류기 누락) |
| H2503G1#40 · H2603G1#40 | 한 문장으로 요약 (A),(B) | R-SUMMARY 후보 | UNMAPPED(분류기 누락) |
| H1906G1#31~34, #36~39 · H2403G2#20 | 발문 대신 본문 첫 줄/빈 문자열 | 발문 파싱 실패(body_ok=false 6건 포함) | UNMAPPED(DATA_GAP) |

전체 독해 커버리지: 3,698/3,714(99.57%) 매핑, 16건 UNMAPPED. 듣기 0/≈2,278 매핑.

## 4. 역량 코드 A1~A9

- DB `csat_dx_type_attribute` 67행: 사용 코드 A1·A2·A3·A4·A5·A6·A8·A9. **A7은 어떤 유형에도 가중치가 없다**(사실).
- `csat_dx_item_attribute`: type_default 3,558 문항 · admin 수정 140 문항. 즉 문항별 역량은 대부분 유형 기본값 상속(추정 아님, source 열 실측).
- A* 라벨 정의 위치는 [GAP §코드](./GAP_AND_ASSUMPTION_REGISTER.md) 참조.

## 5. 재현 SQL

```sql
-- 유형별 문항·선지 언어
select type_id, count(*), count(*) filter (where choices::text ~ '[가-힣]') from csat_items group by 1;
-- 시험 종류별 선언 대비 적재
select kind, sum(item_count), (select count(*) from csat_items i where i.exam_id in (select id from csat_exams e2 where e2.kind=e.kind)) from csat_exams e group by kind;
-- 미분류
select id, stem from csat_items where type_id is null;
```
