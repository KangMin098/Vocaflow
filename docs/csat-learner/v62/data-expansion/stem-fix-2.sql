-- 2차 발문 수정(stem-fix-proposal-2.json · restore_suffix 10 + drop_tail 1) — 사용자 승인 전 실행 금지
-- 바꾸는 것: csat_items.stem 11행만. 지문·선지·정답·유형 불변. 현재 md5(stem)=old_md5 인 행만 · 11행 아니면 전체 롤백.
-- 되돌리기: update csat_items i set stem=b.stem from csat_items_stem_fix_20261023b_bk b where i.id=b.id;
do $$
declare n int;
begin
  create table if not exists public.csat_items_stem_fix_20261023b_bk as
    select id, stem, now() as backed_up_at from public.csat_items where id in ('2015#24','2018#29','2019#30','2021#26','2021#30','2022#30','2024#27','M2406#42','M2506#36','M2506#37','M2506#25');
  alter table public.csat_items_stem_fix_20261023b_bk enable row level security;
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
end $$;
