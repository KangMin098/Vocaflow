// scripts/design/reader-popover-check.mjs
//
// 읽기 화면(/text/[id])의 팝오버를 실제로 열고 껍데기를 잰다 — learner-tines-audit S3 ④ 읽기 · 팝오버 6종 V 근거.
//   장 목록 · 타이포 설정 · 다음 단계 추천 · 단어 누르기(풀이/회상 카드) — 모서리 · 테두리 · 그림자 · 크기 · Esc 닫힘
//   타이포 설정: 열기만 해서는 본문 글자 크기가 그대로 · 고르면 바뀜 · 새로고침 후 유지 · 「기본」으로 되돌림
// 사용: node scripts/design/reader-popover-check.mjs --base http://localhost:3041 --text <texts.id> --out <dir> [--width 1440] [--theme light|dark]

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
const TEXT = arg('text', '859e0b09-6dcc-4c70-97ee-7563341bf8d4')
const outDir = path.resolve(ROOT, arg('out', 'tmp/s3/reader-popover'))
const width = Number(arg('width', '1440'))
const theme = arg('theme', 'light')
const STATE_FILE = path.join(ROOT, 'apps/web/playwright-auth/.auth-design-capture.json')

/** 화면에 보이는 가장 위 대화상자(닫힌 곁 패널 · aria-hidden 제외)의 껍데기 */
const probeTop = () => {
  const all = [...document.querySelectorAll('[role="dialog"]')].filter((d) => {
    const r = d.getBoundingClientRect(); const cs = getComputedStyle(d)
    return r.width > 0 && r.height > 0 && r.right > 1 && r.left < innerWidth - 1 && r.bottom > 1 && r.top < innerHeight - 1
      && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5 && d.getAttribute('aria-hidden') !== 'true'
  })
  const d = all[all.length - 1]
  if (!d) return null
  const cs = getComputedStyle(d); const r = d.getBoundingClientRect()
  return { label: d.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height), radius: cs.borderRadius, border: `${cs.borderTopWidth} ${cs.borderTopColor}`, shadow: cs.boxShadow.slice(0, 90), bg: cs.backgroundColor }
}
const readerSize = (p) => p.evaluate(() => getComputedStyle(document.querySelector('.reading-prose') ?? document.body).fontSize)

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme === 'dark' ? 'dark' : 'light', reducedMotion: 'reduce', ...(fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : {}) })
  const p = await ctx.newPage()
  await p.addInitScript((t) => { try { localStorage.setItem('vocaflow-theme', t) } catch {} }, theme)
  const go = async () => { await p.goto(`${BASE}/text/${TEXT}?mode=read`, { waitUntil: 'domcontentloaded', timeout: 120_000 }); await p.waitForTimeout(7000) }
  await go()
  // 이전 실행이 남긴 글자 설정을 지워 기본값에서 시작한다
  await p.evaluate(() => { try { localStorage.removeItem('vocaflow-reader-type') } catch {} })
  await go()

  const steps = []
  const step = async (name, fn) => {
    try { const r = await fn(); steps.push({ name, ...r }); process.stdout.write(`${r.ok ? '✓' : '✗'} ${name} ${JSON.stringify({ ...r, ok: undefined })}\n`) }
    catch (e) { steps.push({ name, ok: false, error: String(e).slice(0, 140) }); process.stdout.write(`✗ ${name} — ${String(e).slice(0, 90)}\n`) }
  }
  const openMeasureEsc = async (id, open) => {
    await open()
    await p.waitForTimeout(900)
    const shell = await p.evaluate(probeTop)
    await p.screenshot({ path: path.join(outDir, `${id}@${width}-${theme}.png`) })
    await p.keyboard.press('Escape')
    await p.waitForTimeout(700)
    const closed = !(await p.evaluate(probeTop))
    return { shell, closed }
  }

  await step('장 목록(메뉴) — 열기 · 껍데기 · Esc', async () => {
    const r = await openMeasureEsc('chapter-nav', () => p.getByRole('button', { name: /목차/ }).first().click())
    return { ok: Boolean(r.shell) && r.shell.radius === '10px' && r.shell.shadow === 'none' && r.closed, ...r }
  })
  await step('타이포 설정(메뉴) — 열기만 해서는 본문 그대로', async () => {
    const before = await readerSize(p)
    await p.getByRole('button', { name: '타이포 설정' }).click()
    await p.waitForTimeout(900)
    const during = await readerSize(p)
    const shell = await p.evaluate(probeTop)
    await p.screenshot({ path: path.join(outDir, `type@${width}-${theme}.png`) })
    return { ok: before === during && before === '15px' && shell?.radius === '10px', before, during, shell }
  })
  await step('타이포 설정 — 「크게」 고르면 19px · Esc 닫힘', async () => {
    await p.getByRole('button', { name: '글자 크기 크게' }).click()
    await p.waitForTimeout(500)
    const after = await readerSize(p)
    await p.keyboard.press('Escape')
    await p.waitForTimeout(500)
    const closed = !(await p.evaluate(probeTop))
    return { ok: after === '19px' && closed, after, closed }
  })
  await step('타이포 설정 — 새로고침 후 유지 → 「기본」으로 되돌림', async () => {
    await go()
    const kept = await readerSize(p)
    await p.getByRole('button', { name: '타이포 설정' }).click()
    await p.waitForTimeout(600)
    const pressed = await p.getByRole('button', { name: '글자 크기 크게' }).getAttribute('aria-pressed')
    await p.getByRole('button', { name: '글자 크기 기본' }).click()
    await p.waitForTimeout(400)
    const reset = await readerSize(p)
    await p.keyboard.press('Escape')
    return { ok: kept === '19px' && pressed === 'true' && reset === '15px', kept, pressed, reset }
  })
  await step('다음 단계 추천(카드) — 열기 · 껍데기 · Esc', async () => {
    const r = await openMeasureEsc('sparkle', () => p.getByRole('button', { name: '다음 단계 추천' }).click())
    return { ok: Boolean(r.shell) && r.shell.radius === '16px' && r.shell.shadow !== 'none' && r.closed, ...r }
  })
  await step('단어 누르기(카드: 풀이 또는 회상) — 열기 · 껍데기 · Esc', async () => {
    const r = await openMeasureEsc('word', async () => {
      const word = p.locator('.reading-prose span.cursor-pointer').nth(5)
      await word.scrollIntoViewIfNeeded()
      await word.click()
    })
    return { ok: Boolean(r.shell) && r.shell.radius === '16px' && r.closed, ...r }
  })
  await browser.close()
  fs.writeFileSync(path.join(outDir, `_reader@${width}-${theme}.json`), JSON.stringify({ base: BASE, sha: arg('sha', 'unknown'), width, theme, at: new Date().toISOString(), steps }, null, 2))
  console.log(`\n${steps.filter((s) => s.ok).length}/${steps.length}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
