# CSAT v4.0 S0 — READINESS_MATRIX (자원 준비도 · 검수 · 공개 상태)

- 측정 2026-10-23 · 개발 DB 읽기 전용 + 소스 `3f437e9b6` 파일 집계 · AI-Control T-0131
- 상태 어휘(기준서 §5.4): readiness `ready|missing|stale|mismatch|unknown` · review `accepted|pending|rejected|unknown` · permission `allowed|denied|embargoed|unknown` · pdfMatch `matched|absent|mismatch|unverified`. 각 축은 **독립**이다 — 한 축이 ready라도 다른 축을 올리지 않는다.

## 0. 전체 수치(기준서 AT19 대조)

| 자원 | 기준서(10-23 묶음) | 실측(10-23 S0) | 출처 |
|---|---|---|---|
| 공개 해설(published 분석이 있는 문항) | 3,412/3,412 | **3,412** / 적재 문항 3,714 | `csat_item_analyses.status='published'` distinct item |
| 최신 판이 in_review | — | 186(이 중 183은 이전 published 판이 있어 학습자에겐 옛 판이 보임 → **stale 후보**) | 최신 version 기준 |
| 분석 없음 | — | 119 (R-CHART 학평 103 + 미분류 16) | |
| 탐구 v3(verified) | 786 | **786** (수능 371 · 모평 415 · 학평 0) | `apps/web/src/lib/csat/inquiry-data.json` |
| 상세 의미 | 27 | **27** (전부 2026 수능 18~45) | `meaning-support-data.json` |
| 비교 색인 | 477 문항 | **477** 문항 / 749 쌍(same_structure 696 · boundary 49 · contrast 4) | `compare-v3-data.json` |
| 강의(schema1) | 37 cue(3문항) | **796** 문항 강의(수능 378 · 모평 418), schema3 강의 **0** | `lecture-data/index.json`, `lecture/types.ts:105-163` |
| 듣기 문항 | — | **0** | `csat_items` |

수치는 10-23 기준이며 라이브 상태를 단정하지 않는다(AT19).

## 1. 유형별 행렬

S/M/H = 수능/모평/학평 문항 수. 해설 = published. v3·강의·비교·의미는 파일 집계(수능+모평 대상). 강의 색인에 유형이 있는 문항만 유형별로 셌다(강의 없는 v3 6건·비교 4건·의미 1건은 "(유형 미상)").

| type | S/M/H | 해설 | 최신 in_review | 원문(passage) | body_ok | 선지 | v3 | 의미 | 강의 | 비교 문항 | 근거 단위(units) | units 해시 불일치 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R-PURPOSE | 12/15/104 | 131 | 0 | 131 | 125 | 131 | 26 | 1 | 27 | 26 | 학평만 104 | 0 |
| R-MOOD | 13/15/104 | 132 | 0 | 132 | 131 | 132 | 21 | 0 | 28 | 20 | 104 | 0 |
| R-CLAIM | 10/15/102 | 52 | **75** | 127 | 126 | 127 | 23 | 1 | 23 | 21 | 102 | 0 |
| R-GIST | 14/15/103 | 132 | 0 | 132 | 131 | 132 | 27 | 1 | 29 | 24 | 103 | 0 |
| R-TOPIC | 15/15/104 | 134 | 0 | 134 | 132 | 134 | 29 | 1 | 29 | 26 | 104 | 0 |
| R-TITLE | 16/15/106 | 137 | 0 | 137 | 134 | 137 | 31 | 1 | 31 | 31 | 106 | 0 |
| R-IMPLY | 8/14/93 | 115 | 0 | 115 | 115 | 115 | 22 | 1 | 22 | 19 | 93 | 0 |
| R-BLANK | 55/60/412 | 421 | **106** | 527 | 354 | 527 | 115 | 4 | 115 | 92 | 412 | 1 |
| R-IRRELEVANT | 13/15/104 | 132 | 0 | 132 | 132 | 132 | 28 | 1 | 28 | 26 | 104 | 0 |
| R-ORDER | 26/30/206 | 262 | 0 | 262 | 256 | 262 | 55 | 2 | 55 | 33 | 206 | 0 |
| R-INSERT | 26/30/206 | 262 | 0 | 262 | 261 | 262 | 55 | 2 | 56 | 41 | 206 | **21** |
| R-CHART | 14/15/104 | **30** | 0 | 133 | 130 | 133 | 29 | 1 | 29 | **0** | 104 | 0 |
| R-FACT | 13/15/103 | 131 | 1 | 131 | 126 | 131 | 28 | 1 | 28 | **0** | 103 | 0 |
| R-NOTICE | 27/30/208 | 265 | 1 | 265 | 244 | 265 | 57 | 2 | 57 | 21 | 208 | 1 |
| R-GRAMMAR | 14/15/100 | 129 | 0 | 129 | 129 | 129 | 28 | 1 | 28 | **2** | 100 | 0 |
| R-VOCAB | 14/15/103 | 132 | 0 | 132 | 124 | 132 | 28 | 1 | 29 | **2** | 103 | 0 |
| R-SUMMARY | 13/15/102 | 130 | 0 | 130 | **29** | 130 | 28 | 1 | 28 | 28 | 102 | 0 |
| X-TITLE | 14/15/104 | 133 | 1 | 133 | 124 | 133 | 28 | 0 | 28 | 26 | 104 | 0 |
| X-VOCAB | 8/14/93 | 113 | 2 | 115 | 109 | 115 | 22 | 1 | 22 | **0** | 93 | 0 |
| X-ORDER | 14/15/104 | 133 | 0 | 133 | 133 | 133 | 29 | 1 | 29 | 29 | 104 | 0 |
| X-REFER | 14/15/104 | 133 | 0 | 133 | 133 | 133 | 27 | 1 | 29 | **0** | 104 | 0 |
| X-FACT | 14/15/104 | 133 | 0 | 133 | 133 | 133 | 29 | 1 | 29 | **0** | 104 | 0 |
| retired 5종 | — | 41 | 0 | 41 | 37 | 41 | 15 | 0 | 17 | 8 | 23 | 0 |
| (미분류) | 0/0/16 | 0 | — | 16 | 10 | 16 | — | — | 0 | — | 16 | — |
| 듣기 L-* | 0 | **DATA_GAP** | | | | | | | | | | |

열 정의와 판정:
- **원문(passage)**: 서버 전용 컬럼에 본문 존재(사실). 학습자 화면은 원문을 보여주지 않고 로컬 PDF에 의존(`page.tsx` 머리말) → 학습자 기준 원문 readiness는 **pdfMatch에 종속, 서버 측정 불가 = unknown**.
- **body_ok**: 파서가 본문 무결로 표시한 수. R-SUMMARY 29/130·R-BLANK 354/527은 낮다 — 내용 결함인지 판정 규칙(요약 박스·빈칸 기호) 탓인지 **UNKNOWN**(GAP-D03).
- **units 해시 불일치**: 최신 published 분석의 `units_hash` ≠ 현재 `csat_item_units.units_hash` → **mismatch**. R-INSERT 학평 21건이 집중.
- **units 미결속**: 수능·모평 published 분석은 전부 `units_hash IS NULL`(근거 단위 표가 학평에만 있음) → 수능·모평 근거 위치 결속 상태 = **unknown**(v3 파일 자체 `units_hash`로 별도 결속되므로 v3 화면은 파일 기준).
- **비교 0 유형**(R-CHART·R-FACT·X-FACT·X-REFER·X-VOCAB, R-GRAMMAR/R-VOCAB 2): 같은 원리 직접 비교 `UNAVAILABLE` 처리 대상(기준서 §5.4).

## 2. 검수(review) — 해설·v3·강의 각각 독립

| 자원 | 검수 근거 | 상태 |
|---|---|---|
| 학평 published 분석 | `csat_independent_reviews` 결속(분석·입력·정답·units 해시) — 학평 published 전부 1건 이상 | accepted 후보(판정 문구는 verdict 열, 내용 정확성 감수 아님) |
| 수능·모평 published 분석 | `csat_analysis_reviews` 3인 페르소나(해시 결속 없음) | accepted(구식) — **해시 미결속이라 현재 원문과의 결속은 unknown** |
| 탐구 v3 786 | 파일 `review: verified` | accepted(파일 주장, DB 검수 기록 없음) |
| 강의 796 | `score`(GRADER.md 루브릭) 단일 AI 채점 | **pending**(사람/독립 내용 감수 기록 없음) |
| 비교 749쌍 | 생성 스크립트 기준(pair-v1.0) | **unknown**(검수 기록 없음) |
| 의미 27 | 파일 | unknown |

## 3. 공개(permission) — 해설·비교·강의 각각 독립

| 자원 | 근거 | 상태 |
|---|---|---|
| 문항 메타·정답 | `csat_items_public` 뷰(authenticated 컬럼 ACL, 본문·발문 제외). **answer 컬럼은 노출** | allowed(정답은 별도 공개 위험 — GAP-P02) |
| 원문·선지 본문 | 기본 테이블 RLS `USING false`, service_role만 | denied(클라이언트) |
| 엠바고 | `embargo-gate.ts` fail-closed RPC → 423 | 문항별 embargoed 가능, 실측 엠바고 목록은 S0에서 조회하지 않음(unknown) |
| 비교 짝 본문 | `compare-v3-data.json`은 정적 파일 import — **짝별 공개/권한 필드 없음** | **unknown**(기준서 CORE-07 "비공개 본문 미전송" 검증 불가) |
| 강의 | 재생 후 `/api/csat/lecture` 응답 | allowed(로그인), 문항 엠바고와의 결합은 미검증 |
| 로컬 PDF | `read-paper.ts` 해시만 전송 | pdfMatch: **unverified**(실 PDF 미투입) |

## 4. 회귀 3문항

| item | 해설 | v3 | 의미 | 강의 | 비교 | units 결속 |
|---|---|---|---|---|---|---|
| 2026#34 R-BLANK | published v5(5판 모두 published) | verified, analysis_version 5, 7문장 | ready | schema1 v2 · 12 cue · 196s(est) | **0 → UNAVAILABLE** | DB units 없음 / v3 파일 해시 |
| 2026#22 R-GIST | published v5 | verified, 10문장 | ready | v2 · 13 cue · 182s | 2쌍(공개 unknown) | 동일 |
| 2026#38 R-INSERT | published v5 | verified, 8문장 | ready | v3 · 12 cue · 185s | 2쌍(공개 unknown) | 동일 |

강의 판(v2/v3)과 분석 판(v5)은 **서로 다른 버전 체계**이며 강의는 분석 판에 결속되지 않았다(schema1, binding 없음).
