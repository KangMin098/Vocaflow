// scripts/design/capture-learner.mjs
//
// 학습자 화면 캡처 하네스 — 리디자인 before/after 를 같은 조건에서 찍는다.
//
// 왜 스크립트인가: "before/after 를 나란히" 는 **같은 라우트·같은 폭·같은 계정**에서
// 찍어야 비교가 성립한다. 손으로 찍으면 폭이 달라지고, 그 차이가 디자인 변화로 보인다.
//
// 사용:
//   node scripts/design/capture-learner.mjs --out docs/design/shots/before --routes /hub,/flashcard/play
//   node scripts/design/capture-learner.mjs --out <dir> --all        (70 라우트 전부)
// 전제: dev 서버가 이미 떠 있어야 한다(기본 http://localhost:3000). 이 워크스페이스는
//       여러 세션이 공유하므로 서버를 여기서 띄우거나 죽이지 않는다.

import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { DEFAULT_SCENE_TIME, freezeMotion, installFreezeMotion, settleImages } from './lib/freeze-motion.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const WEB = path.join(ROOT, 'apps/web')
// playwright 는 apps/web 에만 설치돼 있다 — 스크립트 위치가 아니라 거기서 찾는다.
const require_ = createRequire(path.join(WEB, 'package.json'))
const { chromium } = require_('@playwright/test')
const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:3000'
const USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD ?? (() => { throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local (CI: 저장소 시크릿)') })(),
}

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const outDir = path.resolve(ROOT, arg('out', 'docs/design/shots/tmp'))
const wantAll = args.includes('--all')
const only = arg('routes', '')
const widths = (arg('widths', '390,1440')).split(',').map(Number)
/** `--theme dark` — 셸이 읽는 저장값을 첫 프레임 전에 넣는다. 파일 이름에 `.dark` 가 붙는다. */
const theme = arg('theme', 'light')
const fullPage = !args.includes('--fold')

/** 학습자 라우트 — 파일 시스템에서 읽는다(e2e/utils/learner-routes.ts 와 같은 규칙). */
function learnerRoutes() {
  const appDir = (g) => path.join(WEB, 'src/app', g)
  const under = (base) => {
    if (!fs.existsSync(base)) return []
    const out = []
    const walk = (dir, url) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name)
        if (!fs.statSync(full).isDirectory()) continue
        if (name.startsWith('[')) continue
        if (name.startsWith('_') || name.startsWith('(')) { walk(full, url); continue }
        const child = `${url}/${name}`
        if (fs.existsSync(path.join(full, 'page.tsx'))) out.push(child)
        walk(full, child)
      }
    }
    walk(base, '')
    return out
  }
  const skip = new Set(['/hub-lab', '/teacher'])
  const set = new Set()
  for (const g of ['(main)', '(app)']) for (const r of under(appDir(g))) set.add(r)
  return [...set].filter((r) => !skip.has(r)).sort()
}

const routes = only ? only.split(',') : wantAll ? learnerRoutes() : ['/hub', '/flashcard/play', '/wordvault/browse']

const slug = (r) => (r === '/' ? 'root' : r.slice(1).replace(/\//g, '_'))

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  await page.fill('input[type="email"]', USER.email)
  await page.fill('input[type="password"]', USER.password)
  await page.click('button[type="submit"]')
  // dev 서버에서 로그인 직후 목적지(/hub)가 처음 컴파일되면 15초 이상 걸린다 — 인증은 이미
  // 200 으로 끝났는데 **이동만** 늦는 것이라, 짧은 한도는 성공을 실패로 적는다(실측 2026-09-16).
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 150_000 })
}

/**
 * 로그인 상태를 파일에 남겨 **재사용**한다.
 *
 * ⚠️ 실행마다 새로 로그인하면 Supabase 인증 엔드포인트의 시간당 한도에 걸린다 —
 *    실측 2026-09-16: 30분 사이 열 번쯤 캡처를 돌리자 로그인이 "로그인 중…" 에서
 *    멈추고 45초 타임아웃으로 죽기 시작했다. 앱 결함처럼 보이지만 **재는 쪽의 문제**다.
 *    (이 워크스페이스는 검증 계정 하나를 여러 세션이 공유하므로 남의 실행도 같은 한도를 쓴다.)
 */
const STATE_FILE = path.join(ROOT, 'apps/web/playwright-auth/.auth-design-capture.json')
const STATE_TTL_MS = 25 * 60 * 1000

const run = async () => {
  const startedAt = new Date().toISOString()
  fs.mkdirSync(outDir, { recursive: true })
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
  const browser = await chromium.launch()
  const fresh =
    fs.existsSync(STATE_FILE) && Date.now() - fs.statSync(STATE_FILE).mtimeMs < STATE_TTL_MS
  let ctx
  if (fresh) {
    ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: STATE_FILE })
    // ⚠️ 파일 나이만 보고 믿지 않는다. 공유 계정이라 다른 세션 로그인이 이쪽 토큰을 회전시키면
    //    **파일은 새것인데 세션은 죽어 있다.** 한 번 열어 보고, 죽었으면 다시 로그인한다.
    const probe = await ctx.newPage()
    await probe.goto(`${BASE}/hub`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await probe.waitForTimeout(2500)
    const alive = !new URL(probe.url()).pathname.startsWith('/login')
    await probe.close()
    if (alive) {
      console.log('저장된 로그인 상태 재사용 (확인함)')
    } else {
      console.log('저장된 상태가 죽어 있다 — 다시 로그인한다')
      await ctx.close()
      ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      await login(page)
      await page.close()
      await ctx.storageState({ path: STATE_FILE })
    }
  } else {
    ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await login(page)
    await page.close()
    await ctx.storageState({ path: STATE_FILE })
  }

  const report = []
  for (const w of widths) {
    const c = await browser.newContext({
      viewport: { width: w, height: w <= 430 ? 844 : 900 },
      storageState: await ctx.storageState(),
      deviceScaleFactor: 1,
      isMobile: w <= 430,
      hasTouch: w <= 430,
    })
    const p = await c.newPage()
    // 첫 프레임부터 모션을 세운다 — 연 **뒤**에 거는 것만으로는 이미 돌던 루프가 안 되감긴다.
    await installFreezeMotion(p, Number(arg('scene-time', DEFAULT_SCENE_TIME)))
    await p.addInitScript((t) => { try { localStorage.setItem('vocaflow-theme', t) } catch {} }, theme)
    for (const r of routes) for (let attempt = 0; attempt < 2; attempt++) {
      const file = path.join(outDir, `${slug(r)}@${w}${theme === 'dark' ? '.dark' : ''}.png`)
      try {
        await p.goto(`${BASE}${r}`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
        // 주소가 멈출 때까지(클라이언트 리다이렉트) + 폰트·데이터 도착까지
        // 느린 화면(첫 컴파일·서버 조회)은 2.6초로 부족하다 — 스피너가 찍힌다.
        await p.waitForTimeout(Number(arg('wait', 2600)))
        // 클라이언트 리다이렉트(/library → /library/books 등)가 늦게 오면 다음 evaluate 가 「컨텍스트 파괴」로 죽는다 —
        // 주소가 멈출 때까지 한 번 더 기다린다.
        await p.waitForLoadState('load').catch(() => {})
        await p.waitForTimeout(800)
        const landed = new URL(p.url()).pathname

        // ⚠️ **로그인으로 튕긴 화면을 찍지 않는다.**
        //    2026-09-16 실측: 저장된 로그인 상태가 만료된 채 재사용되자 다섯 라우트가 전부
        //    /login 으로 갔는데, 하네스는 그걸 `✓` 로 적고 **멀쩡하던 after 캡처 위에
        //    로그인 화면을 덮어썼다.** 못 잰 것을 통과로 세는 계측기는 없느니만 못하다
        //    (같은 원칙을 `measure-identity.mjs` 는 처음부터 지키고 있었다 — 분모에서 뺀다).
        // 공유 계정이라 다른 세션 로그인이 토큰을 회전시키면 **중간에** 세션이 죽는다(2026-10-04: 146장 중 100장 이상 튕김).
        //    튕기면 같은 페이지에서 다시 로그인하고 그 라우트를 한 번 더 연다 — 그래도 튕기면 아래에서 실패로 센다.
        if (landed.startsWith('/login') && !r.startsWith('/login') && !p.__relogged) {
          p.__relogged = true
          try {
            await login(p)
            await p.goto(`${BASE}${r}`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
            await p.waitForTimeout(Number(arg('wait', 2600)))
            await p.waitForLoadState('load').catch(() => {})
          } finally {
            // 재시도가 throw 해도 다음 라우트는 다시 재로그인할 수 있어야 한다
            p.__relogged = false
          }
        }
        const landedAfter = new URL(p.url()).pathname
        if (landedAfter.startsWith('/login') && !r.startsWith('/login')) {
          report.push({ route: r, requested: r, final: landedAfter, width: w, theme, landed: landedAfter, ok: false, error: '로그인으로 튕김(재로그인 후에도) — 찍지 않음' })
          process.stdout.write(`✗ ${r} @${w} — 로그인으로 튕겼다(세션 만료). 기존 파일 보존\n`)
          break
        }

        // 같은 화면을 두 번 찍으면 같아야 한다 — 그걸 깨는 둘을 여기서 닫는다.
        // (지연 표지 · 앰비언트 루프. 이유와 값은 `lib/freeze-motion.mjs` 에.)
        const imgs = await settleImages(p)
        await freezeMotion(p, Number(arg('scene-time', DEFAULT_SCENE_TIME)))
        // 가로 넘침 — PC 검증 항목(가로 스크롤이 생기면 그 화면은 실패로 본다)
        const overflowX = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        await p.screenshot({ path: file, fullPage })
        // 가로 넘침이 있으면 찍기는 하되 실패로 센다(PC 검증 기준)
        report.push({ route: r, requested: r, final: landedAfter, file: path.relative(ROOT, file), width: w, theme, landed: landedAfter, ok: overflowX <= 0, overflowX, images: imgs, ...(overflowX > 0 ? { error: `가로 넘침 ${overflowX}px` } : {}) })
        process.stdout.write(
          `${overflowX > 0 ? `✗ (가로 넘침 ${overflowX}px)` : '✓'} ${r} @${w}${landedAfter !== r ? ` → ${landedAfter}` : ''}` +
          `${imgs.pending > 0 ? ` · ⚠ 그림 ${imgs.pending}/${imgs.total} 못 받음(캡처가 흔들릴 수 있다)` : ''}\n`,
        )
        break
      } catch (e) {
        // 리다이렉트가 측정 도중 끼어들면(컨텍스트 파괴 · ERR_ABORTED) 그 화면 탓이 아니다 — 한 번만 다시 연다.
        if (attempt === 0 && /Execution context was destroyed|ERR_ABORTED/.test(String(e))) {
          process.stdout.write(`↻ ${r} @${w} — 리다이렉트 타이밍, 재시도\n`)
          continue
        }
        report.push({ route: r, requested: r, final: (() => { try { return new URL(p.url()).pathname } catch { return null } })(), width: w, theme, ok: false, error: String(e).slice(0, 120) })
        process.stdout.write(`✗ ${r} @${w} — ${String(e).slice(0, 90)}\n`)
        break
      }
    }
    await c.close()
  }
  await ctx.close()
  await browser.close()
  // 어느 코드에서 나온 캡처인지 역추적할 수 있게 — 실행 메타(커밋 · 작업트리 변경 여부 · 스크립트 해시 · 시각)를 함께 남긴다.
  const sh = (c) => { try { return execSync(c, { cwd: ROOT }).toString().trim() } catch { return null } }
  const meta = {
    gitSha: sh('git rev-parse HEAD'),
    dirty: (sh('git status --porcelain -- apps/web/src packages/design-tokens/src') ?? '').length > 0,
    scriptSha: crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex').slice(0, 12),
    startedAt, finishedAt: new Date().toISOString(), base: BASE, widths, theme,
  }
  fs.writeFileSync(path.join(outDir, `_report.${theme}.json`), JSON.stringify({ meta, results: report }, null, 2))
  fs.writeFileSync(path.join(outDir, '_report.json'), JSON.stringify(report, null, 2))
  const ok = report.filter((r) => r.ok).length
  console.log(`\n캡처 ${ok}/${report.length} → ${outDir}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
