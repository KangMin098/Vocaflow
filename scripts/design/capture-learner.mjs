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
    for (const r of routes) {
      const file = path.join(outDir, `${slug(r)}@${w}.png`)
      try {
        await p.goto(`${BASE}${r}`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
        // 주소가 멈출 때까지(클라이언트 리다이렉트) + 폰트·데이터 도착까지
        // 느린 화면(첫 컴파일·서버 조회)은 2.6초로 부족하다 — 스피너가 찍힌다.
        await p.waitForTimeout(Number(arg('wait', 2600)))
        const landed = new URL(p.url()).pathname

        // ⚠️ **로그인으로 튕긴 화면을 찍지 않는다.**
        //    2026-09-16 실측: 저장된 로그인 상태가 만료된 채 재사용되자 다섯 라우트가 전부
        //    /login 으로 갔는데, 하네스는 그걸 `✓` 로 적고 **멀쩡하던 after 캡처 위에
        //    로그인 화면을 덮어썼다.** 못 잰 것을 통과로 세는 계측기는 없느니만 못하다
        //    (같은 원칙을 `measure-identity.mjs` 는 처음부터 지키고 있었다 — 분모에서 뺀다).
        if (landed.startsWith('/login') && !r.startsWith('/login')) {
          report.push({ route: r, width: w, landed, ok: false, error: '로그인으로 튕김 — 찍지 않음' })
          process.stdout.write(`✗ ${r} @${w} — 로그인으로 튕겼다(세션 만료). 기존 파일 보존\n`)
          continue
        }

        // 같은 화면을 두 번 찍으면 같아야 한다 — 그걸 깨는 둘을 여기서 닫는다.
        // (지연 표지 · 앰비언트 루프. 이유와 값은 `lib/freeze-motion.mjs` 에.)
        const imgs = await settleImages(p)
        await freezeMotion(p, Number(arg('scene-time', DEFAULT_SCENE_TIME)))
        await p.screenshot({ path: file, fullPage })
        report.push({ route: r, width: w, landed, ok: true, images: imgs })
        process.stdout.write(
          `✓ ${r} @${w}${landed !== r ? ` → ${landed}` : ''}` +
          `${imgs.pending > 0 ? ` · ⚠ 그림 ${imgs.pending}/${imgs.total} 못 받음(캡처가 흔들릴 수 있다)` : ''}\n`,
        )
      } catch (e) {
        report.push({ route: r, width: w, ok: false, error: String(e).slice(0, 120) })
        process.stdout.write(`✗ ${r} @${w} — ${String(e).slice(0, 90)}\n`)
      }
    }
    await c.close()
  }
  await ctx.close()
  await browser.close()
  fs.writeFileSync(path.join(outDir, '_report.json'), JSON.stringify(report, null, 2))
  const ok = report.filter((r) => r.ok).length
  console.log(`\n캡처 ${ok}/${report.length} → ${outDir}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
