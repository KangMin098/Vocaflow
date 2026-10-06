// G1 마이그레이션 생성 — live 정의에 본인 검사 한 덩어리만 넣는다(나머지 본문은 바이트 그대로).
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg/package.json')
const pg = require('pg')
const OUT = 'D:/workspace/Vocaflow-ec-smoke/supabase/migrations/20261006090000_auto_promote_self_only.sql'
const RB = 'D:/workspace/Vocaflow-ec-smoke/scripts/db/rollback-20261006090000.sql'
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
const { rows: [r] } = await c.query(`select pg_get_functiondef(p.oid) def, p.proacl::text acl from pg_proc p where p.oid = 'public.auto_promote_v_level_for_user(uuid)'::regprocedure`)
await c.end()
const def = r.def.replace(/\r\n/g, '\n')
const anchor = '\nBEGIN\n'
if (def.split(anchor).length !== 2) throw new Error('BEGIN 앵커가 하나가 아니다')
const guard = `
BEGIN
  -- 본인만 · 2026-10-06 P0. 로그인/비로그인 요청(JWT role = anon · authenticated)은 자기 user_id 로만 부른다.
  -- JWT 가 없는 호출(cron_auto_promote_all_users — 소유자 권한)과 service_role 은 그대로 통과한다.
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'auto_promote_v_level_for_user: 본인 user_id 로만 호출할 수 있다' USING ERRCODE = '42501';
  END IF;
`
const newDef = def.replace(anchor, guard)
const sql = `-- supabase/migrations/20261006090000_auto_promote_self_only.sql
--
-- G1 · P0 핫픽스 — auto_promote_v_level_for_user 를 본인 전용(AUTH_SELF_RPC)으로.
-- 근거: docs/reports/function-execute-decisions-2026-10-06.md · 감사 docs/reports/function-execute-audit-2026-10-05.md
--
-- 문제(2026-10-06 실측): SECURITY DEFINER · 본문에 auth.uid() 검사 없음 · anon 직접 GRANT(2026-09-06 이전 기본 ACL 잔재).
--   비로그인 누구나 아무 user_id 로 불러 그 사용자의 현재 레벨 · i+1 숙달 수를 읽고, 조건을 채운 사용자면 승급을 일으킨다
--   (승급 자체는 실제 숙달 기준을 통과해야 일어난다 — 임의 레벨 지정은 아니다).
-- 호출자: 앱 VLevelPromotionCheck.tsx(브라우저 · 자기 user.id) · cron_auto_promote_all_users(cron · 소유자 권한).
-- 변경: ① 본문 맨 앞 본인 검사(나머지 본문은 live 정의 그대로) ② PUBLIC · anon EXECUTE 회수, authenticated · service_role 명시.
-- 되돌리기: scripts/db/rollback-20261006090000.sql (이전 정의 + 이전 ACL ${r.acl})

${newDef.trim()};

revoke execute on function public.auto_promote_v_level_for_user(uuid) from public, anon;
grant execute on function public.auto_promote_v_level_for_user(uuid) to authenticated, service_role;
`
fs.writeFileSync(OUT, sql)
// 롤백: 이전 정의 + 이전 ACL 정확 복원
const grants = []
for (const m of r.acl.replace(/[{}]/g, '').split(',')) {
  const [who, rest] = m.split('=')
  if (!rest || !rest.includes('X')) continue
  grants.push(who === '' ? 'public' : who)
}
fs.writeFileSync(RB, `-- 20261006090000 되돌리기 — 이전 live 정의(2026-10-06 추출)와 이전 ACL(${r.acl})\nbegin;\n${def.trim()};\nrevoke execute on function public.auto_promote_v_level_for_user(uuid) from public, anon, authenticated, service_role;\ngrant execute on function public.auto_promote_v_level_for_user(uuid) to ${grants.filter(g => g !== 'postgres').join(', ')};\ncommit;\n`)
console.log('ok', r.acl, grants)
