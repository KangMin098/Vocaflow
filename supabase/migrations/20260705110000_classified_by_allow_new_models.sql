-- supabase/migrations/20260705110000_classified_by_allow_new_models.sql
-- v06.129 후속: shared_dictionary.classified_by CHECK 허용값 확장.
-- 기존 4값 유지 + 최신 모델 2값 추가 (이전 등재분의 4_7 소급 변경 없음 — 기록 보존).

ALTER TABLE public.shared_dictionary
  DROP CONSTRAINT shared_dictionary_classified_by_check;

ALTER TABLE public.shared_dictionary
  ADD CONSTRAINT shared_dictionary_classified_by_check CHECK (
    classified_by = ANY (ARRAY[
      'rule_v1'::text,
      'claude_code_opus_4_7'::text,
      'claude_code_sonnet_4_6'::text,
      'claude_code_derivational'::text,
      'claude_code_opus_4_8'::text,
      'claude_code_fable_5'::text
    ])
  );
