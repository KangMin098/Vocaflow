# v3 탐구 데이터 coverage 원장

> `node scripts/csat/inquiry-v3-ledger.mjs` 가 생성 — 손으로 고치지 말 것. 기준: 작성 입력 청크 · 작성 결과 · 공개 정본(`inquiry-data.json`) · 비교 정본(`compare-data.json`).
> 범위는 평가원(수능 · 6월/9월 모평, 고3) in_scope 분석 문항. **학평 고1~3 은 공개 보류(2026-10-11 사용자 결정)라 분모에 없다.**
> 장면 칸은 공개 데이터에 그 장면의 v3 칸이 있는 문항 수. compare 는 기존 비교 정본에 이름이 오른 문항 수(v3 검수 쌍 아님 — legacy_unbound).

## 상태

| status | 문항 | 뜻 |
|---|---:|---|
| needs_review | 16 | 기존 분석의 문장 번호/인용이 화면 분할과 어긋남 — 분석 교정 공정 몫 |
| public_v3 | 786 | v3 칸까지 독립 검수 verified · 공개 |
| **합계** | **802** | |

## 기관 · 학년

| 기관 · 학년 | 분모 | 공개 v3 | 제외 | task | meaning | judgment | design | principle | compare |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 수능 · 고3 | 382 | 371 | 11 | 371 | 371 | 371 | 371 | 371 | 235 |
| 평가원 6월 모평 · 고3 | 224 | 221 | 3 | 221 | 221 | 221 | 221 | 221 | 148 |
| 평가원 9월 모평 · 고3 | 196 | 194 | 2 | 194 | 194 | 194 | 194 | 194 | 117 |

## 유형

| 유형 | 분모 | 공개 v3 | 제외 | task | meaning | judgment | design | principle | compare |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| R-BLANK | 115 | 115 | 0 | 115 | 115 | 115 | 115 | 115 | 100 |
| R-BLANK2 | 4 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 4 |
| R-CHART | 29 | 29 | 0 | 29 | 29 | 29 | 29 | 29 | 0 |
| R-CLAIM | 25 | 25 | 0 | 25 | 25 | 25 | 25 | 25 | 23 |
| R-FACT | 28 | 28 | 0 | 28 | 28 | 28 | 28 | 28 | 0 |
| R-GIST | 29 | 27 | 2 | 27 | 27 | 27 | 27 | 27 | 28 |
| R-GRAMMAR | 29 | 29 | 0 | 29 | 29 | 29 | 29 | 29 | 0 |
| R-IMPLY | 22 | 22 | 0 | 22 | 22 | 22 | 22 | 22 | 21 |
| R-INSERT | 56 | 55 | 1 | 55 | 55 | 55 | 55 | 55 | 41 |
| R-IRRELEVANT | 28 | 28 | 0 | 28 | 28 | 28 | 28 | 28 | 26 |
| R-MOOD | 28 | 21 | 7 | 21 | 21 | 21 | 21 | 21 | 26 |
| R-NOTICE | 57 | 57 | 0 | 57 | 57 | 57 | 57 | 57 | 21 |
| R-ORDER | 56 | 56 | 0 | 56 | 56 | 56 | 56 | 56 | 33 |
| R-PURPOSE | 27 | 26 | 1 | 26 | 26 | 26 | 26 | 26 | 26 |
| R-REFER | 6 | 6 | 0 | 6 | 6 | 6 | 6 | 6 | 0 |
| R-SUMMARY | 28 | 28 | 0 | 28 | 28 | 28 | 28 | 28 | 28 |
| R-TITLE | 31 | 31 | 0 | 31 | 31 | 31 | 31 | 31 | 31 |
| R-TOPIC | 30 | 30 | 0 | 30 | 30 | 30 | 30 | 30 | 28 |
| R-VOCAB | 29 | 28 | 1 | 28 | 28 | 28 | 28 | 28 | 2 |
| X-BLANK | 6 | 6 | 0 | 6 | 6 | 6 | 6 | 6 | 6 |
| X-BLANK2 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 0 |
| X-FACT | 29 | 29 | 0 | 29 | 29 | 29 | 29 | 29 | 0 |
| X-ORDER | 29 | 29 | 0 | 29 | 29 | 29 | 29 | 29 | 29 |
| X-REFER | 29 | 27 | 2 | 27 | 27 | 27 | 27 | 27 | 0 |
| X-TITLE | 29 | 29 | 0 | 29 | 29 | 29 | 29 | 29 | 27 |
| X-VOCAB | 22 | 22 | 0 | 22 | 22 | 22 | 22 | 22 | 0 |

## 제외 문항 (16)

- 2014A#24 · R-GIST · needs_review
- 2014B#23 · R-GIST · needs_review
- 2014B#36 · R-BLANK2 · needs_review
- 2015#34 · R-BLANK2 · needs_review
- 2015#44 · X-REFER · needs_review
- 2016#44 · X-REFER · needs_review
- 2023#18 · R-PURPOSE · needs_review
- 2023#19 · R-MOOD · needs_review
- 2023#38 · R-INSERT · needs_review
- 2024#19 · R-MOOD · needs_review
- 2026#19 · R-MOOD · needs_review
- M1809#19 · R-MOOD · needs_review
- M2006#19 · R-MOOD · needs_review
- M2306#30 · R-VOCAB · needs_review
- M2309#19 · R-MOOD · needs_review
- M2606#19 · R-MOOD · needs_review
