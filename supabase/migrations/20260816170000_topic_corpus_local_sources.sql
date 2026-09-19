-- supabase/migrations/20260816170000_topic_corpus_local_sources.sql
--
-- TCP 로컬 코퍼스 소스 — 이미 DB 에 있는 `library_articles` 를 주제 축으로 등록한다.
--
-- ── 왜 (2026-08-16) ──
-- TED 15주제는 `20260816160000` 에 등록했으나 **수확이 불가능**했다: 목록·자막 페이지 모두
-- Node 에서 403 (Cloudflare TLS 지문 차단 — 헤더로 통과 못 함). 차단 우회는 범위 밖이라
-- 가져올 필요조차 없는 개방 라이선스 코퍼스로 방향을 돌린다.
--
-- `library_articles` 실측(2026-08-16): 161편 · 약 204,000 어절 · 전편 본문 보유.
-- 라이선스는 PD-Government · CC-BY-4.0 · CC-BY-SA-4.0 · CC-BY-ND-4.0.
-- (ND 는 2차적저작물 배포를 제한하는 것이고, TCP 는 어휘 빈도만 세고 원문을 재배포하지 않는다.)
--
-- ── topic_key = library_articles.source ──
-- 별도 매핑 표를 만들지 않는다. `source` 가 그대로 주제 축이다 — nasa=우주 · plos/elife=생명과학 ·
-- usgs=지질 · noaa=기상 · wikivoyage=여행 · voa=시사.
--
-- ── wikipedia 계열을 category_id NULL 로 두는 이유 ──
-- 백과사전 일반 문서는 특정 주제가 아니라 **모든 주제에 걸친 배경**이다. 카테고리를 주지 않으면
-- 승격에서 빠지는 대신 salience 계산의 배경 분포에 기여해 **다른 주제의 대비를 선명하게 만든다**.
-- (배경이 없으면 모든 주제에서 흔한 단어가 전부 "두드러짐" 으로 잡힌다.)
--   · simple_wikipedia 34편 · wikipedia 2편 — 합계 약 104,000 어절로 코퍼스의 절반이다.

INSERT INTO public.topic_corpus_sources
  (id, provider, topic_key, label_en, label_ko, category_id, license, text_reusable, sort_order)
VALUES
  ('local:nasa',             'library_articles','nasa',            'NASA',              'NASA 우주',      'time-and-space-space',                       'PD-Government',  true,  101),
  ('local:voa',              'library_articles','voa',             'VOA News',          'VOA 시사',       'culture-tv-radio-and-news',                  'PD-Government',  true,  102),
  ('local:plos',             'library_articles','plos',            'PLOS',              'PLOS 생명과학',  'science-and-technology-biology',             'CC-BY-4.0',      true,  103),
  ('local:elife',            'library_articles','elife',           'eLife',             'eLife 생명과학', 'science-and-technology-biology',             'CC-BY-4.0',      true,  104),
  ('local:usgs',             'library_articles','usgs',            'USGS',              'USGS 지질',      'the-natural-world-geography',                'PD-Government',  true,  105),
  ('local:noaa',             'library_articles','noaa',            'NOAA',              'NOAA 기상',      'the-natural-world-weather',                  'PD-Government',  true,  106),
  ('local:owid',             'library_articles','owid',            'Our World in Data', 'OWID 사회지표',  'politics-and-society-social-issues',         'CC-BY-4.0',      true,  107),
  ('local:factbook',         'library_articles','factbook',        'World Factbook',    '세계 개황',      'the-natural-world-geography',                'PD-Government',  true,  108),
  ('local:wikivoyage',       'library_articles','wikivoyage',      'Wikivoyage',        '위키여행',       'travel',                                     'CC-BY-SA-4.0',   true,  109),
  ('local:the-conversation', 'library_articles','the_conversation','The Conversation',  '더 컨버세이션',  'science-and-technology-scientific-research', 'CC-BY-ND-4.0',   false, 110),
  -- 배경 대조군 — category_id NULL (승격하지 않고 salience 분모에만 기여)
  ('local:simple-wikipedia', 'library_articles','simple_wikipedia','Simple Wikipedia',  '쉬운 위키백과',  NULL,                                         'CC-BY-SA-4.0',   true,  198),
  ('local:wikipedia',        'library_articles','wikipedia',       'Wikipedia',         '위키백과',       NULL,                                         'CC-BY-SA-4.0',   true,  199)
ON CONFLICT (id) DO UPDATE
  SET label_en = EXCLUDED.label_en, label_ko = EXCLUDED.label_ko,
      category_id = EXCLUDED.category_id, license = EXCLUDED.license,
      text_reusable = EXCLUDED.text_reusable, sort_order = EXCLUDED.sort_order,
      updated_at = now();

-- TED 소스는 지우지 않고 비활성화한다. 삭제하면 CASCADE 로 큐·원장·통계가 함께 사라지고,
-- **왜 안 쓰는지에 대한 기록도 사라진다.** 차단이 풀리거나 공식 경로가 생기면 되살리면 된다.
UPDATE public.topic_corpus_sources
   SET is_active = false, updated_at = now()
 WHERE provider = 'ted';

COMMENT ON COLUMN public.topic_corpus_sources.topic_key IS
  'provider 별 주제 키. provider=library_articles 이면 library_articles.source 와 같은 값이다.';
