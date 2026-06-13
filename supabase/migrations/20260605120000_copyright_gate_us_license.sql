-- 20260605120000_copyright_gate_us_license.sql
-- copyright_safe_in_kr 판정을 한국 사후70년 → 소스 라이선스 신뢰(US PD / CC)로 전환.
-- PM 결정(2026-06-05): 미국 기준만 적용. license 가 PD/CC 계열이면 배포 허용.
--
-- 배경: ingest 소스(Gutenberg/Standard Ebooks/Wikibooks 등)는 모두 자유배포 cleared.
--   기존 lb_compute_kr_safe() 는 author_death_year 기반(한국 저작권 사후70년)이라
--   사망연도 미기록 시 PD-US 고전이 전부 '미확인'으로 차단됨 (실측: 82권).
--   license 는 free-text 라 'U.S. Public Domain' / 'Public domain in the USA.' / 'PD-US'
--   / 'CC-BY-SA-3.0' 4종 → ILIKE 패턴으로 PD/CC 계열 매칭.
--
-- ⚠️ 알려진 한계:
--   - ILIKE 'CC%' 는 CC-BY-NC(비상업)까지 매칭 — 현재 NC 라이선스 0건, 향후 추가 시 재검토.
--   - 연간 cron 'recompute-kr-safe' 는 author_death_year 를 touch 하므로 이제 no-op (무해).
--   - 컬럼명 copyright_safe_in_kr 유지 (의미는 US-safe, rename cascade 21파일 회피 — COMMENT 로 표기).

BEGIN;

-- 1. 판정 함수 교체: author_death_year → license
CREATE OR REPLACE FUNCTION lb_compute_kr_safe() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.copyright_safe_in_kr := (
    NEW.license IS NOT NULL AND (
      NEW.license ILIKE '%public domain%'  -- 'U.S. Public Domain', 'Public domain in the USA.'
      OR NEW.license ILIKE 'PD%'           -- 'PD-US'
      OR NEW.license ILIKE 'CC%'           -- 'CC-BY-SA-3.0' (Wikibooks 자유배포)
    )
  );
  RETURN NEW;
END $$;

-- 2. 트리거 발화 컬럼 변경: author_death_year → license
DROP TRIGGER IF EXISTS trg_lb_compute_kr_safe ON library_books;
CREATE TRIGGER trg_lb_compute_kr_safe
  BEFORE INSERT OR UPDATE OF license ON library_books
  FOR EACH ROW EXECUTE FUNCTION lb_compute_kr_safe();

-- 3. 기존 행 즉시 재판정
UPDATE library_books
SET copyright_safe_in_kr = (
  license IS NOT NULL AND (
    license ILIKE '%public domain%' OR license ILIKE 'PD%' OR license ILIKE 'CC%'
  )
);

-- 4. 컬럼 의미 변경 명시 (이름 _in_kr 유지)
COMMENT ON COLUMN library_books.copyright_safe_in_kr IS
  'US/소스 라이선스 기준 배포 가능 여부 (PM 2026-06-05: 한국 사후70년 미적용). license PD/CC 계열이면 true.';

COMMIT;
