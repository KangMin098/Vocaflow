// scripts/vcb/trade-covers/trade-preview.mts
//
// **VCB 교재 표지 — 3단계 미리보기.** `work/specs.out.json` 을 검증하고, 서가에 걸릴 모습 그대로
// 한 장에 모아 PNG 로 굽는다(적재 전에 눈으로 본다 — 자동 검증은 틀린 색·어색한 줄바꿈을 못 잡는다).
//
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/vcb/trade-covers/trade-preview.mts [--out <png>] [--only a,b]
//
// 재실행 안전 — 파일만 쓴다(기본 scripts/vcb/trade-covers/work/preview.png, gitignore 대상 아님이면 커밋하지 않는다).
// 명세가 규칙을 어기면 그 권 이름과 사유를 출력하고 exit 1(미리보기는 그래도 굽는다 — 어디가 틀렸는지 보이게).

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import {
  TRADE_H,
  TRADE_W,
  tradeCoverSvg,
  validateTradeSpec,
  type TradeCoverSpec,
} from '../../../packages/library-pipeline/src/vocab/trade-cover'

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const ROOT = path.resolve(HERE, '../../..')
const argv = process.argv.slice(2)
const arg = (k: string) => {
  const i = argv.indexOf(k)
  return i >= 0 ? argv[i + 1] : undefined
}
const OUT = arg('--out') ?? path.join(HERE, 'work', 'preview.png')
const ONLY = arg('--only')?.split(',') ?? null

const specs = JSON.parse(fs.readFileSync(path.join(HERE, 'work', 'specs.out.json'), 'utf8')) as Record<string, TradeCoverSpec>
const sets = JSON.parse(fs.readFileSync(path.join(HERE, 'work', 'sets.json'), 'utf8')) as Array<{ slug: string; title: string; words: number }>
const bySlug = new Map(sets.map((s) => [s.slug, s]))

let bad = 0
const cells: string[] = []
for (const [slug, spec] of Object.entries(specs)) {
  if (ONLY && !ONLY.includes(slug)) continue
  const errs = validateTradeSpec(spec)
  if (errs.length) {
    bad++
    console.warn(`  ✗ ${slug}: ${errs.join(' · ')}`)
  }
  const set = bySlug.get(slug)
  if (!set) {
    bad++
    console.warn(`  ? ${slug}: sets.json 에 없는 권(export 를 다시 돌린다)`)
    continue
  }
  // 하루 분량은 싣지 않는다 — 화면은 사다리 계단 값(rung.wordsPerDay)에서 계산한다. 여기서 상수를 넣으면 틀린 「N일」이 보인다.
  const svg = tradeCoverSvg(spec, { title: set.title, words: set.words, perDay: null })
  cells.push(`<figure><div class="c">${svg}</div><figcaption>${slug} · ${spec.mode}/${spec.template}</figcaption></figure>`)
}

const require = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = require('@playwright/test') as typeof import('@playwright/test')
const W = 200
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 8 * (W + 12) + 24, height: 600 } })
await p.setContent(
  `<style>body{margin:0;background:#f7f4ef;font:11px sans-serif}main{display:grid;grid-template-columns:repeat(8,${W}px);gap:12px;padding:12px}.c{width:${W}px;aspect-ratio:${TRADE_W}/${TRADE_H};box-shadow:0 6px 12px rgba(0,0,0,.2)}figure{margin:0}figcaption{margin-top:4px;color:#555}</style><main>${cells.join('')}</main>`,
)
await p.screenshot({ path: OUT, fullPage: true })
await b.close()
console.log(`미리보기 ${cells.length}권 → ${path.relative(ROOT, OUT)} · 규칙 위반 ${bad}`)
if (bad) process.exitCode = 1
