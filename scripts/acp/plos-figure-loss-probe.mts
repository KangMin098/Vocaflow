// scripts/acp/plos-figure-loss-probe.mts
//
// **ACP 경로 PLOS 원본이 그림 제거 결함으로 본문을 얼마나 잃었나 — 읽기 전용 표본 측정.**
//
// 2026-09-25: `packages/library-pipeline/src/ingest-article/plos.ts` 의 figure 제거 정규식이 그림을 지나
// 다음 절까지 삼켰다(pone.0356261 결과 3.2절 4,309자 소실). 고친 추출기로 원문을 다시 받아 저장본과 견준다.
// DB 에는 쓰지 않는다. 결과만 출력한다.
//
// 실행: pnpm exec tsx scripts/acp/plos-figure-loss-probe.mts [--n 20] [--feed recent]

import fs from 'node:fs'
import path from 'node:path'

import { ingestPlosArticle } from '../../packages/library-pipeline/src/ingest-article/plos'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, '')
}
const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : d
}
const N = Number(arg('n', '20'))
const FEED = arg('feed', 'recent')

const { createScriptClient } = await import('../lib/supabase-client.mjs')
const db = createScriptClient()

// 표본: 해당 피드 원본에서 id 순으로 고르게(재실행하면 같은 표본).
const { data, error } = await db
  .from('library_articles')
  .select('id,source_url,content')
  .eq('source', 'plos')
  .eq('feed_id', FEED)
  .order('id')
  .limit(N * 40)
if (error) throw new Error(error.message)
const pool = data ?? []
const sample = Array.from({ length: Math.min(N, pool.length) }, (_, k) => pool[Math.floor((k * pool.length) / N)]!)

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
let lossy = 0
const rows: string[] = []
for (const a of sample) {
  try {
    const fresh = norm((await ingestPlosArticle(a.source_url)).content)
    const stored = norm(a.content ?? '')
    // 새 본문의 400자 간격 50자 창 중 저장본에 없는 비율 = 잃은 몫의 근사.
    let miss = 0
    let tot = 0
    for (let i = 0; i < fresh.length; i += 400) {
      tot += 1
      if (!stored.includes(fresh.slice(i, i + 50))) miss += 1
    }
    const pct = tot ? Math.round((miss / tot) * 100) : 0
    if (pct >= 5) lossy += 1
    rows.push(`${String(pct).padStart(3)}%  stored ${String(stored.length).padStart(6)} → fresh ${String(fresh.length).padStart(6)}  ${a.source_url.split('id=')[1]}`)
  } catch (e) {
    rows.push(`  ?   ${(e as Error).message.slice(0, 80)}`)
  }
}
console.log(`PLOS 그림 제거 결함 표본 — feed=${FEED} · ${sample.length}편 (읽기 전용)`)
console.log(rows.join('\n'))
console.log(`\n본문 5% 이상 잃은 원본: ${lossy}/${sample.length}`)
