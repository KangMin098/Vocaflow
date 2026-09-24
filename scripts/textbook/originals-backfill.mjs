// scripts/textbook/originals-backfill.mjs
//
// **원천 되채움 — 조각만 저장된 파생물에 원천 행을 받아 담고, 조각을 원천에 잇는다.**
//
// ── 왜 (실측 2026-09-24) ─────────────────────────────────────────────
// 보관 판정은 원천 단위다(docs/source-check/criteria.md §1 「파생물은 원천이 아니다」). 그런데 수집기
// 다섯이 수집 단계에서 자른 조각만 담았다 — europe_pmc `#p<a>-<b>` 1,211 · space_place 54 ·
// storyweaver 77 · simple_wikipedia `#lead`/`#lead-trim` 59 · frym `frym:<DOI>` 152(초록만).
// 수집기는 이제 원천을 먼저 담는다(`_originals.mjs`). 이 스크립트는 **이미 들어온 조각**의 원천을 채운다.
//
// ── 무엇을 하는가 ────────────────────────────────────────────────────
//   1. 대상 소스의 행을 훑어 파생물을 고른다 — gate-rules `derivativeKind` + frym 초록 행.
//      `csat_fit.derived_from` 이 이미 있으면 건너뛴다(재실행 안전).
//   2. 원천 열쇠로 묶는다 — 조각 둘이 한 원천을 가리키면 원천은 한 번만 담는다.
//        europe_pmc:PMC…#p1-2      → europe_pmc:PMC…            (kind paragraphs · 본문 전문 scope 'full')
//        space_place:<slug>#p…     → space_place:<slug>         (kind excerpt)
//        storyweaver:<slug>#p…     → storyweaver:<slug>         (kind excerpt)
//        frym:<DOI>#p…             → frym-full:<DOI>            (kind excerpt)
//        frym:<DOI>  (초록만)      → frym-full:<DOI>            (kind abstract)
//        <Title>#lead(-trim)       → simple_wikipedia:<pageid>  (kind lead · pageid 는 받아 봐야 안다)
//        adapt:<uuid>:<n>          → 그 uuid 행                 (kind adapt · 받지 않는다 — 이미 DB 에 있다)
//   3. 원천이 이미 있으면 그 행에 잇고, 없으면 **수집기와 같은 파서로** 받아 담는다(status 'queued' ·
//      `csat_fit.rights`). 받지 못하면 이유를 세어 출력한다 — 삼키지 않는다.
//   4. 조각의 `csat_fit.derived_from = { id, source_id, kind }` 을 **합친다**(다른 키는 그대로 · updated_at CAS).
//
// ── 재실행 안전: 그렇다 ──────────────────────────────────────────────
// 원천은 `(source, source_id)` 로 먼저 조회하고, 연결이 있는 조각은 건너뛴다. 중간에 죽어도 다시
// 돌리면 남은 것만 한다. CAS 에 진 조각(그 사이 누가 고침)은 `conflict` 로 세고 다음 실행이 다시 본다.
// ⚠️ 기본은 dry-run — 원천을 **받아 보기는 하지만**(어수·실패 사유를 보이려고) DB 에는 쓰지 않는다.
//
// ── ⚠️ 연결은 적격 캐시를 낡게 만든다 ─────────────────────────────────
// 조각 행을 고치면 `updated_at` 이 오른다 → `csat_source_eligibility.source_updated_at` 과 어긋나
// DB 함수가 그 행을 **부적격으로 본다**(캐시를 다시 채울 때까지). 그래서 `--commit` 은 고친 조각 중
// ready·published 인 것의 id 를 `.agent-logs/originals-backfill-touched-<시각>.txt` 에 남기고,
// 100개씩 나눈 `…-partNN.txt` 도 함께 쓴다. 이어서 조각마다:
//
//   pnpm exec tsx scripts/textbook/source-policy-refresh.mjs --ids-file .agent-logs/originals-backfill-touched-<시각>-part01.txt --output .agent-logs/originals-backfill-refresh-part01.jsonl
//   pnpm exec tsx scripts/textbook/source-policy-refresh.mjs --plan   .agent-logs/originals-backfill-refresh-part01.jsonl --limit 100
//   pnpm exec tsx scripts/textbook/source-policy-refresh.mjs --commit .agent-logs/originals-backfill-refresh-part01.jsonl --limit 100
//
// 새로 담은 원천은 'queued' 라 캐시 대상이 아니다(처리 뒤 ready 가 되면 그때 채운다).
//
// 실행 (node 가 Supabase 에 TLS 로 못 붙으면 NODE_OPTIONS=--tls-max-v1.2):
//   pnpm exec tsx scripts/textbook/originals-backfill.mjs --source space_place            # dry-run
//   pnpm exec tsx scripts/textbook/originals-backfill.mjs --source europe_pmc --limit 20  # 원천 20개만
//   pnpm exec tsx scripts/textbook/originals-backfill.mjs --source frym --commit

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}
const COMMIT = process.argv.includes('--commit')
const LIMIT = arg('limit') ? Number(arg('limit')) : Infinity
const GAP_MS = Number(arg('gap') ?? 700)
const SOURCES = ['europe_pmc', 'space_place', 'storyweaver', 'simple_wikipedia', 'vikidia', 'frym']
const ONLY = arg('source')
if (ONLY && !SOURCES.includes(ONLY)) throw new Error(`--source 는 ${SOURCES.join(' | ')}`)
if (!Number.isFinite(LIMIT) && arg('limit')) throw new Error('--limit N (양의 정수)')

const { createScriptClient } = await import('../lib/supabase-client.mjs')
const { derivativeKind } = await import('../csat/gate-rules.mjs')
const { ensureOriginal, findRow, linkDerived, derivedFromOf } = await import('./_originals.mjs')
const { mediawikiLead } = await import('./_mediawiki.mjs')
const epmc = await import('../../packages/library-pipeline/src/ingest-article/europe-pmc.ts')
const { ingestSpacePlaceArticle, spacePlaceUrl } = await import(
  '../../packages/library-pipeline/src/ingest-article/space-place.ts'
)
const { ingestStoryweaverArticle, storyweaverBookUrl } = await import(
  '../../packages/library-pipeline/src/ingest-article/storyweaver.ts'
)
const { ingestFrymArticle, frymFullUrl } = await import(
  '../../packages/library-pipeline/src/ingest-article/frontiers-young-minds.ts'
)
const { isShortBodyError } = await import('../../packages/library-pipeline/src/ingest-article/short-body.ts')

const db = createScriptClient()

/** 위키 — mediawiki-lead-ingest 와 같은 값(라이선스 표기까지). */
const WIKIS = {
  simple_wikipedia: { api: 'https://simple.wikipedia.org/w/api.php', site: 'https://simple.wikipedia.org/wiki/', license: 'CC-BY-SA-4.0' },
  vikidia: { api: 'https://en.vikidia.org/w/api.php', site: 'https://en.vikidia.org/wiki/', license: 'CC-BY-SA-3.0' },
}

// ── 1. 훑기 ──────────────────────────────────────────────────────────
const rows = []
for (const source of ONLY ? [ONLY] : SOURCES) {
  let cursor = '00000000-0000-0000-0000-000000000000'
  for (;;) {
    const { data, error } = await db
      .from('library_articles')
      .select('id, source, source_id, feed_id, feed_label, license, status, updated_at, csat_fit')
      .eq('source', source)
      .gt('id', cursor)
      .order('id')
      .limit(500)
    if (error) throw new Error(`훑기 실패 ${source}: ${error.message}`)
    rows.push(...data)
    if (data.length < 500) break
    cursor = data[data.length - 1].id
  }
}

/**
 * 조각 → 원천 계획. `null` 이면 원천(또는 이 스크립트가 다루지 않는 것).
 * @returns {{ group: string, kind: string, plan: object } | null}
 */
function planOf(r) {
  const id = String(r.source_id ?? '')
  const adapt = id.match(/^adapt:([0-9a-f-]{36}):/i)
  if (adapt) return { group: `id:${adapt[1]}`, kind: 'adapt', plan: { type: 'row', id: adapt[1] } }
  // frym 초록 행 — 원본 열쇠 모양이라 derivativeKind 가 못 가른다(본문이 초록뿐이라는 것은 실측).
  const frymAbs = r.source === 'frym' && id.match(/^frym:(10\.3389\/frym\.[0-9.]*[0-9])$/)
  if (frymAbs) return { group: `frym:${frymAbs[1]}`, kind: 'abstract', plan: { type: 'frym', doi: frymAbs[1] } }
  const dk = derivativeKind({ source_id: r.source_id, feed_id: r.feed_id })
  if (!dk) return null
  const base = id.replace(/#.*$/, '')
  if (dk === 'lead' && WIKIS[r.source]) {
    return { group: `${r.source}:title:${base}`, kind: 'lead', plan: { type: 'wiki', title: base } }
  }
  if (dk === 'paragraphs') {
    if (r.source === 'europe_pmc') {
      const pmcid = base.match(/PMC\d+/)?.[0]
      return pmcid ? { group: base, kind: 'paragraphs', plan: { type: 'epmc', pmcid, key: base } } : null
    }
    if (r.source === 'space_place') {
      return { group: base, kind: 'excerpt', plan: { type: 'space_place', slug: base.replace(/^space_place:/, ''), key: base } }
    }
    if (r.source === 'storyweaver') {
      return { group: base, kind: 'excerpt', plan: { type: 'storyweaver', slug: base.replace(/^storyweaver:/, ''), key: base } }
    }
    if (r.source === 'frym') {
      const doi = base.replace(/^frym:/, '')
      return { group: `frym:${doi}`, kind: 'excerpt', plan: { type: 'frym', doi } }
    }
  }
  return { group: null, kind: dk, plan: { type: 'unsupported', why: `${r.source} · ${dk}` } }
}

const counts = { scanned: rows.length, derivatives: 0, alreadyLinked: 0, unsupported: {} }
/** 원천 묶음: group → { plan, children: [{ row, kind }] } */
const groups = new Map()
for (const r of rows) {
  const p = planOf(r)
  if (!p) continue
  counts.derivatives++
  if (r.csat_fit?.derived_from?.id) {
    counts.alreadyLinked++
    continue
  }
  if (p.plan.type === 'unsupported') {
    counts.unsupported[p.plan.why] = (counts.unsupported[p.plan.why] ?? 0) + 1
    continue
  }
  if (!groups.has(p.group)) groups.set(p.group, { plan: p.plan, source: r.source, children: [] })
  groups.get(p.group).children.push({ row: r, kind: p.kind })
}

console.log(
  `원천 되채움 — ${ONLY ?? SOURCES.join('·')} · ${COMMIT ? '커밋' : 'dry-run(받아 보기만 · DB 에 안 쓴다)'}\n` +
    `훑음 ${counts.scanned} · 파생물 ${counts.derivatives} · 이미 연결 ${counts.alreadyLinked} · ` +
    `연결할 조각 ${[...groups.values()].reduce((n, g) => n + g.children.length, 0)} · 원천 묶음 ${groups.size}` +
    `${Number.isFinite(LIMIT) ? ` (이번 실행 ${LIMIT}개까지)` : ''}\n`,
)
for (const [why, n] of Object.entries(counts.unsupported)) console.log(`  ⚠ 다루지 않는 파생물 ${why}: ${n}`)

// ── 2. 원천 받기 ─────────────────────────────────────────────────────
/**
 * 일시 장애로 보이는 실패 — 물러섰다 다시 묻는다. 멀쩡한 원천을 「받기 실패」로 세지 않게.
 * 실측(2026-09-24 dry-run): ebi.ac.uk 는 node fetch 가 20 중 9 를 「본문을 못 받았다」로 떨궜고 곧바로
 * 다시 물으면 200 이었다(epmc-ingest 머리말과 같은 증상). storyweaver 는 연달아 물으면 429 를 준다.
 */
const TRANSIENT = /\b429\b|\b5\d\d\b|fetch failed|timeout|abort|ECONN|못 받았다/i

/** 짧은 본문은 버리지 않는다(길이로 원문을 제외하지 않는다) — 빈 본문만 실패로 센다. */
async function tolerant(fn, tries = 4) {
  let last
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      if (isShortBodyError(e) && e.article && String(e.article.content ?? '').trim()) return e.article
      last = e
      if (!TRANSIENT.test(String(e?.message ?? e))) break
      await new Promise((z) => setTimeout(z, 3_000 * 2 ** i))
    }
  }
  throw last
}

/** 원천 { article, key, feedId?, feedLabel? } — 받지 못하면 던진다(부르는 쪽이 사유를 센다). */
async function fetchOriginal(plan, children) {
  const first = children[0].row
  switch (plan.type) {
    case 'epmc': {
      // 목록 라이선스 자리에 조각이 이미 가진 값을 넘긴다 — 둘 중 더 제한적인 쪽이 적힌다.
      const article = await tolerant(() => epmc.ingestEuropePmcArticle(plan.pmcid, first.license ?? null, { scope: 'full' }))
      return { article, key: plan.key, feedId: first.feed_id ?? null, feedLabel: first.feed_label ?? null }
    }
    case 'space_place': {
      const article = await tolerant(() => ingestSpacePlaceArticle(spacePlaceUrl(plan.slug)))
      return { article, key: plan.key }
    }
    case 'storyweaver': {
      const article = await tolerant(() => ingestStoryweaverArticle(storyweaverBookUrl(plan.slug)))
      return { article, key: plan.key }
    }
    case 'frym': {
      const article = await tolerant(() => ingestFrymArticle(frymFullUrl(plan.doi)))
      return { article, key: `frym-full:${plan.doi}` }
    }
    case 'wiki': {
      const wiki = WIKIS[first.source]
      const got = await mediawikiLead(wiki.api, plan.title, { intro: false })
      if (got.error) throw new Error(got.error)
      if (!got.body) throw new Error('본문이 비었다(넘겨주기·삭제된 문서?)')
      const key = `${first.source}:${
        got.pageid != null ? String(got.pageid) : plan.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)
      }`
      return {
        key,
        article: {
          source: first.source,
          source_id: key,
          title: plan.title,
          author: null,
          source_url: `${wiki.site}${encodeURIComponent(plan.title.replace(/ /g, '_'))}`,
          published_at: null,
          license: wiki.license,
          license_evidence: 'collection-default',
          content: got.body,
        },
      }
    }
    default:
      throw new Error(`알 수 없는 계획 ${plan.type}`)
  }
}

/** 받기 전에 원천 열쇠를 아는 경우 먼저 DB 를 본다 — 이미 있으면 받지 않는다. */
function keyBeforeFetch(plan) {
  if (plan.type === 'frym') return `frym-full:${plan.doi}`
  return plan.key ?? null
}

const stats = {
  parentsExisting: 0,
  parentsToInsert: 0,
  parentsInserted: 0,
  fetchFailures: [],
  childrenToLink: 0,
  childrenLinked: 0,
  childrenConflict: 0,
  childrenAlready: 0,
}
const samples = []
const touched = []
let processed = 0

for (const [group, g] of groups) {
  if (processed >= LIMIT) break
  processed++
  let parent = null

  try {
    if (g.plan.type === 'row') {
      const { data, error } = await db.from('library_articles').select('id, source_id').eq('id', g.plan.id).maybeSingle()
      if (error) throw new Error(`원천 행 조회 실패: ${error.message}`)
      if (!data) throw new Error('개작의 원천 행이 DB 에 없다')
      parent = { id: data.id, source_id: data.source_id, status: 'existed' }
      stats.parentsExisting++
    } else {
      const pre = keyBeforeFetch(g.plan)
      const found = pre ? await findRow(db, g.source, pre) : null
      if (found) {
        parent = { id: found.id, source_id: found.source_id, status: 'existed' }
        stats.parentsExisting++
      } else {
        const got = await fetchOriginal(g.plan, g.children)
        if (GAP_MS) await new Promise((z) => setTimeout(z, GAP_MS))
        parent = await ensureOriginal(db, {
          article: got.article,
          sourceId: got.key,
          feedId: got.feedId ?? null,
          feedLabel: got.feedLabel ?? null,
        }, { commit: COMMIT })
        if (parent.status === 'empty') throw new Error('받은 본문이 비었다(파서 확인)')
        if (parent.status === 'existed') stats.parentsExisting++
        else {
          stats.parentsToInsert++
          if (parent.status === 'inserted') stats.parentsInserted++
          if (samples.length < 40) samples.push({ source: g.source, key: parent.source_id, words: parent.words, title: got.article.title, children: g.children.length })
        }
      }
    }
  } catch (e) {
    stats.fetchFailures.push({ source: g.source, group, children: g.children.length, why: String(e.message ?? e).slice(0, 140) })
    console.log(`  ✗ ${g.source} ${group.slice(0, 60)} — ${String(e.message ?? e).slice(0, 90)}`)
    continue
  }

  for (const c of g.children) {
    stats.childrenToLink++
    const df = derivedFromOf(parent, c.kind)
    if (!df) continue // dry-run 이라 원천 id 가 아직 없다 — 셌으니 됐다
    const res = await linkDerived(db, c.row, df, { commit: COMMIT })
    if (res === 'linked') {
      stats.childrenLinked++
      if (c.row.status === 'ready' || c.row.status === 'published') touched.push(c.row.id)
    } else if (res === 'conflict') stats.childrenConflict++
    else if (res === 'already') stats.childrenAlready++
  }
  if (processed % 20 === 0) process.stdout.write(`  … ${processed}/${Math.min(groups.size, LIMIT)}\n`)
}

// ── 3. 보고 ──────────────────────────────────────────────────────────
console.log('\n── 결과 ──')
console.log(`원천 묶음 처리 ${processed}/${groups.size}`)
console.log(`  원천 이미 있음 ${stats.parentsExisting} · 담을 원천 ${stats.parentsToInsert}${COMMIT ? ` (담음 ${stats.parentsInserted})` : ''} · 받기 실패 ${stats.fetchFailures.length}`)
console.log(`  잇는 조각 ${stats.childrenToLink}${COMMIT ? ` (이음 ${stats.childrenLinked} · CAS 충돌 ${stats.childrenConflict} · 이미 ${stats.childrenAlready})` : ''}`)
if (stats.fetchFailures.length) {
  const byWhy = {}
  for (const f of stats.fetchFailures) {
    const k = `${f.source} · ${f.why.replace(/PMC\d+|10\.3389\/frym\.[\d.]+|https?:\/\/\S+/g, '…').slice(0, 80)}`
    byWhy[k] = (byWhy[k] ?? 0) + 1
  }
  console.log('  받기 실패 사유:')
  for (const [k, n] of Object.entries(byWhy).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${k}`)
}
if (samples.length) {
  console.log('  담을 원천 표본(어수):')
  for (const s of samples.slice(0, 12)) {
    console.log(`    ${String(s.words).padStart(6)}어  조각 ${s.children}  ${s.key.slice(0, 48).padEnd(49)}${String(s.title ?? '').slice(0, 40)}`)
  }
  const ws = samples.map((s) => s.words).sort((a, b) => a - b)
  console.log(`    표본 ${ws.length} · 어수 최소 ${ws[0]} · 중앙 ${ws[Math.floor(ws.length / 2)]} · 최대 ${ws.at(-1)}`)
}

if (COMMIT && touched.length) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = path.resolve('.agent-logs')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `originals-backfill-touched-${stamp}.txt`)
  fs.writeFileSync(file, touched.join('\n') + '\n')
  const parts = []
  for (let i = 0; i < touched.length; i += 100) {
    const part = path.join(dir, `originals-backfill-touched-${stamp}-part${String(i / 100 + 1).padStart(2, '0')}.txt`)
    fs.writeFileSync(part, touched.slice(i, i + 100).join('\n') + '\n')
    parts.push(part)
  }
  console.log(`\n⚠ 적격 캐시가 낡은 조각 ${touched.length}개 → ${path.relative(process.cwd(), file)} (${parts.length}조각)`)
  console.log('  이어서 조각마다 source-policy-refresh 로 캐시를 다시 채운다(머리말의 명령).')
} else if (!COMMIT) {
  console.log('\ndry-run 이었다. 실제로 쓰려면 --commit (원천 INSERT + 조각 csat_fit.derived_from 합치기).')
}
