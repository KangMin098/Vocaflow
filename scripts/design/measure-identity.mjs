// scripts/design/measure-identity.mjs
//
// 「이 화면이 우리 화면인가」를 **숫자로** 잰다 — 리디자인 전후를 같은 자로 비교하기 위한 계측기.
//
// 왜 필요한가: "다른 학습 앱과 확실히 다르다" 는 그대로는 루프가 돌지 않는 목표다.
// 그래서 00-inventory 가 지목한 결함 C1~C9 를 **관측 가능한 다섯 축**으로 옮겼다:
//
//   M1 한글 웹폰트 도달률 — 한글 텍스트 노드 중 실제 웹폰트 스택으로 그려지는 비율
//                          (이전 실측 0% — 폰트 4종이 전부 latin subset 이었다)
//   M2 브랜드 색 존재     — 주묵(--ju)이 화면에 **면적으로** 있는가 (요소 수)
//   M3 형태 단일성        — 한 화면에 섞인 radius 종류 수 / 최대값
//   M4 잉크 단조도        — 가장 많이 쓰인 글자색 하나가 차지하는 비율(낮을수록 색이 있다)
//   M5 이모지 UI          — 화면 텍스트에 남은 이모지 개수(브랜드 자산이 아닌 것)
//
// ⚠️ **못 잰 것을 통과로 세지 않는다.** 화면이 안 열리면 그 라우트는 분모에서 뺀다.
//    분모는 항상 출력한다.
//
// 사용: node scripts/design/measure-identity.mjs [--routes a,b,c] [--all] [--width 390]
// 전제: dev 서버가 이미 떠 있어야 한다. 로그인 상태는 캡처 하네스와 같은 파일을 재사용한다.

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const WEB = path.join(ROOT, 'apps/web')
const require_ = createRequire(path.join(WEB, 'package.json'))
const { chromium } = require_('@playwright/test')

const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:3000'
const USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD ?? (() => { throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local (CI: 저장소 시크릿)') })(),
}
const STATE_FILE = path.join(WEB, 'playwright-auth/.auth-design-capture.json')
const STATE_TTL_MS = 25 * 60 * 1000

const args = process.argv.slice(2)
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 ? args[i + 1] : d
}
const width = Number(arg('width', 390))
const outFile = arg('out', '')

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

const routes = args.includes('--all')
  ? learnerRoutes()
  : (arg('routes', '/hub,/dashboard,/flashcard/play,/wordvault/browse,/library,/settings')).split(',')

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  await page.fill('input[type="email"]', USER.email)
  await page.fill('input[type="password"]', USER.password)
  await page.click('button[type="submit"]')
  // dev 서버에서 목적지(/hub)가 처음 컴파일되면 15초 이상 걸린다 — 인증은 이미 끝났는데
  // **이동만** 늦는 것이라 짧은 한도는 성공을 실패로 적는다(실측 2026-09-16).
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 150_000 })
}

/** 브라우저 안에서 도는 계측 — 소스가 아니라 **그려진 결과**를 본다. */
const PROBE = () => {
  const HANGUL = /[가-힣]/
  // 브랜드 자산이 아닌 **그림문자**만 본다.
  // ⚠️ 처음엔 Dingbats 전체(U+2600–27BF)를 셌는데 `✓`(U+2713)·`✗`(U+2717)까지 이모지로
  //    찍혔다(실측 2026-09-16 `/dashboard` 3건). 그 둘은 그림이 아니라 **활자 기호**이고
  //    v07 이 표식으로 쓰는 것이기도 하다 — 세면 지표가 자기 목표와 싸운다.
  //    체크·엑스·곱셈·가운뎃점·줄임표·괘선은 분모에서 뺀다.
  //    ❧(U+2767, 인쇄 화관)도 같다 — 판면의 장식 괘이지 그림문자가 아니다(실측 2026-09-17 /library/vocab 7건).
  const TYPOGRAPHIC = /[✓✔✖✗✘×•…─-╿❧]/g
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu
  /** 활자 기호를 걷어낸 뒤 남은 그림문자 개수. */
  const emojiCount = (t) => (t.replace(TYPOGRAPHIC, '').match(EMOJI) || []).length
  // next/font 가 주입하는 이름은 `__<Font>_<hash>` 꼴이다. 이 이름이 스택 맨 앞에 있으면
  // 웹폰트가 그 노드를 맡고 있다는 뜻.
  const WEBFONT = /__(Lora|Hahmlet|IBM_Plex_Sans_KR|JetBrains_Mono)_/

  const main = document.querySelector('main') || document.body
  /**
   * M6 «세로로 선 글자» — 글자 상자가 너무 좁아 **한 줄에 한 글자씩** 떨어지는 자리.
   *
   * 왜 이 축이 생겼나(실측 2026-09-16): 한글 UI 글꼴을 OS 기본 고딕에서 IBM Plex Sans KR 로
   * 바꾸자 글자가 조금 넓어졌고, **원래 아슬아슬하던 배치가 터졌다** — /settings 의
   * 「능동적 회상 대기 시간」이 세로 한 줄로 섰다. 글꼴 탓이 아니라 배치가 원래 빠듯했던 것인데,
   * **화면은 멀쩡히 뜨므로 테스트도 타입체크도 못 잡는다.** 눈으로 보거나 이렇게 재야 한다.
   *
   * 판정: 글자 2자 이상인데 상자 폭이 글자 크기의 2배 미만 → 세로로 섰다.
   */
  const vertical = []
  let korean = 0
  let koreanWebfont = 0
  let emoji = 0
  const inks = {}
  const radii = {}
  let juElements = 0
  let juArea = 0

  const walk = (n) => {
    for (const ch of n.childNodes) {
      if (ch.nodeType === 3) {
        const t = ch.textContent.trim()
        if (!t) continue
        const el = ch.parentElement
        if (!el) continue
        const s = getComputedStyle(el)
        inks[s.color] = (inks[s.color] || 0) + 1
        emoji += emojiCount(t)
        if (t.length >= 2) {
          const r = el.getBoundingClientRect()
          const fs2 = parseFloat(s.fontSize) || 14
          if (r.width > 0 && r.width < fs2 * 2 && r.height > fs2 * 2.2) {
            vertical.push({ t: t.slice(0, 18), w: Math.round(r.width), h: Math.round(r.height), cls: (el.className || '').toString().slice(0, 60) })
          }
        }
        if (HANGUL.test(t)) {
          korean++
          // 한글을 실제로 그리는 글꼴은 스택에서 **한글 글리프를 가진 첫 글꼴**이다.
          // Lora/JetBrains 는 한글이 없으므로 그 둘만 있는 스택은 도달 실패로 센다.
          const fam = s.fontFamily
          const hasKoreanCapable = /__(Hahmlet|IBM_Plex_Sans_KR)_/.test(fam)
          if (hasKoreanCapable) koreanWebfont++
        }
      } else if (ch.nodeType === 1) walk(ch)
    }
  }
  walk(main)

  const root = getComputedStyle(document.documentElement)
  const ju = root.getPropertyValue('--ju').trim()
  const juRgb = (() => {
    const d = document.createElement('div')
    d.style.color = ju
    document.body.appendChild(d)
    const c = getComputedStyle(d).color
    d.remove()
    return c
  })()

  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width < 6 || r.height < 6) continue
    const s = getComputedStyle(el)
    if (r.width > 60 && r.height > 28) {
      const rr = s.borderTopLeftRadius
      if (rr !== '0px' && rr !== '9999px') radii[rr] = (radii[rr] || 0) + 1
    }
    if (s.backgroundColor === juRgb || s.color === juRgb || s.borderTopColor === juRgb) {
      juElements++
      juArea += r.width * r.height
    }
  }

  const inkEntries = Object.entries(inks).sort((a, b) => b[1] - a[1])
  const inkTotal = inkEntries.reduce((a, e) => a + e[1], 0)
  const radiusPx = Object.keys(radii).map((r) => parseFloat(r)).filter((n) => !Number.isNaN(n))

  return {
    korean,
    koreanWebfont,
    emoji,
    vertical: vertical.slice(0, 6),
    verticalCount: vertical.length,
    inkTotal,
    topInkShare: inkTotal ? inkEntries[0][1] / inkTotal : 0,
    distinctRadii: radiusPx.length,
    maxRadius: radiusPx.length ? Math.max(...radiusPx) : 0,
    juElements,
    juAreaPct: (juArea / (window.innerWidth * document.documentElement.scrollHeight)) * 100,
  }
}

const PUBLIC_ONLY = args.includes('--public')

const run = async () => {
  const browser = await chromium.launch()
  // 공개 화면만 잴 때는 로그인하지 않는다 — 공유 dev DB 가 다른 세션의 드레인으로 바쁠 때
  // 로그인이 인증 200 뒤 프로필 조회에서 멎는다(실측 2026-09-16: 7시간짜리 쿼리 + IO 대기).
  // 그때도 **한글 글꼴 도달률은 공개 화면에서 그대로 잴 수 있다.**
  const fresh =
    !PUBLIC_ONLY &&
    fs.existsSync(STATE_FILE) && Date.now() - fs.statSync(STATE_FILE).mtimeMs < STATE_TTL_MS
  let ctx
  if (PUBLIC_ONLY) {
    ctx = await browser.newContext({ viewport: { width, height: 844 } })
  } else if (fresh) {
    ctx = await browser.newContext({ viewport: { width, height: 844 }, storageState: STATE_FILE })
  } else {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
    ctx = await browser.newContext({ viewport: { width, height: 844 } })
    const p = await ctx.newPage()
    await login(p)
    await p.close()
    await ctx.storageState({ path: STATE_FILE })
  }

  const page = await ctx.newPage()
  const rows = []
  const skipped = []

  /**
   * **실행 도중 세션이 죽는 것을 견딘다.**
   *
   * 이 워크스페이스는 검증 계정 하나를 여러 세션이 공유한다. Supabase 는 리프레시 토큰을
   * 회전시키므로 다른 세션이 같은 계정으로 로그인하면 이쪽 토큰이 조용히 무효가 된다.
   * 실측 2026-09-16: 69 라우트 전수 측정이 **10개를 재고 나머지 59를 «로그인으로 튕김»** 으로
   * 적었다. 수치는 정직했지만(통과로 세지 않았다) **답이 되지 못했다.**
   *
   * `tests/e2e/utils/session-guard.ts` 가 같은 문제를 이미 풀어 뒀고 거기 이렇게 적혀 있다 —
   * "이건 앱 결함이 아니라 **환경**이다. 그런데 성적표에는 앱 결함과 똑같이 보인다.
   *  **재는 쪽이 견뎌야 한다.**"
   *
   * ⚠️ 감추지는 않는다. 다시 로그인한 횟수를 세고, 예산(3회)을 넘기면 그때부터는
   *    그대로 «재지 못함» 으로 적는다 — 무한 재로그인은 "인증이 깨져도 초록" 이 되어 더 나쁘다.
   */
  let reauths = 0
  const REAUTH_BUDGET = 3
  const reauth = async () => {
    if (PUBLIC_ONLY || reauths >= REAUTH_BUDGET) return false
    reauths += 1
    const p = await ctx.newPage()
    try {
      await login(p)
      await ctx.storageState({ path: STATE_FILE })
      return true
    } catch {
      return false
    } finally {
      await p.close().catch(() => {})
    }
  }

  for (const r of routes) {
    try {
      await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.waitForTimeout(4200)
      // 튕겼으면 **한 번** 되살리고 같은 라우트를 다시 연다.
      if (new URL(page.url()).pathname.startsWith('/login') && (await reauth())) {
        await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await page.waitForTimeout(4200)
      }
      if (new URL(page.url()).pathname.startsWith('/login')) {
        skipped.push(`${r} (로그인으로 튕김 — 재지 않음)`)
        continue
      }
      const m = await page.evaluate(PROBE)
      rows.push({ route: r, ...m })
    } catch (e) {
      skipped.push(`${r} (${String(e).slice(0, 60)})`)
    }
  }
  await browser.close()

  const sum = (k) => rows.reduce((a, r) => a + r[k], 0)
  const korean = sum('korean')
  const koreanWebfont = sum('koreanWebfont')
  const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) : '—')

  console.log(`\n측정 라우트 ${rows.length} / 요청 ${routes.length}  (폭 ${width}px)`)
  if (skipped.length) console.log('재지 못함:', skipped.join(' · '))
  if (reauths) {
    console.log(
      `(도중에 ${reauths}번 다시 로그인했다 — 공유 계정이 회전당한 것이지 앱 결함이 아니다)`,
    )
  }
  if (reauths) console.log()
  console.log('─'.repeat(78))
  console.log('route'.padEnd(24), 'M1 한글웹폰트', ' M2 주묵', 'M3 radius', 'M4 잉크편중', 'M5 이모지', 'M6 세로글자')
  for (const r of rows) {
    console.log(
      r.route.padEnd(24),
      `${pct(r.koreanWebfont, r.korean)}% (${r.koreanWebfont}/${r.korean})`.padEnd(14),
      `${r.juElements}개 ${r.juAreaPct.toFixed(2)}%`.padEnd(9),
      `${r.distinctRadii}종 ≤${r.maxRadius}px`.padEnd(10),
      `${(r.topInkShare * 100).toFixed(0)}%`.padEnd(8),
      String(r.emoji).padEnd(9),
      String(r.verticalCount),
    )
  }
  console.log('─'.repeat(78))
  console.log(`M1 한글 웹폰트 도달률 = ${pct(koreanWebfont, korean)}%  (${koreanWebfont}/${korean})`)
  console.log(`M2 주묵이 보이는 라우트 = ${rows.filter((r) => r.juElements > 0).length}/${rows.length}`)
  console.log(`M3 radius 종류 최대 = ${Math.max(0, ...rows.map((r) => r.distinctRadii))}종 · 최대값 ${Math.max(0, ...rows.map((r) => r.maxRadius))}px`)
  console.log(`M5 이모지 남은 수 = ${sum('emoji')}`)
  const vtot = rows.reduce((a, r) => a + r.verticalCount, 0)
  console.log(`M6 세로로 선 글자 = ${vtot}`)
  if (vtot) {
    for (const r of rows) for (const v of r.vertical) console.log(`   ${r.route} | "${v.t}" ${v.w}×${v.h}px | ${v.cls}`)
  }

  if (outFile) {
    fs.writeFileSync(path.resolve(ROOT, outFile), JSON.stringify({ at: new Date().toISOString(), width, rows, skipped }, null, 2))
    console.log(`\n→ ${outFile}`)
  }
}

run().catch((e) => { console.error(e); process.exit(1) })
