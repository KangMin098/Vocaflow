# D4b · 구조 자료 공백(도표 · 어법 밑줄 · 안내문 표 · 요약·장문) — 원인과 복구 경로

> 연구 산출물(D4b, Claude 서브에이전트, 내부 검토만). 읽기 전용: DB SELECT · 파일 목록 · git/grep 만. 자료 생성·적재 없음.
> 목적은 재집계가 아니라 **공백의 원인 분류와 복구 경로**. 수치는 2026-10-24 DB(`jajenrevcbmrpaliomxv`) 실측.
> 분류 코드: **1** 자료 실제 없음 · **2** 다른 기존 위치에 있음 · **3** 변환·매핑 문제 · **4** 버전·공개 권한 · **5** 원본 권리·사용 범위 · **6** 복구에 필요한 실제 자료.

## 0. 공통 실측

| 사실 | SQL | 결과 |
|---|---|---|
| `csat_items` 에 구조 컬럼 없음 | `select column_name from information_schema.columns where table_name='csat_items'` | id·exam_id·no·section·in_scope·type_id·stem·passage·choices·answer·answers·points·high_score·body_ok·**raw_block**·created_at·official_error_rate·ebs_linked — 밑줄/표/도표/이미지 컬럼 없음 |
| `raw_block` 전부 NULL (대상 7유형) | `select type_id,sum((raw_block is not null)::int) from csat_items where type_id in (...) group by 1` | R-CHART 0/133 · R-GRAMMAR 0/129 · R-NOTICE 0/265 · R-SUMMARY 0/130 · R-VOCAB 0/132 · X-ORDER 0/133 · X-TITLE 0/133 |
| `csat_item_units` 는 문장 단위 배열뿐 | `select jsonb_typeof(units),count(*) ... where type_id in ('R-GRAMMAR','R-CHART','R-NOTICE')` | array 463행, 원소 키 `n,id,start,end,kind:"sentence",text` — 밑줄·셀 키 없음 |
| Storage 버킷에 시험지 이미지 없음 | `select bucket_id,count(*) from storage.objects group by 1` | `comic` 4,644 · `video` 657 — CSAT 버킷 0 |
| 회차 | `select organizer,kind,count(*) from csat_exams group by 1,2` | kice suneung 14 · kice mock 16 · edu_office hakpyeong 104 |
| 원본 PDF(로컬, 저장소 밖) | `ls` | `Documents/영어/수능영어기출/수능기출` PDF 수능 2014A~2026 + 정답표 · `Documents/영어/모의평가` PDF 50 · `Documents/영어/학력평가` PDF 678(문제지+정답 및 해설). PNG/JPG 0. 텍스트 추출본 `수능기출/*.txt` |

렌더 쪽(main `apps/web/src/lib/csat/reflow/reflow.ts:38-41`): `VISUAL_PAPER_TYPES = R-REFER·X-REFER·R-GRAMMAR·R-VOCAB·X-VOCAB·R-CHART·R-IMPLY` 이면 `needsOriginal=true` → `ItemScreen.tsx:68-72`·`AnalysisReading.tsx:62` 가 **학습자가 놓은 자기 PDF 의 크롭**(`cropOf`)을 보여 주고, 없으면 "밑줄·도표를 원본으로 확인하려면 문제지를 다시 놓아 주세요" 빈 상태. 즉 제품은 구조 자료를 DB 에 두지 않고 **학습자 로컬 PDF 크롭으로 우회**한다(REFLOW_VERSION 5, 2026-10-05).

---

## 1. 도표(R-CHART 133)

| ID | 발견 | 분류 | 근거·SQL | 심각도 | 신규/KNOWN |
|---|---|---|---|---|---|
| D4b-01 | 도표 이미지·수치가 DB 문항 행에 없음 | 1(DB) | §0 raw_block 0/133 · `passage` 는 설명문+①~⑤ 문장(`passage ~ '[①-⑤]'` 133/133) | P1 MAIN(DB) | KNOWN(08 §2.3 #15) |
| D4b-02 | **도표 이미지 자산 경로가 이미 존재** — `csat_review_visual_assets`(image_png bytea, pdf_sha256, pdf_page, inspection_note) + `_heads`·`_deliveries`·`_receipts`·`_analysis_bindings`. 마이그레이션 `20261004234255_csat_chart_review_assets.sql`, 격리 회귀 `scripts/csat/__tests__/chart-protocol.test.mjs` | 2 | `select i.type_id,count(distinct v.item_id) from csat_review_visual_assets v join csat_items i ...` → **R-CHART 1문항(H2603G3#25, pdf_page 4, 882,614 B)** · heads 1 · deliveries 3 · bindings 1 | P2 | 신규(08 은 "imgref 0" 만 기록) |
| D4b-03 | 이 자산은 **검수(review) 전용 비공개** 계약이며 학습자 노출 경로가 아님. 132문항은 자산 0 | 4 | migration 머리 "Bind a private chart image … to review evidence" | P2 | 신규 |
| D4b-04 | 수치 값 표(시리즈·범주·단위)는 어디에도 구조화되지 않음 — 위 1건도 `inspection_note` 자유 문장에 15수치를 적었을 뿐 | 1 · 6 | 위 행 `inspection_note` 앞 120자 | P1 | 신규(형식 부재) |
| D4b-05 | 원본 PDF 는 있음: 수능 14 + 모평 PDF 50 + 학평 678 파일(로컬). 학평 104회 중 `H2004G3` 은 스캔(글자층 0) | 2 · 6 | `ingest-hakpyeong.mjs:309` | P2 | 신규 |
| D4b-06 | 평가원·교육청 시험지 이미지의 **재배포 권리** 미확정 — 추출기도 머리말 `저작권은 한국교육과정평가원` 을 걸러낸다. 제품은 그래서 학습자 자기 PDF 크롭만 씀 | 5 | `extract-questions.mjs` `HEADER_RE` · `read-paper.ts:5` "해시 64자만 나간다" | P1(정책) | 신규(명시 기록) |

복구 경로: **기존 자산**(로컬 PDF·`csat_review_visual_assets` 스키마) → **변환**(PDF 쪽 래스터 크롭 + 값 표 `chart_series` 형식 정의 — 현재 형식 없음) → **검증**(2중 입력 일치, chart-protocol 회귀 방식) → **승인**(DB 쓰기·공개 범위는 사용자 승인, 권리 판단 별도). 학습자 화면은 당분간 로컬 PDF 크롭(현행)으로 충분하나, 값 없이 "왜" 생성 금지는 유지(08 §2.3).

## 2. 어법 밑줄(R-GRAMMAR 129) · 어휘(R-VOCAB 132 · X-VOCAB 115)

| ID | 발견 | 분류 | 근거·SQL | 심각도 | 신규/KNOWN |
|---|---|---|---|---|---|
| D4b-07 | 밑줄 범위 미보존, 선지가 다음 번호까지 구간 | 3 | 08 §2.4 #15 | P1 | KNOWN(08 §2.4) |
| D4b-08 | 원인: 밑줄은 **텍스트층이 아닌 그린 선**(PDF 그래픽 연산)이라 pdftotext/pdfjs 글자 추출에서 사라짐. 수능·모평 경로(`ingest-mock.mjs`, `pdftotext -layout`)는 선을 아예 안 읽음 | 3 | `ingest-hakpyeong.mjs:96` 주석 "밑줄이 글자가 아니라 그어진 선" | P1 | 신규(원인 특정) |
| D4b-09 | **선 감지 코드가 이미 있음** — 학평 수집기가 `page.getOperatorList()` + `blankRuleItems()` 로 그린 선을 찾아 빈칸 `______` 를 복원한다. 같은 연산 목록으로 밑줄 x 범위→토큰 범위 매핑이 가능(현재는 빈칸 유형에만 적용) | 2 · 3 | `ingest-hakpyeong.mjs:155-158`; web 쪽 `pdf-frags.blankFrags`(REFLOW_VERSION 2 주석) | P2 | 신규 |
| D4b-10 | DB 에는 ①~⑤ 표지 위치만 있음: `passage ~ '[①-⑤]'` R-GRAMMAR 129/129 — 시작점은 복원 가능, **끝점만 없음** | 3 | 위 SQL(§1 표 sym_in_passage) | P2 | 신규(정밀화) |
| D4b-11 | X-VOCAB `(a)~(e)` 표지: passage ①~⑤ 0/115 — 밑줄 낱말은 표지 직후 1낱말이라 끝점 추정 위험은 낮으나 검증 0 | 3 | `select ... type_id='X-VOCAB'` sym 0 | P3 | KNOWN(08 X-VOCAB 행) |
| D4b-12 | 네모 어법 4건 미분류 | UNKNOWN | 08 §2.4 #1 | — | KNOWN |
| D4b-13 | `csat_item_units`·`csat_item_skeletons` 에도 밑줄 키 없음 (skeleton 287행 중 underline/chart/table/밑줄 문자열 3행 — 내용 미확인) | 1 | §0 · `select count(*) filter (where data::text ~* 'underline|chart|table|밑줄') from csat_item_skeletons ...` → 3/287 | P3 | 신규 · 3행 NOT_VERIFIED |

복구 경로: 로컬 PDF → `getOperatorList` 선 좌표 ↔ 글자 좌표 교차로 `underline_spans[{mark,start,end}]`(passage 문자 오프셋) 산출 → 검증: ①~⑤ 시작점 일치 100% + 표본 원본 대조(눈) + 선지 문자열이 span 안에 포함되는지 → jsonb 키 추가(마이그레이션 불필요하나 쓰기는 승인). 수능 2014~2016 등 스캔성 PDF 는 NOT_VERIFIED.

## 3. 안내문 표(R-NOTICE 265)

| ID | 발견 | 분류 | 근거·SQL | 심각도 | 신규/KNOWN |
|---|---|---|---|---|---|
| D4b-14 | 표가 평문으로 평탄화 | 3 | 08 §2.2 #15(2026#28) | P1 | KNOWN |
| D4b-15 | 원인 1: 학평 수집기가 칸 사이 큰 틈을 빈칸으로 오인 → `build-corpus.mjs` 가 비빈칸 유형에서 `______` 를 지워 **칸 경계 신호까지 소거**(주석 실측 "안내문 72 · 도표 19") | 3 | `build-corpus.mjs:303-311` | P2 | 신규 |
| D4b-16 | 원인 2: **R-NOTICE 가 `VISUAL_PAPER_TYPES` 에 없음** → 학습자 로컬 PDF 크롭 우회도 적용 안 되어 평탄 텍스트만 보임. 도표·밑줄과 달리 표 구조는 제품 화면에서 복원 경로 0 | 3 · 4 | `reflow.ts:39-41` | P1 MAIN | 신규 |
| D4b-17 | body_ok=false 21 | 3 | `select count(*) from csat_items where type_id='R-NOTICE' and not body_ok` → 21 | P2 | KNOWN(08 §2.2) |
| D4b-18 | 수치 단서는 남아 있음: `passage ~ '\$|%|\d{1,2}:\d{2}'` 194/265(학평 152·kice 42) — 셀 값은 있고 **행·열 결속만 없음** | 3 | §1 SQL numeric_tokens | P2 | 신규 |

복구 경로: 로컬 PDF 글자 좌표(pdfjs x,y) → 열 경계 군집으로 `table_cells[{row,col,text}]` → 검증: 셀 텍스트 연결 = 현 passage(공백 정규화) 동일, 표본 원본 대조 → 승인. 단기: R-NOTICE 를 `VISUAL_PAPER_TYPES` 에 넣는 제품 결정(코드 변경은 이 작업 범위 밖).

## 4. 요약문(R-SUMMARY 130) · 장문(41-42 / 43-45)

| ID | 발견 | 분류 | 근거·SQL | 심각도 | 신규/KNOWN |
|---|---|---|---|---|---|
| D4b-19 | **R-SUMMARY body_ok=false 101/130, 전부 학평(101/102)이며 101건 모두 `______` 없음** | 3 | `select count(*) filter (where not body_ok), count(*) filter (where not body_ok and passage !~ '______'), count(*) filter (where not body_ok and exam_id ~ '^H') from csat_items where type_id='R-SUMMARY'` → 101 · 101 · 101 | **P1 MAIN(DB)** | 신규 |
| D4b-20 | 원인(코드 모순): `build-corpus.mjs:307` 은 `!/BLANK/.test(type)` 인 학평 문항의 `______` 를 지운다(주석 "요약문은 (A)·(B) 글자가 자리를 이미 가리키므로") — 그런데 `BLANK_TYPES`(`:154`)에 R-SUMMARY 가 있어 판정 ④ "빈칸 유형인데 `______` 없음" 이 걸려 body_ok=false. 즉 **본문은 대체로 온전한데 딱지만 잘못** 붙었을 가능성이 높다(25건은 `\s\.\s` 규칙에도 걸림 → 별도 확인 필요) | 3 | 위 두 줄 | P1 | 신규 |
| D4b-21 | 결과: body_ok=false 는 분석·설계 드레인에서 제외된다(`design-drain-export.mjs:97`, `build-skeleton-data.mjs:216`) → 요약문 학평 101문항이 하류 자료에서 빠짐 | 3 | 해당 줄 | P1 | 신규 |
| D4b-22 | 요약 (A)/(B) 표지는 130/130 존재, 요약문 화살표(↓, U+0000/U+F003B)는 추출 시 삭제·문단 경계로 대체 | 3 | `passage ~ '\(A\)'` 130 · `ingest-hakpyeong.mjs` NUL 제거 · `reflow.ts:470` | P3 | 신규 |
| D4b-23 | 장문 세트 ID 컬럼 없음 — 지문은 문항마다 복제 저장. 43-45: 133/133 회 3문항 지문 동일. 41-42: 133 회 중 118 만 동일(15회 상이 — 2014~2018 의 X-BLANK 세트 등 형식 차 또는 추출 차, NOT_VERIFIED) | 3 | `with s as (select exam_id, count(distinct md5(passage)) filter (where no between 43 and 45) ...)` → same3 133 · same2 118 | P2 | 신규 |
| D4b-24 | X-TITLE body_ok=false 9 · X-VOCAB 6 · X-BLANK 3 (같은 세트의 짝 문항은 true 인 경우가 있어 세트 단위 불일치) | 3 | §1 첫 SQL bad 열 | P2 | 신규(세트 불일치는 NOT_VERIFIED) |
| D4b-25 | 43-45 의 (A)~(D) 문단 표지·(a)~(e) 지칭 표지는 존재(hasA 133/133) — 자료 공백 아님 | — | `passage ~ '\(A\)'` | — | 확인 |

복구 경로(요약): 기존 passage 그대로 → 판정 규칙 수정안(R-SUMMARY 는 `(A)`·`(B)` 존재로 빈칸 판정) **dry-run 으로 101건 재판정 수만 산출** → 25건 `\s\.\s` 표본 원문 대조 → 승인 후 body_ok 재동기(`corpus-sync.mjs:180`). 장문: `exam_id + no∈{41,42}/{43..45}` 로 세트 키 파생(컬럼 추가 없이 가능), 41-42 상이 15회는 원본 대조.

---

## 조사 범위(실제로 본 개수)

- DB: csat_items 컬럼 18 · 대상 유형 11종 집계 · csat_review_visual_* 5 테이블 · csat_item_units 463행 형식 · csat_item_skeletons 287행 문자열 검사 · storage.objects 버킷 2 · csat_exams 134회.
- 코드: `build-corpus.mjs`(154-311) · `ingest-hakpyeong.mjs`(49-175, 309) · `extract-questions.mjs` 머리 · `reflow.ts`(30-100, 470-487) · `ItemScreen.tsx`·`AnalysisReading.tsx`·`ItemPaper.tsx` 해당 줄 · chart 마이그레이션 머리 30줄 · `chart-protocol.test.mjs` 머리.
- 파일: 로컬 원본 폴더 3개 목록(PDF 수 집계, 내용 미열람).
- 기존 문서: 03 · 08 · 12 (grep 범위).

## 완료/부분/미완료

- 완료: 4범위 원인 분류 · 기존 자산 위치 · 복구 경로.
- 부분: D4b-20 원인은 코드 읽기로 특정, 재판정 dry-run 미실행(쓰기 아님이나 스크립트 실행 범위 밖으로 둠).
- 미완료: PDF 실제 열람으로 밑줄 선·표 좌표 존재 확인(도구 미실행) · 스캔 PDF 회차 전수.

## 미검증

- NOT_VERIFIED: 수능·모평 PDF 에 밑줄이 벡터 선인지(학평만 코드 근거) · 41-42 지문 상이 15회 원인 · skeleton 3행 내용 · R-SUMMARY 25건 `\s\.\s` 원인 · 학평 "정답 및 해설" PDF 에 도표 값 텍스트 존재 여부.
- BLOCKED_AUTH/정책: 시험지 이미지 재배포 권리(사용자·법무 판단).
- UNKNOWN: 네모 어법 4건(KNOWN 08).
