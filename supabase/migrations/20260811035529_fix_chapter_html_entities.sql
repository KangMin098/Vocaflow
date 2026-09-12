-- 20260811120100_fix_chapter_html_entities.sql
-- 저장된 본문에 남은 HTML 수치 엔티티 제거 — **재수집 없이**.
--
-- 문제 (2026-08-11 실측): Introduction to Sociology 23개 챕터 **전부**에 엔티티가 남아
--   학습자가 읽는 본문에 `&#8220;society&#8221;` 가 그대로 보인다. 총 1,355회:
--     &#8217; 442 · &#8220; 434 · &#8221; 425 · &#8216; 28 · &#8230; 26   (named 엔티티는 없음)
--   원인은 pressbooks ingester 의 decodeEntities 에 수치 fallback 이 없던 것(v06.35 에서 수정).
--   그러나 **이미 적재된 본문은 재수집해야 사라진다** — 그런데 재수집은 library_books DELETE →
--   library_chapters_master/library_book_vocabularies CASCADE + 챕터 단어장 23권 삭제를 동반한다.
--
-- 재수집이 필요 없는 이유:
--   content_chunks 는 content-addressed(hash PK)이고 library_chapters_master.content_hash 가
--   가리킬 뿐이다. **챕터 행·단어장·구독·학습 진도를 하나도 건드리지 않고** 본문 포인터만 바꾸면 된다.
--
-- 오프셋 처리 — 재분절하지 않는다:
--   paragraph_offsets/sentence_offsets 는 0-based 문자 위치라 디코딩하면 전부 밀린다
--   (`&#8220;` 7자 → `“` 1자). 여기서 winkNLP 를 다시 돌려 재분절하면 EchoMatch 문장 경계가
--   달라질 수 있다. 대신 **각 오프셋에서 그 앞에 있는 엔티티들의 축약량 합을 빼서**
--   원래 분절을 그대로 보존한 채 정확히 이동시킨다.
--
--   word_count 는 건드리지 않는다 — 엔티티 디코딩은 단어를 만들지도 없애지도 않는다
--   (`&#8220;society&#8221;` → `“society”` 는 같은 1토큰).
--
-- 멱등: 엔티티가 없으면 그 챕터는 건너뛴다. 여러 번 실행해도 안전.
--
-- 적용 이력: dev 에 이 파일 적용 후 두 가지를 in-flight 로 고쳤고(원격 마이그레이션
--   `20260811035656_fix_chapter_html_entities_qualify_digest` ·
--   `20260811040303_decode_entities_hex_lpad_fix`), **이 파일에는 최종본이 들어 있다**.
--   ① pgcrypto 가 extensions 스키마라 digest() 스키마 한정 필요
--   ② ('x'||hex)::bit(32) 좌측 정렬 — lpad(8) 없으면 0x27 이 654311424 가 된다
--   따라서 이 파일 하나만 재생하면 동일한 최종 상태에 도달한다.

CREATE OR REPLACE FUNCTION public.fix_chapter_html_entities(p_book_id uuid)
RETURNS TABLE(chapter_idx integer, entities integer, old_len integer, new_len integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120000'
AS $function$
DECLARE
  r          RECORD;
  orig       text;
  out_txt    text;
  cur        integer;   -- orig 스캔 커서 (1-based)
  p          integer;   -- 현재 엔티티의 1-based 시작 위치
  ent        text;      -- 엔티티 원문 (예: '&#8220;')
  code       integer;
  ch         text;
  n_ent      integer;
  starts0    integer[]; -- 각 엔티티의 0-based 시작 위치 (orig 기준)
  deltas     integer[]; -- 각 엔티티의 길이 축약량
  new_para   integer[];
  new_sent   integer[];
  o          integer;
  shift      integer;
  i          integer;
  new_hash   text;
BEGIN
  FOR r IN
    SELECT m.id, m.chapter_idx AS ch_idx, m.content_hash, m.paragraph_offsets, m.sentence_offsets,
           c.content
    FROM library_chapters_master m
    JOIN content_chunks c ON c.hash = m.content_hash
    WHERE m.library_book_id = p_book_id
      AND c.content ~ '&#x?[0-9a-fA-F]+;'
    ORDER BY m.chapter_idx
  LOOP
    orig    := r.content;
    out_txt := '';
    cur     := 1;
    starts0 := '{}';
    deltas  := '{}';

    LOOP
      ent := (regexp_matches(substr(orig, cur), '&#x?[0-9a-fA-F]+;'))[1];
      EXIT WHEN ent IS NULL;

      p := strpos(substr(orig, cur), ent) + cur - 1;

      IF substr(ent, 3, 1) IN ('x', 'X') THEN
        -- ('x'||hex)::bit(32) 는 좌측 정렬 — lpad 로 8자리를 채워야 실제 코드포인트가 된다.
        code := ('x' || lpad(substr(ent, 4, length(ent) - 4), 8, '0'))::bit(32)::integer;
      ELSE
        code := substr(ent, 3, length(ent) - 3)::integer;
      END IF;
      ch := chr(code);

      out_txt := out_txt || substr(orig, cur, p - cur) || ch;
      starts0 := starts0 || (p - 1);
      deltas  := deltas  || (length(ent) - length(ch));
      cur     := p + length(ent);
    END LOOP;

    out_txt := out_txt || substr(orig, cur);
    n_ent   := coalesce(array_length(starts0, 1), 0);
    CONTINUE WHEN n_ent = 0;

    -- 오프셋 이동: 각 오프셋 앞(엄격히 작은 위치)에 있는 엔티티들의 축약량 합만큼 뺀다.
    new_para := '{}';
    FOREACH o IN ARRAY coalesce(r.paragraph_offsets, '{}'::integer[]) LOOP
      shift := 0;
      FOR i IN 1..n_ent LOOP
        EXIT WHEN starts0[i] >= o;
        shift := shift + deltas[i];
      END LOOP;
      new_para := new_para || (o - shift);
    END LOOP;

    new_sent := '{}';
    FOREACH o IN ARRAY coalesce(r.sentence_offsets, '{}'::integer[]) LOOP
      shift := 0;
      FOR i IN 1..n_ent LOOP
        EXIT WHEN starts0[i] >= o;
        shift := shift + deltas[i];
      END LOOP;
      new_sent := new_sent || (o - shift);
    END LOOP;

    -- pgcrypto 는 extensions 스키마에 있고 이 함수는 search_path 를 public 으로 고정하므로
    -- 스키마 한정이 필요하다 (미한정 시 digest(text,unknown) not found).
    new_hash := encode(extensions.digest(out_txt, 'sha256'), 'hex');

    INSERT INTO content_chunks (hash, content, byte_size, ref_count)
    VALUES (new_hash, out_txt, octet_length(out_txt), 1)
    ON CONFLICT (hash) DO UPDATE SET ref_count = content_chunks.ref_count + 1;

    UPDATE library_chapters_master
       SET content_hash      = new_hash,
           paragraph_offsets = new_para,
           sentence_offsets  = new_sent
     WHERE id = r.id;

    UPDATE content_chunks SET ref_count = GREATEST(ref_count - 1, 0) WHERE hash = r.content_hash;

    chapter_idx := r.ch_idx;
    entities    := n_ent;
    old_len     := length(orig);
    new_len     := length(out_txt);
    RETURN NEXT;
  END LOOP;
END $function$;

COMMENT ON FUNCTION public.fix_chapter_html_entities(uuid) IS
  '저장 본문의 HTML 수치 엔티티를 디코딩하고 paragraph/sentence 오프셋을 축약량만큼 이동. 재분절·재수집 없음, 챕터/단어장/진도 무변경. 멱등.';
