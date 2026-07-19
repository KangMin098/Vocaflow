-- 게이트 원인-분석 드릴다운 — 실패 불변식의 "구체적 문제 단어 + 이유" 반환.
-- 목적: 소스GET/큐레이션 평가 시 무엇을 고칠지 판단 + 발행 콘텐츠 이상 시 원인 분석.
-- 대상: book/article = 학습자 노출 산출물(발행=shared_words, 미발행=select 출력) · word_set = 세트 단어.

CREATE OR REPLACE FUNCTION public.run_content_quality_gate_details(
  p_scope text, p_id uuid
) RETURNS TABLE(invariant text, word text, meaning_shown text, issue text, fix_hint text, extra jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_noise text[] := ARRAY['archaic_literary','period_cultural','phrase_unit','brand','abbreviation','proper_noun'];
  v_published boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;
  IF p_id IS NULL THEN RAISE EXCEPTION 'p_id required'; END IF;

  -- ── word_set: 세트 단어 직접 점검 ──
  IF p_scope = 'word_set' THEN
    RETURN QUERY SELECT 'I7 노이즈', sw.word, sw.meaning_ko,
      '노이즈 register('||sd.word_register||') — 학습 단어 아님', '세트에서 제거 또는 register 재분류',
      jsonb_build_object('register', sd.word_register)
    FROM shared_words sw JOIN shared_dictionary sd ON sd.word=lower(sw.word)
    WHERE sw.set_id=p_id AND sd.word_register = ANY(v_noise);
    RETURN QUERY SELECT '뜻결측', sw.word, sw.meaning_ko, '뜻(meaning_ko)이 비어있음', '사전 뜻 채움 또는 세트 재생성', '{}'::jsonb
    FROM shared_words sw WHERE sw.set_id=p_id AND (sw.meaning_ko IS NULL OR length(sw.meaning_ko)=0);
    RETURN QUERY SELECT 'I5 바인딩', sw.word, sw.meaning_ko,
      '표시된 뜻이 표면형 자체 표제어와 다름(오바인딩 가능·반대뜻 위험)',
      'lemma 를 표면형 표제어로 교정 또는 세트 재생성',
      jsonb_build_object('surface_own_meaning', sd.meaning_ko, 'stored_lemma', sw.lemma)
    FROM shared_words sw JOIN shared_dictionary sd ON sd.word=lower(sw.word)
    WHERE sw.set_id=p_id AND sd.classified_by IS NOT NULL
      AND lower(COALESCE(sw.lemma, sw.word)) <> lower(sw.word)
      AND EXISTS (SELECT 1 FROM shared_dictionary x WHERE x.word=lower(sw.word) AND x.classified_by IS NOT NULL);
    RETURN;
  END IF;

  -- ── book ──
  IF p_scope = 'book' THEN
    SELECT (status='published') INTO v_published FROM library_books WHERE id=p_id;
    IF v_published THEN
      -- 학습자 노출: 발행 세트의 shared_words 점검
      RETURN QUERY SELECT 'I7 노이즈', sw.word, sw.meaning_ko,
        '발행 세트 노이즈 register('||sd.word_register||')', '재발행(republish_book_word_sets) 또는 register 재분류',
        jsonb_build_object('register', sd.word_register, 'set', sws.title)
      FROM shared_word_sets sws JOIN shared_words sw ON sw.set_id=sws.id JOIN shared_dictionary sd ON sd.word=lower(sw.word)
      WHERE sws.category='library_book' AND sws.is_published AND (sws.curation_query->>'book_id')=p_id::text
        AND sd.word_register = ANY(v_noise);
      RETURN QUERY SELECT 'I5 바인딩', sw.word, sw.meaning_ko,
        '표시된 뜻이 표면형 자체 표제어와 다름(오바인딩·반대뜻 위험)', '재발행으로 현 바인딩 반영',
        jsonb_build_object('surface_own_meaning', sd.meaning_ko, 'stored_lemma', sw.lemma, 'set', sws.title)
      FROM shared_word_sets sws JOIN shared_words sw ON sw.set_id=sws.id JOIN shared_dictionary sd ON sd.word=lower(sw.word)
      WHERE sws.category='library_book' AND sws.is_published AND (sws.curation_query->>'book_id')=p_id::text
        AND sd.classified_by IS NOT NULL
        AND lower(COALESCE(sw.lemma, sw.word)) <> lower(sw.word)
        AND EXISTS (SELECT 1 FROM shared_dictionary x WHERE x.word=lower(sw.word) AND x.classified_by IS NOT NULL);
    ELSE
      -- 미발행(ready): 현 추출 산출물(select) 점검 — 큐레이션 결정용
      RETURN QUERY SELECT 'I7 노이즈', v.word, v.meaning_ko,
        '추출 출력 노이즈 register('||sd.word_register||')', '추출 게이트/사전 register 점검',
        jsonb_build_object('register', sd.word_register, 'chapter', v.chapter_idx)
      FROM select_book_chapter_vocab(p_id) v JOIN shared_dictionary sd ON sd.word=v.lemma
      WHERE sd.word_register = ANY(v_noise);
    END IF;
    RETURN;
  END IF;

  -- ── article ──
  IF p_scope = 'article' THEN
    SELECT (status='published') INTO v_published FROM library_articles WHERE id=p_id;
    IF v_published THEN
      RETURN QUERY SELECT 'I7 노이즈', sw.word, sw.meaning_ko,
        '발행 세트 노이즈 register('||sd.word_register||')', '재발행(republish_article_word_set)',
        jsonb_build_object('register', sd.word_register)
      FROM shared_word_sets sws JOIN shared_words sw ON sw.set_id=sws.id JOIN shared_dictionary sd ON sd.word=lower(sw.word)
      WHERE sws.category='library_article' AND sws.is_published AND (sws.curation_query->>'article_id')=p_id::text
        AND sd.word_register = ANY(v_noise);
    ELSE
      RETURN QUERY SELECT 'I7 노이즈', v.word, v.meaning_ko,
        '추출 출력 노이즈 register('||sd.word_register||')', '추출 게이트/사전 register 점검', jsonb_build_object('register', sd.word_register)
      FROM select_article_vocab(p_id) v JOIN shared_dictionary sd ON sd.word=v.lemma
      WHERE sd.word_register = ANY(v_noise);
    END IF;
    RETURN;
  END IF;

  RAISE EXCEPTION 'invalid scope: % (book|article|word_set)', p_scope;
END;
$function$;

ALTER FUNCTION public.run_content_quality_gate_details(text, uuid) SET statement_timeout TO '60000';
-- run_content_quality_gates 와 동일 정책: 내부 가드(auth.uid NOT NULL AND NOT admin → 차단,
-- anon/service 는 guard-skip)로 접근 제어. dev-bypass(anon 브라우저) 드릴다운 지원 위해 PUBLIC execute 유지.
