// scripts/textbook/elementary-audit.mjs
//
// **초등 3종의 검수 — 표본이 아니라 전수다.**
//
// ── 왜 이 자리가 따로 있어야 하나 (실측 2026-09-13) ─────────────────
// 초등 3종(`rhyme`·`word_meaning`·`spell_blank`)은 사전에서 **즉석 생성**되어
// `csat_dcp_items` 에 행이 없다(`ref_id` 가 NOT NULL 이다). `csat_item_reviews.item_id` 가
// 그 행을 가리키므로 **3인 검수를 걸 대상 자체가 없다** — 발행 게이트가 그 몫을
// 「못 잼」으로 적는 이유다(`publish-gate.ts` 의 `unreviewableItems`).
//
// 그 구멍을 마이그레이션으로 메우려다 멈췄다. 이 유형들은 **결정론 생성기**이고
// 재료는 교육과정 별표 낱말이다. 그런 것의 검증은 사람 셋이 60문항을 눈으로 보는 것보다
// **모든 낱말 × 모든 유형을 기계가 다 보는 것**이 강하다 — 표본이 아니라 전수이기 때문이다.
//
// 그리고 이것이 옳다는 증거가 이미 있다. 같은 날 지면 문항을 손으로 읽어 결함 둘을 찾았는데
// **둘 다 문항이 아니라 생성기의 결함**이었다:
//   · 운율 발문이 「소리가 같은」 — 정답은 각운이 같을 뿐이다(20문항 전부)
//   · 철자 완성 해설이 「낱말이 하나뿐」 — 별표 안에서만 참이었다(706 중 275 = 39%)
// 한 문항을 고칠 일이 아니라 한 줄을 고칠 일이었다. **전수가 맞는 자다.**
//
// ⚠️ **이 자가 3인 검수를 대신한다고 적지 않는다.** 기계가 못 보는 것이 있다 —
//   뜻풀이가 초등 독자에게 자연스러운지, 소재가 그 나이에 맞는지. 그것은 사람 몫으로 남는다.
//   여기서 잡는 것은 **규칙으로 판정할 수 있는 것 전부**다.
//
// 재실행 안전: 읽기만 한다. 아무것도 쓰지 않는다.
//
// 실행:
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/elementary-audit.mjs
//   ... --tag kcurr2022_1      ← 한 별표만
//   ... --show 12              ← 사유별로 몇 건까지 예시를 찍을지 (기본 5)

import { loadEnv, fetchAllKeyset } from './volume-pool.mjs'

loadEnv()

const arg = (n, fallback = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const SHOW = Number(arg('show', '5'))
const ONLY_TAG = arg('tag', null)

/** 별표 — `volume-pool.ELEMENTARY_TAG` 과 같은 값이다(눈금을 둘로 만들지 않는다). */
const TAGS = ONLY_TAG ? [ONLY_TAG] : ['kcurr2022_1', 'kcurr2022_2']

const { createClient } = await import('@supabase/supabase-js')
const { buildRhyme, buildSpellBlank, buildWordMeaning, countMatching, firstSense } = await import(
  '@vocaflow/library-pipeline'
)

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 사전 전체 ────────────────────────────────────────────────────────
// 철자 완성의 분모다. **별표가 아니다** — 별표 안에서만 유일한 것은 영어에서 유일하지 않다.
const dictRows = await fetchAllKeyset(db, 'shared_dictionary', 'word', 'word', 1000)
const FULL = new Set(
  dictRows.map((r) => String(r.word ?? '').toLowerCase()).filter((w) => /^[a-z]{3,8}$/.test(w)),
)
console.log(`사전 ${FULL.size.toLocaleString()}낱말 (3~8글자)`)

/**
 * 판정 하나.
 *
 * ⚠️ **통과를 세지 않고 위반을 센다.** 「몇 건 봤는가」와 「몇 건이 나빴는가」를 함께 내야
 *   0 이 「깨끗하다」인지 「안 봤다」인지 갈린다 — 이 저장소가 여러 번 당한 자리다.
 */
const RULES = {
  // ── 운율 ────────────────────────────────────────────────────────
  'rhyme/정답이 정확히 하나': (it, ctx) => {
    const keys = it.choices.map((c) => ctx.rhymeKeyOf.get(c.text) ?? null)
    const n = keys.filter((k) => k && k === ctx.word.rhymeKey).length
    return n === 1 ? null : `끝소리가 같은 보기 ${n}개`
  },
  'rhyme/정답이 제시어 자신이 아니다': (it, ctx) =>
    it.answerText === ctx.word.word ? '정답이 제시어와 같은 낱말' : null,
  'rhyme/제시어가 보기에 없다': (it, ctx) =>
    it.choices.some((c) => c.text === ctx.word.word) ? '제시어가 보기에 들어 있다' : null,
  'rhyme/보기가 서로 다르다': (it) =>
    new Set(it.choices.map((c) => c.text)).size === it.choices.length ? null : '보기 중복',
  // ⚠️ `make`/`makes` 는 소리가 같지만 **철자를 보고 고르므로** 학습이 아니라 눈치가 된다.
  //   생성기 주석이 이 위험을 적어 두었으니 실제로 막히는지 전수로 확인한다.
  //
  // ⚠️⚠️ **이 규칙은 지금 재고에서 한 번도 발동하지 않는다 — 「위반 0」을 근거로 쓰지 말 것.**
  //   굴절형은 각운 키가 달라지기 때문이다(`make` `-eɪk` vs `makes` `-eɪks`). 실측 2026-09-14:
  //   별표 안에서 「한쪽이 다른 쪽의 접두이면서 각운 키가 같은」 쌍이 **0쌍**이다.
  //   그러니 이것은 검사된 성질이 아니라 **앞으로를 위한 보험**이다. 각운 키 생성이 바뀌어
  //   굴절형이 한 무리로 묶이는 날 여기서 걸린다. 그 사실을 안 적으면 다음 사람이
  //   「굴절형은 이미 검증됐다」고 읽는다.
  'rhyme/정답이 제시어의 굴절형이 아니다': (it, ctx) => {
    const a = it.answerText
    const s = ctx.word.word
    if (a === s) return null // 위 규칙이 따로 잡는다
    const long = a.length >= s.length ? a : s
    const short = a.length >= s.length ? s : a
    if (!long.startsWith(short)) return null
    const tail = long.slice(short.length)
    return /^(s|es|ed|d|ing|er|est)$/.test(tail) ? `굴절형 쌍 ${s} / ${a}` : null
  },

  // ── 뜻 고르기 ────────────────────────────────────────────────────
  'word_meaning/정답 뜻이 보기에 하나': (it) => {
    const n = it.choices.filter((c) => c.text === it.answerText).length
    return n === 1 ? null : `정답 뜻이 보기에 ${n}개`
  },
  'word_meaning/보기가 서로 다르다': (it) =>
    new Set(it.choices.map((c) => c.text)).size === it.choices.length ? null : '보기 중복',
  'word_meaning/뜻이 비어 있지 않다': (it) =>
    it.choices.every((c) => c.text && c.text.trim()) ? null : '빈 보기',
  // 오답 뜻을 가진 **다른 낱말**이 제시어의 뜻도 가지면 답이 둘이 된다.
  //   생성기는 유의어와 문자열 겹침을 보는데, **역방향**(다른 낱말이 제시어와 같은 뜻)은
  //   보기 풀에서 걸러진 뒤라 확인이 필요하다.
  'word_meaning/오답 뜻이 제시어의 뜻이 아니다': (it, ctx) => {
    const bad = it.choices
      .filter((c) => c.text !== it.answerText)
      .filter((c) => (ctx.sensesOfWord.get(ctx.word.word) ?? new Set()).has(c.text))
    return bad.length ? `오답 "${bad[0].text}" 가 제시어의 다른 뜻이다` : null
  },

  // ── 철자 완성 ────────────────────────────────────────────────────
  // **이 규칙이 오늘 실제로 깨져 있었다** — 분모가 별표 808낱말이었다.
  'spell_blank/사전 전체에서 답이 하나': (it) => {
    const pattern = it.stem.split(' ').join('')
    const n = countMatching(pattern, FULL)
    return n === 1 ? null : `사전에 답이 ${n}개`
  },
  'spell_blank/빈칸이 첫·끝 글자가 아니다': (it) => {
    const pattern = it.stem.split(' ').join('')
    const at = pattern.indexOf('_')
    return at > 0 && at < pattern.length - 1 ? null : '빈칸이 첫 글자이거나 마지막 글자'
  },
  'spell_blank/뜻 힌트가 있다': (it, ctx) =>
    firstSense(ctx.word.meaningKo) ? null : '뜻 힌트가 비었다',
  'spell_blank/빈칸이 하나다': (it) => {
    const pattern = it.stem.split(' ').join('')
    const n = pattern.split('').filter((c) => c === '_').length
    return n === 1 ? null : `빈칸 ${n}개`
  },
}

let grandSeen = 0
let grandBad = 0

for (const tag of TAGS) {
  const rows = await fetchAllKeyset(
    db,
    'shared_dictionary',
    'word, meaning_ko, rhyme_key, synonyms',
    'word',
    1000,
    (q) => q.contains('list_tags', [tag]),
  )
  const pool = rows
    .map((r) => ({
      word: String(r.word).toLowerCase(),
      meaningKo: String(r.meaning_ko ?? ''),
      rhymeKey: r.rhyme_key || null,
      synonyms: r.synonyms ?? [],
    }))
    .filter((x) => /^[a-z]{2,12}$/.test(x.word) && x.meaningKo)

  if (!pool.length) {
    console.log(`\n${tag} — 낱말 0. 별표가 비었거나 태그가 틀렸다.`)
    continue
  }

  const rhymeKeyOf = new Map(pool.map((w) => [w.word, w.rhymeKey]))
  /** 낱말 → 그 낱말이 가진 **모든** 뜻 갈래. 역방향 충돌을 보는 데 쓴다. */
  const sensesOfWord = new Map(
    pool.map((w) => [
      w.word,
      new Set(
        w.meaningKo
          .split(/[;,·/]|\s\d[.)]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ]),
  )

  const built = []
  for (const w of pool) {
    const r = buildRhyme(w, pool)
    if (r) built.push([r, w])
    const m = buildWordMeaning(w, pool)
    if (m) built.push([m, w])
    const s = buildSpellBlank(w, FULL)
    if (s) built.push([s, w])
  }

  const violations = new Map()
  let seen = 0
  for (const [it, word] of built) {
    seen++
    const ctx = { word, rhymeKeyOf, sensesOfWord }
    for (const [name, check] of Object.entries(RULES)) {
      if (!name.startsWith(`${it.kind}/`)) continue
      const why = check(it, ctx)
      if (!why) continue
      if (!violations.has(name)) violations.set(name, [])
      violations.get(name).push(`${word.word} — ${why}`)
    }
  }

  const badItems = new Set()
  for (const list of violations.values()) for (const v of list) badItems.add(v.split(' — ')[0])

  console.log(`\n── ${tag} — 낱말 ${pool.length.toLocaleString()} · 만든 문항 ${seen.toLocaleString()}`)
  const byKind = {}
  for (const [it] of built) byKind[it.kind] = (byKind[it.kind] ?? 0) + 1
  console.log(
    `   유형별 ${Object.entries(byKind)
      .sort()
      .map(([k, n]) => `${k} ${n}`)
      .join(' · ')}`,
  )
  if (!violations.size) {
    console.log('   ✅ 규칙 위반 0 — 전수로 봤다(표본이 아니다)')
  } else {
    const total = [...violations.values()].reduce((n, v) => n + v.length, 0)
    console.log(`   ❌ 규칙 위반 ${total.toLocaleString()}건 · 문항 ${badItems.size.toLocaleString()}개`)
    for (const [name, list] of [...violations.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`     ${name} — ${list.length.toLocaleString()}`)
      for (const e of list.slice(0, SHOW)) console.log(`        ${e}`)
      if (list.length > SHOW) console.log(`        … 그 밖 ${(list.length - SHOW).toLocaleString()}`)
    }
  }
  grandSeen += seen
  grandBad += badItems.size
}

console.log(
  `\n전수 ${grandSeen.toLocaleString()}문항 · 규칙 위반 문항 ${grandBad.toLocaleString()}` +
    (grandBad ? '' : ' — 규칙으로 판정할 수 있는 것은 전부 깨끗하다'),
)
// ⚠️ **기계가 못 보는 것이 남는다.** 뜻풀이가 초등 독자에게 자연스러운지, 소재가 그 나이에
//   맞는지는 여기서 판정하지 않는다 — 「위반 0」을 「검수 완료」로 읽지 않는다.
console.log('※ 규칙 밖(뜻풀이의 자연스러움 · 나이 적합)은 여전히 사람 몫이다.')
process.exit(grandBad ? 1 : 0)
