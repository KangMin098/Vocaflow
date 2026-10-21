// scripts/design/chapter-marker-check.mjs
//
// 장 표식 줄 표시 분리(A안)를 실제 화면에서 확인한다 — 원본 · DB 는 그대로(읽기만).
//   ① 읽기 화면: 본문에 URL · 제어 문자가 없다 · 「원문 출처」 링크가 장 머리에 있고 href = source_href · 첫 글자 장식이 첫 실제 문단에 ·
//      기준선과 문단 수가 같다(이어읽기 문단 번호 유지 — DOM 의 p 개수로 비교)
//   ② 학습자 도서 미리보기: 표식 있는 책은 표식 숨김 + 출처 링크 · 대조군(RS 없는 「CHAPTER 1」 첫 줄)은 첫 줄이 그대로 보인다
//   ③ Echo: 첫 문장에 URL 이 없다
// 사용: node scripts/design/chapter-marker-check.mjs --base http://localhost:3041 --baseline http://localhost:3000 --out <dir>

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require_ = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = require_('@playwright/test')
const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const BASE = arg('base', 'http://localhost:3041')
const BASELINE = arg('baseline', null)
const outDir = path.resolve(ROOT, arg('out', 'tmp/s4/chapter-marker'))
const TEXT = arg('text', '859e0b09-6dcc-4c70-97ee-7563341bf8d4')
const MARKED_BOOK = arg('marked-book', '66b084a0-72a1-414a-98ea-3c27308772fc')
const PLAIN_BOOK = arg('plain-book', '352a5808-8ec3-4011-aa86-fffacfe20e0d')
const HREF = arg('href', 'https://standardebooks.org/ebooks/charles-dickens/a-christmas-carol/text/chapter-1')
const STATE_FILE = path.join(ROOT, 'apps/web/playwright-auth/.auth-design-capture.json')

const readerProbe = () => {
  const prose = document.querySelector('.reading-prose')
  const ps = [...(prose?.querySelectorAll(':scope > p') ?? [])]
  const visible = ps.filter((p) => !p.hidden)
  const text = prose?.innerText ?? ''
  const src = [...document.querySelectorAll('a')].find((a) => /원문 출처/.test(a.textContent ?? ''))
  const firstVisible = visible[0]
  const cap = firstVisible ? getComputedStyle(firstVisible, '::first-letter').fontSize : null
  return {
    pCount: ps.length,
    visibleP: visible.length,
    hasUrl: /https?:\/\//.test(text),
    hasControl: new RegExp('[\\u001e\\u001f]').test(text),
    firstLine: text.split('\n').find((l) => l.trim())?.trim().slice(0, 60) ?? null,
    sourceHref: src?.getAttribute('href') ?? null,
    sourceTarget: src?.getAttribute('target') ?? null,
    sourceRel: src?.getAttribute('rel') ?? null,
    sourceH: src ? Math.round(src.getBoundingClientRect().height) : null,
    firstLetterSize: cap,
  }
}

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true })
  // Echo 는 마이크 권한 안내 뒤에 문장을 보인다 — 가짜 장치 + 권한으로 연다(녹음 · 기록은 하지 않는다)
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
  const steps = []
  const step = async (name, fn) => {
    try { const r = await fn(); steps.push({ name, ...r }); process.stdout.write(`${r.ok ? '✓' : '✗'} ${name} ${JSON.stringify({ ...r, ok: undefined })}\n`) }
    catch (e) { steps.push({ name, ok: false, error: String(e).slice(0, 140) }); process.stdout.write(`✗ ${name} — ${String(e).slice(0, 90)}\n`) }
  }
  const open = async (base, url, auth = true) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', permissions: ['microphone'], ...(auth && fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : {}) })
    const p = await ctx.newPage()
    await p.goto(`${base}${url}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await p.waitForTimeout(7000)
    // 도서 미리보기 본문은 아래쪽에서 늦게 불러온다 — 있으면 나타날 때까지 기다리고 그 자리로 간다
    if (url.startsWith('/library/books/')) {
      const art = p.locator('article[role="article"]').first()
      await art.waitFor({ timeout: 60_000 }).catch(() => {})
      await art.scrollIntoViewIfNeeded().catch(() => {})
    }
    if (url.endsWith('/echo')) {
      const allow = p.getByRole('button', { name: /마이크 사용 허용/ })
      if (await allow.isVisible().catch(() => false)) { await allow.click(); await p.waitForTimeout(3000) }
    }
    return { ctx, p }
  }

  await step('① 읽기 화면 — URL · 제어 문자 없음 · 출처 링크 · 문단 수 유지', async () => {
    const { ctx, p } = await open(BASE, `/text/${TEXT}?mode=read`)
    const after = await p.evaluate(readerProbe)
    await p.screenshot({ path: path.join(outDir, 'reader-after.png') })
    await ctx.close()
    let before = null
    if (BASELINE) {
      const b = await open(BASELINE, `/text/${TEXT}?mode=read`)
      before = await b.p.evaluate(readerProbe)
      await b.p.screenshot({ path: path.join(outDir, 'reader-before.png') })
      await b.ctx.close()
    }
    const ok = !after.hasUrl && !after.hasControl && after.sourceHref === HREF && after.sourceTarget === '_blank' && /noopener/.test(after.sourceRel ?? '')
      && (after.sourceH ?? 0) >= 44 && (!before || before.pCount === after.pCount) && /^Marley/.test(after.firstLine ?? '')
    return { ok, before: before && { pCount: before.pCount, hasUrl: before.hasUrl, firstLine: before.firstLine }, after }
  })
  await step('② 미리보기(표식 있는 책) — 표식 숨김 · 출처 링크', async () => {
    const { ctx, p } = await open(BASE, `/library/books/${MARKED_BOOK}?preview=1`)
    const r = await p.evaluate(() => {
      const art = document.querySelector('article[role="article"]')
      const t = art?.innerText ?? ''
      const src = [...(art?.querySelectorAll('a') ?? [])].find((a) => /원문 출처/.test(a.textContent ?? ''))
      return { found: Boolean(art), hasUrlInBody: /https?:\/\/standardebooks/.test(t.replace(src?.textContent ?? '', '')), sourceHref: src?.getAttribute('href') ?? null }
    })
    await p.screenshot({ path: path.join(outDir, 'preview-marked.png') })
    await ctx.close()
    return { ok: r.found && !r.hasUrlInBody && r.sourceHref === HREF, ...r }
  })
  await step('② 미리보기(대조군 — RS 없는 「CHAPTER 1」) — 첫 줄 그대로', async () => {
    const { ctx, p } = await open(BASE, `/library/books/${PLAIN_BOOK}?preview=1`)
    const r = await p.evaluate(() => {
      const art = document.querySelector('article[role="article"]')
      const firstP = art?.querySelector('p')?.innerText.trim().slice(0, 40) ?? null
      const src = [...(art?.querySelectorAll('a') ?? [])].find((a) => /원문 출처/.test(a.textContent ?? ''))
      return { found: Boolean(art), firstP, sourceLink: Boolean(src) }
    })
    await p.screenshot({ path: path.join(outDir, 'preview-plain.png') })
    await ctx.close()
    return { ok: r.found && /^CHAPTER 1/.test(r.firstP ?? '') && !r.sourceLink, ...r }
  })
  await step('③ Echo — 첫 문장에 URL 없음', async () => {
    const { ctx, p } = await open(BASE, `/text/${TEXT}/echo`)
    const r = await p.evaluate(() => { const t = document.querySelector('main')?.innerText ?? ''; return { gate: /마이크 권한이 필요/.test(t), hasUrl: /standardebooks\.org/.test(t), head: t.slice(0, 160) } })
    await p.screenshot({ path: path.join(outDir, 'echo-after.png') })
    await ctx.close()
    // 문장이 실제로 화면에 보일 때만 통과 — 음성 모델 내려받는 중이면 「URL 없음」은 증거가 아니다
    const sentenceShown = /Marley was dead/.test(r.head) || (await p.getByText(/Marley was dead/).count()) > 0
    return { ok: !r.gate && !r.hasUrl && sentenceShown, sentenceShown, ...r }
  })
  await browser.close()
  fs.writeFileSync(path.join(outDir, '_chapter-marker.json'), JSON.stringify({ base: BASE, baseline: BASELINE, at: new Date().toISOString(), steps }, null, 2))
  console.log(`\n${steps.filter((s) => s.ok).length}/${steps.length}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
