-- docs/AI_CONTEXT/rollback/db-audit-2026-09-23-rollback.sql
--
-- **2026-09-23 DB 조사 조치 5편의 되돌리기.** 적용 직전 실측 스냅샷(10:28:24 UTC)에서 만들었다.
-- 조사·근거: docs/reports/db-audit-2026-09-23.md
--
-- 적용 직전 상태: public 정책 **150개** · mv_lemma_dominant_pos **11,085행** ·
--   csat_items_public ACL `{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,
--   authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`
--
-- ⚠️ 섹션별로 필요한 것만 돌린다. 전부 한꺼번에 돌리면 조치가 통째로 사라진다.

-- ═══ ① csat_items_public 권한 복원 ═══════════════════════════════════
-- (되돌리면 anon 이 다시 기출 802문항의 answer 를 읽고 고칠 수 있게 된다 — 정말 필요한지 보라)
GRANT ALL ON TABLE public.csat_items_public TO anon;
GRANT ALL ON TABLE public.csat_items_public TO authenticated;
COMMENT ON VIEW public.csat_items_public IS NULL;

-- ═══ ② english_irregular_forms 정책 제거 ═════════════════════════════
DROP POLICY IF EXISTS english_irregular_forms_read ON public.english_irregular_forms;

-- ═══ ③ cron · autovacuum 복원 ════════════════════════════════════════
SELECT cron.schedule(
  'refresh-textbook-shelf-stats',
  '*/30 * * * *',
  $cron$SELECT public.refresh_textbook_shelf_stats()$cron$
);
SELECT cron.unschedule('refresh-lemma-dominant-pos');

-- 적용 전 reloptions: library_article_vocabularies 는 **없었다**(NULL).
ALTER TABLE public.library_article_vocabularies RESET (autovacuum_vacuum_scale_factor);
-- csat_dcp_items 는 아래 4개만 있었다(이 RESET 은 내가 더한 것만 지운다):
--   autovacuum_vacuum_insert_threshold=2000 · autovacuum_vacuum_insert_scale_factor=0.01
--   autovacuum_analyze_threshold=2000 · autovacuum_analyze_scale_factor=0.01
ALTER TABLE public.csat_dcp_items RESET (autovacuum_vacuum_scale_factor);
-- 참고: library_book_vocabularies 의 autovacuum_vacuum_scale_factor=0.05 는 **내가 넣은 것이 아니다**.
--       건드리지 않았다.

-- ═══ ④ RLS — 죽은 service_role 정책 11개 복원 ════════════════════════
-- polroles 가 {0} 이었으므로 TO public 이다. wcheck 유무를 그대로 재현했다.
CREATE POLICY service_role_all_article_vocab ON public.library_article_vocabularies
  FOR ALL TO public USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));
CREATE POLICY service_role_all_vocab ON public.library_book_vocabularies
  FOR ALL TO public USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));
CREATE POLICY service_role_all_articles ON public.library_articles
  FOR ALL TO public USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));
CREATE POLICY service_role_all_chunks ON public.content_chunks
  FOR ALL TO public USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));
CREATE POLICY service_role_all_chapters ON public.library_chapters_master
  FOR ALL TO public USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));
CREATE POLICY service_role_all_books ON public.library_books
  FOR ALL TO public USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));
CREATE POLICY service_role_all_catalogs ON public.library_source_catalogs
  FOR ALL TO public USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "service write dictionary" ON public.shared_dictionary
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service write categories" ON public.dictionary_categories
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service write word categories" ON public.dictionary_word_categories
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY lexicon_frequencies_admin_write ON public.lexicon_frequencies
  FOR ALL TO service_role USING (true);

-- ═══ ④-b RLS — 감싼 62개 정책을 맨몸으로 되돌리기 ════════════════════
-- 감싸기는 **의미가 같다**(인자 없는 STABLE 함수). 그래서 되돌릴 이유는 성능뿐이고,
-- 성능은 감싼 쪽이 낫다. 정말 필요하면 아래를 거꾸로 돌리는 DO 블록을 쓴다:
--
--   -- '( SELECT auth.uid() AS uid)' → 'auth.uid()' 로 되돌린다
--   DO $r$ DECLARE r record; nq text; nw text; BEGIN
--     FOR r IN SELECT c.relname t, pol.polname n,
--                pg_get_expr(pol.polqual,pol.polrelid) q,
--                pg_get_expr(pol.polwithcheck,pol.polrelid) w
--              FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid
--              JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public'
--     LOOP
--       nq := replace(replace(replace(coalesce(r.q,''),
--               '( SELECT auth.uid() AS uid)','auth.uid()'),
--               '( SELECT auth.jwt() AS jwt)','auth.jwt()'),
--               '( SELECT auth.role() AS role)','auth.role()');
--       nw := replace(replace(replace(coalesce(r.w,''),
--               '( SELECT auth.uid() AS uid)','auth.uid()'),
--               '( SELECT auth.jwt() AS jwt)','auth.jwt()'),
--               '( SELECT auth.role() AS role)','auth.role()');
--       CONTINUE WHEN nq = coalesce(r.q,'') AND nw = coalesce(r.w,'');
--       EXECUTE format('ALTER POLICY %I ON public.%I', r.n, r.t)
--             || CASE WHEN nq<>'' THEN format(' USING (%s)', nq) ELSE '' END
--             || CASE WHEN nw<>'' THEN format(' WITH CHECK (%s)', nw) ELSE '' END;
--     END LOOP; END $r$;
--
-- 주의: 적용 전에 이미 감싸져 있던 정책 3개(`csat_review_queue_own` ·
-- `csat_session_attempts_own` · `vrl_concerns_admin_read`)까지 함께 풀린다.

-- ═══ ⑤ 죽은 뷰 6개 복원 ══════════════════════════════════════════════
CREATE OR REPLACE VIEW public.user_vocab_enriched AS
 SELECT v.id, v.user_id, v.word, v.lemma, v.meaning,
    v.cefr_level AS user_cefr, v.difficulty, v.stability,
    v.last_review_at, v.next_review_at, v.review_count, v.module_history,
    sd.v_level AS dict_v_level, sd.cefr_level AS dict_cefr,
    sd.meaning_ko AS dict_meaning_ko, sd.primary_pos
   FROM vocabularies v
     LEFT JOIN shared_dictionary sd ON sd.word = COALESCE(v.lemma, v.word);

CREATE OR REPLACE VIEW public.word_mislevel_signal AS
 SELECT wf.lemma,
    count(*) FILTER (WHERE wf.verdict = 'known'::text) AS known_ct,
    count(*) FILTER (WHERE wf.verdict = 'unknown'::text) AS unknown_ct,
    round(avg(wf.v_level) FILTER (WHERE wf.verdict = 'known'::text), 1) AS known_avg_v,
    round(avg(wf.v_level) FILTER (WHERE wf.verdict = 'unknown'::text), 1) AS unknown_avg_v,
    d.v_level AS dict_v_level
   FROM word_familiarity wf
     LEFT JOIN shared_dictionary d ON d.word = wf.lemma
  GROUP BY wf.lemma, d.v_level;

CREATE OR REPLACE VIEW public.v_dict_pos_sense_gap AS
 WITH agg AS (
         SELECT v.lemma AS head, v.context_pos AS cp,
            sum(v.frequency_in_book)::integer AS occ
           FROM library_book_vocabularies v
          WHERE v.lemma IS NOT NULL AND v.context_pos IS NOT NULL
          GROUP BY v.lemma, v.context_pos
        ), dom AS (
         SELECT DISTINCT ON (agg.head) agg.head, agg.cp AS dominant_pos, agg.occ
           FROM agg ORDER BY agg.head, agg.occ DESC
        )
 SELECT d.head AS headword, d.dominant_pos AS corpus_dominant_pos, sd.pos AS dict_pos,
    d.occ AS dominant_pos_occurrences, sd.meaning_ko AS current_meaning_ko, sd.v_level
   FROM dom d
     JOIN shared_dictionary sd ON sd.word = d.head
  WHERE sd.pos IS NOT NULL AND d.dominant_pos <> sd.pos AND d.occ >= 30
    AND (d.dominant_pos = ANY (ARRAY['noun'::text, 'verb'::text, 'adjective'::text, 'adverb'::text]))
    AND (sd.pos = ANY (ARRAY['noun'::text, 'verb'::text, 'adjective'::text, 'adverb'::text]))
    AND NOT (EXISTS ( SELECT 1
           FROM jsonb_array_elements(COALESCE(sd.meanings_ko, '[]'::jsonb)) s(value)
          WHERE (s.value ->> 'pos'::text) = d.dominant_pos));

CREATE OR REPLACE VIEW public.v_book_extraction_reasons AS
 SELECT library_book_id AS book_id,
        CASE
            WHEN lemma IS NOT NULL THEN 'bound'::text
            WHEN noise_kind = 'person_noise'::text THEN 'noise_person'::text
            WHEN noise_kind = 'geo_noise'::text THEN 'noise_geo'::text
            WHEN COALESCE(resolved_lang, 'en'::text) <> 'en'::text THEN 'foreign_'::text || resolved_lang
            WHEN resolved_via = ANY (ARRAY['dialect'::text, 'spelling'::text, 'variant'::text]) THEN 'dialect_spelling'::text
            WHEN resolved_via = ANY (ARRAY['derivation'::text, 'normalized'::text, 'normalized-coverage'::text, 'cluster'::text, 'inflection'::text]) THEN 'morphology'::text
            WHEN resolved_via = ANY (ARRAY['coverage-clean'::text, 'suggestion'::text, 'direct'::text]) THEN 'lexicon_only'::text
            ELSE 'unresolved'::text
        END AS bucket,
    count(*)::integer AS words,
    COALESCE(sum(frequency_in_book), 0::bigint) AS occurrences
   FROM library_book_vocabularies
  GROUP BY library_book_id, (
        CASE
            WHEN lemma IS NOT NULL THEN 'bound'::text
            WHEN noise_kind = 'person_noise'::text THEN 'noise_person'::text
            WHEN noise_kind = 'geo_noise'::text THEN 'noise_geo'::text
            WHEN COALESCE(resolved_lang, 'en'::text) <> 'en'::text THEN 'foreign_'::text || resolved_lang
            WHEN resolved_via = ANY (ARRAY['dialect'::text, 'spelling'::text, 'variant'::text]) THEN 'dialect_spelling'::text
            WHEN resolved_via = ANY (ARRAY['derivation'::text, 'normalized'::text, 'normalized-coverage'::text, 'cluster'::text, 'inflection'::text]) THEN 'morphology'::text
            WHEN resolved_via = ANY (ARRAY['coverage-clean'::text, 'suggestion'::text, 'direct'::text]) THEN 'lexicon_only'::text
            ELSE 'unresolved'::text
        END);

CREATE OR REPLACE VIEW public.v_user_book_progress AS
 SELECT t.user_id, t.library_book_id, lb.title, lb.author, lb.cover_from, lb.cover_to, lb.cefr_level,
    count(*) AS total_chapters,
    count(*) FILTER (WHERE t.status = ANY (ARRAY['completed'::text, 'conquered'::text, 'extracted'::text])) AS done_chapters,
    round(avg(t.progress_percent), 1) AS avg_progress_percent,
    max(t.updated_at) AS last_activity
   FROM texts t
     JOIN library_books lb ON lb.id = t.library_book_id
  WHERE t.library_book_id IS NOT NULL
  GROUP BY t.user_id, t.library_book_id, lb.title, lb.author, lb.cover_from, lb.cover_to, lb.cefr_level;

CREATE OR REPLACE VIEW public.v_extraction_quality_audit AS
 WITH cov AS (
         SELECT count(DISTINCT book_extraction_audit.library_book_id)::integer AS audited,
            ( SELECT count(*)::integer AS count
                   FROM library_books
                  WHERE library_books.status = ANY (ARRAY['ready'::text, 'published'::text])) AS total,
            min(book_extraction_audit.computed_at) AS oldest
           FROM book_extraction_audit
        )
 SELECT defect,
        CASE defect
            WHEN '01 반대말 결합'::text THEN 'DEFECT — lemma 가 표면형의 부정 의미를 잃음 (imprudent→prudent)'::text
            WHEN '02 register 노이즈 오결합'::text THEN 'DEFECT — 굴절/파생 폴백이 proper_noun/brand/abbreviation 표제어에 닿음 (dren→dr)'::text
            WHEN '03 문맥POS 미대응 sense'::text THEN 'DEFECT(사전 내용) — 문맥 POS 와 사전 POS 가 다르고 대응 sense 도 없음. 작업 큐: v_dict_pos_sense_gap'::text
            WHEN '04 유령 어휘(본문에 없음)'::text THEN 'DEFECT — 본문에 없는 행. 파이프라인이 구조적으로 차단(keepLemmaOnlyIfInText) — 0 이 아니면 구 데이터'::text
            WHEN '05 HTML 엔티티 잔존'::text THEN 'DEFECT — 본문/근거문장에 &#NNNN; 미디코딩 (ingester decodeEntities 회귀 신호)'::text
            ELSE 'INFO — 결함 아님. 본문에 실재하나 어떤 사전에도 없는 말. dict-selfheal 드레인 대상'::text
        END AS detail,
    sum(rows)::integer AS rows,
    sum(occurrences)::bigint AS occurrences,
    sum(words)::integer AS words_per_book_sum,
    count(*) FILTER (WHERE rows > 0)::integer AS books_with_defect,
    ( SELECT cov.audited FROM cov) AS books_audited,
    ( SELECT cov.total FROM cov) AS books_total,
    ( SELECT cov.oldest FROM cov) AS oldest_computed_at
   FROM book_extraction_audit a
  GROUP BY defect;
