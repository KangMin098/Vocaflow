// scripts/csat/gate-article-export.mjs
//
// **기사 단위 판정 자료를 뽑는다 — 읽기 전용.**
//
// ── 왜 책 단위로는 안 되나 (실측 2026-09-06) ─────────────────────────
// `gate-book-export.mjs` 는 Gutenberg **책**을 판정한다. "같은 책에서 나온 조각은 장르가
// 같다" 는 가정이 성립해서 793권을 판정하면 조각 28,015편이 따라온다.
//
// 그런데 조판 풀에 남은 미판정 중 **비-raw 5,824편은 Gutenberg 가 하나도 없다**(0/5,824).
// futurity 2,883 · usgs 714 · original 531 · nasa 406 · elife 301 · voa 266 …
// 전부 **개별 기사**다 — 묶을 책이 없으니 책 단위 드레인이 손을 못 댄다.
// 그래서 그 5,824편은 아무리 `gate-book-export` 를 돌려도 영영 미판정으로 남는다.
//
// ── 적재기를 새로 만들지 않는다 ──────────────────────────────────────
// `gate-import.mjs` 는 판정을 `title` 로 대조한다(`keyOf`). 기사 제목도 title 이므로
// **같은 적재기가 그대로 받는다** — out.json 의 `book` 자리에 기사 제목을 쓰면 된다.
// 필드 이름이 `book` 인 것은 어색하지만, 적재기를 갈라 두 벌로 만드는 값보다 싸다.
//
// ⚠️ **제목이 겹치는 기사는 한 판정이 여럿에 적용된다.** 책 단위와 같은 성질이고,
//   여기서는 그 편수를 세어 함께 찍는다 — 모르고 넘어가면 판정 하나가 엉뚱한 글에 붙는다.
//
// 재실행 안전: 읽기만 한다. 이미 판정된 기사(`csat_fit.gate.verdict` 있음)는 건너뛰고,
//   이미 뽑아 둔 청크(`.json` 이 있는 번호)도 다시 만들지 않는다.
//
// 실행:
//   node scripts/csat/gate-article-export.mjs                 # 예행 — 몇 편인지만 센다
//   node scripts/csat/gate-article-export.mjs --write         # 청크를 만든다
//   node scripts/csat/gate-article-export.mjs --write --per 100 --max 12

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const WRITE = process.argv.includes('--write')
const PER = Number(arg('per', 100))
const MAX = Number(arg('max', 0)) // 0 = 제한 없음
const OUT = path.resolve('scripts/csat/gate-article-drain')

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

console.log('기사 단위 판정 자료 export' + (WRITE ? ' — **쓴다**' : ' — 예행'))
console.log('='.repeat(78))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * 훑기 — **본문을 받지 않는다.**
 *
 * ⚠️ 실측 2026-09-06: `content` 를 훑기에 실었더니 400행마다 statement timeout 이 났다
 * (재시도로 살아나지만 훑기가 몇 배로 늘어진다). 본문 컬럼이 1.3GB 라 행마다 detoast 가
 * 붙기 때문이고, 이 저장소가 조판·스캔에서 이미 세 번 밟은 결함이다.
 * **거를 것은 메타로 거르고, 본문은 남은 것에만 따로 받는다.**
 */
async function fetchPage(from, attempt = 0) {
  const size = attempt === 0 ? 1000 : Math.max(200, Math.floor(1000 / 2 ** attempt))
  const { data, error } = await db
    .from('library_articles')
    // ⚠️ **jsonb 를 훑기에서 뺐다.** `csat_fit->gate->>verdict` 를 select 에 넣으면 행마다
    //   jsonb 를 detoast 한다 — 이 인스턴스의 진짜 제약이 **읽기 포화**이기 때문에
    //   (`capacity:disk_io:instance`: shared_buffers 256MB 대 데이터 6,315MB · 캐시가 4%)
    //   그 한 열이 21,831행 훑기를 몇 배로 무겁게 만든다. 판정 여부는 **남은 것에만** 따로 묻는다.
    .select('id,title,source,source_url,word_count,article_v_level')
    // 소스 제외도 DB 에서 한다 — 여기서 거르면 전송량이 4분의 1로 준다.
    .not('source', 'in', '("plos","gutenberg")')
    .in('status', ['ready', 'published'])
    .gt('id', from)
    .order('id')
    .limit(size)
  if (!error) return data
  if (attempt >= 3) {
    console.error('\n  ❌ 조회 실패:', error.message)
    process.exit(1)
  }
  console.error(`\n  ↻ 재시도 ${attempt + 1}/3 (쪽 ${size}) — ${error.message}`)
  await sleep(1500 * 2 ** attempt)
  return fetchPage(from, attempt + 1)
}

/** 본문은 **판정 대상에만** 받는다. pk `IN` 이라 싸고, 50편씩 끊어 URL 길이도 지킨다. */
async function loadBodies(ids) {
  const out = new Map()
  for (let i = 0; i < ids.length; i += 50) {
    const slice = ids.slice(i, i + 50)
    for (let a = 0; a < 4; a += 1) {
      const { data, error } = await db.from('library_articles').select('id,content').in('id', slice)
      if (!error) {
        for (const r of data ?? []) out.set(r.id, r.content)
        break
      }
      if (a === 3) throw new Error(`본문 조회 — ${error.message}`)
      await sleep(1500 * 2 ** a)
    }
    process.stdout.write(`\r  본문 ${out.size.toLocaleString()}/${ids.length.toLocaleString()}`)
  }
  process.stdout.write('\n')
  return out
}

// ── 훑어 모은다 ──────────────────────────────────────────────────────
let rows = []
let cursor = '00000000-0000-0000-0000-000000000000'
let seen = 0
for (;;) {
  const data = await fetchPage(cursor)
  if (!data?.length) break
  // plos·gutenberg 는 질의에서 이미 빠졌다(위 `.not`). 남은 것이 곧 후보다 —
  // 이미 판정을 받았는지는 아래에서 **한 번에** 묻는다.
  for (const r of data) {
    seen += 1
    rows.push(r)
  }
  cursor = data[data.length - 1].id
  process.stdout.write(`\r  훑음 ${seen.toLocaleString()}편 · 대상 ${rows.length.toLocaleString()}편`)
  // ⚠️ 끝은 **빈 쪽**으로만 판단한다 — 재시도가 쪽 크기를 줄이므로 `< size` 로 끊으면 나머지를 빠뜨린다.
}
console.log(`\n  훑음 ${seen.toLocaleString()}편 (plos·gutenberg 제외)\n`)

if (!rows.length) {
  console.log('  대상 소스의 기사가 없다.')
  process.exit(0)
}

/**
 * 이미 판정을 받았는가 — **남은 것에만** 묻는다.
 *
 * 훑기에서 jsonb 를 빼는 대신 여기서 pk `IN` 으로 확인한다. 대상이 훑은 수의 일부라
 * detoast 하는 행이 그만큼 줄고, `IN` 은 pk 인덱스를 그대로 탄다.
 */
async function loadJudged(ids) {
  const judged = new Set()
  const raw = new Set()
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200)
    for (let a = 0; a < 4; a += 1) {
      const { data, error } = await db
        .from('library_articles')
        .select('id,gv:csat_fit->gate->>verdict,gpu:csat_fit->gate->>purpose')
        .in('id', slice)
      if (!error) {
        for (const r of data ?? []) {
          if (r.gv) judged.add(r.id)
          if (r.gpu === 'raw') raw.add(r.id)
        }
        break
      }
      if (a === 3) throw new Error(`판정 여부 조회 — ${error.message}`)
      await sleep(1500 * 2 ** a)
    }
    process.stdout.write(`\r  판정 여부 ${Math.min(i + 200, ids.length).toLocaleString()}/${ids.length.toLocaleString()}`)
  }
  process.stdout.write('\n')
  return { judged, raw }
}

const { judged, raw } = await loadJudged(rows.map((r) => r.id))
const before = rows.length
// 이미 판정된 것과 미절단 원본을 뺀다 — **재실행 안전의 핵심**이다.
rows = rows.filter((r) => !judged.has(r.id) && !raw.has(r.id))
console.log(
  `  이미 판정 ${judged.size.toLocaleString()} · 미절단 원본 ${raw.size.toLocaleString()} 을 빼고 ` +
    `**판정 대상 ${rows.length.toLocaleString()}편** (훑은 ${before.toLocaleString()} 중)\n`,
)

if (!rows.length) {
  console.log('  판정할 기사가 없다 — 전부 판정을 받았다.')
  process.exit(0)
}

// ── 원천·밴드 분포 ───────────────────────────────────────────────────
const tally = (f) =>
  Object.entries(rows.reduce((m, r) => ((m[f(r)] = (m[f(r)] ?? 0) + 1), m), {}))
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v.toLocaleString()}`)
    .join(' · ')
console.log(`  원천  ${tally((r) => r.source ?? '-')}`)
console.log(`  밴드  ${tally((r) => `V${r.article_v_level ?? '?'}`)}\n`)

// ⚠️ 제목이 겹치면 판정 하나가 여러 기사에 붙는다(적재기가 title 로 대조한다).
//   책 단위와 같은 성질이지만 기사에서는 우연한 동명이 더 흔하다 — 세어서 밝힌다.
const byTitle = new Map()
for (const r of rows) {
  const k = String(r.title ?? '').split(' — ')[0].trim() || '(무제)'
  if (!byTitle.has(k)) byTitle.set(k, [])
  byTitle.get(k).push(r)
}
const dup = [...byTitle.values()].filter((v) => v.length > 1)
if (dup.length) {
  console.log(
    `  ⚠ 제목이 겹치는 묶음 ${dup.length}개 · 기사 ${dup.reduce((n, v) => n + v.length, 0).toLocaleString()}편 — ` +
      `판정 하나가 그 묶음 전체에 붙는다`,
  )
  for (const v of dup.slice(0, 5)) console.log(`    · "${String(v[0].title).slice(0, 50)}" × ${v.length}`)
  console.log()
}

// ── 청크로 나눈다 ────────────────────────────────────────────────────
// 발췌는 **둘**이다. 기사는 책과 달리 한 편이 한 흐름이라 셋까지 필요 없고,
// 앞과 중간을 보면 도입부만 보고 오판하는 것을 막을 수 있다.
// ⚠️ **예행은 본문을 안 받는다.** 여기서 먼저 끊지 않으면 "몇 편인지만 보려던" 실행이
//   본문 수천 편을 끌어온다 — 예행이 실행보다 비싸면 아무도 예행을 안 한다.
if (!WRITE) {
  console.log(`  청크 ${Math.ceil(byTitle.size / PER)}개가 만들어진다(청크당 ${PER}편 · 제목 ${byTitle.size.toLocaleString()}묶음).`)
  console.log('  실제로 만들려면 --write')
  process.exit(0)
}

/** 한 창의 길이. 두 창이 겹치지 않으려면 둘째 창은 여기부터 시작해야 한다. */
const SPAN = 420

/**
 * 본문을 한 줄로 접되 **문단 경계는 남긴다.**
 *
 * ⚠️ 예전에는 `\s+ → ' '` 하나로 통째 접었다. 그러면 위키 계열처럼 **절 표제가 마크업 없이
 *   맨 줄로 서 있는** 본문에서 표제가 앞 문장에 그대로 달라붙는다 — 판정자가 실제로
 *   `…about 475 million. Overview The mourning dove…` 를 읽고 「절 표제가 본문에 붙었다」고
 *   보고했다. **DB 는 멀쩡했고 이 줄이 만든 문장이었다.** 실측 2026-09-06: 위키 3원천
 *   199편에 그렇게 붙을 수 있는 자리가 941군데다.
 *
 *   그래서 빈 줄(문단 경계)을 지우지 말고 `¶` 로 보이게 남긴다. 판정자가 "여기서 문단이
 *   바뀐다" 를 알 수 있으면 표제를 문장으로 오독하지 않는다.
 */
const flatten = (s) =>
  String(s ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{2,}/g, ' ¶ ')
    .replace(/\s+/g, ' ')
    .trim()

const excerpt = (s, from) => s.slice(from, from + SPAN)
// 제목 묶음마다 **대표 한 편**의 본문만 받으면 된다 — 판정은 제목 단위로 붙는다.
const bodies = await loadBodies([...byTitle.values()].map((g) => g[0].id))
const items = [...byTitle.entries()].map(([title, group]) => {
  const r = group[0]
  const body = flatten(bodies.get(r.id))
  // ⚠️ **두 창이 겹치면 안 된다.** 예전 규칙(`길이/2 - 210`, 900자 넘으면 둘째 창)은
  //   본문이 900~1,260자일 때 둘째 창을 첫 창 **안에서** 시작시켰다 — 판정자가 같은 문장을
  //   두 번 읽고 "문단이 통째로 중복된다" 고 보고했다(2026-09-06 기사 판정에서 청크마다 5~9건).
  //   실제로는 원문이 아니라 이 창 계산이 겹친 것이고, 그만큼 **중간부를 아무도 못 봤다.**
  //   그래서 둘째 창은 첫 창이 끝난 뒤에서만 시작하고, 남은 본문이 200자도 안 되면 아예 안 뜬다.
  const secondFrom = Math.max(SPAN, Math.floor(body.length / 2) - Math.floor(SPAN / 2))
  const excerpts = [excerpt(body, 0)]
  if (body.length - secondFrom >= 200) excerpts.push(excerpt(body, secondFrom))
  return {
    book: title, // 적재기가 이 이름으로 대조한다 — 기사에서는 제목이다
    url: r.source_url ?? null,
    source: r.source ?? null,
    v_level: r.article_v_level ?? null,
    words: r.word_count ?? null,
    rows: group.length,
    excerpts,
  }
})

fs.mkdirSync(OUT, { recursive: true })

// ── 재실행 안전 — **청크 번호를 항목 위치에서 뽑으면 안 된다** ──────────
// 예전 규칙은 `items` 의 위치 i 로 번호를 정하고 이미 있는 파일은 건너뛰었다. 그런데
// 판정이 적재될수록 이 목록은 **줄어든다**(판정된 기사는 훑기에서 빠진다). 그러면 앞자리에
// 새 기사가 밀려 들어오는데 그 자리 파일은 이미 존재하므로 건너뛴다 — **그 기사들은
// 영영 청크를 못 받는다.** 오류도 안 나고 개수만 맞아 보인다.
// 실측 2026-09-06: 1,200편을 적재한 뒤 다시 뽑았더니 chunk-01~12 자리로 밀려든
// 1,200편이 통째로 빠졌다.
//
// 그래서 두 가지로 바꾼다:
//   ① **이미 어떤 청크에 들어간 제목은 목록에서 뺀다** — 같은 기사가 두 청크에 담겨
//      서로 다른 판정을 받는 것도 이걸로 막힌다(적재기는 파일 이름 순 나중 것이 이긴다).
//   ② 번호는 **비어 있는 가장 작은 번호**를 쓴다 — 위치와 무관해진다.
const already = new Set()
for (const f of fs.readdirSync(OUT)) {
  if (!/^chunk-\d+\.json$/.test(f)) continue
  try {
    for (const it of JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'))) already.add(it.book)
  } catch {
    // 반쯤 쓰인 파일이면 이번엔 못 읽는다. 덮지 않는 쪽이 안전하므로 그냥 넘어간다.
  }
}
const pending = items.filter((it) => !already.has(it.book))
if (already.size) {
  console.log(`  이미 청크에 들어간 ${already.size.toLocaleString()}편을 빼고 ${pending.length.toLocaleString()}편이 남았다\n`)
}

let next = 1
const freeChunk = () => {
  let file
  do {
    file = path.join(OUT, `chunk-${String(next).padStart(2, '0')}.json`)
    next += 1
  } while (fs.existsSync(file))
  return file
}

let made = 0
for (let i = 0; i < pending.length; i += PER) {
  if (MAX && made >= MAX) break
  const file = freeChunk()
  const slice = pending.slice(i, i + PER)
  fs.writeFileSync(file, `${JSON.stringify(slice, null, 1)}\n`)
  console.log(`  ${path.relative(process.cwd(), file)} — ${slice.length}편`)
  made += 1
}
const left = Math.max(0, pending.length - made * PER)
console.log(`\n  청크 ${made}개. 각 청크를 판정해 같은 이름 + .out.json 으로 저장할 것.`)
if (left) console.log(`  아직 청크로 안 뽑은 기사 ${left.toLocaleString()}편 — 다시 돌리면 이어서 뽑는다.`)
