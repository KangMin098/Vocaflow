// scripts/acp/feed-probe.mjs
//
// **후보 피드를 실제로 두드려 4판정으로 나눈다.** 짐작으로 목록을 늘리지 않기 위해서다.
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// 이 저장소에서 섹션 주소를 짐작해 넣었다가 11개 중 9개가 404 였던 일이 세 번 있었다.
// 그래서 목록에 올리기 전에 **한 번은 두드린다.** 판정은 넷이다:
//
//   rss       RSS/Atom 이 그대로 나온다        → 병목 없음 (가장 좋다)
//   section   RSS 는 없지만 목록 페이지가 파싱된다 → 병목 없음 (스크래핑 경로)
//   blocked   403/429 — **UA 위장하지 않는다.** 목록에서 뺀다.
//   dead      404/타임아웃/항목 0
//
// ⚠️ UA 위장 금지는 이 저장소의 규칙이다. 발행사가 막으면 그 발행사를 안 쓴다.
//
// 재실행 안전: 읽기만 한다. DB 를 건드리지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/acp/feed-probe.mjs             # 전부
//   pnpm dlx tsx scripts/acp/feed-probe.mjs --group voa

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
const onlyGroup = arg('group')

const lib = await import('@vocaflow/library-pipeline')
const { parseRssFeed, parseSectionPage, classifyTopic } = lib

/**
 * 후보 목록. **사용자가 준 섹션 목록을 그대로 옮긴 것**이며, 여기서 걸러진 것만 배선한다.
 *
 * VOA 는 z-코드가 곧 RSS 다(`/rss/?zoneid=NNNN`) — 스크래핑이 필요 없다.
 * The Conversation 은 섹션마다 `/articles.atom` 이 붙는 구조인지 확인이 필요하다.
 */
const CANDIDATES = [
  // ① VOA Learning English — 미 연방정부 저작물이라 퍼블릭 도메인. supply 경로.
  ...[
    ['952', '종합 기사'],
    ['955', 'Health & Lifestyle'],
    ['959', 'Education'],
    ['986', 'Arts & Culture'],
    ['987', 'Words and Their Stories'],
    ['1574', 'Technology Report'],
    ['1579', 'Science in the News'],
    ['1581', 'American Stories'],
    ['3521', '시사 뉴스'],
  ].map(([z, label]) => ({
    group: 'voa',
    id: `z${z}`,
    label,
    url: `https://learningenglish.voanews.com/rss/?count=30&zoneid=${z}`,
  })),

  // ② The Conversation — CC BY-ND. **ND 라 재저작 금지**, 본문 그대로만 쓸 수 있다.
  ...[
    ['us', '미국판 전체'],
    ['us/education', 'Education'],
    ['us/environment', 'Environment'],
    ['us/ethics', 'Ethics'],
    ['us/arts', 'Arts'],
    ['us/business', 'Business'],
    ['us/health', 'Health'],
    ['us/science', 'Science'],
    ['ca', '캐나다판 전체'],
    ['ca/education', 'CA Education'],
  ].map(([p, label]) => ({
    group: 'conversation',
    id: p,
    label,
    url: `https://theconversation.com/${p}/articles.atom`,
  })),
]

const targets = onlyGroup ? CANDIDATES.filter((c) => c.group === onlyGroup) : CANDIDATES

async function probe(c) {
  let res
  try {
    res = await fetch(c.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
      // UA 를 위장하지 않는다 — 막히면 그 발행사를 안 쓰는 것이 이 저장소의 규칙이다.
      headers: { accept: 'application/rss+xml, application/atom+xml, text/html;q=0.8' },
    })
  } catch (e) {
    return { verdict: 'dead', note: e.name === 'TimeoutError' ? '타임아웃' : String(e.message ?? e) }
  }
  if (res.status === 403 || res.status === 429) {
    return { verdict: 'blocked', note: `HTTP ${res.status} — UA 위장 대신 목록에서 뺀다` }
  }
  if (!res.ok) return { verdict: 'dead', note: `HTTP ${res.status}` }

  const text = await res.text()
  let items = parseRssFeed(text)
  let verdict = 'rss'
  if (items.length === 0) {
    items = parseSectionPage(text, c.url, Date.now())
    verdict = items.length > 0 ? 'section' : 'dead'
  }
  if (items.length === 0) return { verdict: 'dead', note: '항목 0 — 형식이 다르거나 빈 피드' }

  // 학습 적합률 — 비PD 쪽과 같은 분류기를 쓴다.
  //
  // ⚠️ **판정은 셋이다**(fit·neutral·unfit). 적합률만 보면 오독한다 —
  //   VOA Learning English 는 애초에 전부 학습자용으로 쓰인 글이라 어느 섹션이든
  //   "쓸 수 있다". 분류기의 `fit` 패턴은 교육·과학·문화 키워드를 찾는 것이라
  //   "Get a Kick Out of It"(관용구 해설) 같은 제목은 neutral 로 떨어진다.
  //   그래서 **PD 등급물의 잣대는 부적합률(사건·정치가 섞였는가)** 이고,
  //   일반 뉴스의 잣대가 적합률이다. 둘을 같은 칸에서 비교하면 안 된다.
  const fit = items.filter((i) => classifyTopic(i.title ?? '') === 'fit').length
  const unfit = items.filter((i) => classifyTopic(i.title ?? '') === 'unfit').length
  // 필드명은 `published_at`(문자열)이다 — `publishedAt` 으로 읽으면 전부 0% 로 나온다.
  const dated = items.filter((i) => {
    if (!i.published_at) return false
    return !Number.isNaN(new Date(i.published_at).getTime())
  }).length
  return {
    verdict,
    items: items.length,
    fitPct: (100 * fit) / items.length,
    neutralPct: (100 * (items.length - fit - unfit)) / items.length,
    unfitPct: (100 * unfit) / items.length,
    datedPct: (100 * dated) / items.length,
    sample: items[0]?.title ?? '',
  }
}

console.log(`후보 ${targets.length}개를 두드린다 (읽기 전용 · UA 위장 없음)\n`)
console.log(['판정'.padEnd(8), '소스/섹션'.padEnd(30), '항목', ' 적합%', '중립%', '부적합%', '시각%'].join(' '))

const byVerdict = {}
for (const c of targets) {
  const r = await probe(c)
  byVerdict[r.verdict] = (byVerdict[r.verdict] ?? 0) + 1
  const label = `${c.group}/${c.id}`
  if (r.items === undefined) {
    console.log(`${r.verdict.padEnd(8)} ${label.padEnd(30)} ${r.note}`)
    continue
  }
  console.log(
    [
      r.verdict.padEnd(8),
      label.padEnd(30),
      String(r.items).padStart(4),
      r.fitPct.toFixed(1).padStart(6),
      r.neutralPct.toFixed(1).padStart(6),
      r.unfitPct.toFixed(1).padStart(7),
      r.datedPct.toFixed(0).padStart(5),
    ].join(' '),
  )
}

console.log('\n판정 집계:', Object.entries(byVerdict).map(([k, v]) => `${k} ${v}`).join(' · '))
console.log('rss/section 은 병목 없음 · blocked 는 목록에서 뺀다 · dead 는 주소가 틀렸다.')
