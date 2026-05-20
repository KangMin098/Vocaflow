-- supabase/migrations/20260518120000_wikibooks_activation.sql
-- LCP v2.0 Phase 14 — Wikibooks ingester 활성화 + KR 저작권 룰 source 인지화
--
-- 이 마이그레이션은 두 가지를 합쳐 수행:
--   1) library_source_catalogs.wikibooks: is_implemented = true 로 토글
--   2) lb_compute_kr_safe(): CC-BY-SA 계열 (wikibooks/wikisource) 은 자동 KR 안전
--      - 기존: author_death_year < year-70 만 체크 (PD-US 룰)
--      - 변경: source 가 CC-BY-SA 라이선스 위키 계열이면 always true
--              (저작자 표시는 source_url 보존으로 충족)
--
-- 적용 전 검토 필요 사항:
--   - 한국 저작권법상 CC-BY-SA-3.0 자유이용 적합성은 admin 검토 필수
--   - 변경 후 publish 가능해지므로 큐레이션 모드를 'ready' 로 강제하고
--     manual review 후 published 로 승격하는 것을 권장 (auto_publish 회피)
--   - 적용 안 하면: wikibooks 책은 status='failed' 로 자동 분류됨
--     (대안: admin 이 RPC 로 강제 kr_safe=true + force_publish)

BEGIN;

-- 1. 카탈로그 활성화
UPDATE library_source_catalogs
   SET is_implemented = true
 WHERE source = 'wikibooks';

-- 2. lb_compute_kr_safe — source-aware 버전
CREATE OR REPLACE FUNCTION lb_compute_kr_safe()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- CC-BY-SA 계열 위키 협업 저작물: 저자 사후 룰 부적용, 항상 안전 (저작자 표시는
  -- source_url 보존으로 충족). license 컬럼 우선, fallback 으로 source enum.
  IF NEW.license IN ('CC-BY-SA-3.0', 'CC-BY-SA-4.0', 'CC-BY-3.0', 'CC-BY-4.0', 'CC0')
     OR NEW.source IN ('wikibooks', 'wikisource')
  THEN
    NEW.copyright_safe_in_kr := TRUE;
    RETURN NEW;
  END IF;

  -- 기존 PD-US 룰: 저자 사후 70년
  NEW.copyright_safe_in_kr := (
    NEW.author_death_year IS NOT NULL
    AND NEW.author_death_year < EXTRACT(YEAR FROM CURRENT_DATE)::INT - 70
  );
  RETURN NEW;
END;
$$;

-- 3. 기존 wikibooks/wikisource 행 백필 (재계산)
UPDATE library_books
   SET license = license  -- 트리거 재발화용 no-op
 WHERE source IN ('wikibooks', 'wikisource');

COMMIT;

-- ── 적용 후 검증 쿼리 ────────────────────────────────────────
-- SELECT source, is_implemented FROM library_source_catalogs WHERE source='wikibooks';
-- SELECT id, title, source, copyright_safe_in_kr FROM library_books WHERE source IN ('wikibooks','wikisource');
