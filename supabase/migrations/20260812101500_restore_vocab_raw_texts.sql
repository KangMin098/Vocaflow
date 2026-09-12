-- supabase/migrations/20260812101500_restore_vocab_raw_texts.sql
--
-- 20260719161409_drop_unused_empty_tables 가 vocab_raw_texts 를 "빈 테이블" 로 지웠다.
-- 비어 있었던 것은 **사실**이다 — VCB 런은 1건뿐이고(2026-05-13, cast-2000 감사 체인)
-- 그 시드 2,000개는 AI 생성(Method B)이라 파일 업로드가 없었다. 틀린 것은 판정이 아니라
-- 추론이었다: **비어 있음 ≠ 미사용.**
--
-- vcb-curate-core 는 현행 코드다:
--   · publish.ts:250  (2026-07-06) — 발행 세트의 **출처 인용(citation)** 을 이 테이블로 붙인다.
--                                     라이선스 표기 의무이므로 장식이 아니다.
--   · queries.ts:169  (2026-07-09) — 런 상세의 소스 수
--   · method-a.ts:210 (쓰기)       — Method A 파일 업로드 적재. 유일한 write 경로
--   · sources.ts:78                 — 소스 목록 run_count 뱃지 → 이것이 /admin/vocab/sources 를 500 으로 만들었다
--   · scripts/vcb/01·02·03          — CLI (2026-05-14 이후 미변경)
--
-- 원본 DDL: 20260513211824_vcb_init.sql §3 그대로.
-- RLS 정책은 자매 테이블 7개와 동일한 admin_curator_all (실측 대조).
-- 순수 추가이며 복원 후 0행 — 복구할 데이터는 없다(원래 비어 있었다).
--
-- 검증(적용 시점 실측): FK 2개 · RLS on · 정책 1 · 인덱스 3 · sources.ts/publish.ts 조회 형태 실행 OK.

CREATE TABLE IF NOT EXISTS public.vocab_raw_texts (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES public.vocab_runs(id) ON DELETE CASCADE,
  source_id BIGINT REFERENCES public.vocab_sources(id) ON DELETE SET NULL,
  external_ref TEXT,
  content_hash TEXT NOT NULL,
  content_bytes INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (run_id, content_hash)
);
CREATE INDEX IF NOT EXISTS idx_vocab_raw_run ON public.vocab_raw_texts(run_id);

ALTER TABLE public.vocab_raw_texts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_curator_all" ON public.vocab_raw_texts;
CREATE POLICY "admin_curator_all" ON public.vocab_raw_texts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role IN ('admin','curator'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role IN ('admin','curator'))
  );
