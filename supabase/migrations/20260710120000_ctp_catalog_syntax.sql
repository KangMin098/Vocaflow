-- CTP P1/P2 (①②) — syntax_score 컬럼 + csat_stage_catalog VIEW
-- CSAT Track Pipeline: 기존 published 콘텐츠(article∪book)에 구문 난이도 + stage_band 파생.
-- 근거: docs/AI_CONTEXT/diagnostics/ctp_p0_20260709.md (article 전량 v≤6, 도서 v7-9=S4 실측).
-- ⚠ 승인 후 apply. 롤백: DROP VIEW + DROP COLUMN.

-- ① syntax_score — 배치 analyze 확장(자체 정규식 산출: 문장 p90 · 절 깊이 휴리스틱).
--   {sent_p90 int, clause_depth_p90 numeric, score smallint}. NULL = 미산출(뷰가 그대로 노출).
ALTER TABLE library_articles ADD COLUMN IF NOT EXISTS syntax_score jsonb;
ALTER TABLE library_books    ADD COLUMN IF NOT EXISTS syntax_score jsonb;

-- ② csat_stage_catalog — 콘텐츠 메타(stage_band). 학습자 stage 아님(게이트에서 실시간 파생).
--   우선순위: article=register 우선(argumentative→S3), 그 외 v_level. 도서 v7-9=S4(킬러).
CREATE OR REPLACE VIEW csat_stage_catalog AS
SELECT
  'article'::text  AS kind,
  a.id,
  a.title,
  a.article_v_level AS v_level,
  a.register,
  a.cefr_level,
  a.license_class,
  a.display_only,
  a.lexical_noise,
  a.syntax_score,
  CASE
    WHEN a.register = 'argumentative'   THEN 'S3'   -- 논증은 v_level 무관 (register 우선)
    WHEN a.article_v_level >= 7         THEN 'S4'
    WHEN a.article_v_level <= 4         THEN 'S1'
    ELSE 'S2'                                        -- v5-6 expository/news/reference
  END AS stage_band
FROM library_articles a
WHERE a.status = 'published'
UNION ALL
SELECT
  'book'::text     AS kind,
  b.id,
  b.title,
  b.book_v_level   AS v_level,
  CASE WHEN b.source = 'pressbooks' THEN 'academic' ELSE 'narrative' END AS register,  -- 소스 파생
  b.cefr_level,
  -- 도서는 license_class/display_only 컬럼 부재(P0 실측) → copyright_safe_in_kr 로 근사.
  --   문항 생성(T2) 정식 게이트는 별도 LCP 이식 시 교체.
  CASE WHEN b.copyright_safe_in_kr THEN 'public_domain' ELSE 'restricted' END AS license_class,
  false            AS display_only,
  NULL::numeric    AS lexical_noise,
  b.syntax_score,
  CASE
    WHEN b.book_v_level >= 7 THEN 'S4'
    WHEN b.book_v_level <= 4 THEN 'S1'
    ELSE 'S2'
  END AS stage_band
FROM library_books b
WHERE b.status = 'published';

COMMENT ON VIEW csat_stage_catalog IS
  'CTP 콘텐츠 stage_band 카탈로그 (article∪book). stage_band=콘텐츠 메타(저장 OK). 학습자 stage 는 게이트에서 실시간 파생(§9 R(t) 동형 — 컬럼 저장 금지).';