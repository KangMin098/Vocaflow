---
description: db_health_findings 의 열린 발견 하나를 실제로 조치한다 — 증상 재현 확인 → 분류 → 승인 → 적용 → 재검증 → 닫기
argument-hint: <fingerprint> 또는 생략(가장 급한 것부터 제안)
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# /db-remediate — 발견을 실제로 고친다

> 판정(`/db-health-audit`)은 **적기만 한다.** 화면(`/admin/db`)은 **보여 주기만 한다.**
> 고치는 자리는 여기 하나뿐이고, 그래서 여기에만 승인 절차가 있다.

## 0. 절대 규칙

- **마이그레이션 자동 적용 금지.** SQL 을 보여 주고 사용자 승인을 받은 뒤에만 `apply_migration`.
- **되돌릴 수 없는 것은 따로 묻는다** — `VACUUM FULL`(그 표를 통째로 잠근다) · `DROP INDEX`
  (되돌리려면 재생성 시간이 든다) · `DELETE`/`TRUNCATE` · `cron.unschedule`.
- **한 번에 하나만.** 여러 발견을 묶어 고치면 무엇이 무엇을 고쳤는지 알 수 없다.
- 고친 뒤 **반드시 재검증**한다. 안 하면 "고쳤다" 가 추측이다.

## 1. 무엇을 고칠지 고른다

인자가 있으면 그 지문. 없으면:

```sql
select id, fingerprint, axis, severity, title, occurrences, first_seen_at,
       suggested_sql is not null as has_sql
from db_health_findings
where status in ('open','ack')
order by case severity when 'critical' then 0 when 'warning' then 1 else 2 end,
         first_seen_at
limit 10;
```

정렬은 화면과 같다 — 심각도 먼저, 같으면 **오래 방치된 것 먼저**.
사용자에게 상위 3개를 제시하고 고르게 한다. 임의로 정하지 않는다.

## 2. **증상이 지금도 재현되는가** — 이 단계를 건너뛰지 마라

2026-09-06 에 첫 판정의 critical 3건 중 **2건이 이미 해결됐거나 의도된 것**이었다.
고치기 전에 재현을 확인하지 않으면 **멀쩡한 것을 건드린다.**

| 축 | 어떻게 재현을 확인하나 |
|---|---|
| `integrity` (없는 컬럼/테이블) | `information_schema.columns` 로 실제 컬럼을 조회. 함수를 **실제로 한 번 호출**해 본다 |
| `cron` | `cron.job_run_details` 의 **최근 실행**을 본다. 지금 성공하고 있으면 이미 고쳐진 것이다 |
| `latency` | `pg_stat_statements` 의 누적 평균이 아니라 **Δcalls > 0** 인지. 안 돌았으면 지금 느린 게 아니다 |
| `capacity` | 다시 측정한다(`pgstattuple_approx`·`pg_total_relation_size`) |
| `advisor` | 카탈로그를 다시 읽고, **저장소에 그 결정이 이미 적혀 있는지** grep 한다 |

재현되지 않으면 → **고치지 말고 닫는다**:
```sql
update db_health_findings set status='resolved', resolved_at=now(),
  note='<왜 재현되지 않는지 · 언제 무엇으로 고쳐졌는지>'
where fingerprint = '<지문>';
```

의도된 설계였으면 → **면제에 등록**한다(고치지 않는다):
```sql
insert into db_health_exceptions (fingerprint, reason, evidence)
values ('<지문>', '<왜 이대로 두는가>', '<그 결정이 적힌 자리 — 마이그레이션·문서 경로>');
```
`evidence` 는 필수다. 근거 없는 면제는 면제가 아니라 은폐다.

## 3. 분류 — 조치의 종류가 다르면 절차도 다르다

| 종류 | 예 | 어떻게 |
|---|---|---|
| **코드 수정** | 행 단위 쓰기 루프, 함수의 잘못된 컬럼 참조 | 저장소를 고친다. SQL 함수면 마이그레이션(§4) |
| **스키마 조치** | FK 인덱스 추가, INVALID 인덱스 재생성 | 마이그레이션(§4). ⚠️ `CONCURRENTLY` 는 트랜잭션 밖에서만 돌아 MCP 로는 25001 로 거부된다 — `_pending_*.sql` 로 남기고 사람이 psql 로 돌린다 |
| **운영 조치** | cron 주기 완화, 잡 정지 | `cron.alter_job` — 마이그레이션이 아니라 별도 실행. **되돌리는 법을 함께 적는다** |
| **공간 회수** | `VACUUM FULL` | **따로 묻는다.** 락을 잡고, 표가 다시 커질 예정이면 회수해도 곧 같은 크기가 된다 |
| **조치 안 함** | 작은 표의 FK 인덱스 누락 | 닫지 말고 `note` 에 이유를 적고 `ack` 로 둔다 |

## 4. 적용 — 체크포인트로 감싼다

```sql
select record_db_health_checkpoint('<지문 또는 마이그레이션 번호>', 'before', '<무엇을 고치는가>');
```

그다음 **SQL 을 사용자에게 보여 주고 승인을 받는다.** 승인 후 `apply_migration`.
저장소에도 같은 내용의 마이그레이션 파일을 남긴다 — **원격만 고치면 다음 체크아웃에서 되살아난다.**

```sql
select record_db_health_checkpoint('<같은 라벨>', 'after', '<무엇을 했는가>');
select * from db_health_checkpoint_diff('<같은 라벨>') where status <> 'same';
```

diff 에 `disappeared` 가 있으면 **조치가 다른 축을 깼다는 뜻**이다. 되돌린다.
(`bloat_sampled_pct` 의 disappeared+appeared 쌍은 회전 표본이라 정상 — `/db-checkpoint` 참조.)

## 5. 재검증 — "고쳤다" 를 증명한다

§2 에서 재현을 확인한 **바로 그 방법으로** 다시 잰다. 증상이 사라졌는지 본다.
- 함수 버그였으면 **그 함수를 실제로 호출**한다(2026-09-06: `analyze_book_vrl` 을 고친 뒤
  `The Race` 18낱말로 호출해 741ms·VRL 200 을 받았다. 그 전에는 한 번도 성공한 적이 없었다).
- cron 이었으면 다음 실행을 기다리거나 명령을 직접 한 번 돌린다.
- 용량이었으면 다시 잰다.

## 6. 닫기

```sql
update db_health_findings
   set status='resolved', resolved_at=now(),
       note='<무엇을 했고 무엇으로 확인했는지 — 마이그레이션 번호와 재검증 수치>'
 where fingerprint='<지문>';
```

닫기만 하고 끝내지 않는다:
- **같은 종류가 또 생기지 않게 하는 장치**를 생각한다. 회귀 테스트·가드 스크립트·CONVENTIONS 한 줄.
  고친 것보다 이쪽이 오래 남는다.
- `docs/CHANGELOG.md` 에 한 줄. 마이그레이션을 적용했으면 `docs/DB_SCHEMA.md` 도.
- 커밋은 `git commit --only <파일 개별 지정>` (워크스페이스를 여러 세션이 공유한다).

## 7. 이 명령이 하지 않는 것

- 발견을 **만들지** 않는다. 그건 `/db-health-audit` 이다.
- DB 가 응답하지 않을 때 쓰는 것이 아니다. 그건 `/db-incident` 다.
- 여러 건을 한 번에 처리하지 않는다. 하나 끝내고 다시 부른다.
