-- supabase/migrations/_pending_20261008200000_knowledge_release_approval.sql
-- B7 학습자 출시 승인(2026-10-08) — 「채택(adopted)」은 제품에 쓸 수 있다는 판단이지 학습자에게 내보내도 된다는 승인이 아니다.
-- 적용을 켜려면(→ active) 채택 + 검증 계획(기존 가드) 에 더해 **이 적용 행에 대한 출시 승인**이 있어야 한다.
--   · 승인은 사람이 남긴다(승인자 · 시각 · 사유). system:* 승인자는 받지 않는다.
--   · 중단 · 롤백하면 승인이 지워진다 — 일시 중단 뒤 다시 켜도 새 승인이 필요하다(「잠깐 멈췄다 켜기」로 B7 을 건너뛰지 않는다).
--   · 켜져 있는 동안 승인 기록은 바꿀 수 없다(켠 근거가 사후에 바뀌지 않게).
-- 기존 행: 지금 active 0건(2026-10-08 노출 중단 후) — 승인 없는 active 행이 없어 백필이 필요 없다. 적용 전 다시 확인한다.
-- 되돌리기(아래 주석): 가드를 20261008120000 정의로 되돌리고 열 셋을 지운다.

alter table public.knowledge_applications
  add column release_approved_by text,
  add column release_approved_at timestamptz,
  add column release_note text;

create or replace function public.knowledge_applications_guard() returns trigger
language plpgsql set search_path = public as $$
declare st text;
begin
  new.updated_at := now();

  -- 중단 · 롤백 · 초안으로 가면 출시 승인을 지운다
  if tg_op = 'UPDATE' and new.status <> 'active' and old.status = 'active' then
    new.release_approved_by := null;
    new.release_approved_at := null;
    new.release_note := null;
  end if;

  -- 켜져 있는 동안 승인 기록 고정
  if tg_op = 'UPDATE' and old.status = 'active' and new.status = 'active'
     and (new.release_approved_by is distinct from old.release_approved_by
          or new.release_approved_at is distinct from old.release_approved_at
          or new.release_note is distinct from old.release_note) then
    raise exception '적용 중에는 출시 승인 기록을 바꿀 수 없다 — 중단한 뒤 다시 승인한다';
  end if;

  if new.status = 'active' then
    select status into st from public.knowledge_items where id = new.item_id for update;
    if st not in ('adopted','applied') then
      raise exception '채택(adopted)된 항목만 적용을 켤 수 있다 — 지금 %', st;
    end if;
    if not exists (select 1 from public.knowledge_trials t where t.application_id = new.id) then
      raise exception '검증 프로토콜(knowledge_trials) 없이 적용을 켤 수 없다';
    end if;
    if new.release_approved_at is null
       or coalesce(btrim(new.release_approved_by), '') = ''
       or new.release_approved_by like 'system:%'
       or coalesce(btrim(new.release_note), '') = '' then
      raise exception '학습자 출시 승인(승인자 · 시각 · 사유) 없이 적용을 켤 수 없다 — 채택은 출시 승인이 아니다(B7)';
    end if;
  end if;
  return new;
end $$;

-- 되돌리기:
-- create or replace function public.knowledge_applications_guard() ... (20261008120000 정의)
-- alter table public.knowledge_applications drop column release_approved_by, drop column release_approved_at, drop column release_note;
