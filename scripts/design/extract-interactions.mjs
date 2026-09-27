#!/usr/bin/env node
// scripts/design/extract-interactions.mjs
//
// 참조 사이트의 **팝업 · 상호작용 기록**(DD-68) — 구간·컴포넌트 목록이 못 보는 「열었을 때」의 모습.
// 시나리오마다 실제로 누르고/올리고/입력한 뒤 새로 생긴 층을 잰다:
//   컴포넌트 이름 · 역할(role/aria-modal) · 크기 · 포커스 가능한 요소 수 · Esc 로 닫히는가 · 모션 이름.
//
//   node scripts/design/extract-interactions.mjs
//
// 산출: docs/design/refs/tines/interactions.json · interactions-summary.md (구조·수치만)
//       스크린샷은 tmp/tines-capture/interactions/ (gitignore — 참조 원본은 저장소에 두지 않는다)

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium, dismissOverlays } from './lib/ref-page.mjs'

const OUT = path.join(ROOT, 'docs/design/refs/tines')
const SHOTS = path.join(ROOT, 'tmp/tines-capture/interactions')
const BASE = 'https://www.tines.com'
fs.mkdirSync(SHOTS, { recursive: true })

/** 지금 화면에서 가장 위에 뜬(새로 생긴) 층을 잰다. before = 열기 전 요소 집합. */
function measureLayer([beforeIds, staticSel]) {
  const MOD = /([A-Z][A-Za-z0-9]+)-module-scss-module__/g
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 30 && r.height > 30 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 }
  const all = [...document.querySelectorAll('body *')]
  const was = new Set(beforeIds)
  const fresh = staticSel ? [] : all.filter((e) => !was.has(e.dataset.vfSeen) && vis(e))
  // 새 요소 중 가장 바깥(다른 새 요소 안에 들지 않은) 것들 가운데 가장 큰 것
  const roots = fresh.filter((e) => !fresh.includes(e.parentElement))
  let best = staticSel && document.querySelector(staticSel) ? { e: document.querySelector(staticSel), a: 1 } : null
  for (const e of roots) { const r = e.getBoundingClientRect(); const a = r.width * r.height; if (!best || a > best.a) best = { e, a } }
  // 새 요소가 없으면(같은 DOM 을 보이기만 하는 패턴) aria-expanded/open 인 것의 대상으로
  if (!best) {
    const opened = document.querySelector('[role="dialog"]:not([hidden]), [aria-modal="true"], details[open], [aria-expanded="true"]')
    if (opened) { const tgt = opened.getAttribute('aria-controls') ? document.getElementById(opened.getAttribute('aria-controls')) : opened; if (tgt) best = { e: tgt, a: 0 } }
  }
  if (!best) return { found: false }
  const el = best.e, r = el.getBoundingClientRect()
  const names = new Set(); for (const x of [el, ...el.querySelectorAll('*')]) { const c = typeof x.className === 'string' ? x.className : x.getAttribute('class') || ''; for (const m of c.matchAll(MOD)) names.add(m[1]) }
  const anim = new Set(); for (const x of [el, ...el.querySelectorAll('*')].slice(0, 400)) { const a = getComputedStyle(x).animationName; if (a && a !== 'none') anim.add(a.replace(/^.*__/, '')) }
  const trans = getComputedStyle(el).transitionProperty
  return {
    found: true, tag: el.tagName.toLowerCase(), role: el.getAttribute('role'), modal: el.getAttribute('aria-modal'),
    x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
    components: [...names].slice(0, 12),
    focusable: el.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])').length,
    links: el.querySelectorAll('a[href]').length, inputs: el.querySelectorAll('input, select, textarea').length,
    headings: [...el.querySelectorAll('h1,h2,h3,h4,legend,label')].slice(0, 8).map((h) => h.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)),
    animations: [...anim], transition: trans !== 'all' && trans !== 'none' ? trans : null,
    backdrop: [...document.querySelectorAll('body *')].some((x) => { const s = getComputedStyle(x); const rr = x.getBoundingClientRect(); return rr.width >= innerWidth * 0.95 && rr.height >= innerHeight * 0.9 && s.position === 'fixed' && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && x !== el }),
  }
}
// 열기 전에 **보이던** 요소만 표시한다 — 숨어 있다가 보이게 되는 패널도 「새 층」으로 잡힌다.
const markSeen = (page) => page.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 30 && r.height > 30 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 }
  let i = 0; const ids = []
  for (const e of document.querySelectorAll('body *')) { e.dataset.vfSeen = String(i++); if (vis(e)) ids.push(e.dataset.vfSeen) }
  return ids
})

/** 시나리오: [key, 설명, url, viewport, 행동(page) → 층을 연다] */
const SCENARIOS = [
  ['cookie-customize', '쿠키 배너 → 설정', '/', 1440, async (p) => { const b = p.getByRole('button', { name: /customi[sz]e/i }).first(); await b.waitFor({ state: 'visible', timeout: 15000 }); await b.click() }, { keepCookie: true }],
  ['mega-product', '헤더 Product 메뉴', '/', 1440, async (p) => { await p.locator('header').getByRole('button', { name: 'Product' }).first().click() }],
  ['search-typed', '검색 → "slack" 입력', '/', 1440, async (p) => { await p.locator('header').getByRole('button', { name: /search/i }).first().click(); await p.waitForTimeout(500); await p.keyboard.type('slack', { delay: 60 }); await p.waitForTimeout(1500) }],
  ['usecase-tab-2', '홈 팀 탭 두 번째로 전환', '/', 1440, async (p) => { const t = p.getByRole('tab'); if (await t.count() > 1) { await t.nth(1).scrollIntoViewIfNeeded(); await t.nth(1).click() } }],
  ['faq-open', '3B FAQ 첫 질문 펼치기', '/3b/', 1440, async (p) => { const q = p.getByText('Frequently asked questions').locator('xpath=ancestor::section[1]').locator('button, summary').filter({ visible: true }).first(); await q.scrollIntoViewIfNeeded(); await q.click() }],
  ['video-play', '3B 영상 재생 단추', '/3b/', 1440, async (p) => { const b = p.getByRole('button', { name: /play|watch/i }).first(); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForTimeout(1500) }],
  ['contact-form', '문의 폼(열린 상태 그대로)', '/contact/', 1440, async () => {}, { staticSel: 'form' }],
  ['events-filter', '이벤트 필터 하나 켜기', '/events/', 1440, async (p) => { const c = p.locator('label:has(input[type="checkbox"]), [role="checkbox"], button[aria-pressed]').filter({ visible: true }).first(); if (await c.count()) { await c.scrollIntoViewIfNeeded(); await c.click() } }],
  ['mobile-menu', '390 햄버거', '/', 390, async (p) => { await p.locator('header button').last().click() }],
  ['mobile-submenu', '390 햄버거 → Product 하위', '/', 390, async (p) => { await p.locator('header button').last().click(); await p.waitForTimeout(600); const b = p.getByRole('button', { name: 'Product' }).first(); if (await b.count()) await b.click() }],
  ['not-found', '404 화면', '/this-page-does-not-exist-vf/', 1440, async () => {}, { staticSel: 'main, body > div' }],
]

const browser = await chromium.launch()
const results = []
for (const [key, label, url, vw, act, opt = {}] of SCENARIOS) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 500 ? 844 : 900 }, isMobile: vw < 500, hasTouch: vw < 500 })
  const page = await ctx.newPage()
  try {
    try { await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45_000 }) }
    catch { await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 60_000 }); await page.waitForTimeout(4000) }
    await page.waitForTimeout(1200)
    if (!opt.keepCookie) { await dismissOverlays(page); await page.evaluate(() => document.getElementById('tines-cookie-root')?.remove()) }
    const before = await markSeen(page)
    await act(page)
    await page.waitForTimeout(900)
    const layer = await page.evaluate(measureLayer, [before, opt.staticSel ?? null])
    await page.screenshot({ path: path.join(SHOTS, `${key}.png`) })
    // Esc 로 닫히는가
    let escCloses = null
    if (layer.found && !['contact-form', 'not-found'].includes(key)) {
      await page.keyboard.press('Escape'); await page.waitForTimeout(500)
      escCloses = await page.evaluate(({ x, y, w, h }) => { const e = document.elementFromPoint(x + w / 2, y + Math.min(h / 2, 200)); return !e || !e.closest('[data-vf-seen]') || getComputedStyle(e).visibility === 'hidden' }, layer).catch(() => null)
    }
    results.push({ key, label, url, viewport: vw, ...layer, escCloses })
    console.log(`${key.padEnd(18)} ${layer.found ? `${layer.w}×${layer.h} ${layer.role ?? layer.tag} 포커스 ${layer.focusable} 입력 ${layer.inputs} · ${layer.components.slice(0, 4).join(' ')}` : '층 없음'}`)
  } catch (e) {
    results.push({ key, label, url, viewport: vw, found: false, error: e.message.split('\n')[0] })
    console.log(`${key.padEnd(18)} FAIL ${e.message.split('\n')[0]}`)
  }
  await ctx.close()
}
await browser.close()

const data = { generatedBy: 'scripts/design/extract-interactions.mjs', generatedAt: new Date().toISOString().slice(0, 10), results }
fs.writeFileSync(path.join(OUT, 'interactions.json'), JSON.stringify(data, null, 2) + '\n')
const L = ['# 참조 사이트 — 팝업 · 상호작용 기록', '',
  `> 생성 \`scripts/design/extract-interactions.mjs\` · ${data.generatedAt} · 손으로 고치지 말 것. 구조·수치만 — 스크린샷은 \`tmp/tines-capture/interactions/\`(커밋 안 함).`, '',
  '| 시나리오 | 무엇을 했나 | 열린 층 | 크기 | 역할 · 모달 | 포커스 · 입력 | Esc 닫힘 | 배경막 | 모션 | 컴포넌트 | 제목·라벨 |', '|---|---|---|---|---|---|---|---|---|---|---|']
for (const r of results) {
  if (!r.found) { L.push(`| ${r.key} | ${r.label} | ${r.error ? `실패: ${r.error.slice(0, 60)}` : '층 없음'} | | | | | | | | |`); continue }
  L.push(`| ${r.key} | ${r.label} | \`${r.tag}\` | ${r.w}×${r.h} @${r.x},${r.y} | ${r.role ?? '—'}${r.modal ? ' · modal' : ''} | ${r.focusable} · ${r.inputs} | ${r.escCloses === null ? '—' : r.escCloses ? '○' : '✗'} | ${r.backdrop ? '○' : '—'} | ${[...r.animations, r.transition].filter(Boolean).slice(0, 3).join(', ') || '—'} | ${r.components.slice(0, 5).join(' · ')} | ${r.headings.slice(0, 4).join(' / ').replace(/\|/g, '/')} |`)
}
fs.writeFileSync(path.join(OUT, 'interactions-summary.md'), L.join('\n') + '\n')
console.log(`\n${results.filter((r) => r.found).length}/${results.length} 층 기록`)
