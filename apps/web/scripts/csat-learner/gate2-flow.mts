// apps/web/scripts/csat-learner/gate2-flow.mts
//
// **Gate 2 · 학습 화면 ①②③ — 375px 진짜 브라우저로 전 흐름.** (docs/csat-learner-brief.md [E])
//
// 판정(지시문 [F]):
//   F3 정오 확인 전 DOM 에 분석 텍스트 0건 — 제출 전 DOM 에 해설 문자열(나중에 API 가 줄 것)이 하나도 없다
//   F4 375px 에서 본문 ≥ 18px · 가로 스크롤 없음 · 선지 터치 높이 ≥ 48px
//   F5 <table> 0 · 탭/모드/필터 컴포넌트 0(role=tab · tablist · 라디오 그룹 필터)
//   F6 근거 문장 탭 → 설명 펼침 · 오답 카드 탭 → 관련 문장으로 스크롤(뷰포트 안 + 강조)
// 그리고 ① 풀기 · ② 이해 · ③ 한 줄 스크린샷 3장.
//
// ⚠️ 스크린샷에는 **평가원 지문이 찍힌다**(학습자 PDF 에서 뽑은 글). 저장소에 두지 않는다 —
//    `test-results-csat-learner/`(gitignore)에 쓰고, 리포트에는 경로와 수치만 남긴다.
//
//   npx tsx scripts/csat-learner/gate2-flow.mts [--base http://localhost:3000] [--items 2026-18,2026-38]

import fs from 'node:fs'
import path from 'node:path'

import { chromium, type Page } from '@playwright/test'

import { REPORTS, arg, localPapers, writeJson } from './env.mts'

const BASE = arg('base') ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const ITEMS = (arg('items') ?? '2026-18,2026-38').split(',')
const STATE = 'playwright-auth/.auth-csat-learner.json'
const SHOTS = path.resolve('test-results-csat-learner')
const EXAM = ITEMS[0].split('-')[0]

const anchors = JSON.parse(fs.readFileSync(path.resolve(`src/lib/csat/anchor-data/${EXAM}.json`), 'utf8'))
const paper = localPapers().get(anchors.sha256)
if (!paper) throw new Error(`${EXAM} 원본이 없다 — Gate 2 는 실제 PDF 가 필요하다`)

fs.mkdirSync(SHOTS, { recursive: true })

type Check = { id: string; pass: boolean; detail: string }
const checks: Check[] = []
const check = (id: string, pass: boolean, detail: string) => {
  checks.push({ id, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${detail}`)
}

async function layoutFacts(page: Page) {
  return page.evaluate(() => {
    const passage = document.querySelector<HTMLElement>('[data-testid="passage"]')
    const choices = [...document.querySelectorAll<HTMLElement>('[data-choice]')]
    return {
      passageFont: passage ? parseFloat(getComputedStyle(passage).fontSize) : 0,
      passageLineHeight: passage ? parseFloat(getComputedStyle(passage).lineHeight) / parseFloat(getComputedStyle(passage).fontSize) : 0,
      passageWidthCh: passage
        ? (() => {
            // 한 줄에 들어가는 글자 수 어림 — 폭 / '0' 폭(ch). 탐침은 문단(<p>) 안의 인라인이어야 한다
            // (flex 컨테이너에 바로 붙이면 한 줄 전체 폭으로 늘어난다)
            const host = passage.querySelector('p') ?? passage
            const probe = document.createElement('span')
            probe.textContent = '0'
            probe.style.display = 'inline-block'
            host.appendChild(probe)
            const ch = probe.getBoundingClientRect().width
            probe.remove()
            return host.getBoundingClientRect().width / ch
          })()
        : 0,
      hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      minChoiceHeight: choices.length ? Math.min(...choices.map((c) => c.getBoundingClientRect().height)) : 0,
      tables: document.querySelectorAll('main table').length,
      tabs: document.querySelectorAll('main [role="tab"], main [role="tablist"]').length,
      filters: document.querySelectorAll('main [role="radiogroup"], main select').length,
    }
  })
}

const browser = await chromium.launch()
const ctx = await browser.newContext({
  storageState: STATE,
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

// 깨끗한 기기에서 시작 — 기록·추출본을 지운다(서버 기록도 — 기기 기록과 합쳐진다)
await page.request.delete(`${BASE}/api/csat/session/record`)
await page.goto(`${BASE}/csat/progress`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
await page.evaluate(
  () =>
    new Promise<void>((res) => {
      const r = indexedDB.deleteDatabase('vocaflow-csat')
      r.onsuccess = r.onerror = r.onblocked = () => res()
    }),
)

const set = ITEMS.join(',')
const kinds = ITEMS.map(() => 'order').join(',')
await page.goto(`${BASE}/csat/session?set=${encodeURIComponent(set)}&k=${kinds}`, {
  waitUntil: 'domcontentloaded',
  timeout: 180_000,
})

// 문제지가 없는 기기 — 그 자리에서 놓는다
await page.getByTestId('paper-input').waitFor({ state: 'attached', timeout: 60_000 })
await page.getByTestId('paper-input').setInputFiles(paper)
await page.getByTestId('item-screen').waitFor({ timeout: 90_000 })

const results: Record<string, unknown>[] = []
for (let k = 0; k < ITEMS.length; k += 1) {
  const slug = ITEMS[k]
  await page.getByTestId('item-screen').waitFor({ timeout: 60_000 })
  await page.waitForSelector('[data-testid="item-screen"][data-phase="solve"]')

  // 이 문항의 해설 — 판정용으로만 API 에서 따로 받는다(화면 DOM 과 대조)
  const reveal = (await (
    await page.request.post(`${BASE}/api/csat/session/reveal`, { data: { item: slug } })
  ).json()) as {
    answer: number
    evidence: { text: string }
    why_correct: { text: string }
    distractors: { n: number; line: string }[]
    one_liner: string | null
  }

  // ── F3 — 제출 전 DOM 에 해설이 없다 ────────────────────────────────
  const before = await page.evaluate(() => document.body.innerText)
  // 해설은 지문을 **인용**한다(「I am encouraging you to …」) — 인용 조각은 지문에 당연히 있으므로
  // 대조하지 않는다. 우리가 쓴 **한글 서술** 조각만 본다(한글이 절반 넘는 16자 창의 첫 자리).
  const koWindow = (s: string) => {
    for (let i = 0; i + 16 <= s.length; i += 1) {
      const w = s.slice(i, i + 16)
      if ((w.match(/[가-힣]/g) ?? []).length >= 8) return w
    }
    return ''
  }
  const probes = [reveal.evidence.text, reveal.why_correct.text, ...reveal.distractors.map((d) => d.line), reveal.one_liner ?? '']
    .map(koWindow)
    .filter(Boolean)
  const leaked = probes.filter((p) => before.includes(p))
  const marks = await page.locator('[data-note-kind], [data-testid="sentence-note"], [data-state="answer"], [data-testid="verdict"]').count()
  check(
    `F3 ${slug}`,
    leaked.length === 0 && marks === 0,
    `해설 조각 ${probes.length}개 중 DOM 노출 ${leaked.length} · 표식 요소 ${marks}${leaked.length ? ` · 노출: ${leaked.join(' / ')}` : ''}`,
  )

  // ── F4 · F5 (풀기 화면) ────────────────────────────────────────────
  const f = await layoutFacts(page)
  check(
    `F4 ${slug}`,
    f.passageFont >= 18 && f.hScroll <= 0 && f.minChoiceHeight >= 48,
    `본문 ${f.passageFont}px · 줄간격 ${f.passageLineHeight.toFixed(2)} · 줄 폭 ≈${f.passageWidthCh.toFixed(0)}ch · 가로 넘침 ${f.hScroll}px · 선지 최소 ${f.minChoiceHeight.toFixed(0)}px`,
  )
  check(`F5 ${slug}`, f.tables === 0 && f.tabs === 0 && f.filters === 0, `table ${f.tables} · tab ${f.tabs} · 필터 ${f.filters}`)
  if (k === 0) await page.screenshot({ path: path.join(SHOTS, '1-solve.png'), fullPage: false })

  // ── 답하기 — 첫 문항은 **틀린 답**을 고른다(오답 흐름을 보려고) ──────────
  const wrong = [1, 2, 3, 4, 5].find((n) => n !== reveal.answer)!
  const pick = k === 0 ? wrong : reveal.answer
  await page.locator(`[data-choice="${pick}"]`).click()
  await page.waitForSelector('[data-testid="item-screen"][data-phase="understand"]', { timeout: 60_000 })
  await page.getByTestId('verdict').waitFor()
  const answerState = await page.locator(`[data-choice="${reveal.answer}"]`).getAttribute('data-state')
  check(`정오 ${slug}`, answerState === 'answer', `정답 카드 상태 ${answerState}`)

  // ── F6-a — 근거 문장 탭 → 설명 펼침 ───────────────────────────────
  const ev = page.locator('[data-note-kind="evidence"]').first()
  const hasEv = (await ev.count()) > 0
  if (hasEv) {
    await ev.click()
    const note = page.getByTestId('sentence-note')
    await note.waitFor({ timeout: 5_000 })
    const txt = (await note.innerText()).trim()
    const expanded = await ev.getAttribute('aria-expanded')
    // 문장 단추가 문단을 끊지 않는가 — 단추가 줄 하나를 통째로 차지하면 문장마다 새 줄이 된다
    const inline = await ev.evaluate((el) => getComputedStyle(el).display)
    check(
      `F6a ${slug}`,
      expanded === 'true' && txt.length > 10 && inline === 'inline',
      `근거 문장 aria-expanded=${expanded} · 설명 ${txt.length}자 · 문장 display=${inline}`,
    )
    await page.waitForTimeout(300) // 펼침 페이드(150ms)가 끝난 뒤 찍는다
    if (k === 0) await page.screenshot({ path: path.join(SHOTS, '2-understand.png'), fullPage: false })
    await ev.click()
    check(`F6a 접힘 ${slug}`, (await page.getByTestId('sentence-note').count()) === 0, '다시 누르면 접힌다')
  } else {
    check(`F6a ${slug}`, false, '근거 밑줄 문장이 없다')
  }

  // ── F6-b — 오답 카드 탭 → 한 줄 + 관련 문장으로 스크롤·강조 ────────────
  // 설명 자리가 있는 오답을 고른다(없으면 첫 오답)
  const target = await page.evaluate((ans) => {
    for (const n of [1, 2, 3, 4, 5]) {
      if (n === ans) continue
      const b = document.querySelector<HTMLButtonElement>(`[data-choice="${n}"]`)
      if (b && !b.disabled) return n
    }
    return null
  }, reveal.answer)
  if (target !== null) {
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }))
    await page.locator(`[data-choice="${target}"]`).click()
    await page.getByTestId('choice-note').waitFor({ timeout: 5_000 })
    // 스크롤이 끝나기를 기다린다(부드러운 스크롤)
    await page.waitForTimeout(900)
    const flash = await page.evaluate(() => {
      const el = [...document.querySelectorAll<HTMLElement>('[data-sentence]')].find((e) => /ju-light/.test(e.className))
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, vh: window.innerHeight }
    })
    const inView = flash ? flash.bottom > 0 && flash.top < flash.vh : false
    check(`F6b ${slug}`, inView, flash ? `강조 문장 top ${flash.top.toFixed(0)} / 뷰포트 ${flash.vh}` : `오답 ${target} 의 관련 문장을 못 찾음`)
    if (!inView) {
      await page.screenshot({ path: path.join(SHOTS, `fail-${slug}.png`), fullPage: true })
      console.log('  화면 상태:', await page.getByTestId('item-screen').getAttribute('data-phase').catch(() => '없음'), '· 오류:', errors.slice(-3))
    }
  }

  // ── ③ 한 줄 ─────────────────────────────────────────────────────────
  await page.getByTestId('one-line').scrollIntoViewIfNeeded()
  if (k === 0) await page.screenshot({ path: path.join(SHOTS, '3-oneline.png'), fullPage: false })
  const oneLine = ((await page.getByTestId('one-line').locator('p').first().textContent()) ?? '').trim()
  check(`③ ${slug}`, oneLine.length > 5 && oneLine.length <= 80, `한 줄 ${oneLine.length}자`)
  await page.getByTestId(k === 0 ? 'mark-confused' : 'mark-ok').click()
  results.push({ slug, picked: pick, answer: reveal.answer })
}

await page.getByTestId('finish').waitFor({ timeout: 30_000 })
const finishText = await page.getByTestId('finish').innerText()
check('끝 화면', /오늘 끝/.test(finishText) && /다음 복습/.test(finishText), finishText.replace(/\s+/g, ' ').slice(0, 80))
await page.screenshot({ path: path.join(SHOTS, '4-finish.png'), fullPage: false })

// 기록이 기기에 남았나 — 헷갈려요 1 → 복습 1
const rec = await page.evaluate(
  () =>
    new Promise<{ attempts: number; reviews: number } | null>((res) => {
      const r = indexedDB.open('vocaflow-csat')
      r.onsuccess = () => {
        const db = r.result
        const g = db.transaction('record').objectStore('record').get('me')
        g.onsuccess = () => res(g.result ? { attempts: g.result.attempts.length, reviews: g.result.reviews.length } : null)
        g.onerror = () => res(null)
      }
      r.onerror = () => res(null)
    }),
)
check('기록 저장', rec?.attempts === ITEMS.length && rec?.reviews === 1, JSON.stringify(rec))

// 「Failed to fetch RSC payload」 — 셸 링크의 프리페치가 다음 `goto` 에 끊긴 것(프로덕션에서만 보인다 ·
// Next 가 브라우저 이동으로 대체한다). 흐름의 오류가 아니다 — gate3 와 같은 판단.
const real = errors.filter((e) => !/Download the React DevTools|favicon|analytics|Failed to fetch RSC payload/i.test(e))
check('콘솔 에러 0', real.length === 0, real.slice(0, 3).join(' | ') || '없음')

await browser.close()

const pass = checks.every((c) => c.pass)
writeJson(path.join(REPORTS, 'gate2-report.json'), {
  gate: 2,
  at: new Date().toISOString(),
  base: BASE,
  viewport: '375x812',
  items: ITEMS,
  pass,
  checks,
  results,
  shots: ['1-solve.png', '2-understand.png', '3-oneline.png', '4-finish.png'].map((f) => `apps/web/test-results-csat-learner/${f}`),
  note: '스크린샷에 평가원 지문이 찍혀 저장소 밖(gitignore)에 둔다',
})
console.log(`\nGate 2 → ${pass ? 'PASS' : 'FAIL'} (${checks.filter((c) => c.pass).length}/${checks.length})`)
process.exit(pass ? 0 : 1)
