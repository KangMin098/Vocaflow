-- select_*_vocab 는 admin/publish/gate 경로(비 learner-hot). 대형 도서(P&P 61ch=~15s)가
-- PostgREST 기본 timeout(~8s) 초과 → 관리자 추출/게이트/발행/통합테스트 취소. 함수-레벨 30s 로 상향.
ALTER FUNCTION public.select_book_chapter_vocab(uuid) SET statement_timeout TO '30000';
ALTER FUNCTION public.select_article_vocab(uuid) SET statement_timeout TO '30000';
ALTER FUNCTION public.extract_book_vocabulary_admin(uuid, smallint) SET statement_timeout TO '30000';
