-- supabase/migrations/_pending_20260817_acp_compose_foundation.sql
--
-- ACP §20 — 사실 재저작(compose) 기본 설계 · 스키마 토대.
--
-- ⚠ _pending_ 접두사 = 미적용. CLAUDE.md 규약상 마이그레이션 자동 적용 금지 —
--    사용자 승인 후 정식 타임스탬프로 rename 하여 apply_migration.
--
-- 이 마이그레이션이 만드는 것:
--   1. source='original' 허용 (CHECK 확장)
--   2. 발주서 보존 컬럼 (composed_spec)
--   3. 사실 원장 3테이블 — 소스 / 사실 / 확인(attestation)
--   4. 게이트 결과 저장 + 발행 시 강제 트리거
--
-- 라이선스 등급은 건드리지 않는다. license = 'CC0-1.0 (Vocaflow Original)' 로 적으면
-- 기존 acp_classify_license 가 'cc0' 로 판정하고 acp_apply_license_gate 가
-- copyright_safe_in_kr=true · display_only=false 를 자동으로 찍는다. enum 확장 불필요.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1. source='original'
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.library_articles DROP CONSTRAINT IF EXISTS library_articles_source_check;
ALTER TABLE public.library_articles ADD CONSTRAINT library_articles_source_check CHECK (
  source = ANY (ARRAY[
    'voa','nasa','nih','manual','cdc','medlineplus','wikinews','the_conversation',
    'simple_wikipedia','owid','factbook','elife','wikipedia','plos','wikivoyage',
    'usgs','noaa',
    'original'   -- ACP §20 — 사실 기반 자체 저작. 외부 본문 복제 아님.
  ])
);

-- 발주서 원본. "이 글이 어느 빈 칸을 메우려 만들어졌는지" 를 나중에 되물을 수 있어야 한다.
--   { register, target_cefr, topic_domain, target_word_count, commissioned_at, commissioned_by }
ALTER TABLE public.library_articles
  ADD COLUMN IF NOT EXISTS composed_spec jsonb;

COMMENT ON COLUMN public.library_articles.composed_spec IS
  'ACP §20 재저작 발주서 — 커버리지 빈 칸(register×CEFR)이 곧 작업 지시서. NULL = 재저작 아님.';

-- ═══════════════════════════════════════════════════════════════════
-- 2. 소스 — 본문은 저장하지 않는다
-- ═══════════════════════════════════════════════════════════════════
-- 저장하는 순간 복제물을 보유하게 되므로, 남기는 것은 서지 정보와 **단방향 7-gram 지문**뿐이다.
-- 지문에서 원문은 복원되지 않지만 "이 표현이 원문에 있었나"는 정확히 답한다 = 대조 계측기.

CREATE TABLE IF NOT EXISTS public.article_compose_sources (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id   uuid NOT NULL REFERENCES public.library_articles(id) ON DELETE CASCADE,
  publisher    text NOT NULL,                    -- 호스트명 기준 발행사 (독립성 1차 판정)
  url          text NOT NULL,
  published_at timestamptz,
  -- { n, hashes[], tokenCount } — buildFingerprint() 산출물 그대로
  fingerprint  jsonb NOT NULL,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_compose_source_fingerprint
    CHECK (jsonb_typeof(fingerprint->'hashes') = 'array' AND (fingerprint->>'n')::int >= 5),
  -- 본문 컬럼은 의도적으로 없다. 추가하지 말 것 — 이 테이블의 존재 이유가 사라진다.
  CONSTRAINT uq_compose_source_url UNIQUE (article_id, url)
);

CREATE INDEX IF NOT EXISTS idx_compose_sources_article ON public.article_compose_sources(article_id);

COMMENT ON TABLE public.article_compose_sources IS
  'ACP §20 — 재저작 참조 소스. 본문 미보관(지문만). 통신사 재게재는 지문 포함도로 접는다.';

-- ═══════════════════════════════════════════════════════════════════
-- 3. 사실 원장 — 원문 표현과의 연결을 끊는 방화벽
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.article_fact_ledger (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id       uuid NOT NULL REFERENCES public.library_articles(id) ON DELETE CASCADE,
  -- 우리 말로 적은 사실 한 줄. 원문 문장 복사 금지 (복사하면 I13 이 잡는다).
  claim            text NOT NULL,
  kind             text NOT NULL CHECK (kind IN ('event','figure','utterance','background')),
  -- kind='utterance' 전용. 공개 석상 발언만 허용하고 길이는 게이트가 제한한다.
  quote            text,
  quote_is_public  boolean,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_fact_quote_shape CHECK (
    (kind = 'utterance' AND quote IS NOT NULL AND quote_is_public IS NOT NULL)
    OR (kind <> 'utterance' AND quote IS NULL AND quote_is_public IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_fact_ledger_article ON public.article_fact_ledger(article_id);

COMMENT ON TABLE public.article_fact_ledger IS
  'ACP §20 — 사실 원장. 작성(compose) 단계 입력은 이 테이블뿐이며 소스 본문은 프롬프트에 넣지 않는다.';

-- 확인(attestation) — 어느 소스의 몇 번째 자리에서 이 사실을 봤는가.
--   ordinal 은 I14(구조 독립성)의 유일한 재료다. 수집 시점에 안 적으면 나중에 복원할 수 없다
--   (본문을 안 남기므로).
CREATE TABLE IF NOT EXISTS public.article_fact_attestation (
  fact_id   uuid NOT NULL REFERENCES public.article_fact_ledger(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.article_compose_sources(id) ON DELETE CASCADE,
  ordinal   integer NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (fact_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_fact_attestation_source ON public.article_fact_attestation(source_id);

COMMENT ON COLUMN public.article_fact_attestation.ordinal IS
  '그 소스 안에서 이 사실이 몇 번째로 등장했는지(0-based). I14 서술 순서 상관의 재료.';

-- ═══════════════════════════════════════════════════════════════════
-- 4. 게이트 결과 + 발행 강제
-- ═══════════════════════════════════════════════════════════════════
-- n-gram·순위상관 계산은 TS(compose/gates.ts)가 한다 — plpgsql 로 재구현하면 두 벌이 갈린다.
-- DB 는 "계산 결과가 존재하고, 현재 본문에 대한 것이고, critical FAIL 이 없다" 만 강제한다.
-- content_hash 를 함께 적어 **본문을 고치면 게이트가 자동으로 낡은 것이 되게** 한다.

CREATE TABLE IF NOT EXISTS public.article_compose_gates (
  article_id   uuid NOT NULL REFERENCES public.library_articles(id) ON DELETE CASCADE,
  invariant    text NOT NULL,
  severity     text NOT NULL CHECK (severity IN ('critical','warning')),
  verdict      text NOT NULL CHECK (verdict IN ('PASS','WARN','FAIL')),
  detail       text NOT NULL,
  -- 판정 당시 본문 해시. library_articles.content_hash 와 다르면 낡은 판정이다.
  content_hash text NOT NULL,
  checked_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, invariant)
);

COMMENT ON TABLE public.article_compose_gates IS
  'ACP §20 — 재저작 5게이트(I12~I16) 판정 결과. content_hash 불일치 = 재검사 필요.';

CREATE OR REPLACE FUNCTION public.trg_require_compose_gates()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_total    int;
  v_failed   int;
  v_stale    int;
BEGIN
  IF NEW.source <> 'original' THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'published'
     OR (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'published') THEN
    RETURN NEW;
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE severity = 'critical' AND verdict = 'FAIL'),
         count(*) FILTER (WHERE content_hash IS DISTINCT FROM NEW.content_hash)
    INTO v_total, v_failed, v_stale
  FROM public.article_compose_gates
  WHERE article_id = NEW.id;

  IF v_total = 0 THEN
    RAISE EXCEPTION '재저작 아티클에 게이트 판정이 없다 (article_id=%). compose 게이트를 먼저 실행할 것', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_stale > 0 THEN
    RAISE EXCEPTION '게이트 판정이 현재 본문과 다른 해시에 대한 것이다 (article_id=%, stale=%). 본문 수정 후 재검사 필요', NEW.id, v_stale
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_failed > 0 THEN
    RAISE EXCEPTION '재저작 게이트 critical FAIL % 건 (article_id=%). 발행 차단', v_failed, NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_la_require_compose_gates ON public.library_articles;
CREATE TRIGGER trg_la_require_compose_gates
  BEFORE INSERT OR UPDATE ON public.library_articles
  FOR EACH ROW EXECUTE FUNCTION public.trg_require_compose_gates();

COMMENT ON FUNCTION public.trg_require_compose_gates() IS
  'ACP §20 — source=original 발행 게이트. trg_la_require_audio(VOA) 와 같은 자리의 소스별 강제.';

-- ═══════════════════════════════════════════════════════════════════
-- 5. RLS — 파이프라인 내부 자산 (admin/curator 전용)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.article_compose_sources    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_fact_ledger        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_fact_attestation   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_compose_gates      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compose_sources_admin_all ON public.article_compose_sources;
CREATE POLICY compose_sources_admin_all ON public.article_compose_sources
  FOR ALL TO authenticated USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

DROP POLICY IF EXISTS fact_ledger_admin_all ON public.article_fact_ledger;
CREATE POLICY fact_ledger_admin_all ON public.article_fact_ledger
  FOR ALL TO authenticated USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

DROP POLICY IF EXISTS fact_attestation_admin_all ON public.article_fact_attestation;
CREATE POLICY fact_attestation_admin_all ON public.article_fact_attestation
  FOR ALL TO authenticated USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

DROP POLICY IF EXISTS compose_gates_admin_all ON public.article_compose_gates;
CREATE POLICY compose_gates_admin_all ON public.article_compose_gates
  FOR ALL TO authenticated USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

COMMIT;

-- ── 적용 후 확인 ────────────────────────────────────────────────────
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid='public.library_articles'::regclass AND conname='library_articles_source_check';
-- SELECT tgname FROM pg_trigger WHERE tgrelid='public.library_articles'::regclass AND NOT tgisinternal;
