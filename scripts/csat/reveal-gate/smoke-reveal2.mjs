// scripts/csat/reveal-gate/smoke-reveal2.mjs
//
// Reveal Gate ②(20261005170100) 적용 뒤 학습자 직접 조회 스모크 — 실제 PostgREST · 임시 학습자 JWT.
// 회수한 컬럼 · 표는 42501, 남긴 컬럼은 정상(행이 0이어도 권한 오류는 그대로 드러난다 — 데이터를 만들지 않는다).
// 임시 계정은 finally 에서 지운다. 자격 증명은 출력하지 않는다.
// 실행: node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/csat/reveal-gate/smoke-reveal2.mjs
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
const { createClient } = createRequire(path.resolve('scripts/csat/error-evidence/dev-smoke/package.json'))('@supabase/supabase-js')
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const opt = { auth: { persistSession: false } }
const svc = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, opt)
const out = []
const rec = (name, pass, detail = '') => { out.push({ name, pass: !!pass, detail }); console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + String(detail).slice(0, 140) : ''}`) }
const denied = (r) => r.error?.code === '42501'
const ok = (r) => !r.error

let uid = null
try {
  const email = `rg2-smoke-${randomUUID().slice(0, 8)}@example.com`, password = randomUUID()
  const cu = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { test: 'reveal gate 2 smoke' } })
  if (cu.error) throw cu.error
  uid = cu.data.user.id
  const me = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opt)
  const si = await me.auth.signInWithPassword({ email, password })
  if (si.error) throw si.error

  // ②b(20261006110000): anon 은 네 표 어디에도 표 권한이 없다 — 읽기 · 쓰기 모두 42501
  const anon = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opt)
  for (const t of ['csat_dx_session', 'csat_dx_response', 'csat_dx_snapshot', 'csat_learner_state']) {
    rec(`anon · ${t} 읽기 거부`, denied(await anon.from(t).select('*').limit(1)))
  }
  rec('anon · csat_learner_state 쓰기 거부', denied(await anon.from('csat_learner_state').insert({ user_id: uid, record: {} })))
  // ②b: 학습자 직접 쓰기(INSERT · UPDATE · DELETE) 권한 없음 — 앱은 service 경로로만 쓴다
  rec('학습자 · dx_session 직접 INSERT 거부', denied(await me.from('csat_dx_session').insert({ user_id: uid, mode: 'live' })))
  rec('학습자 · dx_response 직접 UPDATE 거부', denied(await me.from('csat_dx_response').update({ chosen_option: 1 }).eq('item_no', -1)))
  rec('학습자 · dx_snapshot 직접 DELETE 거부', denied(await me.from('csat_dx_snapshot').delete().eq('user_id', uid)))

  rec('dx_session.raw_score 거부', denied(await me.from('csat_dx_session').select('raw_score').limit(1)))
  rec('dx_session.grade 거부', denied(await me.from('csat_dx_session').select('grade').limit(1)))
  rec('dx_session select * 거부', denied(await me.from('csat_dx_session').select('*').limit(1)))
  rec('dx_session 남긴 컬럼 허용', ok(await me.from('csat_dx_session').select('id, user_id, exam_id, mode, taken_at, total_minutes, entered_by, client_key, created_at').limit(1)))
  rec('dx_response.is_correct 거부', denied(await me.from('csat_dx_response').select('is_correct').limit(1)))
  rec('dx_response select * 거부', denied(await me.from('csat_dx_response').select('*').limit(1)))
  rec('dx_response 남긴 컬럼 허용', ok(await me.from('csat_dx_response').select('session_id, item_no, item_id, chosen_option, confidence').limit(1)))
  rec('dx_snapshot 직접 읽기 거부', denied(await me.from('csat_dx_snapshot').select('id').limit(1)))
  rec('learner_state 직접 읽기 거부', denied(await me.from('csat_learner_state').select('user_id').limit(1)))
  rec('learner_state 직접 쓰기 거부', denied(await me.from('csat_learner_state').upsert({ user_id: uid, record: {} })))
  // 필터로 우회: 회수한 컬럼을 WHERE 에 쓰면 정오 · 점수가 새는 오라클이 된다 — 그것도 거부돼야 한다
  rec('dx_response WHERE is_correct 필터 거부(오라클)', denied(await me.from('csat_dx_response').select('item_no').eq('is_correct', false).limit(1)))
  rec('dx_session WHERE raw_score 필터 거부(오라클)', denied(await me.from('csat_dx_session').select('id').gte('raw_score', 0).limit(1)))
  rec('dx_session ORDER BY grade 거부(오라클)', denied(await me.from('csat_dx_session').select('id').order('grade').limit(1)))
} catch (e) {
  rec('스모크 실행', false, e.message)
} finally {
  if (uid) { const d = await svc.auth.admin.deleteUser(uid); rec('임시 계정 정리', !d.error, d.error?.message ?? '') }
  const fail = out.filter((r) => !r.pass).length
  fs.writeFileSync('scripts/csat/reveal-gate/results-reveal2.json', JSON.stringify({ ranAt: new Date().toISOString(), pass: out.length - fail, fail, out }, null, 1))
  console.log(`\n합계 PASS ${out.length - fail} · FAIL ${fail}`)
  process.exitCode = fail ? 1 : 0
}
