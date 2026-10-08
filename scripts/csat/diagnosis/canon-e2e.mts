// scripts/csat/diagnosis/canon-e2e.mts
//
// M2409 pilot canon 실제 E2E(2026-10-08) — **실제 정본 M2409(검수 28/28 · diagnosis_ready ON)** 위에서, 실행 동안만 있는 pilot 학습자로
// 기록 API → 진단 → 학습 지도 → routing → CTA → 확인 활동까지 브라우저로 돈다. 사례:
//   R(문장 관계 단계) · E(본문↔선지 단계) · V(어휘를 단독 약점으로 말하지 않고 구분 확인) · X(시간/내용 구분) · S(직접 확인)
//   · 누적 S(같은 시험 6회 기록 — 29번만 틀림 → S 관찰 · 분명한 1위 → 직접 확인, Codex P1 회귀)
// 오답 패턴은 오프라인 근사(seed-rules · axis-routing)로 고른 것 — 판정은 이 실행의 실제 엔진 · 화면 결과다.
// 끝나면 pilot 학습자를 지우고(기록 · 스냅샷 함께) 남은 것이 없는지 · M2409 상태가 그대로인지 본다.
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/diagnosis/canon-e2e.mts [--base http://localhost:3000]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3000'
const EXAM = 'M2409'
const OUT = path.join(ROOT, 'tmp/pilot/canon')
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test')
fs.mkdirSync(OUT, { recursive: true })
let fail = 0
const log: Record<string, unknown>[] = []
const rec = (name: string, ok: boolean, detail: unknown = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 360)}`) }

const [exam] = (await db.from('csat_exams').select('id, diagnosis_ready').eq('id', EXAM)).data ?? []
if (!exam?.diagnosis_ready) throw new Error('M2409 진단 반영이 꺼져 있다 — 정본 활성화 뒤에 돈다')
const keys = (await db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', EXAM)).data ?? []
const key = Object.fromEntries(keys.map((k) => [k.no as number, (k.answers as number[])[0]]))
const traps = (await db.from('csat_dx_option_trap').select('item_id, option_no').like('item_id', `${EXAM}#%`)).data ?? []
const trapPick = (no: number) => (traps.find((t) => t.item_id === `${EXAM}#${no}`)?.option_no as number | undefined) ?? (key[no] % 5) + 1

type Case = { tag: string; wrong: number[]; sessions?: number; expect: { kind: string; step?: string; also?: string[]; title?: RegExp } }
const CASES: Case[] = [
  { tag: 'R-relation', wrong: [20, 23, 32, 33, 35, 36, 37, 38, 39, 43, 44], expect: { kind: 'step', step: 'relation' } },
  { tag: 'E-option', wrong: [18, 19, 20, 22, 25, 26, 27, 28, 33, 38, 40, 45], expect: { kind: 'step', step: 'option' } },
  { tag: 'V-assisted', wrong: [19, 24, 29, 30, 31, 34, 40, 42], expect: { kind: 'distinguish', step: 'vocab', title: /어휘 때문인지/ } },
  { tag: 'X-assisted', wrong: [19, 23, 25, 26, 27, 38, 39, 41, 42, 44], expect: { kind: 'distinguish', step: 'integrate', title: /시간 때문인지 내용 이해 때문인지/ } },
  { tag: 'S-direct', wrong: [19, 28, 35, 41, 43], expect: { kind: 'direct', step: 'sentence', title: /문장 자체를 정확히 읽는 힘/ } },
  { tag: 'S-accumulated', wrong: [29], sessions: 6, expect: { kind: 'direct', step: 'sentence', title: /문장 자체를 정확히 읽는 힘/ } },
]
const FORBIDDEN = /exam_observable|exam_assisted|direct_diagnostic|confounded|rankingEstimate|ranking estimate|k=8|\bA[1-9]\b|약점입니다|약하다/

const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null
const users: string[] = []
const browser = await chromium.launch()
try {
  for (const c of CASES.filter((x) => !ONLY || ONLY.includes(x.tag))) {
    const email = `pilot-canon-${c.tag.toLowerCase()}-${Date.now()}@example.com`
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
    await login.close() // /hub 의 끝나지 않는 이미지 요청을 피한다
    const page = await ctx.newPage()
    page.setDefaultTimeout(240_000)
    const choices = Object.fromEntries(Array.from({ length: 45 }, (_, i) => i + 1).map((no) => [no, c.wrong.includes(no) ? trapPick(no) : key[no]]))
    const n = c.sessions ?? 1
    let okAll = true
    for (let s = 0; s < n; s++) {
      const res = await page.request.post(`${BASE}/api/csat/diagnosis/sessions`, {
        data: { examId: EXAM, mode: s === 0 ? 'live' : 'retake', takenAt: `2026-09-${String(10 + s).padStart(2, '0')}`, totalMinutes: 70, clientKey: crypto.randomUUID(), choices, flags: {} },
      })
      const body = await res.json().catch(() => ({}))
      if (res.status() !== 200 || body.ready !== true) { okAll = false; rec(`${c.tag} · 기록 ${s + 1}/${n}`, false, { status: res.status(), body }) }
    }
    rec(`${c.tag} · 실제 기록 API(정본 M2409 · 진단 반영) ${n}회`, okAll)
    await page.goto(`${BASE}/csat/diagnosis?tab=map`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-testid="learner-map"]')
    await page.waitForTimeout(1200)
    const card = page.locator('[data-testid="focus-card"]')
    const kind = await card.getAttribute('data-focus')
    const cardText = (await card.innerText()).replace(/\s+/g, ' ')
    const focused = await page.locator('[data-testid="read-path"] li[data-e="focus"] [data-step]').evaluateAll((els) => els.map((e) => e.getAttribute('data-step')))
    const ctas = await page.locator('[data-testid="focus-cta"]').count()
    const mainText = (await page.locator('[data-testid="learner-map"]').innerText()).replace(/\s+/g, ' ')
    await page.screenshot({ path: path.join(OUT, `${c.tag}-map.png`), fullPage: true })
    let shown: string[] = []
    if (ctas === 1) {
      await page.locator('[data-testid="focus-cta"]').click()
      if (kind === 'step') {
        await page.waitForSelector('[data-step-sheet]')
        await page.waitForTimeout(400)
        shown = await page.locator('#step-check li strong').allInnerTexts()
      } else {
        await page.waitForSelector('[data-testid="distinguish-activity"]')
        shown = await page.locator('[data-testid="distinguish-activity"] li').allInnerTexts()
      }
      await page.screenshot({ path: path.join(OUT, `${c.tag}-action.png`) })
    }
    const okKind = kind === c.expect.kind && (!c.expect.step || focused.includes(c.expect.step)) && (!c.expect.title || c.expect.title.test(cardText))
    rec(`${c.tag} · 「먼저 확인」 = ${c.expect.kind}${c.expect.step ? ` · ${c.expect.step}` : ''}`, okKind, { kind, focused, card: cardText.slice(0, 140) })
    rec(`${c.tag} · CTA 하나 · 누르면 확인 활동`, ctas === 1 && shown.length > 0, { ctas, shown })
    rec(`${c.tag} · 학생 화면에 내부 용어 · 단정 문구 없음`, !FORBIDDEN.test(mainText), FORBIDDEN.exec(mainText)?.[0] ?? '')
    if (c.tag.startsWith('V')) rec('V · 「어휘·표현」 단독 단계로 가지 않음', !(kind === 'step' && focused.length === 1 && focused[0] === 'vocab'), { kind, focused })
    const [snap] = (await db.from('csat_dx_snapshot').select('evidence').eq('user_id', made.user.id).order('computed_at', { ascending: false }).limit(1)).data ?? []
    const ev = (snap?.evidence ?? {}) as { attributePoints?: Record<string, { n: number; value: number | null }>; vOverlap?: unknown }
    log.push({ case: c.tag, kind, focused, card: cardText, shown, attributePoints: Object.fromEntries(Object.entries(ev.attributePoints ?? {}).map(([k, v]) => [k, [v.n, v.value === null ? null : Math.round(v.value * 1000) / 1000]])), vOverlap: ev.vOverlap ?? null })
    await ctx.close()
  }
} finally {
  await browser.close()
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
  const left = users.length ? ((await db.from('csat_dx_session').select('id').in('user_id', users)).data ?? []).length : 0
  const snaps = users.length ? ((await db.from('csat_dx_snapshot').select('user_id').in('user_id', users)).data ?? []).length : 0
  const [after] = (await db.from('csat_exams').select('diagnosis_ready').eq('id', EXAM)).data ?? []
  const rows = ((await db.from('csat_dx_item_attribute').select('item_id, reviewed_at').like('item_id', `${EXAM}#%`)).data ?? [])
  rec('정리 — pilot 학습자 · 기록 · 스냅샷 0 · M2409 정본(252행 · 28문항 검수 · 켜짐) 그대로', left === 0 && snaps === 0 && after?.diagnosis_ready === true && rows.length === 252 && rows.every((r) => r.reviewed_at), { users: users.length, sessions: left, snaps, ready: after?.diagnosis_ready, rows: rows.length })
  fs.writeFileSync(path.join(OUT, 'canon-e2e.json'), JSON.stringify(log, null, 1))
}
console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
if (fail) process.exit(1)
