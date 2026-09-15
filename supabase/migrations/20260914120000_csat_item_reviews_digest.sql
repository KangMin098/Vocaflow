-- supabase/migrations/20260914120000_csat_item_reviews_digest.sql
--
-- **검수 판(版) — 그 판정이 어느 문항을 보고 내려진 것인가.**
--
-- ── 왜 (실측 2026-09-13~14) ──────────────────────────────────────────
-- 세 회차의 3인 검수 통과율이 5/60 · 0/55 · 4/57 로 제자리였다. 재고 품질 탓인 줄 알았는데
-- 아니었다. 차단 사유 1위가 「해설」(17.0% · 117문항)이었고 그 해설은 같은 날 고쳐져
-- **38,522문항이 다시 쓰였다.** 그런데 그때 내려진 `fail` 은 그대로 남았고, 조판기는 그
-- 판정으로 문항을 영구히 뺀다. 실측 — 후보에서 빠진 163문항 중 **123(75%)이 판정 시점과
-- 해설이 다르다**(`scripts/textbook/review-staleness.mjs`).
--
-- 즉 **생성기를 고쳐도 옛 판정이 안 풀린다.** 후보 풀은 품질이 오르는 동안 단조롭게 줄고,
-- 회차마다 새 문항을 태우기만 하니 통과율이 구조적으로 회복될 수 없었다.
--
-- ── 규칙은 하나다 ────────────────────────────────────────────────────
-- 검수 행에 그때 읽은 문항의 지문(digest)을 적는다. 게이트는 **지금 문항의 지문과 같은
-- 판정만 센다.** 다르면 pass 도 fail 도 아니고 「못 쟀다」이며 그 문항은 검수 큐로 돌아간다.
-- 판정 규칙과 계산은 `packages/library-pipeline/src/textbook/review-digest.ts` 가 정본이다
-- (sha256 of canonical JSON — jsonb 가 키 순서를 바꿔 저장하므로 키를 정렬해 넣는다).
--
-- ⚠️ **판정을 지우지 않는다.** 사람(페르소나)이 실제로 읽고 내린 기록이다. 무효가 되는 것이
--   아니라 **다른 판에 대한 기록**이 될 뿐이다. 지우면 「왜 그때 막혔나」를 다시 물을 수 없다.
--
-- ⚠️ **기존 516행은 NULL 로 남는다 — 「같다」가 아니라 「모른다」다.** 통과로도 차단으로도
--   세지 않는다. 이 저장소가 「못 잰 것을 0 으로 뭉개」 겪은 사고를 되풀이하지 않기 위해서다.
--
-- 되돌리기: `alter table public.csat_item_reviews drop column reviewed_digest;`
--   열만 지우면 원래대로다. 판정 행 자체는 건드리지 않으므로 데이터 손실이 없다.

begin;

alter table public.csat_item_reviews
  add column if not exists reviewed_digest text;

-- 64자 hex 가 아니면 넣지 못하게 막는다 — 빈 문자열이나 잘린 값이 들어오면
-- 「모른다(NULL)」와 구별이 안 되고, 그러면 낡은 판정이 조용히 지금 판으로 읽힌다.
alter table public.csat_item_reviews
  drop constraint if exists chk_cir_reviewed_digest_hex;
alter table public.csat_item_reviews
  add constraint chk_cir_reviewed_digest_hex
  check (reviewed_digest is null or reviewed_digest ~ '^[0-9a-f]{64}$');

comment on column public.csat_item_reviews.reviewed_digest is
  '그 판정이 읽은 문항의 판 — sha256(canonical JSON of {payload, answer_key}). 정본은 library-pipeline 의 reviewDigest(). NULL 은 「같다」가 아니라 「어느 판인지 모른다」(2026-09-14 이전 행).';

-- 게이트는 「이 문항의 지금 판 판정」을 묻는다 — (item_id, reviewed_digest) 로 바로 좁힌다.
create index if not exists idx_cir_item_digest
  on public.csat_item_reviews (item_id, reviewed_digest);

commit;
