-- supabase/migrations/20260809030000_pdcp_adapter_browser_assist_and_term_expired_basis.sql
--
-- PDCP 스키마 결함 2건 수정 (2026-08-09, 사용자 승인 후 적용).
--
-- ① browser-assist 어댑터가 허용 목록에 없어, 브라우저 보조로 사람이 직접 받은 호를
--    큐에 적재할 수 없었다(CHECK 위반). 어댑터는 코드에 이미 등록·동작 중이다.
-- ② PD 근거 토큰 'pre-1929' 는 매년 1월 1일에 거짓이 된다. 2026-01-01 부로 1930년
--    발행물도 PD 가 됐고 코드(PD_YEAR_CUTOFF)는 1930 으로 갱신했는데 DB 토큰만 1929 에
--    묶여 있어, 1930년 발행물이 검색에서는 'PD 확정'인데 적재 시 '미확정'으로 갈렸다.
--    연도에 종속되지 않는 'term-expired'(보호기간 만료)를 추가한다.
--    'pre-1929' 는 기존 행 호환을 위해 남긴다.

ALTER TABLE pd_comic_issues DROP CONSTRAINT IF EXISTS pd_issues_adapter_chk;
ALTER TABLE pd_comic_issues ADD CONSTRAINT pd_issues_adapter_chk CHECK (
  source_adapter IN ('internet-archive', 'browser-assist', 'local-dir', 'iiif')
);

ALTER TABLE pd_comic_issues DROP CONSTRAINT IF EXISTS pd_issues_basis_chk;
ALTER TABLE pd_comic_issues ADD CONSTRAINT pd_issues_basis_chk CHECK (
  pd_basis IS NULL OR pd_basis IN (
    'term-expired',
    'pre-1929',
    'no-renewal',
    'explicit-license'
  )
);

COMMENT ON COLUMN pd_comic_issues.pd_basis IS
  'PD 근거. term-expired=보호기간 만료(연도 비종속) · no-renewal=갱신 기록 없음 · explicit-license=명시 라이선스. pre-1929 는 레거시 토큰(연도가 매년 낡아 term-expired 로 대체).';
