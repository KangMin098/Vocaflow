-- 롤백: A3.4b question_ko 컬럼 추가 되돌리기
-- 주의: 컬럼 DROP 시 적재된 한국어 질문 번역 데이터 손실(영어 question 은 보존).

ALTER TABLE public.quiz_questions DROP COLUMN IF EXISTS question_ko;
