-- supabase/migrations/20260816030000_dictation_attempt_unique.sql
--
-- 한 세션의 한 문항은 **한 번만** 적재된다.
--
-- 왜 (실측 2026-08-16):
--   `outcome` 상태만으로 이중 제출을 막던 동안, Enter 를 누르고 있으면 반복 이벤트가
--   같은 tick 에 여러 번 들어와 전부 통과했다 — Enter 5회 → dictation_attempts 5행.
--   클라이언트에 ref 잠금을 걸어 한 탭 안에서는 막았지만, **같은 세션을 두 탭에서 열면**
--   각 탭의 React 상태가 독립이라 여전히 중복된다. 그건 DB 만 막을 수 있다.
--
--   중복이 남기는 피해는 화면에 안 보인다: 세션 정확도 평균에 한 문항이 여러 번 반영되고,
--   타깃 단어의 FSRS 등급도 그만큼 중복 집계돼 복습 간격이 왜곡된다.
--
-- 안전성: 적용 시점 기존 중복 0건(session_id, item_idx 기준)이라 바로 걸 수 있다.
--
-- ⚠️ 호출부(`saveDictationAttempt`)가 이 인덱스에 **의존한다** —
--    upsert(onConflict: 'session_id,item_idx') 는 유니크 제약이 없으면 해석되지 않아
--    **한 행도 안 남는다**(중복보다 나쁘다). 실측으로 확인함: 인덱스를 내리고 두 탭
--    시나리오를 돌리니 적재가 0행이었다. 이 인덱스를 지우려면 호출부를 먼저 바꿀 것.

create unique index if not exists uniq_dictation_attempt_item
  on public.dictation_attempts (session_id, item_idx);
