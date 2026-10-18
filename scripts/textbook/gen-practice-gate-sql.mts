// scripts/textbook/gen-practice-gate-sql.mts
//
// v6.2 P-F7a — 연습 RPC 발행 결속 마이그레이션 **보류 파일**을 만든다(적용하지 않는다 — 승인안 A 2판).
// 문항 표는 「어느 권 소속」을 저장하지 않고, 권(series × step) → V레벨 · 유형 대응은 코드 `SERIES_CATALOG` 에만 있다.
// 그래서 DB 가 발행 결속을 강제하려면 그 대응을 DB 에 두고, 함수가 **호출자 V레벨을 받지 않고** (series, step) 에서 도출해야 한다.
// 이 스크립트가 대응 행을 카탈로그에서 생성한다(손으로 쓰지 않는다). 테스트(`practice-gate-sql.test.ts`)가 파일과 카탈로그의 일치를 지킨다.
//   pnpm --filter web exec tsx ../../scripts/textbook/gen-practice-gate-sql.mts
import fs from 'node:fs'
import path from 'node:path'

import { SERIES_CATALOG } from '../../packages/library-pipeline/src/textbook/series-catalog'

const ROOT = path.resolve(import.meta.dirname, '../..')

/** 화면 연습이 재생 · 채점할 수 있는 유형 — `grade_dcp_item` 이 채점하는 기사 유형과 같다 */
export const PLAYABLE = ['order', 'insert', 'topic', 'blank', 'main_point', 'title', 'summary', 'purpose', 'implication', 'content_match', 'claim', 'mood',
  'long_order', 'long_reference', 'long_match', 'long_title', 'long_vocab'] as const

const levels = SERIES_CATALOG.flatMap((s) => s.rungs.flatMap((r) => r.vLevels.map((v) => `('${s.id}', ${r.step}, ${v})`)))
const types = SERIES_CATALOG.flatMap((s) => s.rungs.flatMap((r) => r.types.map((t) => `('${s.id}', ${r.step}, '${t}')`)))

const sql = `-- supabase/migrations/_pending_textbook_practice_publish_gate.sql
-- ⚠️ 보류(적용 안 함) — v6.2 P-F7a 승인안 A 2판. 생성: scripts/textbook/gen-practice-gate-sql.mts(손으로 고치지 않는다)
--
-- 왜: 연습 RPC textbook_practice_items(p_v_level) 는 V레벨 문항 풀을 돌려주고 권 발행 · 권 유형과 무관하다.
--     ① 미발행 권의 V레벨도 받는다(지금은 19권 전부 발행이라 노출 0)
--     ② 어휘 · 구문 12권과 독해 1단은 자기 유형이 연습 재생 유형에 하나도 없는데, 연습 화면은 **독해 문항**을 내고 있었다(실측 2026-10-14)
-- 이전 제안 textbook_practice_items_for(series, step, v_level) 는 호출자 V레벨을 받아 위조 가능 → 폐기.
-- 수정: 권 → V레벨 · 유형 대응을 DB 에 두고(카탈로그 생성), 새 함수는 (series, step) 만 받는다.
--       로그인 · 대응 존재 · 발행 · V레벨 · 권 유형 ∩ 재생 유형 — 하나라도 없으면 0행(fail-closed).
-- 영향(실측 풀, 출처 적격성 전): 독해 2단 830→300 · 3단 867→536 · 4단 1,618→914 · 5단 11,089→11,025 · 6·7단 동일 ·
--       어휘 · 구문 12권 → 0(화면은 「아직 화면 연습이 없어요」). 문항 · 응답 · 서가 기록 불변(읽기 함수만).
-- 순서: ① 이 파일(표 · 새 함수) ② 앱 배포(새 함수 우선 · 함수 없을 때만 옛 함수) ③ 사용처 0 확인 뒤 맨 아래 회수문 실행.
-- 되돌리기: drop function public.textbook_practice_items_for(text, smallint, integer);
--           drop table public.textbook_rung_type; drop table public.textbook_rung_level;
--           (③ 실행했다면) grant execute on function public.textbook_practice_items(smallint, integer) to authenticated;
-- 검증: tests/sql/practice-gate-fixture.sql(트랜잭션 · rollback) · DB 대응 = 카탈로그(통합 테스트).

create table if not exists public.textbook_rung_level (
  series text not null,
  step smallint not null,
  v_level smallint not null,
  primary key (series, step, v_level)
);
create table if not exists public.textbook_rung_type (
  series text not null,
  step smallint not null,
  type text not null,
  primary key (series, step, type)
);
alter table public.textbook_rung_level enable row level security;
alter table public.textbook_rung_type enable row level security;
-- 읽기 정책 없음 — 아래 SECURITY DEFINER 함수와 관리자(서비스 키)만 읽는다
revoke all on public.textbook_rung_level, public.textbook_rung_type from anon, authenticated;

insert into public.textbook_rung_level (series, step, v_level) values
${levels.join(',\n')}
on conflict do nothing;

insert into public.textbook_rung_type (series, step, type) values
${types.join(',\n')}
on conflict do nothing;

create or replace function public.textbook_practice_items_for(p_series text, p_step smallint, p_limit integer default 10)
returns table(id uuid, type text, paragraph_idx integer, payload jsonb, ref_title text)
language sql stable security definer set search_path to 'public' as $$
  select i.id, i.type, i.paragraph_idx, i.payload, a.title
  from csat_dcp_items i
  join library_articles a on a.id = i.ref_id
  where auth.uid() is not null
    and i.kind = 'article'
    -- 재생 · 채점 가능한 유형 ∩ 그 권의 유형
    and i.type in (${PLAYABLE.map((t) => `'${t}'`).join(',')})
    and i.type in (select t.type from textbook_rung_type t where t.series = p_series and t.step = p_step)
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

-- ── ③ 앱이 새 함수로 옮겨 배포된 뒤 별도로 실행(사용처 0 확인 후) ──────────────────
-- revoke execute on function public.textbook_practice_items(smallint, integer) from authenticated;
`
const out = path.join(ROOT, 'supabase/migrations/_pending_textbook_practice_publish_gate.sql')
fs.writeFileSync(out, sql)
console.log(`levels ${levels.length} · types ${types.length} → ${path.relative(ROOT, out)}`)
