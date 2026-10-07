// scripts/csat/diagnosis/pilot-run.mts
//
// 한 시험 검수 파일럿 실행(2026-10-07) — 검수안(scripts/csat/diagnosis/pilot/<exam>-review.json)을 **실행 동안만 있는 TEST 시험**에 실제 검수 RPC 로
// 저장하고, 진단 반영 판정 → 진단 반영 → 파일럿 학생 기록(실제 기록 API · 두 오답 패턴) → 실제 진단 엔진 → 학습 지도(브라우저) →
// 「먼저 확인」 → 확인 시작 → 확인하기 과제까지 한 바퀴 돈다. 원인 사슬(오답 → 문항 태그 → 역량 집계 → 후보 → 단계 → 과제)을 tmp/pilot 에 남긴다.
// 실제 시험(원본)의 검수 표지 · diagnosis_ready 는 건드리지 않는다. 끝나면 계정 · TEST 시험을 지운다.
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/diagnosis/pilot-run.mts [--exam M2409] [--base http://localhost:3000]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

import { createClient } from '@supabase/supabase-js'

import { ATTRIBUTE_CODES } from '../../../apps/web/src/lib/csat/diagnosis/engine/types.ts'
import { examReadiness } from '../../../apps/web/src/lib/csat/diagnosis/readiness.ts'
import { isKiceExam } from '../lib-exam-id.mjs'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test')
const arg = (k: string, d: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const SRC = arg('--exam', 'M2409')
const BASE = arg('--base', 'http://localhost:3000')
const FX = 'M2097'
const OUT = path.join(ROOT, 'tmp/pilot')
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
if (!isKiceExam(SRC)) throw new Error('원본은 평가원 시험이어야 한다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
type Row = Record<string, unknown>
const must = async <T = Row[],>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> => {
  const { data, error } = await q
  if (error) throw new Error(`${what}: ${error.message}`)
  return data as T
}
fs.mkdirSync(OUT, { recursive: true })
const REVIEW = arg('--review', path.join(ROOT, `scripts/csat/diagnosis/pilot/${SRC}-review.json`))
const review = JSON.parse(fs.readFileSync(REVIEW, 'utf8')) as { items: { no: number; w: Record<string, number>; why: string[] }[] }
let fail = 0
const log: string[] = []
const rec = (name: string, ok: boolean, detail: unknown = '') => { if (!ok) fail++; const l = `[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 300)}`; log.push(l); console.log(l) }

// ── 1. 시드 → 검수 변경량 ──
const srcItems = await must<Row[]>(db.from('csat_items').select('*').eq('exam_id', SRC).order('no'), 'src items')
const srcAttrs = await must<Row[]>(db.from('csat_dx_item_attribute').select('*').in('item_id', srcItems.map((i) => i.id as string)), 'src attrs')
const srcTraps = await must<Row[]>(db.from('csat_dx_option_trap').select('*').in('item_id', srcItems.map((i) => i.id as string)), 'src traps')
const seedOf = (no: number) => {
  const id = srcItems.find((i) => i.no === no)?.id
  return Object.fromEntries(ATTRIBUTE_CODES.map((c) => [c, Number(srcAttrs.find((a) => a.item_id === id && a.attribute_code === c)?.weight ?? 0)]))
}
const diff = { items: review.items.length, unchanged: 0, added: 0, removed: 0, reweighted: 0, changes: 0, byCode: Object.fromEntries(ATTRIBUTE_CODES.map((c) => [c, 0])) as Record<string, number>, reasons: {} as Record<string, number> }
for (const it of review.items) {
  const s = seedOf(it.no)
  let add = false, rm = false, rw = false, n = 0
  for (const c of ATTRIBUTE_CODES) {
    const a = s[c], b = it.w[c]
    if (a === b) continue
    n++
    diff.byCode[c]++
    if (a === 0 && b > 0) add = true
    else if (a > 0 && b === 0) rm = true
    else rw = true
  }
  if (n === 0) diff.unchanged++
  if (add) diff.added++
  if (rm) diff.removed++
  if (rw) diff.reweighted++
  diff.changes += n
  for (const r of it.why) diff.reasons[r.split(':')[0]] = (diff.reasons[r.split(':')[0]] ?? 0) + 1
}
console.log('시드 → 검수', JSON.stringify(diff))

// ── 2. TEST 시험 · 실제 검수 RPC · 판정 ──
const exists = await must<Row[]>(db.from('csat_exams').select('id').eq('id', FX), 'exists')
if (exists.length) throw new Error(`${FX} 가 이미 있다 — 지우지 않고 멈춘다`)
const idMap: Record<string, string> = Object.fromEntries(srcItems.map((i) => [i.id as string, `${FX}-${i.no}`]))
const users: string[] = []
const browser = await chromium.launch()
const chains: Row[] = []
try {
  const [ex] = await must<Row[]>(db.from('csat_exams').select('*').eq('id', SRC), 'src exam')
  await must(db.from('csat_exams').insert({ ...ex, id: FX, label: 'TEST 검수 파일럿(자동 생성 · 실행 뒤 삭제)', year: 2097, exam_year: 2096, diagnosis_ready: false }), 'fx exam')
  await must(db.from('csat_items').insert(srcItems.map((it) => ({ ...it, id: idMap[it.id as string], exam_id: FX }))), 'fx items')
  const keys = await must<Row[]>(db.from('csat_dx_answer_key').select('*').eq('exam_id', SRC), 'src keys')
  await must(db.from('csat_dx_answer_key').insert(keys.map((k) => ({ ...k, exam_id: FX }))), 'fx keys')
  await must(db.from('csat_dx_item_attribute').insert(srcAttrs.map((a) => ({ ...a, item_id: idMap[a.item_id as string], reviewed_at: null, reviewed_by: null, source: 'type_default' }))), 'fx seed')
  for (const it of review.items) {
    const srcId = srcItems.find((i) => i.no === it.no)?.id as string
    const traps = Object.fromEntries([1, 2, 3, 4, 5].map((o) => [String(o), (srcTraps.find((t) => t.item_id === srcId && t.option_no === o)?.trap_key as string | undefined) ?? null]))
    const { error } = await db.rpc('csat_dx_save_item_tagging', { p_item_id: idMap[srcId], p_weights: it.w, p_traps: traps, p_error_rate: null, p_ebs: null, p_by: null })
    if (error) throw new Error(`검수 저장 ${it.no}: ${error.message}`)
  }
  const fxIds = Object.values(idMap)
  const fxAttrs = await must<{ item_id: string; attribute_code: string; reviewed_at: string | null }[]>(db.from('csat_dx_item_attribute').select('item_id, attribute_code, reviewed_at').in('item_id', fxIds), 'fx attrs')
  const ready = examReadiness(45, srcItems.map((i) => ({ id: idMap[i.id as string], hasAnswer: true, attrs: fxAttrs.filter((a) => a.item_id === idMap[i.id as string]).map((a) => ({ code: a.attribute_code, reviewed: a.reviewed_at !== null })) })))
  rec('검수 저장 — 28문항 · 252행 · 판정 통과', ready.canEnable && fxAttrs.length === srcItems.length * 9, { rows: fxAttrs.length, ...ready })
  if (!ready.canEnable) throw new Error('판정 미통과 — 진단 반영을 켜지 않는다')
  await must(db.from('csat_exams').update({ diagnosis_ready: true }).eq('id', FX), 'fx ready')

  // ── 3. 파일럿 학생 · 실제 기록 · 실제 엔진 · 브라우저 ──
  const key = Object.fromEntries(keys.map((k) => [k.no as number, (k.answers as number[])[0]]))
  const trapPick = (no: number) => {
    const srcId = srcItems.find((i) => i.no === no)?.id
    const t = srcTraps.find((x) => x.item_id === srcId)
    return t ? (t.option_no as number) : (key[no] % 5) + 1
  }
  const PATTERNS = [
    { tag: 'p1-vocab-sentence', label: '어휘 · 문장 수준 오답', wrong: [19, 24, 29, 30, 31, 34, 40, 42] },
    { tag: 'p2-flow-option', label: '글 흐름 · 선지 판단 오답', wrong: [20, 23, 32, 33, 35, 36, 37, 38, 39, 43, 44] },
  ]
  for (const p of PATTERNS) {
    const email = `pilot-${p.tag}-${Date.now()}@example.com`
    const password = `Pi-${crypto.randomBytes(9).toString('base64url')}-Aa1`
    const { data: made, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw error
    users.push(made.user.id)
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const login = await ctx.newPage()
    login.setDefaultTimeout(240_000)
    await login.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    await login.fill('input[type="email"]', email)
    await login.fill('input[type="password"]', password)
    await login.click('button[type="submit"]')
    await login.waitForURL((u: URL) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' })
    await login.close() // /hub 의 끝나지 않는 이미지 요청(docs/reports/hub-hanging-image-requests-20261007.md)을 피한다
    const page = await ctx.newPage()
    page.setDefaultTimeout(240_000)
    const choices = Object.fromEntries(Array.from({ length: 45 }, (_, i) => i + 1).map((no) => [no, p.wrong.includes(no) ? trapPick(no) : key[no]]))
    const res = await page.request.post(`${BASE}/api/csat/diagnosis/sessions`, { data: { examId: FX, mode: 'live', takenAt: '2026-09-21', totalMinutes: 70, clientKey: crypto.randomUUID(), choices, flags: {} } })
    const body = await res.json().catch(() => ({}))
    rec(`${p.tag} · 실제 기록 API(진단 반영 시험)`, res.status() === 200 && body.ready === true, { status: res.status(), raw: body.raw, ready: body.ready })
    // 엔진 결과(스냅샷 근거)
    const [snap] = await must<Row[]>(db.from('csat_dx_snapshot').select('evidence, engine_version').eq('user_id', made.user.id).order('computed_at', { ascending: false }).limit(1), 'snap')
    const ev = (snap?.evidence ?? {}) as { attributePoints?: Record<string, { earned?: number; possible?: number; n?: number }> }
    await page.goto(`${BASE}/csat/diagnosis?tab=map`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-testid="learner-map"]')
    await page.waitForTimeout(1500)
    const focusKind = await page.locator('[data-testid="focus-card"]').getAttribute('data-focus')
    const card = await page.locator('[data-testid="focus-card"]').innerText()
    const focusStep = (await page.locator('[data-testid="read-path"] li[data-e="focus"] [data-step]').evaluateAll((els) => els.map((e) => e.getAttribute('data-step')))).join('+') || null
    const badges = await page.locator('[data-testid="read-path"] [data-step]').allInnerTexts()
    await page.screenshot({ path: path.join(OUT, `${p.tag}-map.png`), fullPage: true })
    let findShown: string[] = []
    if (focusKind === 'step') {
      await page.locator('[data-testid="focus-cta"]').click()
      await page.waitForSelector('[data-step-sheet]')
      await page.waitForTimeout(400)
      findShown = await page.locator('#step-check li strong').allInnerTexts()
      await page.screenshot({ path: path.join(OUT, `${p.tag}-find.png`) })
    } else if (focusKind === 'distinguish') {
      // 1위를 확정하지 않는 경우(RANKING_GATE) — 두 후보를 가르는 확인 하나
      await page.locator('[data-testid="focus-cta"]').click()
      await page.waitForSelector('[data-testid="distinguish-activity"]')
      findShown = await page.locator('[data-testid="distinguish-activity"] li').allInnerTexts()
      await page.screenshot({ path: path.join(OUT, `${p.tag}-distinguish.png`) })
    }
    rec(`${p.tag} · 학습 지도 「먼저 확인」 결과`, true, { focusKind, focusStep, card: card.replace(/\s+/g, ' ').slice(0, 120), findShown })
    // 원인 사슬: 오답 문항 → 검수 태그 → 역량별 기여
    const wrongTags = p.wrong.map((no) => ({ no, tags: Object.fromEntries(Object.entries(review.items.find((x) => x.no === no)!.w).filter(([, v]) => v > 0)) }))
    const contrib: Record<string, { wrongW: number; totalW: number }> = {}
    for (const it of review.items) for (const [c, v] of Object.entries(it.w)) {
      if (!v) continue
      contrib[c] ??= { wrongW: 0, totalW: 0 }
      contrib[c].totalW += v
      if (p.wrong.includes(it.no)) contrib[c].wrongW += v
    }
    chains.push({ pattern: p.tag, label: p.label, wrong: wrongTags, weightedMissByAttribute: Object.fromEntries(Object.entries(contrib).map(([c, x]) => [c, `${x.wrongW}/${x.totalW} (정답률 ${(1 - x.wrongW / x.totalW).toFixed(2)})`])), engineAttributePoints: ev.attributePoints ?? null, map: { focusKind, focusStep, badges: badges.map((b) => b.replace(/\s+/g, ' ')), findShown } })
    await ctx.close()
  }
} catch (e) {
  rec('실행 오류 없이 끝남', false, (e as Error).message)
} finally {
  await browser.close()
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
  const ids = Object.values(idMap)
  await db.from('csat_dx_option_trap').delete().in('item_id', ids)
  await db.from('csat_dx_item_attribute').delete().in('item_id', ids)
  await db.from('csat_dx_answer_key').delete().eq('exam_id', FX)
  await db.from('csat_items').delete().eq('exam_id', FX)
  await db.from('csat_exams').delete().eq('id', FX)
  const left = await must<Row[]>(db.from('csat_exams').select('id').eq('id', FX), 'left')
  const srcAfter = await must<Row[]>(db.from('csat_dx_item_attribute').select('reviewed_at').in('item_id', srcItems.map((i) => i.id as string)).not('reviewed_at', 'is', null), 'src after')
  rec('정리 — TEST 시험 없음 · 원본 검수 표지 그대로(0)', left.length === 0 && srcAfter.length === 0, { left: left.length, srcReviewed: srcAfter.length })
  fs.writeFileSync(path.join(OUT, `${SRC}-pilot${process.argv.includes('--review') ? '-variant' : ''}.json`), JSON.stringify({ diff, chains, log }, null, 1))
  console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
  process.exit(fail ? 1 : 0)
}
