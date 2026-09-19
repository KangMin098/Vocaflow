// scripts/comic/pd/ingest-bulk.mjs
//
// 대량 소스 GET — 컬렉션 전체를 훑어 `pd_comic_issues` 를 유형·시리즈까지 채워 적재한다.
//
//   node scripts/comic/pd/ingest-bulk.mjs --dry-run
//   node scripts/comic/pd/ingest-bulk.mjs --collection fawcett-comics
//   node scripts/comic/pd/ingest-bulk.mjs --all --pages 0        (전권 취득으로 적재)
//
// ── 콘솔 '큐 적재' 와 무엇이 다른가 ──────────────────────────────
//   콘솔 경로(/api/pdcp/enqueue)는 **화면에 뜬 검색 결과 중 고른 것**을 넣는다. 그래서
//   한 번에 20건씩 보이고 상한이 50건이며, 항목마다 `metadata` 를 한 번씩 더 친다.
//   1,000건을 그 경로로 넣으려면 사람이 50번 클릭해야 하고 IA 에 1,000회 추가 요청을 보낸다.
//
//   여기서는 **검색 응답만으로 적재한다** — 검색이 이미 title·year·identifier 를 주므로
//   호당 metadata 왕복이 필요 없다. 페이지 수·hOCR 유무는 어차피 취득 단계에서 확인한다.
//   1,020건 적재에 IA 요청은 11회(100건씩 페이지네이션)면 끝난다.
//
// ── 무엇을 적재하지 "않는가" ────────────────────────────────────
//   · 1964년 이후 발행물 — 저작권 자동 갱신 대상이라 PD 게이트를 통과할 수 없다.
//     넣어두면 큐만 막고 운영자가 매번 다시 판단해야 한다.
//   · 이미 있는 (adapter, identifier) — 유니크 제약이 막지만, 세어서 보고한다.
//   pd_basis 는 여기서 확정하지 않는다(연도만으로 확정 가능한 pre-1929 힌트만).
//   나머지는 NULL 로 두고 **발행 게이트가 사람의 확인을 강제**한다.

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { buildQuery, RENEWAL_ERA_END, yearFromTitle } from './sources/discovery.mjs'
import { classify, excludeReason, seriesCatalog } from './taxonomy.mjs'

const UA = 'Vocaflow-PDCP/1.0 (educational; contact via repo)'
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const REPO = path.resolve(HERE, '..', '..', '..')

/**
 * 적재 대상 소스 — 실측(2026-08-16)으로 **실제 만화가 들어 있는** 컬렉션만.
 *
 * `classics illustrated` 제목 검색은 여기 없다. 실측 208건 중 만화는 9건 남짓이고
 * 나머지는 Great Illustrated Classics(1989~96 산문·저작권 존속) · Saddleback's(현대)
 * · 1731~1745 고서였다. 제목에 그 말이 들어간다는 이유로 훑으면 **저작권 살아 있는 자료를
 * 큐에 채우게 된다** — 그래서 컬렉션 기반으로만 훑는다.
 */
export const SOURCES = [
  {
    key: 'fawcett-comics',
    label: 'Fawcett Comics',
    note: '사서 큐레이션 · Captain Marvel 계열 골든에이지. 실측 811건',
    filters: { collection: 'fawcett-comics' },
  },
  {
    key: 'ace-comics',
    label: 'Ace Comics',
    note: '괴기·범죄·로맨스 중심 골든에이지. 실측 209건 · 1964년 이후 0건',
    filters: { collection: 'ace-comics' },
  },
]

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i === -1 ? d : process.argv[i + 1]
}
const has = (n) => process.argv.includes(`--${n}`)

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`IA ${res.status} ${url}`)
  return res.json()
}

/**
 * 컬렉션 전량 페이지네이션 — 검색 응답만 쓴다(호당 metadata 왕복 없음).
 *
 * ⚠️ **정렬을 반드시 지정한다.** IA advancedsearch 는 sort 없이 페이지를 넘기면 순서가
 * 고정되지 않아 같은 항목이 여러 페이지에 나오고 **어떤 항목은 아예 안 나온다**.
 * 실측(2026-08-16): 정렬 없이 811+209=1,020건을 받았더니 214건이 중복이었고,
 * 그 대신 빠진 항목들이 있었다(앞선 표본에 없던 제목 4건이 뒤늦게 나타나 드러났다).
 * 중복은 눈에 띄지만 **누락은 눈에 띄지 않는다** — "전체를 가져왔다"고 믿는 순간이 가장 위험하다.
 * `identifier asc` 는 항목마다 유일하고 불변이라 페이지 경계가 흔들리지 않는다.
 *
 * numFound 와 실제 수집 수를 대조해 누락이 남으면 호출자가 알 수 있게 돌려준다.
 */
export async function fetchAll(filters, { rows = 100, maxPages = 40, onPage } = {}) {
  const out = []
  let total = 0
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      q: buildQuery('', filters),
      rows: String(rows),
      page: String(page),
      output: 'json',
    })
    params.append('sort[]', 'identifier asc') // ← 페이지네이션 안정성의 전제
    const url =
      'https://archive.org/advancedsearch.php?' +
      params +
      '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&fl%5B%5D=date' +
      '&fl%5B%5D=imagecount&fl%5B%5D=collection'
    const j = await getJson(url)
    const docs = j.response?.docs ?? []
    total = Number(j.response?.numFound) || total
    out.push(...docs)
    onPage?.(page, docs.length, total)
    if (docs.length < rows) break
  }
  out.totalFound = total
  return out
}

/** 검색 문서 하나 → 적재 행. 제외 대상이면 `{ skip: 사유 }`. */
export function toRow(doc, { adapter = 'internet-archive', acquirePages = null } = {}) {
  // 읽을 수 있는 호가 아닌 것부터 막는다 — 분류·취득을 다 돌린 뒤 알면 늦다.
  const notIssue = excludeReason(doc)
  if (notIssue) return { skip: notIssue }

  const year =
    Number(doc.year) ||
    Number(String(doc.date ?? '').slice(0, 4)) ||
    yearFromTitle(doc.title) ||
    null

  // 1964년 이후는 갱신 조사 여지가 없다 — 큐에 넣어도 발행까지 갈 수 없다.
  if (year && year > RENEWAL_ERA_END) {
    return { skip: `${year}년 — 저작권 자동 갱신 대상` }
  }

  const c = classify(doc)
  return {
    row: {
      slug: makeSlug(c, doc),
      title: String(doc.title ?? doc.identifier),
      // 원본 표기를 보존한다 — 정규화 결과와 대조해야 분류 오류를 찾을 수 있다.
      series_title: String(doc.title ?? '').replace(/^\s*(fawcett|ace)\s*comics\s*:\s*/i, '').trim() || null,
      issue_no: c.issueNo,
      published_year: year,
      source_adapter: adapter,
      source_identifier: doc.identifier,
      source_url: `https://archive.org/details/${doc.identifier}`,
      // 연도만으로 확정 가능한 것만. 1930~1963 은 NULL → 발행 게이트가 사람에게 넘긴다.
      pd_basis: year && year <= 1929 ? 'pre-1929' : null,
      status: 'queued',
      acquire_pages: acquirePages,
      panels_total: 0,
      kind: c.kind,
      series_key: c.seriesKey,
    },
    classified: c,
  }
}

/**
 * slug — 시리즈+호수로 읽을 수 있게 만들되 **identifier 꼬리를 붙여 충돌을 막는다**.
 * 같은 호의 다른 스캔본이 여럿 올라와 있어(alt scan · coverless · b&w) 시리즈+호수만으로는
 * 반드시 충돌한다. 충돌하면 유니크 위반으로 적재가 통째로 실패한다.
 */
function makeSlug(c, doc) {
  const base = c.issueNo != null ? `${c.seriesKey}-${String(c.issueNo).padStart(3, '0')}` : c.seriesKey
  const tail = String(doc.identifier ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(-8)
  return `${base}-${tail}`.slice(0, 90)
}

function loadEnv() {
  const envPath = path.join(REPO, 'apps', 'web', '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

async function main() {
  const dryRun = has('dry-run')
  const only = arg('collection')
  // --pages 0 (또는 미지정) = 전권. N = 앞 N장만(테스트).
  const pagesArg = arg('pages')
  const acquirePages = pagesArg == null || Number(pagesArg) === 0 ? null : Number(pagesArg)
  const sources = only ? SOURCES.filter((s) => s.key === only) : SOURCES
  if (!sources.length) {
    console.error(`알 수 없는 --collection. 가능: ${SOURCES.map((s) => s.key).join(', ')}`)
    process.exit(2)
  }

  console.log(`\nPDCP 대량 소스 GET ${dryRun ? '[계획만]' : ''}`)
  console.log(`  대상     ${sources.map((s) => s.label).join(' · ')}`)
  console.log(`  취득량   ${acquirePages ? `앞 ${acquirePages}장(테스트)` : '전권'}\n`)

  const rows = []
  const skips = new Map()
  const kindCount = new Map()
  const unmatched = []

  for (const s of sources) {
    process.stdout.write(`  ${s.label} 수집 중`)
    const docs = await fetchAll(s.filters, { onPage: () => process.stdout.write('.') })
    const uniq = new Set(docs.map((d) => d.identifier)).size
    console.log(` ${docs.length}건 (고유 ${uniq} / 소스 신고 ${docs.totalFound})`)
    // "전량 훑었다"는 주장을 소스가 신고한 총계와 대조한다. 어긋나면 조용히 넘어가지 않는다.
    if (uniq < docs.totalFound) {
      console.log(`     ⚠️ ${docs.totalFound - uniq}건 미수집 — 페이지네이션이 흔들렸습니다(정렬 확인 필요)`)
    }
    for (const d of docs) {
      const r = toRow(d, { acquirePages })
      if (r.skip) {
        skips.set(r.skip.replace(/^\d{4}년/, 'YYYY년'), (skips.get(r.skip.replace(/^\d{4}년/, 'YYYY년')) ?? 0) + 1)
        continue
      }
      rows.push(r.row)
      kindCount.set(r.classified.kind, (kindCount.get(r.classified.kind) ?? 0) + 1)
      if (!r.classified.matched) unmatched.push(d.title)
    }
  }

  // 같은 identifier 가 여러 컬렉션에 동시에 속할 수 있다 — 적재 전에 접는다.
  const seen = new Set()
  const deduped = rows.filter((r) => {
    const k = `${r.source_adapter}::${r.source_identifier}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  // slug 충돌(다른 identifier 인데 같은 slug)도 접는다 — 하나라도 남으면 배치 전체가 실패한다.
  const slugs = new Set()
  const final = deduped.filter((r) => {
    if (slugs.has(r.slug)) return false
    slugs.add(r.slug)
    return true
  })

  console.log(`\n  적재 후보 ${final.length}건 (중복 제거 ${rows.length - final.length})`)
  console.log('  유형별:')
  for (const [k, n] of [...kindCount.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(4)}  ${k}`)
  }
  if (skips.size) {
    console.log('  제외:')
    for (const [why, n] of skips) console.log(`    ${String(n).padStart(4)}  ${why}`)
  }
  if (unmatched.length) {
    console.log(`\n  ⚠️ 미분류 ${unmatched.length}건 — 규칙표(taxonomy.mjs)에 추가 필요`)
    unmatched.slice(0, 10).forEach((t) => console.log(`     · ${String(t).slice(0, 80)}`))
  }

  if (dryRun) {
    console.log('\n계획만 출력했습니다. 실제 적재는 --dry-run 없이.')
    return
  }

  loadEnv()
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('✗ Supabase env 없음 (apps/web/.env.local)')
    process.exit(1)
  }
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  // ① 시리즈 마스터 — 규칙표 전량을 먼저 심는다.
  //   호가 시리즈를 FK 로 참조하므로 **순서가 뒤바뀌면 전량 실패**한다.
  const cat = seriesCatalog()
  const { error: sErr } = await db
    .from('pd_comic_series')
    .upsert(
      cat.map((c) => ({ key: c.key, title: c.title, kind: c.kind, publisher: c.publisher })),
      { onConflict: 'key' },
    )
  if (sErr) {
    console.error(`✗ 시리즈 마스터 적재 실패: ${sErr.message}`)
    process.exit(1)
  }
  console.log(`\n  ✓ 시리즈 마스터 ${cat.length}건`)

  // ② 호 — 배치 upsert. (adapter, identifier) 유니크로 재실행 안전(멱등).
  //   ignoreDuplicates: 이미 있는 호의 진행 상태(status·qc)를 덮어쓰면 안 된다.
  const CHUNK = 200
  let inserted = 0
  for (let i = 0; i < final.length; i += CHUNK) {
    const batch = final.slice(i, i + CHUNK)
    const { data, error } = await db
      .from('pd_comic_issues')
      .upsert(batch, { onConflict: 'source_adapter,source_identifier', ignoreDuplicates: true })
      .select('id')
    if (error) {
      console.error(`✗ 적재 실패 (${i}~${i + batch.length}): ${error.message}`)
      process.exit(1)
    }
    inserted += data?.length ?? 0
    process.stdout.write(`\r  적재 ${Math.min(i + CHUNK, final.length)}/${final.length}`)
  }

  console.log(`\n\n✓ 대량 소스 GET 완료 — 신규 ${inserted}건 / 후보 ${final.length}건 (나머지는 이미 등록됨)`)
  console.log('  → /admin/pd-comics 큐 탭에서 드레인을 실행하면 취득이 시작됩니다.')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`\n${e.message}`)
    process.exit(1)
  })
}
