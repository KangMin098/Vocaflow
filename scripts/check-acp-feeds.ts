// scripts/check-acp-feeds.ts
//
// LCP 대량 GET 정상 작동 검증.
// 실행: pnpm tsx scripts/check-acp-feeds.ts [voa|nasa|nih|all]
//
// ⚠️ **arXiv 가지를 걷었다**(2026-09-23 · DD-78). 그 소스는 마이그레이션
//   `20260614240000_acp_remove_arxiv_source` 로 제거됐고 CHECK 제약이 재삽입을 막는다.
//   그런데 이 파일은 `ingest-article/arxiv` 를 **최상위에서 import** 하고 있어서,
//   그 모듈이 사라진 뒤로는 voa 를 부르든 all 을 부르든 **import 에서 죽었다.**
//   `scripts/` 가 어느 tsconfig 에도 안 잡혀 컴파일이 그것을 못 봤다.

import { listVoaFeed, VOA_FEEDS } from '../packages/library-pipeline/src/ingest-article/voa'
import { listNasaFeed, NASA_FEEDS } from '../packages/library-pipeline/src/ingest-article/nasa'
import { listNihFeed, NIH_FEEDS } from '../packages/library-pipeline/src/ingest-article/nih'

type Source = 'voa' | 'nasa' | 'nih'

const target = (process.argv[2] ?? 'voa').toLowerCase() as Source | 'all'

interface FeedOk<T> {
  source: Source
  id: string
  label: string
  url: string
  ms: number
  items: Array<T & { title: string; published_at: string | null; score?: { total: number; recency: number; source: number; length: number; level: number } }>
}

async function checkVoa(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  VOA 4 feed`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  for (const feed of VOA_FEEDS) {
    await runOne('voa', feed.id, feed.label, feed.url, () => listVoaFeed(feed.url, feed.id))
  }
}
async function checkNasa(): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  NASA 3 feed`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  for (const feed of NASA_FEEDS) {
    await runOne('nasa', feed.id, feed.label, feed.url, () => listNasaFeed(feed.url, feed.id))
  }
}
async function checkNih(): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  NIH 3 feed`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  for (const feed of NIH_FEEDS) {
    await runOne('nih', feed.id, feed.label, feed.url, () => listNihFeed(feed.url, feed.id))
  }
}
async function runOne<T>(
  src: Source,
  id: string,
  label: string,
  url: string,
  fn: () => Promise<T[]>,
): Promise<void> {
  process.stdout.write(`\n▶ [${src}] ${label}\n  URL: ${url}\n`)
  const t0 = Date.now()
  try {
    const items = (await Promise.race([
      fn(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout 20s')), 20_000)),
    ])) as Array<{
      title: string
      published_at: string | null
      score?: { total: number; recency: number; source: number; length: number; level: number }
    }>
    const ms = Date.now() - t0
    console.log(`  ✅ OK (${ms}ms)  spec 적용 후 ${items.length} 건`)
    if (items.length === 0) {
      console.log('  ⚠ items=0 — RSS empty 또는 필터 너무 엄격')
      return
    }
    const top = items.slice(0, 3)
    for (const it of top) {
      const sc = it.score
      const totalLabel = sc ? `★${Math.round(sc.total * 100)}` : '★?'
      const date = it.published_at ? new Date(it.published_at).toISOString().slice(0, 10) : '날짜미상'
      console.log(`    ${totalLabel}  ${date}  ${it.title.slice(0, 70)}`)
      if (sc) {
        console.log(
          `         r=${sc.recency.toFixed(2)}·s=${sc.source.toFixed(2)}·l=${sc.length.toFixed(2)}·lv=${sc.level.toFixed(2)}`,
        )
      }
    }
  } catch (e) {
    console.log(`  ❌ FAIL: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function main() {
  if (target === 'all') {
    await checkVoa()
    await checkNasa()
    await checkNih()
  } else if (target === 'voa') await checkVoa()
  else if (target === 'nasa') await checkNasa()
  else if (target === 'nih') await checkNih()
  else {
    console.error(`Unknown target: ${target}. 사용: voa|nasa|nih|all`)
    process.exit(1)
  }
  console.log('\n━━━ 종료 ━━━')
}

main().catch((e) => {
  console.error('Script error:', e)
  process.exit(1)
})
