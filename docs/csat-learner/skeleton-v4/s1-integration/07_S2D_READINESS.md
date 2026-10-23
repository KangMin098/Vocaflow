# S2-d — 44유형 실제 코드·DB 구현 준비도 (T-0141 대응표 대비 차이)

AI-Control **T-0142** · owner `csat-s1-integration` · 읽기 전용 · DRAFT — 독립 검증 전.
기준: T-0141 `06_RESIDUAL.md` §1(@`ff57a8b2b`, ACCEPT). 대응표는 다시 쓰지 않고 **실제와의 차이만** 적는다.

## 측정 출처

| 층위 | 출처 | 시각 |
|---|---|---|
| 구현(제품 코드) | main `e3e0a6a0e` — `git grep`로 `apps/web/src/components/csat` · `apps/web/src/lib/csat` · `apps/web/src/app/(app)/csat`의 유형 리터럴·`teachingModelOf`·`disclosure` 참조 | 2026-10-24 |
| 데이터(DB) | 개발 DB `jajenrevcbmrpaliomxv` SELECT 1회(아래 SQL) | 2026-10-24 04:28:39 KST |
| 콘텐츠·강의 파일 | main `apps/web/src/lib/csat/{inquiry-data,meaning-support-data,compare-v3-data}.json` · `lecture-data/index.json` | 2026-10-24 |

```sql
with lp as (select distinct item_id from csat_item_analyses where status='published')
select coalesce(i.type_id,'(null)') type_id, count(*) items,
 count(*) filter (where i.body_ok) body_ok,
 count(*) filter (where i.id in (select item_id from lp)) published,
 count(*) filter (where exists (select 1 from csat_item_units u where u.item_id=i.id)) units,
 count(*) filter (where exists (select 1 from csat_item_skeletons s where s.item_id=i.id)) skeleton,
 count(*) filter (where i.official_error_rate is not null) official_err,
 count(*) filter (where exists (select 1 from csat_item_response_stats r where r.exam_id=i.exam_id and r.no=i.no)) resp_stats
from csat_items i group by 1 order by 1;
```

## 1. 구현 준비도 — 대응표와의 차이

| 대응표 기술 | 실제 main | 차이 |
|---|---|---|
| 유형별 판단 도구 10종(T-ROLE·T-PROP·T-SEAM·T-AXIS·T-SLOT·T-CELL·T-FORM·T-TURN·T-TRACK·T-LISTEN) | **0종 구현.** 44유형 모두 공통 `AnalysisTheater` + `InquiryV3Panels`로 렌더 | 전 유형 구현 준비도 = **NEW 필요**(설계만 있음) |
| 유형별 분기 | 실제 분기는 4곳뿐: `teachingModelOf`(문구·불리언 2, `AnalysisTheater.tsx`) · `understanding-check.ts` `POSITION_TYPES`(R-INSERT·R-ORDER·R-IRRELEVANT·X-ORDER) · `reflow/reflow.ts` 인라인 기호·시각 원지 집합 · `learner-text.ts` R-NOTICE "줄" 명칭. 그 밖에 지도 라벨(`TaskInspector.tsx`)·주문 마법사(`order-model.ts`, 관리자) | `POSITION_TYPES`가 R-IRRELEVANT를 위치형으로 묶음 → 진위 축 n_a 처리는 대응표 D1 제외와 **정합**. 단 T-AXIS(축 유지) 판정은 코드에 없음 |
| 강의 공개 게이트(05 §3) | main에 `disclosure` 참조 **0건**. 공개 경로·sidecar loader 없음 | 게이트는 T-0140 브랜치에만(미수용·미통합) |
| 듣기 18 | 제품 코드·교수 모델·DB 문항 모두 0 | 대응표와 일치(BLOCKED) |

## 2. 데이터 준비도 (DB, 04:28:39 KST) — 대응표와의 차이

| type | 문항 | body_ok | 공개 분석 | DB 근거 단위 | DB 골격 | 공식 오답률 | 사설 응답 통계 |
|---|---|---|---|---|---|---|---|
| R-PURPOSE | 131 | 125 | 131 | 104 | 98 | 0 | 126 |
| R-MOOD | 132 | 131 | 132 | 104 | 103 | 0 | 126 |
| R-CLAIM | 127 | 126 | **52** | 102 | 24 | 0 | 123 |
| R-GIST | 132 | 131 | 132 | 103 | 102 | 0 | 125 |
| R-TOPIC | 134 | 132 | 134 | 104 | 102 | 0 | 126 |
| R-TITLE | 137 | 134 | 137 | 106 | 103 | 0 | 129 |
| R-IMPLY | 115 | 115 | 115 | 93 | 93 | 0 | 112 |
| R-BLANK | 527 | **354** | 421 | 412 | **173** | 0 | 500 |
| R-IRRELEVANT | 132 | 132 | 132 | 104 | 104 | 0 | 126 |
| R-ORDER | 262 | 256 | 262 | 206 | 200 | 0 | 250 |
| R-INSERT | 262 | 261 | 262 | 206 | 205 | 0 | 250 |
| R-CHART | 133 | 130 | **30** | 104 | **0** | 0 | 126 |
| R-FACT | 131 | 126 | 131 | 103 | 98 | 0 | 125 |
| R-NOTICE | 265 | 244 | 265 | 208 | 187 | 0 | 252 |
| R-GRAMMAR | 129 | 129 | 129 | 100 | 100 | 0 | 122 |
| R-VOCAB | 132 | 124 | 132 | 103 | 95 | 0 | 125 |
| R-SUMMARY | 130 | **29** | 130 | 102 | **1** | 0 | 124 |
| X-TITLE | 133 | 124 | 133 | 104 | 95 | 0 | 126 |
| X-VOCAB | 115 | 109 | 113 | 93 | 85 | 0 | 112 |
| X-ORDER | 133 | 133 | 133 | 104 | 104 | 0 | 126 |
| X-REFER | 133 | 133 | 133 | 104 | 104 | 0 | 126 |
| X-FACT | 133 | 133 | 133 | 104 | 104 | 0 | 126 |
| R-BLANK2 | 4 | 4 | 4 | **0** | 0 | 0 | **0** |
| R-REFER | 18 | 17 | 18 | 12 | 11 | 0 | 15 |
| X-BLANK | 17 | 14 | 17 | 11 | 8 | 0 | 13 |
| X-BLANK2 | 1 | 1 | 1 | **0** | 0 | 0 | 1 |
| (미분류) | 16 | 9 | 0 | 16 | 0 | 0 | 16 |
| 듣기 L-* | 0 | — | — | — | — | — | — |

차이 요약:
- **공식 오답률 전 유형 0**(DATA_GAP). 대신 사설 응답 통계(`csat_item_response_stats`, 공식값 아님)가 대부분 문항에 있다 — 대응표에 없던 자원. 학습자 화면에 쓰려면 "사설 집계" 표기가 필요하고 공식값으로 쓰지 않는다.
- **DB 근거 단위·골격은 학평 문항에만** 있다(수능·모평은 0). 제품 문항 화면은 커밋된 파일 골격을 읽는다(G3 §6) → DB 결속(F2)은 수능·모평에서 파일 쪽 해시에 의존.
- 대응표의 데이터 공백(R-CHART 공개 30·골격 0, R-SUMMARY body_ok 29·골격 1, R-BLANK body_ok 67%, R-CLAIM 공개 52)은 실측과 **일치**.
- retired R-BLANK2·X-BLANK2는 DB 근거 단위 0 → 근거 결속 불가(대응표 DATA_GAP 판정과 정합).

## 3. 콘텐츠·강의 준비도 (main 파일)

| 자원 | main 실측 | 대응표 대비 |
|---|---|---|
| v3 탐구 | 786문항(수능 371 · 모평 415 · 학평 0) | 일치 |
| 상세 의미 | 27문항(2026 수능 18~45 중 27) | 일치 |
| 비교 짝 | 477문항 / 749쌍 | 일치. 공개는 서버 projection, 실계정 미검증 |
| 강의 대본 | 796강(수능 378 · 모평 418), 학평 0, 듣기 0 | 일치 |
| 강의 공개 수준 | main 0(연구 sidecar@810a463ac만, 제품 미적용) | 일치 |

## 4. 유형별 종합 준비도 (구현 · 데이터 · 콘텐츠 · 강의 분리)

| 묶음 | 구현 | 데이터 | 콘텐츠 | 강의 |
|---|---|---|---|---|
| 대의(R-PURPOSE·R-GIST·R-TOPIC·R-TITLE·X-TITLE) | NEW(T-ROLE 없음) | 준비 | v3 수능·모평만 | 대본 있음 · 게이트 미구현 |
| R-CLAIM | NEW | 공개 52/127 | 동일 | 동일 |
| R-MOOD | NEW(T-TURN 없음) | 준비(전환점·단서 span 0) | v3 21 · 의미 0 | 대본 28 · 게이트 미구현 |
| R-BLANK·R-IMPLY | NEW(T-PROP 없음, 2026-34만 S2-b 대상) | R-BLANK body_ok 67% | 2026-34 v3·의미 있음 | 34 c3 UNKNOWN 충돌(06 §2.3) |
| R-INSERT·R-ORDER·X-ORDER | NEW(T-SEAM 없음) | 준비 | 38⑤ C1 미승인 | 조기 공개 R-ORDER 7 |
| R-IRRELEVANT | NEW(T-AXIS 없음) · 위치형 분기만 있음 | 준비 | 표본 얕음 | 조기 공개 9 |
| R-FACT·X-FACT·R-NOTICE | NEW(T-SLOT 없음) | 정렬 0 · R-NOTICE body_ok 92% | v3 있음 | 조기 공개 R-NOTICE 8 |
| R-GRAMMAR·R-VOCAB·X-VOCAB | NEW(T-FORM 없음) | 밑줄 경계·낱말 추출 공백 | v3 있음 | 게이트 미구현 |
| R-CHART | NEW · BLOCKED | 도표 수치 0 · 공개 30 · 골격 0 | v3 29 | 대본 29 |
| R-SUMMARY | NEW · BLOCKED(부분) | body_ok 29/130 · 골격 1 | v3 28 | 대본 28 |
| X-REFER | NEW(T-TRACK 없음) | 준비 | v3 27 | 대본 29 |
| retired 4 | 보관 | R-BLANK2·X-BLANK2 근거 단위 0 | 일부 | 대본 17 |
| 듣기 18 | BLOCKED | 0 | 0 | 0 |

결론: **설계(대응표)와 데이터는 상당 부분 맞지만, 유형 전용 판단 도구는 한 유형도 구현돼 있지 않다.** 지금 구현 착수 가능한 범위는 T-0141 §3의 S2-b(2026-34, 공개 후, 겹치지 않는 파일)뿐이며, 나머지 유형은 도구 구현(NEW)과 데이터 보정이 먼저다. 이 판단은 준비도 실측이며 학습 효과·콘텐츠 정확성 판정이 아니다.

## 5. 하지 않은 것

DB 쓰기 · P6 SQL 적용 · 제품 코드 변경 · 미승인 콘텐츠 승격 · S1 전체 수용/S2 착수/main 통합 선언 없음. 실계정 RLS·RSC 응답·TTS·학습 효과 미검증.
