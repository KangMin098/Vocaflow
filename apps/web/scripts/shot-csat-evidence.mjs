// apps/web/scripts/shot-csat-evidence.mjs
//
// 기출 원천 판 실측 — 데스크톱 1280×900 · 모바일 390 · 다크에서 캡처하고,
// **가로 넘침**과 **axe 위반**을 함께 잰다. 렌더 테스트(`renderToString`)에는 레이아웃이
// 없으므로 넘침은 이 길로만 잡힌다.
//
// 로그인은 하지 않는다 — dev 서버가 `DEV_ADMIN_BYPASS` 로 열려 있다. 그 우회가 꺼져 있으면
// 로그인 화면이 찍히므로, 캡처에 「기출 원천」이 없으면 그렇게 보고한다.
//
//   node scripts/shot-csat-evidence.mjs [baseURL] [경로…]

import AxeBuilder from '@axe-core/playwright'
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const base = process.argv[2] ?? 'http://localhost:3000'
const routes = process.argv.slice(3).length ? process.argv.slice(3) : ['/admin/csat/evidence']
const OUT = path.resolve('public/dev/csat-shots')
mkdirSync(OUT, { recursive: true })

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900, dark: false, full: true },
  { name: 'mobile', width: 390, height: 844, dark: false, full: true },
  { name: 'dark', width: 1280, height: 900, dark: true, full: false },
]

const browser = await chromium.launch()
let bad = 0

for (const route of routes) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: vp.dark ? 'dark' : 'light',
    })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })

    const res = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 180_000 })
    await page.waitForTimeout(800)

    // 가로 넘침 — 자기 안에서 가로 스크롤하는 상자(표·도식)는 넘침이 아니라 설계다.
    const overflow = await page.evaluate(() => {
      const de = document.documentElement
      const out = []
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const r = el.getBoundingClientRect()
        if (r.width === 0) continue
        if (r.right > de.clientWidth + 1) {
          let scrollsItself = false
          for (let p = el; p && p !== document.body; p = p.parentElement) {
            const ov = getComputedStyle(p).overflowX
            if (ov === 'auto' || ov === 'scroll') {
              scrollsItself = true
              break
            }
          }
          if (!scrollsItself) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`)
        }
      }
      return { docWidth: de.clientWidth, scrollWidth: de.scrollWidth, offenders: out.slice(0, 6) }
    })

    const seen = await page.evaluate(() => ({
      title: document.querySelector('h2')?.textContent ?? '',
      head: document.body.innerText.slice(0, 260).replace(/\s+/g, ' '),
      tapTooSmall: Array.from(document.querySelectorAll('button, a, select, [role="button"]')).filter((el) => {
        const r = el.getBoundingClientRect()
        // 표 안의 칸은 밀도를 위해 작게 둔다 — 방향키로 도는 격자라 손가락 대상이 아니다.
        if (el.closest('table')) return false
        return r.width > 0 && (r.height < 44 || r.width < 44)
      }).length,
    }))

    const name = `${route.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}-${vp.name}.png`
    await page.screenshot({ path: path.join(OUT, name), fullPage: vp.full })

    let axe = { violations: [] }
    try {
      axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    } catch (e) {
      errors.push('axe 실패: ' + String(e))
    }

    const hOver = overflow.scrollWidth > overflow.docWidth + 1
    if (hOver || axe.violations.length || errors.length) bad += 1

    console.log(
      [
        `${route} · ${vp.name} ${vp.width}×${vp.height}${vp.dark ? ' (dark)' : ''}`,
        `  HTTP ${res?.status()} · 제목 "${seen.title}"`,
        `  가로: doc ${overflow.docWidth} / scroll ${overflow.scrollWidth}${hOver ? '  ← 넘침' : '  ok'}`,
        overflow.offenders.length ? `  넘친 요소: ${overflow.offenders.join(' | ')}` : null,
        `  44px 미만 터치타깃(표 밖): ${seen.tapTooSmall}`,
        `  axe(wcag2a/aa) 위반: ${axe.violations.length}${
          axe.violations.length ? ' — ' + axe.violations.map((v) => `${v.id}×${v.nodes.length}`).join(', ') : ''
        }`,
        errors.length ? `  콘솔 오류 ${errors.length}: ${errors.slice(0, 2).join(' / ')}` : null,
        `  → public/dev/csat-shots/${name}`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    await ctx.close()
  }
}

// ── 상호작용 — 캡처만으로는 「겹쳐 볼 수 있는가」를 못 잰다 ─────────────
//
// 이 판의 약속은 정지 화면이 아니라 **동작**이다: 칸을 누르면 두 축에 조건이 걸리고, 그 조건이
// 주소에 실리고, 문항 한 줄을 누르면 전문이 오른쪽에서 열리고, Esc 로 닫힌다. 넷 중 하나라도
// 끊기면 화면은 멀쩡해 보이는 채로 「탭 시절」로 되돌아간다.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(base + routes[0], { waitUntil: 'networkidle', timeout: 180_000 })
  await page.waitForTimeout(600)

  const cell = page.locator('table tbody button[aria-label]:not([disabled])').first()
  const cellName = (await cell.count()) ? await cell.getAttribute('aria-label') : null
  const lines = []

  if (!cellName) {
    lines.push('  누를 수 있는 칸이 없다 — 데이터가 안 왔거나 피벗이 비었다')
    bad += 1
  } else {
    await cell.click()
    await page.waitForTimeout(400)
    const search = new URL(page.url()).search
    const listed = await page.getByText(/이 조건의 문항/).first().innerText()
    // 칸 하나를 누르면 **두 축 모두**에 조건이 걸려야 한다 — 한쪽만 걸리면 교차가 아니다.
    const crossed = /row=/.test(search) && search.split('&').filter((kv) => !/^(row|col|m)=/.test(kv)).length >= 2
    lines.push(`  칸 "${cellName}" → ${search}`)
    lines.push(`  ${listed.replace(/\s+/g, ' ')}${crossed ? '' : '   ← 축 하나에만 걸렸다'}`)
    if (!crossed) bad += 1

    const row = page.locator('section:last-of-type tbody tr td button').first()
    await row.click()
    await page.waitForTimeout(1500)
    const drawer = page.getByRole('dialog', { name: '문항 전문' })
    const open = await drawer.isVisible().catch(() => false)
    await page.screenshot({ path: path.join(OUT, 'admin_csat_evidence-drawer.png') })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    const closed = (await drawer.count()) === 0
    // 목록 안에 전문이 펼쳐지면 802개를 훑을 수 없게 된다 — 옛 화면이 그래서 못 쓰였다.
    const inlineFull = await page.evaluate(
      () => document.querySelectorAll('section:last-of-type tbody ol, section:last-of-type tbody dl').length,
    )
    lines.push(`  drawer 열림 ${open} · Esc 닫힘 ${closed} · 목록 안 전문 ${inlineFull}개(0이어야 한다)`)
    if (!open || !closed || inlineFull > 0) bad += 1
  }

  console.log(['상호작용 (1280×900)', ...lines].join('\n'))
  await ctx.close()
}

await browser.close()
console.log(bad ? `\n문제 있는 조합 ${bad}개` : '\n전 조합 통과')
process.exit(0)
