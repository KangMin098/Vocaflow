// Gate 1/3 — 렌더 실측. 사용: node capture.mjs <screens.json> <outDir> <authState>
// 익명 응답(로그인 필요 여부) + 로그인 상태 1280/390 첫 화면 캡처 + 렌더된 DOM 의 평균 신호.
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire('D:/workspace/Vocaflow/apps/web/package.json')
const { chromium } = require('@playwright/test')
const [, , screensPath, OUT, AUTH] = process.argv
const BASE = 'http://localhost:3000'
mkdirSync(OUT, { recursive: true })
const targets = JSON.parse(readFileSync(screensPath, 'utf8'))
const resultsPath = join(OUT, 'capture-results.json')
const results = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : {}
const slug = (r) => (r === '/' ? 'root' : r.slice(1).split(/[/[\]]+/).filter(Boolean).join('_'))
const SKIP_CHILD = new Set(['new', 'browse', 'review', 'study', 'results', 'play', 'setup', 'session', 'practice', 'comic', 'echo'])

async function childValue(ctx, parent) {
  const p = await ctx.newPage()
  try {
    await p.goto(BASE + parent, { waitUntil: 'domcontentloaded', timeout: 120000 })
    try { await p.waitForLoadState('networkidle', { timeout: 15000 }) } catch {}
    const hrefs = await p.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href') || ''))
    const prefix = parent === '/' ? '/' : parent + '/'
    for (const h of hrefs) {
      if (!h.startsWith(prefix)) continue
      const v = h.slice(prefix.length).split(/[/?#]/)[0]
      if (v && !SKIP_CHILD.has(v)) return decodeURIComponent(v)
    }
    return null
  } catch { return null } finally { await p.close() }
}

const cache = {}
async function resolveDynamic(ctxs, route) {
  const segs = route.split('/').filter(Boolean)
  let path = ''
  for (const s of segs) {
    if (!(s.startsWith('[') && s.endsWith(']'))) { path += '/' + s; continue }
    const parent = path || '/'
    if (!(parent in cache)) {
      let v = null
      for (const c of ctxs) { if (c && !v) v = await childValue(c, parent) }
      cache[parent] = v
    }
    if (!cache[parent]) return null
    path += '/' + encodeURIComponent(cache[parent])
  }
  return path
}

const METRICS = () => {
  const vh = innerHeight
  const inFold = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < vh && r.bottom > 0 }
  const els = [...document.querySelectorAll('body *')].filter(inFold).slice(0, 5000)
  let grid3 = 0, shadow = 0, bigRadius = 0, gradient = 0, blur = 0, cardsLike = 0
  for (const el of els) {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    if (cs.display.includes('grid')) { const t = cs.gridTemplateColumns.split(' ').filter(Boolean); if (t.length === 3 && new Set(t).size === 1) grid3++ }
    if (cs.boxShadow !== 'none' && !cs.boxShadow.includes('0px 0px 0px 1px')) shadow++
    if (parseFloat(cs.borderTopLeftRadius) >= 12 && r.width > 120) bigRadius++
    if (cs.backgroundImage.includes('gradient')) gradient++
    if (cs.backdropFilter && cs.backdropFilter !== 'none') blur++
    if (r.width > 120 && r.height > 60 && el.children.length >= 2 && (cs.borderTopWidth !== '0px' || cs.boxShadow !== 'none') && cs.borderTopStyle !== 'none') cardsLike++
  }
  const viz = [...document.querySelectorAll('svg, canvas')].filter((e) => { const r = e.getBoundingClientRect(); return inFold(e) && r.width >= 120 && r.height >= 60 })
  const h1 = document.querySelector('h1')
  const txt = document.body.innerText
  return {
    title: document.title, h1: h1 ? h1.innerText.trim().slice(0, 80) : null,
    h1Center: h1 ? getComputedStyle(h1).textAlign === 'center' : null,
    grid3, shadow, bigRadius, gradient, blur, cardsLike, vizInFold: viz.length,
    errorText: /Application error|Unhandled Runtime Error|페이지를 찾을 수 없|404/.test(txt.slice(0, 3000)),
  }
}

const browser = await chromium.launch()
const anon = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
const authed = AUTH ? await browser.newContext({ storageState: AUTH, viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }) : null
for (const s of targets) {
  if (results[s.route]?.done) continue
  const rec = { route: s.route, surface: s.surface }
  try {
    // 2차: 부모 화면에서 링크를 못 찾은 동적 화면은 DB 에서 고른 샘플(override)을 쓴다
    const url = s.override ?? (s.dynamic.length ? await resolveDynamic([anon, authed], s.route) : s.route)
    if (s.override) rec.sampleSource = s.overrideSource
    rec.sampleUrl = url
    if (!url) {
      rec.fail = '동적 param 샘플 없음 — 부모 화면(익명·로그인 둘 다)에 자식 링크가 없다'
    } else {
      const ap = await anon.newPage()
      const resp = await ap.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 120000 })
      await ap.waitForTimeout(600)
      const want = new URL(BASE + url).pathname
      rec.anon = { status: resp?.status() ?? null, finalPath: new URL(ap.url()).pathname }
      rec.loginRequired = rec.anon.finalPath !== want
      await ap.close()
      const ctx = rec.loginRequired && authed ? authed : anon
      for (const [label, vp] of [['1280', { width: 1280, height: 900 }], ['390', { width: 390, height: 844 }]]) {
        const p = await ctx.newPage()
        await p.setViewportSize(vp)
        const r = await p.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 120000 })
        try { await p.waitForLoadState('networkidle', { timeout: 15000 }) } catch {}
        await p.waitForTimeout(1200)
        const file = join(OUT, `${slug(s.route)}@${label}-light.png`)
        await p.screenshot({ path: file })
        rec['v' + label] = { status: r?.status() ?? null, finalPath: new URL(p.url()).pathname, shot: file, ...(await p.evaluate(METRICS)) }
        await p.close()
      }
      if (rec.v1280.finalPath !== want) rec.fail = `로그인 상태에서도 ${rec.v1280.finalPath} 로 이동 — 세션 만료 또는 권한 부족`
    }
  } catch (e) { rec.fail = String(e.message || e).split('\n')[0] }
  rec.done = true
  results[s.route] = rec
  writeFileSync(resultsPath, JSON.stringify(results, null, 1))
  console.log(s.route, rec.fail ? 'FAIL ' + rec.fail : `ok login=${rec.loginRequired}`)
}
await browser.close()
