-- supabase/migrations/_pending_20260817_class_assignments.sql
--
-- ⚠️ 미적용 — 승인 대기. CLAUDE.md §항상 지킬 것: "마이그레이션 자동 적용 금지".
--    승인 시 파일명을 `<timestamp>_class_assignments.sql` 로 옮기고 apply_migration.
--
-- ────────────────────────────────────────────────────────────────────────────
-- F8 해소 — 학급이 학생에게 **무언가를 배달**하게 한다
-- ────────────────────────────────────────────────────────────────────────────
--
-- 왜 필요한가 (2026-08-17 실측):
--   진단의 산술상 10만 학습자는 **교사 3,500명 × 학급 30명(CAC 0)** 으로만 도달한다.
--   그런데 그 경로의 핵심 기구인 학급이 껍데기였다:
--     · `classes` 컬럼은 `id · teacher_id · name · invite_code` 가 전부
--     · `class_members` 는 **코드에서 테스트 파일에만** 등장
--     · 관련 RPC 는 `is_class_member` · `is_class_teacher` · `join_class_by_code` —
--       권한 헬퍼와 가입뿐
--     · 두 테이블 모두 0행
--   즉 **학급을 만들고 30명을 초대해도 학생에게 전달되는 것이 없다.**
--   `/fit` 에서 교사를 학급으로 안내하지 않은 이유가 이것이다 — 빈 방으로 보낼 수는 없다.
--
-- 무엇을 배달하는가 (v1 범위):
--   교사가 지문에서 뽑은 **단어 목록**. 그게 지금 우리가 유일하게 잘 만드는 것이고,
--   교사의 실제 작업("수업 전 어휘 예습 프린트")과 정확히 겹친다.
--   과제·시험·진도 관리로 넓히는 것은 이 루프가 실제로 쓰이는지 본 뒤에 결정한다.
--
-- 루프:
--   ① 교사: 지문 → 어려운 단어 → "우리 반에 보내기"        (class_assignments INSERT)
--   ② 학생: 받은 목록을 보고 내 단어장에 담기               (class_assignment_progress UPSERT)
--   ③ 교사: 몇 명이 담았는지 본다                            (진도 집계 읽기)
--
-- ────────────────────────────────────────────────────────────────────────────
-- 설계 제약 (바꾸기 전에 반드시 읽을 것)
-- ────────────────────────────────────────────────────────────────────────────
--
-- 🔴 **지문을 저장하지 않는다.** 교사가 넣는 것은 대체로 검정교과서·모의고사이고,
--    교과서 저작권은 발행 출판사에, 수능 지문은 원저작자에게 있다(평가원조차 대법원에서
--    저작권료 지급 판결). 저장하면 **우리가 복제·배포 주체가 된다.**
--    → 컬럼 자체를 두지 않는다. 낱말 목록은 지문의 표현을 재현하지 않는다
--      (문장·순서·구성이 사라진다). `/fit` · `share.ts` 와 같은 선이다.
--
-- 🔴 **`words` 크기에 상한을 건다.** jsonb 를 무제한 허용하면 지문을 통째로 넣는 우회가
--    가능하다 — "단어 목록" 이라는 이름만으로는 아무것도 막지 못한다.
--    CHECK 로 **개수(≤200)와 각 항목의 길이**를 강제해 구조적으로 못 넣게 만든다.
--    (화면이 실제로 쓰는 건 24개 안팎이다. 200은 넉넉한 상한이지 목표가 아니다.)
--
-- 🟡 **진도는 학생이 자기 것을 쓴다.** 교사가 학생의 `vocabularies` 를 읽게 만들지 않는다 —
--    그건 개인 학습 데이터 전체를 교사에게 여는 일이라 별개의 결정이고, 지금 필요도 없다.
--    "몇 명이 담았나" 는 전용 행 하나면 답할 수 있다.
--
-- 재실행 안전: 전부 IF NOT EXISTS / DROP POLICY IF EXISTS. 롤백은 파일 하단.

-- ── ⓪ 형태 검사기 ───────────────────────────────────────────────────────────
--
-- CHECK 제약 안에서는 **서브쿼리를 쓸 수 없다**(`cannot use subquery in check constraint`,
-- 2026-08-17 실측 확인). 그런데 jsonb 배열의 각 항목을 검사하려면 `jsonb_array_elements` 를
-- 펼쳐야 한다. → IMMUTABLE 함수로 감싸면 CHECK 에서 호출할 수 있다.
--   (테이블을 조회하지 않으므로 IMMUTABLE 이 정직한 선언이다.)

CREATE OR REPLACE FUNCTION public.is_valid_assignment_words(p_words jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $function$
  SELECT jsonb_typeof(p_words) = 'array'
     AND jsonb_array_length(p_words) BETWEEN 1 AND 200
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_words) AS e
       WHERE jsonb_typeof(e) <> 'object'
          OR e->>'w' IS NULL
          -- 표면형은 낱말이다 — 공백이 있으면 구(句)이거나 문장 조각이다.
          OR char_length(e->>'w') > 64
          OR (e->>'w') ~ '\s'
          -- 뜻은 사전 항목이다. 문장을 넣을 자리가 아니다.
          OR char_length(COALESCE(e->>'m', '')) > 200
     );
$function$;

COMMENT ON FUNCTION public.is_valid_assignment_words(jsonb) IS
  '과제 단어 목록의 형태 검사 — 지문을 통째로 넣는 우회를 구조적으로 막는다. CHECK 전용.';

-- ── ① 과제 ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.class_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 교사가 붙이는 이름. 지문 제목이 아니라 **수업 단위** 다("3과 본문", "9월 모의 21번").
  title       text NOT NULL,

  /*
   * 단어 목록. 항목 형태: {"w": 표면형, "m": 뜻(한국어), "v": V-Level}
   *
   * 왜 별도 테이블이 아니라 jsonb 인가: 이 목록은 **과제의 내용 그 자체**이지 독립적으로
   * 조회·수정되는 개체가 아니다. 행으로 쪼개면 200행짜리 조인이 붙는데 얻는 게 없다.
   * (공용 단어장 `shared_words` 와 다른 점이 이것이다 — 그쪽은 카탈로그에서 개별 검색된다.)
   */
  words       jsonb NOT NULL,

  created_at  timestamptz NOT NULL DEFAULT now(),

  -- 지문 우회 저장 차단 — 이름이 아니라 제약이 막는다.
  CONSTRAINT class_assignments_title_len CHECK (char_length(title) BETWEEN 1 AND 120),
  CONSTRAINT class_assignments_words_shape CHECK (public.is_valid_assignment_words(words))
);

COMMENT ON TABLE public.class_assignments IS
  '학급에 배달되는 단어 목록. 지문 본문은 저장하지 않는다(저작권) — CHECK 가 구조적으로 강제.';

CREATE INDEX IF NOT EXISTS class_assignments_class_created_idx
  ON public.class_assignments (class_id, created_at DESC);

ALTER TABLE public.class_assignments ENABLE ROW LEVEL SECURITY;

-- 교사: 자기 학급 과제 전체 권한. `is_class_teacher` 는 기존 SECURITY DEFINER 헬퍼를 재사용한다
-- (여기서 `classes` 를 직접 조회하면 정책끼리 재귀한다).
DROP POLICY IF EXISTS ca_teacher_all ON public.class_assignments;
CREATE POLICY ca_teacher_all ON public.class_assignments
  FOR ALL
  USING (public.is_class_teacher(class_id, auth.uid()))
  WITH CHECK (public.is_class_teacher(class_id, auth.uid()) AND created_by = auth.uid());

-- 학생: 소속 학급 과제 **읽기만**. 쓰기 정책이 없다는 것이 곧 "학생은 과제를 못 만든다" 다.
DROP POLICY IF EXISTS ca_member_read ON public.class_assignments;
CREATE POLICY ca_member_read ON public.class_assignments
  FOR SELECT
  USING (public.is_class_member(class_id, auth.uid()));

-- ── ② 진도 ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.class_assignment_progress (
  assignment_id uuid NOT NULL REFERENCES public.class_assignments(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 열어 본 시각 / 단어장에 담은 시각. 둘을 나누는 이유: "봤는데 안 했다" 가
  -- 교사에게 가장 쓸모 있는 신호인데, 하나로 합치면 그게 사라진다.
  opened_at     timestamptz NOT NULL DEFAULT now(),
  collected_at  timestamptz,

  PRIMARY KEY (assignment_id, user_id)
);

COMMENT ON TABLE public.class_assignment_progress IS
  '학생이 직접 쓰는 수행 기록. 교사가 학생의 vocabularies 를 읽지 않아도 "몇 명이 했나" 에 답한다.';

CREATE INDEX IF NOT EXISTS cap_user_idx ON public.class_assignment_progress (user_id);

ALTER TABLE public.class_assignment_progress ENABLE ROW LEVEL SECURITY;

-- 학생: 자기 행만. **자기 것을 남의 이름으로 쓸 수 없다**(WITH CHECK 의 user_id 조건).
DROP POLICY IF EXISTS cap_own_all ON public.class_assignment_progress;
CREATE POLICY cap_own_all ON public.class_assignment_progress
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    -- 소속 학급의 과제에만 기록을 남길 수 있다 — 남의 학급 과제에 행을 만들 수 없다.
    AND EXISTS (
      SELECT 1 FROM public.class_assignments a
      WHERE a.id = assignment_id AND public.is_class_member(a.class_id, auth.uid())
    )
  );

-- 교사: 자기 학급 과제의 진도 **읽기만**. 학생 기록을 고칠 수 있으면 그건 진도가 아니다.
DROP POLICY IF EXISTS cap_teacher_read ON public.class_assignment_progress;
CREATE POLICY cap_teacher_read ON public.class_assignment_progress
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.class_assignments a
      WHERE a.id = assignment_id AND public.is_class_teacher(a.class_id, auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_assignment_progress TO authenticated;

-- ── 롤백 ────────────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS public.class_assignment_progress;
--   DROP TABLE IF EXISTS public.class_assignments;
--   (CASCADE 불필요 — 다른 테이블이 이 둘을 참조하지 않는다.)
