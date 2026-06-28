-- 롤백: P4.1 L3 데이터 모델 제거 (클래스/멤버/과제 데이터 손실 — 학습자 자산 무영향)
DROP TABLE IF EXISTS public.assignments;
DROP TABLE IF EXISTS public.class_members;
DROP TABLE IF EXISTS public.classes;
DROP FUNCTION IF EXISTS public.is_class_teacher(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_class_member(uuid, uuid);
