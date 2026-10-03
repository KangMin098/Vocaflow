// scripts/csat/error-evidence/isolated-pg/stage1.mjs
// 1단계 — 부트스트랩 · PRE · 마이그레이션 적용 · POST. 다른 단계가 import 해서 쓴다.
import fs from 'node:fs'
import path from 'node:path'
import { MIGRATION, ROOT, VERIFY, conn, record } from './lib.mjs'

const splitVerify = (sql) => {
  // 「-- [PRE-n] / [POST-n]」 머리별로 쿼리를 나눈다
  const out = []
  let cur = null
  for (const line of sql.split(/\r?\n/)) {
    const m = line.match(/^-- \[(PRE|POST)-(\d+)\]\s*(.*)$/)
    if (m) { if (cur) out.push(cur); cur = { id: `${m[1]}-${m[2]}`, title: m[3], sql: '' }; continue }
    if (cur && !line.startsWith('--')) cur.sql += line + '\n'
  }
  if (cur) out.push(cur)
  return out.filter((q) => q.sql.trim())
}

export async function stage1() {
  const admin = conn('supabase_admin', 'admin')
  await admin.query(fs.readFileSync(path.join(ROOT, 'bootstrap.sql'), 'utf8'))
  const verify = splitVerify(fs.readFileSync(VERIFY, 'utf8'))
  const pre = {}
  for (const q of verify.filter((x) => x.id.startsWith('PRE'))) pre[q.id] = (await admin.query(q.sql)).rows
  record('적용', 'PRE-1 이름 충돌 없음', pre['PRE-1'].length === 0, pre['PRE-1'])
  record('적용', 'PRE-2 같은 이름 트리거 없음', pre['PRE-2'].length === 0)
  record('적용', 'PRE-3 의존 함수(is_admin · digest)', Number(pre['PRE-3'][0].is_admin) >= 1 && Number(pre['PRE-3'][0].digest) >= 1, pre['PRE-3'][0])

  // 기존 객체 스냅샷(적용 전후 비교용) — 이름 · 종류 · 정의 해시
  const snap = async () => (await admin.query(`
    select 'rel:' || c.relname || ':' || c.relkind::text as k, md5(coalesce((select string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod), ',' order by a.attnum) from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped), '')) as v
      from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'auth') and c.relname not like 'csat\\_ec\\_%'
    union all select 'fn:' || p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'auth') and p.proname not like 'csat\\_ec\\_%'
    union all select 'trg:' || tgrelid::regclass || ':' || tgname, md5(pg_get_triggerdef(oid)) from pg_trigger where not tgisinternal and tgname not like 'csat\\_ec\\_%'
    union all select 'pol:' || polrelid::regclass || ':' || polname, md5(coalesce(pg_get_expr(polqual, polrelid), '')) from pg_policy where polrelid::regclass::text not like 'csat\\_ec\\_%'
    order by 1`)).rows
  const before = await snap()

  // 마이그레이션 — 운영처럼 postgres(비 superuser · BYPASSRLS)로
  const owner = conn('postgres', 'postgres')
  const t0 = Date.now()
  let applied
  try {
    await owner.query(fs.readFileSync(MIGRATION, 'utf8'))
    applied = { ok: true }
  } catch (e) {
    applied = { ok: false, err: e.message, where: e.where, position: e.position }
  }
  record('적용', '마이그레이션 적용(postgres 역할)', applied.ok, applied.ok ? `${Date.now() - t0}ms` : applied)
  if (!applied.ok) return { admin, owner, verify, pre, ok: false }

  const after = await snap()
  const diff = []
  const bmap = new Map(before.map((x) => [x.k, x.v]))
  const amap = new Map(after.map((x) => [x.k, x.v]))
  for (const [k, v] of bmap) if (amap.get(k) !== v) diff.push(`변경/삭제 ${k}`)
  for (const k of amap.keys()) if (!bmap.has(k)) diff.push(`추가 ${k}`)
  const trg = (await admin.query("select tgname from pg_trigger where tgrelid = 'public.csat_dx_response'::regclass and not tgisinternal")).rows.map((r) => r.tgname)
  record('적용', '기존 객체 비의도 변경 없음(추가는 응답 삭제 트리거 1개뿐)', diff.length === 0 && trg.length === 1 && trg[0] === 'csat_ec_cancel_rounds_on_response_delete', { diff, responseTriggers: trg })

  const post = {}
  for (const q of verify.filter((x) => x.id.startsWith('POST'))) post[q.id] = (await admin.query(q.sql)).rows
  return { admin, owner, verify, pre, post, ok: true }
}
