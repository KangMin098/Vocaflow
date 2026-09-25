#!/usr/bin/env node
// scripts/design/ours-corpus.mjs
//
// **우리 화면 코퍼스**(DD-68 · tines-mapping §16) — 참조 151페이지(tines-corpus.mjs)와 **같은 기준**으로 우리 화면 전부를 잰다.
// 5개 화면만 재고 고치면 나머지 화면의 보라가 그대로 남는다(2026-09-21 §15 이후에도 「보라만 보인다」).
//
// 화면마다(검증 계정 로그인 · 스킨 tines):
//   · 바탕 — 화면 격자 20px 마다 가장 위 칠한 바탕의 계열(보라 · 그 외 색 · 무채) = 보이는 면적
//   · 보라 바탕의 **출처** — 그 점을 칠한 요소의 색 + 클래스 조각(어디를 고칠지)
//   · 글자 · 테두리 계열
//   · 그림 — 참조와 같은 역할 규칙(hero · band · card · spot · inline · logo)
// 동적 화면은 목록 화면의 실제 링크에서 첫 주소를 주워 연다.
// 산출: tmp/ours-corpus/<slug>.json · docs/design/refs/ours-corpus-summary.md (수치만)
//
//   MSYS_NO_PATHCONV=1 node --env-file=apps/web/.env.local scripts/design/ours-corpus.mjs [--conc 3] [--only /hub,/practice]

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
const CONC = Number(flag('--conc', '3'))
const ONLY = flag('--only', null)?.split(',')
const BASE = flag('--base', 'http://localhost:3000')
const OUT = path.join(ROOT, 'tmp/ours-corpus')
const STATE = path.join(ROOT, 'tmp/authed-state.json')
const MD = path.join(ROOT, 'docs/design/refs/ours-corpus-summary.md')
const TINES = path.join(ROOT, 'docs/design/refs/tines/corpus.json')

// ── 화면 목록 — app 아래 page.tsx 에서(관리자 · 개발 · 실험실 제외) ─────────────────
function staticRoutes() {
  const app = path.join(ROOT, 'apps/web/src/app')
  const out = []
  const walk = (d) => {
    for (const n of fs.readdirSync(d)) {
      const p = path.join(d, n)
      if (fs.statSync(p).isDirectory()) walk(p)
      else if (n === 'page.tsx') {
        const r = '/' + path.relative(app, d).split(path.sep).filter((s) => !/^\(.*\)$/.test(s)).join('/')
        if (/^\/(admin|dev|hub-lab|sitemap|api)(\/|$)/.test(r)) continue
        out.push(r === '/' ? '/' : r.replace(/\/$/, ''))
      }
    }
  }
  walk(app)
  return [...new Set(out)].sort()
}
const ALL = staticRoutes()
const STATIC = ALL.filter((r) => !r.includes('['))
const DYNAMIC = ALL.filter((r) => r.includes('['))
// 동적 패턴 → 정규식(세그먼트 하나 · 여럿)
const toRe = (r) => new RegExp('^' + r.replace(/\[\.\.\.[^\]]+\]/g, '.+').replace(/\[[^\]]+\]/g, '[^/?#]+') + '$')
// 모바일 390 로도 재는 화면 — 학습자가 가장 자주 여는 곳
const MOBILE = ['/', '/hub', '/dashboard', '/library/books', '/library/scripts', '/library/vocab', '/library/textbooks', '/comics/adapted', '/comics/restored',
  '/wordvault', '/wordvault/browse', '/practice', '/flashcard', '/spellforge', '/scriptquiz', '/dictate', '/pairflip', '/arcade', '/plan', '/my', '/my/words',
  '/my/books', '/text', '/csat', '/teacher', '/settings', '/fit', '/about', '/pricing', '/video', '/login', '/signup', '/diagnostic', '/wordblitz', '/reports', '/my/texts', '/text/new', '/practice/dcp', '/csat/formulas', '/library']

function measure() {
  const W = innerWidth, VH = innerHeight
  const cv = document.createElement('canvas').getContext('2d')
  const rgb = (c) => { cv.fillStyle = '#010203'; cv.fillStyle = c; const h = cv.fillStyle; if (h === '#010203') return null; if (h.startsWith('#')) return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1); const m = h.match(/[\d.]+/g); return m ? m.map(Number) : null }
  const fam = (c) => {
    const v = rgb(c); if (!v || (v[3] ?? 1) < 0.3) return null
    const [r, g, b] = v.map((x, i) => (i < 3 ? x / 255 : x)); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2
    const s = mx === mn ? 0 : l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn)
    let h = 0; if (mx !== mn) { if (mx === r) h = ((g - b) / (mx - mn)) % 6; else if (mx === g) h = (b - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4; h *= 60; if (h < 0) h += 360 }
    if (s < 0.12 || (l > 0.94 && h >= 15 && h < 60)) return '무채'
    return h >= 225 && h < 300 ? '보라' : '그외'
  }
  const clsOf = (el) => String(el.className?.baseVal ?? el.className ?? '').split(/\s+/).filter((c) => /bg-|tone-|rounded|shadow/.test(c)).slice(0, 4).join(' ')
  const bg = { 보라: 0, 그외: 0, 무채: 0 }, src = {}
  let n = 0
  for (let y = 4; y < VH; y += 20) for (let x = 4; x < W; x += 20) {
    let el = document.elementFromPoint(x, y); n++
    let f = '무채', c = '', who = null
    while (el && el !== document.documentElement) {
      if (el.tagName === 'IMG' || el.tagName === 'VIDEO' || el.tagName === 'CANVAS') { f = '그림'; break }
      const cs = getComputedStyle(el)
      if (cs.backgroundColor && fam(cs.backgroundColor)) { f = fam(cs.backgroundColor); c = cs.backgroundColor; who = el; break }
      el = el.parentElement
    }
    if (f === '그림') { bg.그외 += 0; bg.그림 = (bg.그림 || 0) + 1; continue }
    bg[f] = (bg[f] || 0) + 1
    if (f === '보라' && who) { const k = `${c} ← ${who.tagName.toLowerCase()}.${clsOf(who) || '(클래스 없음)'}${who.closest('aside') ? ' [사이드바]' : who.closest('header') ? ' [상단]' : ''}`; src[k] = (src[k] || 0) + 1 }
  }
  const ink = { 보라: 0, 그외: 0, 무채: 0 }
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let t; (t = tw.nextNode());) { const L = t.textContent.trim().length; if (!L || !t.parentElement) continue; const r = t.parentElement.getBoundingClientRect(); if (r.bottom < 0 || r.top > VH) continue; ink[fam(getComputedStyle(t.parentElement).color) || '무채'] += L }
  const bd = { 보라: 0, 그외: 0, 무채: 0 }
  for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > VH || r.width < 8) continue; const cs = getComputedStyle(el); if ((parseFloat(cs.borderTopWidth) || parseFloat(cs.borderLeftWidth)) > 0) bd[fam(cs.borderTopColor) || fam(cs.borderLeftColor) || '무채']++ }
  // 그림 — 문서 전체(참조와 같은 역할 규칙)
  const roles = { hero: 0, band: 0, card: 0, spot: 0, inline: 0, logo: 0 }
  const seen = new Set()
  for (const el of document.querySelectorAll('img, svg, video, canvas')) {
    if (el.tagName === 'svg' && el.parentElement?.closest('svg')) continue
    const r = el.getBoundingClientRect(); if (r.width < 40 || r.height < 40) continue
    if (el.tagName === 'svg' && Math.max(r.width, r.height) <= 64) continue
    const k = `${Math.round(r.left)}:${Math.round(r.top + scrollY)}`; if (seen.has(k)) continue; seen.add(k)
    const y = r.top + scrollY, src2 = (el.currentSrc || el.src || '') + (el.getAttribute('alt') || '')
    let surf = null; for (let e = el.parentElement, d = 0; e && d < 12; e = e.parentElement, d++) { const b = getComputedStyle(e).backgroundColor; if (fam(b) && fam(b) !== '무채') { surf = e.getBoundingClientRect(); break } }
    const role = /logo/i.test(src2) && r.height <= 90 ? 'logo' : r.width >= W * 0.8 ? 'band' : y < 900 && r.width >= 280 ? 'hero' : Math.max(r.width, r.height) <= 180 ? 'spot' : surf && surf.width < W * 0.62 ? 'card' : 'inline'
    roles[role]++
  }
  const tinesArt = [...document.querySelectorAll('img')].filter((i) => /illustrations\/tines/.test(decodeURIComponent(i.currentSrc || i.src))).length
  return { n, bg, src: Object.entries(src).sort((a, b) => b[1] - a[1]).slice(0, 5), ink, bd, roles, tinesArt, docH: document.documentElement.scrollHeight, title: document.title }
}

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const ctx1440 = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: STATE })
const ctx390 = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: STATE })

// 동적 주소 줍기 — 정적 화면들의 링크에서 패턴에 맞는 첫 주소
async function harvest() {
  const found = new Map()
  const p = await ctx1440.newPage()
  for (const r of ['/library/books', '/comics/adapted', '/comics/restored', '/video', '/library/textbooks', '/my/books', '/text', '/library/vocab', '/library/scripts']) {
    try {
      await p.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 90_000 }); await p.waitForTimeout(1500)
      const hrefs = await p.$$eval('a[href^="/"]', (as) => as.map((a) => a.getAttribute('href').split('?')[0].split('#')[0]))
      for (const d of DYNAMIC) if (!found.has(d)) { const h = hrefs.find((x) => toRe(d).test(x)); if (h) found.set(d, h) }
    } catch { /* 목록이 안 열리면 그 패턴은 빠진다 */ }
  }
  await p.close()
  return found
}
const dyn = await harvest()
const jobs = []
for (const r of [...STATIC, ...dyn.values()]) {
  if (ONLY && !ONLY.includes(r)) continue
  jobs.push({ route: r, vp: 1440 })
  if (MOBILE.includes(r)) jobs.push({ route: r, vp: 390 })
}
console.log(`정적 ${STATIC.length} · 동적 ${dyn.size}/${DYNAMIC.length} (${[...dyn.keys()].join(' ')}) → 측정 ${jobs.length}회`)

const results = []
let k = 0
async function worker() {
  while (k < jobs.length) {
    const j = jobs[k++]
    const page = await (j.vp === 390 ? ctx390 : ctx1440).newPage()
    try {
      const res = await page.goto(`${BASE}${j.route}${j.route.includes('?') ? '&' : '?'}skin=tines`, { waitUntil: 'load', timeout: 90_000 })
      await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {})
      await page.waitForTimeout(900)
      const landed = new URL(page.url()).pathname
      const m = await page.evaluate(measure)
      const row = { ...j, landed, status: res?.status(), ...m }
      results.push(row)
      fs.writeFileSync(path.join(OUT, `${(j.route.replace(/[^a-z0-9]+/gi, '_') || 'root')}-${j.vp}.json`), JSON.stringify(row))
      const pct = (v) => Math.round((v / m.n) * 100)
      console.log(`[${results.length}/${jobs.length}] ${j.route} @${j.vp} → ${landed} 보라 ${pct(m.bg.보라)}% 그외 ${pct(m.bg.그외)}% 그림 ${m.tinesArt}`)
    } catch (e) { console.log(`✗ ${j.route} @${j.vp} ${e.message.split('\n')[0]}`) } finally { await page.close() }
  }
}
await Promise.all(Array.from({ length: CONC }, worker))
await browser.close()

// ── 요약 ──────────────────────────────────────────────────────────
const tines = fs.existsSync(TINES) ? JSON.parse(fs.readFileSync(TINES, 'utf8')) : null
const tAvg = (key) => tines ? (tines.perTemplate.reduce((a, t) => a + (t[key] ?? 0) * t.pages, 0) / tines.perTemplate.reduce((a, t) => a + t.pages, 0)) : null
const pct = (r, k) => Math.round(((r.bg[k] || 0) / r.n) * 100)
const avg = (xs, f) => (xs.length ? xs.reduce((a, x) => a + f(x), 0) / xs.length : 0)
const learner = results.filter((r) => !/^\/play\//.test(r.route))
const srcAll = {}
for (const r of learner) for (const [k2, v] of r.src) srcAll[k2] = (srcAll[k2] || 0) + v / r.n
const topSrc = Object.entries(srcAll).sort((a, b) => b[1] - a[1]).slice(0, 25)
const md = [
  '<!-- 생성물: scripts/design/ours-corpus.mjs — 손으로 고치지 말 것 -->',
  `# 우리 화면 코퍼스 (${results.length}회 측정 · 화면 ${new Set(results.map((r) => r.route)).size})`,
  '',
  '> 기준은 참조 코퍼스와 같다 — 첫 화면(뷰포트) 20px 격자의 가장 위 칠한 바탕 계열 · 글자 · 테두리 · 문서 전체 그림 역할.',
  '> 「보라」= 색상 225–300° · 채도 12%↑. 크림(따뜻한 명도 94%↑)은 무채. 게임(`/play/*`)은 요약 평균에서 뺐다(자기 미술).',
  '',
  '## 평균 — 우리 학습자 화면 ↔ 참조',
  '',
  '| 지표 | 우리 | 참조(151페이지 템플릿 가중 평균) |',
  '|---|---|---|',
  `| 보라 바탕(보이는 면적 %) | ${avg(learner, (r) => pct(r, '보라')).toFixed(0)} | 칠한 면 중 보라·파랑 ${tAvg('purplePct')?.toFixed(0) ?? '—'} (문서 면적 %) |`,
  `| 보라 외 색 바탕 % | ${avg(learner, (r) => pct(r, '그외')).toFixed(0)} | 칠한 면 중 그 외 색 ${tAvg('otherPct')?.toFixed(0) ?? '—'} |`,
  `| 소품(spot) / 화면 | ${avg(learner, (r) => r.roles.spot).toFixed(1)} | ${tAvg('spot')?.toFixed(1) ?? '—'} |`,
  `| 카드 그림 / 화면 | ${avg(learner, (r) => r.roles.card).toFixed(1)} | ${tAvg('card')?.toFixed(1) ?? '—'} |`,
  `| 히어로 그림 / 화면 | ${avg(learner, (r) => r.roles.hero).toFixed(1)} | ${tAvg('hero')?.toFixed(1) ?? '—'} |`,
  `| tines 삽화 파일 / 화면 | ${avg(learner, (r) => r.tinesArt).toFixed(1)} | — |`,
  '',
  '## 보라 바탕의 출처 (학습자 화면 합, 화면 면적 비율의 합)',
  '',
  '| 색 ← 요소.클래스 | 합(화면 몫) |',
  '|---|---|',
  ...topSrc.map(([k2, v]) => `| \`${k2.replace(/\|/g, '/')}\` | ${v.toFixed(2)} |`),
  '',
  '## 화면별',
  '',
  '| 화면 | 폭 | 도착 | 보라 % | 그외 % | 그림 % | 글자 보라 % | 테두리 보라 % | spot | card | hero | tines 삽화 |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...results.sort((a, b) => pct(b, '보라') - pct(a, '보라')).map((r) => {
    const it = r.ink.보라 + r.ink.그외 + r.ink.무채 || 1, bt = r.bd.보라 + r.bd.그외 + r.bd.무채 || 1
    return `| ${r.route} | ${r.vp} | ${r.landed === r.route ? '' : r.landed} | ${pct(r, '보라')} | ${pct(r, '그외')} | ${pct(r, '그림')} | ${Math.round((r.ink.보라 / it) * 100)} | ${Math.round((r.bd.보라 / bt) * 100)} | ${r.roles.spot} | ${r.roles.card} | ${r.roles.hero} | ${r.tinesArt} |`
  }),
  '',
]
fs.writeFileSync(MD, md.join('\n'))
console.log(path.relative(ROOT, MD))
