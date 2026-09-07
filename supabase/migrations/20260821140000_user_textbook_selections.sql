-- supabase/migrations/20260821140000_user_textbook_selections.sql
--
-- **내가 고른 교재** — My Library 교재 면의 저장소.
--
-- ── 왜 새 테이블인가 (다른 길을 먼저 재 봤다) ───────────────────────
-- ① `study_plan_items` 재사용 — 불가.
--    `material_type` CHECK 가 `book|article|word_set|script` 4종으로 막혀 있고,
--    `material_id` 가 **uuid** 다. 교재 권은 DB 행이 아니라 `SERIES_SPINE` 의 **step 번호**로
--    존재하므로 넣을 uuid 가 없다. 권마다 행을 만들면 사다리 정본이 코드와 DB 두 곳에 생긴다 —
--    이 저장소가 반복해서 겪은 "눈금이 둘이면 갈린다" 그 사고다.
-- ② V-Level 자동 매칭만으로 대체 — 불가.
--    실측(2026-08-21): 전 계정의 `current_v_level` 이 0(미진단) 2명 · 11 1명이다.
--    **V1~V7 에 아무도 없다.** 게다가 시리즈는 V8+(성인)을 일부러 제외하므로
--    V11 학습자에게는 맞는 권이 아예 없다. 자동 매칭은 "고른다" 도 아니고 동작하지도 않는다.
--
-- ── 무엇을 저장하나 ─────────────────────────────────────────────────
-- **step 번호 하나뿐이다.** 권의 제목·학령·유형은 `SERIES_SPINE`(코드)이 소유하므로
-- 여기 복사하지 않는다. 복사하면 시리즈를 고칠 때 DB 가 낡은 이름을 계속 말한다.
--
-- 되돌리기: `DROP TABLE public.user_textbook_selections;` 하나. 다른 표를 건드리지 않는다.

CREATE TABLE IF NOT EXISTS public.user_textbook_selections (
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- SERIES_SPINE 의 계단 번호(1~7). 범위를 넓게 잡은 이유는 사다리가 늘 수 있기 때문이고,
  -- 실제 유효성은 코드가 판정한다(없는 step 은 화면에서 그냥 안 보인다).
  step        smallint    NOT NULL CHECK (step BETWEEN 1 AND 99),
  selected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, step)
);

COMMENT ON TABLE public.user_textbook_selections IS
  '학습자가 고른 교재 권(SERIES_SPINE step). 제목·학령·유형은 코드가 소유 — 여기 복사 금지(20260821140000).';

ALTER TABLE public.user_textbook_selections ENABLE ROW LEVEL SECURITY;

-- 내 것만 읽고 쓴다. 권한 컬럼이 없으므로 FOR ALL 로 충분하다
-- (CONVENTIONS §인증 — 권한·상태 컬럼이 있는 표에만 컬럼 단위 분리가 필요하다).
CREATE POLICY "own textbook selections"
  ON public.user_textbook_selections
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
