// scripts/textbook/prune-article-chrome.mjs
//
// **기사 껍데기가 박힌 문항을 지운다.**
//
// ── 왜 별도 스크립트인가 ─────────────────────────────────────────────
// 낡은 문항 정리는 원래 `store-new-types.mjs --prune` 이 한다. 그런데 그 스크립트는
// 원글 6천 편의 본문을 다시 읽고 문항을 **전부 재생성해 대조**한다 — V5·V6 만 해도
// 몇 시간이다(그래서 `--band` 이 생겼다).
//
// 여기서 지울 대상은 그 대조가 필요 없다. **저장된 payload 자체에 자국이 있는지**만
// 보면 되고, 그 판정은 `hasArticleChrome()`(`csat-format.ts`)이 이미 한다.
// 같은 게이트를 쓰므로 판정이 갈릴 수 없다.
//
// ── 왜 다시 안 만드나 ────────────────────────────────────────────────
// 지운 자리는 비워 둔다. 그 문항의 지문이 곧 기사 껍데기라, 게이트가 넓어진 지금
// `store-new-types` 는 같은 문단에서 문항을 **다시 만들지 않는다**. 억지로 채우면
// 애초에 막으려던 것을 다시 넣는 셈이다.
//
// ── 실측 2026-08-30 ─────────────────────────────────────────────────
// 저장 문항 136,537건 중 **474건(0.35%)** 에 자국이 있었다:
//   V6 295 · V5 123 · V7 28 · V4 15 · V9 6 · V8 4 · V3 2 · V2 1
//   unit_vocab 240 · vocab_choice 107 · unit_grammar 27 · blank_word 27 · 나머지 73
// 빈칸 드레인 청크를 손으로 채우다 8편 중 3편이 문항이 안 되는 것을 보고 찾아냈다.
//
// 재실행 안전: 지울 것이 없으면 아무것도 안 한다. `--commit` 없이는 읽기만 한다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/prune-article-chrome.mjs            # 세기만
//   pnpm dlx tsx scripts/textbook/prune-article-chrome.mjs --commit   # 삭제 (되돌릴 수 없다)

import { loadEnv } from './volume-pool.mjs'

loadEnv()
const commit = process.argv.includes('--commit')

const { createClient } = await import('@supabase/supabase-js')
const { hasArticleChrome } = await import('@vocaflow/library-pipeline')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/**
 * 학습자·인쇄물이 실제로 보는 글만 모은다.
 *
 * 유형마다 지문이 다른 키에 있다 — `passage`(생성형) · `sentences`(밑줄형) ·
 * `stem`(단답) · `remaining`+`insert_sentence`(삽입) · `presented`(순서) · `context`(배열).
 * 하나라도 빠뜨리면 그 유형의 자국을 못 본다.
 */
function visibleText(payload) {
  const bits = []
  for (const k of ['passage', 'stem', 'context', 'intro']) {
    if (typeof payload?.[k] === 'string') bits.push(payload[k])
  }
  for (const k of ['sentences', 'presented', 'remaining']) {
    if (Array.isArray(payload?.[k])) {
      bits.push(payload[k].map((x) => (typeof x === 'string' ? x : (x?.text ?? ''))).join(' '))
    }
  }
  if (typeof payload?.insert_sentence === 'string') bits.push(payload.insert_sentence)
  return bits.join(' ')
}

const hits = []
const byBand = {}
const byType = {}
let scanned = 0

for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('csat_dcp_items')
    .select('id, type, v_level, payload')
    .order('id')
    .range(from, from + 999)
  if (error) throw new Error('문항 조회 실패: ' + error.message)
  if (!data?.length) break
  for (const r of data) {
    scanned += 1
    if (!hasArticleChrome(visibleText(r.payload))) continue
    hits.push(r.id)
    const b = `V${r.v_level ?? '?'}`
    byBand[b] = (byBand[b] ?? 0) + 1
    byType[r.type] = (byType[r.type] ?? 0) + 1
  }
  if (data.length < 1000) break
}

console.log(`훑음 ${scanned.toLocaleString()} · **기사 껍데기 ${hits.length}**`)
if (hits.length) {
  console.log(`  밴드: ${Object.entries(byBand).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  console.log(`  유형: ${Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
}

if (!hits.length) {
  console.log('지울 것이 없다.')
} else if (!commit) {
  console.log('\n--commit 을 붙이면 삭제한다 (되돌릴 수 없다).')
} else {
  let done = 0
  for (let i = 0; i < hits.length; i += 200) {
    const slice = hits.slice(i, i + 200)
    const { error } = await db.from('csat_dcp_items').delete().in('id', slice)
    if (error) throw new Error('삭제 실패: ' + error.message)
    done += slice.length
  }
  console.log(`\n삭제 완료 ${done}건`)
  console.log('  자리는 비워 둔다 — 그 지문이 곧 껍데기라 게이트가 넓어진 지금은 다시 안 만들어진다.')
}
