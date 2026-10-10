#!/usr/bin/env node
// scripts/csat/map/v4/plan-db-smoke.mjs
//
// 학습계획 저장 — **실제 개발 DB** smoke(PGlite 하네스와 별도). 임시 계정 2개(map-v4-e2e-dbsmoke-*@example.com)만 만들고 끝에 지운다.
//   service_role RPC: 목표 멱등 · 실제 병렬 목표 요청 · 첫 확정 병렬 경합 · 같은 키 병렬 재전송 · 낡은 버전 충돌 · 검증 거절
//   학습자 세션(anon 키 + 비밀번호 로그인): 자기 행만 · 직접 INSERT/UPDATE 거절 · RPC 실행 거절 · 다른 학습자 행 0
//   node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/csat/map/v4/plan-db-smoke.mjs
import crypto from 'node:crypto'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { cleanupLeftovers } from '../e2e-cleanup.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const { createClient } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@supabase/supabase-js')
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!String(URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const svc = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
let fail = 0
const rec = (name, ok, d = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${d === '' ? '' : ' — ' + JSON.stringify(d).slice(0, 220)}`) }
const users = []
const mk = async (tag) => {
  const email = `map-v4-e2e-dbsmoke-${tag}-${Date.now()}@example.com`
  const password = `Db-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(data.user.id)
  const cli = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const s = await cli.auth.signInWithPassword({ email, password })
  if (s.error) throw s.error
  return { id: data.user.id, cli }
}
const TPL = ['r.central_meaning', 'r.discourse_function', 'r.discourse_structure']
const plan = (planned = 5) => ({ order: TPL, tasks: TPL.map((t, i) => ({ task: t, stage: i ? null : 'check', planned: i ? null : planned, available: i ? null : 9, rule: i ? null : 'unseen_check_items' })) })
const commit = (user, o = {}) => svc.rpc('learner_workspace_plan_commit', {
  p_user: user, p_template: 'ws.central-meaning', p_template_tasks: TPL, p_canon: 'rev4.0-draft-1', p_plan: o.plan ?? plan(),
  p_reason: o.reason ?? 'initial', p_note: null, p_as_of: new Date().toISOString(), p_goal_version: o.goal ?? null,
  p_expected_version: o.expected ?? 0, p_client_key: o.key ?? crypto.randomUUID(), p_restore_of: null,
})
try {
  const A = await mk('a')
  const B = await mk('b')

  // 목표
  const gk = crypto.randomUUID()
  const g1 = await svc.rpc('csat_map_goal_set', { p_user: A.id, p_score: 80, p_grade: null, p_exam: null, p_date: null, p_client_key: gk })
  const g2 = await svc.rpc('csat_map_goal_set', { p_user: A.id, p_score: 80, p_grade: null, p_exam: null, p_date: null, p_client_key: gk })
  rec('목표 멱등 — 같은 키 같은 이력', !g1.error && g1.data === g2.data, { g1: g1.data, g2: g2.data })
  const par = await Promise.all([60, 70, 90].map((s) => svc.rpc('csat_map_goal_set', { p_user: A.id, p_score: s, p_grade: null, p_exam: null, p_date: null, p_client_key: crypto.randomUUID() })))
  const lastV = (await svc.from('csat_map_goal_version').select('target_score').eq('user_id', A.id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1)).data?.[0]?.target_score
  const cur = (await svc.from('csat_map_goal').select('target_score').eq('user_id', A.id).single()).data?.target_score
  rec('병렬 목표 3건 — 모두 성공 · 최신 값 = 마지막 이력', par.every((r) => !r.error) && lastV === cur, { lastV, cur })

  // 첫 확정 병렬 경합(서로 다른 키) — 하나만 버전 1, 나머지는 충돌
  const race = await Promise.all([1, 2, 3].map(() => commit(A.id, { goal: g1.data })))
  const ok = race.filter((r) => !r.error)
  rec('첫 확정 병렬 3건 — 1건 버전 1 · 2건 충돌(덮어쓰기 없음)', ok.length === 1 && ok[0].data?.[0]?.plan_version === 1 && race.filter((r) => /plan_version_conflict/.test(r.error?.message ?? '')).length === 2, race.map((r) => r.error?.message ?? r.data?.[0]?.plan_version))
  // 같은 키 병렬 재전송 — 둘 다 같은 버전(하나는 reused)
  const k = crypto.randomUUID()
  const same = await Promise.all([commit(A.id, { key: k, reason: 'learner_adjust', expected: 1, plan: plan(4) }), commit(A.id, { key: k, reason: 'learner_adjust', expected: 1, plan: plan(4) })])
  rec('같은 키 병렬 재전송 — 둘 다 버전 2 · 하나는 재사용', same.every((r) => !r.error && r.data?.[0]?.plan_version === 2) && same.some((r) => r.data?.[0]?.reused === true), same.map((r) => r.error?.message ?? r.data?.[0]))
  rec('낡은 버전 수정 → 충돌', /plan_version_conflict/.test((await commit(A.id, { reason: 'learner_adjust', expected: 1 })).error?.message ?? ''))
  rec('계획량 > 가용량 거절', /plan_invalid/.test((await commit(A.id, { reason: 'learner_adjust', expected: 2, plan: plan(10) })).error?.message ?? ''))
  rec('남의 목표 버전 거절', /goal_mismatch/.test((await commit(B.id, { goal: g1.data })).error?.message ?? ''))
  await commit(B.id)

  // 학습자 세션
  const mine = await A.cli.from('learner_workspace_plan').select('user_id')
  rec('학습자 A — 자기 계획만(2버전)', !mine.error && mine.data.length === 2 && mine.data.every((r) => r.user_id === A.id), mine.error?.message ?? mine.data.length)
  const other = await A.cli.from('learner_workspace_plan').select('id').eq('user_id', B.id)
  rec('학습자 A — B 의 계획 0행', !other.error && other.data.length === 0)
  const ins = await A.cli.from('learner_workspace_plan').insert({ workspace_id: crypto.randomUUID(), user_id: A.id, plan_version: 9, plan: { order: [], tasks: [] }, reason: 'initial', as_of: new Date().toISOString(), canon_version: 'x', client_key: crypto.randomUUID() })
  rec('학습자 직접 INSERT 거절', !!ins.error, ins.error?.code)
  const upd = await A.cli.from('csat_map_goal_version').update({ target_score: 1 }).eq('user_id', A.id).select()
  rec('학습자 목표 이력 UPDATE — 바뀐 행 0(권한 없음)', !!upd.error || (upd.data ?? []).length === 0, upd.error?.code ?? upd.data?.length)
  const rpc = await A.cli.rpc('learner_workspace_plan_commit', { p_user: A.id, p_template: 'ws.central-meaning', p_template_tasks: TPL, p_canon: 'x', p_plan: plan(), p_reason: 'learner_adjust', p_note: null, p_as_of: new Date().toISOString(), p_goal_version: null, p_expected_version: 2, p_client_key: crypto.randomUUID(), p_restore_of: null })
  rec('학습자 RPC 직접 호출 거절', !!rpc.error, rpc.error?.code)
  const svcUpd = await svc.from('learner_workspace_plan').update({ note: 'x' }).eq('user_id', A.id).select()
  rec('service_role 도 계획 이력 UPDATE 불가', !!svcUpd.error, svcUpd.error?.code)
} finally {
  for (const id of users) await svc.auth.admin.deleteUser(id).catch((e) => console.log('삭제 실패', e.message))
  const left = (await svc.from('learner_workspace_plan').select('id', { count: 'exact', head: true }).in('user_id', users)).count
  const leftG = (await svc.from('csat_map_goal_version').select('id', { count: 'exact', head: true }).in('user_id', users)).count
  rec('정리 — 임시 계정 삭제 → 계획 · 목표 이력 cascade 0', left === 0 && leftG === 0, { left, leftG })
  const sweep = await cleanupLeftovers(svc, { dry: true, minAgeMs: 0, log: () => {} })
  rec('정리 — 남은 E2E 계정 0', sweep.users === 0, sweep)
}
console.log(fail ? `FAIL ${fail}` : 'ALL PASS')
process.exit(fail ? 1 : 0)
