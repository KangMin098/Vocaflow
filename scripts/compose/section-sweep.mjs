// scripts/compose/section-sweep.mjs
//
// ACP §20 — **한 발행사의 섹션을 전부 재서 순위를 낸다.**
//
// 왜 필요한가 (실측 2026-08-19):
//   학습 적합률은 발행사보다 **그 안의 섹션**으로 갈린다. 같은 신문에서
//     k-universities 87.5% · sports 26.7% · lifestyle 16.7% · opinion 5.0%(부적합 30%)
//   로 **4배 이상** 벌어졌다. 그런데 이걸 알려면 섹션마다 열어 봐야 하고, 손으로 주소를
//   짐작하면 대부분 404 다(11개 중 9개 실패). 두 단계를 한 명령으로 묶는다:
//     ① 발행사 내비게이션에서 섹션 후보를 읽는다 (짐작하지 않는다)
//     ② 후보를 하나씩 열어 적합률을 잰다
//
// ⚠️ 발행사 서버에 실제 요청이 나간다(후보 수만큼). 상한과 간격을 지킨다.
// ⚠️ 읽기 전용 — 등록은 `register-feed.mjs` 로 한 건씩 한다. 무엇을 왜 켰는지 남기기 위해서다.
//
// 실행: pnpm dlx tsx scripts/compose/section-sweep.mjs <홈페이지> [--max 20]

const home = process.argv.find((a) => a.startsWith('http'))
if (!home) {
  console.error('사용법: section-sweep.mjs <홈페이지> [--max 20]')
  process.exit(2)
}
const mi = process.argv.indexOf('--max')
const MAX = mi >= 0 ? Number(process.argv[mi + 1]) : 20
const INTERVAL_MS = 1_500

const { COMPOSE_USER_AGENT, classifyTopic, parseSectionPage } = await import(
  '@vocaflow/library-pipeline'
)

/**
 * 섹션이 아닌 경로. 회사 소개·약관·구독 같은 것을 열어 봐야 기사가 없다.
 * 요청을 아끼는 것이 목적이므로 **의심스러우면 남긴다** — 잘못 빼면 좋은 섹션을 놓친다.
 */
// ⚠️ **첫 마디로 판정한다.** 처음에는 `about` 만 막았는데 연합의 회사 소개는 `/aboutus/…`
//   라 그대로 통과했고, 요청 16개를 전부 회사 소개에 썼다(2026-08-19). 이 저장소가 반복하는
//   "발행사 서버에 헛되이 묻지 않는다" 를 스윕 자신이 어긴 것이다.
const NOT_A_SECTION =
  /^\/(about\w*|company|introduction|history|contact\w*|codeofethics|copyright|privacy\w*|terms\w*|subscribe|subscription|newsletter|login|signin|signup|account|sitemap|rss|feed|search|video|photos?|gallery|podcast|ombudsman|contentsales|mytimes|korean|ann|topic|ads?|advertis\w*|channel|brief|help|faq|notice|event|shop|store)(\/|$)/i

const get = async (url) => {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': COMPOSE_USER_AGENT }, redirect: 'follow' })
    return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '' }
  } catch (e) {
    return { ok: false, status: 0, text: '', err: String(e.name || e) }
  }
}

// ── ① 내비게이션에서 후보를 읽는다 ────────────────────────────────────
const first = await get(home)
if (!first.ok) {
  console.error(`홈페이지를 열지 못했다 (${first.status || first.err}) — ${home}`)
  process.exit(1)
}
const base = new URL(home)
const paths = new Set()
for (const m of first.text.matchAll(/<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
  const href = m[2] ?? m[3] ?? m[4]
  if (!href) continue
  let u
  try {
    u = new URL(href, base)
  } catch {
    continue
  }
  if (u.host !== base.host) continue
  const segs = u.pathname.split('/').filter(Boolean)
  if (segs.length === 0 || segs.length > 2) continue
  if (segs.some((s) => /^\d{4,}$/.test(s))) continue
  const path = '/' + segs.join('/')
  if (NOT_A_SECTION.test(path)) continue
  paths.add(path)
}

// ⚠️ 알파벳순으로 자르면 안 된다 — 회사 소개(`/aboutus/…`)가 앞을 차지해 상한을 다 먹는다.
//   **한 마디 경로를 먼저 본다.** 발행사의 주요 섹션은 대개 `/sports` 처럼 한 마디이고,
//   두 마디는 그 하위 분류라 상위가 이미 덮는 경우가 많다.
const sorted = [...paths].sort((a, b) => {
  const da = a.split('/').filter(Boolean).length
  const db = b.split('/').filter(Boolean).length
  return da - db || a.localeCompare(b)
})
const list = sorted.slice(0, MAX)
const dropped = sorted.slice(MAX)
console.log(`${base.host} · 내비게이션 후보 ${paths.size} · 앞의 ${list.length}개를 잰다`)
// 잘라 낸 것을 말한다 — 조용히 자르면 "다 봤다" 로 읽힌다.
if (dropped.length) {
  console.log(`  (상한으로 ${dropped.length}개를 건너뛴다: ${dropped.slice(0, 8).join(' ')}${dropped.length > 8 ? ' …' : ''})`)
}
console.log('')

// ── ② 하나씩 열어 잰다 ────────────────────────────────────────────────
const rows = []
for (const path of list) {
  const url = base.origin + path
  await new Promise((r) => setTimeout(r, INTERVAL_MS))
  const res = await get(url)
  if (!res.ok) {
    rows.push({ path, n: 0, fit: null, unfit: null, note: `HTTP ${res.status || res.err}` })
    continue
  }
  const items = parseSectionPage(res.text, url)
  if (items.length === 0) {
    rows.push({ path, n: 0, fit: null, unfit: null, note: '기사 링크 없음(날짜 없는 주소이거나 스크립트 목록)' })
    continue
  }
  const fit = items.filter((i) => classifyTopic(i.title) === 'fit').length
  const unfit = items.filter((i) => classifyTopic(i.title) === 'unfit').length
  rows.push({
    path,
    n: items.length,
    fit: (100 * fit) / items.length,
    unfit: (100 * unfit) / items.length,
    note: '',
  })
}

rows.sort((a, b) => (b.fit ?? -1) - (a.fit ?? -1))
console.log(['섹션'.padEnd(28), '기사', ' 적합%', '부적합%', ''].join(' '))
for (const r of rows) {
  console.log(
    [
      r.path.slice(0, 28).padEnd(28),
      String(r.n).padStart(4),
      (r.fit === null ? '   -' : r.fit.toFixed(1)).padStart(6),
      (r.unfit === null ? '   -' : r.unfit.toFixed(1)).padStart(7),
      r.note,
    ].join(' '),
  )
}

// 등록 기준은 `feed-fitness.mjs` 와 같은 값을 쓴다 — 스크립트마다 다른 선을 쓰면
//   한쪽은 권하고 한쪽은 죽었다고 한다(이 저장소에서 실제로 겪었다).
const worth = rows.filter((r) => r.n > 0 && r.fit >= 10 && r.fit > r.unfit)
console.log(`\n■ 등록을 검토할 만한 섹션 ${worth.length}`)
for (const r of worth) {
  console.log(`  ${base.origin}${r.path}  (적합 ${r.fit.toFixed(1)}% · 부적합 ${r.unfit.toFixed(1)}%)`)
}
console.log('\n등록은 register-feed.mjs 로 한 건씩 — 무엇을 왜 켰는지 남기기 위해서다.')
