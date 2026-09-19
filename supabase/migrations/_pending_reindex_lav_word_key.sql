-- supabase/migrations/_pending_reindex_lav_word_key.sql
--
-- **색인 하나를 온라인으로 다시 짓는다** — `library_article_vocabularies` 의 유일한 색인이
-- leaf 밀도 56.2% 까지 부풀어 2,390 MB 를 쓰고 있다. 다시 지으면 약 1,490 MB 다(**~0.9 GB 회수**).
--
-- ⚠️ **이 파일은 적용되지 않았다.** `CONCURRENTLY` 는 트랜잭션 밖에서만 돌아 MCP·SQL Editor 로는
--    `25001` 로 거부된다. **사람이 psql 로 돌려야 한다** (`/db-remediate` §3 스키마 조치).
--
-- ── 왜 VACUUM FULL 이 아니라 이것인가 (2026-09-16 실측) ─────────────
--
-- 표 전체는 9,968 MB(힙 7,575 + 색인 2,390)이고 DB 는 15 GB 다. `VACUUM FULL` 을 돌리면
-- 약 2.7 GB 를 되돌려 받지만(힙 1.8 + 색인 0.9), **그중 힙 몫 1.8 GB 는 버리는 공간이 아니다.**
-- ACP 가 이 표를 계속 채우므로(33.9M 행) 그 자리는 다시 쓰인다 — `pgstattuple_approx` 기준
-- 힙 빈 공간 1,796 MB(23.7%) · 죽은 튜플 0.19%(autovacuum 이 2026-09-15 에 이미 돌았다).
-- 즉 `VACUUM FULL` 의 힙 몫은 공간을 버는 게 아니라 **시간을 버는** 것이고, 대가로
-- **ACCESS EXCLUSIVE 락 10~30분**(그동안 ACP 적재와 라이브러리 화면이 멈춘다)과
-- **임시 디스크 ~10 GB** 를 치른다. `/db-remediate` §3 이 같은 말을 한다 —
-- *"표가 다시 커질 예정이면 회수해도 곧 같은 크기가 된다."*
--
-- 되돌아오지 않는 것은 **색인 몫 0.9 GB** 뿐이고, 그것만은 **락 없이** 회수된다. 그래서 이것이다.
--
-- ── 대상 ────────────────────────────────────────────────────────────
--   색인  public.library_article_vocabularies_library_article_id_word_key
--   성격  UNIQUE 제약이 딸린 색인 (PG12+ 는 CONCURRENTLY 재작성을 지원한다)
--   크기  2,390 MB · avg_leaf_density 56.2% · leaf_fragmentation 44.1%
--   사용  idx_scan 69,636 — **살아 있는 색인이다. 지우면 안 된다.**
--
-- ── 돌리는 법 ───────────────────────────────────────────────────────
--
-- 1) **세션 모드로 붙는다.** 트랜잭션 모드 풀러(:6543)로는 안 된다 — 문장이 트랜잭션에
--    감싸여 같은 25001 이 난다. 직접 호스트(:5432) 또는 세션 모드 풀러를 쓴다.
--
--      psql "postgresql://postgres:<비밀번호>@db.jajenrevcbmrpaliomxv.supabase.co:5432/postgres"
--
--    비밀번호는 Supabase 대시보드 → Project Settings → Database. (이 저장소의 `.env*` 에는
--    `SUPABASE_SERVICE_ROLE_KEY` 만 있고 **DB 비밀번호는 없다** — PostgREST 키로는 못 붙는다.)
--
-- 2) 아래를 **한 문장씩** 실행한다. `\timing on` 을 먼저 켜 두면 걸린 시간이 남는다.
--
-- 3) 오래 걸린다(2.4 GB · 3,388만 행 — 10~30분 예상). `CONCURRENTLY` 는 표를 잠그지 않으므로
--    서비스는 그동안 정상으로 돈다. 다만 **끝날 때 아주 짧게** 잠금을 잡는다.
--
-- ── 실패하면 ────────────────────────────────────────────────────────
--
-- 중간에 끊기면 `..._ccnew` 라는 **INVALID 색인이 남는다.** 그대로 두면 디스크만 먹고
-- 쓰이지 않으며, 다음 재작성도 막는다. §4 의 정리 질의로 반드시 확인한다.

-- ── 1. 앞 상태를 적어 둔다 ──────────────────────────────────────────
select record_db_health_checkpoint(
  'reindex_lav_word_key_20260916', 'before',
  '색인 leaf 밀도 56.2% · 2,390 MB — CONCURRENTLY 재작성'
);

-- ── 2. 시간 제한을 푼다 (이 세션에만) ───────────────────────────────
-- 이 DB 의 `postgres` 역할에는 statement_timeout 이 없다(`pg_roles.rolconfig` 확인).
-- 2분 제한은 MCP 경로가 세션에 거는 값이라, psql 로 붙으면 애초에 걸려 있지 않다.
-- 그래도 명시해 둔다 — 붙는 경로가 바뀌어도 이 파일은 그대로 돈다.
set statement_timeout = 0;
set lock_timeout = '30s';       -- 마지막 짧은 잠금에서 물리면 오래 매달리지 않고 물러난다

-- ── 3. 재작성 (이 한 줄이 본체다) ───────────────────────────────────
reindex index concurrently public.library_article_vocabularies_library_article_id_word_key;

-- ── 4. 확인 ─────────────────────────────────────────────────────────

-- 4-1. INVALID 색인이 남지 않았는가 — **0행이어야 한다.**
--      행이 있으면 재작성이 끝나지 않은 것이다: `drop index concurrently <그 이름>;` 로 지우고
--      §3 을 다시 돌린다.
select c.relname, i.indisvalid, pg_size_pretty(pg_relation_size(c.oid)) as size
from pg_index i
join pg_class c on c.oid = i.indexrelid
join pg_class t on t.oid = i.indrelid
where t.relname = 'library_article_vocabularies'
  and not i.indisvalid;

-- 4-2. 줄었는가 — 2,390 MB → 약 1,490 MB, 밀도 56.2% → 90% 안팎을 기대한다.
select
  pg_size_pretty(pg_relation_size('public.library_article_vocabularies_library_article_id_word_key')) as size,
  round(avg_leaf_density::numeric, 1) as leaf_density_pct,
  round(leaf_fragmentation::numeric, 1) as fragmentation_pct
from pgstatindex('public.library_article_vocabularies_library_article_id_word_key');

-- 4-3. 표 전체와 DB — 9,968 MB → 약 9,070 MB · 15 GB → 약 14.1 GB.
--      **DB 가 15 → 12.3 GB 가 되지는 않는다.** 그건 힙까지 되돌려 받는 VACUUM FULL 의 수치이고,
--      그 힙 몫은 위 머리말대로 어차피 다시 쓰인다.
select
  pg_size_pretty(pg_total_relation_size('public.library_article_vocabularies')) as table_total,
  pg_size_pretty(pg_database_size(current_database())) as db;

-- ── 5. 뒤 상태 ──────────────────────────────────────────────────────
select record_db_health_checkpoint(
  'reindex_lav_word_key_20260916', 'after',
  '재작성 완료 — 4-2 의 실제 값을 여기 적어 둘 것'
);
select * from db_health_checkpoint_diff('reindex_lav_word_key_20260916') where status <> 'same';
