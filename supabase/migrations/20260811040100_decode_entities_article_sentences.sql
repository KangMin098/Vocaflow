-- 20260811120300_decode_entities_article_sentences.sql
-- ACP 아티클 쪽 복사본 문장에 남은 HTML 엔티티 정리.
--
-- Sociology 정리(20260811120100/120200) 후 전수 점검에서 9건이 남아 추적해보니 도서가 아니라
-- **ACP 아티클 세트**(Our World in Data)의 `&#x27;`(작은따옴표) 였다.
--   · library_articles.content            0건 — 본문은 깨끗하다
--   · library_article_vocabularies.first_sentence  47건
--   · shared_words.source_sentence (library_article 세트)  9건 — **발행된 단어장 예문**
-- ingest-article/_helpers.ts 의 hex fallback 은 v06.208 에서 들어갔고(현재 정상),
-- 그 이전에 적재된 레거시 행만 남은 것이다. 본문이 멀쩡하므로 재수집 없이 복사본만 고치면 된다.
--
-- 범용 디코더로 만든다: 도서 쪽은 수치 10진 5종이었고 여기는 hex 였다. 앞으로 또 다른 형태가
-- 나올 때마다 replace 체인을 늘리지 않도록, 실제로 등장하는 코드포인트를 모아 chr() 로 치환한다.

CREATE OR REPLACE FUNCTION public.decode_html_entities(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  out_txt text := p_text;
  m       text;
  code    integer;
BEGIN
  IF out_txt IS NULL OR position('&' in out_txt) = 0 THEN
    RETURN out_txt;
  END IF;

  -- named — 실측상 필요한 최소 집합
  out_txt := replace(out_txt, '&nbsp;', ' ');
  out_txt := replace(out_txt, '&quot;', '"');
  out_txt := replace(out_txt, '&apos;', '''');
  out_txt := replace(out_txt, '&lt;',   '<');
  out_txt := replace(out_txt, '&gt;',   '>');
  out_txt := replace(out_txt, '&mdash;', '—');
  out_txt := replace(out_txt, '&ndash;', '–');
  out_txt := replace(out_txt, '&hellip;', '…');
  out_txt := replace(out_txt, '&lsquo;', '‘');
  out_txt := replace(out_txt, '&rsquo;', '’');
  out_txt := replace(out_txt, '&ldquo;', '“');
  out_txt := replace(out_txt, '&rdquo;', '”');

  -- 수치 10진 — 등장하는 코드포인트만 모아 치환
  FOR m IN SELECT DISTINCT x[1] FROM regexp_matches(out_txt, '&#([0-9]{1,7});', 'g') AS x LOOP
    code := m::integer;
    CONTINUE WHEN code < 1 OR code > 1114111;
    out_txt := replace(out_txt, '&#' || m || ';', chr(code));
  END LOOP;

  -- 수치 16진
  --   ⚠️ ('x'||hex)::bit(32) 는 **좌측 정렬**이다 — 'x27' → 0x27000000 = 654311424.
  --      lpad 로 8자리를 채워야 39('\'')가 나온다. (첫 구현이 이걸 놓쳐 범위 가드에 걸려
  --      조용히 건너뛰었다 — 가드가 없었으면 엉뚱한 문자를 썼을 자리다.)
  FOR m IN SELECT DISTINCT x[1] FROM regexp_matches(out_txt, '&#[xX]([0-9a-fA-F]{1,6});', 'g') AS x LOOP
    code := ('x' || lpad(m, 8, '0'))::bit(32)::integer;
    CONTINUE WHEN code < 1 OR code > 1114111;
    out_txt := regexp_replace(out_txt, '&#[xX]' || m || ';', chr(code), 'g');
  END LOOP;

  -- 300자 절단(extract-lemmas.ts)으로 경계에서 잘린 말단 파편은 떼어낸다
  out_txt := regexp_replace(out_txt, '&#x?[0-9a-fA-F]*$', '');

  -- `&amp;` 는 마지막에 — 먼저 풀면 `&amp;#8217;` 가 이중 디코딩된다
  out_txt := replace(out_txt, '&amp;', '&');

  RETURN out_txt;
END $function$;

COMMENT ON FUNCTION public.decode_html_entities(text) IS
  'HTML 엔티티 디코딩 (named + 10진/16진 수치 + 말단 절단 파편 제거). &amp; 는 이중 디코딩 방지를 위해 마지막에 처리.';

-- 아티클 복사본 문장 정리 (본문은 이미 깨끗 — 재수집 불요)
UPDATE public.library_article_vocabularies
SET first_sentence = public.decode_html_entities(first_sentence)
WHERE position('&#' in coalesce(first_sentence, '')) > 0;

UPDATE public.shared_words sw
SET source_sentence = public.decode_html_entities(sw.source_sentence)
FROM public.shared_word_sets s
WHERE s.id = sw.set_id
  AND s.category = 'library_article'
  AND position('&#' in coalesce(sw.source_sentence, '')) > 0;
