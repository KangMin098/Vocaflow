# 03 버전·출처·데이터/권한/학습지도 계약 (D0-C + I) — 2026-10-24 조사

읽기 전용 조사. DB 쓰기·코드 변경 없음. 모든 수치는 2026-10-24 `execute_sql`(SELECT) 재측정.

## 1. VERSION_PROVENANCE — DB 실측

| 사실 | 값 | 근거 SQL |
|---|---|---|
| csat_item_analyses 상태 분포(행) | published 6,087 · in_review 1,825 | `select status,count(*) from csat_item_analyses group by 1` |
| 문항별 **최신 version** 상태 | 총 3,595 문항 · 최신 published 3,409 · 최신 in_review **186** | `distinct on (item_id) … order by item_id, version desc` |
| 최신 in_review 186 중 과거 published 이력 있음 | **3** (나머지 **183** 은 published 이력 없음) | 위 + `exists(... status='published')` → **보고 수치 3/183 재확인 PASS** |
| in_review 행을 가진 문항(최신 여부 무관) | 1,208 (그중 1,025 는 published 행도 보유) | 동일 |
| csat_item_analyses.units_hash NULL | 3,806 행 | `count(*) where units_hash is null` |
| csat_item_skeletons.source_hash NULL | 0 / 2,299 | 동일 |
| csat_item_state 분포 | blocked 165 (in_review 상태값 없음) | `group by status` |

해석:
- "186 in_review" 는 csat_item_state 가 아니라 **analyses 최신 version 기준**이다. 문서에서 분모를 혼동하지 말 것.
- 183 문항은 학습자에게 보여 줄 published 분석이 **전혀 없다** → 화면 상태 `NO_ANALYSIS`(공개 분석 없음)로 분리 필요. 3 문항은 "이전 published 를 계속 보이되 새 버전 검수 중" 상태로, 학습자에게는 **마지막 published version 만** 노출해야 한다(in_review 노출 금지).
- units_hash NULL 3,806 행: 근거 문장 번호 결속(아래 §3) 불가 행. published 중 몇 행인지 분해는 미측정 → **NOT_VERIFIED/DATA_GAP**(후속 SELECT 1회로 확인 가능).
- 출처 해시 계층(현재 스키마): `csat_item_skeletons.source_hash`(원문) → `csat_item_units.input_hash/units_hash`(문장 분할) → `csat_item_analyses.version/units_hash`(분석) → 검수 원장(`csat_review_runs.reveal_*_hash`, `csat_independent_reviews.analysis_hash/units_hash`). **revision 컬럼은 csat 분석 테이블에 없다**(revision 은 `csat_ec_session_confirmation` 에만). "revision" 용어는 analyses.version 으로 매핑.
- **분석 버전 vs 강의 버전 독립성**: 강의(TTS/대본) 테이블은 DB 에 csat 접두로 존재하지 않음(위 컬럼 조회 결과에 lecture 없음). S1 `LECTURE_CONTRACT.md`·`LECTURE_CUES.json` 은 파일 기반. → 계약 제안: lecture_cue 는 `{item_id, analysis_version, units_hash}` 를 **참조만** 하고 자체 `lecture_version` 을 가진다. 분석 버전이 바뀌면 강의는 자동 무효화(`STALE_LECTURE`)되며, 강의 갱신이 분석 버전을 올리지 않는다. 현재 구현 근거는 **NOT_VERIFIED**.

## 2. 비교 결속 — 정적 증명 vs NOT_VERIFIED

코드 위치 주의: `projectV3Pairs` 는 **현재 메인 저장소 브랜치(design/replica-first, HEAD 8cd15b7b6)에 없다.** S0 worktree(`D:/workspace/Vocaflow-csat-v4-s0`, HEAD 9e73d7660)에만 있다:
- `apps/web/src/lib/csat/inquiry/compare-v3.ts:56-100` — 짝 상대가 open/held/missing 이면 분리, `currentOf` 주어지면 **양쪽** `units_hash` 와 `analysis_version` 이 결속값과 다르면 `changed` 로 보류.
- `apps/web/src/app/(app)/csat/item/[slug]/page.tsx:181-202` — 공개 형제 집합(openById)·골격 집합(knownIds)으로 상태 판정, `inquiryBinding` 전달.

| 항목 | 상태 |
|---|---|
| 서버 투영 필터(held/missing/changed 분리), 양쪽 hash/version 비교 | 정적 코드 + 순수 테스트(compare-v3.test 6 PASS, S1 FEATURE_DECISIONS §F06 인용) — **정적 증명** |
| 결속이 `source_hash`(원문) 까지 포함하는가 | **아니오** — units_hash·analysis_version 만. 원문 교정이 units_hash 를 바꾸지 않으면 미탐지 가능 → P1 |
| `binding` 이 없는 쌍(`b?.units_hash` 미정)은 drift 검사 통과 | 코드상 그렇다(조건부 검사) → 결속 누락 쌍이 열린다. P1 |
| 정상 로그인 세션 HTTP 응답·RLS 로 비공개 상대 원문이 실제로 차단되는가 | **NOT_VERIFIED** (하네스는 fixture·메모리 shim) |
| 34번 쌍 0 개 | 유지(S1 기록) |
| `csat_items_public` 컬럼 ACL | authenticated: answer,exam_id,grade,high_score,id,in_scope,no,organizer,points,section,type_id (stem 제외), anon 권한 없음 — `information_schema.column_privileges` 실측. 단 **`answer` 가 authenticated 에 열려 있음** → 풀이 전 정답 노출이 의도인지 결정 필요(P1, 설계 확인 사항). 실제 인증 세션 응답은 NOT_VERIFIED |

## 3. 제안 계약

1. **근거 결속(지문·선지)**: evidence = `{item_id, analysis_version, units_hash, unit_id(문장 위치), unit_text_sha256, option_no?}`. 표시 시 현재 units_hash 와 다르면 하이라이트 대신 `VERIFICATION_FAILED`(근거 위치 재확인 중). 선지 근거도 동일 해시 체계. 문장 번호는 해시 없이 단독 사용 금지.
2. **로컬 PDF**: 로컬 문제지는 개발 서버 전용(커밋 8cd15b7b6 "개발 서버 로컬 문제지 기본 로드"). 계약: PDF 파일 sha256 + 페이지/크롭 좌표를 skeleton.source_hash 와 함께 기록, 운영 배포에 파일 미포함, 권리 미확인 시 평가원 게시판 링크(page.tsx:205 `KICE_ARCHIVE_URL` 경로)로 대체. 크롭 정확성 근거는 **DATA_GAP**.
3. **비교 쌍 공개 조건(AND)**: 양쪽 문항 공개 접근 open · 양쪽 최신 published analysis_version 이 결속값과 동일 · 양쪽 units_hash 동일 · 양쪽 source_hash 결속(신규 추가) · binding 누락 시 비공개 · 비교 주장(shared/differences) 검수 기록 존재. 하나라도 실패 → held/missing/changed/unreviewed 로 구분 표시, 숨긴 수만 노출.
4. **학습지도 진입/복귀**: `returnContext={map_task_id, workspace_id, origin_path, ctx_hash}` 허용 목록 파싱(S0 `withMapReturn/parseMapReturn` 재사용 후보). 잘못된 맥락은 거부하고 기본 지도로.
5. **활동 vs 숙달 분리**: 기록 종류 ACTIVITY / EXPLANATION_CHECK / SELF_REPORT / INDEPENDENT_EVIDENCE / MASTERY_DECISION 을 저장·조회·표시에서 혼합 금지. 강의 완주·탐색·클릭·자기보고는 숙달 승격 불가(S1 S2_READINESS:16).
6. **TTS vs 듣기 원음**: `audio_kind ∈ {LECTURE_TTS, EXAM_ORIGINAL}` 필수, EXAM_ORIGINAL 은 권리·전사·화자·시간 결속 없으면 재생 불가. TTS 로 평가 원음 대체 금지.
7. **화면 상태**: NO_DATA(골격/분석 없음 — 183 문항 등) · NO_PERMISSION(인증/공개 범위 밖) · VERIFICATION_FAILED(해시 불일치) · STALE(새 버전 검수 중, 이전 published 표시) · HELD(검수 보류). 각 상태는 서로 다른 문구, 0 으로 삼키지 않음.
8. **유형별 콘텐츠 준비도**: type_id 별 `{skeleton 수, 최신 published 수, units_hash 보유 수, 비교 쌍 수(양쪽 결속), 원문 PDF 결속 수, 듣기 원음 수}` 를 DB 실측으로 산출해 준비도 판정. 이번 조사에서 유형별 분해는 미실행 → **DATA_GAP**.

## 4. BLOCKED_EVIDENCE 재확인 (해제하지 않음)

출처: S1 `FEATURE_DECISIONS.md` (§F02 L32-49, §F06 L124-140·L243, §F09 L193-214, §F10 L216-232), `S2_READINESS.md:5-16`.

| 기능 | 해제에 필요한 증거(전부) | 현재 |
|---|---|---|
| F02 원문·의미 | 원문 PDF 추출/크롭 정확성(파일 sha256·페이지 좌표) · 전문 선지 표시 · 가독성 화면 증거 · 정상 권한 접근 | BLOCKED |
| F06 실기출 비교 | 정상 로그인 HTTP/RLS 에서 비공개 상대 차단 실관측 · 양쪽 hash/version(+source_hash) 결속 · 비교 주장 내용 검수 기록 · binding 누락 쌍 처리 · 메인 브랜치에 코드 존재 | BLOCKED |
| F09 학습지도 | 정상 계정 map TASK/Workspace 진입→문항→동일 returnContext 복귀 왕복 · 활동 전후 mastery/independent evidence 불변 DB 전후 조회 | BLOCKED |
| F10 듣기 | 권리 확인된 실제 원음 1회분 · 전사/화자/시간 결속 · 실제 듣기 문항·선지 · 공개 권한 · 키보드 구간 탐색 | BLOCKED |

## 5. 우선순위
- **P0**: (a) 183 문항 무공개 분석 + 3 문항 in_review 신버전 — 학습자에 in_review 노출 금지 가드 및 NO_DATA 상태 필요. (b) 비교/근거 기능의 실제 RLS·인증 세션 검증 0건 — 검증 전 "권한 확인됨" 주장 금지.
- **P1**: 비교 결속에 source_hash 부재 · binding 누락 쌍 통과 · projectV3Pairs 가 메인 브랜치에 없음(S0 worktree 전용) · authenticated 에 `answer` 컬럼 노출 의도 확인 · units_hash NULL 3,806 행의 published 비중 측정 · 강의 version 독립 계약 미구현.
