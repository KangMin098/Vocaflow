#!/usr/bin/env node
// scripts/csat/map/e2e-cleanup.mjs
//
// 학습 지도 E2E 가 중단돼 남긴 임시 자료 정리(2026-10-11 · rev4.0 3차) — **E2E 가 만든 것만** 지운다.
//   계정: 지도 E2E 전용 접두(map-state- · map-goal-e2e- · map-v4-e2e- · map-v4-perf-)의 @example.com 계정(기록은 cascade)
//   시험: TEST fixture M2097 · M2098 — 라벨이 「TEST 」로 시작할 때만(M2099 Reveal Gate canary 는 다른 작업 소유라 건드리지 않는다)
// 다른 세션이 만든 계정(예: map-rec-*)과 TEST 라벨이 아닌 시험은 지우지 않는다. 개발 프로젝트가 아니면 멈춘다.
//   node --env-file=<apps/web/.env.local> scripts/csat/map/e2e-cleanup.mjs [--dry] [--all](기본: 30분 넘은 것만)
// 재실행 안전: 지울 것이 없으면 아무것도 하지 않는다. 각 E2E 의 finally · 중단 신호에서도 같은 함수(cleanupLeftovers)를 부른다.
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

export const E2E_EMAIL_PREFIXES = ['map-state-', 'map-goal-e2e-', 'map-v4-e2e-', 'map-v4-perf-']
export const TEST_FIXTURE_EXAMS = ['M2097', 'M2098']

/** 남은 E2E 자료를 찾아(dry) 지운다. 같은 실행 중인 다른 E2E 의 계정을 지우지 않게 minAgeMs 보다 오래된 계정만 */
export async function cleanupLeftovers(db, { dry = false, minAgeMs = 0, log = console.log } = {}) {
  const out = { users: 0, exams: 0 }
  const cutoff = Date.now() - minAgeMs
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`계정 목록: ${error.message}`)
    const hits = data.users.filter((u) => u.email?.endsWith('@example.com') && E2E_EMAIL_PREFIXES.some((p) => u.email.startsWith(p)) && new Date(u.created_at).getTime() <= cutoff)
    for (const u of hits) {
      log(`${dry ? '[dry] ' : ''}계정 삭제 ${u.email.split('@')[0]}`)
      if (!dry) { const r = await db.auth.admin.deleteUser(u.id); if (r.error) throw new Error(`계정 삭제: ${r.error.message}`) }
      out.users++
    }
    if (data.users.length < 1000) break
  }
  // TEST fixture — 먼저 대상을 모은 뒤 표마다 한 번씩 지운다(반복문 안 단건 쓰기 금지 · row-write-budget)
  const { data: exams, error } = await db.from('csat_exams').select('id, label').in('id', TEST_FIXTURE_EXAMS)
  if (error) throw new Error(`시험 조회: ${error.message}`)
  const fx = (exams ?? []).filter((e) => {
    const ok = String(e.label ?? '').startsWith('TEST ')
    if (!ok) log(`건너뜀 ${e.id} — TEST 라벨이 아니다`)
    return ok
  }).map((e) => e.id)
  for (const id of fx) log(`${dry ? '[dry] ' : ''}fixture 삭제 ${id}`)
  if (fx.length && !dry) {
    const { data: items, error: ie } = await db.from('csat_items').select('id').in('exam_id', fx)
    if (ie) throw new Error(`문항: ${ie.message}`)
    const ids = (items ?? []).map((i) => i.id)
    const must = async (q, w) => { const r = await q; if (r.error) throw new Error(`${w}: ${r.error.message}`) }
    if (ids.length) {
      await must(db.from('csat_dx_option_trap').delete().in('item_id', ids), 'traps')
      await must(db.from('csat_dx_item_attribute').delete().in('item_id', ids), 'attrs')
    }
    await must(db.from('csat_dx_session').delete().in('exam_id', fx), 'sessions')
    await must(db.from('csat_dx_answer_key').delete().in('exam_id', fx), 'keys')
    await must(db.from('csat_items').delete().in('exam_id', fx), 'items')
    await must(db.from('csat_exams').delete().in('id', fx), 'exam')
  }
  out.exams = fx.length
  return out
}

/** E2E 스크립트용 — Ctrl+C · 종료 신호에도 정리가 돌게 한다(정리가 끝난 뒤 종료) */
export function onInterrupt(cleanup) {
  let running = false
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, async () => {
      if (running) return
      running = true
      console.log(`\n${sig} — 임시 자료 정리 뒤 종료`)
      try { await cleanup() } catch (e) { console.error('정리 실패', e) }
      process.exit(130)
    })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
  const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
  const { createClient } = req('@supabase/supabase-js')
  if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  // 기본은 30분 넘은 것만 — 지금 돌고 있는 다른 E2E 의 계정을 지우지 않게(리뷰 P2). --all 이면 나이 무관
  const r = await cleanupLeftovers(db, { dry: process.argv.includes('--dry'), minAgeMs: process.argv.includes('--all') ? 0 : 30 * 60_000 })
  console.log(`정리: 계정 ${r.users} · TEST 시험 ${r.exams}`)
}
