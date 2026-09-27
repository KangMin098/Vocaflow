// scripts/acp/plos-piece-seam-scan.mjs
//
// **잘린 원본에서 잘라 둔 PLOS 발췌 조각에 「이음매」가 있는지 센다 — 읽기 전용.**
//
// 2026-09-25: ACP 경로 PLOS 원본은 그림 제거 결함으로 절이 통째로 빠진 채 저장돼 있었고, 발췌기(`plos-extract`)는
// 그 본문에서 조각을 잘랐다. 원본은 재수집으로 고쳤다(`plos-figure-refetch.mts`). 조각은 따로 저장된 행이라
// 그대로다 — 빠진 절의 앞뒤를 한 조각으로 이어 붙였다면 글이 아니다.
//
// 판정(조각 본문을 공백 정규화해 **지금의 원본**과 대조):
//   intact  — 조각 전체가 원본 안에 그대로 이어져 있다
//   other            — 문장 몇 개를 뺀 정상 조각(발췌기의 `sentDrop`)
//   seam             — 지금 원본에서는 1,200자 넘게 떨어진 이웃 문장이 **옛 본문에서는 붙어 있었다** → 그림 결함의 이음매
//   gap-by-extractor — 옛 본문에서도 떨어져 있었다 → 발췌기가 문단(대개 수식 문단)을 건너뛴 자리 — 결함과 무관
//   seam-unknown     — 원본이 재수집되지 않아 옛 본문이 없다(`--backup` 을 안 줬거나 교체 안 된 원본)
//
// 실행에 재수집 백업을 준다: --backup tmp/plos-figure-refetch-….jsonl.gz
//   no-parent — 같은 source_url 원본을 못 찾음
//
// 실행: node --tls-max-v1.2 scripts/acp/plos-piece-seam-scan.mjs [--out <json>]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (k) => {
  const i = process.argv.indexOf(`--${k}`)
  return i >= 0 ? process.argv[i + 1] ?? null : null
}
const OUT = arg('out')
const ACP_FEEDS = ['recent', 'essay', 'default']

const { createScriptClient } = await import('../lib/supabase-client.mjs')
const db = createScriptClient()
// 발췌기는 빈 인용 표시(「 []」)를 지운다 — 원본 쪽에도 같은 것을 지워야 같은 글이 같게 보인다(실측 표본).
const norm = (s) => String(s ?? '').replace(/\s*\[\s*\]/g, '').replace(/\s+/g, ' ').trim()

// ⚠️ 조각은 원래 **이어진 창이 아니다** — 발췌기가 인용·수식이 문장을 깨는 문장을 빼고 이어 붙인다(`sentDrop`).
//   그래서 「원본에 그대로 들어 있나」로는 이음매를 못 가린다(실측: 그대로 111 · 나머지 3,276 — 표본 6편 모두 문장 한둘 빠짐).
//   대신 조각의 문장을 원본에서 차례로 찾아 **이웃 문장 사이 거리**를 잰다. 문장 하나를 뺀 자리는 수백 자이고,
//   사라진 절을 건너 이은 자리는 절 하나(수천 자)다.
const JUMP = 1200
function jumpOf(piece, parent) {
  const sents = piece.split(/(?<=[.!?])\s+/).filter((s) => s.length >= 40)
  let pos = -1
  let max = 0
  for (const s of sents) {
    const at = parent.indexOf(s, Math.max(0, pos))
    if (at < 0) continue
    if (pos >= 0) max = Math.max(max, at - pos)
    pos = at + s.length
  }
  return max
}

// ── 원본(ACP 경로) source_url → id ──────────────────────────────────
const parents = new Map()
let cursor = null
for (;;) {
  let q = db.from('library_articles').select('id,source_url').eq('source', 'plos').in('feed_id', ACP_FEEDS).order('id').limit(1000)
  if (cursor) q = q.gt('id', cursor)
  const { data, error } = await q
  if (error) throw new Error(`원본 목록 — ${error.message}`)
  if (!data.length) break
  for (const r of data) parents.set(r.source_url, r.id)
  cursor = data[data.length - 1].id
}

// ── 조각(plos-extract) 중 부모가 ACP 경로인 것 ──────────────────────
const pieces = []
cursor = null
for (;;) {
  let q = db.from('library_articles').select('id,source_url,content,status').eq('source', 'plos').eq('feed_id', 'plos-extract').order('id').limit(500)
  if (cursor) q = q.gt('id', cursor)
  const { data, error } = await q
  if (error) throw new Error(`조각 목록 — ${error.message}`)
  if (!data.length) break
  for (const r of data) if (parents.has(r.source_url)) pieces.push(r)
  cursor = data[data.length - 1].id
}
console.log(`ACP 경로 원본 ${parents.size.toLocaleString()} · 그 원본의 조각 ${pieces.length.toLocaleString()}`)

// ── 부모 본문을 묶음으로 받아 대조 ──────────────────────────────────
const byParent = new Map()
for (const p of pieces) {
  const pid = parents.get(p.source_url)
  if (!byParent.has(pid)) byParent.set(pid, [])
  byParent.get(pid).push(p)
}
// ── 재수집 백업(옛 본문) — 부모만 골라 담는다(전량은 수백 MB) ─────
const OLD = new Map()
const BACKUP = arg('backup')
if (BACKUP) {
  const zlib = await import('node:zlib')
  const readline = await import('node:readline')
  const rl = readline.createInterface({ input: fs.createReadStream(path.resolve(BACKUP)).pipe(zlib.createGunzip()), crlfDelay: Infinity })
  for await (const line of rl) {
    if (!line) continue
    const id = line.slice(7, 43) // {"id":"<uuid>" — 전체를 파싱하기 전에 거른다
    if (!byParent.has(id)) continue
    const rec = JSON.parse(line)
    OLD.set(rec.id, norm(rec.content_before))
  }
  console.log(`  옛 본문(백업) ${OLD.size.toLocaleString()}편`)
}
const tally = { intact: 0, other: 0, seam: 0, 'gap-by-extractor': 0, 'seam-unknown': 0, 'no-parent': 0 }
const rows = []
const ids = [...byParent.keys()]
for (let i = 0; i < ids.length; i += 20) {
  const { data, error } = await db.from('library_articles').select('id,content').in('id', ids.slice(i, i + 20))
  if (error) throw new Error(`원본 본문 — ${error.message}`)
  const body = new Map(data.map((r) => [r.id, norm(r.content)]))
  for (const pid of ids.slice(i, i + 20)) {
    const parent = body.get(pid)
    for (const p of byParent.get(pid)) {
      const t = norm(p.content)
      let v
      if (!parent) v = 'no-parent'
      else if (parent.includes(t)) v = 'intact'
      else if (jumpOf(t, parent) <= JUMP) v = 'other'
      else {
        // 큰 틈은 발췌기가 수식 문단을 뺀 자리일 수도 있다(표본 5편 중 3편). **옛 본문에서는 붙어 있었고
        // 틈의 글이 옛 본문에 없었을 때만** 그림 결함의 이음매다 — 재수집 백업의 옛 본문으로 가린다.
        const old = OLD.get(pid)
        v = old == null ? 'seam-unknown' : jumpOf(t, old) <= JUMP ? 'seam' : 'gap-by-extractor'
      }
      tally[v] += 1
      if (v !== 'intact') rows.push({ id: p.id, parent: pid, status: p.status, verdict: v, head: t.slice(0, 120) })
    }
  }
  process.stdout.write(`\r  대조 ${Math.min(i + 20, ids.length).toLocaleString()}/${ids.length.toLocaleString()} 원본`)
}
console.log('\n')
for (const [k, v] of Object.entries(tally)) console.log(`  ${k.padEnd(10)} ${v.toLocaleString()}`)
if (OUT) {
  fs.writeFileSync(path.resolve(OUT), JSON.stringify({ tally, rows }, null, 1))
  console.log(`\n  이음매·기타 목록 → ${OUT}`)
}

// ── --archive: 이음매 조각(ready)을 보관함으로 — 되돌릴 수 있게 ────
// 글이 아닌 조각을 교재 후보로 남겨 두지 않는다. 지우지 않고 status 만 archived 로 바꾸고,
// 이유를 csat_fit.seam 키 하나로 더한다(나머지 csat_fit 은 그대로). 옛 상태는 파일로 먼저 적는다.
// 되돌리기: 그 파일의 id 를 status 'ready' 로 되돌리고 csat_fit.seam 을 지운다.
if (process.argv.includes('--archive')) {
  const COMMIT = process.argv.includes('--commit')
  const targets = rows.filter((r) => r.verdict === 'seam' && r.status === 'ready').map((r) => r.id)
  // 다른 표가 이 조각을 쓰고 있으면 멈춘다 — 보관함으로 옮기면 그 쪽이 조용히 깨진다.
  const refs = {}
  for (const [tbl, col] of [['article_compose_jobs', 'source_article_id'], ['article_compose_jobs', 'article_id'], ['article_compose_gates', 'article_id'], ['library_articles', 'adapted_from_id']]) {
    for (let i = 0; i < targets.length; i += 100) {
      const { count, error } = await db.from(tbl).select('*', { count: 'exact', head: true }).in(col, targets.slice(i, i + 100))
      if (error || count == null) throw new Error(`참조 확인 실패 ${tbl}.${col} — ${error?.message ?? 'count 없음'}`)
      refs[`${tbl}.${col}`] = (refs[`${tbl}.${col}`] ?? 0) + count
    }
  }
  console.log(`\n  보관함으로 옮길 이음매 조각(ready) ${targets.length} · 참조 ${JSON.stringify(refs)}`)
  if (Object.values(refs).some((n) => n > 0)) {
    console.log('  ⚠️ 다른 표가 쓰는 조각이 있다 — 옮기지 않는다. 그 쪽을 먼저 정리할 것.')
    process.exit(1)
  }
  if (!COMMIT) {
    console.log('  예행 — 옮기려면 --archive --commit')
    process.exit(0)
  }
  const LOG = path.resolve('tmp', `plos-seam-archive-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.mkdirSync(path.dirname(LOG), { recursive: true })
  fs.writeFileSync(LOG, JSON.stringify({ ids: targets, from: 'ready' }, null, 1))
  let moved = 0
  for (const id of targets) {
    const { data } = await db.from('library_articles').select('csat_fit').eq('id', id).single()
    const fit = { ...(data?.csat_fit ?? {}), seam: { reason: 'plos-figure-refetch 뒤 사라진 절을 건너 이은 조각', scan: 'plos-piece-seam-scan' } }
    const { error } = await db.from('library_articles').update({ status: 'archived', csat_fit: fit }).eq('id', id).eq('status', 'ready')
    if (error) console.error(`  실패 ${id}: ${error.message}`)
    else moved += 1
  }
  console.log(`  옮김 ${moved}/${targets.length} · 되돌리기 목록 ${path.relative(process.cwd(), LOG)}`)
}
