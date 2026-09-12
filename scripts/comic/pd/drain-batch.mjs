// scripts/comic/pd/drain-batch.mjs
//
// 큐 배치 드레인 — pd_comic_issues 의 드레인 가능 테스트 이슈를 전부 CLI 로 처리(get→restore→segment→ocr)
// + pd_comic_panels 적재. 큐레이션(curate.mjs) 이 시드한 배치를 한 번에 콘텐츠로 만든다.
// refine(정제)는 컷별 오퍼레이터 단계라 여기선 원문 OCR 적재(품질 후속 개선). 순차 실행(외부사이트·CPU 배려).
//
//   node scripts/comic/pd/drain-batch.mjs [--limit 6] [--kind war] [--series atomic-war]
//   node scripts/comic/pd/drain-batch.mjs --publisher Ace --kind mystery-horror
//
// `--kind` 로 **유형 하나를 끝까지** 미는 것이 기본 전략이다 — 학습자 서가가 유형별로 묶여
// 나가므로(/comics/restored), 여러 유형을 조금씩 올리면 어느 묶음도 완성되지 않는다.

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

const KIND = arg('kind')
const SERIES = arg('series')
const PUBLISHER = arg('publisher')

// 발행사 필터 — 갱신 위험이 발행사 단위로 갈린다(Ace 는 전 타이틀 미갱신, Fawcett 은 갱신 구간 실재).
// 위험이 낮은 쪽부터 완성하는 것이 합리적이라 이 축이 필요하다.
let seriesKeys = null
if (PUBLISHER) {
  const { data: ss } = await db.from('pd_comic_series').select('key').eq('publisher', PUBLISHER)
  seriesKeys = (ss ?? []).map((s) => s.key)
  if (!seriesKeys.length) { console.log(`발행사 '${PUBLISHER}' 시리즈 없음`); process.exit(0) }
}

let q = db.from('pd_comic_issues')
  .select('source_adapter, source_identifier, acquire_pages, title, status')
  .in('status', ['queued', 'acquired', 'restored', 'segmented'])
  .is('last_error', null)
if (KIND) q = q.eq('kind', KIND)
if (SERIES) q = q.eq('series_key', SERIES)
if (seriesKeys) q = q.in('series_key', seriesKeys)
// 시리즈 안에서는 호 순서대로 — 학습자가 1호부터 읽을 수 있게 앞 호부터 완성한다.
const { data: issues } = await q
  .order('series_key', { ascending: true })
  .order('issue_no', { ascending: true, nullsFirst: false })
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
  // ⚠️ `acquire_pages || 4` 로 쓰면 안 된다 — NULL 은 "전권" 이라는 **뜻이 있는 값**인데
  // falsy 라서 4장으로 뭉개진다. 그러면 68쪽짜리 호가 조용히 앞 4장만 복원되고,
  // 파이프라인은 성공으로 끝나며 학습자에게는 4쪽짜리 만화가 나간다(실패보다 나쁜 결과다).
  // NULL 이면 --pages 자체를 넘기지 않는다 = 전권.
  const pagesArgs = iss.acquire_pages ? ['--pages', String(iss.acquire_pages)] : []
  const args = [pipeline, '--source', iss.source_adapter, '--id', iss.source_identifier, '--out', out, ...pagesArgs, '--record']

  let r = spawnSync(process.execPath, args, { encoding: 'utf8' })
  // Windows 네이티브 크래시(0xC0000409 STATUS_STACK_BUFFER_OVERRUN 등)는 libuv 종료 경합에서
  // 산발적으로 난다 — 코드 문제가 아니라 환경 플레이키다. 실측 2026-08-17 에 969건 중 1건에서 발생했고,
  // 규모가 커지면 반복된다. 로직 실패(exit 1/2)와 달리 **한 번은 다시 해 볼 가치가 있다**.
  const CRASH = new Set([3221226505, 3221225477, 3221226356]) // 0xC0000409 · 0xC0000005 · 0xC0000374
  if (r.status !== 0 && CRASH.has(r.status >>> 0)) {
    console.log(`  ↻ 네이티브 크래시(exit ${r.status}) — 1회 재시도`)
    r = spawnSync(process.execPath, args, { encoding: 'utf8' })
  }
  process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '')
  if (r.status !== 0) {
    // 실패를 DB 에 기록 → 모니터가 "멈춤" 사유를 보여준다(관측의 핵심).
    // 정보성 사유(접근 제한·없습니다·취득 0 등) 우선, 없으면 일반 래퍼("...실패 (exit N)").
    const lines = `${r.stdout || ''}${r.stderr || ''}`.split('\n').map((l) => l.trim()).filter(Boolean)
    const informative = /접근 제한|없습니다|취득 0|페이지 수를 알 수|Cannot|ENOENT|not found/i
    const errLine = (lines.reverse().find((l) => informative.test(l)) || lines.find((l) => /실패|error/i.test(l)) || `파이프라인 종료 ${r.status}`).slice(0, 300)
    await db.from('pd_comic_issues').update({ last_error: errLine }).eq('source_adapter', iss.source_adapter).eq('source_identifier', iss.source_identifier)
    console.error(`  ✗ 파이프라인 실패 → 기록: ${errLine}`); fail++; continue
  }
  const l = spawnSync(process.execPath, [loader, '--workdir', out], { stdio: 'inherit' })
  if (l.status !== 0) { console.error(`  ✗ 적재 실패`); fail++; continue }
  ok++
}
console.log(`\n✓ 배치 완료 — 처리 ${ok} · 실패 ${fail}. /admin/pd-comics 테스트·모니터에서 확인.`)
