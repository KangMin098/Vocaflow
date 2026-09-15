-- library_articles.source CHECK 에 'futurity' 추가.
--
-- 왜 (실측 2026-08-30): futurity 어댑터·SOURCE_SPECS·register 매핑·회귀 테스트는
-- 2026-08-21 에 들어왔는데 **이 제약만 갱신되지 않았다.** 그래서 수집 배치가 목록 188편을
-- 정상으로 가져오고 본문 추출까지 성공해도(직접 호출 실측: 436·679·768 words)
-- INSERT 가 전부 CHECK 위반으로 거절돼 확보량이 영구히 0 이었다.
-- 오류는 실패 목록에만 남고 "담은 것 0" 으로 보여, 소스가 비어 있는 것과 구분되지 않았다.
--
-- 추가만 한다 — 기존 행에 영향 없고, 되돌리려면 목록에서 'futurity' 만 빼면 된다.
ALTER TABLE library_articles DROP CONSTRAINT library_articles_source_check;

ALTER TABLE library_articles ADD CONSTRAINT library_articles_source_check
  CHECK (source = ANY (ARRAY[
    'voa', 'nasa', 'nih', 'manual', 'cdc', 'medlineplus', 'wikinews',
    'the_conversation', 'simple_wikipedia', 'owid', 'factbook', 'elife',
    'wikipedia', 'plos', 'wikivoyage', 'usgs', 'noaa', 'futurity', 'original'
  ]));
