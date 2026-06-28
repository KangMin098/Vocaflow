-- P4.2 — 초대코드 클래스 참여 (SECURITY DEFINER).
--   비멤버는 P4.1 RLS상 classes 를 SELECT 불가 → 코드 lookup + class_members 가입을
--   이 함수가 호출자(auth.uid()) 대신 처리. 중복 가입 무시. 추가·비파괴.
-- 롤백: docs/AI_CONTEXT/rollback/P4_2_join_class_by_code_원본.sql

CREATE OR REPLACE FUNCTION public.join_class_by_code(p_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_class uuid; v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_class FROM classes WHERE invite_code = upper(p_code);
  IF v_class IS NULL THEN RETURN NULL; END IF;
  INSERT INTO class_members (class_id, user_id, role) VALUES (v_class, v_uid, 'student')
    ON CONFLICT (class_id, user_id) DO NOTHING;
  RETURN v_class;
END $$;
GRANT EXECUTE ON FUNCTION public.join_class_by_code(text) TO authenticated;
