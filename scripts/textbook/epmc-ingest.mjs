// scripts/textbook/epmc-ingest.mjs
//
// **Europe PMC 서론 발췌를 `library_articles` 에 담는다 — 라이선스 관문 네 겹째.**
//
// ── 왜 (실측 2026-09-13) ─────────────────────────────────────────────
// 변형 가능(ND·NC 아님) 논증문 공급선이 사실상 PLOS 하나였다(소스 2곳 · 1,485편). Europe PMC 는
// `LICENSE:"cc by" AND LANG:"eng" AND IN_EPMC:y` 로 5,218,944편이고, 그중 `PUB_TYPE:"review"`
// 618,178편이다. 결정적 차이는 편수가 아니라 **필터의 위치** — 라이선스가 질의 파라미터라
// DOAB 처럼 편당 판정을 만들 필요가 없고, 본문도 PDF 가 아니라 전문 XML 로 바로 나온다.
//
// ── 관문이 네 겹인 이유 ──────────────────────────────────────────────
//   ① 질의    `LICENSE:"cc by"` — 서버가 걸러 준다
//   ② 목록    `epmcLicenseAllowed` — 질의는 사람이 고칠 수 있고, 고쳐도 오류가 나지 않는다
//   ③ 적재기  본문 XML 의 라이선스를 다시 보고 **더 제한적인 쪽**을 택한다
//   ④ 이 스크립트  규격(어수)·자립성·중복을 보고 넣지 않을 이유를 하나라도 찾으면 건너뛴다
// ND·NC 본문을 잘라 문항으로 만들면 **오류 없이** 위법 교재가 나온다. 이 저장소는 그 실패를
// 두 번 겪었다(The Conversation 46편 · Aeon/Quanta/Knowable). 관문 하나가 새면 그걸로 끝이다.
//
// ── 원천 먼저 (2026-09-24) ─────────────────────────────────────────────
// 서론 발췌(`#p<a>-<b>`)는 원천이 아니다(docs/source-check/criteria.md §1). 이제 논문마다 **본문 전문을
// 원천 행**(`europe_pmc:PMC…` · `scope: 'full'`)으로 먼저 담고, 그다음 창에 드는 서론 덩어리를
// 조각 행으로 담는다(`csat_fit.derived_from = { id, source_id, kind: 'paragraphs' }`).
// 창에 드는 덩어리가 없어도 **원천은 담는다** — 조각만 건너뛴다(`_originals.mjs`).
// 이미 있던 조각의 원천은 `scripts/textbook/originals-backfill.mjs` 가 채운다.
//
// ── 재실행 안전 ──────────────────────────────────────────────────────
// `source_id`(= `europe_pmc:PMC…` [+ `#p<a>-<b>`]) 로 먼저 중복을 본다. 몇 번 돌려도 같은 글을
// 두 번 넣지 않는다. `--commit` 없이는 **아무것도 쓰지 않는다**.
// ⚠️ 빈 값은 넣지 않는다 — 넣으면 다음 수확이 "이미 있음" 으로 세어 구멍이 남는다.
//   짧은 본문은 버리지 않고 창 판정으로 흘린다(길이로 원문을 제외하지 않는다 — 2026-09-23).
//
// 실행:
//   pnpm dlx tsx scripts/textbook/epmc-ingest.mjs                      # dry-run (기본)
//   pnpm dlx tsx scripts/textbook/epmc-ingest.mjs --commit --limit 40
//   pnpm dlx tsx scripts/textbook/epmc-ingest.mjs --feed psychology --commit --limit 30

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const COMMIT = process.argv.includes('--commit')
const FEED = arg('feed') ?? 'review'
const LIMIT = Number(arg('limit') ?? 20)

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const epmc = await import('../../packages/library-pipeline/src/ingest-article/europe-pmc.ts')
const { ensureOriginal, fragmentCsatFit } = await import('./_originals.mjs')
const { isShortBodyError } = await import('../../packages/library-pipeline/src/ingest-article/short-body.ts')
const { readHarvestCursor, writeHarvestCursor, markSeen } = await import(
  '../../packages/library-pipeline/src/ingest-article/harvest-cursor.ts'
)
const { CSAT_ITEM_WORDS, CSAT_LONG_ITEM_WORDS } = await import(
  '../../packages/library-pipeline/src/textbook/compose-unit.ts'
)
const { measureRegisterSignal } = await import(
  '../../packages/library-pipeline/src/textbook/register-signal.ts'
)

/**
 * **이 머신은 ebi.ac.uk 에 node fetch 가 간헐적으로 죽는다**(ConnectTimeout · curl 은 200).
 * 여기서 물러서지 않으면 멀쩡한 소스를 "실패" 로 세게 된다 — 세 번 물어본다.
 */
async function retry(fn, tries = 3) {
  let last
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
    }
  }
  throw last
}

/** 창에 드는 연속 문단 덩어리. 한 문단이 짧아도 둘을 붙이면 든다. */
function bestChunk(paras, w) {
  for (let len = 1; len <= Math.min(4, paras.length); len++) {
    for (let i = 0; i + len <= paras.length; i++) {
      const text = paras.slice(i, i + len).join('\n\n')
      const n = epmc.epmcWordCount(text)
      if (n >= w.min && n <= w.max) return { start: i, end: i + len, words: n, text }
    }
  }
  return null
}

console.log(
  `Europe PMC 적재 — 피드 ${FEED} · 상한 ${LIMIT}편 · ${COMMIT ? '커밋' : 'dry-run'}\n` +
    `창: 짧은 지문 ${CSAT_ITEM_WORDS.min}~${CSAT_ITEM_WORDS.max}어 · 장문 ${CSAT_LONG_ITEM_WORDS.min}~${CSAT_LONG_ITEM_WORDS.max}어\n`,
)

/**
 * **커서에서 이어 받는다.** 없으면 매 실행 같은 앞머리만 보고 "이미 있음" 으로 세며
 * 나머지 518,715편을 영영 안 본다 — FrYM 이 정확히 그 꼴이었다(offset 루프가 최신 창만 봤다).
 * `seen` 은 **적재분과 거절분 둘 다** 담는다. 거절한 것을 안 담으면 다음 실행이 같은 것을
 * 다시 받아 같은 이유로 또 거절한다.
 */
const CURSOR_FILE = path.resolve(`scripts/textbook/data/europe-pmc-${FEED}-cursor.json`)
const cursor = readHarvestCursor(CURSOR_FILE, 'europe_pmc', FEED)
const seen = new Set(cursor.seen)
console.log(
  `커서 — 판정 완료 ${seen.size}편 · ${cursor.exhausted ? '목록 소진' : cursor.token ? '이어서 봄' : '처음부터'}\n`,
)

const list = []
let pageCursor = cursor.token ?? '*'
let nextToken = pageCursor
let exhausted = false
while (list.length < LIMIT * 3) {
  const page = await retry(() => epmc.listEpmcFeedPage(FEED, 100, pageCursor))
  // 이미 판정한 것은 목록에서 빼 둔다 — GET 앞에서 걸러야 값이 있다(Frontiers 가 순서를
  //   뒤집었다가 600편 중 326편을 사 온 뒤에 버렸다).
  for (const it of page.items) if (!seen.has(it.pmcid)) list.push(it)
  if (!page.nextCursor || page.items.length === 0) {
    exhausted = true
    break
  }
  pageCursor = page.nextCursor
  nextToken = page.nextCursor
}
console.log(`목록 ${list.length}편 (라이선스 관문 ② 통과 · 판정분 제외)\n`)

/** 이번 실행에서 판정한 것 — 담았든 거절했든. 끝에 커서에 더한다. */
const judged = new Set()

let added = 0
let existed = 0
let outOfSpec = 0
let failed = 0
let licenseBlocked = 0
let shortBody = 0
let emptyBody = 0
/** 원천 행 — 새로 담음(dry-run 은 담을 예정) · 본문 전문이 비어 못 담음. */
let originalsAdded = 0
let originalsEmpty = 0
const densities = []

for (const item of list) {
  if (added >= LIMIT) break

  // ── 중복 — 원본 열쇠로 먼저 본다(발췌 열쇠는 아래에서 다시) ──────
  const baseKey = `europe_pmc:${item.pmcid}`
  const { data: dup } = await db
    .from('library_articles')
    .select('id')
    .eq('source', 'europe_pmc')
    .like('source_id', `${baseKey}%`)
    .limit(1)
  judged.add(item.pmcid)
  if (dup && dup.length > 0) {
    existed++
    continue
  }

  let article
  try {
    article = await retry(() => epmc.ingestEuropePmcArticle(item.pmcid, item.license))
  } catch (e) {
    // 짧은 본문은 **버리지 않는다**(사용자 결정 2026-09-23 — 길이로 원문을 제외하지 않는다).
    //   본문이 있으면 아래 발췌·창 판정으로 그대로 흘린다 — 창이 가른다, 길이 하한이 아니라.
    //   빈 본문(0어)은 파서 고장 신호라 따로 세고, 판정으로 적지 않는다(파서를 고치면 되살아난다).
    if (isShortBodyError(e) && !e.isEmpty && e.article) {
      shortBody++
      article = e.article
    } else if (isShortBodyError(e)) {
      emptyBody++
      judged.delete(item.pmcid)
      console.log(`  ✗ 빈 본문(파서 확인) ${item.pmcid}`)
      continue
    } else {
      const msg = String(e.message ?? e)
      if (/라이선스/.test(msg)) licenseBlocked++
      else failed++
      console.log(`  ✗ ${msg.slice(0, 72)}`)
      continue
    }
  }

  // ── 원천 먼저 — 본문 전문을 원천 행으로 ─────────────────────────────
  // 창 판정보다 **앞에** 둔다. 창에 드는 덩어리가 없어도 원천은 남는다(길이로 원문을 버리지 않는다).
  let full
  try {
    full = await retry(() => epmc.ingestEuropePmcArticle(item.pmcid, item.license, { scope: 'full' }))
  } catch (e) {
    if (isShortBodyError(e) && e.article) full = e.article
    else {
      failed++
      judged.delete(item.pmcid)
      console.log(`  ✗ 전문 취득 실패 — ${String(e.message ?? e).slice(0, 64)}`)
      continue
    }
  }
  let parent
  try {
    parent = await ensureOriginal(db, {
      article: full,
      sourceId: baseKey,
      feedId: FEED,
      feedLabel: epmc.epmcFeed(FEED)?.label ?? null,
    }, { commit: COMMIT })
  } catch (e) {
    failed++
    judged.delete(item.pmcid)
    console.log(`  ✗ ${String(e.message).slice(0, 72)}`)
    continue
  }
  if (parent.status === 'empty') originalsEmpty++
  else if (parent.status !== 'existed') originalsAdded++
  console.log(`  ${COMMIT ? '✓' : '·'} 원천 ${String(parent.words).padStart(5)}어  ${parent.status.padEnd(8)} ${baseKey}`)

  // ── 규격 — 조판이 받는 창에 드는 덩어리를 떼어 낸다 ──────────────
  const paras = article.content.split('\n\n').filter(Boolean)
  const long = bestChunk(paras, CSAT_LONG_ITEM_WORDS)
  const short = bestChunk(paras, CSAT_ITEM_WORDS)
  // 장문을 먼저 본다 — 긴 덩어리가 나오면 짧은 지문은 거기서 다시 잘라 쓸 수 있다.
  const pick = long ?? short
  if (!pick) {
    outOfSpec++
    console.log(`  ⊘ 창에 드는 덩어리가 없다 — 원천만 담는다 (문단 어수 ${paras.map(epmc.epmcWordCount).join('·')})`)
    continue
  }

  // 원본 열쇠는 원천 행의 것이다 — 조각은 서론 전체를 뜨더라도 늘 문단 범위를 단다.
  const sourceId = `${baseKey}#p${pick.start + 1}-${pick.end}`
  // 서론 덩어리가 곧 본문 전체면 조각은 원천의 사본이다 — 담지 않는다.
  if (pick.text.trim() === String(full.content ?? '').trim()) {
    existed++
    continue
  }

  // 발췌 열쇠로 한 번 더 — 같은 논문에서 다른 범위를 뜰 수 있으므로 별 행이다.
  const { data: dup2 } = await db
    .from('library_articles')
    .select('id')
    .eq('source', 'europe_pmc')
    .eq('source_id', sourceId)
    .maybeSingle()
  if (dup2) {
    existed++
    continue
  }

  const sig = measureRegisterSignal(pick.text)
  if (sig) densities.push(sig.density)

  if (COMMIT) {
    const { error } = await db.from('library_articles').insert({
      source: 'europe_pmc',
      source_id: sourceId,
      title: article.title,
      source_url: article.source_url,
      published_at: item.publishedAt ? new Date(item.publishedAt).toISOString() : null,
      license: article.license,
      content: pick.text,
      status: 'queued',
      feed_id: FEED,
      feed_label: epmc.epmcFeed(FEED)?.label ?? null,
      csat_fit: fragmentCsatFit(article, parent, 'paragraphs'),
    })
    if (error) {
      failed++
      console.log(`  ✗ INSERT 실패: ${error.message.slice(0, 70)}`)
      continue
    }
  }
  added++
  console.log(
    `  ${COMMIT ? '✓' : '·'} ${String(pick.words).padStart(4)}어  ` +
      `표지 ${String(sig?.density ?? '—').padStart(5)}${sig?.atOrAboveCsatMedian ? '★' : ' '}  ` +
      `${(item.journal ?? '').slice(0, 26).padEnd(27)}${article.title.slice(0, 44)}`,
  )
}

// ── 커서 저장 ───────────────────────────────────────────────────────
// **판정 뒤에** 쓴다. dry-run 은 쓰지 않는다 — 안 본 것을 본 것으로 세면 구멍이 영영 남는다.
if (COMMIT && judged.size > 0) {
  writeHarvestCursor(CURSOR_FILE, {
    ...markSeen(cursor, judged),
    token: exhausted ? null : nextToken,
    exhausted,
  })
}

const med = densities.length
  ? [...densities].sort((a, b) => a - b)[Math.floor(densities.length / 2)]
  : null
const above = densities.filter((d) => d >= 5.33).length

console.log(
  `\n원천 ${originalsAdded}(본문 비어 못 담음 ${originalsEmpty}) · 조각 추가 ${added} · 이미 있음 ${existed} · 창 미달 ${outOfSpec} · ` +
    `라이선스 차단 ${licenseBlocked} · 실패 ${failed} · 짧은 본문(창 판정으로) ${shortBody} · 빈 본문(파서 확인) ${emptyBody}`,
)
if (med != null) {
  console.log(
    `담은 것의 논증 표지 중앙 ${med} (기출 중앙 5.33) · 기출 중앙 이상 ${above}/${densities.length}편`,
  )
}
console.log(
  `커서 — 판정 완료 ${seen.size} → ${COMMIT ? new Set([...seen, ...judged]).size : seen.size}` +
    ` · ${exhausted ? '목록 소진' : '이어서 볼 것 남음'}`,
)
if (!COMMIT) console.log('\ndry-run 이었다. 실제로 쓰려면 --commit.')
