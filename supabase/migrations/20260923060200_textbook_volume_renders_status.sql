-- 20260923060200_textbook_volume_renders_status.sql
--
-- **조판 기록에 발행 상태를 붙인다** (DD-69 A5·B6 · ⑧ 조판·발행 점수 10/22).
--
-- ── 왜 필요한가 (실측 2026-09-23) ───────────────────────────────────
-- `textbook_volume_renders` 19행에는 **status 도 승인도 없다.** 찍는 순간 곧 「최신 규격」이고
-- (19행 전부 `brand_fingerprint = 8ded9c49`), `failed_checks` 는 전 행 NULL 이다.
-- 그 결과 한 권을 따라가면 세 화면이 서로 다른 말을 한다:
--
--   조판 기록  Vocaflow Vocab Advanced · 20단원 120문항 · auto 10/10
--   ⑦ 검수     같은 권 3인 검수 **1 / 60**
--   카탈로그   같은 권 **「냈음」**
--   학습자     `/library/textbooks/vocab/5` 가 공개 URL 로 열린다
--
-- 「찍혔다」와 「내보내도 된다」가 **같은 사실로 뭉쳐 있어서**다. 둘을 가른다.
--
-- ── 왜 기본값이 'published' 인가 ────────────────────────────────────
-- ⚠️ 지금 매대에 서 있는 권을 이 마이그레이션이 **조용히 내리면 안 된다.**
-- 공개 표면이 한 번에 바뀌는 것은 되돌리기 어렵고, 무엇이 사라졌는지 아무도 못 센다.
-- 그래서 기존 19행은 전부 `published` 로 들어오고, **내리는 것은 사람이 한 행씩** 한다
-- (`status = 'review'` 로 내리면 그 권이 매대에서 빠진다).
-- 새로 찍히는 권의 기본값은 `press-drain` 이 `'rendered'` 로 명시해 넣는다 —
-- 컬럼 기본값과 스크립트가 넣는 값을 일부러 다르게 둔다.
--
-- ── 되돌리기 ───────────────────────────────────────────────────────
--   alter table public.textbook_volume_renders
--     drop column status, drop column status_reason, drop column published_at;
--   — 19행짜리 표라 즉시 끝난다. 잃는 것은 상태 구분뿐이고 조판 기록 자체는 안 건드린다.

alter table public.textbook_volume_renders
  add column if not exists status text not null default 'published'
    check (status in ('rendered', 'review', 'approved', 'published', 'withdrawn')),
  add column if not exists status_reason text,
  add column if not exists published_at timestamptz;

-- 기존 19행은 이미 매대에 있으므로 발행 시각을 조판 시각으로 본다(모르는 값을 지어내지 않되,
-- null 로 두면 화면이 「발행됐는데 언제인지 모른다」를 매 행에 적게 된다).
update public.textbook_volume_renders
   set published_at = coalesce(published_at, rendered_at)
 where status = 'published' and published_at is null;

-- published 인데 발행 시각이 없는 행이 생기지 않게 한다 — 「발행됐다」의 뜻을 하나로 고정한다.
alter table public.textbook_volume_renders
  add constraint textbook_volume_renders_published_at_required
    check (status <> 'published' or published_at is not null) not valid;
alter table public.textbook_volume_renders
  validate constraint textbook_volume_renders_published_at_required;

-- 내린 권은 왜 내렸는지 남긴다 — 사유 없는 withdrawn 은 다음 세션에게 아무것도 안 알려 준다.
alter table public.textbook_volume_renders
  add constraint textbook_volume_renders_withdraw_reason
    check (status <> 'withdrawn' or (status_reason is not null and length(btrim(status_reason)) >= 10)) not valid;
alter table public.textbook_volume_renders
  validate constraint textbook_volume_renders_withdraw_reason;

-- 매대가 「발행된 것만」 읽는 질의 모양.
create index if not exists textbook_volume_renders_status_idx
  on public.textbook_volume_renders (status, series, band);

comment on column public.textbook_volume_renders.status is
  '발행 상태. rendered=찍혔다 · review=검수 대기 · approved=승인됨 · published=매대에 있다 · withdrawn=내렸다. 「찍혔다」와 「내보내도 된다」는 다른 사실이다.';
comment on column public.textbook_volume_renders.status_reason is
  'review·withdrawn 인 이유. withdrawn 은 10자 이상 필수 — 사유 없는 철회는 다음 세션에게 「막혔다」만 남긴다.';
comment on column public.textbook_volume_renders.published_at is
  '매대에 선 시각. published 면 NOT NULL 이 CHECK 로 강제된다.';
