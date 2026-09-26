// scripts/acp/plos-figure-refetch.mts
//
// **그림 제거 결함으로 본문을 잃은 PLOS 원본을 고친 수집기로 다시 받는다.**
//
// ── 무엇을 고치나 ───────────────────────────────────────────────────
// 2026-09-25 까지 `packages/library-pipeline/src/ingest-article/plos.ts` 의 figure 제거 정규식이 그림을 지나
// 다음 그림 안쪽까지 본문을 삼켰다(커밋 824233fb 에서 깊이 추적으로 고침). ACP 경로(`feed_id` recent·essay 등)로
// 들어온 원본만 해당한다 — `harvest-plos` 는 Solr body 를 써서 무관하다.
// 읽기 전용 표본(`plos-figure-loss-probe.mts`) 20편 중 18편이 본문 5% 이상, 다수가 40~50% 를 잃었다.
//
// ── 안전 장치 ───────────────────────────────────────────────────────
//   ① **기본이 dry-run.** `--commit` 이 없으면 한 행도 쓰지 않는다.
//   ② **더해진 경우만 바꾼다** — 새 본문이 3% 이상 길고 옛 본문 창의 절반 이상을 품을 때만.
//      그 밖(같음 · 어긋남 · 받기 실패 · 너무 짧음)은 이유와 함께 세고 건너뛴다.
//   ③ **되돌릴 수 있다** — 옛 본문 전체를 쓰기 **전에** gzip 파일에 적는다(`--restore` 로 복원 ·
//      복원은 지금 본문의 해시가 바꾼 뒤의 해시와 같을 때만 — 그 사이 다른 손이 닿았으면 건너뛴다).
//   ④ **재실행 안전** — 고친 행은 다음 실행에서 「같음」으로 걸러진다.
//   ⑤ **판정을 지우지 않고 무효로 옮긴다** — 보관 판정(`gate.retain`)은 잘린 본문을 읽고 매긴 것이라
//      `gate.retain_stale` 로 옮긴다(키 하나만 바꾸고 나머지 csat_fit 은 그대로). 그래야 진행표가
//      그 원본을 「판정 전」으로 세고 원문 점검 뽑기가 다시 집는다.
//
// ── 이 스크립트가 **하지 않는** 것 ──────────────────────────────────
//   · 학령·CEFR·어휘 재분석: `pnpm dlx tsx scripts/acp/reprocess.mjs --commit`
//   · 이 원본에서 잘라 둔 발췌 조각(`plos-extract`) 점검 — 사라진 절의 앞뒤를 이어 붙인 조각이 있을 수 있다.
//
// 실행(env 가 있는 주 작업 폴더에서):
//   npx tsx scripts/acp/plos-figure-refetch.mts --limit 20              ← 예행(세기만)
//   npx tsx scripts/acp/plos-figure-refetch.mts --limit 200 --commit    ← 소량 적재(백업 자동)
//   npx tsx scripts/acp/plos-figure-refetch.mts --restore tmp/…jsonl.gz --commit  ← 되돌리기

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

import { ingestPlosArticle } from '../../packages/library-pipeline/src/ingest-article/plos'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '')
}
const arg = (k: string) => {
  const i = process.argv.indexOf(`--${k}`)
  return i >= 0 ? process.argv[i + 1] ?? null : null
}
const COMMIT = process.argv.includes('--commit')
const LIMIT = Number(arg('limit') ?? 0) || Infinity
const CONCURRENCY = Number(arg('concurrency') ?? 4)
const PAGE = 200
/** ACP 경로 피드 — `harvest`(Solr body)·`plos-extract`(조각)·`adapted` 는 대상이 아니다. */
const ACP_FEEDS = ['recent', 'essay', 'default']

const { createScriptClient } = await import('../lib/supabase-client.mjs')
const db = createScriptClient()

const sha256 = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')
const wordCount = (s: string) => (s.trim().match(/\S+/g) ?? []).length
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

// ── 되돌리기 ────────────────────────────────────────────────────────
const RESTORE = arg('restore')
if (RESTORE) {
  const lines = zlib.gunzipSync(fs.readFileSync(path.resolve(RESTORE))).toString('utf8').split('\n').filter(Boolean)
  console.log(`되돌리기 — ${RESTORE} (${lines.length.toLocaleString()}행) · ${COMMIT ? '쓰기' : '예행'}`)
  const t = { ok: 0, changed: 0, missing: 0, failed: 0 }
  for (const raw of lines) {
    const rec = JSON.parse(raw)
    const { data } = await db.from('library_articles').select('id,content,csat_fit').eq('id', rec.id).maybeSingle()
    if (!data) { t.missing += 1; continue }
    if (sha256(data.content ?? '') !== rec.hash_after) { t.changed += 1; continue }
    if (!COMMIT) { t.ok += 1; continue }
    const fit = data.csat_fit ?? {}
    const gate = { ...(fit.gate ?? {}) }
    if (rec.retain_before) { gate.retain = rec.retain_before; delete gate.retain_stale }
    const { error } = await db
      .from('library_articles')
      .update({ content: rec.content_before, content_hash: rec.hash_before, word_count: rec.wc_before, csat_fit: { ...fit, gate } })
      .eq('id', rec.id)
    if (error) t.failed += 1
    else t.ok += 1
  }
  console.log(`  되돌림/가능 ${t.ok} · 그 사이 바뀜 ${t.changed} · 행 없음 ${t.missing}${t.failed ? ` · 실패 ${t.failed}` : ''}`)
  process.exit(0)
}

// ── 백업(쓰기 모드에서만 · 쓰기보다 먼저) ───────────────────────────
const BACKUP = COMMIT ? path.resolve('tmp', `plos-figure-refetch-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl.gz`) : null
const backupLines: string[] = []
const flushBackup = () => {
  if (!BACKUP || backupLines.length === 0) return
  fs.mkdirSync(path.dirname(BACKUP), { recursive: true })
  // gzip 멤버를 이어 붙인다 — gunzip 은 여러 멤버를 한 스트림으로 읽는다.
  fs.appendFileSync(BACKUP, zlib.gzipSync(backupLines.join('\n') + '\n'))
  backupLines.length = 0
}

type Row = { id: string; source_url: string; content: string | null; word_count: number | null; csat_fit: any }
type Outcome = { reason: string; gain?: number; row: Row; fresh?: string }

/** 옛 본문의 400자 간격 50자 창이 새 본문에 들어 있는 비율 — 새 본문이 옛 것을 품는가. */
function covered(stored: string, fresh: string): number {
  let hit = 0
  let tot = 0
  for (let i = 0; i + 50 <= stored.length; i += 400) {
    tot += 1
    if (fresh.includes(stored.slice(i, i + 50))) hit += 1
  }
  return tot ? hit / tot : 1
}

async function judge(row: Row): Promise<Outcome> {
  let fresh: string
  try {
    fresh = (await ingestPlosArticle(row.source_url)).content
  } catch (e) {
    return { reason: (e as Error).name === 'ShortBodyError' ? 'short' : 'fetch-failed', row }
  }
  const a = norm(row.content ?? '')
  const b = norm(fresh)
  const gain = a.length ? b.length / a.length - 1 : 1
  if (gain < 0.03) return { reason: 'same', gain, row }
  const cov = covered(a, b)
  if (process.argv.includes('--verbose')) console.log(`\n  ${row.source_url.split('id=')[1]} gain ${Math.round(gain * 100)}% cover ${Math.round(cov * 100)}%`)
  // 90% 가 아니라 50% 다 — 옛 본문에만 있는 것은 대개 **이미 고친 다른 결함의 잔재**다(실측 2026-09-25, 어긋남 6편 눈으로 확인):
  //   서지 블록(Received·Copyright·Funding — articleinfo 제거 이전 적재)과 사라진 기호 자리(지금은 「[수식]」 표지).
  //   절반도 겹치지 않으면 다른 글을 받아 온 것일 수 있으니 그때만 건너뛴다.
  if (cov < 0.5) return { reason: 'diverged', gain, row }
  return { reason: 'refetch', gain, row, fresh }
}

const tally: Record<string, number> = {}
let scanned = 0
let written = 0
let failed = 0
let gainSum = 0
let staled = 0
let cursor: string | null = null

console.log(`PLOS 그림 제거 결함 재수집 — ${COMMIT ? '쓰기(--commit)' : '예행(아무것도 안 쓴다)'}`)
if (BACKUP) console.log(`  백업 → ${path.relative(process.cwd(), BACKUP)}`)

outer: while (scanned < LIMIT) {
  let q = db
    .from('library_articles')
    .select('id,source_url,content,word_count,csat_fit')
    .eq('source', 'plos')
    .in('feed_id', ACP_FEEDS)
    .in('status', ['ready', 'published', 'queued'])
    .order('id')
    .limit(PAGE)
  if (cursor) q = q.gt('id', cursor)
  const { data, error } = await q
  if (error) { console.error(`\n  목록 조회 실패 — ${error.message} (커서 ${cursor ?? '처음'}) · 아래는 부분 집계`); break }
  if (!data?.length) break
  cursor = data[data.length - 1]!.id

  const rows = (data as Row[]).slice(0, Math.max(0, LIMIT - scanned))
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const outs = await Promise.all(rows.slice(i, i + CONCURRENCY).map(judge))
    for (const o of outs) {
      scanned += 1
      tally[o.reason] = (tally[o.reason] ?? 0) + 1
      if (o.reason !== 'refetch') continue
      gainSum += o.gain!
      if (!COMMIT) continue
      const before = o.row.content ?? ''
      const fit = o.row.csat_fit ?? {}
      const gate = { ...(fit.gate ?? {}) }
      const retainBefore = gate.retain ?? null
      if (retainBefore) {
        gate.retain_stale = { ...retainBefore, stale: { reason: 'plos-figure-refetch', at: new Date().toISOString(), hash_before: sha256(before) } }
        delete gate.retain
      }
      backupLines.push(
        JSON.stringify({
          id: o.row.id,
          content_before: before,
          hash_before: sha256(before),
          wc_before: o.row.word_count ?? wordCount(before),
          hash_after: sha256(o.fresh!),
          retain_before: retainBefore,
        }),
      )
      flushBackup()
      const { error: werr } = await db
        .from('library_articles')
        .update({ content: o.fresh, content_hash: sha256(o.fresh!), word_count: wordCount(o.fresh!), csat_fit: { ...fit, gate } })
        .eq('id', o.row.id)
      if (werr) { failed += 1; console.error(`\n  쓰기 실패 ${o.row.id}: ${werr.message}`) }
      else { written += 1; if (retainBefore) staled += 1 }
    }
    process.stdout.write(`\r  훑음 ${scanned.toLocaleString()} · 재수집 대상 ${(tally.refetch ?? 0).toLocaleString()}`)
    if (scanned >= LIMIT) break outer
  }
  if (data.length < PAGE) break
}

console.log('\n')
console.log(`  훑은 편수       ${scanned.toLocaleString()}`)
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(14)} ${v.toLocaleString()}`)
if (tally.refetch) console.log(`  재수집 대상 평균 증가 ${Math.round((gainSum / tally.refetch) * 100)}%`)
if (COMMIT) {
  console.log(`\n  쓴 편수 ${written.toLocaleString()}${failed ? ` · 실패 ${failed}` : ''} · 보관 판정 무효로 옮김 ${staled}`)
  console.log(`  되돌리려면 npx tsx scripts/acp/plos-figure-refetch.mts --restore ${BACKUP ? path.relative(process.cwd(), BACKUP).split(path.sep).join('/') : ''} --commit`)
  console.log('  다음: pnpm dlx tsx scripts/acp/reprocess.mjs --commit  (학령·CEFR·어휘 재분석)')
} else {
  console.log('\n  아무것도 쓰지 않았다. 실제로 쓰려면 --commit.')
}
