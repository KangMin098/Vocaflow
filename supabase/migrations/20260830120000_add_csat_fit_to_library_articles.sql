-- 수능 적합도 전용 컬럼.
--
-- 왜 jsonb 키 추가가 아니라 새 컬럼인가 (실측 2026-08-30):
--   처음에는 CLAUDE.md 규약대로 `syntax_score`(jsonb)에 `csat_fit` 키를 더했다. 그런데
--   `scripts/acp/process-queue.mjs:148` 이 원문을 처리할 때마다 `compute_article_syntax`
--   RPC 를 부르고, 그 RPC 는
--       SET syntax_score = public.compute_syntax_score(content)
--   로 **통째로 덮어쓴다.** 즉 원문이 재처리될 때마다 적합도가 조용히 사라지고,
--   적합 원문 질의가 소리 없이 낮게 나온다 — 관리 장치가 멈춘 줄도 모르는 상태가 된다.
--   "키만 더하면 마이그레이션이 필요 없다" 는 규약은 **그 컬럼에 통째로 쓰는 주인이 없을 때**만 성립한다.
--
-- 담는 것 (scripts/csat/score-articles.mjs 가 쓴다):
--   { v, bandsHash, type, shape, pass, measuredAt }
--   pass > 0 이면 기출 대역 + 산문 게이트 + 담화 대역을 통과하는 지문을 하나 이상 내는 원문이다.
--
-- 추가만 한다 — 기존 행·쿼리에 영향 없다.
ALTER TABLE public.library_articles ADD COLUMN IF NOT EXISTS csat_fit jsonb;

COMMENT ON COLUMN public.library_articles.csat_fit IS
  '수능 적합도 채점 결과 (scripts/csat/score-articles.mjs). pass>0 = 기출 대역·산문·담화 게이트를 통과하는 지문을 내는 원문. syntax_score 에 두면 compute_article_syntax RPC 가 덮어쓴다.';

-- 적합 원문 질의를 상시로 쓰므로 부분 인덱스를 둔다.
CREATE INDEX IF NOT EXISTS idx_la_csat_fit_pass
  ON public.library_articles ((((csat_fit ->> 'pass'))::int))
  WHERE csat_fit IS NOT NULL;
