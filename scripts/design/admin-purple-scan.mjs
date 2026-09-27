#!/usr/bin/env node
// scripts/design/admin-purple-scan.mjs
//
// /admin 화면의 **계산된** 색에서 보라 계열(색상 245~320°, 채도 있는 것)을 센다(DD-82 검증).
// 소스 grep 은 토큰이 무엇으로 풀리는지 모른다 — 화면이 실제로 칠하는 값을 본다. 서체도 함께 적는다.
//
//   node --env-file=apps/web/.env.local scripts/design/admin-purple-scan.mjs /admin /admin/users [--theme dark]
//
// 로그인 상태는 shot-authed.mjs 가 만든 tmp/authed-state.json 을 쓴다(없으면 그것부터 한 번 돌린다).
// 산출: 경로마다 보라 칠 개수 + 상위 5건(요소·속성·값). 보라가 하나라도 있으면 exit 1.

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
const BASE = flag('--base', 'http://localhost:3000')
const THEME = flag('--theme', 'light')
const routes = argv.filter((a, i) => a.startsWith('/') && !['--base', '--theme'].includes(argv[i - 1]))
const STATE = path.join(ROOT, 'tmp/authed-state.json')
if (!fs.existsSync(STATE)) { console.error('tmp/authed-state.json 이 없다 — shot-authed.mjs 를 먼저 한 번 돌린다'); process.exit(3) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: STATE })
let total = 0
for (const r of routes) {
  const page = await ctx.newPage()
  if (THEME === 'dark') await page.addInitScript(() => { try { localStorage.setItem('theme', 'dark') } catch {} ; document.documentElement.setAttribute('data-theme', 'dark') })
  // 폴링하는 화면은 networkidle 에 영영 닿지 않는다 — load 까지 기다리고 idle 은 짧게만 기다린다.
  await page.goto(`${BASE}${r}`, { waitUntil: 'load', timeout: 180_000 })
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  if (THEME === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await page.waitForTimeout(600)
  const res = await page.evaluate(() => {
    const cv = document.createElement('canvas').getContext('2d')
    const rgb = (s) => { cv.fillStyle = '#000'; cv.fillStyle = s; const v = cv.fillStyle; if (v.startsWith('#')) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)); const m = v.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : null }
    const purple = (s) => {
      if (!s || s === 'none' || s.includes('rgba(0, 0, 0, 0)')) return false
      for (const part of s.match(/(rgba?\([^)]*\)|#[0-9a-f]{3,8}|color\([^)]*\)|oklab\([^)]*\)|oklch\([^)]*\))/gi) || []) {
        if (/rgba\([^)]*,\s*0\)$/.test(part)) continue
        const c = rgb(part); if (!c) continue
        const [r, g, b] = c.map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
        if (mx - mn < 0.1) continue
        let h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4
        h = (h * 60 + 360) % 360
        if (h >= 245 && h <= 320) return part
      }
      return false
    }
    const hits = []; const fonts = {}
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect(); if (!rect.width || !rect.height) continue
      const s = getComputedStyle(el)
      if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) { const f = s.fontFamily.split(',')[0]; fonts[f] = (fonts[f] || 0) + 1 }
      for (const p of ['color', 'backgroundColor', 'borderTopColor', 'borderLeftColor', 'outlineColor', 'boxShadow', 'fill', 'stroke', 'backgroundImage']) {
        if (p.startsWith('border') && s[p.replace('Color', 'Width')] === '0px') continue
        const v = purple(s[p]); if (v) hits.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} ${p}=${v}`)
      }
    }
    return { hits, fonts: Object.entries(fonts).sort((a, b) => b[1] - a[1]).slice(0, 4) }
  })
  total += res.hits.length
  console.log(`${r} [${THEME}] · 보라 ${res.hits.length} · 서체 ${res.fonts.map(([f, n]) => `${f}×${n}`).join(' ')}`)
  for (const h of res.hits.slice(0, 5)) console.log(`   ${h}`)
  await page.close()
}
await browser.close()
process.exit(total ? 1 : 0)
