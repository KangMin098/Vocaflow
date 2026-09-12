-- supabase/migrations/20260813090000_scores_content_ref.sql
--
-- scores 에 콘텐츠 참조(content_ref) 추가 — "어떤 자료로 학습했나"에 답할 수 있게.
--
-- 왜 필요한가 (docs/VOCAB_FRAMEWORK_PROPOSAL.md §06 · Phase 1):
--   `scores` 의 콘텐츠 참조는 `text_id` 하나뿐이고, 그것은 `texts` FK 라 **사용자가 enroll 한
--   텍스트만** 가리킬 수 있다. 그래서 큐레이션 도서 챕터(ScriptQuiz `?book=&ch=`)·공용 단어장
--   (`?set=`)·짧은 글·만화로 학습한 세션은 남길 자리가 없어 전부 NULL 로 적재됐다.
--   실측: 49행 전부 `text_id IS NULL`. "어떤 도서를 학습했나"를 어떤 쿼리로도 답할 수 없다.
--
--   이 값이 없으면 콘텐츠 단위 진행률·리포트·i+1 승급이 전부 불가능하다. 제안 문서가
--   "개선 항목이 아니라 설계 전제" 라고 못 박은 이유다.
--
-- 왜 jsonb 가 아니라 3 컬럼인가:
--   `content_ref {type,id,chapter?}` 는 개념이고, 저장은 질의 가능해야 한다 —
--   "이 도서로 학습한 모든 세션"은 인덱스 있는 컬럼 조건이어야 하지 jsonb 추출이 될 일이 아니다.
--
-- 왜 FK 를 걸지 않는가:
--   type 에 따라 가리키는 테이블이 다르다(library_books · texts · shared_word_sets ·
--   library_articles · comic_books). 다형 참조라 단일 FK 가 성립하지 않는다.
--   대신 CHECK 로 형태 정합만 강제하고, 무결성은 적재 계층(record-score.ts)이 책임진다.
--
-- text_id 는 남긴다 — 기존 쿼리·타입이 참조하고 있고, 이 마이그레이션의 목적은 확장이지 교체가 아니다.
-- 추가 전용. 기존 컬럼/제약 변경 없음.

alter table public.scores
  add column if not exists content_type text,
  add column if not exists content_id uuid,
  add column if not exists content_chapter integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'scores_content_type_chk'
  ) then
    alter table public.scores
      add constraint scores_content_type_chk
      check (content_type is null or content_type in
        ('book', 'text', 'set', 'article', 'comic', 'mine'));
  end if;

  -- 'mine'(내 복습 단어 큐)은 가리킬 자료가 없다 — id 없이 성립하는 유일한 유형.
  -- 나머지 유형은 id 가 없으면 "어떤 자료인지" 를 못 말하므로 존재 자체가 무의미하다.
  if not exists (
    select 1 from pg_constraint where conname = 'scores_content_id_chk'
  ) then
    alter table public.scores
      add constraint scores_content_id_chk
      check (
        content_type is null
        or (content_type = 'mine' and content_id is null)
        or (content_type <> 'mine' and content_id is not null)
      );
  end if;
end $$;

-- "이 도서로 학습한 모든 세션" — 콘텐츠 단위 진행률·리포트의 기본 질의
create index if not exists idx_scores_content
  on public.scores (content_type, content_id, created_at desc)
  where content_type is not null;

-- "내가 이 자료로 얼마나 했나" — 학습자별 콘텐츠 진행률
create index if not exists idx_scores_user_content
  on public.scores (user_id, content_type, content_id)
  where content_type is not null;

comment on column public.scores.content_type is
  '무엇으로 학습했나 — book/text/set/article/comic/mine. content_id·content_chapter 와 함께 content_ref 를 이룬다.';
comment on column public.scores.content_id is
  '콘텐츠 uuid (다형 — type 에 따라 library_books/texts/shared_word_sets/library_articles/comic_books). mine 이면 NULL.';
comment on column public.scores.content_chapter is
  '도서 챕터 번호 (book 유형에서만 의미). 없으면 NULL.';

-- 기존 행 보정 — text_id 가 있으면 그것이 곧 text 유형 참조다(멱등).
-- 실측상 49행 전부 NULL 이라 현재는 no-op 이지만, 재실행·다른 환경에서 의미를 갖는다.
update public.scores
set content_type = 'text', content_id = text_id
where text_id is not null and content_type is null;
