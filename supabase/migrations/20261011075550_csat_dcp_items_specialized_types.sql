-- supabase/migrations/20261011075550_csat_dcp_items_specialized_types.sql
-- Prepared for review. Do not apply without explicit migration approval.
-- The specialized textbook families P13 / P14 / P20 produce item types that csat_dcp_items cannot store:
-- cross_text_comparison, data_integration, argument_comparison. Recreate the type CHECK with the
-- existing 25 values unchanged plus these three. No row changes; existing rows all satisfy the new set.
BEGIN;
ALTER TABLE public.csat_dcp_items DROP CONSTRAINT csat_dcp_items_type_check;
ALTER TABLE public.csat_dcp_items ADD CONSTRAINT csat_dcp_items_type_check CHECK (type = ANY (ARRAY[
  'order', 'insert', 'irrelevant', 'word_order', 'vocab_choice', 'grammar_choice', 'blank_word', 'grammar_fix',
  'unit_vocab', 'unit_grammar', 'purpose', 'mood', 'claim', 'implication', 'main_point', 'topic', 'title', 'blank',
  'summary', 'content_match', 'long_order', 'long_reference', 'long_match', 'long_title', 'long_vocab',
  'cross_text_comparison', 'data_integration', 'argument_comparison'
]::text[])) NOT VALID;
-- Validate separately so the ~834k-row scan runs under SHARE UPDATE EXCLUSIVE, not the ADD lock.
ALTER TABLE public.csat_dcp_items VALIDATE CONSTRAINT csat_dcp_items_type_check;
COMMIT;
