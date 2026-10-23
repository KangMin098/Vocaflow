-- docs/csat-learner/v62/data-expansion/stem-fix-2.sql
-- 2차 발문 수정(stem-fix-proposal-2.json · restore_suffix 10 + drop_tail 1) — 사용자 승인 전 실행 금지
-- r2: Codex T-0106 P1 반영 — ① 백업 테이블이 이미 있으면 실패(옛 백업 재사용 금지) · 백업 11행 확인 ② 되돌리기는 현재 값이 이번 새 발문일 때만
-- 바꾸는 것: csat_items.stem 11행만. 현재 md5(stem)=old_md5 인 행만 · 11행 아니면 전체 롤백 · 지문·선지·정답·유형 지문(fingerprint) 불변 확인.
do $$
declare n int; fp_before text; fp_after text;
begin
  if to_regclass('public.csat_items_stem_fix_20261023b_bk') is not null then
    raise exception 'backup table already exists — refusing to reuse a stale backup';
  end if;
  create table public.csat_items_stem_fix_20261023b_bk as
    select id, stem, now() as backed_up_at from public.csat_items
    where id in ('2015#24','2018#29','2019#30','2021#26','2021#30','2022#30','2024#27','M2406#42','M2506#36','M2506#37','M2506#25');
  alter table public.csat_items_stem_fix_20261023b_bk enable row level security;
  select count(*) into n from public.csat_items_stem_fix_20261023b_bk;
  if n <> 11 then raise exception 'backup has % rows, expected 11', n; end if;

  select md5(string_agg(md5(coalesce(passage,'')||coalesce(choices::text,'')||coalesce(answer::text,'')||coalesce(answers::text,'')||coalesce(type_id,'')), '' order by id))
    into fp_before from public.csat_items where id in (select id from public.csat_items_stem_fix_20261023b_bk);

  with fix(id, old_md5, new_stem) as (values
    ('2015#24', '06a4386d3e9ec3190664f92776065e73', 'Georg Dionysius Ehret에 관한 다음 글의 내용과 일치하지 않는 것은?'),
    ('2018#29', '305881c804b0ce8597e6b96166795c4b', '다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?'),
    ('2019#30', '305881c804b0ce8597e6b96166795c4b', '다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?'),
    ('2021#26', '4761a92212d1ac3866633fa7eaf79ef5', 'Frank Hyneman Knight에 관한 다음 글의 내용과 일치하지 않는 것은?'),
    ('2021#30', '305881c804b0ce8597e6b96166795c4b', '다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?'),
    ('2022#30', '305881c804b0ce8597e6b96166795c4b', '다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?'),
    ('2024#27', '37e1e3e1efc20c9f39443a8b546eb560', 'Turtle Island Boat Tour에 관한 다음 안내문의 내용과 일치하지 않는 것은?'),
    ('M2406#42', 'f9ef8475d220d42125fcc5262ee4185e', '밑줄 친 (a)～(e) 중에서 문맥상 낱말의 쓰임이 적절하지 않은 것은?'),
    ('M2506#36', '91f89e42cf796396580a0a7c2dc4c737', '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?'),
    ('M2506#37', '91f89e42cf796396580a0a7c2dc4c737', '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?'),
    ('M2506#25', '01eff7155356a3769384f31458529f36', '다음 도표의 내용과 일치하지 않는 것은?')),
  upd as (
    update public.csat_items i set stem = f.new_stem
    from fix f where i.id = f.id and md5(i.stem) = f.old_md5 and i.stem is distinct from f.new_stem
    returning i.id)
  select count(*) into n from upd;
  if n <> 11 then raise exception 'updated % rows, expected 11 — rolled back', n; end if;

  select md5(string_agg(md5(coalesce(passage,'')||coalesce(choices::text,'')||coalesce(answer::text,'')||coalesce(answers::text,'')||coalesce(type_id,'')), '' order by id))
    into fp_after from public.csat_items where id in (select id from public.csat_items_stem_fix_20261023b_bk);
  if fp_after is distinct from fp_before then raise exception 'passage/choices/answer/type changed — rolled back'; end if;
end $$;

-- 되돌리기(필요할 때만 · 현재 값이 이번 새 발문인 행만):
-- update public.csat_items i set stem = b.stem
--   from public.csat_items_stem_fix_20261023b_bk b
--  where i.id = b.id and md5(i.stem) in ('08fb34e73f508bf8a95a40958808d85a','1b07d9ee60024fc76b78d70fde1429cd','33be9e562eb79cacd473a3b07fff4ffc','7bb96d353693a325b2ea9a57d0f8ed9f','bbf6fee3cfff0979f12a01d922580944','f57383df8452ba43f816af796995ec97','fac8ad22a46c51ac2c82c9b5b26fc9ba');
--  (위 md5 7개 = 이번 새 발문 7종의 md5 — 그 사이 다른 값으로 바뀐 행은 되돌리지 않는다)
