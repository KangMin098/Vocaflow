-- supabase/migrations/20260812133000_restore_pending_words.sql
--
-- 20260719161409_drop_unused_empty_tables 가 pending_words 를 CASCADE 삭제했다.
--
-- ⚠️ 이번 건의 특이점 — **CASCADE 가 함수도 지운다.**
--   앞선 4건에서는 "테이블은 지워졌는데 함수는 남았다" 였다. 여기서는 반대다:
--     · record_pending_words        RETURNS INT                    → 살아남음
--     · update_pending_word_status  RETURNS public.pending_words   → 테이블 **복합 타입**에
--       의존하므로 DROP TABLE CASCADE 가 함께 지웠다
--   그래서 앱의 transitionPendingWord(actions.ts)는 테이블만 복원해도 여전히 실패한다.
--   → DB_SCHEMA.md 의 "CASCADE 는 함수를 지우지 않는다" 서술을 이 사례로 보정했다.
--
-- 원본은 저장소에 없고 DB 이력에만 있었다 — 20260525041709(테이블+record RPC) +
-- 20260525044205(상태 전환 RPC). 삭제 마이그레이션도 같았다(DB 에만 적용, 저장소 미기록).
-- 그 습관이 원인과 복구 난이도를 동시에 만들었다.
--
-- 역추적 교차검증 3출처 일치: record_pending_words 의 INSERT(6컬럼) ·
-- packages/types 생성 타입(12컬럼) · 원본 DDL(12컬럼). status 5값도 앱
-- PendingWordStatus 와 일치(auto-classify 포함).
--
-- 검증(적용 시점 실측): 누적 upsert(encounter_count 1→2) · length<2 필터 ·
--   set_updated_at 트리거가 과거 값을 덮어씀 · CHECK(status) · UNIQUE(lemma) ·
--   status 5값 전부 통과 · 탐침 잔여 0.
--
-- ⚠️ 미해결(복원과 무관한 별개 결함): RLS 가 own(본인) 정책 2개뿐이라
--   /admin/pending-words 가 requireAdmin 통과 후 일반 클라이언트로 조회할 때
--   **admin 이 다른 사용자의 항목을 볼 수 없다.** 원본을 그대로 복원했으므로
--   정책 추가는 별건으로 판단한다(임의 추가는 원본과 달라진다).

CREATE TABLE IF NOT EXISTS public.pending_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lemma TEXT NOT NULL,
  surface TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  text_id UUID REFERENCES public.texts(id) ON DELETE SET NULL,
  context_snippet TEXT,
  encounter_count INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'auto-classify', 'rejected', 'added')),
  admin_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.pending_words IS 'Option C 미매칭 lemma 큐 — 추출 시 L1+L2 모두 miss 한 lemma 누적 → admin 리뷰 → shared_dictionary 보강.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_words_lemma_unique
  ON public.pending_words(lemma);
CREATE INDEX IF NOT EXISTS idx_pending_words_status_created
  ON public.pending_words(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_words_user
  ON public.pending_words(user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_pending_words_updated ON public.pending_words;
CREATE TRIGGER trg_pending_words_updated
  BEFORE UPDATE ON public.pending_words
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.pending_words ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own pending_words insert" ON public.pending_words;
CREATE POLICY "own pending_words insert" ON public.pending_words
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own pending_words select" ON public.pending_words;
CREATE POLICY "own pending_words select" ON public.pending_words
  FOR SELECT USING (auth.uid() = user_id);

-- CASCADE 가 함께 지운 RPC 복원 (원본 20260525044205 그대로)
CREATE OR REPLACE FUNCTION public.update_pending_word_status(
  p_id UUID,
  p_status TEXT,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS public.pending_words
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_role TEXT;
  v_row public.pending_words;
BEGIN
  SELECT role INTO v_role FROM public.user_profiles WHERE user_id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  IF p_status NOT IN ('pending', 'reviewing', 'auto-classify', 'rejected', 'added') THEN
    RAISE EXCEPTION 'invalid status: %, expected pending|reviewing|auto-classify|rejected|added', p_status;
  END IF;

  UPDATE public.pending_words
  SET
    status = p_status,
    admin_note = COALESCE(p_admin_note, admin_note),
    resolved_at = CASE
      WHEN p_status IN ('rejected', 'added') THEN now()
      ELSE resolved_at
    END,
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'pending_word % not found', p_id;
  END IF;

  RETURN v_row;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_pending_word_status(uuid, text, text) TO authenticated;
