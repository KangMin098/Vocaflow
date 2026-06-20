-- 20260608126000_acp_lexical_noise_gate.sql
-- ═══════════════════════════════════════════════════════════
-- ACP §18 Step 5 §4-C — 텍스트 청결 게이트: lexical_noise>0.08 단어세트 발행 차단
--
-- arXiv 류 LaTeX·수식·인용 오염(lexical_noise) 글은 어휘 파이프라인에서 탈락 —
-- 본문은 읽기용으로 게시 가능하나 단어세트(파생 어휘)는 발행하지 않음.
-- dev-process(및 향후 워커)가 lexical_noise 를 산출·저장 → 발행 트리거가 게이트.
--
-- display_only(ND) 게이트(Step 3)와 AND 결합.
-- ═══════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION trg_publish_article_word_set()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.status = 'published'
     AND (OLD.status IS NULL OR OLD.status != 'published')
     AND NOT COALESCE(NEW.display_only, false)        -- ND: 파생 단어세트 금지
     AND COALESCE(NEW.lexical_noise, 0) <= 0.08       -- §4-C: 오염 텍스트 어휘 탈락
  THEN
    PERFORM publish_article_word_set(NEW.id);
  END IF;
  RETURN NEW;
END $function$;

COMMIT;
