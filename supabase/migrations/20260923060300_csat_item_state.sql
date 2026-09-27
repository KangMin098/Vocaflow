-- 20260923060300_csat_item_state.sql
--
-- **문항의 상태와 사유를 담는 곁 표** (DD-69 B6·A3 · ⑤ 집필 · ⑥ 해설 · ⑦ 검수).
--
-- ── 왜 필요한가 (실측 2026-09-23) ───────────────────────────────────
-- `csat_dcp_items` 는 **880,337행인데 status 도 reason 도 없다.** 그래서
-- 「이 문항이 쓸 수 있는가 · 왜 못 쓰는가」를 화면이 매번 다시 계산하고, 그 결과는
-- 어디에도 안 남는다. 실측으로 드러난 구멍:
--
--   검수된 321문항 중 3인 전원 pass = 29 · **미해소 revise/fail = 292**
--   그 292문항은 조판기만 알고(후보에서 뺀다) **어느 화면에도 안 나온다.**
--   사다리 밖 재고 164,564 / 880,337(19%)도 「왜 밖인가」가 어디에도 없다.
--
-- ── 왜 본표에 컬럼을 더하지 않나 ────────────────────────────────────
-- ⚠️ `csat_dcp_items` 는 **1,579 MB · 880,337행**이다. 컬럼 추가 자체는 빠르지만
--    (PG11+ 는 기본값 있는 추가도 재작성을 안 한다) **백필과 인덱스가 비싸고**,
--    무엇보다 기본 상태인 문항이 87만 개다 — 87만 행에 'usable' 을 적어 두는 것은
--    아무 정보도 안 담는다.
-- 그래서 **기본값에서 벗어난 문항만** 여기 한 행을 갖는다. 초기 적재는 ⑦ 검수 결과
-- 292행뿐이라 가볍다.
--
-- ── 읽는 쪽 규칙 (⚠️ 이 표의 가장 중요한 계약) ──────────────────────
--   행이 **없으면** 'usable' 이다. **행이 없는 것을 0 으로 세지 않는다.**
--   `count ?? 0` 으로 「막힌 문항 0」을 그리면 그것이 곧 거짓 안심이다
--   (AGENTS.md 「하지 말 것」의 같은 항목).
--   막힌 문항 수는 `select count(*) from csat_item_state where status='blocked'` 이고,
--   전체 대비 비율의 분모는 `csat_dcp_items` 쪽에서 따로 센다.
--
-- ── 사유를 왜 코드로 닫나 ───────────────────────────────────────────
-- 자유 문자열이면 같은 사유가 다섯 가지 표기로 쌓이고, 화면이 그것으로 묶을 수 없다.
-- 코드는 닫고(CHECK) 사람이 읽을 문장은 `reason` 에 따로 둔다 — 공개 화면 규칙 D3
-- 「이벤트 속성은 닫힌 열거형만」과 같은 판단이다.
--
-- 되돌리기: `drop table public.csat_item_state;` — 본표는 안 건드린다.

create table if not exists public.csat_item_state (
  -- 문항이 사라지면 그 상태도 뜻이 없다(`csat_item_reviews` 와 같은 방향).
  item_id     uuid primary key references public.csat_dcp_items (id) on delete cascade,

  -- 'usable' 행도 허용한다 — 「막혔다가 풀렸다」를 기록으로 남기기 위해서다.
  -- 다만 처음부터 멀쩡한 문항은 행을 만들지 않는다.
  status      text not null check (status in ('usable', 'blocked', 'retired')),

  -- 닫힌 열거형. 새 사유가 필요하면 마이그레이션으로 연다 — 그때 화면도 같이 고치게 된다.
  --   review_fail     ⑦ 3인 검수에서 fail
  --   review_revise   ⑦ 3인 검수에서 revise(미해소)
  --   no_explanation  ⑥ 해설이 안 붙었다
  --   off_ladder      ⑤ 사다리가 그 (유형, 수준) 조합을 안 쓴다
  --   spec_stale      지문·규격이 바뀌어 근거가 달라졌다
  --   source_blocked  원문 적격이 막았다
  reason_code text not null check (reason_code in (
                'review_fail', 'review_revise', 'no_explanation',
                'off_ladder', 'spec_stale', 'source_blocked')),

  -- 사람이 읽을 한 줄. 비워 두면 화면이 코드만 보여 주고 그것으로는 고칠 수 없다.
  reason      text,

  -- 무엇이 이 판정을 넣었나 — 드레인 실행 id. 「언제 돈 무엇이 이렇게 판정했나」를 잇는다.
  run_id      uuid references public.csat_drain_runs (id) on delete set null,

  updated_at  timestamptz not null default now(),

  -- blocked 는 사람이 읽을 사유 없이 남길 수 없다.
  constraint csat_item_state_reason_required
    check (status <> 'blocked' or (reason is not null and length(btrim(reason)) >= 5))
);

-- 화면의 질의: 「이 단계에서 막힌 문항 N개」 — status + 사유별로 센다.
create index if not exists csat_item_state_status_idx
  on public.csat_item_state (status, reason_code);

-- 막힌 것만 훑는다(전체의 일부라 부분 인덱스가 작다).
create index if not exists csat_item_state_blocked_idx
  on public.csat_item_state (reason_code, updated_at desc)
  where status = 'blocked';

alter table public.csat_item_state enable row level security;

comment on table public.csat_item_state is
  '문항의 상태·사유 곁 표. csat_dcp_items(880,337행 · 1.5GB)에 컬럼을 더하지 않으려고 뗐다. ⚠️ 행이 없으면 usable 이다 — 행 없음을 0 으로 세지 않는다.';
comment on column public.csat_item_state.reason_code is
  '닫힌 열거형. 자유 문자열이면 같은 사유가 여러 표기로 쌓여 화면이 묶지 못한다. 새 사유는 마이그레이션으로 연다.';
comment on column public.csat_item_state.run_id is
  '이 판정을 넣은 드레인 실행. 「언제 돈 무엇이 이렇게 판정했나」를 잇는 유일한 고리다.';
