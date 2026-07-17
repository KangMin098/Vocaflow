-- Phase 2 — 추출 어휘에 문맥 POS 저장 (근본 sense 매칭 기반).
-- extract-lemmas 의 winkNLP 문맥 POS(현재 PROPN 필터에만 쓰고 폐기)를 저장 → Phase 3 추출이
--   meanings_ko 에서 문맥 POS 일치 sense 선택 → 그 sense v_level 로 V≥6 필터 + 문맥 gloss.
-- additive · nullable (백필/신규 파이프라인이 채움).

ALTER TABLE public.library_book_vocabularies    ADD COLUMN IF NOT EXISTS context_pos text;
ALTER TABLE public.library_article_vocabularies ADD COLUMN IF NOT EXISTS context_pos text;

COMMENT ON COLUMN public.library_book_vocabularies.context_pos    IS 'winkNLP 문맥 POS(noun/verb/adjective...) — Phase 3 sense 매칭용. NULL=미백필.';
COMMENT ON COLUMN public.library_article_vocabularies.context_pos IS 'winkNLP 문맥 POS — Phase 3 sense 매칭용. NULL=미백필.';
