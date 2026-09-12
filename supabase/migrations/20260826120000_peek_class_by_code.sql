-- supabase/migrations/<ts>_peek_class_by_code.sql
--
-- **초대받은 학생이 가입 전에 무엇에 초대됐는지 본다.**
--
-- ── 왜 필요한가 (2026-08-26) ────────────────────────────────────────
-- 교사가 공유하는 것은 지금 **맨 코드 6자**(`ABC123`)다. 그것을 받은 학생은
--   ① vocaflow.app 을 찾아 ② 가입하고 ③ `클래스` 라는 화면을 찾아 ④ 코드를 붙여넣어야 한다.
-- 네 단계 중 하나만 틀려도 끝이고, ③ 은 학생이 스스로 도달할 이유가 없는 화면이다.
-- 산술이 유일하게 성립한다고 한 경로(교사 3,500명 × 학급 30명)의 한가운데가 여기서 끊긴다.
--
-- 그래서 초대를 **링크**(`/join/ABC123`)로 만든다. 그 화면이 열리려면 익명 방문자가
-- "무엇에 초대됐는지" 를 볼 수 있어야 한다 — 그런데 `classes` 의 RLS 는 비멤버에게 닫혀 있다
-- (그래서 `join_class_by_code` 도 SECURITY DEFINER 다).
--
-- ── 왜 가입 **전에** 보여줘야 하나 ──────────────────────────────────
-- 코드가 틀렸거나 오래됐을 때, 가입을 끝낸 뒤에 알려 주면 그 사람은 계정만 하나 만들고 떠난다.
-- 초대의 진위를 먼저 보여주는 것이 전환의 문제이자 정직함의 문제다.
--
-- ── 무엇을 돌려주고 무엇을 감추나 ───────────────────────────────────
-- 학급 이름과 인원 수만. **교사의 신원은 돌려주지 않는다**(id·이메일·이름 모두).
-- 노출 범위는 이미 코드가 주는 권한보다 **좁다** — 코드를 아는 사람은
-- `join_class_by_code` 로 그 학급에 들어갈 수 있다. 이름을 보는 것이 더 약한 권한이다.
--
-- 열거(enumeration): 코드는 혼동 문자를 뺀 32자 알파벳 6자리 = 약 10.7억 가지이고,
-- 맞혀도 얻는 것은 학급 이름 하나다. 개인정보가 아니다.
--
-- 되돌리기: `DROP FUNCTION public.peek_class_by_code(text);` — 데이터는 건드리지 않는다.

CREATE OR REPLACE FUNCTION public.peek_class_by_code(p_code text)
RETURNS TABLE(class_name text, member_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.name,
         (SELECT count(*)::int FROM class_members m WHERE m.class_id = c.id)
  FROM classes c
  WHERE c.invite_code = upper(trim(p_code))
  LIMIT 1
$function$;

COMMENT ON FUNCTION public.peek_class_by_code(text) IS
  '초대코드로 학급 이름과 인원만 조회 — 익명 허용. 교사 신원은 돌려주지 않는다. '
  '초대 링크(/join/[code])가 가입 전에 "무엇에 초대됐는지" 를 보여주기 위한 것이다. '
  '코드를 아는 사람은 이미 join_class_by_code 로 가입할 수 있으므로 노출은 그보다 좁다.';

-- 익명 학생이 부른다 — 이 함수의 존재 이유다.
GRANT EXECUTE ON FUNCTION public.peek_class_by_code(text) TO anon, authenticated;
