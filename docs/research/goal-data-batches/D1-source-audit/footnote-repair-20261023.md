# 각주 줄 소실 복구 — 승인 패키지 (2026-10-23 · 미적용)

> **사용자 승인 전 실행 금지.** 데이터 쓰기 2행. 삭제 · DROP 없음.

## 무엇이 잘못됐나

지문 조립 파서가 시험지 추출 텍스트에서 `*` 로 시작하는 각주 줄을 버렸다. 두 문항에서 그 각주가 정답 근거다.

| 문항 | 원문 줄(추출 텍스트) | DB 지문 현재 | 영향 |
|---|---|---|---|
| 2014A#29 (안내문 일치) | `Vocaflow/scripts/csat/data/columns/2014A.txt:342–344` 「* The museum is closed on the first Monday of every / month.」 | 「… 5:00 p.m. month. Fees …」 — 첫 줄 소실, 「month.」 만 남음 | 오답 ③(휴관) 근거 일부 결손 |
| M1809#26 (안내문 불일치 · 정답 ③ 「현금을 기부받는다」) | `Vocaflow/scripts/csat/data/columns2/M1809.txt:299` 「* No cash donations will be accepted.」 | 「… small electronics How to donate: …」 — 줄 통째 소실 | **정답 근거 전체 결손** — 지문만으로 정답을 고를 수 없음 |

범위 실측(platform-goal · 읽기 전용): columns(206) · columns2(507) 의 `* ` 줄 중 어휘 풀이(콜론+한글)를 빼고 대문자로 시작하는 5단어 이상 영어 문장 = 2줄 — 위 두 건뿐. `body_ok` 는 둘 다 true 였다(현재 점검이 줄 소실을 못 잡음).

## 적용 SQL (한 트랜잭션 · 행마다 md5 가드 · 백업 먼저)

```sql
begin;

-- 백업(되돌리기용)
create table if not exists public.csat_items_footnote_fix_20261023_bk as
  select id, passage, md5(passage) as md5_before, now() as backed_up_at
  from public.csat_items where id in ('2014A#29', 'M1809#26');

-- 2014A#29 : 「5:00 p.m. month.」 → 각주 문장 복원
update public.csat_items
   set passage = replace(passage, '5:00 p.m. month.', '5:00 p.m. * The museum is closed on the first Monday of every month.')
 where id = '2014A#29'
   and md5(passage) = '354dba3df716d6db04d6cc643afeec3e'
   and position('5:00 p.m. month.' in passage) > 0;

-- M1809#26 : 「small electronics How to donate」 사이에 각주 문장 복원
update public.csat_items
   set passage = replace(passage, 'small electronics How to donate', 'small electronics * No cash donations will be accepted. How to donate')
 where id = 'M1809#26'
   and md5(passage) = '22e3bb81089a8be369e6da1e0627fb7a'
   and position('small electronics How to donate' in passage) > 0;

-- 확인: 두 행 모두 바뀌었는지(아니면 rollback)
select id, md5(passage) as md5_after,
       passage like '%closed on the first Monday of every month%' or passage like '%No cash donations will be accepted%' as restored
  from public.csat_items where id in ('2014A#29', 'M1809#26');

commit;  -- restored 가 둘 다 true 일 때만. 아니면 rollback;
```

## 되돌리기

```sql
update public.csat_items c set passage = b.passage
  from public.csat_items_footnote_fix_20261023_bk b
 where c.id = b.id;
```

## 적용 뒤 할 일

1. 두 문항의 `csat_item_analyses`(v1–v5 published)는 바뀌기 전 지문으로 만들어졌다 — 본문 해시에 묶인 판정이 있으면 재검토 대상.
2. 연구 데이터: 두 문항을 A/B 두 트랙으로 재판정 → `d3-build.mjs` 의 `SOURCE_GAP_ITEMS` 에서 뺀다.
3. 근본 수정: 파서가 영어 문장 각주(`* ` + 대문자 시작 문장)를 보존하게 고친 뒤 전체 재추출 대조.
