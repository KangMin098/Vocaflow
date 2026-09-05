// scripts/textbook/prune-kid-excerpts.mjs
//
// **자립성 게이트 미달 PD 발췌를 걷어낸다.**
//
// ── 왜 필요한가 (실측 2026-09-04) ────────────────────────────────────
// 자립성 자(`standalone.ts`)가 생기기 전에 적재한 발췌 906편 중 **629편(69%)이
// 소설 대화 장면이거나 앞을 가리키며 시작**한다. 어수·FK·어휘는 통과했지만 교재
// 지문이 아니다. 남겨 두면 두 가지가 샌다:
//
//   · 다음 처리 배치가 이것들부터 집어 **어휘 분석 행을 만든다**(편당 ~174KB)
//   · 서가에 올라가면 학습자가 맥락 없는 장면 조각을 읽는다
//
// ── 지우는 것이 안전한 이유 ──────────────────────────────────────────
// 조각의 `source_id` 는 **본문 해시**(`pgkid:<책>:<sha256 앞 16자>`)다. 같은 조각이
// 다시 필요하면 같은 책을 다시 훑어 **같은 id 로** 재수확된다 — 잃는 것은 없고,
// 커서만 되돌리면 된다.
//
// ⚠️ **`feed_id='kid-excerpt'` 만 본다.** 같은 `source='gutenberg'` 에 수능 수확분
//   8,141편이 함께 있다(`feed_id='harvest'`). 소스로 지우면 그쪽이 날아간다.
// ⚠️ 판정은 **패키지 정본**(`standaloneFit`)으로 한다. 여기서 규칙을 다시 쓰면
//   적재기가 넣는 기준과 지우는 기준이 갈린다.
//
// 재실행 안전: 판정은 본문에서 다시 하므로 몇 번 돌려도 결과가 같다.
//   이미 지워진 것은 다음 실행에서 조회되지 않는다.
//
// 실행:
//   node scripts/textbook/prune-kid-excerpts.mjs            # 세기만 한다
//   node scripts/textbook/prune-kid-excerpts.mjs --commit   # 실제로 지운다

import fs from 'node:fs'
import path from 'node:path'

import { standaloneFit } from '../../packages/library-pipeline/src/textbook/standalone.ts'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const COMMIT = process.argv.includes('--commit')

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/**
 * **DB 호출은 재시도한다 — 이 저장소에서 다섯 번째로 같은 결함이다.**
 *
 * `gate-import` · `adapt-drain-import` · `harvest-gutenberg-kid` · `gate-book-export` 는
 * 각자 재시도를 갖는데 여기만 없었다. 연결이 한 번 흔들리면 훑은 것이 통째로 날아간다.
 * 판정은 본문에서 다시 하므로 재실행이 안전하지만, **다시 도는 비용이 공짜는 아니다.**
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function dbRetry(fn, what, attempt = 0) {
  try {
    const r = await fn()
    if (r?.error) throw new Error(r.error.message)
    return r
  } catch (e) {
    if (attempt >= 5) throw new Error(`${what} — ${String(e.message).slice(0, 80)}`)
    const wait = Math.min(20_000, 1500 * 2 ** attempt)
    console.error(`  ↻ ${what} 재시도 ${attempt + 1}/5 (${Math.round(wait / 1000)}s)`)
    await sleep(wait)
    return dbRetry(fn, what, attempt + 1)
  }
}

const rows = []
// ⚠️ 한 번에 500편씩 `order('id')` 로 훑었더니 **statement timeout** 이었다(실측).
//   `feed_id` 만으로는 계획기가 인덱스를 못 쓴다 — `source` 를 함께 걸고 쪽을 작게 잡는다.
//   같은 함정을 오늘 `adapt-drain-export` 에서도 밟았다(본문 전량 조회).
const PAGE = 100
for (let from = 0; ; from += PAGE) {
  const { data } = await dbRetry(
    () =>
      db
        .from('library_articles')
        .select('id, content, status, feed_label')
        .eq('source', 'gutenberg')
        .eq('feed_id', 'kid-excerpt')
    // ⚠️ **정렬 키가 유일해야 한다.** 처음엔 `created_at` 만으로 넘겼는데, 배치로 200편을
    //   한꺼번에 넣어 같은 타임스탬프가 수두룩하다 → 페이지 경계에서 행이 섞이고
    //   **15편이 조회를 통째로 빠져나갔다**(실측: 906편 중 891편만 판정됨).
    //   같은 버그를 이 저장소가 세 번째로 밟았다(IA 수집 · market-benchmark · 여기).
        .order('created_at')
        .order('id')
        .range(from, from + PAGE - 1),
    `조회 offset ${from}`,
  )
  rows.push(...data)
  if (data.length < PAGE) break
}

const bad = []
const byBand = {}
const byStatus = {}
for (const r of rows) {
  const f = standaloneFit(r.content ?? '')
  if (f.pass) continue
  bad.push(r.id)
  const band = (r.feed_label ?? '').replace('PD 발췌 · ', '')
  byBand[band] = (byBand[band] ?? 0) + 1
  byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
}

console.log(`\n적재분 ${rows.length}편 · 자립성 미달 **${bad.length}편** (${((bad.length / rows.length) * 100).toFixed(0)}%)\n`)
console.log('  칸별  ' + Object.entries(byBand).map(([k, v]) => `${k} ${v}`).join(' · '))
console.log('  상태  ' + Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(' · '))
console.log(`  남는 것 **${rows.length - bad.length}편**\n`)

if (!COMMIT) {
  console.log('세기만 했다. 실제로 지우려면 --commit.')
  process.exit(0)
}

// 어휘 색인은 FK 로 매달려 있다 — 본문을 지우면 함께 지워진다(ON DELETE CASCADE).
//   그렇지 않다면 고아 행이 남으므로, 지운 뒤 남은 수를 확인한다.
let removed = 0
for (let i = 0; i < bad.length; i += 200) {
  const chunk = bad.slice(i, i + 200)
  await dbRetry(() => db.from('library_articles').delete().in('id', chunk), `삭제 ${i}`)
  removed += chunk.length
  process.stdout.write(`\r  지움 ${removed}/${bad.length}`)
}
console.log()

const { count: left } = await db
  .from('library_articles')
  .select('id', { count: 'exact', head: true })
  .eq('feed_id', 'kid-excerpt')
console.log(`\n  남은 발췌 ${left}편 — 전부 자립성 게이트를 통과한 것이다.`)
