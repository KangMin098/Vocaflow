// scripts/textbook/extraction-defect-scan.mjs
//
// **본문이 글이 아닌 것을 센다 — 판정이 통과시킨 뒤에도 남는 결함.**
//
// ── 왜 이 스캔이 따로 필요한가 ───────────────────────────────────────
// 내용 판정(`gate-import`)은 "이 글이 교재에 쓸 장르인가" 를 묻는다. 그 질문은
// **본문이 온전하다는 것을 전제로 한다.** 전제가 깨진 경우는 판정이 못 잡는다 —
// 판정자는 발췌 두 조각만 보는데, 결함은 발췌에 안 걸릴 수도 있고, 걸려도
// "장르는 설명문" 이라는 답이 틀린 것은 아니기 때문이다.
//
// 2026-09-06 기사 1,200편을 판정하면서 서로 다른 판정자 셋이 같은 갈래를 지적했다:
//
//   ① `space_place` — 툴팁 HTML 속성이 문장 한복판에 들어와 있었다
//      `... pulls in everything around it." clicked="0"&gt;supermassive black hole ...`
//   ② `simple_wikipedia` — 본문에 `== Plot ==` 위키 마크업이 남아 있었다
//   ③ NASA APOD — 설명문 한 문단이 **통째로 두 번** 들어 있었다(452어 중 절반이 중복)
//   ④ `space_place` — 본문 자리에 브라우저 안내가 들어와 있었다
//      `You are using an outdated browser… Click here to download this video (1920x1080, 116 MB)`
//
// 넷 다 "장르는 멀쩡한데 지문으로 못 쓰는" 상태다. 판정은 `use` 로 통과시켰거나
// 통과시켰을 것이고, 그대로 두면 **학생이 읽는 지문에 그 문자열이 인쇄된다.**
//
// ── 이 스캔이 하지 않는 것 ───────────────────────────────────────────
// **고치지 않는다.** 어디에 몇 편 있는지만 센다. 자동 세척은 위험하다 —
// 예컨대 `==` 는 수식에도 나오고, 문단 중복은 후렴처럼 의도된 경우가 있다.
// 무엇을 지울지는 소스별 추출기를 고칠 때 사람이 정한다.
//
// ⚠️ 본문을 읽어야 하므로 **가볍지 않다.** `content` 는 이 표에서 1.3GB 다.
//   그래서 한 번에 `--limit` 편만 받고, 기본은 표본이다. 전수는 `--all`.
//   읽기만 하므로 재실행 안전 — 몇 번을 돌려도 DB 가 바뀌지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/extraction-defect-scan.mjs                  # 표본 3,000편
//   pnpm dlx tsx scripts/textbook/extraction-defect-scan.mjs --all            # 전수 + 스냅샷 갱신
//   pnpm dlx tsx scripts/textbook/extraction-defect-scan.mjs --all --no-write # 전수, 터미널에만
//   pnpm dlx tsx scripts/textbook/extraction-defect-scan.mjs --source nasa    # 한 원천만
//   pnpm dlx tsx scripts/textbook/extraction-defect-scan.mjs --sample 5       # 결함별 예시 편수
//
// ⚠️ **표본·한 원천 실행은 스냅샷을 덮지 않는다.** 그 결과로 덮으면 화면이 표본만 있는
//   세상을 말한다. 전수(`--all`)일 때만 기본으로 쓴다.

import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !KEY) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다')
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` }

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const ALL = process.argv.includes('--all')
const ONLY_SOURCE = arg('source')
const LIMIT = Number(arg('limit') ?? (ALL ? Infinity : 3000))
const SAMPLES = Number(arg('sample') ?? 3)
/** 화면이 읽는 스냅샷. **기본 대상이다** — 갱신을 잊으면 화면이 조용히 낡는다. */
const SNAPSHOT_PATH = path.resolve('apps/web/src/lib/textbook/extraction-defect-snapshot.json')
const NO_WRITE = process.argv.includes('--no-write')
// ⚠️ 표본이나 한 원천만 훑은 결과로 전체 스냅샷을 덮으면 화면이 그 표본만 있는 세상을 말한다.
//   전수(--all)일 때만 기본으로 쓴다. 그 밖에는 --json 을 명시해야 한다.
const JSON_OUT = NO_WRITE ? null : arg('json') ?? (ALL && !ONLY_SOURCE ? SNAPSHOT_PATH : null)

/**
 * 결함 규칙 — **하나하나가 실제로 본 것**이다. 짐작으로 규칙을 늘리지 않는다.
 * 늘리면 오탐이 늘고, 오탐이 늘면 이 목록을 아무도 안 본다.
 *
 * `test(body)` 는 결함이면 근거 문자열을, 아니면 null 을 돌려준다 —
 * 근거가 없으면 다음 사람이 같은 조사를 처음부터 다시 한다.
 */
const RULES = [
  {
    id: 'html-attr',
    label: 'HTML 속성 혼입',
    why: '툴팁·링크 속성이 문장 한복판에 남았다 — 그대로 인쇄된다',
    test: (b) => {
      const m = b.match(/[a-z-]+="[^"]{0,40}"\s*&?gt;|&lt;\/?[a-z]+&gt;|<\/?(?:div|span|p|a|img)\b/i)
      return m ? m[0].slice(0, 60) : null
    },
  },
  {
    id: 'wiki-markup',
    label: '위키 마크업 잔재',
    why: '`== 절 ==` · `[[링크]]` · `{{틀}}` 이 본문에 남았다',
    test: (b) => {
      const m = b.match(/^={2,}[^=\n]{1,60}={2,}\s*$|\[\[[^\]\n]{1,60}\]\]|\{\{[^}\n]{1,60}\}\}/m)
      return m ? m[0].slice(0, 60) : null
    },
  },
  {
    id: 'browser-notice',
    label: '브라우저·재생기 안내',
    why: '본문 자리에 "구형 브라우저" · "여기를 눌러 내려받기" 가 들어왔다 — 추출 실패',
    test: (b) => {
      const m = b.match(
        /You are using an outdated browser|Click here to download this (?:video|file)|enable JavaScript|Your browser does not support/i,
      )
      return m ? m[0].slice(0, 60) : null
    },
  },
  {
    id: 'dup-paragraph',
    label: '문단 통째 중복',
    why: '같은 문단이 두 번 들어 있다 — 어수가 부풀고 읽으면 되풀이된다',
    test: (b) => {
      // 40자 미만 줄은 캡션·머리말일 수 있어 세지 않는다(후렴 오탐).
      const seen = new Map()
      for (const raw of b.split(/\n+/)) {
        const line = raw.trim()
        if (line.length < 80) continue
        const key = line.slice(0, 120)
        if (seen.has(key)) return key.slice(0, 60)
        seen.set(key, true)
      }
      return null
    },
  },
  {
    id: 'share-chrome',
    label: '공유 버튼·크레딧 잔재',
    why: '"Facebook Pinterest X LinkedIn" · "Image Credit:" 가 본문에 섞였다',
    test: (b) => {
      const m = b.match(
        /Facebook\s+Pinterest\s+X?\s*LinkedIn|Share on (?:Facebook|Twitter|X)\b|\b\d+ min read\b/i,
      )
      return m ? m[0].slice(0, 60) : null
    },
  },
]

const num = (n) => n.toLocaleString()
const pad = (s, w) => String(s).padEnd(w)

/** 커서 페이징 — `count: 'exact'` 는 이 표에서 8초 timeout 에 걸린다. */
async function* walk() {
  let cursor = '00000000-0000-0000-0000-000000000000'
  let got = 0
  while (got < LIMIT) {
    const take = Math.min(200, LIMIT - got)
    const params = new URLSearchParams({
      select: 'id,title,source,content',
      status: 'in.(ready,published)',
      id: `gt.${cursor}`,
      order: 'id.asc',
      limit: String(take),
    })
    if (ONLY_SOURCE) params.set('source', `eq.${ONLY_SOURCE}`)
    const res = await fetch(`${URL_BASE}/rest/v1/library_articles?${params}`, { headers: HEADERS })
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    const rows = await res.json()
    if (!rows.length) return
    for (const r of rows) yield r
    got += rows.length
    cursor = rows[rows.length - 1].id
    process.stderr.write(`  훑음 ${num(got)}편\r`)
    if (rows.length < take) return
  }
}

const started = Date.now()
const hits = new Map(RULES.map((r) => [r.id, { count: 0, bySource: new Map(), samples: [] }]))
let scanned = 0
let defective = 0

for await (const row of walk()) {
  scanned += 1
  const body = String(row.content ?? '')
  if (!body) continue
  let bad = false
  for (const rule of RULES) {
    const evidence = rule.test(body)
    if (!evidence) continue
    bad = true
    const h = hits.get(rule.id)
    h.count += 1
    h.bySource.set(row.source, (h.bySource.get(row.source) ?? 0) + 1)
    if (h.samples.length < SAMPLES) {
      h.samples.push({ title: String(row.title ?? '').slice(0, 50), source: row.source, evidence })
    }
  }
  if (bad) defective += 1
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1)
process.stderr.write(' '.repeat(30) + '\r')

console.log(`\n추출 결함 — ${ALL ? '전수' : `표본 ${num(scanned)}편`}${ONLY_SOURCE ? ` · ${ONLY_SOURCE}` : ''} · ${elapsed}초\n`)
console.log(`  ${pad('결함', 20)}${pad('편수', 9)}${pad('비율', 8)}무엇인가`)
console.log(`  ${'─'.repeat(96)}`)
for (const rule of RULES) {
  const h = hits.get(rule.id)
  const pct = scanned ? `${((h.count / scanned) * 100).toFixed(1)}%` : '—'
  console.log(`  ${pad(rule.label, 20)}${pad(num(h.count), 9)}${pad(pct, 8)}${rule.why}`)
}
console.log(`  ${'─'.repeat(96)}`)
console.log(`  ${pad('하나라도 걸린 편', 20)}${pad(num(defective), 9)}${scanned ? `${((defective / scanned) * 100).toFixed(1)}%` : '—'}\n`)

for (const rule of RULES) {
  const h = hits.get(rule.id)
  if (!h.count) continue
  const top = [...h.bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  console.log(`  ${rule.label} — 원천별 ${top.map(([s, n]) => `${s} ${num(n)}`).join(' · ')}`)
  for (const s of h.samples) console.log(`      · ${pad(s.source, 18)}${s.title}\n        ${s.evidence}`)
}

if (!defective) console.log('  결함 없음.')

// ⚠️ **비율만 말하면 오해를 부른다.** 2026-09-06 표본 3,000편에서 「문단 통째 중복」이
//   55.8% 로 나왔는데, 1,674건 중 1,668건이 plos 하나였고 모양도 하나였다
//   (초록이 머리에 한 번 · `Abstract` 제목 뒤에 다시 한 번). "본문 절반이 깨졌다" 가 아니라
//   "한 원천의 수확기가 한 군데서 겹쳐 붙인다" 는 뜻이다. 처방이 완전히 다르므로 함께 적는다.
for (const rule of RULES) {
  const h = hits.get(rule.id)
  if (h.count < 20) continue
  const [topSource, topCount] = [...h.bySource.entries()].sort((a, b) => b[1] - a[1])[0]
  const share = (topCount / h.count) * 100
  if (share < 80) continue
  console.log(
    `\n  ⚠ ${rule.label} 은 사실상 한 원천의 문제다 — ` +
      `${topSource} 가 ${num(topCount)}건 / ${num(h.count)}건(${share.toFixed(0)}%). ` +
      '전체 비율로 읽지 말고 그 수확기를 볼 것.',
  )
}

if (JSON_OUT) {
  // 화면이 이 파일을 읽는다. **화면이 다시 계산하지 않는다** — 여기서 잰 값이 그대로 보여야
  // 화면과 CLI 가 같은 말을 한다.
  const snapshot = {
    measuredAt: new Date().toISOString(),
    elapsedSeconds: Number(elapsed),
    scope: ALL ? "status in ('ready','published')" : `표본 ${scanned}편`,
    scanned,
    defective,
    rules: RULES.map((r) => {
      const h = hits.get(r.id)
      return {
        id: r.id,
        label: r.label,
        why: r.why,
        count: h.count,
        bySource: [...h.bySource.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([source, count]) => ({ source, count })),
        samples: h.samples,
      }
    }),
  }
  fs.writeFileSync(JSON_OUT, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`\n  → ${JSON_OUT}`)
}

console.log('\n  고치지 않았다 — 무엇을 지울지는 소스별 추출기를 고칠 때 사람이 정한다.')
