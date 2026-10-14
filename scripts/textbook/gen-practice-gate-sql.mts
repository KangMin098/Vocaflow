// scripts/textbook/gen-practice-gate-sql.mts
//
// v6.2 P-F6a — 연습 RPC 발행 결속 마이그레이션 **보류 파일**을 만든다(적용하지 않는다 — 승인안 A).
// 문항 표는 「어느 권 소속」을 저장하지 않고, 권(series × step) → V레벨 대응은 코드 `SERIES_CATALOG` 에만 있다.
// 그래서 DB 가 발행 결속을 강제하려면 그 대응을 DB 에 두고, 함수가 **호출자 V레벨을 받지 않고** (series, step) 에서 V레벨을 도출해야 한다.
// 이 스크립트가 대응 행을 카탈로그에서 생성한다(손으로 쓰지 않는다). 테스트(`practice-gate-sql.test.ts`)가 파일과 카탈로그의 일치를 지킨다.
//   cd apps/web && node <tsx cli> ../../scripts/textbook/gen-practice-gate-sql.mts
import fs from 'node:fs'
import path from 'node:path'

import { SERIES_CATALOG } from '../../packages/library-pipeline/src/textbook/series-catalog'

const ROOT = path.resolve(import.meta.dirname, '../..')
const rows = SERIES_CATALOG.flatMap((s) => s.rungs.flatMap((r) => r.vLevels.map((v) => `('${s.id}', ${r.step}, ${v})`)))

const sql = `-- supabase/migrations/_pending_textbook_practice_publish_gate.sql
-- ⚠️ 보류(적용 안 함) — v6.2 P-F6a 승인안 A(수정판). 생성: scripts/textbook/gen-practice-gate-sql.mts(손으로 고치지 않는다)
--
-- 왜: 연습 RPC textbook_practice_items(p_v_level) 는 V레벨 문항 풀을 돌려주고 권 발행과 무관하다.
--     이전 제안(textbook_practice_items_for(series, step, v_level))은 호출자가 V레벨을 따로 주므로 발행된 권 이름 + 다른 V레벨로 미발행 문항을 얻을 수 있었다(위조 가능 → 폐기).
-- 수정: ① 권 → V레벨 대응을 DB 에 둔다(카탈로그에서 생성) ② 새 함수는 (series, step) 만 받고 V레벨을 대응에서 도출 · 발행 권만
--       ③ 앱 호출을 옮긴 뒤 옛 함수의 authenticated 실행 권한을 회수(이 파일의 마지막 단계 — 앱 배포 뒤 별도 실행)
-- 영향: 지금 19권 모두 published 라 학습자 체감 0. 문항 · 응답 · 서가 기록 불변(읽기 함수만).
-- 되돌리기: drop function textbook_practice_items_for(text, smallint, integer); drop table textbook_rung_level; 옛 함수 grant 복원.
-- 검증: 발행 권 → 문항 · 미발행(가짜 상태 행) → 0 · 카탈로그에 없는 (series, step) → 0 · 옛 함수 직접 호출(회수 뒤) → permission denied.

create table if not exists public.textbook_rung_level (
  series text not null,
  step smallint not null,
  v_level smallint not null,
  primary key (series, step, v_level)
);
alter table public.textbook_rung_level enable row level security;
-- 읽기 정책 없음(학습자 직접 조회 불필요 — 아래 SECURITY DEFINER 함수만 읽는다)

insert into public.textbook_rung_level (series, step, v_level) values
${rows.join(',\n')}
on conflict do nothing;

create or replace function public.textbook_practice_items_for(p_series text, p_step smallint, p_limit integer default 10)
returns table(id uuid, type text, paragraph_idx integer, payload jsonb, ref_title text)
language sql stable security definer set search_path to 'public' as $$
  select i.id, i.type, i.paragraph_idx, i.payload, a.title
  from csat_dcp_items i
  join library_articles a on a.id = i.ref_id
  where i.kind = 'article'
    and i.type in ('order','insert','topic','blank','main_point','title','summary','purpose','implication','content_match','claim','mood',
                   'long_order','long_reference','long_match','long_title','long_vocab')
    -- 발행 결속: 그 권이 발행됐을 때만, 그 권의 V레벨만(호출자 V레벨을 받지 않는다)
    and exists (select 1 from textbook_volume_renders r where r.series = p_series and r.band = p_step and r.status = 'published')
    and i.v_level in (select l.v_level from textbook_rung_level l where l.series = p_series and l.step = p_step)
    and a.status in ('ready','published')
    and a.display_only = false
    and public.csat_source_is_eligible(a.id)
    and not exists (select 1 from csat_item_attempts t where t.dcp_item_id = i.id and t.user_id = auth.uid())
  order by i.id
  limit greatest(1, least(p_limit, 50));
$$;
revoke all on function public.textbook_practice_items_for(text, smallint, integer) from public, anon;
grant execute on function public.textbook_practice_items_for(text, smallint, integer) to authenticated;

-- ── 앱이 새 함수로 옮겨 배포된 뒤 별도로 실행(사용처 0 확인 후) ──────────────────
-- revoke execute on function public.textbook_practice_items(smallint, integer) from authenticated;
`
const out = path.join(ROOT, 'supabase/migrations/_pending_textbook_practice_publish_gate.sql')
fs.writeFileSync(out, sql)
console.log(`rows ${rows.length} → ${path.relative(ROOT, out)}`)
