-- supabase/deploy/learning-outcomes-20261021/rationale-correction-rollback.sql
-- PROPOSAL ONLY; no shared DB execution. Recovery requires separate explicit approval and is blocked after qualification/admission.
-- Caller must use one transaction. Source, payload, choices, primary keys and attempt rows are preserved.
DO $rationale_correction$
DECLARE r record; current_item record; current_content text; affected integer;
BEGIN
  SELECT content INTO current_content FROM public.library_articles WHERE id='003946dd-f5e6-4efe-9254-b7a69ca39e61' FOR SHARE;
  IF current_content IS NULL OR encode(sha256(convert_to(current_content,'UTF8')),'hex') <> '33dc4880f42b6b5815b93da059beb2dae640b138371e0cb1992ad46ba6452b0f' THEN
    RAISE EXCEPTION 'rationale correction: source changed';
  END IF;
  FOR r IN SELECT * FROM (VALUES
    ('4dbcca67-2e17-4e96-a2d1-9d513b4b87b6'::uuid,'title','21bb9ea4c343560ccbe1a880c3020d1f22f89454d8d41693270daba4b0391ca1','22f9c79b4d320496f425741b7224271b577d8a5c92c46de50ced448af96d5362','{"answer":1,"rationale_ko":"이 발췌는 같은 그림에 서로 다른 제목을 붙이는 가정 사례를 든 뒤 \"a title tells the eye where to begin\"이라고 이유를 밝힌다. 이어 \"the first words attached to it become a kind of route through the frame\"이라고 설명하며, 마지막 문장은 노래와 이야기로 같은 원리를 확장한다. 따라서 제목이 보는 방향을 이끈다는 ①이 발췌 전체를 묶는다. ②의 이름을 없애야 한다는 권고와 ③의 작품 명명 권리는 발췌에 없다. ④는 시선을 이끄는 원인을 색 선택으로 바꾸지만 글은 제목의 언어를 다룬다. ⑤는 제목이 다르기 때문에 두 집단의 관찰이 달라진 사례를 집단들이 좀처럼 의견을 같이하지 않는 일반적인 현상으로 넓힌다."}'::jsonb,'글은 "a title tells the eye where to begin" 이라고 하고, 그 길이 정해지면 "the details along it feel important and the rest fades into background" 라고 마무리한다. 제목이 시선을 이끈다는 것이 요지다. 나머지는 소재만 같고 결론이 다르다 — ②는 이름을 붙이지 말자는 주장이라 글과 반대고, ③는 누가 이름을 정하느냐는 권리 문제로 글에 없다. ④는 색을 다루지만 글은 색이 아니라 말을 다루고, ⑤는 두 무리가 다르게 본 것을 근거로 쓰지만 그것은 예시일 뿐 주장이 아니다.'),
    ('33ee70d0-d812-49b1-9098-d97f7aaee5af'::uuid,'topic','a23f3d0c8f7b92f910ebf4a1fb316b9b3ebc0ac40d9490c1b91baa1b597d8269','2fdabbd16a92b763f28b858d62cd53ed29ecc02cac1dde78a91684eab58fbb4e','{"answer":2,"rationale_ko":"글은 같은 그림에 다른 제목을 붙이는 가정 사례로 시선의 차이를 보여 준 뒤 \"a title tells the eye where to begin\"이라고 설명하고, 제목에 대해 \"It belongs to the work, and choosing it is a real decision.\"이라고 판단한다. 중심은 제목이 감상의 경로를 정하고 작품의 일부로 작용한다는 것이므로 ②가 주제다. ①의 노래·이야기와 그림 사이 명명 난도 비교는 글에 없다. ③의 관람객 전반이 하늘을 먼저 보는 경향도 글의 주장이 아니다. 원문은 제목에 따라 한 집단은 하늘, 다른 집단은 구석 인물을 본다는 사례를 든다. ④는 제목을 완성 뒤에만 붙여야 한다는 권고로, 제목을 사후에 붙는 표지로 보지 않는 글의 판단과 어긋난다. ⑤는 일부 작가의 무제 선택이라는 마지막 사례를 현대의 일반 습관으로 넓히며 글 전체의 중심을 대신한다."}'::jsonb,'같은 그림에 다른 제목을 주면 다른 장면을 보게 되는데, "a title tells the eye where to begin" 이기 때문이다. 나머지는 하늘이나 구석의 인물처럼 그 현상을 보여주려고 든 예시다.')
  ) v(id, item_type, payload_sha, old_answer_sha, proposed_answer, replacement_rationale) ORDER BY id LOOP
    SELECT * INTO current_item FROM public.csat_dcp_items WHERE id=r.id FOR UPDATE;
    IF NOT FOUND OR current_item.kind <> 'article' OR current_item.ref_id::text <> '003946dd-f5e6-4efe-9254-b7a69ca39e61'
       OR current_item.type <> r.item_type OR current_item.paragraph_idx <> 0 OR current_item.item_role <> 'practice'
       OR encode(sha256(convert_to(current_item.payload::text,'UTF8')),'hex') <> r.payload_sha THEN
      RAISE EXCEPTION 'rationale correction: row changed %',r.id;
    END IF;
    IF current_item.answer_key IS DISTINCT FROM r.proposed_answer THEN
      RAISE EXCEPTION 'rationale correction: answer key changed %',r.id;
    END IF;
    IF EXISTS(SELECT 1 FROM public.content_qualification q WHERE q.artifact_kind='dcp_item' AND q.artifact_ref=r.id::text)
       OR EXISTS(SELECT 1 FROM public.factory_dcp_admission a WHERE a.dcp_item_id=r.id) THEN
      RAISE EXCEPTION 'rationale correction: qualification/admission already exists %',r.id;
    END IF;
    UPDATE public.csat_dcp_items SET answer_key=jsonb_set(answer_key,'{rationale_ko}',to_jsonb(r.replacement_rationale::text),false) WHERE id=r.id;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected <> 1 THEN RAISE EXCEPTION 'rationale correction: expected one row %',r.id; END IF;
  END LOOP;
END $rationale_correction$;
