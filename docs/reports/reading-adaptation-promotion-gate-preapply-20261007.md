# Reading adaptation DB promotion gate: pre-application review

Status: **approval pending; SQL not applied**. Target: Vocaflow development Supabase project `jajenrevcbmrpaliomxv`, database `postgres`. Proposed SQL: [`20261007190000_reading_adaptation_promotion_gate.sql`](../../supabase/migrations/20261007190000_reading_adaptation_promotion_gate.sql) at commit `b9a4cc202`.

## Read-only baseline

At 2026-10-07 10:18:25 UTC, `public.library_articles` had `source_id LIKE 'reading:%'`: total 0, queued 0, ready 0, published 0. At 10:18:31 UTC, `pg_trigger` had zero active `trg_la_hold_reading_adaptation` rows for this table and `pg_proc` had zero `public.trg_hold_reading_adaptation` functions. These are live read-only observations, not a guarantee about the state at application time.

```sql
SELECT current_database(), now(),
  count(*) FILTER (WHERE source_id LIKE 'reading:%') AS reading_total,
  count(*) FILTER (WHERE source_id LIKE 'reading:%' AND status = 'queued') AS reading_queued,
  count(*) FILTER (WHERE source_id LIKE 'reading:%' AND status = 'ready') AS reading_ready,
  count(*) FILTER (WHERE source_id LIKE 'reading:%' AND status = 'published') AS reading_published
FROM public.library_articles;

SELECT now(),
  (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.library_articles'::regclass
    AND tgname = 'trg_la_hold_reading_adaptation' AND NOT tgisinternal) AS gate_triggers,
  (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
    AND proname = 'trg_hold_reading_adaptation') AS gate_functions;
```

## Effect and failure behavior

The migration creates `public.trg_hold_reading_adaptation()` and a `BEFORE INSERT OR UPDATE OF status, source_id` trigger on `public.library_articles`. It rejects a `reading:` child entering `ready` or `published`. It also rejects changing an existing `reading:` child's `source_id`, so a two-step rewrite cannot bypass the hold. Other articles and queued reading children are unaffected. There is no admin or `service_role` exception: RLS bypass does not exempt a normal write from this trigger. A database superuser able to disable triggers remains outside this application gate.

The migration has explicit `BEGIN`/`COMMIT`. Function replacement and trigger recreation happen in one transaction. Reapplying the same SQL is intended to recreate the same trigger without duplicates. An error before `COMMIT` rolls back the migration transaction, including a dropped prior trigger. PostgreSQL raises `check_violation` for a rejected row; the statement fails and its transaction follows the caller's usual rollback behavior. The migration does not rewrite or delete existing rows. It also does not supply the later separate promotion function: it blocks entry into `ready`/`published` but does not force other statuses to `queued`.

Before any approved application, rerun the two baseline queries, inspect the complete SQL file and confirm that no other migration version or trigger has taken its name. After application, verify exactly one trigger with `tgenabled IN ('O','A')`, `tgfoid = 'public.trg_hold_reading_adaptation()'::regprocedure`, and the expected definition; also verify the function body. Use a transaction-local table with `id`, `status`, and `source_id` columns and attach the installed function as a trigger for a rollback-only behavioral test. Insert a queued `reading:` row, then use a separate `SAVEPOINT` for each expected failure: queued→ready, queued→published, and source-ID rewrite. Confirm SQLSTATE `23514` and the expected gate message after each failure; `ROLLBACK TO SAVEPOINT` before the next case. End with `ROLLBACK`. A failed statement without savepoint recovery aborts the transaction and cannot validate later cases. No real article row is needed for these tests.

```sql
SELECT t.tgname, t.tgenabled, t.tgfoid::regprocedure AS trigger_function,
       pg_get_triggerdef(t.oid) AS trigger_definition,
       pg_get_functiondef(t.tgfoid) AS function_definition
FROM pg_trigger t
WHERE t.tgrelid = 'public.library_articles'::regclass
  AND t.tgname = 'trg_la_hold_reading_adaptation' AND NOT t.tgisinternal;
```

## Rollback requiring separate approval

Rollback removes the DB-level protection and must be considered only after checking current reading children. It does not revert previously rejected writes because those writes never committed.

```sql
BEGIN;
DROP TRIGGER IF EXISTS trg_la_hold_reading_adaptation ON public.library_articles;
DROP FUNCTION IF EXISTS public.trg_hold_reading_adaptation();
COMMIT;
```

No benchmark corpus, Gold-S certificate or DB seed is created by this migration.
