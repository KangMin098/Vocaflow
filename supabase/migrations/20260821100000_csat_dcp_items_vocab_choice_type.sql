-- supabase/migrations/20260821100000_csat_dcp_items_vocab_choice_type.sql
--
-- csat_dcp_items 가 어휘 문항(수능 30번)도 받게 한다.
--
-- `20260821090000` 과 같은 방식 — 기존 행은 건드리지 않고 허용값만 늘린다.
--   vocab_choice  문맥에 맞지 않는 낱말 (수능 30번)
--
-- ⚠️ 이 유형도 학습자 화면이 아직 못 그린다. `prescribe_today` 가 `20260821093000` 에서
--   `order`·`insert` 만 뽑도록 좁혀졌으므로 새어 나가지 않는다. 화면이 그리게 되면
--   그 함수의 목록에 유형을 더한다 — 목록이 한 곳에 있으니 빠뜨릴 수 없다.
--
-- 되돌리려면 같은 방식으로 이전 배열을 다시 넣으면 된다.

alter table csat_dcp_items drop constraint csat_dcp_items_type_check;
alter table csat_dcp_items add constraint csat_dcp_items_type_check
  check (type = any (array['order'::text, 'insert'::text, 'irrelevant'::text,
                           'word_order'::text, 'vocab_choice'::text]));
