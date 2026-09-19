-- 20260912210000_csat_item_reviews.sql
--
-- **교재 문항 3인 페르소나 검수 — `csat_analysis_reviews` 의 교재판.**
--
-- ── 왜 필요한가 (DB 실측 2026-09-12) ────────────────────────────────
-- 검증이 거꾸로 걸려 있었다:
--
--   기출 분석 2,234건            → 3인 검수 6,702행 (정확히 ×3)   · 학습자에게 안 간다
--   조판된 19권 · 지면 1,860문항 → 3인 검수      0행              · **학습자가 받는 것이다**
--
-- 0행이었던 이유는 담을 표가 없어서다. 그런데 ⑦ 검수 화면의 「L2 3인 페르소나」 눈금은
-- 기출 쪽 수를 세고 있어서 그 구멍이 **초록으로 가려졌다** — 눈금이 있는데 다른 것을
-- 세는 것은 눈금이 없는 것보다 나쁘다.
--
-- ── 왜 jsonb 가 아니라 표인가 ───────────────────────────────────────
-- 이 저장소는 jsonb 에 키를 더해 마이그레이션을 피하는 관행이 있다(`answer_key.explanation_ko`).
-- 검수 기록은 그렇게 두지 않는다. 두 가지를 DB 가 해 줘야 하기 때문이다:
--   ① **「서로 다른 3인」 강제** — `unique (item_id, persona)` 가 같은 눈이 세 번 보는 것을 막는다.
--      jsonb 배열로는 코드만이 그것을 막고, 코드는 실수한다.
--   ② **집계 속도** — `csat_dcp_items` 는 65만 행이고 PostgREST 집계 함수가 이 프로젝트에서
--      꺼져 있다(`PGRST123`). jsonb 를 스캔해 「3인 통과 문항 수」를 세는 경로는 조판마다
--      돈다. 인덱스가 있는 표는 그 권의 60문항만 짚는다.
--
-- 규약은 기출 쪽(`csat_analysis_reviews`)과 **글자 그대로 같다** — 페르소나 3종 · 판정 3종 ·
-- findings/checked jsonb · unique(대상, 페르소나) · RLS 켜고 정책 없음. 둘이 갈리면
-- 「3인 검수」라는 말이 두 가지를 뜻하게 된다.
--
-- 되돌리기: `drop table public.csat_item_reviews;`
--   — 잃는 것은 검수 기록뿐이다. 문항은 이 표의 CASCADE 대상이 아니다(방향이 반대다).

create table if not exists public.csat_item_reviews (
  id          uuid primary key default gen_random_uuid(),
  -- 문항이 사라지면 그 검수 기록도 뜻이 없다.
  item_id     uuid not null references public.csat_dcp_items (id) on delete cascade,
  -- 출제자 · 오답분석가 · 현장강사. 기출 쪽과 같은 셋이다.
  persona     text not null check (persona in ('setter', 'analyst', 'tutor')),
  verdict     text not null check (verdict in ('pass', 'revise', 'fail')),
  -- 무엇이 걸렸는가. 빈 배열이 기본 — 「아직 안 봤다」와 「봤는데 깨끗하다」를 가른다
  -- (후자는 행이 있고 findings 가 비어 있다).
  findings    jsonb not null default '[]'::jsonb,
  -- 무엇을 봤는가. 이것이 없으면 pass 가 「무엇에 대한 pass」인지 알 수 없다.
  checked     jsonb not null default '[]'::jsonb,
  reviewed_at timestamptz not null default now(),
  -- ⚠️ 이 제약이 이 표의 존재 이유다 — 같은 페르소나가 두 번 pass 해도 3인이 안 된다.
  unique (item_id, persona)
);

-- 그 문항의 검수 전부를 짚는다.
create index if not exists csat_item_reviews_item_idx
  on public.csat_item_reviews (item_id);

-- 조판기의 질의 모양 그대로 — verdict 로 먼저 좁히고 item_id 로 짚는다
-- (`.eq('verdict','pass').in('item_id', ids)`).
create index if not exists csat_item_reviews_pass_idx
  on public.csat_item_reviews (verdict, item_id);

-- 기출 검수표와 같다: RLS 를 켜고 정책을 두지 않는다 → 서버(드레인·조판기)만 읽고 쓴다.
-- 학습자에게 검수 기록을 보일 이유가 없고, Admin 화면은 admin 클라이언트로 읽는다.
alter table public.csat_item_reviews enable row level security;

comment on table public.csat_item_reviews is
  '교재 문항 3인 페르소나 검수(csat_analysis_reviews 의 교재판). 지면에 실리는 문항을 검증한다 — unique(item_id, persona) 가 「서로 다른 3인」을 강제한다.';
comment on column public.csat_item_reviews.findings is
  '걸린 것. 빈 배열 = 봤는데 깨끗하다. 행이 없음 = 아직 안 봤다.';
comment on column public.csat_item_reviews.checked is
  '무엇을 봤는가. 없으면 pass 가 무엇에 대한 pass 인지 알 수 없다.';
