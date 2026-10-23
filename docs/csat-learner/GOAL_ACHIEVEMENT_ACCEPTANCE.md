# 목표 계획·성과 독립 검증 / SQL 승인 패키지

2026-10-23 · Codex · **rev2 개발 DB 적용 완료, 전체 제품 수용은 별도**.

## 현재 상태 — 승인 SQL 적용 완료

**추가 P1 발견 / 보정 SQL 미적용:** 실환경의 목표 버전 충돌에서 rev2의 `40001`이 반복 트랜잭션을 유발했다. 3000 HTTP 동시 요청은 200/500, 3117에서는 한 요청만 저장되고 충돌 요청은 시간 초과됐다. 실제 RPC 두 요청에서도 같은 현상을 관측했다. 성공한 목표 저장과 PLAN v1 생성 외의 전체 종단 수용은 통과하지 않았다. [Supabase 공식 원인·대응](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b)은 PostgREST14의 사용자 정의40001 무한 재시도를 설명한다. 이 문제를 HTTP 모듈 재로딩 오류와 혼동하지 않는다.

### rev3 최소 보정 — 별도 승인 대상

원문: `supabase/migrations/20261023142000_csat_goal_budget_conflict.sql`.
SHA256: **`29fe915485f0fc772262228776a1ce9cce1fefd12109c83e8cc5fdc7c5577b4c`**.

설치된 writer의 `pg_get_functiondef` MD5 `555ce3e705ec0432a12f389dfcc91072`와 정확히 일치할 때, 아래 한 구문만 바꾼다. 다른 정의는 거절하며 이미 같은 보정이 적용된 재실행은 무변경이다. CREATE OR REPLACE로 함수 identity·소유자·실행권을 유지하고 행·RLS·트리거·advisory lock·멱등키·CAS 로직·기존 SQL 원문은 변경하지 않는다. rev2 적용 승인이 이 새 SQL의 적용 승인으로 확장된 것은 아니다.

```sql
-- supabase/migrations/20261023142000_csat_goal_budget_conflict.sql
-- PROPOSED: separate user approval required. Preserve the installed rev2 migration.
-- Change only the business-conflict SQLSTATE; retain rows, locks, RLS, grants and function identity.
-- 40001 triggers PostgREST transaction retries. PT409 returns a non-retryable HTTP 409.
do $patch$
declare
  definition text := pg_get_functiondef('public.csat_map_goal_budget_set(uuid,smallint,smallint,text,date,uuid,jsonb,bigint)'::regprocedure);
  old_raise text := 'raise exception ''goal_changed'' using errcode = ''40001'';';
  new_raise text := 'raise exception ''goal_changed'' using errcode = ''PT409'';';
begin
  -- Accept exactly the observed rev2 definition or its already-patched equivalent.
  if md5(definition) = '555ce3e705ec0432a12f389dfcc91072' then
    execute replace(definition, old_raise, new_raise);
  elsif md5(replace(definition, new_raise, old_raise)) = '555ce3e705ec0432a12f389dfcc91072' then
    null; -- Exact replay: no DDL or data writes.
  else
    raise exception 'goal_budget_writer_definition_changed' using errcode = '22023';
  end if;
end
$patch$;
```

실제 SQL을 실행한 격리 PGlite에서 보정 전 앱 경계2 FAIL/7 PASS → PT409 지원 후9 PASS. 정확한 보정 재실행·정의 변조 거절·PT409 원본 반환·이력/역할 검사를 포함한다. 저장 안전20·PLAN reader4·HTTP reload3까지 **36/36 PASS**. 단일 PGlite 연결로 공유 PostgreSQL 동시성을 통과했다고 해석하지 않는다. 승인 후 checkpoint → 함수 원문/권한 재확인 → 이 원문 적용 → 원문 SHA·단일 구문 diff·권한/행 보존 → 실제 HTTP/RPC 동시성·1440/1280 PLAN v2 수용을 재실행한다. 원복으로40001을 복구하면 재시도 결함이 재발하므로 보정 앱을 되돌려도 PT409는 유지한다.

### 실환경 검증 경계 / 계정 정리

`apps/web/scripts/verify-goal-budget-live.mts`는 실제 Supabase 인증·SSR 쿠키·Next·DB를 사용한다. 원문/소스 해시와 검사별 결과만 기록하고 자격 증명·요청 헤더·추적은 저장하지 않는다. 병렬 HTTP와 `--rpc-race`의 별도 범위를 보고하며 둘을 대체해 PASS하지 않는다. rev3 승인 SHA 플래그 없이는 추가 쓰기를 시작하지 않는다. 목표/PLAN 보존 비교는 모든 페이지의 기존 id별 원문을 확인해 다른 세션의 합법적인 추가 행을 실패로 오인하지 않는다.

- 실제3117 Next: 목표85/저장등급2/시험종류/목표일/주간120분의 한 버전 저장, PLAN v1의 목표 id 결속까지 PASS. 동시 변경 이후 재확정·1440/1280·RLS 종단은 미도달. 기존 격리 Chromium4 PASS를 전체 인증 흐름 PASS로 바꾸지 않는다.
- 05:21 UTC 재조회: 기존 비QA 목표2행·PLAN2행 해시 `0ca16043e8f2487aea802ce8552eebb8` / `194d23bb3cddf057a4a0bf9a0dd4def3`가 최초와 동일. 자체 합성 QA8계정은 전부 suspended+banned이며 이력은 보존했다. 초기 검증 실패 계정도 정리했다.
- Playwright 예외의 다중 행 로그에 검증 계정 쿠키가 포함된 출력1회가 있어 해당 계정을 중지하고 세션을 폐기했다. 이후 예외 첫 줄만 출력하고 요청 로그를 출력하지 않는다. 실사용자 자격 증명 출력은 없었다.
- 추가 HTTP reload 결함도 독립 재현해 명시적 `goal_changed` 코드가 있는 Error만409로 분류했다. 단순 메시지·다른 장애는500을 유지한다. 해당3검사는 수정 전1 FAIL → 수정 후3 PASS다.
- 전체 scripts 타입 검사는 메모리 부족으로 실패(통과 아님). 변경 경계·두 SQL 회귀 파일과 검증 스크립트의 범위 타입 검사, 변경 TS6파일 lint는 통과했다. 첫 추가 PGlite 실행도 메모리 부족으로 중단했고, 자체3117 서버를 종료한 뒤 fork1 순차 재실행에서36검사를 통과했다. 공용3000 PID15488은 그대로이며 `dev:check` PASS다. 에이전트 설정13검사·diff 공백 검사도 통과했다.

사용자가 “조치하여 진행해줘.”로 승인 루트 훅 수정을 허용했다. 기존 중복 SQL 후보 중 목표 파일의 명시적 승인 JSON에 작업 경로·파일 경로·사용자 승인 근거·원문 SHA가 모두 일치하는 후보가 정확히 하나일 때만 선택하도록 수정했다. 미승인·복수 승인·해시/경로 불일치·잘못된 승인 기록은 계속 차단한다. 단일 파일의 기존 승인 계약과 P1 차단도 유지한다.

- 수정/설치: `C:/Users/Administrator/.codex/hooks/codex-review-root.mjs`, 회귀 `__tests__/codex-review-root.test.mjs`. **19/19 PASS**, skip0. 실제 여러 워크트리에서도 현재 승인 경로 `D:/workspace/Vocaflow-main-serving`을 선택했다. 사전 파일은 각각 `.bak-goal-budget-20261023`에 보존했다.
- 훅 SHA256: 변경 전 `b2fdcea424ec5ac8b1518e7519d96857d6549bc34912d873bfdec18e8087070c`, 변경 후 `0e382e9bc3e707aa5645d786013b300084d4166e620fe6803c33f28b131a3934`. 머신 로컬 훅 수정이며 프로젝트 Git에 훅 파일이 포함된 것은 아니다.
- `apply_migration(name=csat_goal_budget)` 성공. **실제 서버 이력 버전 `20261023043453`**. 저장소 승인 원본 `20261023090000_csat_goal_budget.sql`과 DB 이력 statements의 SHA256이 모두 `fbd370acc6d2c2eba552678de101079fff26a589629b38a4a800d83ba47181ae`로 정확히 일치한다. 파일 버전과 MCP가 부여한 이력 버전을 혼동하지 않으며, 이 SQL을 다시 적용하지 않는다.
- 적용 직전 04:33:18 UTC / 사후 04:35:10 UTC: 기존 목표2행·PLAN2행·현재 목표 내용, RLS 정책·트리거·옛 writer 정의의 해시가 모두 동일했다. 새 nullable JSONB 열의 DEFAULT는 없으며 기존2행은 NULL이다. 두 CHECK는 validated=true, goal/PLAN RLS=true다. 새 두 함수는 anon/authenticated 실행 불가·service_role 실행 가능이고 고정 search_path를 확인했다.
- 설치된 실제 validator의 SQL NULL·0분·상한·정상 요일·음수·소수·요일 합계 초과·요일 길이 오류·중복 TASK·추가 키·필수 키 누락·단위0 등 **12/12 PASS**. 검증 중 학습자 행 변경 없음.
- checkpoint `20261023090000_goal_budget_rev2_apply_after_root_fix`: before04:33:33 UTC→after04:35:09 UTC. diff는 회전 bloat 표본 교체·연결 수·checkpoint 자체 관측 표 증가·시간 경과 지표다. 목표/PLAN 데이터의 직접 해시 검증은 별도로 통과했다.

아래 첫 시도 차단/승인 대기 표기는 당시 이력이다. 현재 사용자 승인과 DB 설치는 완료됐으며, 전체 인증 흐름·실제 독립 학습 순환·최종 main 통합은 각각 실제 검증 결과에 따라 구별한다.

## 첫 적용 시도 — 훅 차단 이력(이후 해소)

사용자가 이 대화에서 rev2 SQL 적용을 **“승인”**했다. 승인 SHA는 `fbd370acc6d2c2eba552678de101079fff26a589629b38a4a800d83ba47181ae`이며 파일 원문은 변경하지 않았다. **사용자 승인 완료 / DB 적용은 사전 훅 차단으로 미실행**이다. 아래 ‘승인 대기’는 패키지를 제시했던 당시 상태다.

- 사전 확인 04:21:25 UTC: 새 열/함수 없음, 충돌 없음, 다른 active 연결0. 목표2행·PLAN2행과 현재 목표·정책·트리거·옛 writer 정의의 해시를 기록했다.
- `apply_migration(name=csat_goal_budget)` 요청은 PreToolUse가 거절했다: 같은 SQL이 `D:/workspace/Vocaflow-main-serving`과 `D:/workspace/vocaflow-n3-review`에 있어 어느 `.agent-goal.md`를 승인 근거로 선택할지 정할 수 없다는 이유다. DB에서 실행 중인 DDL이나 새 객체는 확인되지 않았다. 현재 작업트리의 `.agent-goal.md`에 실제 사용자 승인과 SHA를 기록했지만, 현행 훅은 이 기록을 읽기 전에 중복 워크트리를 거절한다.
- 사후 확인 04:25:55 UTC: 열/두 함수 여전히 부재. 목표2행·PLAN2행·현재 목표·RLS 정책·트리거·옛 writer 정의 해시 모두 사전과 동일하다. 목표 해시 `0ca16043e8f2487aea802ce8552eebb8`, PLAN 해시 `194d23bb3cddf057a4a0bf9a0dd4def3`.
- checkpoint 라벨 `20261023090000_csat_goal_budget_rev2_approved_20261023`: before 04:21:36 UTC, after 04:25:54 UTC에 NOT_APPLIED 사유로 닫았다. 차이는 bloat 회전 표본 교체와 시간 경과 지표뿐이다. 사후 checkpoint를 적용 성공으로 해석하지 않는다.
- 차단 원문 위치: `C:/Users/Administrator/.codex/hooks/codex-review-root.mjs`의 중복 roots 거절과 `codex-review-gate.mjs`의 적용 직전 승인 확인. 다른 작업트리·승인 SQL·훅을 변경하거나 다른 경로로 DDL을 실행하지 않았다.

해결 제안(미적용): 중복 SQL의 후보 중 **명시적 적용 경로·사용자 승인·일치하는 SHA를 가진 승인 기록이 정확히 하나일 때만** 그 작업 루트를 선택하고, 승인 부재/해시 불일치/복수 승인/경로 불일치는 계속 차단한다. 이 훅 수정은 별도 허용이 필요한 실행 환경 변경이다. SQL 자체의 추가 승인은 필요하지 않다. 현재 적용·설치 후 검증·실제 인증 종단·DB 동시성·최종 main 통합은 NOT_RUN/대기다.

검토 기준: 계획 `01db99074`, Claude 성과 `a6eead261`(`feat/goal-outcome`). 두 커밋을 후보 브랜치 `feat/goal-achievement-20261023`에서 결합했다. 원본 브랜치 `feat/goal-outcome`·`feat/goal-plan`과 커밋은 보존했다. 보존 계획 `c44f41a5c`의 `replanOf`를 추출했고 그 브랜치의 다른 주간 엔진은 들여오지 않았다.

이 문서는 Claude에 전달할 반례·수용 계약이기도 하다. 별도 Claude 세션의 실제 수신·응답은 확인되지 않았다. 공동 수용을 완료했다고 간주하지 않는다.

후속 점검 중 Claude 브랜치가 `9f23f9b9b`로 전진한 것을 확인해 같은 후보에 결합했다. 네 상태 문구·재처방 비교 패널을 보존하되 독립 적격성·최종 미확인·단일 `goalLearning` 계약에 연결했다. 후속 P1도 보완했다: 이전 PLAN을 현재 예산으로 계산하던 비교는 저장 목표 버전 예산을 사용하고, 이전 목표 불명은 비교 불가로 처리한다. 이전 단계가 현재 단계 링크를 빌리지 않도록 비교 전용 배분은 실행 링크를 비운다. 새 시험의 동일 날짜 문자열 비교 누락은 입력/PLAN 시각 비교로 고쳤다. 달력/예산이 달라졌는데 배정 총량만 같다는 이유로 ‘변경 없음’이라 표시하지 않는다.

## 독립 판정과 최소 재현

P0 발견 없음. 원커밋에서 반례7개가 실패했으며 수정 후 통과했다. P1 묶음은 다음과 같다. 재현 정본: `apps/web/src/lib/csat/map/v62/__tests__/goal-outcome.audit.test.ts`.

| P1 | 최소 반례 / 원래 결과 | 수정 수용 기준 |
|---|---|---|
| 재풀이·응시 조건 | 목표80, 첫 DX 행이 mode=retake/raw90 → reached | retake 제외. live·분석 적격·입력 신뢰를 확인하고 모드 미상은 미확인 |
| 기존 노출 누락 | DX 이전에 G2/문제지/공유 지문을 봄 또는 reader 실패 → reached | 기존7조회 원장 재사용. 본 DX 제외, 과거 노출은 제외, 시간/조회/잘림 불명은 미확인 |
| 선후/기준 시각 | 목표2026-10-01 15:30Z(서울10-02), 응시10-02 → 후속 / 미래 기록 포함 | 서울 같은 날은 순서 미확인. injected asOf 뒤 응시/입력은 제외 |
| 상충하는 첫 풀이·전후 비교 | 목표 전/후 동일 시험지70→90 → 비교 분기 도달 불가 | 재풀이 점수 관찰만 별도 허용. 독립 후속 평가·인과 효과로 승격 금지 |
| 점수와 최종 달성 | 목표80/2등급, 기록90/3등급 → 유지 확인 | 시험별 점수 충족과 등급 미충족을 함께 표시. 최종 평가 조건 없으면 미확인, 자동 유지 금지 |

추가 가드: 원점수 범위/분석 미준비·나중의 다른 종류가 유효 기록을 가리지 않음·최종 달성 미확인을 고정했다. 원커밋에서 이미 옳았던 다른 시험지 변화량 금지·저장 등급 비교·TASK와 시험 근거 분리를 유지했다.

| 사용자 확인 항목 | 현재 판정 |
|---|---|
| 목표 설정 이후 유효 기록 | 목표 생성일의 서울 다음 날짜부터, asOf 이전 입력/응시만 |
| 종류·재풀이 제외 | 목표 범위의 최신 기록 우선, live/첫 풀이 적격. 다른 종류·retake 제외 |
| 다른 시험지 난도 | 동등화 미지원, 변화량 미계산; 기준 점수의 단일 관찰만 표시 |
| 기존 앱 노출 | 기존 G2/삭제 세션/함정/문제지/큐/DX와 공유 지문 검사, 불명은 미확인 |
| 동일 시험지 비교 | 독립 평가와 분리한 재풀이 관찰만 허용 |
| 점수 기준 vs 최종 달성 | 별도 필드. 현재 최종 달성은 항상 unconfirmed |
| 등급 | 저장값1~9만 비교, 점수 변환 없음 |
| TASK | 활동 사실만, 점수/목표 달성률 근거 아님 |
| 부족·비교 불가 | 미확인/비교 불가. 오류를0/달성으로 대체하지 않음 |

앱 밖 사전 노출을 증명할 수 없다. 복습 큐에 최초 생성시각이 없어 관련 문항/지문은 미확인으로 처리한다. 최신 기록이 부적격이면 과거 성공 기록으로 현재 성공을 대신하지 않는다.

## 통합 계약 / Claude 수용 지시

`goalLearning`이 goal/id·saved PLAN/version/history·TASK 근거·budget/source·today/week schedule·outcome·revisions·nextReview를 한 번 계산한다. 세부 계약은 [GOAL_ACHIEVEMENT](./GOAL_ACHIEVEMENT.md).

- 기존 G2/PLAN이 독립 근거·TASK 단계/수량을 판정한다. `replanOf`·`planDrift`가 이전 PLAN과 변경 이유를 비교하고 기존 `scheduleChanges`가 브라우저 이전 일정과 일시 비교한다. 새로운 중복 일정/재처방 엔진을 만들지 않는다.
- 수행 후 서버 갱신에서 제안을 재계산한다. 단계/자료/목표가 바뀐 PLAN은 Workspace의 기존 재확정 관문을 따른다. 확정 전 실행을 열거나 이전 버전을 덮지 않는다. 실제 PLAN POST v1→v2 이후 이력v1을 보존한다.
- 단일 시험은 ‘이 시험 기록은 설정한 목표 점수 기준을 충족했어요’라는 관찰이다. 정확한 최종 평가 대상·시점·비교 조건을 현재 목표 버전에 결속하는 계약이 없어 최종 달성은 미확인이다. 원점수 차이/해소 수/수행률을 달성률로 바꾸지 않는다.
- 내부 목표일 역산은 허용한다. **‘목표일까지 N일 남음’ 등 카운트다운 문구는 제거**한다. 화면은 목표일·주간 계획·다음 점검 제안일을 표시한다.
- 주간 일정은 현재 PLAN/예산의 자동 갱신 제안이다. 영속 달력 스냅샷/확정/변경 이력은 미구현이며 기존 PLAN 이력으로 대체됐다고 말하지 않는다.

## SQL 원문·영향·승인 대상

파일: [20261023090000_csat_goal_budget.sql](../../supabase/migrations/20261023090000_csat_goal_budget.sql).

- 검토 전 SHA256: `5f812df94bda6a91dd4e3468143e7e0664ee161b17d695622664e44e24a292a9`.
- **현재 승인 요청 rev2 SHA256: `fbd370acc6d2c2eba552678de101079fff26a589629b38a4a800d83ba47181ae`**.
- 변경2개: 주간0분 허용; NULL 예산 목표 저장/해제도 새 writer의 expected-version 검사 사용. 원본을 이미 승인한 것으로 간주하지 않는다.
- 설치 객체: nullable JSONB 열1개·CHECK2개·검증 함수1개·service-role 전용 새 writer1개. 새 표/기존 행 수정·삭제/기존 함수 교체/트리거 해제 없음. DEFAULT 없음 → 기존 목표는 NULL로 유지한다. 기존 PLAN/목표 id·참조·순서 보존.
- 주간0~10080, 요일7칸0~1440·합계≤주간 또는 JSON null, 단위1~240, 우선 TASK 문자열/중복 금지/최대21. SQL은 TASK 정본 소속까지 검사하지 않으며 서버 API가 비보류 TASK id를 검증한다. 키 추가는 거절한다.
- SQL NULL 예산은 허용한다. 비NULL 예산에는 시험/목표일이 필요하다. 기존 `weekly_hours`0~80시간은 수정하지 않고 UI 입력 제안으로만 사용한다. 목표 버전의 명시 예산이 우선한다.
- 기존 본인 SELECT RLS/추가 전용 트리거는 유지한다. 새 두 함수는 PUBLIC·anon·authenticated EXECUTE를 회수하고 service_role만 부여한다. writer는 SECURITY DEFINER·고정 search_path(public,pg_temp). public CREATE는 클라이언트에 없다. p_user는 인증된 서버 경로가 공급하며 클라이언트의 직접 사용자 선택 호출은 허용하지 않는다.
- 기존 writer/PLAN과 같은 `map_goal:<user>` advisory transaction lock을 쓴다. 동일 사용자/키 재전송을 최신 버전 검사보다 먼저 처리하고 새 요청은 max(id)와 expected id를 비교한다(불일치40001→API409). 점수 현재값+새 불변 목표 버전은 한 트랜잭션이다.
- SQL 자체 멱등성은 user/client_key만 비교한다. **동일 키의 다른 본문 차단은 서버의 저장 전/후 불변 행 대조 계약에 의존**한다. 직접 service_role 호출자는 이 책임을 가져야 한다. 실제 두 연결 경합은 미검증이다.
- 기존 legacy writer는 그대로 남는다. 미설치 동안 무예산 목표만 기존 writer로 저장한다. 설치 후 새 writer를 사용하므로 예산 해제도 CAS를 우회하지 않는다. 구클라이언트/직접 legacy service 호출까지 새 CAS가 강제하는 것은 아니다.
- ALTER TABLE은 잠금과 CHECK 검증이 필요하다. 실제 목표 행 수는 아래 시점2행이나 적용 직전 재확인한다. 새 이름이 생겼으면 생성은 실패하며 기존 함수를 덮지 않는다. migration 파일의 재적용은 지원하지 않으며 승인 후 이력으로 한 번만 적용한다.
- 비삭제 복구: 앱을 기존 writer 경로로 복귀하고 새 열/이력을 보존한다. 추가 예산 동작은 비활성화한다. DROP/데이터 삭제 롤백은 이 승인 범위가 아니다.

읽기 전용 개발 DB 감사: **2026-10-23T03:31:27.936974Z**. goal_version2행/PLAN2행, planning_budget 열·새 validator/writer 모두 부재. goal/PLAN 본인 SELECT RLS(auth.uid())·goal UPDATE/DELETE 거절 트리거 유지. legacy writer EXECUTE anon=false/authenticated=false/service_role=true, public schema CREATE anon=false/authenticated=false. `to_regprocedure`로 새 객체 충돌 없음 확인. 행 본문·개인정보·비밀값은 패키지에 담지 않았다. 이 관측은 적용 시점 보장이 아니므로 승인 뒤 다시 확인한다.

**승인 전 개발 DB 적용 금지.** 승인하면 이 SHA 원문에 대해 checkpoint → 객체/권한/충돌 재확인 → migration 적용 → 이력/SHA·기존 행/PLAN·RLS/함수 권한 검증을 수행한다. 실제 학습자 쓰기 시나리오는 별도 합성 검증 계정에서 수행하고 기존 학습자 데이터를 변경하지 않는다.

## 검증 결과와 통합 게이트

| 범위 | 결과 |
|---|---|
| 원커밋 최소 반례 | 7 FAIL을 확인; 수정 후 회귀10 PASS |
| 관련 단위/reader/서버 저장/렌더링/재처방 | 164 PASS(13파일) |
| 실제 SQL+교수/독립 평가/G2/PLAN 재확정 | PGlite15 PASS; 위 합계와 별도 |
| 웹/스크립트 타입, 변경 TS lint | PASS |
| Chromium1440/1280 | 4 PASS(일정/성과·재처방); 같은 SQL 읽기에서 나온 목표id·PLAN 버전/이력과 일치 |
| 공유 개발 DB rev2 적용 | **PASS**, 실제 서버 이력/SHA·보존·권한·validator12 확인 |
| 인증 Next 전체 흐름 | **PARTIAL / FAILED**: 목표 저장·PLAN v1 PASS, 충돌 요청 시간 초과; 재확정 이후 미도달 |
| 실제 PostgreSQL 두 RPC 동시성 | **FAILED**: rev2의40001 재시도; rev3 보정은 승인 대기·미적용 |
| 실제 학습 효과·최종 평가 대상 결속·영속 달력 이력 | 미수용/미구현 경계 유지 |

재실행: 기존 `reassess-plan.pglite.test.ts` → `build-goal-schedule-harness.mts` → `goal-schedule.browser.spec.ts`. 엔진/시험/SQL SHA가 바뀌면 SQL 프레임을 다시 생성해야 한다. Next navigation/analytics·브라우저 저장 API 응답은 명시적 대역이다. 인증된 전체 서비스 종단 PASS를 주장하지 않는다.

후속 변경 검증 중 병렬 실행1회가 메모리 부족으로 중단됐다(실패 기록). 순차 재실행에서 관련14파일179개 PASS를 확인했다. 중단을 PASS나 skip으로 바꾸지 않는다. 성과/재처방 전용 하네스는 `build-goal-outcome-harness.mts` → `goal-outcome.browser.spec.ts`이고 동일 단일 계약을 사용한다.

남은 수용은 실제 목표 저장→주간 예산→PLAN 확정→Workspace, 독립 수행→다음 단계/재확정, 새 시험→기준 충족/미확인, 목표/시간 변경→이력 보존, 오류→허위 결과 없음이다. 코드 후보는 최신 main을 기반으로 준비하되 이 게이트 전에는 최종 수용/로컬 main 통합을 완료했다고 보고하지 않는다. 공식 원격 통합 시에만 보호 CI·safe-merge를 사용한다.

## 승인 대상 SQL 전체 원문

```sql
-- supabase/migrations/20261023090000_csat_goal_budget.sql
-- PROPOSED: user approval required before applying to the shared development DB.
-- Additive only: no data rewrite, deletion, trigger removal, or legacy RPC replacement.
-- Rollback without deletion: switch application back to the legacy RPC; preserve new history.

create function public.csat_goal_budget_valid(p_budget jsonb)
returns boolean language plpgsql immutable set search_path = public, pg_temp as $$
declare n numeric; total numeric := 0; v jsonb;
begin
  if p_budget is null then return true; end if;
  if jsonb_typeof(p_budget) is distinct from 'object' then return false; end if;
  if (p_budget - array['weeklyMinutes','dailyMinutes','minutesPerUnit','priorities']) <> '{}'::jsonb then return false; end if;
  if jsonb_typeof(p_budget->'weeklyMinutes') is distinct from 'number' or
     jsonb_typeof(p_budget->'minutesPerUnit') is distinct from 'number' then return false; end if;
  n := (p_budget->>'weeklyMinutes')::numeric;
  if n <> trunc(n) or n < 0 or n > 10080 then return false; end if;
  n := (p_budget->>'minutesPerUnit')::numeric;
  if n <> trunc(n) or n < 1 or n > 240 then return false; end if;
  if not (p_budget ? 'dailyMinutes') then return false; end if;
  if p_budget->'dailyMinutes' <> 'null'::jsonb then
    if jsonb_typeof(p_budget->'dailyMinutes') is distinct from 'array' then return false; end if;
    if jsonb_array_length(p_budget->'dailyMinutes') <> 7 then return false; end if;
    for v in select value from jsonb_array_elements(p_budget->'dailyMinutes') loop
      if jsonb_typeof(v) <> 'number' then return false; end if;
      n := v::text::numeric;
      if n <> trunc(n) or n < 0 or n > 1440 then return false; end if;
      total := total + n;
    end loop;
    if total > (p_budget->>'weeklyMinutes')::numeric then return false; end if;
  end if;
  if jsonb_typeof(p_budget->'priorities') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_budget->'priorities') > 21 then return false; end if;
  for v in select value from jsonb_array_elements(p_budget->'priorities') loop
    if jsonb_typeof(v) <> 'string' or length(v #>> '{}') > 64 then return false; end if;
  end loop;
  if (select count(*) <> count(distinct value) from jsonb_array_elements(p_budget->'priorities')) then return false; end if;
  return true;
end $$;

alter table public.csat_map_goal_version add column planning_budget jsonb;
alter table public.csat_map_goal_version add constraint csat_goal_budget_valid
  check (public.csat_goal_budget_valid(planning_budget));
alter table public.csat_map_goal_version add constraint csat_goal_budget_scope
  check (planning_budget is null or (target_exam is not null and target_date is not null));

create function public.csat_map_goal_budget_set(
  p_user uuid, p_score smallint, p_grade smallint, p_exam text, p_date date, p_client_key uuid, p_budget jsonb, p_expected_goal bigint default null
) returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id bigint; v_latest bigint;
begin
  if p_user is null or p_client_key is null or p_score is null or p_score not between 0 and 100
     or (p_budget is not null and (p_exam is null or p_date is null)) or not public.csat_goal_budget_valid(p_budget)
  then raise exception 'goal_budget_invalid' using errcode = '22023'; end if;
  -- Same serialization as the existing goal setter and PLAN commits.
  perform pg_advisory_xact_lock(hashtext('map_goal:' || p_user::text));
  select id into v_id from public.csat_map_goal_version where user_id = p_user and client_key = p_client_key;
  if found then return v_id; end if;
  select max(id) into v_latest from public.csat_map_goal_version where user_id = p_user;
  if v_latest is distinct from p_expected_goal then raise exception 'goal_changed' using errcode = '40001'; end if;
  insert into public.csat_map_goal (user_id, target_score, updated_at) values (p_user, p_score, now())
    on conflict (user_id) do update set target_score = excluded.target_score, updated_at = now();
  insert into public.csat_map_goal_version (user_id, target_score, target_grade, target_exam, target_date, client_key, planning_budget)
    values (p_user, p_score, p_grade, p_exam, p_date, p_client_key, p_budget) returning id into v_id;
  return v_id;
end $$;

revoke all on function public.csat_goal_budget_valid(jsonb) from public, anon, authenticated;
grant execute on function public.csat_goal_budget_valid(jsonb) to service_role;
revoke all on function public.csat_map_goal_budget_set(uuid,smallint,smallint,text,date,uuid,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.csat_map_goal_budget_set(uuid,smallint,smallint,text,date,uuid,jsonb,bigint) to service_role;
comment on column public.csat_map_goal_version.planning_budget is 'Immutable scheduling allocation inputs for this goal version. Not a score/grade prediction or learning-effect estimate.';

```
