-- A3.4b — quiz_questions.question_ko: ScriptQuiz 질문 한국어 번역 컬럼
--
-- 배경: quiz_questions 는 question(영어)·options(jsonb, 옵션별 textKo 보유)만 있어
--       showKorean 토글 시 옵션만 번역되고 질문은 영어로 남았다.
-- 추가: nullable text 컬럼 — fetchQuizSession 이 questionKo 로 매핑(QuizQuestion.questionKo optional).
-- 데이터 무손실(추가 전용). 롤백: docs/AI_CONTEXT/rollback/scriptquiz_question_ko_원본.sql

ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS question_ko text;
COMMENT ON COLUMN public.quiz_questions.question_ko IS 'ScriptQuiz 질문 한국어 번역 (showKorean 토글 보조 표시). NULL 허용.';
