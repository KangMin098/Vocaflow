-- supabase/migrations/20260821110000_csat_dcp_items_grammar_choice_type.sql
--
-- csat_dcp_items 가 어법 문항(수능 29번)도 받게 한다.
--
-- `20260821090000`(irrelevant·word_order) · `20260821100000`(vocab_choice) 과 같은 방식 —
-- 기존 행은 건드리지 않고 허용값만 늘린다.
--   grammar_choice  어법상 틀린 것 (수능 29번)
--
-- ⚠️ 이 유형도 학습자 화면(`DcpPlayer`)과 채점 RPC(`grade_dcp_item`)는 못 그린다.
--   그런데 `prescribe_today`(`20260821093000`)가 **허용 목록**이라 새 유형은 기본이 제외다 —
--   `20260821090000` 때처럼 조용히 새어 나가지 않는다. 그때는 필터가 아예 없었다.
--
-- 되돌리려면 같은 방식으로 이전 배열을 다시 넣으면 된다.

alter table csat_dcp_items drop constraint csat_dcp_items_type_check;
alter table csat_dcp_items add constraint csat_dcp_items_type_check
  check (type = any (array['order'::text, 'insert'::text, 'irrelevant'::text,
                           'word_order'::text, 'vocab_choice'::text, 'grammar_choice'::text]));
