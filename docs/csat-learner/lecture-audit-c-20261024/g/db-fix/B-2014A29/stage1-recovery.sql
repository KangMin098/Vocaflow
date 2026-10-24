-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/B-2014A29/stage1-recovery.sql (make-stages.mjs 생성)
-- 단계 1 되돌리기: 지문을 정정 전 값으로(compare-and-set) + 이 실행이 만든 v6 초안 1행 삭제(검수 행이 없을 때만).
-- 행 삭제가 들어 있으므로 데이터 삭제 승인 대상이다 — 단계 1 승인과 함께 명시 승인받는다.
do $$
declare n int;
begin
  update public.csat_items set passage = replace(passage, $q$5:00 p.m. * The museum is closed on the first Monday of every month. Fees$q$, $q$5:00 p.m. month. Fees$q$)
   where id = '2014A#29' and position($q$5:00 p.m. * The museum is closed on the first Monday of every month. Fees$q$ in passage) > 0;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '2014A#29 지문이 단계 1 결과와 다르다'; end if;
  if (select md5(passage) from public.csat_items where id = '2014A#29') <> '354dba3df716d6db04d6cc643afeec3e' then raise exception '되돌린 지문 md5 가 정정 전 값과 다르다'; end if;
  if exists (select 1 from public.csat_analysis_reviews r join public.csat_item_analyses x on x.id = r.analysis_id
              where x.item_id = '2014A#29' and x.version = 6) then raise exception 'v6 에 검수 기록이 있다 — 단계 2 이후는 이 스크립트로 되돌리지 않는다'; end if;
  delete from public.csat_item_analyses where item_id = '2014A#29' and version = 6 and status = 'draft' and analyst_run = 'lecture-audit-c-2014A29-footnote';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'v6 초안이 1행이 아니다(%)', n; end if;
end $$;
