#!/usr/bin/env node
// scripts/design/extract-components.mjs
//
// 참조 사이트의 **컴포넌트 전수 목록**(DD-68) — 구간 목록(`extract-sections`)보다 한 단계 아래.
// 구간 목록이 고른 33페이지를 다시 열어 ① 페이지가 실은 모든 스타일시트에서 CSS 모듈 이름
// (`Name-module-scss-module__…`)을 모으고 ② 각 이름이 **실제 DOM 에 몇 번, 어느 페이지에** 나오는지,
// 무엇으로 그려지는지(태그 · 역할 · 상호작용 상태 선택자 · 대표 크기 · 색)를 잰다.
//
//   node scripts/design/extract-components.mjs
//
// 산출: docs/design/refs/tines/components.json · components-summary.md (이름·수치만 — CSS 원문 0)
// 계열 분류(내비 · 버튼 · 카드 · 폼 · 모달 …)는 이름 규칙으로 기계가 먼저 하고, 매핑은 사람이 한다.

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { ROOT, chromium, dismissOverlays, settle } from './lib/ref-page.mjs'

const require = createRequire(import.meta.url)
const postcss = require(require.resolve('postcss', { paths: [path.join(ROOT, 'apps/web')] }))
const OUT = path.join(ROOT, 'docs/design/refs/tines')
const BASE = 'https://www.tines.com'
const sections = JSON.parse(fs.readFileSync(path.join(OUT, 'sections.json'), 'utf8'))
const PAGES = sections.pages.map((p) => [p.key, p.url])

/** 이름 → 계열. 참조 사이트 이름 규칙에서 뽑았다(정규식 순서가 우선순위). */
const FAMILIES = [
  ['내비 · 헤더', /Nav|Header|Menu|Breadcrumb|Announcement/i],
  ['푸터', /Footer/i],
  ['검색', /Search/i],
  ['모달 · 팝업 · 툴팁', /Modal|Dialog|Popover|Popup|Tooltip|Overlay|Drawer|Lightbox|Toast|Cookie/i],
  ['버튼 · 링크', /Button|Cta(?!Section)|Link(?!edIn)|Chip|Pill|Toggle/i],
  ['폼 · 입력', /Form|Input|Field(?!Flowers)|Checkbox|Radio|Select|Textarea|Newsletter|Signup|Subscribe/i],
  ['탭 · 펼침 · 캐러셀', /Tab|Accordion|Faq|Collapse|Carousel|Slider|Marquee|Scrubber|Dial/i],
  ['표 · 목록 · 격자', /Table|List|Grid|Directory|Matrix|Bento|Collection/i],
  ['카드', /Card|Tile|Entry|Excerpt|Teaser/i],
  ['히어로 · 머리', /Hero|Heading|Kicker|Byline|Title|Intro/i],
  ['CTA 띠', /CTASection|CtaSection|Explosion|Coda/i],
  ['매체 · 삽화', /Image|Img|Video|Player|Illustration|Visual|Svg|Icon|Avatar|Logo|Mascot|Flower|Canvas|Map|Constellation|Cursor|Field/i],
  ['본문 · 서식', /Article|Content|Prose|Rich|Formatting|Quote|Text|Markdown/i],
  ['구간 틀', /Section|Page|Backdrop|Layout|Container|Wrapper|Shell/i],
]
const familyOf = (name) => (FAMILIES.find(([, re]) => re.test(name)) ?? ['기타'])[0]

// ── 페이지 안: DOM 에 실제로 있는 이름과 그 모습 ──────────────────
function domCensus() {
  const MOD = /([A-Z][A-Za-z0-9]+)-module-scss-module__[\w-]+?__([\w-]+)/g
  const out = {}
  for (const el of document.querySelectorAll('[class*="-module-scss-module__"]')) {
    const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') || ''
    const seen = new Set()
    for (const m of cls.matchAll(MOD)) {
      const name = m[1]
      if (seen.has(name)) continue
      seen.add(name)
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      const o = (out[name] ??= { n: 0, parts: new Set(), tags: {}, roles: {}, w: [], h: [], bg: {}, radius: {}, font: {}, interactive: 0 })
      o.n++
      o.parts.add(m[2])
      o.tags[el.tagName.toLowerCase()] = (o.tags[el.tagName.toLowerCase()] || 0) + 1
      const role = el.getAttribute('role'); if (role) o.roles[role] = (o.roles[role] || 0) + 1
      if (r.width > 0 && o.w.length < 40) { o.w.push(Math.round(r.width)); o.h.push(Math.round(r.height)) }
      if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') o.bg[s.backgroundColor] = (o.bg[s.backgroundColor] || 0) + 1
      if (s.borderRadius !== '0px') o.radius[s.borderRadius] = (o.radius[s.borderRadius] || 0) + 1
      const f = `${s.fontFamily.split(',')[0].replace(/["']/g, '')} ${s.fontSize}/${s.fontWeight}`
      o.font[f] = (o.font[f] || 0) + 1
      if (el.matches('a, button, input, select, textarea, [tabindex], [role="button"], [role="tab"], summary')) o.interactive++
    }
  }
  for (const o of Object.values(out)) o.parts = [...o.parts]
  return out
}

const browser = await chromium.launch()
const sheets = new Map()
const census = {}
for (const [key, url] of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const pending = []
  page.on('response', (res) => {
    if (res.request().resourceType() !== 'stylesheet' || sheets.has(res.url())) return
    pending.push(res.text().then((t) => sheets.set(res.url(), t)).catch(() => {}))
  })
  try {
    try { await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45_000 }) }
    catch { await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 60_000 }); await page.waitForTimeout(5000) }
    await dismissOverlays(page)
    await settle(page)
    await Promise.all(pending)
    const c = await page.evaluate(domCensus)
    for (const [name, o] of Object.entries(c)) {
      const t = (census[name] ??= { pages: [], n: 0, parts: new Set(), tags: {}, roles: {}, w: [], h: [], bg: {}, radius: {}, font: {}, interactive: 0 })
      t.pages.push(key); t.n += o.n; o.parts.forEach((p) => t.parts.add(p)); t.interactive += o.interactive
      for (const k of ['tags', 'roles', 'bg', 'radius', 'font']) for (const [v, n] of Object.entries(o[k])) t[k][v] = (t[k][v] || 0) + n
      if (t.w.length < 40) { t.w.push(...o.w.slice(0, 10)); t.h.push(...o.h.slice(0, 10)) }
    }
    console.log(`${key.padEnd(20)} 컴포넌트 ${String(Object.keys(c).length).padStart(3)} · 누적 시트 ${sheets.size}`)
  } catch (e) { console.log(`${key.padEnd(20)} FAIL ${e.message.split('\n')[0]}`) }
  await ctx.close()
}
await browser.close()

// ── CSS 쪽: 이름마다 상호작용 상태 선택자 · 반응형 분기 · 모션 ────────
const cssInfo = {}
for (const [, src] of sheets) {
  let root
  try { root = postcss.parse(src) } catch { continue }
  root.walkRules((r) => {
    for (const m of r.selector.matchAll(/([A-Z][A-Za-z0-9]+)-module-scss-module__/g)) {
      const o = (cssInfo[m[1]] ??= { rules: 0, states: new Set(), media: new Set(), motion: false })
      o.rules++
      for (const st of [':hover', ':focus-visible', ':focus', ':active', ':disabled', '[aria-expanded', '[aria-selected', '[data-state', ':checked', '::placeholder', '[open]']) if (r.selector.includes(st)) o.states.add(st.replace('[', ''))
      if (r.parent?.type === 'atrule' && r.parent.name === 'media') o.media.add(r.parent.params.replace(/\s+/g, ''))
      r.walkDecls((d) => { if (/^(transition|animation)/.test(d.prop) && d.value !== 'none') o.motion = true })
    }
  })
}

const top = (obj, n = 3) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k)
const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : null)
const names = new Set([...Object.keys(census), ...Object.keys(cssInfo)])
const components = [...names].map((name) => {
  const d = census[name], c = cssInfo[name]
  return {
    name, family: familyOf(name),
    inDom: !!d, pages: d ? d.pages.length : 0, pageKeys: d ? d.pages : [], occurrences: d ? d.n : 0,
    parts: d ? [...d.parts].slice(0, 12) : [], tags: d ? top(d.tags) : [], roles: d ? top(d.roles) : [],
    width: d ? median(d.w) : null, height: d ? median(d.h) : null,
    bg: d ? top(d.bg, 2) : [], radius: d ? top(d.radius, 2) : [], font: d ? top(d.font, 2) : [], interactive: d ? d.interactive : 0,
    cssRules: c ? c.rules : 0, states: c ? [...c.states] : [], breakpoints: c ? [...c.media].slice(0, 5) : [], motion: c ? c.motion : false,
  }
}).sort((a, b) => b.pages - a.pages || b.occurrences - a.occurrences || a.name.localeCompare(b.name))

const byFamily = {}
for (const c of components) (byFamily[c.family] ??= []).push(c)
const data = { generatedBy: 'scripts/design/extract-components.mjs', generatedAt: new Date().toISOString().slice(0, 10), pages: PAGES.length, sheets: sheets.size, totals: { names: components.length, inDom: components.filter((c) => c.inDom).length }, families: Object.fromEntries(Object.entries(byFamily).map(([k, v]) => [k, v.length])), components }
fs.writeFileSync(path.join(OUT, 'components.json'), JSON.stringify(data, null, 2) + '\n')

const L = ['# 참조 사이트 — 컴포넌트 전수 목록', '',
  `> 생성 \`scripts/design/extract-components.mjs\` · ${data.generatedAt} · 손으로 고치지 말 것. 이름·수치만(CSS 원문 0).`,
  `> ${PAGES.length}페이지 · 스타일시트 ${sheets.size} · 이름 ${components.length}(DOM 에 실재 ${data.totals.inDom}). 계열은 이름 규칙으로 기계 분류. 매핑은 \`docs/design/tines-mapping.md\`.`, '',
  '## 계열별 개수', '', '| 계열 | 이름 수 | DOM 실재 | 여러 페이지(≥3) |', '|---|---|---|---|']
for (const [f] of [...FAMILIES, ['기타']]) { const v = byFamily[f] || []; if (v.length) L.push(`| ${f} | ${v.length} | ${v.filter((c) => c.inDom).length} | ${v.filter((c) => c.pages >= 3).length} |`) }
for (const [f] of [...FAMILIES, ['기타']]) {
  const v = (byFamily[f] || []).filter((c) => c.inDom)
  if (!v.length) continue
  L.push('', `## ${f} (${v.length})`, '', '| 컴포넌트 | 페이지 | 등장 | 태그 · 역할 | 대표 크기 | 모서리 | 서체 | 상태 선택자 | 모션 |', '|---|---|---|---|---|---|---|---|---|')
  for (const c of v.slice(0, 40)) L.push(`| ${c.name} | ${c.pages} | ${c.occurrences} | ${[...c.tags, ...c.roles.map((r) => `role=${r}`)].join(' ')} | ${c.width ?? '—'}×${c.height ?? '—'} | ${c.radius.join(' ') || '—'} | ${c.font[0] ?? '—'} | ${c.states.join(' ') || '—'} | ${c.motion ? '○' : '—'} |`)
  if (v.length > 40) L.push(`| … ${v.length - 40}개 더 — components.json | | | | | | | | |`)
}
fs.writeFileSync(path.join(OUT, 'components-summary.md'), L.join('\n') + '\n')
console.log(`\n이름 ${components.length} · DOM 실재 ${data.totals.inDom} · 시트 ${sheets.size}`)
console.log(Object.entries(data.families).map(([k, v]) => `${k} ${v}`).join(' · '))
