#!/usr/bin/env node
// scripts/design/tines-corpus.mjs
//
// 참조 사이트 **대량 코퍼스**(DD-68 · tines-mapping §12 후속) — 6페이지로는 스타일이 안 잡혔다(보라만 옮겼다).
// 사이트맵 6,439 URL 을 템플릿(경로 첫 단 + 깊이)으로 묶고, 한 장짜리는 전부 · 대량 템플릿은 고른 간격으로
// 뽑아 약 140페이지를 연다. 페이지마다:
//   · 1280 전체 캡처(JPEG) — 템플릿 대표 한 장은 390 도
//   · 그림 목록: 태그 · 원본/표시 크기 · 문서 좌표 · 역할 추정(hero · band · card · spot · logo · inline) · 담긴 면의 색
//   · 색 면 목록: 바탕 ≠ 페이지 바탕 · 면적 ≥ 12,000px² 인 요소의 바탕색 · 글자색 · 모서리 · 폭 비율
// 원본(캡처·그림)은 tmp/tines-corpus/ 에만 둔다(저장소에 넣지 않는다). 수치 요약은 tines-corpus-report.mjs 가 만든다.
//
//   node scripts/design/tines-corpus.mjs                 # 선정 + 수집(이미 받은 페이지는 건너뜀)
//   node scripts/design/tines-corpus.mjs --list          # 선정 목록만
//   node scripts/design/tines-corpus.mjs --limit 5 --force

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium, dismissOverlays } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const has = (k) => argv.includes(k)
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
const OUT = path.join(ROOT, 'tmp/tines-corpus')
const LIMIT = Number(flag('--limit', '0'))
const CONC = Number(flag('--conc', '3'))
const FORCE = has('--force')

// ── 1. 선정 ─────────────────────────────────────────────────────────
async function sitemap() {
  const f = path.join(OUT, 'sitemap.txt')
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean)
  const xml = await (await fetch('https://www.tines.com/sitemap.xml')).text()
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(f, urls.join('\n'))
  return urls
}

/** 템플릿 키 = 첫 단 + 깊이(같은 첫 단이라도 목록 · 상세는 다른 틀이다). */
function templateOf(u) {
  const parts = new URL(u).pathname.split('/').filter(Boolean)
  return parts.length === 0 ? 'home' : `${parts[0]}/d${parts.length - 1}`
}

/** 대량 템플릿에서 뽑을 수 — 틀이 같으니 적게, 다만 카드 색·삽화가 페이지마다 달라 몇 장은 본다. */
const QUOTA = {
  'stories/d1': 4, 'stories/d2': 6, 'stories/d3': 4, 'stories/d4': 3, 'stories/d5': 2, 'stories/d6': 1,
  'library/d1': 5, 'library/d2': 5, 'library/d3': 4,
  'blog/d1': 6, 'blog/d2': 2, 'blog/d3': 2,
  'events/d1': 3, '3b/d2': 4, 'university/d1': 2, 'university/d2': 2, 'university/d3': 2,
  'workflow-capability-matrix/d1': 2, 'webinars/d1': 2, 'bootcamp/d1': 2, 'case-studies/d1': 4,
  'access/d2': 2, 'careers/d2': 2, 'solutions/d2': 8, 'solutions/d1': 2,
}
// 문구만 다른 법률 사본 — 틀은 /privacy · /legal 로 충분하다
const SKIP = /^\/(terms|dpa|cookies-policy|payment-processing-terms|self-serve-subscription-terms|legal-prior-versions)\/?$/
const SINGLE_MAX = 5 // 이 이하 템플릿은 전부 연다(한 장짜리 제품 · 솔루션 · 법률 · 파트너 …)

function select(urls) {
  const groups = new Map()
  for (const u of urls) {
    if (SKIP.test(new URL(u).pathname)) continue
    const t = templateOf(u)
    if (!groups.has(t)) groups.set(t, [])
    groups.get(t).push(u)
  }
  const picked = []
  for (const [t, list] of [...groups].sort()) {
    list.sort()
    const n = QUOTA[t] ?? (list.length <= SINGLE_MAX ? list.length : 2)
    const step = list.length / n
    for (let i = 0; i < n && i < list.length; i++) picked.push({ template: t, url: list[Math.floor(i * step + step / 2)] })
  }
  if (!picked.some((p) => p.template === 'home')) picked.unshift({ template: 'home', url: 'https://www.tines.com/' })
  return picked
}

const slug = (u) => (new URL(u).pathname.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '_') || 'home').slice(0, 90)

// ── 2. 측정(페이지 안) ───────────────────────────────────────────────
function measure() {
  const vw = innerWidth
  const pageBg = getComputedStyle(document.body).backgroundColor
  const abs = (r) => ({ x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) })
  const alpha = (c) => { const m = c.match(/[\d.]+(?=\)$)/); return c.startsWith('rgba') || c.includes('/') ? Number((c.match(/\/\s*([\d.]+)/) || c.match(/,\s*([\d.]+)\)$/) || [0, 1])[1]) : 1 }
  const isPaint = (c) => c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)' && alpha(c) > 0.4

  // 담긴 면 — 가장 가까운 칠한 조상
  function surfaceOf(el) {
    for (let e = el.parentElement, d = 0; e && d < 12; e = e.parentElement, d++) {
      const cs = getComputedStyle(e)
      if (isPaint(cs.backgroundColor) && cs.backgroundColor !== pageBg) {
        const r = e.getBoundingClientRect()
        return { bg: cs.backgroundColor, radius: cs.borderTopLeftRadius, w: Math.round(r.width), h: Math.round(r.height) }
      }
      if (e === document.body) break
    }
    return null
  }

  const visuals = []
  const seen = new Set()
  const push = (el, kind, src, nat) => {
    const r = el.getBoundingClientRect()
    if (r.width < 40 || r.height < 40) return
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return
    const key = `${Math.round(r.left)}:${Math.round(r.top + scrollY)}:${Math.round(r.width)}`
    if (seen.has(key)) return
    seen.add(key)
    const a = abs(r)
    const surf = surfaceOf(el)
    const alt = (el.getAttribute('alt') || el.getAttribute('aria-label') || '').slice(0, 80)
    let role
    const s = (src || '') + ' ' + alt
    if (/logo/i.test(s) && a.h <= 90) role = 'logo'
    else if (a.w >= vw * 0.8) role = 'band'
    else if (a.y < 900 && a.w >= 280) role = 'hero'
    else if (Math.max(a.w, a.h) <= 180) role = 'spot'
    else if (surf && surf.w < vw * 0.62) role = 'card'
    else role = 'inline'
    visuals.push({ kind, src: (src || '').slice(0, 300), alt, nat, ...a, role, surface: surf, cls: String(el.className?.baseVal ?? el.className ?? '').slice(0, 80) })
  }
  for (const el of document.querySelectorAll('img')) push(el, 'img', el.currentSrc || el.src, [el.naturalWidth, el.naturalHeight])
  for (const el of document.querySelectorAll('video')) push(el, 'video', el.currentSrc || el.poster, [el.videoWidth, el.videoHeight])
  for (const el of document.querySelectorAll('canvas')) push(el, 'canvas', '', [el.width, el.height])
  for (const el of document.querySelectorAll('svg')) {
    if (el.parentElement?.closest('svg')) continue
    push(el, 'svg', el.getAttribute('aria-label') || el.querySelector('title')?.textContent || '', [el.viewBox?.baseVal?.width || 0, el.viewBox?.baseVal?.height || 0])
  }
  for (const el of document.querySelectorAll('body *')) {
    const bi = getComputedStyle(el).backgroundImage
    if (bi && bi.startsWith('url(')) push(el, 'bg', bi.slice(5, -2), [0, 0])
  }

  // 색 면
  const surfaces = []
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    if (!isPaint(cs.backgroundColor) || cs.backgroundColor === pageBg) continue
    const r = el.getBoundingClientRect()
    const area = r.width * r.height
    if (area < 12000 || r.width < 60) continue
    const parentBg = getComputedStyle(el.parentElement).backgroundColor
    if (parentBg === cs.backgroundColor) continue // 같은 색 중첩은 바깥만
    // 면 위 대표 글자색 — 안쪽 첫 글자 요소
    let ink = cs.color
    const t = [...el.querySelectorAll('h1,h2,h3,h4,p,span,a')].find((x) => x.textContent.trim().length > 2)
    if (t) ink = getComputedStyle(t).color
    surfaces.push({ bg: cs.backgroundColor, ink, radius: cs.borderTopLeftRadius, ...abs(r), full: r.width >= vw * 0.9, tag: el.tagName.toLowerCase() })
  }
  // 글자색 분포(면적 대신 글자 수)
  const inks = {}
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n; (n = walker.nextNode());) {
    const len = n.textContent.trim().length
    if (!len || !n.parentElement) continue
    const c = getComputedStyle(n.parentElement).color
    inks[c] = (inks[c] || 0) + len
  }
  return { title: document.title, pageBg, docH: document.documentElement.scrollHeight, visuals, surfaces, inks }
}

// ── 3. 수집 ─────────────────────────────────────────────────────────
async function capture(browser, item, repr) {
  const dir = path.join(OUT, 'pages', slug(item.url))
  const done = path.join(dir, 'data.json')
  if (!FORCE && fs.existsSync(done)) return 'skip'
  fs.mkdirSync(dir, { recursive: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  try {
    const res = await page.goto(item.url, { waitUntil: 'load', timeout: 90_000 })
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    await dismissOverlays(page)
    // 지연 로드 펼치기(모션은 끄지 않는다 — 삽화 · 색은 그대로 봐야 한다)
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)) }
      scrollTo(0, 0)
    })
    await page.waitForTimeout(1200)
    const data = await page.evaluate(measure)
    const H = Math.min(data.docH, 16000)
    await page.screenshot({ path: path.join(dir, 'full-1280.jpg'), type: 'jpeg', quality: 72, clip: { x: 0, y: 0, width: 1280, height: H }, fullPage: true })
    if (repr) {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.waitForTimeout(800)
      const h390 = Math.min(await page.evaluate(() => document.documentElement.scrollHeight), 16000)
      await page.screenshot({ path: path.join(dir, 'full-390.jpg'), type: 'jpeg', quality: 72, clip: { x: 0, y: 0, width: 390, height: h390 }, fullPage: true })
    }
    fs.writeFileSync(done, JSON.stringify({ ...item, status: res?.status(), capturedAt: new Date().toISOString(), repr, ...data }))
    return `ok ${res?.status()} ${data.visuals.length}그림 ${data.surfaces.length}면 ${data.docH}px`
  } catch (e) {
    return `ERR ${e.message.split('\n')[0]}`
  } finally {
    await ctx.close()
  }
}

const urls = await sitemap()
let picked = select(urls)
if (LIMIT) picked = picked.slice(0, LIMIT)
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'selection.json'), JSON.stringify(picked, null, 1))
const templates = new Set(picked.map((p) => p.template))
console.log(`사이트맵 ${urls.length} → 템플릿 ${templates.size} · 선정 ${picked.length}페이지`)
if (has('--list')) { for (const p of picked) console.log(p.template.padEnd(34), p.url); process.exit(0) }

const firstOf = new Set()
const browser = await chromium.launch()
let i = 0
async function worker() {
  while (i < picked.length) {
    const n = ++i
    const item = picked[n - 1]
    const repr = !firstOf.has(item.template)
    firstOf.add(item.template)
    const r = await capture(browser, item, repr)
    console.log(`[${String(n).padStart(3)}/${picked.length}] ${item.template.padEnd(30)} ${slug(item.url).slice(0, 50).padEnd(50)} ${r}`)
  }
}
await Promise.all(Array.from({ length: CONC }, worker))
await browser.close()
