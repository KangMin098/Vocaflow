-- supabase/migrations/20260815060000_dictation_session_items.sql
--
-- 진행 중 세션의 **문항 목록**을 DB 에 남긴다.
--
-- 왜 (사용자 신고 2026-08-15):
--   `/dictate/session?sessionId=…` 를 열었는데 아무 반응이 없었다. 세션은 DB 에 있었지만
--   문항 목록은 **시작한 기기의 localStorage 에만** 있었다. 그래서 다른 브라우저·시크릿창·
--   캐시 정리 후에는 복원할 방법이 없고, 화면은 "못 찾았어요" 밖에 말할 수 없었다.
--   config·source_kind 로 재구성하려 해도 'daily' 는 무작위 선택이라 같은 문항이 안 나온다.
--
-- 크기: 문항 5~20개 × 문장 하나 ≈ 수 KB. 진행 중 세션에만 남고 완주 후에도 그대로 둔다
--       (결과 화면은 dictation_attempts 를 읽으므로 이 컬럼에 의존하지 않는다).

alter table public.dictation_sessions
  add column if not exists items jsonb;

comment on column public.dictation_sessions.items is
  '세션의 문항 목록(expectedText·translation·targetWords·targetForms·contextLabel·reason).
   이것이 없으면 진행 상태가 시작한 기기에만 남아 다른 기기에서 세션 URL 을 열 수 없다.
   NULL = 이 컬럼 이전에 만들어진 세션(복원 불가, 화면이 그 사실을 말한다).';
