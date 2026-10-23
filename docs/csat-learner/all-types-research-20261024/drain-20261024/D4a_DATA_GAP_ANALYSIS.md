# D4a — 데이터 공백의 원인과 해결 경로 (공개 분석 부재 302 · 의미 지원 · 원문 PDF↔저장 선지)

> 연구 산출물(Claude 서브에이전트 D4a, 내부 검토만). 읽기 전용: DB `jajenrevcbmrpaliomxv` SELECT 만, git show/ls-tree/grep 만. 실측 2026-10-24.
> 목적은 개수 재집계가 아니라 **원인 분해와 복구 경로**. 새 자료를 만들어 적재하는 안은 넣지 않는다.

분류 코드: **C1** 자료가 실제로 없음 · **C2** 다른 기존 위치에 있음 · **C3** 변환·매핑 문제 · **C4** 버전·공개 권한(published/검수) 문제 · **C5** 원본 권리·사용 범위 · **C6** 복구에 필요한 실제 자료.

## 0. 302 의 재현 정의

KNOWN(00 §1.2(a), 12 §2): 302 = 분석 행 없음 119 + 최신판 in_review(발행 이력 없음) 183. 재현 SQL(합계 302 확인):

```sql
-- Q0: 공개(published) 분석이 한 번도 없는 문항
with pub as (select distinct item_id from csat_item_analyses where status='published')
select count(*) from csat_items where id not in (select item_id from pub);   -- 302
```

신규 사실(이 문서): **302 전부 학평(exam_id `H…`, organizer `edu_office`)** 이다. 평가원(kice) 802문항은 0. 모두 `in_scope=true`, `created_at` 2026-09-27(학평 적재일), 정답·선지 결측 0(선지 비배열 1건 제외).

## 1. 302 원인별 분해

| ID | 묶음 | 수 | 분류 | 원인(증거) |
|---|---|---|---|---|
| D4a-01 | R-CHART 24/25번, 분석 행 없음 | **103** | C4 + C2 + C6 | 도표 분석은 정본 PNG 등록이 선행 조건(마이그레이션 `20261004234255_csat_chart_review_assets.sql`, 도움말 `lib/admin/help/csat.ts:1619` 「도표 이미지 근거」). `csat_review_visual_heads` 등록 문항 **1개**(H2603G3#25, 유일한 학평 도표 발행). 학평 도표 104 중 103이 이미지 미등록 → export/분석 차단. 옛 텍스트 기반 산출물은 `D:/workspace/Vocaflow-hakpyeong/scripts/csat/analysis-drain-hakpyeong/chunk-R-CHART-*.out.json`(out 11파일)에 있으나, `chunk-redo-20261010T174644446Z-R-CHART-*.json` 9개 재분석 입력이 출력 없이 남아 옛 출력을 대체 예약 중 — DB 미적재 |
| D4a-02 | 유형 미지정(type_id NULL), 분석 없음 | **16** | C3 (+C6 일부) | 분류·파싱 문제. 발문 앞부분으로 유형이 드러나는 것: 어법 네모 4(H1803G1#29·H1803G3#29·H1806G2#28·H1903G1#28) · 내용 불일치 1(H1806G2#27) · 요약 2(H2503G1#40·H2603G1#40). **H1906G1 #31~#39 8문항은 stem 칸에 지문 첫 문장/빈 문자열이 들어가 있어 발문·지문 칸이 어긋남**(#37 선지 0개). H2403G2#20 stem 이 안내문 본문 시작. 7문항 `body_ok=false`. 유형 미지정은 P4 집계에서도 제외(KNOWN, `docs/csat-held-remediation-20261005.md:36`) |
| D4a-03 | R-BLANK 31~34번, 최신 in_review | **106** | C4 (+C3 41) | 분석은 현재 단위에 결속(units_hash·units_version 일치 106/106). **독립 검수 기록 없음 103**, 3인 검수 있으나 revise 포함 3. 41문항 `body_ok=false`·42 `body_recovered` — PDF 빈칸 복구 경로(CHANGELOG「학평 PDF 빈칸은 밑줄 좌표…로 복구」)를 거친 본문이라 검수 전 원문 대조 필요 |
| D4a-04 | R-CLAIM 19~21번, 최신 in_review | **75** | C4 | 단위 결속 75/75. 독립 검수 없음 **55**. **3인 전원 pass 인데 미발행 13** + 2인 pass 1(정족수 미달). revise 포함 6 |
| D4a-05 | X-VOCAB 42번, 최신 in_review | **2** | C5/C6 | H2206G2#42·H2011G1#42. KNOWN(`csat-held-remediation-20261005.md` 2026-10-11 절): 원 출전/출제기관 설명 미확보로 정답 유일성 근거 부족 → 보류 유지. 독립 검수 revise |
| | 합계 | **302** | | 103+16+106+75+2 |

분해 SQL:

```sql
-- Q1: 302 를 분석 유무·유형별로
with pub as (select distinct item_id from csat_item_analyses where status='published'),
anyA as (select distinct item_id from csat_item_analyses)
select (id in (select item_id from anyA)) has_an, coalesce(type_id,'(null)') t, count(*),
       count(*) filter (where not body_ok) body_bad
from csat_items where id not in (select item_id from pub) group by 1,2;
-- → false/R-CHART 103(2) · false/null 16(7) · true/R-BLANK 106(41) · true/R-CLAIM 75(0) · true/X-VOCAB 2(0)

-- Q2: in_review 183 의 검수 상태(최신 버전 기준)
with pub as (select distinct item_id from csat_item_analyses where status='published'),
lat as (select distinct on (item_id) * from csat_item_analyses
        where item_id not in (select item_id from pub) order by item_id, version desc)
select (select type_id from csat_items where id=l.item_id) t, count(*) n,
  count(*) filter (where exists(select 1 from csat_independent_reviews r where r.analysis_id=l.id)) has_indep,
  count(*) filter (where exists(select 1 from csat_independent_reviews r where r.analysis_id=l.id and r.verdict<>'pass')) nonpass
from lat l group by 1;   -- BLANK 106/3/3 · CLAIM 75/20/6 · VOCAB 2/2/2

-- Q3: 도표 이미지 등록
select (select count(distinct item_id) from csat_review_visual_heads) heads,      -- 1
       (select count(*) from csat_items where exam_id like 'H%' and type_id='R-CHART') chart; -- 104
```

원인별 요약: **검수·발행 단계 적체(C4) 181**(검수 없음 158 · 3인 pass 미발행 13 · 정족수 미달 1 · revise 9) · **도표 이미지 미등록(C4+C6) 103** · **파싱/분류(C3) 16** · **출전 근거 부재(C5/C6) 2**. 「자료가 실제로 없음(C1)」에 해당하는 묶음은 **0** — 원문·선지·정답은 302 모두 DB 에 있고, 원본 PDF 도 로컬에 있다(§3).

### 1-1. 문서 간 수치 불일치 (신규, P3)

- D4a-06: `docs/csat-held-remediation-20261005.md` 2026-10-11 절은 「최신 학평 분석 2,608 · 발행 2,606 · 보류 2 · 새 미분석 대상 없음」. 현재 DB 는 학평 분석 보유 2,793 = published 2,610 + in_review 183, 미분석 119. 183 중 181 은 `created_at` 2026-10-10, analyst_run `an-20261011-R-CLAIM-*`/`R-BLANK-*` → 그 문서의 「최신」 집계 범위 밖이었을 가능성. **UNKNOWN**(어느 status 명령의 범위인지 미확인). 영향: 학평 화면 준비도를 그 문서 수치로 판단하면 302 공백이 0 으로 보임.
- 302 문항은 `csat_item_skeletons` 행도 0(학평 skeleton 2,299/2,912). 공개 판이 없으니 지도 골격도 없다 — NO_DATA 상태 정의(KNOWN 00 §3 P0-3)의 범위에 skeleton 부재 포함 필요.

## 2. 해결 경로 (기존 자산 → 변환 → 승인)

| 묶음 | 기존 자산 | 변환 | 승인/게이트 |
|---|---|---|---|
| D4a-04 CLAIM 3인 pass 13 | DB 분석 + 독립 검수 3건(현재 units_hash 결속) | 없음 — 발행 사전 검사 v4 재실행 후 native 발행 | 학평 발행 정책(유효 3인·최신 PASS·DB 시간순)만. DB 쓰기는 status 갱신 → 사용자 대화 승인(DB 쓰기) |
| D4a-03/04 검수 없음 158 · revise 9 | DB 분석(units 결속) · 검수 CLI(`review-drain` start→solve→reveal→submit) | 새 독립 3인 블라인드 검수 · revise 는 교정 분석 새 버전 | 위와 같음. BLANK 41(body_ok=false)은 검수 입력에서 **원본 PDF 크롭 대조**를 필수로(학평 PDF 로컬 존재) |
| D4a-01 도표 103 | 로컬 학평 PDF(`C:/Users/Administrator/Documents/영어/학력평가`, 683파일 · `ingest-hakpyeong.mjs:42`) · 옛 텍스트 산출물(Vocaflow-hakpyeong out 11) | PDF→정본 PNG 크롭 → `visual-register --file`(PDF 파일/해시/쪽 + PNG 해시 + 확인 주체) → 이미지 연결 뒤 단위·분석 재생성 → visual-ack 포함 3인 검수. 옛 텍스트 산출물은 **비교 참고만**(이미지 없이 쓴 분석은 정책상 재사용 불가) | 등록·적재는 DB 쓰기 승인. 104 중 1개만 실증된 경로라 소량(회차 1~2) 검증 후 확대 |
| D4a-02 유형 미지정 16 | DB 본문 · 로컬 PDF · `ingest-hakpyeong.mjs` | 유형 매핑(7) · H1906G1 #31~39·H2403G2#20 은 PDF 재파싱으로 발문/지문 칸 교정 → `corpus-sync --items` → units-build | 원문 갱신은 DB 쓰기 승인. 재파싱 결과는 PDF 대조 표본 확인 후 |
| D4a-05 X-VOCAB 2 | 출제기관 해설 PDF(정답 및 해설) | 없음 — 출전/공식 설명 확보 전 공개 불가 | 근거 확보 전 보류 유지가 정답. 화면은 HELD 상태 |

## 3. 의미 지원(meaning support): 구조 검증 vs 내용 감수

- 범위: `apps/web/src/lib/csat/meaning-support-data.json`(main e3e0a6a0e) **27문항, 전부 2026 수능**(18~45, 25번은 partial). 학평·다른 회차 0.
- D4a-07 (KNOWN 02 §55 확장): 런타임 `data.ts:59-67 reviewedNow` 는 schema·criteria 문자열·reviewer 비어있지 않음·contentHash 16hex 일치만 본다 = **구조·무결성 검증**. 결속(`analysisVersion`·`unitsHash`·`basePublicHash`)은 stale 판정용.
- 내용 감수는 빌드 시점에만 존재: `scripts/csat/meaning-support-build.mjs:7` 이 `review-ms-rv-*.json`(같은 contentHash 의 독립 pass, writer≠reviewer, revise/hold 없음)을 요구. 기준은 `meaning-support-drain/REVIEWER.md` MS01~MS10(주술 관계·범위 보존·외부 상식 승격 금지 등). 27개 reviewer 는 모두 `ms-rv-2026-NN-w*` — **AI 세션 검수**이며 사람/원본 감수 기록 없음. 즉 「pass」는 AI 독립 검수 1건이 같은 hash 에 묶였다는 뜻이지 내용 정확성 승인 아님.
- 공백: (a) 런타임은 검수 파일이 실제로 존재하는지 확인 못 한다(해시는 산출물 안에서 자기 계산) — 산출물 재생성 없이 `review` 블록만 맞춰 넣으면 통과(재현: contentHash 를 supportContentHash 결과로 채운 레코드). P2, 신규, 격리 환경 영향. (b) `binding.sourceSnapshotHash` 는 저장되지만 `lookupMeaningSupport` 비교 대상이 아니다 → 원문(skeleton.source_hash) 교정이 units_hash 를 바꾸지 않으면 미탐지 (KNOWN 03 §33 과 같은 계열).
- 해결 경로: review-*.json 의 verdict·content_hash 를 빌드 산출물 옆 매니페스트(파일 sha256)로 고정 → 런타임/CI 가 매니페스트 대조 · sourceSnapshotHash 를 결속 비교에 포함 · 원본 감수(사람 또는 별도 owner) 판정은 별도 필드로 구분. 승인: 공개 계약 변경 = 사용자 결정.

## 4. 공식 원문(PDF) ↔ 저장 선지 결속

- D4a-08: DB 에 PDF 결속 컬럼이 없다. `csat_items.raw_block` 0/3,714, `csat_exams.source_note` 는 1행(M-회차 PDF 중복 무효 기록)뿐. 선지(`choices`)는 5개 배열 3,713/3,714지만 **어느 PDF·쪽·좌표에서 왔는지의 해시 기록이 없다**. 유일한 예외는 도표 visual asset 1건(PDF 파일/해시/쪽 + PNG 해시).
- 개발 서버 원문 표시(`lib/csat/reflow/dev-paper.ts:24` development 전용, `api/csat/dev-paper/route.ts` 운영 404)는 **파일명 패턴**으로만 회차를 찾는다(`dev-paper.test.ts`). 파일 sha256·저장 선지와의 대조 없음 → 다른 판본 PDF 가 같은 이름이면 그대로 표시. KNOWN(03 §4-2 로컬 PDF 계약 DATA_GAP).
- 이미 드러난 불일치 근거: CHANGELOG 「PDF로 확인한 밑줄 범위·삽입문 경계 등의 수정 계획은 … 적용 대기」(학평) · 학평 빈칸 PDF 복구 20개 · 302 중 body_ok=false 50(Q1 body_bad 합). 2026#34 선지 원지 대조 NOT_VERIFIED (KNOWN 12 §2).
- 권리(C5): 학평 PDF 는 EBSi 배포본(`ingest-hakpyeong.mjs:9` 주석), 평가원 PDF 는 게시판. 학습자 화면은 「학습자가 받은 PDF 를 놓는다」(DECISIONS D15)로 서버 배포를 피한다. 저장 본문·선지의 서비스 내 공개 범위 확인 기록은 이 조사에서 찾지 못함 → **NOT_VERIFIED**.
- 해결 경로: 로컬 PDF(평가원 `dev-paper` 기본 폴더, 학평 683파일) → 기존 추출기(`ingest-hakpyeong.mjs` pdfjs 좌표, reflow `original-crop`)로 문항별 `{pdf_sha256, page, bbox, choices_text_sha256}` 산출 → DB 선지 정규화 해시와 대조 리포트(읽기 전용) → 불일치만 사람/AI 검수 → 결속 컬럼/사이드카 추가는 마이그레이션 승인. 대조 리포트 단계까지는 DB 쓰기 없음.

## 5. 발견 목록

| ID | 심각도 | 신규/KNOWN | 원본 감수 필요 |
|---|---|---|---|
| D4a-01 도표 103 이미지 미등록 | P1(학평 도표 유형 전체 공백, 실제품) | 신규(원인 분해) | 예(PNG 크롭 확인) |
| D4a-02 유형 미지정 16 · H1906G1 칸 어긋남 | P2 | 신규(16 수치는 KNOWN) | 예(PDF 재파싱) |
| D4a-03/04 검수 적체 181 · 3인 pass 미발행 13 | P1 | 신규(원인 분해; 183 은 KNOWN) | BLANK 41 예 |
| D4a-05 X-VOCAB 2 출전 부재 | P3 | KNOWN | 예 |
| D4a-06 2,608 vs 2,793 문서 불일치 | P3 | 신규 | 아니오 |
| D4a-07 의미 지원 런타임 = 구조 검증만 | P2 | KNOWN(02 §55) 확장 | 내용은 AI 검수뿐 |
| D4a-08 PDF↔선지 해시 결속 없음 | P1(원문 표시 계약) | KNOWN(03 §4-2) 확장 | 예 |

## 조사 범위(실제로 본 개수)

- DB: csat_items 3,714(302 전수 ID·유형·body_ok), csat_item_analyses 학평 3,818행, csat_independent_reviews(183 의 최신 분석 대상), csat_item_units 결속(183), csat_review_visual_* 4표, csat_exams 134, csat_item_skeletons 2,299. 모든 질의 SELECT.
- 저장소: 문서 00·02·03·12(37f8b7219), S0 `GAP_AND_ASSUMPTION_REGISTER.md`·`READINESS_MATRIX.md`, `csat-held-remediation-20261005.md`, CHANGELOG 학평 항목, `analysis-drain-export.mjs`, `ingest-hakpyeong.mjs`, `meaning-support/data.ts`·`meaning-support-build.mjs`·`REVIEWER.md`·review 파일 1개, `dev-paper.ts`·route, Vocaflow-hakpyeong·Vocaflow-csat-review-drain 의 analysis-drain-hakpyeong 파일 목록(1,205 / 6). 로컬 학평 PDF 폴더 파일 수만 확인(683).

## 완료/부분/미완료

- 완료: 302 원인 분해(합계 일치) · 의미 지원 검증 층위 구분 · PDF↔선지 결속 부재 확인.
- 부분: 도표 옛 산출물 — 파일 존재와 대체 예약까지만, 각 out 의 적재 가능 여부는 미판정. in_review 183 이 2026-10-11 집계에서 빠진 경위.
- 미완료: 문항별 PDF↔DB 선지 텍스트 대조(도구 실행 안 함).

## 미검증

- NOT_VERIFIED: PDF 와 저장 선지의 실제 일치율 · 학평/평가원 원문의 서비스 내 사용 권리 범위 · 3인 pass 13 문항이 사전 검사 v4 를 지금도 통과하는지 · 의미 지원 27개 내용 정확성(원본 감수).
- UNKNOWN: D4a-06 수치 차이의 정확한 원인 · redo-20261010 도표 재분석이 멈춘 이유(문서 미발견).
