-- 롤백: P4.2 join 함수 제거 (초대코드 참여 불가로 회귀 — 기존 클래스/멤버 무영향)
DROP FUNCTION IF EXISTS public.join_class_by_code(text);
