#!/usr/bin/env node
// scripts/design/admin-restyle-shots.mjs
//
// /admin 스타일 교체(DD-82)의 **라우트별 전/후 캡처**. 같은 로그인 상태로 두 서버를 찍는다 —
// 적용 전 = 교체 직전 커밋을 띄운 worktree 서버, 적용 후 = 지금 서버.
//
//   node scripts/design/admin-restyle-shots.mjs --base http://localhost:3137 --tag before
//   node scripts/design/admin-restyle-shots.mjs --base http://localhost:3000 --tag after
//   node scripts/design/admin-restyle-shots.mjs --tag after --only /drain     # 그 경로만 다시(기록은 합친다)
//
// 라우트: docs/design/shots/admin-restyle/routes.txt(한 줄에 하나 · 동적 라우트는 실제 id).
// 로그인: tmp/authed-state.json(shot-authed.mjs 가 만든다 — 쿠키는 포트를 가리지 않아 두 서버에 같이 쓴다).
// 산출: docs/design/shots/admin-restyle/<tag>/NN-<경로>.png (gitignore — 실데이터가 찍힌다) + <tag>.json(상태·도착 경로).
// 재실행 안전: 같은 파일 이름을 덮는다. --only 는 다른 경로의 기록을 지우지 않는다.

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium } from './lib/ref-page.mjs'
import { installFreezeMotion } from './lib/freeze-motion.mjs'

const argv = process.argv.slice(2)
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
const BASE = flag('--base', 'http://localhost:3000')
const TAG = flag('--tag', 'after')
const ONLY = flag('--only', '')
const DIR = path.join(ROOT, 'docs/design/shots/admin-restyle')
const STATE = path.join(ROOT, 'tmp/authed-state.json')
const routes = fs.readFileSync(path.join(DIR, 'routes.txt'), 'utf8').split(/\r?\n/).filter(Boolean)
const OUT = path.join(DIR, TAG)
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: STATE })
const log = []
for (const [i, r] of routes.entries()) {
  if (ONLY && !r.includes(ONLY)) continue
  const page = await ctx.newPage()
  await installFreezeMotion(page)
  const name = `${String(i + 1).padStart(2, '0')}-${r.replace(/^\/admin\/?/, '').replace(/[/?=&]+/g, '_') || 'dashboard'}`
  let status = 'ERR'
  try {
    // 폴링하는 화면은 networkidle 에 영영 닿지 않는다 — load 까지 기다리고 idle 은 짧게만 기다린다.
    const res = await page.goto(`${BASE}${r}`, { waitUntil: 'load', timeout: 180_000 })
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    status = res?.status() ?? 'ERR'
    await page.waitForTimeout(800)
    await page.screenshot({ path: path.join(OUT, `${name}.png`) })
  } catch (e) {
    status = `ERR ${String(e.message).split('\n')[0].slice(0, 80)}`
  }
  const landed = new URL(page.url()).pathname
  log.push({ route: r, file: `${name}.png`, status, landed })
  console.log(`${TAG} ${String(i + 1).padStart(2)}/${routes.length} ${status} ${r}${landed !== r ? ` → ${landed}` : ''}`)
  await page.close()
}
const logPath = path.join(DIR, `${TAG}.json`)
const prev = ONLY && fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : []
const merged = [...prev.filter((p) => !log.some((l) => l.route === p.route)), ...log].sort((a, b) => a.file.localeCompare(b.file))
fs.writeFileSync(logPath, JSON.stringify(merged, null, 1))
await browser.close()
