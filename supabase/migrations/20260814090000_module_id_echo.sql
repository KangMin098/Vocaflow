-- supabase/migrations/20260814090000_module_id_echo.sql
--
-- EchoMatch 를 청각 면(F3) 기록 경로로 잇는다.
-- learning_records.module 은 module_id enum 이고 'echo' 가 없어
-- 지금은 EchoMatch 결과가 echo_match_attempts 에만 남는다(FSRS 밖).
--
-- 설계안(docs/VOCAB_FRAMEWORK_PROPOSAL.md §8)이 "청각 처방 불가" 의 원인으로 지목한 지점이다.
-- 판정 규칙과 그 한계는 apps/web/src/lib/echo/word-signal.ts 머리말 참조 —
-- 요지는 **기록만 남기고 FSRS 복습 간격은 움직이지 않는다** 는 것이다
-- (문장이 화면에 떠 있는 채로 따라 말하는 것은 인출이 아니다).

alter type public.module_id add value if not exists 'echo';

-- 주의: Postgres 는 enum 값 DROP 을 지원하지 않는다.
--       추가는 되돌릴 수 없고, 안 쓰면 미사용 값으로 남는다.
--       (같은 이유로 pirate_quest 가 0행인 채 남아 있다.)
