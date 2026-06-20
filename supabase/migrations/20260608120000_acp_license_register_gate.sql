-- 20260608120000_acp_license_register_gate.sql
-- ═══════════════════════════════════════════════════════════
-- ACP §18 Step 1 — 항목 단위 라이선스 게이트 + register/lexical_noise 컬럼
--
-- 배경 (docs/ACP_SOURCE_REDESIGN.md):
--   arXiv 가 드러낸 구조적 결함 — "소스=자유 가정" 불가. 문서 단위 license 검증 필요.
--   library_articles 는 license(자유텍스트)·copyright_safe_in_kr 만 있고 정규화 등급(license_class)·
--   글유형(register)·텍스트오염(lexical_noise) 누락.
--
-- 변경:
--   1. register / lexical_noise / license_class / display_only 컬럼 추가 (+ CHECK)
--   2. acp_classify_license(text) — 자유텍스트 license → 정규화 등급
--   3. BEFORE INSERT/UPDATE 트리거 — license_class·display_only·copyright_safe_in_kr 자동 도출
--      · 보수적 기본값 restricted · NC 차단 · ND→display_only(본문 불변)
--   4. 기존 행 backfill
--
-- 가공 게이트(추출·하이라이트)는 애플리케이션/추출 RPC 에서:
--   license_class IN (public_domain,cc0,cc_by,cc_by_sa) AND lexical_noise <= 0.08
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- 1) 컬럼
ALTER TABLE library_articles
  ADD COLUMN IF NOT EXISTS register text,
  ADD COLUMN IF NOT EXISTS lexical_noise numeric(4,3),
  ADD COLUMN IF NOT EXISTS license_class text,
  ADD COLUMN IF NOT EXISTS display_only boolean NOT NULL DEFAULT false;

ALTER TABLE library_articles
  DROP CONSTRAINT IF EXISTS chk_article_register,
  DROP CONSTRAINT IF EXISTS chk_article_license_class;

ALTER TABLE library_articles
  ADD CONSTRAINT chk_article_register CHECK (
    register IS NULL OR register IN
      ('expository','argumentative','narrative','news','reference')
  ),
  ADD CONSTRAINT chk_article_license_class CHECK (
    license_class IS NULL OR license_class IN
      ('public_domain','cc0','cc_by','cc_by_sa','cc_by_nd','restricted')
  );

-- 2) license(자유텍스트) → license_class
CREATE OR REPLACE FUNCTION acp_classify_license(p_license text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_license IS NULL THEN 'restricted'
    WHEN p_license ILIKE '%-NC%' OR p_license ILIKE '%noncommercial%'
         OR p_license ILIKE '%non-commercial%' THEN 'restricted'   -- NC 우선 차단
    WHEN p_license ILIKE '%public domain%' OR p_license ILIKE 'PD%' THEN 'public_domain'
    WHEN p_license ILIKE 'CC0%' OR p_license ILIKE '%CC-0%' THEN 'cc0'
    WHEN p_license ILIKE '%CC-BY-SA%' OR p_license ILIKE '%CC BY-SA%' THEN 'cc_by_sa'
    WHEN p_license ILIKE '%CC-BY-ND%' OR p_license ILIKE '%CC BY-ND%' THEN 'cc_by_nd'
    WHEN p_license ILIKE '%CC-BY%' OR p_license ILIKE '%CC BY%' THEN 'cc_by'
    ELSE 'restricted'  -- arXiv-default 등 미확인 = 보수적 차단
  END
$$;

COMMENT ON FUNCTION acp_classify_license(text) IS
  'ACP §18 — 자유텍스트 license → license_class(public_domain/cc0/cc_by/cc_by_sa/cc_by_nd/restricted). NC·미확인은 restricted.';

-- 3) 게이트 트리거 — license_class·display_only·copyright_safe_in_kr 도출
CREATE OR REPLACE FUNCTION acp_apply_license_gate() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.license_class := acp_classify_license(NEW.license);
  NEW.display_only  := (NEW.license_class = 'cc_by_nd');
  -- 게시 가능 여부 — ND 도 게시 가능(본문 불변), restricted/NC 만 불가
  NEW.copyright_safe_in_kr := NEW.license_class IN
    ('public_domain','cc0','cc_by','cc_by_sa','cc_by_nd');
  RETURN NEW;
END $$;

COMMENT ON FUNCTION acp_apply_license_gate() IS
  'ACP §18 — INSERT/UPDATE(license) 시 license_class·display_only·copyright_safe_in_kr 자동 도출.';

DROP TRIGGER IF EXISTS trg_acp_license_gate ON library_articles;
CREATE TRIGGER trg_acp_license_gate
  BEFORE INSERT OR UPDATE OF license ON library_articles
  FOR EACH ROW EXECUTE FUNCTION acp_apply_license_gate();

-- 4) 기존 행 backfill
UPDATE library_articles
SET license_class = acp_classify_license(license),
    display_only  = (acp_classify_license(license) = 'cc_by_nd'),
    copyright_safe_in_kr = acp_classify_license(license) IN
      ('public_domain','cc0','cc_by','cc_by_sa','cc_by_nd');

COMMIT;
