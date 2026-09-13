// scripts/textbook/regen-underlines.mjs
//
// **밑줄이 잘못 걸린 문항을 제자리에서 다시 만든다 — 지우지 않는다.**
//
// ── 왜 이 스크립트가 따로 있나 (실측 2026-09-13) ─────────────────────
// 밑줄 고르는 규칙을 고쳤다(`vocab-choice.isCandidateToken` — 문장부사·마크업·고유명사를
// 후보에서 뺐다). 저장된 문항을 다시 만드는 길은 `store-new-types.mjs --prune` 인데,
// 그 경로에는 두 가지가 걸린다:
//
//   ① **삭제를 거친다.** 문항을 지우면 `csat_item_reviews` 가 CASCADE 로 함께 사라지고
//      (3인 검수 기록), 되돌릴 방법이 없다.
//   ② **원글을 전량 읽는다.** V5 는 9,878편이고 본문까지 들고 있어야 해서 무겁다 —
//      2026-09-13 에 그 스크립트가 **메모리 부족으로 조용히 죽었다**(자물쇠 회수 줄만 남기고
//      로그가 멈췄다. 같은 순간 `git push` 도 SEC_E_INSUFFICIENT_MEMORY 로 실패했다).
//
// 여기서는 **고칠 문항을 먼저 골라내고**(밑줄에 절 부호·괄호가 붙은 것) 그 문항이 쓰는 원글만
// 배치로 읽는다. 실측: 낡은 문항 4,609개 · 필요한 원글 **3,550편**(전량의 36%).
//
// ── 지우지 않고 갱신하는 것의 뜻 ────────────────────────────────────
// `payload` 와 `answer_key` 를 제자리에서 바꾼다. 그래서:
//   · 문항 id 가 그대로다 → 참조가 끊기지 않는다.
//   · **해설은 지운다**(`explanation_ko`) — 문항이 바뀌었으므로 옛 해설은 틀린 글이다.
//     `explain-fill.mjs --band N` 이 규칙으로 다시 채운다.
//   · **그 문항의 검수 기록도 지운다** — 3인이 본 것은 옛 문항이다. 바뀐 문항은 다시 받아야 한다.
//     (이것만이 유일한 삭제이고, 지우는 대상과 이유가 분명하다.)
//
// ⚠️ **재생성이 실패하면 건드리지 않는다.** 새 규칙은 후보를 줄이므로 어떤 문단은 밑줄 다섯을
//   못 만든다. 그때 억지로 넣지 않고 **세기만** 한다 — 빈 값을 넣으면 다음 실행이 「완료」로
//   세어 구멍이 영영 남는다(루트 CLAUDE.md 드레인 규칙).
//
// 재실행 안전: 몇 번 돌려도 결과가 같다. 고친 문항은 새 규칙을 통과하므로 다음 실행의
// 대상 목록에서 빠진다.
//
// 실행:
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/regen-underlines.mjs --band 5
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/regen-underlines.mjs --band 5 --commit
//   … --band 5 --limit 500        한 번에 다룰 문항 수 (기본 전부)

import fs from 'node:fs'
import path from 'node:path'

// **한 번에 하나만 돈다.** 겹치면 둘 다 statement timeout 으로 죽는다(batch-lock.mjs).
import { acquire } from './batch-lock.mjs'

acquire('textbook-batch')

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = Number(arg('band') ?? 5)
const LIMIT = Number(arg('limit') ?? 0) || 0
const COMMIT = process.argv.includes('--commit')
/** 한 번에 읽을 원글 수 — 메모리가 여기서 정해진다. */
const ARTICLE_PAGE = 150

const { createClient } = await import('@supabase/supabase-js')
const { buildVocabChoice, buildGrammarChoice, isPrintableUnderlineWord } = await import(
  '@vocaflow/library-pipeline'
)

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/** 원래 생성과 **같은 규칙**으로 쪼갠다 — 다르면 다른 문단을 보고 다른 문항을 만든다. */
const paras = (c) =>
  String(c)
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
const sents = (p) =>
  p
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

/**
 * 새 규칙이 거절하는 밑줄인가 — 대상 고르기와 검증에 **같은 자**를 쓴다.
 *
 * ⚠️ 자를 여기에 **베껴 적지 않는다**(2026-09-13 2차에 그렇게 했다가 어긋났다). 생성기가
 *   쓰는 것과 같은 함수를 불러 쓴다 — 한쪽만 넓히면 「고쳤는데 대상에 안 잡히는 문항」이
 *   생기고, 그건 전수로 세어 보기 전까지 안 보인다.
 */
const isBadWord = (w) => !isPrintableUnderlineWord(String(w))
const hasBadUnderline = (payload) =>
  (payload?.underlines ?? []).some((u) => isBadWord(u?.word ?? ''))

// ── ① 고칠 문항을 고른다 ────────────────────────────────────────────
//
// ⚠️ **`payload` 를 통째로 받으면 죽는다.** 첫 판이 그랬다(실측 2026-09-13:
//   `canceling statement due to statement timeout`). V5 의 이 두 유형만 14,942문항이고,
//   `payload.sentences` 가 덩치의 대부분이다 — 그런데 **판정에 필요한 것은 `underlines` 뿐**이다.
//   jsonb 경로만 골라 받으면 전송량이 한 자릿수로 줄고, `answer_key` 는 고칠 것이 정해진
//   뒤에 그것만 받는다.
console.log(`V${BAND} — 고칠 문항을 고른다`)
const targets = []
{
  let cursor = null
  for (;;) {
    let q = db
      .from('csat_dcp_items')
      .select('id, type, ref_id, paragraph_idx, underlines:payload->underlines')
      .eq('kind', 'article')
      .eq('v_level', BAND)
      .in('type', ['vocab_choice', 'grammar_choice'])
      .order('id')
      .limit(200)
    if (cursor) q = q.gt('id', cursor)
    const { data, error } = await q
    if (error) throw new Error('문항 조회 실패: ' + error.message)
    if (!data?.length) break
    for (const r of data) {
      if ((r.underlines ?? []).some((u) => isBadWord(u?.word ?? ''))) {
        targets.push({ id: r.id, type: r.type, ref_id: r.ref_id, paragraph_idx: r.paragraph_idx })
      }
    }
    cursor = data[data.length - 1].id
    if (data.length < 200) break
    if (LIMIT && targets.length >= LIMIT) break
  }
}
const work = LIMIT ? targets.slice(0, LIMIT) : targets
const articleIds = [...new Set(work.map((r) => r.ref_id).filter(Boolean))]
console.log(`  고칠 문항 ${work.length} · 읽어야 할 원글 ${articleIds.length}`)
if (!work.length) {
  console.log('\n고칠 것이 없다 — 이 밴드의 밑줄은 이미 새 규칙을 통과한다.')
  process.exit(0)
}

// ── ② 사전 ──────────────────────────────────────────────────────────
// 어휘 재생성은 반대말·품사를 탄다. 어법은 안 탄다.
const needLex = work.some((r) => r.type === 'vocab_choice')
const antOf = new Map()
const posOf = new Map()
if (needLex) {
  console.log('  사전을 읽는다')
  let from = 0
  for (;;) {
    const { data, error } = await db
      .from('shared_dictionary')
      .select('word, antonyms, primary_pos')
      .order('word')
      .range(from, from + 999)
    if (error) throw new Error('사전 조회 실패: ' + error.message)
    if (!data?.length) break
    for (const r of data) {
      const w = String(r.word).toLowerCase()
      if (Array.isArray(r.antonyms) && r.antonyms.length) antOf.set(w, r.antonyms.map(String))
      if (r.primary_pos) posOf.set(w, String(r.primary_pos))
    }
    if (data.length < 1000) break
    from += 1000
  }
}
const lex = {
  antonymsOf: (w) => antOf.get(w.toLowerCase()) ?? [],
  posOf: (w) => posOf.get(w.toLowerCase()) ?? null,
}

// ── ③ 원글을 배치로 읽어 제자리 갱신 ────────────────────────────────
const byArticle = new Map()
for (const r of work) {
  if (!r.ref_id) continue
  if (!byArticle.has(r.ref_id)) byArticle.set(r.ref_id, [])
  byArticle.get(r.ref_id).push(r)
}

let fixed = 0
let unbuildable = 0
let stillBad = 0
let reviewsCleared = 0
const samples = []

for (let i = 0; i < articleIds.length; i += ARTICLE_PAGE) {
  const slice = articleIds.slice(i, i + ARTICLE_PAGE)
  const { data: arts, error } = await db
    .from('library_articles')
    .select('id, content')
    .in('id', slice)
  if (error) throw new Error('원글 조회 실패: ' + error.message)

  for (const a of arts ?? []) {
    const ps = paras(a.content)
    for (const item of byArticle.get(a.id) ?? []) {
      const para = ps[item.paragraph_idx]
      if (!para) {
        unbuildable++
        continue
      }
      const ss = sents(para)
      const built =
        item.type === 'vocab_choice' ? buildVocabChoice(ss, lex) : buildGrammarChoice(ss)
      if (!built) {
        // 새 규칙으로는 이 문단에서 밑줄 다섯을 못 만든다 — **억지로 넣지 않는다.**
        unbuildable++
        continue
      }
      const payload = { sentences: built.sentences, underlines: built.underlines }
      if (hasBadUnderline(payload)) {
        // 새 규칙을 통과했는데도 자에 걸리면 자와 규칙이 갈린 것이다 — 고치지 않고 센다.
        stillBad++
        continue
      }
      // `answer_key` 를 통째로 덮지 않는다 — 기존 키를 읽어 필요한 것만 바꾼다.
      const nextKey = { ...(item.answer_key ?? {}) }
      nextKey.position = built.answer
      if (item.type === 'vocab_choice') nextKey.original = built.original
      // 문항이 바뀌었으므로 옛 해설은 **틀린 글**이다. 지우고 explain-fill 이 다시 쓰게 한다.
      delete nextKey.explanation_ko
      delete nextKey.explanation_writer
      delete nextKey.rationale_ko

      if (COMMIT) {
        const { error: upErr } = await db
          .from('csat_dcp_items')
          .update({ payload, answer_key: nextKey })
          .eq('id', item.id)
        if (upErr) throw new Error(`갱신 실패(${item.id}): ${upErr.message}`)
        // 3인이 본 것은 **옛 문항**이다 — 바뀐 문항은 다시 받아야 한다.
        const { error: delErr, count } = await db
          .from('csat_item_reviews')
          .delete({ count: 'exact' })
          .eq('item_id', item.id)
        if (delErr) throw new Error(`검수 기록 정리 실패(${item.id}): ${delErr.message}`)
        reviewsCleared += count ?? 0
      }
      fixed++
      if (samples.length < 3) {
        samples.push(
          `[${item.type}] ${built.underlines.map((u) => u.word).join(' · ')}`,
        )
      }
    }
  }
  console.log(`  원글 ${Math.min(i + ARTICLE_PAGE, articleIds.length)}/${articleIds.length} · 고친 문항 ${fixed}`)
}

console.log(`\nV${BAND} — 고칠 대상 ${work.length}`)
console.log(`  다시 만듦                ${fixed}`)
console.log(`  새 규칙으로는 못 만듦      ${unbuildable}`)
console.log(`  만들었는데 자에 또 걸림    ${stillBad}${stillBad ? '  ← 자와 규칙이 갈렸다. 봐야 한다' : ''}`)
if (COMMIT) console.log(`  함께 지운 검수 기록        ${reviewsCleared}행`)
if (samples.length) {
  console.log('\n표본(새 밑줄):')
  for (const s of samples) console.log(`  ${s}`)
}
if (!COMMIT) {
  console.log('\n미리보기다 — 아무것도 쓰지 않았다. 넣으려면 --commit.')
} else {
  console.log('\n다음: explain-fill.mjs --commit --band ' + BAND + ' 로 해설을 다시 채운다.')
}
