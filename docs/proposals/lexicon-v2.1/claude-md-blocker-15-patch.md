# CLAUDE.md §18.9 BLOCKER #15 — 상세 레퍼런스

CLAUDE.md §18.9 의 #15 한 줄 등재본의 상세 설명. 본문이 길어 별도 문서로 분리.

## 증상

- Supabase database advisor `function_search_path_mutable` 경고
- 또는 호출 시 `relation "..." does not exist` (public 외부에서 호출될 때)
- `SECURITY DEFINER` 함수면 권한 escalation 위험 (다른 schema 의 동명 함수 hijack)

## 원인

PostgreSQL 함수는 호출 시점의 `search_path` 를 사용. 호출자마다 다를 수 있어
함수 내부의 미한정 식별자 (예: `public.shared_words` 가 아닌 `shared_words`) 가
호출자의 search_path 에 의존.

## 해결 패턴

```sql
-- ❌ BAD
CREATE OR REPLACE FUNCTION my_trigger() RETURNS TRIGGER AS $$
BEGIN ... END;
$$ LANGUAGE plpgsql;

-- ✅ GOOD
CREATE OR REPLACE FUNCTION my_trigger() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp   -- ★ 필수
AS $$
BEGIN ... END;
$$;
```

## 적용 규칙

| 함수 종류 | 필수성 | 권장값 |
|---|---|---|
| 트리거 함수 (BEFORE/AFTER) | **필수** | `public, pg_temp` |
| `SECURITY DEFINER` | **필수** (보안) | `public, pg_temp` (LCP 처럼 `extensions` 포함 시 `public, extensions, pg_temp`) |
| `IMMUTABLE` / `STABLE` 헬퍼 | **권장** | `public, pg_temp` |
| `VOLATILE` SECURITY INVOKER 헬퍼 | 선택 | `public, pg_temp` |

## Vocaflow 현황

| 함수 | 위치 | 상태 |
|---|---|---|
| `set_updated_at()` | `20251101000006_triggers_and_rls.sql` | ⚠️ 미점검 — search_path 명시 여부 확인 필요 |
| `compute_frequency_tier()` | `schema-v2.1.sql` (v06.28) | ✅ `SET search_path = public, pg_temp` |
| `auto_compute_freq_fields()` | `schema-v2.1.sql` (v06.28) | ✅ `SET search_path = public, pg_temp` |
| LCP `store_content_chunk()` · `get_chapter_content()` · `enroll_library_book()` 등 | `20260508120*.sql` | ✅ BLOCKER #3 패턴 적용됨 (§18.9 참조) |

## 점검 쿼리

```sql
SELECT
  n.nspname AS schema,
  p.proname AS function,
  p.proconfig AS config       -- NULL = search_path 미설정
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
  AND p.proconfig IS NULL
ORDER BY p.proname;
```

결과 있으면 모두 `ALTER FUNCTION ... SET search_path = public, pg_temp` 적용.

## CI 자동 검출 (권장)

```bash
psql "$SUPABASE_DB_URL" -tA -c "
  SELECT proname FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
    AND p.proconfig IS NULL
" | grep -v '^$' && echo "FAIL: plpgsql functions without search_path" && exit 1
```

## 관련 문서

- Supabase database linter: <https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable>
- PostgreSQL `CREATE FUNCTION` SET clause: <https://www.postgresql.org/docs/current/sql-createfunction.html>
- 본 BLOCKER 의 한 줄 등재본: CLAUDE.md §18.9 #15
