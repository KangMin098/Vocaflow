-- supabase/migrations/<ts>_vocab_origin_assignment.sql
--
-- **선생님이 보낸 단어**에 자기 출처를 준다 — `origin='assignment'`.
--
-- ── 왜 필요한가 (2026-08-26 실측) ──────────────────────────────────
-- 학생 화면의 버튼은 `단어장에 담기` 이고 누르면 `담았어요` 로 바뀐다.
-- 그런데 `markAssignmentCollected` 는 **`class_assignment_progress.collected_at` 만 찍는다.**
-- 학생의 `vocabularies` 에는 아무것도 들어가지 않는다 — 화면이 하지 않은 일을 했다고 말한다.
-- 교사 대시보드도 그 숫자를 세어 "N명이 담았어요" 라고 한다. 교사 사슬의 **종착점**이
-- 빈 약속이었다(지문을 고르고 단어를 뽑아 보낸 이유가 학생의 학습 자료가 되는 것인데).
--
-- ── 왜 기존 값을 재사용하지 않나 ────────────────────────────────────
-- `origin` 에는 **삭제 의미가 붙어 있다.** `unenroll_library_book` 은 도서를 해지할 때
-- 그 학습자의 `origin='shared_set'` 낱말을 지운다. 과제 낱말에 그 값을 쓰면
-- **무관한 도서를 해지했을 뿐인데 선생님이 보낸 단어가 함께 사라진다.**
-- `'manual'` 은 "학습자가 직접 넣었다" 는 뜻이라 사실과 다르고,
-- `'imported'` 는 파일 가져오기의 자리다. 그래서 자기 값을 준다.
--
-- 값이 하나 늘면 나중에 "우리 반 단어만 보기" 같은 것도 가능해진다.
-- 지금 그것을 만들지는 않는다 — 다만 **데이터가 거짓말을 하지 않게** 해 둔다.
--
-- 되돌리기: CHECK 를 이전 5개 값으로 되돌린다. 단, 'assignment' 행이 이미 있으면
-- 되돌리기 전에 그 행들의 origin 을 옮겨야 한다(그래서 값 추가는 되돌리기 비용이 있다).

ALTER TABLE public.vocabularies
  DROP CONSTRAINT IF EXISTS vocabularies_origin_check;

ALTER TABLE public.vocabularies
  ADD CONSTRAINT vocabularies_origin_check
  CHECK (origin = ANY (ARRAY['ai', 'shared_set', 'imported', 'manual', 'library', 'assignment']));

COMMENT ON COLUMN public.vocabularies.origin IS
  '낱말이 들어온 경로. 값마다 **삭제 의미가 다르다** — unenroll_library_book 은 shared_set 만 지운다. '
  'assignment = 교사가 학급에 보낸 과제에서 담은 낱말(2026-08-26). '
  'shared_set 을 재사용하면 무관한 도서 해지에 함께 지워지므로 자기 값을 쓴다.';
