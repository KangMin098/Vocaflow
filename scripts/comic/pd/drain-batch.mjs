// scripts/comic/pd/drain-batch.mjs
//
// 큐 배치 드레인 — pd_comic_issues 의 드레인 가능 테스트 이슈를 전부 CLI 로 처리(get→restore→segment→ocr)
// + pd_comic_panels 적재. 큐레이션(curate.mjs) 이 시드한 배치를 한 번에 콘텐츠로 만든다.
// refine(정제)는 컷별 오퍼레이터 단계라 여기선 원문 OCR 적재(품질 후속 개선). 순차 실행(외부사이트·CPU 배려).
//
//   node scripts/comic/pd/drain-batch.mjs [--limit 6]

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const REPO = path.resolve(HERE, '..', '..', '..')
const LIMIT = Number(arg('limit', 8))

const envPath = path.join(REPO, 'apps', 'web', '.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: issues } = await db.from('pd_comic_issues')
  .select('source_adapter, source_identifier, acquire_pages, title, status')
  .in('status', ['queued', 'acquired', 'restored', 'segmented'])
  .is('last_error', null)
  .order('created_at', { ascending: true })
  .limit(LIMIT)

if (!issues || !issues.length) { console.log('드레인 가능한 큐 이슈 없음'); process.exit(0) }
console.log(`배치 드레인 ${issues.length}건:\n${issues.map((i) => `  · ${i.title}`).join('\n')}\n`)

const pipeline = path.join(HERE, 'pipeline.mjs')
const loader = path.join(HERE, 'load-panels.mjs')
let ok = 0, fail = 0
for (const iss of issues) {
  const slug = String(iss.source_identifier).replace(/[^\w.-]+/g, '-').slice(0, 60).toLowerCase()
  const out = `work/${slug}`
  console.log(`\n━━ ${iss.title} (${iss.source_identifier}) ━━`)
  const r = spawnSync(process.execPath, [pipeline, '--source', iss.source_adapter, '--id', iss.source_identifier, '--out', out, '--pages', String(iss.acquire_pages || 4), '--record'], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`  ✗ 파이프라인 실패`); fail++; continue }
  const l = spawnSync(process.execPath, [loader, '--workdir', out], { stdio: 'inherit' })
  if (l.status !== 0) { console.error(`  ✗ 적재 실패`); fail++; continue }
  ok++
}
console.log(`\n✓ 배치 완료 — 처리 ${ok} · 실패 ${fail}. /admin/pd-comics 테스트·모니터에서 확인.`)
