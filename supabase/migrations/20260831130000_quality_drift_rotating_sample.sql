-- supabase/migrations/20260831130000_quality_drift_rotating_sample.sql
--
-- M7(발행 세트 SSoT 드리프트)을 **회전 표본 + 도서당 1회 호출**로 바꾼다.
--
-- ── 왜 (실측 2026-08-31) ────────────────────────────────────────────
-- `quality-metrics-nightly`(pg_cron jobid=12)가 2026-08-29부터 매일 실패했다.
-- 오류는 `select_book_chapter_vocab` 의 statement timeout 이지만, 원인은 성능이 아니라
-- **공급 증가**다:
--
--     08-28 18:10  마지막 성공
--     08-29        274권 / 9,636세트 대량 발행   ← 분기점
--     08-29 18:10~ 매일 실패
--
-- M7 검사 대상이 **38권 → 312권**이 됐다. 원본 마이그레이션(20260814015130)의 머리 주석은
-- 비용을 "`select_book_chapter_vocab` 를 도서당 1회 · 발행 12권 기준 ~19초" 로 적었는데,
-- **두 가정이 모두 깨졌다**:
--   ① 12권이 아니라 312권이다.
--   ② "도서당 1회" 가 아니었다 — EXCEPT 양방향에 각각 써서 **2회**였다
--      (실측: 본문에 `select_book_chapter_vocab` 가 2번 나온다).
--
-- 권당 1회 소요 실측: **0.52초**(그림책 56행) ~ **18.4초**(장편 3,114행), 함수 상한 30초.
-- 그래서 실패 방식이 둘이다 — 한 권이라도 30초를 넘기면 **야간 작업 전체가 죽고**,
-- 안 넘겨도 312×2회면 40분+ 짜리 작업이 된다. **타임아웃 조정으로는 못 고친다.**
--
-- ── 무엇을 바꾸나 ──────────────────────────────────────────────────
--   ① 도서당 호출 2회 → **1회**. temp table 에 한 번 받아 양방향 차집합을 그 위에서 뺀다.
--   ② 전권 매일 → **회전 표본**. 밤마다 40권씩 "가장 오래 안 잰 것부터" 돈다.
--      런타임이 고정되고(≈2~3분), 전권 순회는 약 8일에 끝난다.
--      감지가 하루 → 최대 8일로 늦어지지만, 지금은 **아예 못 재고 있다**.
--   ③ 권당 예외를 잡는다. 한 권이 죽어도 야간 전체가 죽지 않는다.
--      다만 **조용히 넘기지 않는다** — `failed_reason` 에 남기고 dims 의 `unmeasurable` 로 낸다.
--   ④ 지표는 이번 밤에 잰 것이 아니라 **누적 표 전체**에서 낸다. 표본이 도는 동안에도
--      "지금 어긋난 책이 몇 권인지" 는 전권 기준으로 답해야 한다.
--
-- 드리프트 정의(I10 동일)는 바꾸지 않는다 — `(chapter_idx, word)` 대칭차집합이다.
--
-- ⚠️ 이 마이그레이션은 함수 본문을 **앵커로 잘라 가운데만 갈아 끼운다.** 통째로 다시 쓰지
--    않는 이유: 저장소의 20260814015130 파일과 DB 의 현 정의가 M7 주석 65자만큼 이미
--    어긋나 있었다(M1~M6 은 동일). 통째로 쓰면 그 차이를 조용히 덮게 된다.
--    앵커가 없으면 RAISE 하고 멈추므로 재실행·순서 어긋남에 안전하다.

-- ── ① 회전 상태 표 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quality_drift_checks (
  book_id       uuid PRIMARY KEY REFERENCES public.library_books(id) ON DELETE CASCADE,
  checked_at    timestamptz NOT NULL DEFAULT now(),
  drift         int,          -- NULL = 이번에 못 쟀다(아래 failed_reason 참조)
  failed_reason text          -- 시간 초과 등. NULL 이면 정상 측정
);

COMMENT ON TABLE public.quality_drift_checks IS
  'M7 드리프트 회전 표본의 상태. 밤마다 checked_at 이 가장 오래된 40권을 다시 잰다. drift IS NULL AND failed_reason IS NOT NULL = 그 책은 30초 안에 못 쟀다는 뜻(조용히 넘기지 않는다).';

ALTER TABLE public.quality_drift_checks ENABLE ROW LEVEL SECURITY;
-- 정책을 두지 않는다 = service_role 전용. 학습자·익명에게 낼 내용이 아니다.
REVOKE ALL ON public.quality_drift_checks FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_qdc_rotation ON public.quality_drift_checks (checked_at);

-- ── ② M7 만 치환 (M1~M6 은 한 글자도 건드리지 않는다) ──────────────
DO $mig$
DECLARE
  v_src      text;
  v_m7_start int;
  v_tail     int;
  v_new      text;
  v_calls    int;
  v_new_m7 text := $m7$  -- M7 (publish) — 발행 세트 SSoT 드리프트 (I10 과 동일 정의 · 발행 도서 한정)
  --
  -- ⚠️ **회전 표본이다.** 2026-08-29 에 274권/9,636세트가 한꺼번에 발행되면서 대상이
  --    38 → 312권이 됐고 전권 야간 측정이 불가능해졌다(권당 0.52~18.4초 · 함수 상한 30초).
  --    밤마다 c_batch 권씩 "가장 오래 안 잰 것부터" 돈다. 전권 순회 ≈ 8일.
  --
  -- ⚠️ **도서당 select_book_chapter_vocab 를 1회만** 부른다. 예전엔 EXCEPT 양방향에 각각
  --    써서 2회였다 — 원본 주석은 "도서당 1회" 라고 적고 있었지만 사실이 아니었다.
  --
  -- ⚠️ 권당 예외를 잡아 한 권이 죽어도 야간 전체가 죽지 않게 한다. 대신 조용히 넘기지
  --    않는다 — failed_reason 에 남기고 dims.unmeasurable 로 낸다.
  --
  -- ⚠️ **`when others` 만으로는 못 잡는다.** plpgsql 의 OTHERS 는 `query_canceled` 와
  --    `assert_failure` 를 **일부러 제외**한다(PostgreSQL 문서). statement timeout 이
  --    바로 그 query_canceled(57014)라, 막으려던 실패 모드가 그대로 빠져나간다.
  --    그래서 이름을 명시해 잡는다. 다만 그러면 관리자의 취소(pg_cancel_backend)도
  --    한 권만큼 삼켜지므로, 대신 **전체 예산(c_budget)** 을 둬서 작업이 폭주하지 못하게 한다.
  declare
    c_batch  constant int := 40;
    c_budget constant interval := interval '10 minutes';
    v_start  timestamptz := clock_timestamp();
    v_early  boolean := false;
    v_book   record;
    v_drift  int;
    v_did    int := 0;
    v_fail   int := 0;
  begin
    for v_book in
      select b.id, b.title
      from library_books b
      left join quality_drift_checks q on q.book_id = b.id
      where b.status = 'published'
        and exists (select 1 from shared_word_sets s
                    where s.category = 'library_book' and s.is_published
                      and (s.curation_query->>'book_id') = b.id::text)
      order by q.checked_at asc nulls first, b.id
      limit c_batch
    loop
      -- 예산을 넘기면 남은 책은 다음 밤으로 넘긴다 (checked_at 이 오래된 순이라 순회는 이어진다).
      if clock_timestamp() - v_start > c_budget then
        v_early := true;
        exit;
      end if;
      begin
        drop table if exists _cur;
        drop table if exists _pub;
        -- 현 추출 결과 — 여기서 딱 한 번 평가된다.
        create temp table _cur as
          select chapter_idx as ci, word as w
          from select_book_chapter_vocab(v_book.id);
        -- 발행된 세트
        create temp table _pub as
          select (s.curation_query->>'chapter_idx')::int as ci, lower(sw.word) as w
          from shared_word_sets s join shared_words sw on sw.set_id = s.id
          where s.category = 'library_book' and s.is_published
            and (s.curation_query->>'book_id') = v_book.id::text;
        select (select count(*) from (select ci, w from _cur except select ci, w from _pub) a)
             + (select count(*) from (select ci, w from _pub except select ci, w from _cur) b)
          into v_drift;
        insert into quality_drift_checks (book_id, checked_at, drift, failed_reason)
        values (v_book.id, v_now, v_drift, null)
        on conflict (book_id) do update
          set checked_at = excluded.checked_at, drift = excluded.drift, failed_reason = null;
        v_did := v_did + 1;
      exception when query_canceled or others then
        -- 못 잰 것도 checked_at 을 갱신한다 — 안 그러면 이 한 권이 회전을 영영 막는다.
        insert into quality_drift_checks (book_id, checked_at, drift, failed_reason)
        values (v_book.id, v_now, null, left(sqlerrm, 200))
        on conflict (book_id) do update
          set checked_at = excluded.checked_at, drift = null, failed_reason = excluded.failed_reason;
        v_fail := v_fail + 1;
      end;
    end loop;
    drop table if exists _cur;
    drop table if exists _pub;

    -- 지표는 **누적 표 전체**에서 낸다. 이번 밤에 잰 40권만으로는 "지금 몇 권이 어긋났나" 를
    -- 답할 수 없다. 표본이 도는 중에도 답은 전권 기준이어야 한다.
    insert into quality_metrics (measured_at, stage, metric, value, dims)
    select v_now, 'publish', m.metric, m.val,
           jsonb_build_object(
             'books_eligible', (select count(*) from library_books b
                                where b.status = 'published'
                                  and exists (select 1 from shared_word_sets s
                                              where s.category = 'library_book' and s.is_published
                                                and (s.curation_query->>'book_id') = b.id::text)),
             'books_measured', (select count(*) from quality_drift_checks where drift is not null),
             'checked_this_run', v_did,
             'failed_this_run', v_fail,
             'stopped_on_budget', v_early,
             'oldest_check', (select min(checked_at) from quality_drift_checks),
             -- 어긋난 책이 없으면 {} — null 로 두면 화면이 "측정 안 됨" 과 구별하지 못한다.
             'drifted', coalesce((select jsonb_object_agg(b.title, q.drift)
                                  from quality_drift_checks q join library_books b on b.id = q.book_id
                                  where q.drift > 0), '{}'::jsonb),
             -- 못 잰 책. 비어 있어야 정상이다.
             'unmeasurable', coalesce((select jsonb_object_agg(b.title, q.failed_reason)
                                       from quality_drift_checks q join library_books b on b.id = q.book_id
                                       where q.failed_reason is not null), '{}'::jsonb)
           )
    from (select count(*) filter (where drift > 0)::numeric as books,
                 coalesce(sum(drift), 0)::numeric as words
          from quality_drift_checks where drift is not null) t,
    lateral (values ('published_set_ssot_drift_books', t.books),
                    ('published_set_ssot_drift_words', t.words)) as m(metric, val)
    where exists (select 1 from quality_drift_checks where drift is not null);
  end;

$m7$;
BEGIN
  SELECT p.prosrc INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'collect_quality_metrics';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'collect_quality_metrics() 가 없다 — 20260814015130 이 먼저 적용돼야 한다';
  END IF;

  v_m7_start := position('  -- M7 (publish)' in v_src);
  v_tail     := position('  select count(*)::int into v_rows' in v_src);
  IF v_m7_start = 0 OR v_tail = 0 OR v_tail <= v_m7_start THEN
    RAISE EXCEPTION 'M7 앵커를 못 찾았다 (m7=% tail=%) — 본문이 예상과 다르다. 덮어쓰지 않는다',
      v_m7_start, v_tail;
  END IF;

  -- M1~M6(앞부분)과 꼬리는 원본 그대로 두고 가운데만 갈아 끼운다.
  v_new := left(v_src, v_m7_start - 1) || v_new_m7 || substr(v_src, v_tail);

  -- ⚠️ 여는 괄호까지 세야 한다. 함수명만 세면 **주석에 쓴 이름까지 잡혀** 오판한다
  --    (첫 적용 시 실제로 "2회" 로 잡혀 이 가드가 정상 치환을 막았다).
  SELECT count(*) INTO v_calls FROM regexp_matches(v_new, 'select_book_chapter_vocab\(', 'g');
  IF v_calls <> 1 THEN
    RAISE EXCEPTION '치환 후 select_book_chapter_vocab() 호출이 %회다 — 1회여야 한다', v_calls;
  END IF;

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.collect_quality_metrics() '
    'RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''public'' AS %L',
    v_new);
END
$mig$;
