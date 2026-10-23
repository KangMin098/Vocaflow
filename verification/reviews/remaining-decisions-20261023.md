# T-0100 — 802 확대 및 DB 쓰기 3건 결정

- 작성: independent-review / Codex / t0100-codex, 2026-10-23 KST.
- 범위: 읽기 전용 결정. DB 접속·SQL 실행·제품 변경·Git 커밋 없음. 아래 SQL은 **미실행 초안**이며 사용자 승인 요청을 대신하지 않는다.
- 착수: 첫 `node bin/vfc.mjs task show T-0100`에서 IN_PROGRESS 및 session=t0100-codex 확인. 프로세스/PID 조회 명령은 실행하지 않았다.
- 정책: 중앙 development_policy(dev-minimal-20261020) 및 main-serving/AGENTS.md의 DB 승인 규칙. SQL·영향 범위 제시 후 대화 승인 전 쓰기 금지. 삭제·DROP·TRUNCATE는 별도 명시 승인.

## 1. 근거와 신뢰 경계

| 구분 | 직접 확인한 근거 | 판정 |
|---|---|---|
| D2 정본 | Vocaflow-goal-data의 **4673e15ac** `docs/research/goal-data-batches/D2-task-mapping/{mapping-review.md,CONTRACT_V2_1.md,mapping-coverage.json}` 및 같은 커밋 export·insert-split | confirmed: 120문항, 18 원자 TASK, 2,160쌍, R1 후보 428, 갈림 310, 삽입 대체 8. 이 수치는 연구 산출 규모이지 품질 합격 건수가 아님 |
| T-0097 수용 | AI-Control TASK_QUEUE 및 `verification/reviews/T-0097-20261023.md` | confirmed: 05:05:38Z COMPLETED, 수용 owner=platform-goal. 사실 자료의 READY/제출 중 정보는 낡음 |
| DB 현황 | `runtime/t-remaining-facts-20261023.md`의 Claude 읽기 결과 | **reported / 이 리뷰에서는 unclear**: 2023#38 choices SQL NULL, answer=5, body_ok=true; M2709 시험·문항 0; R-CHART 133 전부 raw_block NULL. DB 직접 재현 없음 |
| main 코드 | main-serving HEAD `59e3ced2751d6cd1ad8856b1ee990f12f93c8b25`에서 읽음 | confirmed: 사실 자료 기준 b5ff6d4fc보다 새로움. 관찰 시점 고정, 무커밋 대상 파일 변경 없음 |
| 테이블 계약 | `supabase/migrations/20260902055354_csat_analysis_pipeline.sql` §§2–3, `20261001150000_csat_diagnosis_mvp.sql` | confirmed: csat_items.choices=jsonb, raw_block=text, 시험 FK 및 (exam_id,no) unique. 진단 추가 컬럼 존재는 저장소 정의일 뿐 실제 적용 상태는 unclear |
| 원천 정책 | `docs/csat-learner/DECISIONS.md` 09-25 원문=reflow, 10-11 밑줄·삽입 DB 선지 유지 | confirmed: 부분 원문 재작성은 해시·분석·골격·강의 결속 영향을 함께 다뤄야 함. 누락 1행 복구와 기존 262행 저장 형식 일괄 변경을 섞지 않음 |

DB 수치는 Claude 제공 사실로 계획에 활용하되 독립 확인으로 승격하지 않았다. SQL/DB/L4 검증은 모두 미실행이다.

## 2. 802 확대 — 결정 및 착수 조건

**결정: 조건부 단계 진행. 현재 즉시 전 802×7 일괄 판정은 보류.** 802는 기존 평가원·수능 모집단의 참조 크기다. 결손·도표·불확실 삽입을 제외한 실제 적격 분모를 먼저 동결한다. M2709 신규 적재는 이 동결 집합에 조용히 추가하지 않는다.

### 착수 관문

1. **T-0097 수용: 충족(confirmed).** 반박 12건 정정본 4673e15ac를 사용한다. 원본 R3 제3 판정 11은 다수 7(관련 6·무관 1), 삼자 갈림 4. 삽입 2건 대체 후 적용 9는 다수 7·갈림 2다. 이전 “다수6/갈림5” 재사용 금지.
2. **R3 규칙 수용: 이 결정에서 연구 판정용으로 수용.** CONTRACT_V2_1 §1을 적용한다. 기능 명명을 요구하지 않아도 기능 오독→특정 오답이면 indirect이며 choice 반사실이 필수다. 단일 문장 기능 R3 / 여러 문장 배열 R4 경계를 유지한다. 다수결은 AI 후보일 뿐 relevance=unknown 유지. R3 κ −.15→.47은 관측이며 인과 개선은 unclear다. 전량 확대/개별 진단 자격의 수용은 아니다.
3. **입력·검증 준비: 아직 미완료.** 아래 TASK별 범위, 삽입 격리, 원천 해시, 도표 제외를 export와 selection에 반영하고 계약 버전을 봉인한다. 기존 d2-export의 고정 BATCHES에는 802 정의가 없고, d2-run은 18 원자 TASK 전체를 검증한다. 5/6 TASK만 출력해 기존 검증기를 그대로 통과한다고 주장할 수 없다. 현재 배치·청크 형식에 맞춘 범위 지원 또는 연구용 18 TASK 출력/수용 대상 분리 방식을 데이터 담당이 명시하고 검증해야 한다.

### 대상 TASK(학습 TASK 코드)와 제외

mapping-review §6의 초기 7개를 §8–9와 coverage의 실제 κ로 갱신한다.

| 대상 | 결정 | 근거·제약 |
|---|---|---|
| R5·R6·E1·E3·R4 | 1순위 확대 연구 후보 | 안정 5개. b4 κ 각각 .774/.871/.8235/.6878/.729. E1 비표준·부정·두 빈칸 발문은 명시 경계 검토. E3/V4 겹침은 갈림 격리. 삽입 R4는 아래 개별 관찰 제한 적용 |
| R2 | 2순위 조건부 확대 | 초기 7개에 포함되지만 최신 b4 κ .6601. 경계 갈림은 제3 판정 후 후보로만. E3·R2 객관식 오답을 약점 확정으로 쓰지 않는 제품 제한(T-0096) 유지 |
| E2 | 전량 확대 보류, 규칙 보정 소배치만 | b4 κ .4106, 삽입 일치 .25. v2.2에서 탐색 필요성 및 삽입 indirect 여부를 결정하고 같은 표본 A/B 재판정 후 재수용 |
| R3 | 규칙 수용·제3 판정 연구만 | 초기 7개 밖. 남은 갈림·삽입 R2/R3/R4 중첩 때문에 전량 확대 대상에 추가하지 않음 |
| R1·V1·S5·V4·S4 | 이번 확대 수용 범위 제외 | 제3 판정 또는 경계 정리가 먼저. V4↔E3 규칙 v2.2 보정 우선. 최신 V1 κ .4182도 초기 기대를 그대로 재사용할 수 없는 근거 |
| V2·V3·S1·S2·S3 | 직접 관찰 확대 제외 | direct 희소(120문항에서 0–3). “미측정” 유지, 능력 측정 불가능으로 일반화하지 않음 |
| 통합 관찰 3 TASK | 문항 단위 매핑 제외 | d2-run의 kind=integrated 제외 규칙 유지 |

### 배치·재사용·삽입·도표

- 시험별 추적을 유지하며 **배치 최대 40문항**, 시험을 가로지를 때 시험별 소계를 남긴다. 기존 b4처럼 A/B 각각 20문항 이하 청크를 사용하되 새 배치 이름에도 CHUNK=20이 실제 적용되는지 확인한다(현재 정규식은 b4–b9만). 최초 새 배치 40 이하에서 품질 관문을 확인한 뒤 다음 시험으로 간다. 잔여를 맞추려고 결손을 포함하지 않는다.
- 재사용 기본 키는 **원천 문항 ID + 본문 SHA-256**. 본문 SHA는 UTF-8 원문 바이트 기준, 정규화/공백 변경 금지. 다만 이것만 같아도 충분하지 않다. 기존 `source_sha256`은 JSON.stringify({stem,passage,choices,answer,answers,points})이며 본문 단독 SHA와 다르다. 두 해시를 따로 기록하고 stem/choices/answer/points·계약/분리기 버전·TASK 정의·사용한 analysis_sha/version·입력 traps가 달라지면 영향 판정만 재실행한다. 구버전 입력에 본문 단독 SHA가 없으면 로컬 원문에서 계산하여 결속하기 전에는 재사용 확정 금지.
- 기존 120문항과 b3 대체 8은 이 키 및 계약 호환성 확인 후 재사용한다. b3는 추가 8이 아니라 기존 8의 대체다. 802−120=682를 신규 처리 목표로 고정하지 않는다(제외·변경 입력·재판정이 존재).
- 삽입은 export에서 `given_sentence`와 나머지 본문을 **명시 분리**한다. 저장 passage는 바꾸지 않고 인용은 원문에 존재해야 한다. 현재 insertSplit 출력은 given_sentence/confidence/rule만 있으므로 본문 경계/나머지 전달을 추가로 명시할 필요가 있다. explicit_marker 47, first_sentence 215는 감사 보고 집계이며 **215 전량 정확성은 unclear**다. 약어·인용·첫 문장 오분리·① 표기 차이는 원본 대조 후 확정, uncertain은 제외한다.
- 삽입의 R2/R3/R4 공동 direct 교집합은 **7/8**. 삽입 문항 단위 정오를 세 TASK 각각의 독립 직접 관찰로 사용하지 않는다. 교수 사례/묶음 관찰로만 분리하고, 단서·기능·배열을 가르는 별도 관찰 도구 전에는 개별 진단 후보에서 격리한다.
- R-CHART는 해당 문항의 도표 값·단위·축·범례·출처 결속과 직접 확인이 끝날 때까지 제외한다. passage/선지/해설에서 값을 역추정하지 않는다. raw_block NULL 자체를 미확인 근거 전체로 취급하지 않는다.

### 성공 기준(사전 채택한 운영 관문)

1. 선택 집합·제외 사유·ID/해시·계약 버전 전량 결속, 중복·대체 누락·원문 인용 위조·정답을 반사실 오답으로 지정한 오류 0. A/B 전량 구조 검증 통과. 원문 내용 정확성은 구조 검증과 별도로 표본 대조한다.
2. 배치마다 TASK별 일치율·κ·direct/indirect/무관 분모를 보고한다. 안정 5 TASK도 일치율 .80 또는 κ .68을 모두 밑돌면 다음 배치를 멈추고 갈림을 원문으로 검토한다(초기 §2 기준을 중단 경보로 채택). 희소/단일 범주로 κ가 무의미하면 성공 처리하지 말고 unclear 및 추가 표본으로 남긴다. 이 수치는 학생 측정 타당도 기준이 아니다.
3. 각 배치에서 후보 10·갈림 10(부족하면 전부)을 독립 원문 대조하고 삽입·E1 경계·E3/V4 충돌을 포함한다. 실제 반박은 수정 및 영향 재검증, 경계 공백은 unclear로 격리하고 다음 배치 전 계약을 보완한다. 새 기준을 이전 표본의 통과로 소급하지 않는다.
4. **AI 후보 자동 승인 금지.** 두 AI 일치/제3 다수도 relevance=unknown이며 사람 Gold·권리·학생 성취 근거가 아니다. NeedRank·진단 입력 금지. 802 건수 달성으로 제품 성공을 선언하지 않는다. 사람 검수/권리 및 제품 입력의 검수 필터가 확인되기 전에는 연구 산출에만 둔다. T-0098의 창작 AI 결정 원장은 이 기출 링크 승인과 별개다.

## 3. DB 승인 패키지 A — 2023#38 choices 복구

**결정: 조건부 UPDATE 초안 가능, 승인·실행 준비 완료는 아님.** 목표는 누락 choices 한 행 복구이며 기존 다른 삽입 choices의 전환은 범위 밖이다.

- confirmed 원천: main-serving `scripts/csat/data/columns2/2023.txt` 존재, SHA256 `73963309ba2563cc9680d63eff05a1794b1d0d2f524ea5aee817fd66152011ea`.
- 읽기 전용 재현: `itemBlocks('2023',38)` 1블록, `choicesOf(block,{positionsOnly:true})` → `["①","②","③","④","⑤"]`, 기존 구간형 `choicesOf(block)` → null. 현재 `scripts/csat/lib-passage.mjs`의 삽입 위치 전용 파서와 일치한다. 문장 조각을 임의로 만들어 복구하지 않는다.
- unclear: DB passage와 이 추출본의 동등성, PDF/reflow 원본 대조, DB 최신 스키마·트리거, 입력 해시 변경 후 분석/골격/강의 영향. DECISIONS 10-11의 유지 정책에 대한 **단일 NULL 복구 예외**로 사용자에게 명시할 것.
- 예상 직접 영향: `public.csat_items` **1행 choices만**, answer=5 등 보존. 파생 영향 행 수는 아래 조회 전 미확정. 0행이면 성공이 아니라 오래된 사전조건/이미 변경됨 판정이다. 해시 변경을 자동 재발행으로 처리하지 않는다.

Claude 추가 조회 필요: 다음 SQL(읽기 전용). passage 원문·전체 스냅샷은 비공개 로컬 보관하고 이 문서에 복사하지 않는다.

```sql
SELECT id, exam_id, no, type_id, answer, answers, body_ok,
       choices IS NULL AS choices_sql_null,
       encode(sha256(convert_to(passage,'UTF8')),'hex') AS passage_sha256,
       length(passage) AS passage_chars,
       (SELECT count(*) FROM regexp_matches(passage,'[①②③④⑤]','g')) AS marks
FROM public.csat_items WHERE id='2023#38';
SELECT item_id, version, status FROM public.csat_item_analyses
WHERE item_id='2023#38' ORDER BY version;
SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger
WHERE tgrelid='public.csat_items'::regclass AND NOT tgisinternal;
SELECT DISTINCT p.proname, pg_get_functiondef(p.oid)
FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
WHERE t.tgrelid='public.csat_items'::regclass AND NOT t.tgisinternal;
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name IN
 ('csat_items','csat_item_analyses','csat_item_skeletons','csat_item_units')
ORDER BY table_name, ordinal_position;
```

`csat_hold_on_item_change`의 저장소 정의는 학평에 한정되므로 평가원 2023의 분석이 자동 보류된다고 단정하지 않는다. `20261004234255_csat_chart_review_assets.sql`에도 source 변경 트리거가 있다. Claude가 실제 트리거 함수 본문과 관련 표/FK를 확인해 부수효과 행 수와 복구 대상을 확정한다. 아래는 choices만의 매개변수 초안이다. `$1`은 승인 패키지에 고정한 **DB passage SHA**이며 위 파일 SHA가 아니다.

```sql
PREPARE t0100_restore_choices(text) AS
UPDATE public.csat_items
SET choices='["①","②","③","④","⑤"]'::jsonb
WHERE id='2023#38' AND exam_id='2023' AND no=38
  AND type_id='R-INSERT' AND answer=5 AND body_ok IS TRUE
  AND choices IS NULL
  AND encode(sha256(convert_to(passage,'UTF8')),'hex')=$1
  AND passage ~ '[(（][[:space:]]*①[[:space:]]*[)）]'
  AND passage ~ '[(（][[:space:]]*②[[:space:]]*[)）]'
  AND passage ~ '[(（][[:space:]]*③[[:space:]]*[)）]'
  AND passage ~ '[(（][[:space:]]*④[[:space:]]*[)）]'
  AND passage ~ '[(（][[:space:]]*⑤[[:space:]]*[)）]'
RETURNING id, choices, answer, body_ok;
```

실행 담당은 승인 후 한 트랜잭션에서 대상 행을 잠그고 승인 스냅샷과 모든 비대상 필드를 비교한다. 영향 1행·사후 SELECT 일치일 때만 COMMIT; 0/다수·차이·예외면 ROLLBACK. 이 리뷰에서는 PREPARE도 실행하지 않았다.

사후 검증 SELECT:

```sql
SELECT id, choices='["①","②","③","④","⑤"]'::jsonb AS choices_ok,
       answer, answers, body_ok,
       encode(sha256(convert_to(passage,'UTF8')),'hex') AS passage_sha256
FROM public.csat_items WHERE id='2023#38';
SELECT item_id, version, status FROM public.csat_item_analyses
WHERE item_id='2023#38' ORDER BY version;
```

승인 스냅샷과 passage·stem·정답·배점·raw_block 및 관련 분석 상태를 대조하고, 새 source_sha256으로 D2 입력을 재발행/재검증한다. 성공은 choices 1행 존재가 아니라 **원문과 위치 5개 대응 및 소비 경로 결속** 확인이다.

choices 복구 SQL(사전 값이 실제 SQL NULL이었다고 확인한 경우만):

```sql
PREPARE t0100_undo_choices(text) AS
UPDATE public.csat_items SET choices=NULL
WHERE id='2023#38'
  AND choices='["①","②","③","④","⑤"]'::jsonb
  AND encode(sha256(convert_to(passage,'UTF8')),'hex')=$1
RETURNING id, choices;
```

승인 후에도 타 작업 수정이 있으면 되돌리지 않고 멈춘다. 부수효과 복구는 스냅샷 기반으로 별도 확정하며 검수/발행 상태를 맹목 복원하지 않는다. 공개 전 격리 검증·분석 재결속 계획까지 붙인 패키지로 다시 승인받는다. 담당: platform-goal(Claude) 원천 대조·수집, data-contract DB 쓰기 소유권/실스키마 검토·실행 조율, goal-data-independent 독립 내용 검토. 기존 세션 재사용 가능 여부는 조정자가 확인한다.

## 4. DB 승인 패키지 B — M2709 적재

**결정: 보류. 최종 INSERT 초안 불가 — 회차에 결속된 완전한 적재 행 원천 미확정.** “원문 파일 없음”은 저장소 추적 파일에 한정된 주장이다. 다음 원천 후보가 실제 로컬에 있다.

| 파일(C:/Users/Administrator/Documents/영어/모의평가/) | 바이트 | SHA256 |
|---|---:|---|
| 202609_영어영역_문제지.pdf | 1,335,041 | 4fdb1e11fc03a3dcb2f9798c0503652264548065583bd2e931438964334b8bf3 |
| 202609_영어영역_정답표.pdf | 41,542 | c7a548798966af8fdb347e15ae8d6ca2ee13d5578a7449c06015562532f6acf7 |

파일 존재·바이트 해시만 확인했고 PDF 내용·공식성·회차는 검증하지 않았다. 특히 `scripts/csat/data/mock-questions.json` report는 **그 문제지 파일을 M2609로 매핑**(stems/assigned/keys=45)한다. `lib-exam-id.mjs`는 M2709를 2027학년도/2026년 9월로 해석한다. 파일명 202609가 학년도인지 시행연도인지 먼저 원본 표지로 판별해야 한다. 위 PDF를 이름만 보고 M2709로 재적재하면 중복 시험이 될 수 있다.

confirmed: 추적된 M2709 원문 파일명 없음; mock-questions/mock-answers에 M2709 키 없음. `map/source/item-rates-ebsi.json`에는 M2709 15행이 있지만 EBSi 응답자 오답률 상위15(`wrong_rate_top15`)이지 문항·정답 원천이 아니다. 이를 passage/answer/공식 통계로 바꾸지 않는다.

필요 원천과 담당:

1. platform-goal의 Claude 원천 수집 담당이 위 PDF의 표지·형·시행일·공식 정답을 확인하고 현재 M2609 원천/해시와 대조한다. 부적합이면 올바른 M2709 공식 문제지·정답표를 확보한다. 새 수집 체계를 만들지 않고 기존 ingest-mock/lib-exam-id/reflow 경로를 재사용한다.
2. goal-data 데이터 작업공간(기존 vocaflow-5e 종료, **살아 있다고 주장하지 않음**)에서 재개 가능한 담당이 번호·유형·stem/passage/choices·정답·배점·body_ok 및 원본 PDF SHA·쪽을 결속한 로컬 preview를 만든다. 듣기 키와 독해 원문 적재 범위를 분리한다.
3. data-contract가 csat_exams/참조 테이블 실스키마와 중복/FK·트리거를 확인한 뒤 열/값이 완결된 INSERT, 영향 행 및 복구 계획을 작성한다. 최종 사용자 승인 전 INSERT 실행 금지.

예상 범위는 회차가 정말 없으면 csat_exams 1행 + 독해/장문 #18–45 최대 28행. 45문항 정답표 별도 적재가 필요하면 csat_dx_answer_key 최대45행을 **추가 승인 범위로 분리**한다. 802 고정 집합 확장·분석 발행·diagnosis_ready 활성화는 별도 결정이다. 이 수치는 실측 영향 행이 아니다.

Claude 추가 조회 필요:

```sql
SELECT id,label,kind,year,month,form,item_count,has_answer_key
FROM public.csat_exams WHERE id IN ('M2709','M2609');
SELECT exam_id,count(*) AS n,min(no),max(no)
FROM public.csat_items WHERE exam_id IN ('M2709','M2609') GROUP BY exam_id;
SELECT exam_id,no,id,type_id,body_ok,
       encode(sha256(convert_to(coalesce(passage,''),'UTF8')),'hex') AS passage_sha
FROM public.csat_items WHERE exam_id IN ('M2709','M2609') ORDER BY exam_id,no;
SELECT conrelid::regclass, conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE confrelid IN
 ('public.csat_exams'::regclass,'public.csat_items'::regclass);
```

사전 검증: DB 0행 재확인·원본 회차 대조·적재 payload SHA 동결. 사후 검증: 동결 ID/번호/해시/정답/배점 전량 대조 및 FK·분석 비발행 확인(미실행). 복구: COMMIT 전 오류는 ROLLBACK. COMMIT 뒤 신규 시험 DELETE는 ON DELETE CASCADE로 문항/분석까지 지울 수 있으므로 **삭제 SQL을 임의 제공/실행하지 않음**; 신규 ID별 종속 행 snapshot과 삭제 영향을 확정해 별도 명시 승인받아야 한다. 원천이 확정되기 전 복구 패키지 완성으로 보고하지 않는다.

## 5. DB 승인 패키지 C — R-CHART 도표 수치

**결정: 보류. 133문항 일괄 UPDATE/INSERT 값 원문 초안 불가 — 검증된 수치 payload 및 저장 계약 미확정.**

- raw_block NULL=도표 원천 부재라는 추론은 지지하지 않는다. `analysis-drain-export.mjs` pack은 bodyOk면 raw_block=null을 내보내고, 최초 스키마도 raw_block을 body_ok=false 원문 블록으로 설명한다. 정상 행 raw_block을 수치 저장소로 일괄 전용하지 않는다.
- 기존 원천 확인 경로는 있다. `scripts/csat/design-learning-audit/CHART_SUPPLEMENT.md`는 로컬 원본 도표 직접 확인, 값·단위·선지별 비교 계산, 공식답 불일치 시 needs_source, confirmed_at.note 기록을 요구한다. 분석 출력/검토 기록도 저장소에 존재하지만 **원천 수치 그 자체로 승인하지 않는다**. 예컨대 `chart-review-redo-20261011T072522359Z-R-CHART-2023-25.json`에는 이미지 렌더 불가·수치 직접 대조 미실행이 명시돼 있다. 그 verdict=pass를 이번 원천 검증 pass로 재사용 금지.
- `20261004234255_csat_chart_review_assets.sql`은 비공개 이미지·PDF SHA/쪽·관찰 영수증·분석 결속을 정의하지만 현재 자산 허용 대상은 **학평**이다(`csat_is_hakpyeong_item`). 평가원 802 확대의 도표를 그 경로에 그대로 넣을 수 없다. 파일의 PENDING 주석으로 실제 DB 미적용/적용을 단정하지도 않는다.

필요 원천: 대상 ID별 올바른 PDF(형 포함)·SHA/쪽/도표 영역, 축·범례·범주·수치·단위·빈 셀/각주, 독립 재독 결과 및 선지별 계산·공식 정답 대조. 이미지에서 값을 못 읽으면 needs_source 유지. 133 전체에 이 원천이 있다는 증거는 없다.

담당: platform-goal의 Claude가 기존 로컬 PDF/도표 자산을 조사·수집하고, goal-data 재개 담당이 출처 결속 수치 manifest를 작성한다. goal-data-independent는 원본 직접 대조, data-contract는 기존 저장 모델 재사용 가능성/평가원 허용 범위를 검토한다. 새 저장 컬럼·표 또는 학평 게이트 확대가 필요하면 별도 migration 승인 패키지다. 수치 manifest 없이 raw_block을 AI 설명으로 메우지 않는다.

Claude 추가 조회 필요(먼저 첫 SELECT로 테이블 존재 확인, 없는 표를 이어서 조회하지 않음):

```sql
SELECT to_regclass('public.csat_review_visual_assets') AS assets,
       to_regclass('public.csat_review_visual_heads') AS heads,
       to_regclass('public.csat_review_visual_analysis_bindings') AS bindings;
SELECT exam_id,count(*) AS chart_n,
       count(*) FILTER (WHERE raw_block IS NULL) AS raw_null_n
FROM public.csat_items WHERE type_id='R-CHART' GROUP BY exam_id ORDER BY exam_id;
SELECT id,exam_id,no,body_ok,length(passage) AS passage_chars,
       length(raw_block) AS raw_chars
FROM public.csat_items WHERE type_id='R-CHART' ORDER BY exam_id,no;
-- assets/heads가 존재할 때만:
SELECT a.item_id,a.id,a.pdf_sha256,a.pdf_page,a.image_sha256,
       a.source_input_hash,(h.asset_id=a.id) AS current_head
FROM public.csat_review_visual_assets a
LEFT JOIN public.csat_review_visual_heads h ON h.item_id=a.item_id
ORDER BY a.item_id,a.created_at;
```

영향 행: 전체 도표 133은 제공 보고값이고 이번 승인 대상 행 수는 **미확정**. 학평/평가원·기존 자산·결손을 나눈 뒤 소량(최초 최대5문항)으로 승인 범위를 고정한다. 사전 검증은 원본/현재 입력/자산 SHA 일치·중복·실스키마 확인, 사후는 저장값 전량 독립 재독·계산/정답 일치·입력 해시/분석 재검수·제외 해제 관문 확인이다. 복구는 선택한 저장 방식과 기존 head/값 snapshot에 따라 작성한다. 기존 visual 자산은 불변·삭제 금지 트리거가 있으므로 DELETE 복구를 가정하지 않는다. 현재는 최종 DML·행수·복구 SQL 모두 원천/저장 계약 대기이며 미실행이다.

## 6. 담당·다음 순서

| 순서 | 실행 담당/기존 작업 재사용 | 다음 결과·차단 |
|---:|---|---|
| 1 | platform-goal + goal-data-independent / **T-0097 COMPLETED와 수용 증거 재사용** | R3 규칙 수용·반박 정정 확인 완료. T-0097 재시작·새 독립 검증 세션 자동 생성 불필요 |
| 2 | platform-goal 조정, 기존 goal-data 작업공간 재개 담당 | 802 selection·해시·제외 목록 및 export/검증 범위 준비. 안정 5개 첫 배치 → 관문 후 계속, R2 제3 판정 → E2 v2.2 소배치 순. 종료된 vocaflow-5e 자동 재시작/소유권 인수는 하지 않음 |
| 3 | platform-goal의 Claude + data-contract / 기존 DB 소유권 우선 | A의 원본·DB SHA·관련 행/트리거 재조회 → 독립 대조 → **완결 패키지를 사용자에게 제시** → 승인 후 권한 있는 Claude가 적용/검증. 본 T-0100은 db_scope=none 유지 |
| 4 | 같은 원천 담당·data-contract | B의 PDF 회차 M2609/M2709 식별 우선. 확인 뒤 기존 ingest/reflow로 preview·SQL·복구 완성 → 사용자 승인. 802 확대를 이 적재 대기로 전부 막지는 않음 |
| 5 | 같은 원천 담당 + goal-data-independent | C 원본 수치·자산 실태 조사 → 저장 계약 → 최대5 소량 승인 패키지 → 승인/실검증 후 대상 도표만 제외 해제 |
| 병행 | **T-0096 goal-engine / goal-engine-claude** | REVIEW 상태. E3·R2 관찰 제한, 다른 지문·다른 날 판정 수용/통합은 이 기존 TASK 몫. 매핑 연구 완료로 제품 완료를 대신하지 않음 |
| 별도 | **T-0098 authored-ai-review(READY)** | 창작18세트 AI 원장 작업 범위를 유지. 기출 복구·도표·매핑을 그 TASK의 DB 승인에 끼워 넣지 않음 |

현재 큐에서 802 실행/이 3건 복구 전용의 동일 TASK는 확인되지 않았다. 이 문서는 담당 **제안/순서 결정**이며 새 담당이 실제 수신·실행했다고 주장하지 않는다. 조정자는 기존 owner·공간·세션의 소유권과 범위를 확인해 이어 붙이고, 공동 추적이 필요할 때만 중복 없는 실행 TASK를 등록한다. T-0100은 이 결정 산출까지만 제출한다.

## 7. 검증 결과와 남은 것

- **confirmed / 수행:** 지정 커밋 문서·coverage·export/분리/결합 코드 교차 확인, T-0097 수용 상태·정정 대조, main 스키마/원천 정책·export/검증기 읽기, 2023#38 파서 읽기 전용 재현, M2709 원천 후보 파일 존재·SHA 및 기존 수집 원장 회차 불일치 확인. 원문 텍스트·비밀값은 이 문서에 싣지 않았다.
- **unclear / 미실행:** DB 사실 독립 재조회, SQL 문법의 실제 PostgreSQL 검증·DML·트랜잭션 복구 시험, PDF 내용/도표 직접 대조, 802 새 배치 실행, v2.2 보정, 사람 Gold/권리/학생 측정 타당도. 문서 L1 정적 확인 외 제품 테스트·E2E는 범위상 실행하지 않았다.
- 이 리뷰의 pass는 T-0100의 **결정·패키지 초안 또는 원천 공백 명시** 수용 기준 충족만 뜻한다. DB/L4 실행, 제품 통합, 전체 802 품질 검증 또는 원천 복구의 pass가 아니다. Git 커밋·통합·원격 sync는 요청대로 수행하지 않았다.
