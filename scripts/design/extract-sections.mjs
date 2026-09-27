#!/usr/bin/env node
// scripts/design/extract-sections.mjs
//
// 참조 사이트의 **구간(section) 전수 목록** — 템플릿별 대표 페이지를 열어 띠마다 컴포넌트 이름 · 제목 ·
// 높이 · 바탕색 · 격자 · 상호작용 종류를 뽑고, 팝업류(메가메뉴 · 검색 · 쿠키 · 모바일 메뉴)를 따로 연다(DD-68).
//
//   node scripts/design/extract-sections.mjs
//   node scripts/design/extract-sections.mjs --only home,pricing
//
// 산출: docs/design/refs/tines/sections.json · sections-summary.md (구조·수치만 — 이미지 0 · 본문 0,
//       제목은 80자까지). 매핑(어느 우리 화면에 대응하나)은 사람이 쓰는 docs/design/tines-mapping.md 가 맡는다.
//
// 구간 판정: 이름 붙은 컴포넌트(CSS 모듈 class `Name-module-scss-module__…`) 중 높이 ≥120px · 폭 ≥60% 인
// 가장 바깥 블록. 단 문서 높이의 70% 이상을 덮는 블록은 「페이지 틀」로 보고 한 겹 안으로 들어간다.

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium, dismissOverlays, settle } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const ONLY = arg('--only', null)?.split(',')
const OUT = path.resolve(ROOT, arg('--out', 'docs/design/refs/tines'))
const BASE = 'https://www.tines.com'

/** 템플릿 → 대표 URL. 상세 페이지는 사이트맵에서 고른 실재 주소다(2026-09-21). */
const PAGES = [
  ['home', '/'],
  ['3b', '/3b/'],
  ['pricing', '/pricing/'],
  ['customers', '/customers/'],
  ['case-study', '/case-studies/'],
  ['solutions', '/solutions/it/'],
  ['solutions-2', '/solutions/security/'],
  ['industry', '/public-sector/'],
  ['enterprise', '/enterprise/'],
  ['library', '/library/'],
  ['stories', '/stories/'],
  ['blog', '/blog/'],
  ['university', '/university/'],
  ['events', '/events/'],
  ['webinars', '/webinars/'],
  ['careers', '/careers/'],
  ['contact', '/contact/'],
  ['partners', '/partners/'],
  ['newsroom', '/newsroom/'],
  ['podcast', '/podcast/'],
  ['security', '/security/'],
  ['story-scroll', '/history-and-future-of-workflows/'],
  ['capability-matrix', '/workflow-capability-matrix/'],
  ['legal', '/legal/'],
  ['privacy', '/privacy/'],
  ['not-found', '/this-page-does-not-exist-vf/'],
]
/**
 * 상세 템플릿 — 사이트맵의 실재 주소(2026-09-21). 목록에서 첫 링크를 따라가면 분류 목록(/blog/news/ ·
 * /case-studies/all/)을 잡는 일이 있어 직접 적는다.
 */
const DETAIL = {
  '3b': '/3b/examples/product-feedback-deduplication-system-with-arr-weighted-prioritization/',
  'case-study': '/case-studies/r3/',
  library: '/library/tools/thinkst-canary/',
  stories: '/stories/whats-new/support-regex-and-custom-response-for-webhook-action-rules/',
  blog: '/blog/tines-invests-in-no-code-research-at-university-of-limerick-ireland/',
  events: '/events/builder-connect/',
  webinars: '/webinars/integrate-hashicorp-vault-1password-using-tines/',
}

// ── 페이지 안: 구간 추출 ───────────────────────────────────────────
function collectSections(mode = 'module') {
  const MOD = /([A-Z][A-Za-z0-9]+)-module-scss-module__/g
  const namesOf = (el) => { const s = new Set(); const c = typeof el.className === 'string' ? el.className : el.getAttribute('class') || ''; for (const m of c.matchAll(MOD)) s.add(m[1]); return [...s] }
  const vw = window.innerWidth, docH = document.documentElement.scrollHeight
  const rect = (el) => { const r = el.getBoundingClientRect(); return { y: Math.round(r.top + scrollY), h: Math.round(r.height), w: Math.round(r.width) } }
  // mode 'module' = 이름 붙은 CSS 모듈만 · 'generic' = 이전 세대 페이지(모듈 이름 없음)의 보이는 블록
  const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|LINK|META)$/
  const isBlock = (el) => { if (SKIP.test(el.tagName)) return false; if (mode === 'module' && !namesOf(el).length) return false; const r = rect(el); return r.h >= 120 && r.w >= vw * 0.6 }
  const hasContent = (el) => !!el.querySelector('h1, h2, h3, img, picture, video, canvas, svg')
  const isFrame = (el) => rect(el).h >= docH * 0.7
  const inChrome = (el) => !!el.closest('header, footer, nav, [role="dialog"], [id*="cookie" i]')

  // 블록 안에서 「가장 가까운 층」의 하위 블록들(다른 하위 블록 안에 든 것은 뺀다).
  const subBlocks = (el) => {
    const found = []
    const walk = (n) => { for (const ch of n.children) { if (inChrome(ch)) continue; if (isBlock(ch)) found.push(ch); else walk(ch) } }
    walk(el)
    return found
  }
  // 묶음 판정 — 하위 블록이 둘 이상이고 그 높이 합이 60% 이상이면 묶음이다(안쪽 구간들로 나눈다).
  const isGroup = (el) => {
    const subs = subBlocks(el)
    if (subs.length < 2) return false
    // 이전 세대 페이지는 div 가 겹겹이라 — 제목·매체를 가진 하위 블록이 둘 이상일 때만 나눈다.
    if (mode === 'generic' && subs.filter(hasContent).length < 2) return false
    return subs.reduce((a, s) => a + rect(s).h, 0) >= rect(el).h * 0.6
  }
  const out = []
  const take = (el) => {
    if (isFrame(el) || isGroup(el)) { const subs = subBlocks(el); if (subs.length) { subs.forEach(take); return } }
    out.push(el)
  }
  subBlocks(document.querySelector('main') || document.body).forEach(take)

  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c } return null }
  const inner = (el) => {
    const f = new Map()
    for (const x of el.querySelectorAll('*')) for (const n of namesOf(x)) f.set(n, (f.get(n) || 0) + 1)
    return [...f].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n)
  }
  const cols = (el) => {
    // 첫 격자·플렉스 행의 자식 수(보이는 것만) — 카드 줄의 열 수를 본다.
    for (const x of [el, ...el.querySelectorAll('*')].slice(0, 400)) {
      const s = getComputedStyle(x)
      if ((s.display.includes('grid') || (s.display.includes('flex') && s.flexDirection.startsWith('row'))) && x.children.length >= 2) {
        const kids = [...x.children].filter((k) => k.getBoundingClientRect().width > 80)
        if (kids.length >= 2) return kids.length
      }
    }
    return 1
  }
  const anim = (el) => { const s = new Set(); for (const x of [el, ...el.querySelectorAll('*')].slice(0, 1500)) { const a = getComputedStyle(x).animationName; if (a && a !== 'none') a.split(',').forEach((n) => s.add(n.trim().replace(/^.*__/, ''))) } return [...s] }
  return out.map((el) => {
    const h = el.querySelector('h1, h2, h3')
    const kicker = [...el.querySelectorAll('p, span, div')].find((x) => { const s = getComputedStyle(x); return !x.closest('a, button') && s.textTransform === 'uppercase' && x.textContent.trim().length > 3 && x.textContent.trim().length < 60 && x.children.length === 0 })
    return {
      component: namesOf(el)[0] ?? `<${el.tagName.toLowerCase()}>`,
      naming: mode,
      inner: inner(el),
      heading: h ? h.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) : null,
      headingTag: h ? h.tagName.toLowerCase() : null,
      kicker: kicker ? kicker.textContent.trim().slice(0, 60) : null,
      ...rect(el),
      bg: bgOf(el),
      columns: cols(el),
      counts: {
        img: el.querySelectorAll('img, picture').length,
        svg: el.querySelectorAll('svg').length,
        video: el.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="wistia"]').length,
        link: el.querySelectorAll('a[href]').length,
        button: el.querySelectorAll('button').length,
        form: el.querySelectorAll('form, input, textarea, select').length,
        tab: el.querySelectorAll('[role="tab"]').length,
        expandable: el.querySelectorAll('[aria-expanded], details').length,
        canvas: el.querySelectorAll('canvas').length,
      },
      scrollX: [...el.querySelectorAll('*')].slice(0, 800).some((x) => { const s = getComputedStyle(x); return (s.overflowX === 'auto' || s.overflowX === 'scroll') && x.scrollWidth > x.clientWidth + 20 }),
      animations: anim(el),
    }
  })
}

function collectChrome() {
  const MOD = /([A-Z][A-Za-z0-9]+)-module-scss-module__/g
  const names = (root) => { const s = new Set(); if (!root) return []; for (const x of [root, ...root.querySelectorAll('*')]) { const c = typeof x.className === 'string' ? x.className : x.getAttribute('class') || ''; for (const m of c.matchAll(MOD)) s.add(m[1]) } return [...s] }
  const header = document.querySelector('header')
  const footer = document.querySelector('footer')
  return {
    title: document.title,
    docHeight: document.documentElement.scrollHeight,
    header: names(header).slice(0, 12),
    footer: names(footer).slice(0, 12),
    footerLinkGroups: footer ? footer.querySelectorAll('ul').length : 0,
    footerLinks: footer ? footer.querySelectorAll('a[href]').length : 0,
  }
}

// ── 팝업류 — 홈 1440 · 390 ───────────────────────────────────────
async function overlays(browser) {
  const res = []
  const snap = (page, kind, label) => page.evaluate(({ kind, label }) => {
    const MOD = /([A-Z][A-Za-z0-9]+)-module-scss-module__/g
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 40 && r.height > 40 && s.visibility !== 'hidden' && s.opacity !== '0' }
    const cands = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], [id*="cookie" i], header [aria-expanded="true"] ~ *, header div, nav div')].filter(vis)
    // 가장 큰 새 층(헤더 아래로 펼쳐진 패널 · 전면 모달)
    let best = null
    for (const e of cands) { const r = e.getBoundingClientRect(); const a = r.width * r.height; if (r.top >= 0 && r.height > 120 && (!best || a > best.a)) best = { e, a } }
    if (!best) return { kind, label, found: false }
    const el = best.e, r = el.getBoundingClientRect()
    const names = new Set(); for (const x of [el, ...el.querySelectorAll('*')]) { const c = typeof x.className === 'string' ? x.className : x.getAttribute('class') || ''; for (const m of c.matchAll(MOD)) names.add(m[1]) }
    const bgs = new Set(); for (const x of el.querySelectorAll('*')) { const c = getComputedStyle(x).backgroundColor; if (c !== 'rgba(0, 0, 0, 0)') bgs.add(c) }
    return { kind, label, found: true, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), components: [...names].slice(0, 14),
      links: el.querySelectorAll('a[href]').length, groups: el.querySelectorAll('ul, [class*="group" i], [class*="column" i]').length,
      images: el.querySelectorAll('img, svg').length, inputs: el.querySelectorAll('input').length, fills: [...bgs].slice(0, 8),
      role: el.getAttribute('role'), modal: el.getAttribute('aria-modal') }
  }, { kind, label })

  // 1440 — 쿠키 배너 · 메가메뉴 · 검색
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90_000 })
  await page.waitForTimeout(1500)
  res.push(await snap(page, 'banner', 'cookie-consent'))
  await dismissOverlays(page)
  await page.evaluate(() => document.getElementById('tines-cookie-root')?.remove())
  for (const label of ['Product', 'Solutions', 'Discover']) {
    const t = page.locator('header').getByRole('button', { name: label }).first()
    await t.click({ timeout: 3000 }).catch(() => t.hover())
    await page.waitForTimeout(700)
    res.push(await snap(page, 'mega-menu', label))
    await page.keyboard.press('Escape'); await page.mouse.move(700, 850); await page.waitForTimeout(400)
  }
  const s = page.locator('header').getByRole('button', { name: /search/i }).first()
  if (await s.count()) { await s.click().catch(() => {}); await page.waitForTimeout(800); res.push(await snap(page, 'modal', 'search')); await page.keyboard.press('Escape') }
  await ctx.close()

  // 390 — 모바일 메뉴
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const mp = await m.newPage()
  await mp.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90_000 })
  await dismissOverlays(mp)
  await mp.evaluate(() => document.getElementById('tines-cookie-root')?.remove())
  const burger = mp.locator('header button').filter({ hasNot: mp.locator('text=/search/i') }).last()
  if (await burger.count()) { await burger.click().catch(() => {}); await mp.waitForTimeout(900); res.push(await snap(mp, 'drawer', 'mobile-menu')) }
  await m.close()
  return res
}

// ── 실행 ─────────────────────────────────────────────────────────
const browser = await chromium.launch()
const pages = []
const run = async (key, url, parent = null) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  try {
    // 추적 스크립트가 끝나지 않아 networkidle 이 오지 않는 페이지가 있다(/events/) — DOM 로드 + 5초로 넘어간다.
    let resp
    try { resp = await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45_000 }) }
    catch { resp = await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 60_000 }); await page.waitForTimeout(5000) }
    await dismissOverlays(page)
    await settle(page)
    const chrome = await page.evaluate(collectChrome)
    let sections = await page.evaluate(collectSections, 'module')
    if (!sections.length) sections = await page.evaluate(collectSections, 'generic')
    const detail = !parent ? DETAIL[key] ?? null : null
    pages.push({ key, url, parent, status: resp?.status() ?? null, ...chrome, sections })
    console.log(`${key.padEnd(20)} ${String(resp?.status()).padEnd(4)} 구간 ${String(sections.length).padStart(2)} · 높이 ${chrome.docHeight} ${url}`)
    await ctx.close()
    if (detail) await run(`${key}:detail`, detail.endsWith('/') ? detail : detail + '/', key)
  } catch (e) {
    console.log(`${key.padEnd(20)} FAIL ${e.message.split('\n')[0]}`)
    await ctx.close()
  }
}
for (const [key, url] of PAGES) if (!ONLY || ONLY.includes(key)) await run(key, url)
// --only 는 그 페이지만 다시 재고 나머지는 기존 결과를 둔다(덮어쓰면 다른 페이지가 사라진다).
const prev = ONLY && fs.existsSync(path.join(OUT, 'sections.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'sections.json'), 'utf8')) : null
if (prev) { const redone = new Set(pages.map((p) => p.key)); const order = prev.pages.map((p) => p.key); pages.unshift(...prev.pages.filter((p) => !redone.has(p.key))); pages.sort((a, b) => (order.indexOf(a.key) + 1 || 999) - (order.indexOf(b.key) + 1 || 999)) }
const pops = ONLY ? prev?.overlays ?? [] : await overlays(browser)
await browser.close()

// ── 집계 ─────────────────────────────────────────────────────────
const freq = new Map()
for (const p of pages) for (const s of p.sections) for (const n of [s.component, ...s.inner]) {
  const f = freq.get(n) || { pages: new Set(), n: 0 }; f.pages.add(p.key); f.n++; freq.set(n, f)
}
const components = [...freq].map(([name, f]) => ({ name, pages: f.pages.size, occurrences: f.n })).sort((a, b) => b.pages - a.pages || b.occurrences - a.occurrences)
const data = { generatedBy: 'scripts/design/extract-sections.mjs', generatedAt: new Date().toISOString().slice(0, 10), base: BASE, pages, overlays: pops, components }
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'sections.json'), JSON.stringify(data, null, 2) + '\n')

const L = []
L.push('# 참조 사이트 — 구간 전수 목록', '')
L.push(`> 생성 \`scripts/design/extract-sections.mjs\` · ${data.generatedAt} · 손으로 고치지 말 것. 구조·수치만(이미지·본문 0, 제목은 80자까지).`)
L.push(`> 페이지 ${pages.length} · 구간 ${pages.reduce((a, p) => a + p.sections.length, 0)} · 팝업류 ${pops.filter((o) => o.found).length}. 매핑은 \`docs/design/tines-mapping.md\`.`, '')
L.push('## 페이지 × 구간', '')
for (const p of pages) {
  L.push(`### ${p.key} — \`${p.url}\` (${p.status}) · 문서 ${p.docHeight}px · 구간 ${p.sections.length}`, '')
  L.push(`헤더 ${p.header.join(' · ') || '—'} / 푸터 ${p.footer.join(' · ') || '—'} (링크 ${p.footerLinks})`, '')
  if (!p.sections.length) { L.push('(구간 없음)', ''); continue }
  if (p.sections[0]?.naming === 'generic') L.push('> 이전 세대 페이지 — CSS 모듈 이름이 없어 보이는 블록(태그)으로 나눴다.', '')
  L.push('| # | 컴포넌트 | 눈썹 · 제목 | 높이 | 바탕 | 열 | 상호작용 · 매체 | 안쪽 컴포넌트 |', '|---|---|---|---|---|---|---|---|')
  p.sections.forEach((s, i) => {
    const c = s.counts
    const tags = [c.tab && `탭${c.tab}`, c.expandable && `펼침${c.expandable}`, s.scrollX && '가로스크롤', c.video && `영상${c.video}`, c.form && `폼${c.form}`, c.canvas && `캔버스${c.canvas}`, c.img && `그림${c.img}`, c.svg > 3 && `svg${c.svg}`, s.animations.length && `모션(${s.animations.slice(0, 3).join(',')})`].filter(Boolean).join(' · ')
    const title = [s.kicker && `\`${s.kicker}\``, s.heading && `${s.headingTag}: ${s.heading.replace(/\|/g, '/')}`].filter(Boolean).join(' / ') || '—'
    L.push(`| ${i + 1} | ${s.component} | ${title} | ${s.h} | ${s.bg ?? '—'} | ${s.columns} | ${tags || '—'} | ${s.inner.slice(0, 5).join(' · ')} |`)
  })
  L.push('')
}
L.push('## 팝업류 (홈)', '', '| 종류 | 이름 | 크기 | 링크 | 묶음 | 그림 | 입력 | 컴포넌트 |', '|---|---|---|---|---|---|---|---|')
for (const o of pops) L.push(o.found ? `| ${o.kind} | ${o.label} | ${o.w}×${o.h} | ${o.links} | ${o.groups} | ${o.images} | ${o.inputs} | ${o.components.slice(0, 8).join(' · ')} |` : `| ${o.kind} | ${o.label} | 못 찾음 | | | | | |`)
L.push('', '## 컴포넌트 빈도 (여러 페이지에 나오는 것 = 공통 부품)', '', '| 컴포넌트 | 페이지 수 | 등장 |', '|---|---|---|')
for (const c of components.slice(0, 60)) L.push(`| ${c.name} | ${c.pages} | ${c.occurrences} |`)
fs.writeFileSync(path.join(OUT, 'sections-summary.md'), L.join('\n') + '\n')
console.log(`\n${path.relative(ROOT, path.join(OUT, 'sections.json'))} · sections-summary.md — 페이지 ${pages.length} · 팝업 ${pops.filter((o) => o.found).length}/${pops.length}`)
