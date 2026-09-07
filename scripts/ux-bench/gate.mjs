// scripts/ux-bench/gate.mjs
//
// **측정 전 무결성 관문 — "모든 라우트가 같은 껍데기" 를 잡는다.**
//
// ── 왜 이 파일이 생겼나 (실측 2026-09-01) ────────────────────────────
// 재측정에서 56 측정이 **전부 같은 값**(D100 U87.5 C27.8 F66.7)으로 났다. 원인은 제품이
// 아니라 하네스였다: 이전 `next start` 프로세스가 죽지 않은 채 3100 을 잡고 있었고,
// 그 프로세스가 **자기 밑에서 덮어써진 `.next-bench`** 를 계속 서빙했다.
// 청크가 깨진 셸이 200 으로 돌아오니 모든 라우트가 같은 것을 그렸다.
//
// ⚠️ **`bench.mjs` 의 무효 판정기(`invalid()`)는 이것을 못 잡는다.** 그 함수는
//    빈 화면(dom<60)·글자 없음·봇 차단 페이지를 잡는데, 이 껍데기는 **셋 다 아니다** —
//    노드도 글자도 컨트롤도 있다. 그래서 `유효 56 · 실패 0` 이라고 보고했다.
//    그 값을 그대로 믿었으면 "디자인 107.9% ✅ 달성" 이라고 적을 뻔했다.
//
// ── 무엇을 보는가 ────────────────────────────────────────────────────
// 서로 **다른 화면 셋**을 실제로 열어, 셋의 DOM 노드 수가 서로 다른지 본다.
// 같은 껍데기를 세 번 쟀다면 셋이 같은 수로 나온다. 이 검사는 싸고(3 로드) 정확히
// 위 사고의 모양을 겨냥한다.
//
// ⚠️ curl 로는 판정할 수 없다. 로그인 폼이 클라이언트 렌더라 SSR HTML 에는
//    `type="password"` 가 없다 — 처음 이 관문을 curl 로 짰다가 정상 서버를 반려했다.
//
// 재실행 안전: 읽기만 한다. 실행:
//   node scripts/ux-bench/gate.mjs [--base http://localhost:3100]
// 종료 코드 0 = 측정해도 된다 / 1 = 측정하지 말 것.

import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// `playwright` 는 워크스페이스 루트에 없다 — `@playwright/test` 가 apps/web 의 devDependency 다.
const HERE = path.dirname(fileURLToPath(import.meta.url))
const req = createRequire(path.join(HERE, '..', '..', 'apps', 'web', 'package.json'))
const { chromium } = req('@playwright/test')

const argOf = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const BASE = argOf('--base', process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3100')

/** 서로 다르게 렌더돼야 하는 화면들. 모두 로그인 뒤 화면이다. */
const PROBES = ['/hub', '/library/vocab', '/wordvault']

/** 껍데기 판정 하한 — 정상 화면은 실측 480~740 노드다(2026-09-01). */
const MIN_NODES = 200

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()

let fail = null
try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.waitForTimeout(600)
  await page.fill('input[type="email"]', process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev')
  await page.fill('input[type="password"]', process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!')
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 45_000 })

  const nodeCounts = []
  for (const r of PROBES) {
    await page.goto(`${BASE}${r}`, { waitUntil: 'networkidle', timeout: 60_000 })
    await page.waitForTimeout(800)
    const s = await page.evaluate(() => ({
      nodes: document.querySelectorAll('*').length,
      text: document.body.innerText.trim().length,
      here: location.pathname,
    }))
    console.log(`  ${r.padEnd(18)} nodes=${String(s.nodes).padStart(5)}  text=${String(s.text).padStart(5)}  landed=${s.here}`)
    if (s.here.startsWith('/login')) fail = `${r} 가 /login 으로 떨어졌다 — 세션이 없다`
    else if (s.nodes < MIN_NODES) fail = `${r} 노드 ${s.nodes} (<${MIN_NODES}) — 껍데기다`
    nodeCounts.push(s.nodes)
  }
  // 핵심 검사 — 다른 화면이 같은 크기면 같은 것을 여러 번 쟀다는 뜻이다.
  if (!fail && new Set(nodeCounts).size === 1) {
    fail = `세 화면의 노드 수가 전부 ${nodeCounts[0]} — 같은 껍데기를 세 번 쟀다`
  }
} catch (e) {
  fail = String(e?.message ?? e).slice(0, 200)
}
await browser.close()

if (fail) {
  console.error(`\nGATE FAIL — ${fail}`)
  console.error('이 위에서 잰 값은 화면의 값이 아니다. 측정하지 말 것.')
  process.exit(1)
}
console.log('\nGATE OK — 화면들이 서로 다르게 렌더된다. 측정해도 된다.')
