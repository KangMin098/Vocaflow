-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/forward.sql
-- 대량작업 C · D: csat_items 원문 정정 4행(개발 DB jajenrevcbmrpaliomxv). 사용자 승인 전 실행 금지.
-- 근거: 공식 문제지 PDF(파일·sha256 은 README.md). 각 UPDATE 는 현재 값의 md5 가 같을 때만 바꾸고(compare-and-set),
-- 바뀐 행이 정확히 4가 아니면 전체를 되돌린다. 분석·강의·정답·body_ok·다른 열은 건드리지 않는다.
do $$
declare n int; total int := 0;
begin
  -- 1) 2014A#29 Hours 각주 복원: 「month.」 조각 → 공식 각주 문장
  update csat_items
     set passage = replace(passage, '5:00 p.m. month. Fees', '5:00 p.m. * The museum is closed on the first Monday of every month. Fees')
   where id = '2014A#29' and md5(passage) = '354dba3df716d6db04d6cc643afeec3e';
  get diagnostics n = row_count; total := total + n;

  -- 2) 2017#24 선지 ⑤ 끝 쪽번호 「 8」 제거
  update csat_items
     set choices = jsonb_set(choices, '{4}', to_jsonb(regexp_replace(choices->>4, '\s+8$', '')))
   where id = '2017#24' and md5(choices::text) = 'eadc859ef6f20687e6b413b72edcbff7';
  get diagnostics n = row_count; total := total + n;

  -- 3) 2018#24 선지 ⑤ 끝 쪽번호 「 8」 제거
  update csat_items
     set choices = jsonb_set(choices, '{4}', to_jsonb(regexp_replace(choices->>4, '\s+8$', '')))
   where id = '2018#24' and md5(choices::text) = '75afb175f723a2256c424c229f917406';
  get diagnostics n = row_count; total := total + n;

  -- 4) M2509#25 선지 ⑤ 끝에 붙은 낱말 풀이 「* augmented reality: 증강 현실」 제거(수능·모평 지문은 풀이를 저장하지 않는 관례)
  update csat_items
     set choices = jsonb_set(choices, '{4}', to_jsonb(regexp_replace(choices->>4, '\s+\*\s*augmented reality: 증강 현실$', '')))
   where id = 'M2509#25' and md5(choices::text) = 'b7dad550901a58eb02a126df22624888';
  get diagnostics n = row_count; total := total + n;

  if total <> 4 then
    raise exception 'csat_items 정정: 기대 4행, 실제 %행 — 현재 값이 승인 시점과 다르다. 아무것도 바꾸지 않는다', total;
  end if;
end $$;

-- 적용 뒤 확인(기대값):
-- select id, md5(passage), md5(choices::text) from csat_items where id in ('2014A#29','2017#24','2018#24','M2509#25') order by id;
--   2014A#29  passage 6b4dd8818f63a6c9086b06dd8833027a  choices 9b38a7ffcabc90a1eaeacd20551c163a
--   2017#24   passage 9e5dbc2e23a9271ad4503cd814eb6fe0  choices 964f24d99fd78f83d0c1665f207fc654
--   2018#24   passage fe35fdc6562f3dd405eedd93d4540920  choices f380f7ee5dfa8b569414d54a8b5182af
--   M2509#25  passage 1325adafc83b20648239bfae04aa9a3f  choices 764a83418a6b8862f08b594322f33960
