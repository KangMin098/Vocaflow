CREATE TEMP TABLE _grass_reviewed ON COMMIT DROP AS
  SELECT * FROM (VALUES
    ('ee5a3e66-ee79-489f-b639-5a74c9b97a71'::uuid, 'title', '{"passage":"Springtime is a time of renewal and growth. Many plants end their long winter sleep and form new buds and shoots. Beautiful flowers will soon be showing their bright colors. And the grass will grow thicker and greener again. Some flowers bloom in a very noticeable way but that is not the case with grass. Imagine you are sitting in a grassy field. And you have only one job – to watch the grass grow. That does not sound very interesting. In fact, it sounds really boring. That idea is what gives us the expression “like watching grass grow.” We use this expression to describe an experience that is uninteresting. Another good word to describe it is tedious. We use this expression in many situations. Let’s hear a few examples: After the politician won his campaign, he gave a two-hour long acceptance speech. Two hours! It was as much fun as watching grass grow. I really don’t like watching long sports games. It’s like watching grass grow. Now, grass grows on the ground all the time. And usually, we don’t give it much thought. If you stand in one place for a long time, the grass will continue to grow under your feet. For people who are always active, always moving, always on-the-go, we can say they don''t let grass grow under their feet. We can also say beneath their feet. And sometimes we use this expression as a command. Let’s hear some examples: Don’t let the grass grow beneath your feet. Get back to work. She certainly doesn’t let the grass grow under her feet. She’s been traveling non-stop for over a year.","choices":["How Spring Brings New Life to Every Plant","Two Grass Expressions: Dull Tasks and Busy People","Why Long Speeches Make Every Audience Tired","Simple Tips for Growing Thicker, Greener Grass","Sports Games That Last Too Long to Enjoy"],"stem_ko":"다음 글의 제목으로 가장 적절한 것은?","underline":null,"choice_language":"en","summary_sentence":null}'::jsonb, '{"answer":2,"rationale_ko":"글은 \"like watching grass grow\"(지루한 경험)와 \"they don''t let grass grow under their feet\"(늘 바쁘게 움직이는 사람) 두 표현을 차례로 설명한다. 그래서 ②가 제목이다. ①④는 봄·잔디 장면을 표현의 출발점으로 쓴 것을 식물 이야기로 오해한 것이고, ③⑤는 예문 하나씩일 뿐이라 나머지는 오답이다."}'::jsonb),
    ('417b9e52-a732-40ab-ab07-973c14455533'::uuid, 'topic', '{"passage":"Springtime is a time of renewal and growth. Many plants end their long winter sleep and form new buds and shoots. Beautiful flowers will soon be showing their bright colors. And the grass will grow thicker and greener again. Some flowers bloom in a very noticeable way but that is not the case with grass. Imagine you are sitting in a grassy field. And you have only one job – to watch the grass grow. That does not sound very interesting. In fact, it sounds really boring. That idea is what gives us the expression “like watching grass grow.” We use this expression to describe an experience that is uninteresting. Another good word to describe it is tedious. We use this expression in many situations. Let’s hear a few examples: After the politician won his campaign, he gave a two-hour long acceptance speech. Two hours! It was as much fun as watching grass grow. I really don’t like watching long sports games. It’s like watching grass grow. Now, grass grows on the ground all the time. And usually, we don’t give it much thought. If you stand in one place for a long time, the grass will continue to grow under your feet. For people who are always active, always moving, always on-the-go, we can say they don''t let grass grow under their feet. We can also say beneath their feet. And sometimes we use this expression as a command. Let’s hear some examples: Don’t let the grass grow beneath your feet. Get back to work. She certainly doesn’t let the grass grow under her feet. She’s been traveling non-stop for over a year.","choices":["the way plants form new buds and shoots each spring","the meanings of two English expressions about grass","the reasons politicians give long acceptance speeches","the best ways for busy people to keep moving all day","the difference between noticeable flowers and grass"],"stem_ko":"다음 글의 주제로 가장 적절한 것은?","underline":null,"choice_language":"en","summary_sentence":null}'::jsonb, '{"answer":2,"rationale_ko":"\"We use this expression to describe an experience that is uninteresting.\" 처럼 글의 중심은 grass 가 들어간 두 표현의 뜻과 쓰임이다. 그래서 ②가 주제다. ①⑤는 표현을 끌어내려고 쓴 봄·꽃 장면이고, ③은 예문 하나, ④는 표현의 뜻을 생활 조언으로 바꾼 것이라 나머지는 오답이다."}'::jsonb)
  ) AS v(id, type, payload, answer_key);

DO $$
DECLARE n int; src text;
BEGIN
  -- ① 현행 getter 가 저장소 201035 정의인가
  SELECT p.prosrc INTO src FROM pg_proc p
   WHERE p.oid = 'public.article_practice_items(uuid)'::regprocedure
     AND p.prosecdef AND p.provolatile = 's' AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'sql');
  IF src IS NULL THEN RAISE EXCEPTION 'grass-r0: getter missing or attributes drift'; END IF;
  IF encode(sha256(convert_to(src,'UTF8')),'hex') NOT IN ('277e06acb9a2c8a91cb629245af258419f14a9ebdd7c1aab170b256939efdef2', '790de1b0fd49250147c72cff1d57f1248d806f0b2185bdf0aaa197905d1cbc55')
    THEN RAISE EXCEPTION 'grass-r0: getter body is not repo 20261027201035 — stop'; END IF;

  -- ①' v_level 열이 NULL 을 받고, v_level 을 건드리는 CHECK 가 없어야 한다
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'csat_dcp_items' AND column_name = 'v_level' AND is_nullable = 'YES')
    THEN RAISE EXCEPTION 'grass-r0: csat_dcp_items.v_level not nullable — stop'; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.csat_dcp_items'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%v_level%')
    THEN RAISE EXCEPTION 'grass-r0: CHECK on v_level exists — stop'; END IF;

  -- ② Grass 원문·권리·중복
  PERFORM 1 FROM public.library_articles WHERE id = '9c168596-028f-4517-a2f1-e97c942590a9' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'grass-r0: article missing'; END IF;
  IF (SELECT encode(sha256(convert_to(content,'UTF8')),'hex') FROM public.library_articles WHERE id = '9c168596-028f-4517-a2f1-e97c942590a9') IS DISTINCT FROM '094e6793032672f3d8a4d9761841d8ff41303285a5eea0c4ef1ec67a9e0f4b3a'
    THEN RAISE EXCEPTION 'grass-r0: article body drift'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.library_articles WHERE id = '9c168596-028f-4517-a2f1-e97c942590a9' AND status = 'published' AND copyright_safe_in_kr IS TRUE AND NOT display_only)
    THEN RAISE EXCEPTION 'grass-r0: article not published / rights flag / display_only'; END IF;
  IF NOT public.csat_source_is_gradeable('9c168596-028f-4517-a2f1-e97c942590a9') THEN RAISE EXCEPTION 'grass-r0: source not gradeable'; END IF;
  IF EXISTS (SELECT 1 FROM public.csat_dcp_items WHERE kind = 'article' AND ref_id = '9c168596-028f-4517-a2f1-e97c942590a9' AND type IN ('title','topic','main_point'))
    THEN RAISE EXCEPTION 'grass-r0: central items already exist — stop'; END IF;
  IF EXISTS (SELECT 1 FROM public.csat_dcp_items WHERE id IN ('ee5a3e66-ee79-489f-b639-5a74c9b97a71','417b9e52-a732-40ab-ab07-973c14455533'))
    THEN RAISE EXCEPTION 'grass-r0: id collision'; END IF;

  -- ③ 검토 상수 그대로 2행
  INSERT INTO public.csat_dcp_items (id, kind, ref_id, type, item_role, payload, answer_key, paragraph_idx, v_level)
  SELECT r.id, 'article', '9c168596-028f-4517-a2f1-e97c942590a9'::uuid, r.type, 'practice', r.payload, r.answer_key, 0, NULL FROM _grass_reviewed r;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'grass-r0: expected 2 rows, got %', n; END IF;
  IF EXISTS (SELECT 1 FROM public.csat_dcp_items d JOIN _grass_reviewed r USING (id)
              WHERE d.payload::text <> r.payload::text OR d.answer_key::text <> r.answer_key::text OR d.v_level IS NOT NULL)
    THEN RAISE EXCEPTION 'grass-r0: stored rows differ from reviewed constants'; END IF;
END $$;

-- ④ getter 확대 — Lincoln 기대 hash 그대로, Grass 기대 hash 는 같은 상수에서 계산된 문자열을 함수 본문에 고정한다.
DO $$
DECLARE tp text; tk text; pp text; pk text;
BEGIN
  SELECT encode(sha256(convert_to(payload::text,'UTF8')),'hex'), encode(sha256(convert_to(answer_key::text,'UTF8')),'hex') INTO tp, tk FROM _grass_reviewed WHERE type = 'title';
  SELECT encode(sha256(convert_to(payload::text,'UTF8')),'hex'), encode(sha256(convert_to(answer_key::text,'UTF8')),'hex') INTO pp, pk FROM _grass_reviewed WHERE type = 'topic';
  EXECUTE format($f$
CREATE OR REPLACE FUNCTION public.article_practice_items(p_article_id uuid)
RETURNS TABLE(id uuid, type text, paragraph_idx int, payload jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  WITH reviewed(item_id, item_type, article_id, body_sha, payload_sha, key_sha) AS (
    VALUES
      ('b69f287f-7d20-4770-8b88-8dfe0050ad0f'::uuid, 'title', '267ef969-2a3a-4dc9-b6b7-a85246df543f'::uuid, 'f6fce3159b15c2c0cb8c6795d5e6e51f02240eb3725d14f40601b119c195f1df', 'f00480d38a3a5042d7a70823886f193817d9d58114973b78b4cb3b89ccf9044d', '78594a08b016ccb1c269b79f6d01f8b2be856474379b0a3befa38fc85805cdb1'),
      ('b72011b0-91e1-46bc-bf35-d2ef20f1aaea'::uuid, 'topic', '267ef969-2a3a-4dc9-b6b7-a85246df543f'::uuid, 'f6fce3159b15c2c0cb8c6795d5e6e51f02240eb3725d14f40601b119c195f1df', '13c5414752828db377842a92afbd76674b5135e6df2fe18c91b56499b6aff4e2', '2b58349b5f86fbdd8466e71a6970ca4d7e63241aaeba0978bdd0cf1750e13817'),
      ('ee5a3e66-ee79-489f-b639-5a74c9b97a71'::uuid, 'title', '9c168596-028f-4517-a2f1-e97c942590a9'::uuid, '094e6793032672f3d8a4d9761841d8ff41303285a5eea0c4ef1ec67a9e0f4b3a', %L, %L),
      ('417b9e52-a732-40ab-ab07-973c14455533'::uuid, 'topic', '9c168596-028f-4517-a2f1-e97c942590a9'::uuid, '094e6793032672f3d8a4d9761841d8ff41303285a5eea0c4ef1ec67a9e0f4b3a', %L, %L)
  )
  SELECT d.id, d.type, d.paragraph_idx,
         jsonb_strip_nulls(jsonb_build_object(
           'passage', d.payload->'passage',
           'stem_ko', d.payload->'stem_ko',
           'choices', d.payload->'choices',
           'choice_language', d.payload->'choice_language'
         ))
    FROM reviewed r
    JOIN public.csat_dcp_items d ON d.id = r.item_id
    JOIN public.library_articles a ON a.id = d.ref_id
   WHERE auth.uid() IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.user_profiles up
        WHERE up.user_id = auth.uid() AND up.status IN ('suspended', 'deleted'))
     AND p_article_id = r.article_id
     AND d.ref_id = p_article_id
     AND d.kind = 'article'
     AND d.type = r.item_type
     AND a.status = 'published'
     AND a.copyright_safe_in_kr IS TRUE
     AND encode(sha256(convert_to(a.content, 'UTF8')), 'hex') = r.body_sha
     AND encode(sha256(convert_to(d.payload::text, 'UTF8')), 'hex') = r.payload_sha
     AND encode(sha256(convert_to(d.answer_key::text, 'UTF8')), 'hex') = r.key_sha
     AND public.csat_source_is_gradeable(d.ref_id)
   ORDER BY d.type, d.id
$fn$;
$f$, tp, tk, pp, pk);
END $$;
REVOKE ALL ON FUNCTION public.article_practice_items(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.article_practice_items(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.article_practice_items(uuid) TO authenticated;

-- 사후 확인(같은 트랜잭션): 4행 allowlist 에 Lincoln 2행이 그대로 있다
DO $$
BEGIN
  IF (SELECT prosrc FROM pg_proc WHERE oid = 'public.article_practice_items(uuid)'::regprocedure) NOT LIKE '%b69f287f-7d20-4770-8b88-8dfe0050ad0f%78594a08b016ccb1c269b79f6d01f8b2be856474379b0a3befa38fc85805cdb1%'
    THEN RAISE EXCEPTION 'grass-r0: Lincoln binding lost'; END IF;
END $$;