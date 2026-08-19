// scripts/compose/drain-coverage.mjs
//
// ACP §20 — **취재 시작의 헤드리스 경로.**
//
// 왜 필요한가 (2026-08-19):
//   드레인의 나머지 단계(처리·가공·게이트·검수)는 스크립트가 있는데 **취재 시작만 화면 전용**
//   이었다. 그래서 사건이 익어도 Claude Code 배치가 스스로 시작하지 못하고, 사람이 브라우저를
//   열어 버튼을 눌러 줄 때까지 파이프라인이 멈춰 있었다. 앞서 처리·가공·게이트가 같은 이유로
//   막혀 있던 것을 스크립트로 뚫었고, 이건 그 마지막 하나다.
//
// ── 본문 비보관 ─────────────────────────────────────────────────────
// 이 스크립트는 소스 본문을 **화면에 한 번 보여 주고 버린다.** DB 에는 지문(fingerprint)과
// 접근 근거만 남는다. 사실 카드를 쓰려면 사람(또는 Claude)이 본문을 한 번은 읽어야 하는데,
// 그 한 번을 위해 본문을 저장하면 그때부터 그것은 복제본이다. 화면의 취재 시작도 같은 규칙을
// 쓴다(`readStoryForFacts` 의 추출 콜백이 값을 돌려주지 않는다).
//
// ⚠️ 발행사 서버에 실제 요청이 나간다. 같은 사건에 두 번 돌리지 않는다.
// ⚠️ 재실행하면 **새 취재 묶음이 또 생긴다** — url 유일키가 없다. 실패했을 때만 다시 돌리고,
//    성공한 묶음을 다시 만들지 않는다(만들었으면 `--list` 로 확인해 지운다).
//
// 실행:
//   pnpm dlx tsx scripts/compose/drain-coverage.mjs --list
//     익어서 취재할 수 있는 사건을 번호와 함께 보여 준다(요청 없음).
//   pnpm dlx tsx scripts/compose/drain-coverage.mjs --pick <번호> [--commit]
//     그 사건의 소스를 읽어 본문을 보여 준다. --commit 이 있어야 묶음을 만든다.

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const commit = process.argv.includes('--commit')
const pick = arg('pick')

const { createClient } = await import('@supabase/supabase-js')
const {
  COMPOSE_USER_AGENT,
  CrawlGate,
  FACT_SOURCES,
  classifyTopic,
  buildFingerprint,
  clusterStories,
  describeCopyGroups,
  groupByCopy,
  extractArticle,
  isKoreaRelevant,
  primeRobots,
  readStoryForFacts,
} = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const deps = {
  async fetchText(url, headers) {
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), 20_000)
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': COMPOSE_USER_AGENT, ...headers },
        signal: c.signal,
        redirect: 'follow',
      })
      return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '' }
    } catch (e) {
      return { ok: false, status: 0, text: '' }
    } finally {
      clearTimeout(t)
    }
  },
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
}

// ── 익은 후보를 묶는다 ────────────────────────────────────────────────
const { data: ripe, error } = await db
  .from('article_compose_candidates')
  .select('source_key, publisher, wire, title, url, published_at')
  .eq('status', 'open')
  .lt('published_at', new Date(Date.now() - 48 * 3_600_000).toISOString())
  .order('published_at', { ascending: false })
  .limit(400)
if (error) throw new Error('후보 조회 실패: ' + error.message)

const clusters = clusterStories(
  (ripe ?? []).map((r) => ({
    sourceKey: r.source_key,
    publisher: r.publisher,
    wire: r.wire,
    title: r.title,
    url: r.url,
    published_at: r.published_at,
    holdMs: 0,
  })),
)

// 학습에 쓸 수 있는 것만, 한국 관련을 앞에 둔다.
const usable = clusters
  .filter((c) => c.worthPursuing && classifyTopic(c.headline) === 'fit')
  .map((c) => ({ c, kr: isKoreaRelevant(c.headline, c.members.map((m) => m.publisher)) }))
  .sort((a, b) => Number(b.kr) - Number(a.kr))

if (!pick) {
  console.log(`취재할 수 있는 사건 ${usable.length}\n`)
  usable.forEach(({ c, kr }, i) => {
    console.log(`  [${i + 1}] ${kr ? '[한국] ' : '       '}${c.headline}`)
    console.log(`        계통 ${c.readableLines}/${c.independentLines} · ${c.members.map((m) => m.publisher).join(', ')}`)
  })
  console.log('\n--pick <번호> 로 취재한다. --commit 이 없으면 읽기만 하고 저장하지 않는다.')
  process.exit(0)
}

const chosen = usable[Number(pick) - 1]
if (!chosen) throw new Error(`[${pick}] 번 사건이 없다. --list 로 번호를 확인할 것.`)
const cluster = chosen.c

// ACP 가 이미 본문으로 가져간 기사면 재저작할 이유가 없다 — 그냥 가져올 수 있는 것이다.
const urls = cluster.members.map((m) => m.url)
const { data: already } = await db.from('library_articles').select('source_url').in('source_url', urls)
const taken = new Set((already ?? []).map((a) => a.source_url))

console.log(`■ ${cluster.headline}`)
console.log(`  계통 ${cluster.readableLines}/${cluster.independentLines} · ${commit ? '저장함' : '읽기만(dry-run)'}\n`)

const gate = new CrawlGate()
const rows = []
const failures = []

for (const m of cluster.members) {
  if (taken.has(m.url)) {
    failures.push(`${m.publisher}: ACP 가 이미 본문으로 가져간 기사다`)
    continue
  }
  const spec = FACT_SOURCES[m.sourceKey]
  if (!spec) {
    failures.push(`${m.publisher}: 알 수 없는 소스 키 ${m.sourceKey}`)
    continue
  }
  await primeRobots(new URL(m.url).host, gate, deps)
  // ⚠️ `readForFacts` 의 계약은 "콜백은 원문 표현이 아닌 산출물만 돌려준다" 이다.
  //   여기서는 문장을 그대로 꺼낸다 — 사실 카드를 쓰려면 누군가는 한 번 읽어야 하고,
  //   화면의 취재 시작에서는 그 한 번을 **운영자가 발행사 사이트에서** 한다. 배치에는 사람이
  //   없으므로 그 한 번을 터미널로 옮긴 것이다. 지켜야 할 선은 그대로다:
  //     · DB 에 들어가는 것은 지문·접근 근거뿐이다(아래 insert 를 볼 것).
  //     · 여기 찍힌 문장을 **초안에 옮겨 쓰지 않는다.** 사실만 가져가고 표현은 새로 쓴다.
  //       어기면 I13(표현 독립성)이 잡는다 — 그것이 이 느슨함을 받쳐 주는 장치다.
  const read = await readStoryForFacts(spec, m.url, gate, deps, (body) => extractArticle(body).sentences)
  if (!read.ok) {
    failures.push(`${m.publisher}: ${read.reason}`)
    continue
  }
  const sentences = read.read.extracted ?? []
  rows.push({ member: m, row: read.row, sentences })

  console.log(`── ${m.publisher} ${'─'.repeat(Math.max(0, 60 - m.publisher.length))}`)
  console.log(`   ${m.url}`)
  sentences.forEach((s, i) => console.log(`   ${String(i + 1).padStart(2)}. ${s}`))
  console.log('')
}

for (const f of failures) console.log(`  ⚠ ${f}`)

if (rows.length < 2) {
  console.log(`\n읽어 온 소스가 ${rows.length}건뿐이라 취재를 시작하지 않는다 (독립 2계통 필요).`)
  process.exit(1)
}

// ── 계통은 발행사 수가 아니라 **원고 수**다 ──────────────────────────
// 실측 2026-08-19: 연합뉴스 로카르노 기사와 코리아헤럴드 기사가 담김 31.3% 였다 —
//   코리아헤럴드가 연합 원고의 문단을 그대로 실은 것이다. 발행사가 둘이라는 이유로 2계통으로
//   세면, 실제로는 **한 매체의 기사 하나를 바꿔 쓴 것**이 된다. 그건 재저작이 아니라 2차 저작물이고,
//   게이트 여섯을 다 통과해도 전제가 무너져 있으면 통과가 의미를 잃는다.
// ⚠️ 저장된 지문(`row.fingerprint`)으로 견주면 **안 된다.** 그것은 원본 HTML 로 뜬 것이라
//   메뉴·스크립트 같은 사이트 틀이 7어절 조각의 대부분을 차지하고, 본문이 통째로 같아도
//   겹침이 1% 대로 희석된다(실측 2026-08-19: 같은 쌍이 저장 지문 0.7% vs 추출 본문 31.3%).
//   그래서 **추출한 본문**으로 다시 뜬다. 저장 지문은 그대로 둔다 — I13 은 초안과 소스 본문
//   사이의 연속 구간을 찾는 것이라 희석의 영향을 받지 않고, 바꾸면 이미 저장된 판정이 낡는다.
const groups = groupByCopy(
  rows.map(({ row, sentences }) => ({
    key: row.publisher,
    fingerprint: buildFingerprint(sentences.join(' ')),
  })),
)
const merged = describeCopyGroups(groups)
if (merged.length) {
  console.log('')
  for (const m of merged) console.log(`  ⚠ ${m}`)
}
if (groups.length < 2) {
  console.log(
    `\n측정된 독립 계통이 ${groups.length}건이라 취재를 시작하지 않는다 — 발행사는 ${rows.length}곳이지만 원고는 하나다.`,
  )
  process.exit(1)
}
console.log(`\n측정된 독립 계통 ${groups.length} (발행사 ${rows.length})`)
if (!commit) {
  console.log('\n위 문장으로 사실 카드를 짤 수 있다. --commit 을 붙이면 취재 묶음을 만든다.')
  process.exit(0)
}

const { data: batch, error: bErr } = await db
  .from('article_compose_batches')
  .insert({
    topic: cluster.headline,
    event_occurred_at: cluster.earliestAt || null,
    status: 'collecting',
  })
  .select('id')
  .single()
if (bErr) throw new Error('묶음 생성 실패: ' + bErr.message)

for (const { member, row } of rows) {
  const { error: sErr } = await db.from('article_compose_sources').insert({
    batch_id: batch.id,
    publisher: row.publisher,
    url: row.url,
    published_at: member.published_at,
    fingerprint: row.fingerprint,
    access_basis: row.access_basis,
    robots_checked_at: row.robots_checked_at,
    wire: row.wire,
  })
  if (sErr) throw new Error(`소스 저장 실패 (${row.publisher}): ${sErr.message}`)
}

await db.from('article_compose_batches').update({ status: 'ledger_ready' }).eq('id', batch.id)
console.log(`\n취재 묶음 생성 — ${batch.id} (소스 ${rows.length} · 상태 ledger_ready)`)
console.log('다음: 사실 카드를 넣고(원장) 발주를 만든 뒤 지문을 쓴다.')
