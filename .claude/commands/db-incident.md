---
description: DB 가 응답하지 않을 때의 분류 절차 — SQL 이 죽어도 살아 있는 로그 경로로 원인을 좁히고, 할 수 있는 조치와 못 하는 조치를 가른다
argument-hint: [최근 N분] (생략 시 30)
allowed-tools: Read, Bash, Grep
---

# /db-incident — DB 가 응답하지 않을 때

> **2026-09-06 실제 장애에서 나왔다.** `db_health_metrics` 도 `db_health_findings` 도 못 읽는
> 상태가 25분 이어졌다. DB 안에 있는 감시는 전부 같이 눈이 멀었고, **살아 있던 것은 로그 스트림뿐**이었다.
> 그래서 이 절차는 SQL 을 한 줄도 쓰지 않는다.

## 0. 먼저 확인 — 이게 정말 장애인가

```
mcp__supabase__execute_sql  →  select 1 as ok
```

- 성공하면 장애가 아니다. 느린 것이면 `/db-health-audit` 로 간다.
- **실패해도 한 번으로 판단하지 않는다.** 15초 간격으로 3회. 한 번은 잡음일 수 있다.
- 3회 연속 실패면 아래로 간다. 이때부터 **SQL 로 진단하려는 시도를 멈춘다** —
  죽은 DB 에 붙는 재시도가 회복을 늦춘다(실측: 에이전트가 `select 1` 을 20회 재시도했고 전부 60초 타임아웃).

## 1. 관리 API 로 층을 가른다

```
mcp__supabase__get_project  →  { id: "jajenrevcbmrpaliomxv" }
```

| status | 뜻 |
|---|---|
| `ACTIVE_HEALTHY` | **컨트롤 플레인은 정상.** 플랫폼 장애가 아니라 DB 내부 문제다(포화·잠금·체크포인트) |
| `INACTIVE` / `PAUSING` / 그 외 | 플랫폼 쪽. 대시보드와 Supabase 상태 페이지를 본다 |

⚠️ `ACTIVE_HEALTHY` 는 **"쿼리가 된다" 는 뜻이 아니다.** 2026-09-06 에 SQL·Auth·REST 가 전부
504 인 동안에도 이 값은 `ACTIVE_HEALTHY` 였다. 이 값만 보고 "괜찮다" 고 적으면 안 된다.

## 2. 로그로 원인을 좁힌다 — 여기가 이 명령의 본체

`mcp__supabase__query_logs` 는 ClickHouse 를 읽으므로 **Postgres 가 죽어도 답한다.**
창은 `iso_timestamp_start` / `iso_timestamp_end` 로 반드시 명시한다(기본 24시간은 너무 넓다).

### 2-1. 언제 끊겼나 — 소스별 분당 건수

```sql
select toStartOfMinute(timestamp) as m, source, count() as n
from logs group by m, source order by m desc limit 40
```

`postgres_logs` · `postgrest_logs` 가 어느 분에 0 이 되는지가 **장애 시각**이다.
`edge_logs` 만 남아 504 를 찍고 있으면 게이트웨이는 살아 있고 그 뒤가 죽은 것이다.

### 2-2. Postgres 가 마지막에 무슨 말을 했나

```sql
select timestamp, substring(event_message, 1, 300) as msg
from logs where source = 'postgres_logs'
order by timestamp desc limit 30
```

읽는 법 — **원인은 대개 마지막 줄이 아니라 그 앞 몇 분에 있다**:

| 보이는 것 | 뜻 |
|---|---|
| `checkpoint complete: … write=NN s … distance=NNN kB` | **쓰기 폭주의 흔적.** write 가 수십 초 · distance 가 수백 MB 면 I/O 가 포화됐다는 뜻이고, 그 시간 동안 모든 쿼리가 느려진다 |
| `canceling statement due to statement timeout` 이 쏟아짐 | 결과지 원인이 아니다. 무엇 때문에 느려졌는지를 위에서 찾는다 |
| `duration: NNNNN ms plan: …` 사소한 쿼리가 수십 초 | I/O 포화의 증거. 그 쿼리 자체는 죄가 없다 |
| `could not receive data from client` / `could not accept SSL connection` | 클라이언트가 먼저 끊은 것 — 원인이 아니라 증상 |
| `cron job N job startup timeout` | background worker 고갈. 짧은 주기 잡(30초짜리 jobid 7)을 의심한다 |
| `deadlock detected` / `process N still waiting for` | 잠금 문제. 위 I/O 서사와는 다른 갈래다 |

### 2-3. 누가 부하를 만들었나 — **가장 중요한 질의**

```sql
select toStartOfMinute(timestamp) as m,
       log_attributes['request.method'] as method,
       log_attributes['request.path'] as path,
       log_attributes['response.status_code'] as status,
       count() as n
from logs where source = 'edge_logs'
group by m, method, path, status order by n desc limit 30
```

**장애 시각보다 5~15분 앞선 창**을 본다. 원인은 장애 순간이 아니라 그 앞에 있다.

- `PATCH`/`POST` 가 **분당 1,000건 넘게** 한 경로에 몰려 있으면 그게 범인이다.
  PostgREST 에서 `204` 는 `Prefer: return=minimal` 쓰기다 — **204 가 많다 = 쓰기 폭주**.
- 실측(2026-09-06): 01:55 에 `/rest/v1/shared_dictionary` 로 **1,995건/분 = 초당 33건**.
  사전 드레인이 한 행씩 PATCH 하고 있었고, 그 WAL 이 229MB 체크포인트를 만들었다.
- 범인을 찾았으면 **그 스크립트를 먼저 멈춘다.** 멈추기 전에는 재시작해도 같은 일이 반복된다.

## 3. 조치 — 할 수 있는 것과 못 하는 것을 가른다

**내가 할 수 있는 것**
- 부하를 만든 로컬 스크립트·드레인 정지 (프로세스 종료).
- 저장소 쪽 수정(배치 쓰기로 고치기, 가드 추가). DB 없이 된다.
- 사실 기록 — DB 가 살아나기 전까지는 `db_health_findings` 에 못 쓰므로 **이 대화와 CHANGELOG 에** 적는다.

**내가 못 하는 것 — 사용자에게 넘긴다**
- **프로젝트 재시작.** Supabase 대시보드 → Settings → General → **Restart project**.
  버튼을 누를 수 있는 것은 사람뿐이다. 부하가 이미 멈췄는데도 회복이 안 되면 이게 표준 조치다.
- `pause_project` → `restore_project` 를 대신 쓰지 마라. 복구가 재시작보다 훨씬 오래 걸리고
  되돌리기 어렵다. **먼저 묻는다.**

## 4. 되살아난 뒤 — 이 순서를 지킨다

1. `select 1` 이 되는지 확인. 되면 **바로 `/db-health-audit daily`** 를 돌려 장애 전후를 남긴다.
2. 부하를 만든 쪽을 고치기 전까지 그 드레인을 다시 켜지 않는다.
3. 장애 자체를 발견으로 남긴다 — 지문 `capacity:write_storm:<경로>` 같은 형태로
   `upsert_db_health_finding` 에 기록한다. **기록하지 않으면 다음에 또 같은 곳에서 넘어진다.**
4. 위험 작업을 다시 시작할 때는 `record_db_health_checkpoint(<라벨>, 'before')` 를 먼저 찍는다.

## 5. 이 명령이 존재하는 이유 — 한 줄

**DB 안에 있는 감시는 DB 가 죽는 순간 같이 죽는다.** 그때 남는 것은 로그 스트림과 관리 API 뿐이고,
이 문서는 그 둘만으로 원인까지 가는 길이다.
