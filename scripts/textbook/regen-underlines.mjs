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

/**
 * **대문자로 시작하는 밑줄이 있는가** — 고유명사 가드가 닿아야 할 재고를 고른다.
 *
 * ── 왜 필요한가 (3인 검수 2회차 실측 2026-09-16) ─────────────────────
 * 위 `isBadWord` 는 **부호가 붙은 밑줄**만 고른다. 그런데 그 뒤로 생성기에 가드가 둘 더
 * 들어갔다 — `properNounsIn`(2026-09-14, 문장 중간의 대문자·통짜 대문자)과 사전 검사
 * (2026-09-15, 문장 첫머리의 이름). **두 가드 다 부호를 안 보므로 이 선택자에 안 걸린다.**
 * 그래서 검수자 둘이 각자 같은 말을 했다 — 「코드는 고쳤는데 재고를 안 쓸었다」.
 * 실측: V5 `vocab_choice` 10,612건 중 **3,598건(33.9%)** 이 사전에 없는 대문자 밑줄을 갖고,
 * 이번 라운드 어휘 11문항 중 4문항이 그 꼴이었다(`Tabitha`·`Marian`·`Thomas`·`Maria`).
 *
 * ⚠️ **선택자는 상위집합이면 된다 — 정확도는 생성기가 낸다.** 재생성은 결정론이라
 *   규칙이 그 밑줄을 이제 와서 거절하지 않으면 **같은 문항이 다시 나오고 쓰기는 무의미해진다**
 *   (이 스크립트는 바뀐 것만 쓴다). 그러니 여기서 정밀하게 고를 이유가 없다.
 * ⚠️ **`sentences` 를 받지 않는다** — 그러면 `properNounsIn` 을 그대로 쓸 수 있지만
 *   위 ① 주석이 적어 둔 그 timeout 으로 되돌아간다. 판정에 필요한 것은 `underlines` 뿐이다.
 */
const hasCapitalUnderline = (payload) =>
  (payload?.underlines ?? []).some((u) => /^[A-Z]/.test(String(u?.word ?? '')))

/**
 * 정답 키가 **반쪽인가** — 해설 작성기가 요구하는 `original` 이 없는 문항.
 *
 * ⚠️ 이 갈래는 **내가 낸 사고를 스스로 줍기 위해** 있다(실측 2026-09-13). 아래 ③의 주석은
 *   「기존 키를 읽어 필요한 것만 바꾼다」라고 적어 놓고 **정작 `answer_key` 를 조회에서
 *   빼먹었다.** 그래서 `{...undefined ?? {}}` 가 빈 객체가 되어 통째 덮기가 됐고, 어법
 *   **91문항의 `original`·`rule` 이 날아갔다**(어휘는 생성기가 둘 다 다시 넣어 무사했다).
 *   루트 CLAUDE.md 가 「덮으면 정답 키가 날아간다」고 못 박은 바로 그 자리다.
 *
 *   그 문항들은 밑줄이 이미 깨끗해서 **밑줄 자로는 다시 안 잡힌다.** 그래서 대상 조건을
 *   둘로 둔다 — 밑줄이 더럽거나, **키가 반쪽이거나**. 재생성은 결정론이라 같은 문단에서
 *   같은 문항이 나오고, 그때 키가 온전히 다시 채워진다.
 */
const hasHalfKey = (type, original) =>
  (type === 'vocab_choice' || type === 'grammar_choice') && !String(original ?? '').trim()

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
      // ⚠️ `payload` 는 통째로 받지 않는다(위 주석). 다만 **`answer_key` 의 `original` 한 칸**은
      //   받는다 — 키가 반쪽인 문항을 찾는 데 필요하고, 문자열 한 개라 전송량이 늘지 않는다.
      .select('id, type, ref_id, paragraph_idx, underlines:payload->underlines, original:answer_key->original')
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
      const badUnderline = (r.underlines ?? []).some((u) => isBadWord(u?.word ?? ''))
      const halfKey = hasHalfKey(r.type, r.original)
      // 고유명사 가드(2026-09-14·15)가 닿아야 할 재고 — 위 `hasCapitalUnderline` 주석 참조.
      const capital = hasCapitalUnderline(r)
      if (badUnderline || halfKey || capital) {
        targets.push({
          id: r.id,
          type: r.type,
          ref_id: r.ref_id,
          paragraph_idx: r.paragraph_idx,
          why: badUnderline ? 'underline' : halfKey ? 'key' : 'capital',
        })
      }
    }
    cursor = data[data.length - 1].id
    if (data.length < 200) break
    if (LIMIT && targets.length >= LIMIT) break
  }
}
const work = LIMIT ? targets.slice(0, LIMIT) : targets
const articleIds = [...new Set(work.map((r) => r.ref_id).filter(Boolean))]
const byWhy = { underline: 0, key: 0 }
for (const r of work) byWhy[r.why] += 1
console.log(
  `  고칠 문항 ${work.length} (밑줄 ${byWhy.underline} · 반쪽 키 ${byWhy.key}) · 읽어야 할 원글 ${articleIds.length}`,
)
if (!work.length) {
  console.log('\n고칠 것이 없다 — 이 밴드의 밑줄과 정답 키가 모두 온전하다.')
  process.exit(0)
}

// ── ①-b 고칠 문항의 **정답 키만** 받아 둔다 ─────────────────────────
// 통째로 덮지 않으려면 **실제로 읽어야 한다.** 고를 때는 `original` 한 칸만 받았고(전송량),
// 쓸 때는 키 전체가 필요하다 — 대상이 정해진 뒤이므로 이때는 받아도 무겁지 않다.
const keyById = new Map()
for (let i = 0; i < work.length; i += 200) {
  const ids = work.slice(i, i + 200).map((r) => r.id)
  const { data, error } = await db.from('csat_dcp_items').select('id, answer_key').in('id', ids)
  if (error) throw new Error('정답 키 조회 실패: ' + error.message)
  for (const r of data ?? []) keyById.set(r.id, r.answer_key ?? {})
}
if (keyById.size !== work.length) {
  // 한 건이라도 못 받았으면 **쓰지 않는다** — 못 받은 것을 빈 객체로 덮으면 그게 이번 사고다.
  throw new Error(`정답 키를 ${work.length} 중 ${keyById.size} 만 받았다 — 덮어쓰기 위험, 중단한다`)
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
      // `answer_key` 를 통째로 덮지 않는다 — **기존 키를 실제로 읽어** 필요한 것만 바꾼다.
      //
      // ⚠️ 여기가 2026-09-13 에 사고가 난 자리다. 주석은 이렇게 적혀 있었는데 조회에
      //   `answer_key` 가 없어 `item.answer_key` 가 늘 `undefined` 였고, 결과는 통째 덮기였다.
      //   **주석이 코드를 지켜 주지 않는다** — 아래 `keyById` 가 실제로 읽은 것이어야 한다.
      const nextKey = { ...(keyById.get(item.id) ?? {}) }
      nextKey.position = built.answer
      // 두 유형 다 「원래 형태」를 키에 남긴다 — 해설 작성기가 그것 없이는 한 줄도 못 쓴다
      //   (`explainVocabChoice`·`explainUnderlinedGrammar` 둘 다 `original` 이 없으면 null).
      nextKey.original = built.original
      // 어법은 **어느 규칙으로 틀렸는지**도 해설의 근거다(관사인지 지시사인지).
      if (item.type === 'grammar_choice' && built.rule) nextKey.rule = built.rule
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
