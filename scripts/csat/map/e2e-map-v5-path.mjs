#!/usr/bin/env node
// scripts/csat/map/e2e-map-v5-path.mjs
//
// 학습 지도 rev4.0 5차 — Workspace 「글의 핵심 잡기」 전체 경로 E2E(실제 개발 서버 · 개발 DB · 실제 기출 콘텐츠 · 실제 브라우저 1440px).
//   ① 확인: 계획의 「활동 시작」 → 실제 확인 문항 화면에서 직접 풀이 — 서로 다른 2문항 오답이 나올 때까지(정답이면 다음 문항)
//   ② 확정 → 계획 단계 = 바로잡기 · 「활동 시작」 = 막힌 문항 → 그 문항 「다시 해 보기」 풀이(막힌 문항 수만큼)
//   ③ 단계 = 다른 글에 적용 · 「활동 시작」 = 연습 화면(?item=)의 주제 · 제목 유형 문항 → 2지문 풀이(phase transfer)
//   ④ 단계 = 다시 확인 · 「활동 시작」 = 아직 안 본 확인 문항 → 2문항 독립 풀이 → 직접 확인 판정이 다시 계산됨(통과 = 해소 · 실패 = 아직 필요)
//   매 단계 MAP(영역 근거) · PLAN(단계 · 수행 수 · 성취)을 화면과 DB 로 교차 확인 — 수행이 성취를 바꾸지 않고, 성취는 직접 확인 판정에서만 바뀐다.
// 합성 계정(@example.com) — 본인 화면 판정은 실제 학습자와 같은 기준(5차 통일), 집단 통계에서는 빠진다. 학습 효과의 증거가 아니다.
// 임시 계정만 만들고 끝 · 중단 시 지운다. 시작 시 30분 넘은 E2E 잔여만 정리.
//   node --tls-max-v1.2 --env-file=apps/web/.env.local scripts/csat/map/e2e-map-v5-path.mjs [--base http://localhost:3003] [--out tmp/map-v5-path]
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { cleanupLeftovers, onInterrupt } from './e2e-cleanup.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const argv = process.argv.slice(2)
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d)
const BASE = arg('--base', 'http://localhost:3003')
const OUT = path.join(ROOT, arg('--out', 'tmp/map-v5-path'))
const RECHECK = arg('--recheck', 'fail') // fail = 다시 확인을 일부러 틀림(still_needed) · pass = 정본 주석대로 맞힘(resolved) — 6차 P0-1 양쪽 재현
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const must = async (q, what) => { const r = await q; if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }
fs.mkdirSync(OUT, { recursive: true })
{ const swept = await cleanupLeftovers(db, { minAgeMs: 30 * 60_000, log: () => {} }); if (swept.users || swept.exams) console.log(`지난 실행 잔여 정리 — 계정 ${swept.users} · TEST 시험 ${swept.exams}`) }
let fail = 0
let blocked = 0
const blockedRec = (name, detail) => { blocked++; console.log(`[BLOCKED] ${name} — ${JSON.stringify(detail).slice(0, 300)}`) }
const rec = (name, ok, detail = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 300)}`) }

const READY = 'M2409'
// --ws central-meaning(기본) | evidence-locate — 6차 P0-2: 두 번째 Workspace 경로
const WS = arg('--ws', 'central-meaning')
const CFG = { 'central-meaning': { task: 'r.central_meaning', key: 'claim-support' }, 'evidence-locate': { task: 'e.evidence_location', key: 'evidence-locate' } }[WS]
if (!CFG) throw new Error('모르는 --ws ' + WS)
const TASK = CFG.task
const users = []
const browser = await chromium.launch()
onInterrupt(async () => { await browser.close().catch(() => {}); for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {}) })
try {
  const key = Object.fromEntries((await must(db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', READY), 'key')).map((k) => [k.no, k.answers[0]]))
  const W1 = new Set([20, 23, 29, 30, 32, 33, 35, 36, 37, 38, 39, 43, 44])
  const choices = Object.fromEntries(Object.keys(key).map((no) => [no, W1.has(Number(no)) ? (key[no] % 5) + 1 : key[no]]))
  const email = `map-v5-e2e-path-${Date.now()}@example.com`
  const password = `Mp-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data: u, error: ue } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (ue) throw ue
  users.push(u.user.id)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(240_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit' })
  const r1 = await page.request.post(`${BASE}/api/csat/diagnosis/sessions`, { data: { examId: READY, mode: 'live', takenAt: new Date().toISOString().slice(0, 10), totalMinutes: 70, clientKey: crypto.randomUUID(), choices, flags: {} } })
  if (r1.status() !== 200) throw new Error(`기록 실패 ${r1.status()}`)
  if ((await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 80 } })).status() !== 200) throw new Error('목표 실패')
  for (let i = 0; i < 60; i++) {
    if ((await must(db.from('csat_dx_snapshot').select('id').eq('user_id', u.user.id).limit(1), 'snapshot')).length) break
    await new Promise((r) => setTimeout(r, 1000))
  }

  /**
   * 지도를 열고 중심 TASK 계획 줄을 읽는다 — v6.2 단일 지도: 복귀 문맥(map_task · ws)으로 그 TASK 를 고르고 그 묶음 계획을 연 채로 연다.
   * 「As-Is 영역 근거」는 Inspector 의 근거 상태(data-evidence) + 그 TASK 노드 상태 글자로 읽는다(옛 영역 표 need-domains 대신).
   */
  const row = async (tag) => {
    await page.goto(`${BASE}/csat/diagnosis?tab=map&map_task=${TASK}&ws=ws.${WS}`, { waitUntil: 'domcontentloaded' })
    const sec = page.locator('[data-testid="umap-plan"] [data-testid="plan-section"]')
    await sec.waitFor()
    await page.waitForLoadState('networkidle').catch(() => {})
    if ((await sec.getAttribute('data-ws')) !== `ws.${WS}`) throw new Error(`복귀 문맥으로 연 계획 묶음이 다르다: ${await sec.getAttribute('data-ws')}`)
    if ((await page.getAttribute('[data-testid="task-inspector"]', 'data-task')) !== TASK) throw new Error('복귀 문맥으로 고른 TASK 가 다르다')
    const li = sec.locator(`li[data-task="${TASK}"]`)
    await li.waitFor()
    const go = li.locator('[data-testid="plan-go"]')
    const info = {
      stage: await li.getAttribute('data-stage'),
      done: Number(await li.getAttribute('data-done')),
      planned: (await li.getAttribute('data-planned')) || null,
      achievement: await li.getAttribute('data-achievement'),
      href: (await go.count()) ? await go.getAttribute('href') : null,
      domains: `${await page.getAttribute('[data-testid="inspector-evidence"]', 'data-evidence')}|${await page.locator(`[data-node="${TASK}"]`).innerText()}`,
      transferBlocked: (await page.locator('[data-testid="task-inspector"] li[data-stage="transfer"]').getAttribute('data-blocked').catch(() => null)) || null,
    }
    await sec.screenshot({ path: path.join(OUT, `${tag}.png`) })
    return info
  }
  const attempts = async () => must(db.from('learning_task_attempts').select('item_ref, phase, activity, is_correct, answered_at').eq('user_id', u.user.id).order('answered_at'), 'attempts')

  /** 정본 주석(주장 · 뒷받침 · 관계) — `--recheck pass` 에서 다시 확인 문항을 맞히는 데만 쓴다(재현 가능한 성공 경로 · 6차) */
  const annotationOf = (href) => {
    const slug = href.split('#')[0].split('?')[0].split('/').pop().toLowerCase()
    const dir = path.join(ROOT, 'apps/web/src/lib/knowledge/annotations')
    const f = fs.readdirSync(dir).filter((x) => x.startsWith(`claim-support-${slug}.v`)).sort().pop()
    if (!f) throw new Error(`주석 없음 ${slug}`)
    return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  }
  /** 문항 화면 확인 과제 하나 풀기 — retry 면 「다시 해 보기」 먼저 · correct 면 정본 주석대로 정답. 결과(정답 여부) 반환 */
  const solveItem = async (href, retry = false, correct = false) => {
    await page.goto(`${BASE}${href.split('#')[0]}`, { waitUntil: 'domcontentloaded' })
    const panel = page.locator('[data-testid="principle-panel"]')
    await panel.waitFor({ timeout: 120_000 })
    await page.waitForLoadState('networkidle').catch(() => {})
    const task = panel.locator('[data-testid="principle-task"]')
    // 상호작용 준비(hydration) 전 클릭은 반응이 없다 — 과제가 열릴 때까지 다시 누른다
    for (let k = 0; k < 10 && !(await task.count()); k++) {
      await panel.getByRole('button', { name: '직접 확인하기' }).click({ timeout: 10_000 }).catch(() => {})
      await page.waitForTimeout(800)
    }
    if (retry && (await panel.getByRole('button', { name: '다시 해 보기' }).count())) await panel.getByRole('button', { name: '다시 해 보기' }).click()
    if (await panel.locator('[data-pick]').count()) {
      // 근거 찾기 · 선지 맞대기(근거 패널) — 정답 = 근거 문장 하나 · 확실한 오답 = 빈칸 문장(근거가 될 수 없다)
      const ev = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/knowledge/annotations/evidence-tasks.v1.json'), 'utf8')).items
      const id = href.split('#')[0].split('?')[0].split('/').pop().replace(/-(\d+)$/, '#$1').toUpperCase().replace(/^(\d{4})#/, '$1#')
      const a = ev[id] ?? ev[id.replace(/^M/, 'M')]
      // 확실한 오답 = 근거 · 갈린 문장 · 빈칸이 아닌 문장(빈칸 문장 버튼은 고를 수 없다)
      const wrongPick = [...Array(a.sentenceCount).keys()].find((i) => !a.evidence.includes(i) && !a.disputed.includes(i) && i !== a.blank)
      const pick = correct ? a.evidence[0] : wrongPick
      await panel.locator(`[data-pick="${pick}"]`).click()
    } else if (correct) {
      const a = annotationOf(href)
      await panel.locator(`[data-claim="${a.claim}"]`).click()
      for (const s of a.support) await panel.locator(`[data-support="${s}"]`).click()
      await panel.locator(`[data-relation="${a.relationProbe.relation}"]`).check()
    } else {
      await panel.locator('[data-claim]').last().click()
      await panel.locator('[data-support]').first().click()
      await panel.locator('[data-relation]').last().check().catch(() => {})
    }
    const resp = page.waitForResponse((r) => /\/api\/csat\/item\/.+\/task/.test(r.url()))
    await panel.getByRole('button', { name: '확인하기' }).click()
    const b = await (await resp).json()
    return b.grade?.isCorrect === true
  }
  /** 연습 화면 문항 하나 풀기(주장 문장 · 고른 답 · 확신도 · 관계) */
  const solvePractice = async (href) => {
    await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})
    // 지문 문장 막대(「문장 N」) — 다른 목록의 버튼을 잡지 않게 이름으로 고른다. 상호작용 준비 전 클릭은 반응이 없어 답 칸이 열릴 때까지 다시 누른다
    const bar = page.getByRole('button', { name: /^문장 1(\s|$)/ }).first()
    await bar.waitFor({ timeout: 120_000 })
    const answer = page.locator('fieldset', { hasText: '문제지에서 고른 답' })
    for (let k = 0; k < 10 && !(await answer.count()); k++) {
      await bar.click({ timeout: 10_000 }).catch(() => {})
      await page.waitForTimeout(800)
    }
    const rel = page.locator('fieldset', { hasText: '주장과 어떤 관계' })
    if (await rel.count()) await rel.getByRole('button').first().click()
    await page.locator('fieldset', { hasText: '문제지에서 고른 답' }).getByRole('button', { name: '1번' }).click()
    await page.locator('fieldset', { hasText: '얼마나 확신' }).getByRole('button', { name: '아마도' }).click()
    const resp = page.waitForResponse((r) => r.url().includes('/api/csat/practice/attempt') && r.request().method() === 'POST')
    await page.getByRole('button', { name: '맞춰 보기' }).click()
    return (await resp).status()
  }

  // ① 확인
  let s = await row('p1-check')
  rec('① 시작 — 단계 「확인」 · 활동 = 실제 확인 문항 화면 · 성취 「직접 확인 전」', s.stage === 'check' && /^\/csat\/item\//.test(s.href ?? '') && s.achievement === 'not_checked', s)
  const domains0 = s.domains
  // 독립 근거로 인정된 첫 시도(도움 · 해설 · 시각 불확실 제외 — 판정 규칙 그대로)를 DB 에서 센다. 채점 결과만 세면 개발 서버가 느려
  // 시각 불확실로 빠진 시도까지 셌다(6차 실측: 재시작 직후 첫 문항 timing_uncertain) — 규칙을 완화하지 않고 필요한 만큼 더 푼다
  const eligible = async () => (await must(db.from('learning_first_attempts').select('item_ref, phase, help_level, is_correct, after_viewed_first, after_explanation, timing_uncertain').eq('user_id', u.user.id), 'first'))
    .filter((a) => a.phase === 'practice' && a.help_level === 'independent' && !a.after_viewed_first && !a.after_explanation && !a.timing_uncertain)
  if (argv.includes('--probe')) { await solveItem(s.href); const at = await must(db.from('learning_task_attempts').select('item_ref, phase, help_level, answered_at, received_at, session_id').eq('user_id', u.user.id), 'a'); const ss = await must(db.from('learning_sessions').select('id, item_ref, help_level, help_received_at, help_server_at, explanation_viewed_at, explanation_server_at, help_clock_suspect').eq('user_id', u.user.id), 's'); const fa = await must(db.from('learning_first_attempts').select('item_ref, help_level, after_explanation, timing_uncertain').eq('user_id', u.user.id), 'f'); console.log('[probe] attempts', JSON.stringify(at)); console.log('[probe] sessions', JSON.stringify(ss)); console.log('[probe] first', JSON.stringify(fa)); throw new Error('probe 끝') }
  let wrong = 0
  for (let i = 0; i < 9 && wrong < 2; i++) {
    s = await row(`p1-check-${i}`)
    if (s.stage !== 'check' || !s.href) break
    await solveItem(s.href)
    wrong = (await eligible()).filter((a) => a.is_correct === false).length
  }
  rec('① 확인 문항 풀이로 서로 다른 2문항 독립 오답(DB 첫 시도 · 판정 규칙 기준)', wrong === 2, { wrong, excludedUncertain: (await must(db.from('learning_first_attempts').select('timing_uncertain').eq('user_id', u.user.id), 'f')).filter((a) => a.timing_uncertain).length })

  // ② 바로잡기
  s = await row('p2-repair')
  rec('② 확정 → 단계 「바로잡기」 · 성취 「필요 확인됨」 · 활동 = 막힌 확인 문항', s.stage === 'repair' && s.achievement === 'need_confirmed' && /^\/csat\/item\//.test(s.href ?? ''), s)
  // 직접 확인 판정은 As-Is 를 바꾼다(그게 목적) — 바뀌지 말아야 하는 것은 수행(바로잡기 · 적용)만 있었던 구간이다
  const domainsRepair = s.domains
  rec('② 직접 확인 판정이 As-Is 영역 근거에 반영됨(확인 전과 다름)', s.domains !== domains0)
  const blockedPlanned = Number(s.planned)
  for (let i = 0; i < blockedPlanned + 1; i++) {
    s = await row(`p2-repair-${i}`)
    if (s.stage !== 'repair' || !s.href) break
    await solveItem(s.href, true)
  }
  const at2 = await attempts()
  rec('② 막힌 문항 다시 풀이가 수행 기록으로 남음(같은 문항 두 번째 시도)', at2.filter((a) => a.phase !== 'transfer').length >= 2 + blockedPlanned, at2.length)

  let transferDone = false
  // ③ 다른 글에 적용 — 승인 · 활성화된 전이 문항이 있을 때만 열린다(없으면 정본대로 건너뛰고 그 사실을 보인다)
  s = await row('p3-transfer')
  if (s.stage === 'transfer') {
    rec('③ 바로잡기 마침 → 단계 「다른 글에 적용」 · 계획 2지문 · 활동 = 연습 화면 전이 문항 · 성취 그대로', s.planned === '2' && (CFG.key === 'claim-support' ? (s.href ?? '').startsWith('/csat/practice/claim-support?item=') : ((s.href ?? '').startsWith('/csat/item/') && (s.href ?? '').includes('?check=1'))) && s.achievement === 'need_confirmed', s)
    for (let i = 0; i < 3; i++) {
      s = await row(`p3-transfer-${i}`)
      if (s.stage !== 'transfer' || !s.href) break
      const st = CFG.key === 'claim-support' ? await solvePractice(s.href) : ((await solveItem(s.href)), 200)
      rec(`③ 적용 풀이 ${i + 1} 저장(200)`, st === 200, st)
    }
    const tr = (await attempts()).filter((a) => a.phase === 'transfer')
    transferDone = new Set(tr.map((a) => a.item_ref)).size === 2
    rec('③ 적용 2지문 = phase transfer 기록 2건(서로 다른 문항)', transferDone, tr.map((a) => a.item_ref))
  } else {
    rec('③ 전이 콘텐츠가 없으면 적용 단계는 「준비 중」으로 닫히고 계획은 다시 확인으로 넘어간다(없는 활동에 묶지 않음)', s.transferBlocked === 'no_transfer_items' && s.stage === 'recheck', { stage: s.stage, transferBlocked: s.transferBlocked })
    blockedRec(`③ 다른 글에 적용 — 승인 · 활성화된 ${CFG.key} 전이 문항 0개(전이 콘텐츠 출시 전)`, { transferBlocked: s.transferBlocked })
  }
  rec('②→③ 수행(바로잡기 · 적용)만으로는 As-Is 영역 근거가 바뀌지 않는다', s.domains === domainsRepair)

  // ④ 다시 확인
  s = await row('p4-recheck')
  rec('④ 적용 마침 → 단계 「다시 확인」 · 활동 = 아직 안 본 확인 문항 · 성취는 아직 그대로(수행 ≠ 성취)', s.stage === 'recheck' && /^\/csat\/item\//.test(s.href ?? '') && s.achievement === 'need_confirmed', s)
  const seen = new Set((await attempts()).map((a) => a.item_ref))
  const recheckHref = s.href
  rec('④ 다시 확인 문항은 처음 보는 문항', !!recheckHref && ![...seen].some((i) => recheckHref.endsWith(i.replace('#', '-'))), recheckHref)
  let rechecked = 0
  // 단계가 「다시 확인」인 동안(최대 4) — 성공은 연속 2 정답으로 해소되며 끝나고, 실패는 막히는 순간 바로잡기로 돌아가며 끝난다(시각 불확실로 빠진 시도는 한 문항 더)
  for (let i = 0; i < 4; i++) {
    s = await row(`p4-recheck-${i}`)
    if (s.stage !== 'recheck' || !s.href || s.achievement === 'resolved') break
    const ok = await solveItem(s.href, false, RECHECK === 'pass')
    if (RECHECK === 'pass') rec(`④ 다시 확인 ${i + 1} — 정본 주석대로 풀이 → 채점 정답`, ok)
    else if (ok) console.log('  (실패 경로인데 우연히 정답 — 다음 문항으로)')
    rechecked++
  }
  s = await row('p5-after')
  const verdict = s.achievement
  rec('④ 다시 확인 문항 풀이 → 직접 확인 판정 재계산(해소 또는 아직 필요 — 결과 그대로 표시)', rechecked >= 1 && ['resolved', 'need_confirmed', 'checking'].includes(verdict), { rechecked, verdict, stage: s.stage })
  if (RECHECK === 'pass') {
    rec('④ 성공 경로 — 확정에 쓰지 않은 문항 연속 2 정답 → 성취 「해소」 · 요구 = 적용을 마쳤으면 유지(MAINTAIN · 다시 확인) · 아니면 적용(TRANSFER) — 정본 상태 전이', verdict === 'resolved' && rechecked === 2 && s.stage === (transferDone ? 'recheck' : 'transfer'), { verdict, rechecked, stage: s.stage, transferDone })
    rec('④ 해소 판정이 As-Is 영역 근거에 반영됨(적용 뒤와 다름)', s.domains !== domainsRepair)
  } else {
    rec('④ 실패 경로 — 다시 확인에서 막히면 성취 「필요 확인됨」 유지(still_needed)', verdict === 'need_confirmed', { verdict })
  }
  console.log(`최종 단계 ${s.stage} · 성취 ${verdict} — 합성 계정의 실제 풀이 결과일 뿐 학습 효과의 증거가 아니다`)
} finally {
  await browser.close()
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
  console.log(`임시 계정 ${users.length}개 삭제 · 캡처 ${path.relative(ROOT, OUT)}`)
}
console.log(fail ? `FAIL ${fail}` : blocked ? `PASS · BLOCKED ${blocked}(콘텐츠 — 통과로 치지 않는다)` : 'ALL PASS')
process.exit(fail ? 1 : blocked ? 2 : 0)
