// apps/web/scripts/csat-surface-measure.mts
//
// **기출 분석 학습자 표면의 「자」.** 고치지 않는다 — 재기만 한다.
//
// ── 왜 필요한가 ───────────────────────────────────────────────────────
// "아직도 텍스트 나열" 은 눈으로 말할 수 있지만 **고쳤는지는 눈으로 못 말한다.**
// 같은 입력에 같은 수를 내는 자가 먼저 있어야 「-79%」 같은 말을 할 자격이 생긴다
// (`/admin/db` 가 9,497 → 2,037자를 증명한 방식과 같다).
//
// 재는 것 — 화면마다:
//   visible_chars   보이는 글자 수. **접힌 것(details)은 안 센다** — 접기는 개선이므로
//                   세면 개선이 악화로 잡힌다(density-scan.ts 가 이미 겪은 함정).
//   longest_prose   가장 긴 「연속 산문 덩어리」. 학습자가 한 호흡에 삼켜야 하는 양.
//   fold_chars      데스크톱 1280×900 접힌 위의 글자 수 (CLAUDE.md I8 의 기준 뷰포트)
//   fold_proof      접힌 위에 **작동하는 증명**(실데이터 그래픽)이 있는가 (I1)
//   controls        조작 가능한 것의 수 (I3)
//   svg             그래픽 요소 수
//
// 실행:
//   npx tsx scripts/e2e-session.mts .auth-csat-measure.json   # 세션 굽기(한 번)
//   npx tsx scripts/csat-surface-measure.mts                  # 재기
//
// 결과는 stdout(표) + `csat-surface-measure.result.json`.

import fs from 'node:fs'
import path from 'node:path'

import { chromium, type Page } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const STATE = path.resolve('playwright-auth/.auth-csat-measure.json')

/** 재는 화면. 유형은 리포트가 가장 두꺼운 것 · 중간 · 가장 얇은 것 셋을 고른다. */
const ROUTES = [
  { path: '/csat', label: '허브' },
  { path: '/csat/R-BLANK', label: '유형(최대)' },
  { path: '/csat/R-ORDER', label: '유형(중간)' },
  { path: '/csat/X-BLANK2', label: '유형(최소)' },
  { path: '/csat/item/M2309-42', label: '문항' },
  { path: '/csat/plan', label: '계획' },
  { path: '/csat/drill', label: '훈련' },
  // 2026-09-16 에 붙은 둘. 안 재면 표가 화면 수보다 짧아지고, 그 차이는 조용하다.
  { path: '/csat/map', label: '지형' },
  { path: '/csat/predict', label: '사정권' },
]

export interface SurfaceMetric {
  path: string
  label: string
  ok: boolean
  visible_chars: number
  longest_prose: number
  fold_chars: number
  fold_proof: number
  controls: number
  svg: number
}

async function measure(page: Page, route: { path: string; label: string }): Promise<SurfaceMetric> {
  await page.setViewportSize({ width: 1280, height: 900 })
  const res = await page.goto(BASE + route.path, { waitUntil: 'networkidle', timeout: 60_000 })
  const ok = Boolean(res && res.status() < 400 && !page.url().includes('/login'))
  if (!ok) {
    return { ...route, ok, visible_chars: 0, longest_prose: 0, fold_chars: 0, fold_proof: 0, controls: 0, svg: 0 }
  }
  await page.waitForTimeout(400)

  return page.evaluate((r) => {
    const main = document.querySelector('main') ?? document.body

    /** 접혀 있는가 — 닫힌 details 안이면 화면에 없다. */
    const folded = (el: Element): boolean => {
      let n: Element | null = el
      while (n) {
        const d: HTMLDetailsElement | null = n.closest('details')
        if (!d) return false
        if (!d.open && !n.closest('summary')) return true
        n = d.parentElement
      }
      return false
    }
    const shown = (el: Element): boolean => {
      if (folded(el)) return false
      const s = getComputedStyle(el)
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false
      if (el.closest('[hidden]') || el.closest('[aria-hidden="true"]')) return false
      return true
    }

    // ── 보이는 글자 ────────────────────────────────────────────────
    let visible = 0
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    const textNodes: { text: string; el: Element }[] = []
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n as Text
      const el = t.parentElement
      if (!el || !shown(el)) continue
      const s = (t.data || '').replace(/\s+/g, ' ').trim()
      if (!s) continue
      visible += s.length
      textNodes.push({ text: s, el })
    }

    // ── 가장 긴 연속 산문 덩어리 ────────────────────────────────────
    // 「덩어리」 = 블록 하나 안의 글자 총합. 학습자가 한 호흡에 삼켜야 하는 양이다.
    const BLOCK = 'P,LI,TD,TH,BLOCKQUOTE,DD,FIGCAPTION,H1,H2,H3,H4,H5,H6,SUMMARY'
    const chunk = new Map<Element, number>()
    for (const { text, el } of textNodes) {
      const b = el.closest(BLOCK) || el
      chunk.set(b, (chunk.get(b) || 0) + text.length)
    }
    const longest = chunk.size ? Math.max(...Array.from(chunk.values())) : 0

    // ── 접힌 위 (1280×900) ─────────────────────────────────────────
    const FOLD = 900
    let foldChars = 0
    for (const { text, el } of textNodes) {
      const rect = el.getBoundingClientRect()
      if (rect.top >= FOLD || rect.bottom <= 0) continue
      foldChars += text.length
    }

    // ── 작동하는 증명 = 접힌 위의 그래픽 (I1) ────────────────────────
    // 아이콘은 증명이 아니다 — 24px 를 넘는 svg/canvas 와, 실데이터로 폭이 정해지는
    // 요소(data-proof)만 센다.
    let foldProof = 0
    for (const el of Array.from(main.querySelectorAll('svg,canvas,[data-proof]'))) {
      if (!shown(el)) continue
      const rect = el.getBoundingClientRect()
      if (rect.top >= FOLD || rect.bottom <= 0) continue
      if (el.hasAttribute('data-proof') || (rect.width > 24 && rect.height > 24)) foldProof += 1
    }

    const controls = Array.from(
      main.querySelectorAll('button,summary,input,select,[role="tab"],[role="button"],[role="slider"]'),
    ).filter(shown).length
    const svg = Array.from(main.querySelectorAll('svg,canvas')).filter(shown).length

    return {
      path: r.path,
      label: r.label,
      ok: true,
      visible_chars: visible,
      longest_prose: longest,
      fold_chars: foldChars,
      fold_proof: foldProof,
      controls,
      svg,
    }
  }, route)
}

async function main() {
  if (!fs.existsSync(STATE)) {
    console.error('세션이 없다: ' + STATE + '\n  npx tsx scripts/e2e-session.mts .auth-csat-measure.json')
    process.exit(2)
  }
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ storageState: STATE })
  const page = await ctx.newPage()
  // ⚠️ tsx(esbuild) 가 `keepNames` 로 모든 이름 있는 함수를 `__name(...)` 으로 감싼다.
  //    그 헬퍼는 **Node 쪽에만** 있으므로 page.evaluate 로 넘어간 코드가 브라우저에서
  //    `ReferenceError: __name is not defined` 로 죽는다(측정이 0으로 나와 조용히 거짓말한다).
  //    페이지에 항등 함수를 미리 심어 둔다 — 문자열이라 컴파일 대상이 아니다.
  await page.addInitScript('globalThis.__name = globalThis.__name || ((f) => f)')

  const rows: SurfaceMetric[] = []
  for (const r of ROUTES) {
    try {
      rows.push(await measure(page, r))
    } catch (e) {
      console.error('  ! ' + r.path + ': ' + (e instanceof Error ? e.message : String(e)))
      rows.push({ ...r, ok: false, visible_chars: 0, longest_prose: 0, fold_chars: 0, fold_proof: 0, controls: 0, svg: 0 })
    }
  }
  await browser.close()

  const pad = (s: string | number, n: number) => String(s).padEnd(n)
  const lpad = (s: string | number, n: number) => String(s).padStart(n)
  const LINE = '-'.repeat(84)
  console.log('')
  console.log(pad('화면', 24) + lpad('보이는글자', 11) + lpad('최장덩어리', 11) + lpad('접힌위글자', 11) + lpad('접힌위증명', 11) + lpad('컨트롤', 8) + lpad('그래픽', 8))
  console.log(LINE)
  for (const m of rows) {
    console.log(
      pad(m.label + ' ' + m.path, 24) +
        lpad(m.ok ? m.visible_chars : '-', 11) +
        lpad(m.ok ? m.longest_prose : '-', 11) +
        lpad(m.ok ? m.fold_chars : '-', 11) +
        lpad(m.ok ? m.fold_proof : '-', 11) +
        lpad(m.ok ? m.controls : '-', 8) +
        lpad(m.ok ? m.svg : '-', 8),
    )
  }
  const okRows = rows.filter((r) => r.ok)
  const sum = (f: (r: SurfaceMetric) => number) => okRows.reduce((a, b) => a + f(b), 0)
  console.log(LINE)
  console.log(
    pad('합계 (' + okRows.length + '/' + rows.length + ' 화면)', 24) +
      lpad(sum((r) => r.visible_chars), 11) +
      lpad(okRows.length ? Math.max(...okRows.map((r) => r.longest_prose)) : 0, 11) +
      lpad(sum((r) => r.fold_chars), 11) +
      lpad(sum((r) => r.fold_proof), 11) +
      lpad(sum((r) => r.controls), 8) +
      lpad(sum((r) => r.svg), 8),
  )
  console.log('')

  const out = path.resolve('csat-surface-measure.result.json')
  fs.writeFileSync(out, JSON.stringify({ measured_at: new Date().toISOString(), base: BASE, rows }, null, 2))
  console.log('→ ' + out)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
