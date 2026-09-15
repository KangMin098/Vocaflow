-- supabase/migrations/20260821090000_csat_dcp_items_new_types.sql
--
-- csat_dcp_items 가 받는 문항 유형을 넓힌다.
--
-- 기존 행은 건드리지 않는다 — 허용값만 늘린다.
--   irrelevant  흐름 무관 문장 (수능 35번) — 다른 글의 문장을 끼워 넣으면 그것이 정답
--   word_order  영작 배열 (중등 서술형)    — 어순을 섞으면 원문이 정답
--
-- ⚠️ 유일키가 `(kind, ref_id, type, paragraph_idx)` 라 **한 문단에 유형별로 한 문항**이다.
--   순서·삽입은 원래 그랬고, 흐름 무관도 문단당 하나다. 영작 배열은 문단 안에 여러 문장이
--   후보가 되지만 저장은 문단당 하나로 제한된다 — 교재에서도 한 지문에 서술형 하나가 맞다.
--
-- 되돌리려면 같은 방식으로 원래 배열(order, insert)을 다시 넣으면 된다.

alter table csat_dcp_items drop constraint csat_dcp_items_type_check;
alter table csat_dcp_items add constraint csat_dcp_items_type_check
  check (type = any (array['order'::text, 'insert'::text, 'irrelevant'::text, 'word_order'::text]));
