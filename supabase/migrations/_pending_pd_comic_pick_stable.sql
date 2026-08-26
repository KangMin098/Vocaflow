-- supabase/migrations/<ts>_pd_comic_pick_stable.sql
--
-- **같은 만화의 주소가 요청마다 달라진다** — `list_pd_comics` 의 동점 처리가 비결정적이다.
--
-- ── 무엇을 봤나 (2026-08-26 실측) ────────────────────────────────────
-- sitemap 이 알리는 복원 만화 주소와, 서가에서 링크로 닿는 주소가 **3건 어긋났다.**
-- 개수는 양쪽 다 105 로 같은데 가리키는 행이 다르다:
--
--   sitemap : /comics/restored/atomic-war-002-micwar02
--   화면    : /comics/restored/atomic-war-002-02195212
--
-- 둘 다 실재하는 발행 행이다. `Atomic War!` 1~4호가 IA 식별자만 다른 중복으로
-- **9행** 올라와 있고(숨는 행 5), 함수가 그중 한 벌만 내보낸다:
--
--   distinct on (i.series_key, coalesce(i.issue_no::text, i.id::text))
--   order by  … , i.panels_total desc nulls last, i.created_at
--
-- 그런데 그 9행은 **`panels_total` 도 `created_at` 도 전부 같다**
-- (36/36/36/32 · 2026-08-16 14:32:45.278626+00 동일). 동점을 가를 열이 없으니
-- 어느 행이 이기는지는 실행 계획이 정한다 — 같은 질의도 호출마다 달라질 수 있다.
--
-- ── 왜 이것이 중요한가 ──────────────────────────────────────────────
-- 정본 주소가 흔들리면 검색엔진에는 **같은 내용의 서로 다른 URL** 로 보인다.
-- sitemap 이 A 를 알리는데 사이트 안의 링크는 B 를 가리키므로 A 는 고아가 되고,
-- 둘 다 열리므로 중복 콘텐츠로 서로의 순위를 깎는다. 공유된 링크가 다음 배포에서
-- 다른 호를 가리킬 수도 있다.
--
-- ── 왜 중복 행을 지우는 대신 함수를 고치나 ──────────────────────────
-- 중복 정리(5행 발행 취소)는 별개로 필요하고, 그건 **데이터 변경이라 승인이 따로** 든다.
-- 그러나 정리해도 파이프라인이 다시 중복을 실을 수 있다 — IA 는 같은 만화를 여러 식별자로
-- 갖고 있고 그게 정상이다. **어느 쪽이든 함수는 같은 답을 줘야 한다.**
-- 그래서 결정성을 먼저 세운다. 이 마이그레이션만으로 고아 3건이 0이 된다.
--
-- ── 무엇을 바꾸나 ───────────────────────────────────────────────────
-- 정렬 맨 끝에 `i.id` 를 더한다. `id` 는 유일하므로 **동점이 남을 수 없다.**
-- 앞의 우선순위(패널 많은 것 → 먼저 들어온 것)는 그대로다 — 지금 이기는 행이
-- 계속 이길 뿐이고, 다만 **항상** 이긴다.
--
-- 되돌리기: 이 함수를 이전 정의로 다시 CREATE OR REPLACE 하면 된다. 데이터는 건드리지 않는다.

CREATE OR REPLACE FUNCTION public.list_pd_comics(p_series_key text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, slug text, title text, series_title text, issue_no integer,
               published_year integer, cover_url text, panels_total integer, v_level smallint,
               library_book_id uuid, kind text, series_key text, kind_label text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with picked as (
    select distinct on (i.series_key, coalesce(i.issue_no::text, i.id::text))
           i.id, i.slug, i.title, i.series_title, i.issue_no, i.published_year,
           i.cover_url, i.panels_total, i.v_level, i.library_book_id, i.kind, i.series_key
    from public.pd_comic_issues i
    where i.status = 'published'
      and (p_series_key is null or i.series_key = p_series_key)
    -- 맨 끝의 i.id 가 동점을 없앤다. 이것이 없으면 중복 행에서 승자가 계획에 따라 바뀐다.
    order by i.series_key, coalesce(i.issue_no::text, i.id::text),
             i.panels_total desc nulls last, i.created_at, i.id
  )
  select p.id, p.slug, p.title,
         coalesce(s.title, p.series_title), p.issue_no,
         p.published_year, p.cover_url, p.panels_total, p.v_level, p.library_book_id,
         p.kind, p.series_key, k.label
  from picked p
  left join public.pd_comic_series s on s.key = p.series_key
  left join public.pd_comic_kinds  k on k.key = p.kind
  -- 바깥 정렬도 마지막을 유일 열로 닫는다 — 제목이 같은 호가 있으면 목록 순서가 흔들린다.
  order by k.sort_order nulls last, s.title nulls last, p.issue_no nulls last, p.title, p.id
$function$;

COMMENT ON FUNCTION public.list_pd_comics(text) IS
  '발행 복원 만화 목록 — series_key+issue_no 당 한 벌(패널 많은 것 → 먼저 들어온 것 → id). '
  '마지막 id 는 장식이 아니다: Atomic War! 중복 9행은 panels_total 과 created_at 이 모두 같아 '
  '그것이 없으면 sitemap 과 화면이 같은 만화에 서로 다른 주소를 쓴다(2026-08-26 실측).';
