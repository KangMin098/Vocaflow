---
description: DB 헬스 판정층 — db_health_metrics 스냅샷과 Supabase advisor 를 읽어 "지난번보다 새로 나빠진 것" 만 골라 db_health_findings 에 기록한다
argument-hint: [daily|weekly] (생략 시 daily)
allowed-tools: Read, Bash, Grep
---

# /db-health-audit — DB 헬스 판정층

> **수집은 DB 안, 판정은 DB 밖.** pg_cron 이 죽으면 그 안의 감시자도 같이 죽고, 죽었다는 사실조차
> 기록되지 않는다. 그래서 판정과 알림은 반드시 여기(Claude Code)에 있어야 한다.
>
> 수집기(`collect_db_health_metrics` · `collect_db_health_integrity`)에는 **임계값이 하나도 없다.**
> 사실만 적혀 있다. "6,255MB 가 위험한가" 는 증가율·원인·플랜에 달렸고, 그 판단이 이 명령이다.
>
> **인자**: `weekly` 면 §2 까지, 그 외(기본)는 §1 까지. 인자 없이 부르면 daily 다.

## 0. 무엇을 하지 않는가

- **고치지 않는다.** `VACUUM FULL` · `DROP INDEX` · `ALTER` 를 실행하지 않는다.
  조치 SQL 은 `db_health_findings.suggested_sql` 에 **문자열로** 넣는다. 실행은 사람이 승인한다
  (CLAUDE.md — 마이그레이션 자동 적용 금지).
- **모든 것을 보고하지 않는다.** 매번 같은 40줄을 쓰면 아무도 안 읽는다.
  **지난번 대비 새로 나빠진 것**과 **오래 방치된 것**만 쓴다.
- **상수로 판정하지 않는다.** 임계값은 시스템 자신의 설정(`statement_timeout`, cron `schedule`)이나
  자신의 이력(직전 스냅샷)에서 끌어낸다. 근거 없이 정한 숫자는 목표가 아니라 짐작이다.

---

## 1. daily 모드 (일 1회 · 저비용)

Supabase advisor API 를 부르지 않는다. 스냅샷 2개(최신 + 직전)만 읽는다.

### 1-1. 스냅샷 두 벌 읽기

```sql
with runs as (
  select distinct measured_at from db_health_metrics
  where axis <> 'integrity' order by measured_at desc limit 2
)
select m.measured_at, m.axis, m.metric, m.value, m.dims
from db_health_metrics m
join runs r on r.measured_at = m.measured_at
where m.metric <> 'table_size_mb'
order by m.measured_at desc, m.axis, m.metric;
```

수집이 안 돌았으면(최신 `measured_at` 이 26시간보다 오래됨) **그것이 첫 번째 발견이다** —
`cron:db-health-daily:stale` 로 critical 을 남긴다. 감시자가 멈춘 것을 감시자가 말해야 한다.

### 1-2. 용량 추세 (이 저장소에서 가장 중요한 축)

```sql
select measured_at::date as d, value as mb
from db_health_metrics where metric = 'db_size_mb'
order by measured_at desc limit 30;
```

- **하루 평균 증가(MB/일)** 와 **7일 기울기**를 낸다. 이력이 2점 미만이면 "추세 미확보" 로 적고 끝낸다
  (없는 추세를 지어내지 않는다).
- 테이블별 증가는 이쪽:

```sql
select dims->>'table' as t,
       max(value) filter (where measured_at = (select max(measured_at) from db_health_metrics where metric='table_size_mb')) as now_mb,
       min(value) as min_mb, max(value) - min(value) as delta_mb
from db_health_metrics where metric = 'table_size_mb'
  and measured_at > now() - interval '14 days'
group by 1 order by delta_mb desc nulls last limit 10;
```

**판정**: 특정 표 하나가 전체 증가의 절반 이상을 차지하면 그 표를 이름으로 지목한다.
"DB 가 커졌다" 는 조치로 이어지지 않지만 "`library_article_vocabularies` 가 2주에 +400MB" 는 이어진다.

### 1-3. cron — 임계값을 잡의 스케줄에서 끌어낸다

`cron_stale_max_hours` 의 `dims.jobs` 에 잡마다 `{schedule, active, hours_since_ok}` 가 있다.

- 스케줄이 `30 seconds` → 기대 주기 0.008h · `*/30 * * * *` → 0.5h · `0 18 * * *` → 24h · `0 18 * * 0` → 168h
- **`hours_since_ok > 3 × 기대 주기`** 이면 warning, **`> 10 ×`** 이면 critical.
- `hours_since_ok = null` 이면서 `active` 인 잡은 **한 번도 성공한 적 없다** — 이건 항상 critical이다
  (단, 1년에 한 번 도는 잡처럼 스케줄이 아직 안 온 경우는 detail 에 그렇게 적는다).
- `cron_fail_24h.dims.by_job` 의 `sample` 메시지를 그대로 evidence 에 싣는다.
  `job startup timeout` 과 `statement timeout` 은 원인이 다르다 —
  전자는 **background worker 고갈**(30초 주기 잡을 의심할 것), 후자는 **쿼리가 느린 것**이다.

지문: `cron:<jobname>:stale` · `cron:<jobname>:failing`

### 1-4. latency — 임계값을 statement_timeout 에서 끌어낸다

`slow_stmt_count.dims` 에 `timeout_budget_ms`(현재 120000)와 `top` 5개가 있다.

- `mean_ms > timeout_budget_ms × 0.5` 인 구문은 **곧 죽을 구문**이다. warning.
- `mean_ms > timeout_budget_ms` 면 이미 죽고 있다. critical.
- `total_min` 이 큰 것(누적 비용)과 `mean_ms` 가 큰 것(단발 위험)은 다른 문제다 — 섞지 않는다.

지문: `latency:stmt:<쿼리 앞 40자 해시 대신 함수명이나 테이블명>`

### 1-5. connections

- `conn_used_pct > 70` 또는 `idle_in_tx > 0` 가 **2회 연속** 나오면 보고한다(1회는 우연일 수 있다).
- `by_app` 에서 어느 클라이언트가 먹고 있는지 지목한다.

### 1-6. advisor 축 — **델타가 신호다**

이 저장소는 30일에 마이그레이션 184건이다. 절대값은 이미 크고 안 줄어들지만,
**어제까지 없던 노출이 오늘 생겼다면 그건 방금 넣은 마이그레이션 때문**이다.

- `anon_exposed_without_rls` 가 0 → 1 이상: **critical**. 표 이름을 대고 어느 마이그레이션인지 찾는다.
- `rls_missing_tables` 증가: 새 표가 정책 없이 들어왔다. warning.
- `exposed_secdef_funcs.dims.anon` 증가: anon 이 실행할 수 있는 SECURITY DEFINER 가 늘었다. warning.
- `mutable_search_path_funcs.dims.api_exposed` 증가: warning.
- 값이 그대로면 **아무것도 쓰지 않는다**(이미 열려 있는 항목이 있으면 `occurrences` 만 오른다).

지문: `advisor:<metric>:<표/함수 이름>`

### 1-7. 쓰기 폭주 — **스냅샷으로는 못 잡는다. 로그로 잡는다**

2026-09-06 에 DB 가 25분간 전면 정지했다. 원인은 사전 드레인이 `/rest/v1/shared_dictionary` 에
**1분에 1,995건(초당 33건)을 한 행씩 PATCH** 한 것이고, 그 WAL 이 229MB 체크포인트를 만들어
I/O 를 포화시켰다. 일 1회 스냅샷은 이걸 **원리적으로 못 본다** — 사건이 1분짜리다.

그래서 daily 판정은 마지막에 로그를 한 번 본다. `query_logs` 는 ClickHouse 라 Postgres 부하와 무관하다.

```sql
select toStartOfMinute(timestamp) as m,
       log_attributes['request.method'] as method,
       log_attributes['request.path'] as path,
       count() as n
from logs
where source = 'edge_logs'
  and log_attributes['request.method'] in ('PATCH','POST','PUT','DELETE')
group by m, method, path
order by n desc limit 20
```

창은 **직전 24시간**으로 명시한다(`iso_timestamp_start`/`iso_timestamp_end`).

**판정** — 여기서도 상수를 쓰지 않는다. 기준을 두 곳에서 끌어낸다:
- **자기 이력**: 같은 경로의 평소 분당 쓰기와 비교한다. 평소의 10배가 넘는 분이 있으면 폭주다.
- **DB 가 실제로 아팠는가**: 같은 시각 `postgres_logs` 에 `checkpoint complete` 의 `write=` 가
  수십 초이거나 `statement timeout` 이 쏟아졌는지 본다. **부하만 있고 아프지 않았으면 올리지 않는다.**
  둘이 겹친 분이 있어야 발견이다.

지문 `capacity:write_storm:<경로>` · severity 는 DB 가 실제로 죽었으면 critical, 느려지기만 했으면 warning.
evidence 에 `{분, 경로, 건수, 초당, checkpoint_write_s}` 를 싣는다.

⚠️ **PostgREST 의 `204` 는 쓰기다**(`Prefer: return=minimal`). 상태 코드만 보고 "조용한 요청" 으로
읽지 마라 — 2026-09-06 의 1,995건이 전부 204 였다.

⚠️ 폭주를 찾았으면 **경로만 적지 말고 어느 스크립트인지까지 좁힌다.** `grep -rn "from('<표>')" scripts/`
로 그 표에 한 행씩 쓰는 코드를 찾아 evidence 에 파일명을 넣는다. 경로만 적으면 다음 사람이 같은 조사를 다시 한다.

### 1-8. 기록

발견마다:

```sql
select upsert_db_health_finding(
  p_fingerprint := 'cron:refresh-textbook-shelf-stats:failing',
  p_axis        := 'cron',
  p_severity    := 'warning',
  p_title       := '30분 잡이 24시간 중 12회 startup timeout',
  p_detail      := '원인은 쿼리가 아니라 background worker 고갈로 보인다 — 30초 주기 library-pipeline-worker 와 겹친다.',
  p_evidence    := '{"fails":12,"runs":48,"sample":"job startup timeout"}'::jsonb,
  p_suggested_sql := $$select cron.alter_job(7, schedule := '1 minute');$$
);
```

마지막에 **반드시**:

```sql
select close_missing_db_health_findings(array['<이번에 본 지문들>']);
```

이번에 안 보인 항목이 닫힌다. 이 호출을 빠뜨리면 고쳐진 문제가 화면에 영영 남고,
그러면 화면 전체를 아무도 안 믿게 된다.

### 1-9. 사람에게 하는 보고

- open 항목이 없으면 **한 줄**로 끝낸다. "새로 나빠진 것 없음 · 용량 +12MB/일 · 열린 항목 3건(전부 기존)".
- critical 이 있으면 그것만 먼저, 나머지는 건수로.


---

## 2. weekly 모드 (주 1회 · 정밀)

daily 전부 + 아래.

### 2-1. integrity 축 읽기

```sql
select metric, value, dims from db_health_metrics
where axis = 'integrity'
  and measured_at = (select max(measured_at) from db_health_metrics where axis='integrity');
```

- `function_errors > 0`: `dims.findings` 를 **한 건씩** 판정한다. 이 지표는 이미 오탐을 걸러 놨지만
  (`dims.suppressed` 가 걸러낸 수) 남은 것도 전부 진짜라는 보장은 없다.
  · `42703 column ... does not exist` — 대개 **진짜**다. 해당 표의 실제 컬럼을 조회해 확인하고 지목한다.
  · `42P10 ON CONFLICT` — 임시 테이블 대상이면 오탐. 실제 표 대상이면 진짜.
  · 확인한 것만 finding 으로 올린다. 지문 `integrity:function:<함수명>`.
- `cron_broken_commands > 0`: 항상 critical. cron 이 없는 함수를 부르고 있다.
- `unindexed_fk`: 목록에서 **큰 표의 FK 만** 고른다. 작은 표는 인덱스가 오히려 손해다.
  `table_size_mb` 스냅샷과 대조해 100MB 넘는 표의 FK 만 보고한다.
- `invalid_objects > 0`: 항상 critical. CONCURRENTLY 인덱스 생성 실패의 잔해다.

### 2-2. 수집기 자체를 검증한다 — **이 절을 건너뛰지 말 것**

`mcp__supabase__get_advisors` 를 `security` · `performance` 두 번 부르고, SQL 재구현과 숫자를 맞춘다.

| 우리 지표 | advisor lint | 허용 오차 |
|---|---|---|
| `unused_index_mb.dims.count` | `unused_index` | 정확히 일치해야 |
| `unindexed_fk` | `unindexed_foreign_keys` | 정확히 일치해야 |
| `rls_missing_tables.dims.no_policy` | `rls_enabled_no_policy` | 정확히 일치해야 |
| `exposed_secdef_funcs.dims.anon` | `anon_security_definer_function_executable` | ±2 (정의 차이) |
| `mutable_search_path_funcs.dims.api_exposed` | `function_search_path_mutable` | ±5 |

**어긋나면 그게 최우선 발견이다** — 지문 `integrity:collector_drift:<metric>`, severity critical.
2026-09-06 첫 검증에서 `mutable_search_path_funcs` 가 **0 을 보고했는데 실제는 196** 이었다
(`prosecdef` 로 걸러 엉뚱한 모수를 보고 있었다). **깨끗해서 0 이 아니라 엉뚱한 곳을 봐서 0** 이었고,
advisor 와 맞춰 보지 않았으면 영영 몰랐다. 틀린 감시 지표는 감시가 없는 것보다 나쁘다 —
없으면 모른다는 걸 알지만, 틀리면 안다고 착각한다.

advisor 응답은 크다(security 52만 자 · performance 30만 자). 통째로 읽지 말고
저장된 파일을 `node -e` 로 `result.lints` 를 `level|name` 별 카운트로 접어서 볼 것.

### 2-3. 용량 예측

`db_size_mb` 14일 이상 이력이 있으면 선형 기울기로 **디스크 한도 도달 예상일**을 낸다.
한도는 Supabase 프로젝트 설정값이며 SQL 로 읽을 수 없다 — 모르면 "한도 미상, 증가율만" 이라고 적는다.
**모르는 값을 그럴듯한 숫자로 채우지 않는다.**

### 2-4. 루프 안 단건 쓰기 — **가드를 사람이 기억하는 대신 여기서 돌린다**

```bash
node scripts/lib/scan-row-writes.mjs --json
```

2026-09-06 장애의 근본 원인이 이것이었다(초당 33건 단건 PATCH → 229MB 체크포인트 → 25분 정지).
저장소에는 같은 발상의 `scan-unpaged-queries.mjs` 가 이미 있었지만 **어떤 테스트에도 연결돼 있지
않아 주석에서만 언급된다** — 즉 아무도 안 돌린다. 같은 운명을 반복하지 않으려고 주간 판정이 돌린다.

**판정**:
- 기준선은 **직전 주의 건수**다. `db_health_findings` 의 `capacity:row_writes:scan` 지문에 있는
  `evidence.total` 과 비교한다. 처음이면 그 수를 기준선으로 적고 끝낸다(늘었다고 말할 근거가 없다).
- **총계가 늘었으면** 새로 들어온 파일을 지목한다 — 새 드레인이 같은 함정에 빠진 것이다. warning.
- **줄었으면** 아무것도 올리지 않는다. 좋아진 것을 보고하려고 항목을 만들지 않는다.
- 총계가 그대로면 `occurrences` 만 오른다(지문이 같으므로 자동).

지문 `capacity:row_writes:scan` · evidence 에 `{total, by_table 상위 5, 새로 들어온 파일}`.

⚠️ **이건 게이트가 아니라 목록이다.** 표가 작거나 실행이 드물면 문제가 아니다 —
133건 전부를 고치라고 요구하지 마라. 그렇게 적으면 다음 사람이 이 항목을 통째로 무시한다.

---

## 2.5. 오탐을 만드는 두 함정 — **2026-09-06 첫 판정이 둘 다 밟았다**

첫 실행이 critical 3건을 올렸는데 **그중 둘이 오탐**이었다. 판정이 나빠서가 아니라
판정자가 두 가지를 몰랐기 때문이고, 모르면 매주 같은 오탐을 반복한다.

### ① 저장소가 이미 내린 결정을 읽는다

`csat_items_public` 뷰의 SECURITY DEFINER 를 critical 로 올렸다. 그런데 마이그레이션
**두 건**(20260903121759 · 20260904084631)이 "의도된 저작권 경계다. **고치지 말 것**" 이라고
적어 두었고, 실제로 `csat_items` 는 RLS + authenticated 전용 정책이며 뷰는 저작권 있는
지문·선지를 뺀 안전한 열만 투영한다. 뒤집으면 공개 CSAT 화면이 빈다.

- `db_health_exceptions` 표가 이제 이것을 **DB 레벨에서 강제**한다 —
  면제된 지문은 `upsert_db_health_finding` 이 `status='excepted'` 로 넣고 사유를 `note` 에 단다.
- 그래도 **새 항목을 올리기 전에는 저장소를 먼저 훑는다**:
  `grep -rn "<대상 이름>" supabase/migrations docs | grep -i "고치지 말\|의도\|예외\|경계"`
- 면제가 맞다고 판단했으면 표에 등록한다 — `reason` 과 **`evidence`(어디에 그 결정이 적혀 있는지)**
  둘 다 필수다. 근거 없는 면제는 면제가 아니라 은폐다.
- 기한을 정할 수 있으면 `expires_at` 을 넣는다. 「지금은 이렇게 두기로 했다」와 「영원히 괜찮다」는 다르다.

### ② `pg_stat_statements` 는 시간 창이 없다 — 누적 평균은 과거를 영원히 붙든다

`collect_quality_metrics` 를 「평균 551초 · 예산 120초의 4.6배」로 critical 로 올렸다. 사실은:
- 그 느림은 **2026-08-31 에 이미 고쳐졌다**(회전 표본 · `20260831130000`).
- 야간 잡은 최근 10일간 **6회 성공, 평균 172초**다. 마지막 실패는 8/30.
- 551초는 `calls: 1` — 일회성 호출 하나가 누적 평균에 영원히 남은 것이다.

**그래서 이렇게 판정한다**:
- 스냅샷 두 벌의 `dims.top` 을 `q`(정규화된 쿼리 앞 160자)로 맞춰 **Δcalls** 를 낸다.
  **Δcalls = 0 이면 그 구문은 이 창에서 한 번도 안 돌았다** — 지금 느린 게 아니라 과거에 느렸다.
  올리지 않는다(올릴 거면 severity info + "과거 기록" 이라고 적는다).
- Δcalls > 0 이면 **Δtotal_ms / Δcalls** 가 이 창의 실제 평균이다. 누적 `mean_ms` 를 쓰지 않는다.
- ⚠️ **`statement_timeout` 을 모든 구문의 예산으로 쓰지 마라.** 120초는 PostgREST 롤의 설정이고
  **pg_cron 잡에는 적용되지 않는다.** 야간 배치가 172초 걸리는 것은 정상이다.
  cron 이 부르는 구문의 예산은 `cron.job_run_details` 의 실제 성공 여부로 판단한다 —
  성공하고 있으면 느린 것이지 고장난 것이 아니다.
- 구문이 사람 경로(PostgREST)에서 오는지 배치에서 오는지 모르겠으면 **`cron.job.command` 와 대조**한다.

### 공통 규칙 — 올리기 전에 "이미 고쳐졌나" 를 묻는다

두 오탐의 뿌리는 같다: **판정이 현재 상태가 아니라 흔적을 봤다.** 항목을 올리기 전에
그 증상이 *지금도* 재현되는지 한 번 더 확인한다 — cron 은 최근 실행 결과로, 성능은 델타로,
설계 결정은 저장소 기록으로. 확인 비용이 오탐 하나의 비용보다 항상 싸다.

---

## 3. 이 저장소 고유의 함정

- `pg_stat_user_tables.n_live_tup` **를 근거로 쓰지 말 것.** 2026-09-06 에 이 값이
  `library_book_vocabularies` 를 0행이라고 했지만 실제는 1,669,433행이었다(ANALYZE 안 돌아 있었음).
  행 수가 필요하면 `pgstattuple_approx` 나 `count(*)` 로 확인한다.
  `stats_stale_tables` 지표가 이 상태를 상시 감시한다.
- **없는 테이블 확인은 문서가 아니라 `to_regclass`.** CLAUDE.md 가 명시한다.
- 워크스페이스를 여러 세션이 공유한다. 커밋은 `git commit --only <파일 개별 지정>`.
- `library-pipeline-worker`(jobid 7)는 **30초 주기**다. cron 관련 판정을 할 때 이 잡이
  background worker 를 점유하는 쪽인지 먼저 의심한다.

## 4. 자동 반복

`/loop` 로 걸 때: daily 는 하루 1회면 충분하므로 **클라우드 스케줄**(`/schedule`)이 맞다.
세션 루프로 돌리면 세션이 닫히는 순간 감시가 멈추는데, 멈춘 것을 아무도 모른다 —
이 명령이 막으려는 실패 모드 그 자체다.
