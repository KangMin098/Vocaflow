// scripts/textbook/volume-pool.mjs
//
// **한 권에 실릴 문항을 고르는 자리 — 하나뿐이어야 한다.**
//
// ── 왜 모듈로 뽑았나 ─────────────────────────────────────────────────
// `render-volume.mjs`(조판)와 `explain-drain-export.mjs`(해설 몫 뽑기)가 각자 풀을 만들었고,
// 주석에는 "같은 조합 규칙을 쓴다" 고 적혀 있었지만 **실제로는 달랐다.** 실측 결과 셋이 어긋났다:
//
//   1. 밴드 거르는 자리 — 조판은 `library_articles.article_v_level`(원글), 드레인은
//      `csat_dcp_items.v_level`(문항). 문항 밴드가 원글과 다른 것이 섞이면 다른 책이 나온다.
//   2. 어휘 맵 — 조판은 `composeUnits` 에 단원 어휘를 넘기고 드레인은 빈 Map 을 넘겼다.
//      `composeUnits` 는 어휘를 조합에 쓰므로 넘기고 안 넘기고가 **고르는 문항을 바꾼다.**
//   3. `display_only` 원글 제외 — 조판만 걸렀다.
//
// 그 결과 드레인이 겨냥한 80 과 조판이 실은 80 이 2문항 어긋나, 해설을 62건 다 채웠는데도
// 책은 78/80 으로 나왔다. 숫자가 작아 눈치채기 어려웠다 — **드리프트는 티가 안 난다.**
// 그래서 규칙을 한 벌만 두고 양쪽이 이것을 부른다.
//
// 재실행 안전: 읽기만 한다.

import fs from 'node:fs'
import path from 'node:path'

/**
 * PostgREST 는 **한 응답에 1000행까지만** 준다 — `.limit(20000)` 을 붙여도 넘지 못한다(실측).
 *
 * ⚠️ 이걸 모르면 조용히 틀린다. 어휘를 원글 5편씩 묶어 `.limit(20000)` 으로 물었더니
 *   한 배치가 1000행에서 잘려 **뒤쪽 원글이 "어휘 0" 으로 보였다.** 그 허수를 근거로
 *   "어휘 없는 글 52편" 이라는 결론을 냈고, 없는 갭을 메우려고 57편을 재분석했다.
 *   재분석은 밴드를 다시 계산하므로 **이미 완성한 권의 구성이 흔들렸다.**
 *   측정이 틀리면 고치는 일이 망가뜨리는 일이 된다.
 *
 * 그래서 `.in()` 조회는 전부 이 함수를 통한다 — 다 받을 때까지 `range` 로 넘긴다.
 *
 * @param values `.in()` 에 넣을 값들. 20개씩 나눠 묻는다(URL 길이 때문).
 * @param orderBy `range` 페이징이 성립하려면 정렬이 고정돼야 한다.
 */
/**
 * 조건이 `.in()` 이 아닌 조회를 **끝까지** 받는다.
 *
 * PostgREST 는 요청 크기와 무관하게 1000행에서 자른다. `.limit(20000)` 을 적어도 소용없다.
 * 그래서 `range()` 로 실제로 넘겨 받는다 — **정렬이 고정돼야** 페이지가 겹치거나 새지 않는다.
 *
 * @param build 질의를 만드는 함수. `db` 를 받아 `.from(...).select(...)...` 를 돌려준다.
 */
/**
 * 일시적 실패를 다시 시도한다 — **몇 천 행짜리 조회는 언젠가 반드시 한 번 끊긴다.**
 *
 * 2026-08-30 하루에 세 가지가 다 나왔다:
 *   · `Could not query the database for the schema cache`  (다른 세션이 마이그레이션을 적용하는 중)
 *   · `canceling statement due to statement timeout`        (본문까지 싣는 조회가 커서)
 *   · Cloudflare **525**(SSL handshake failed)                (연결이 끊김)
 * 세 번째는 `store-new-types --band 5` 를 통째로 죽였다 — 3,408편을 다 읽고 나서였다.
 *
 * ⚠️ **읽기에만 쓴다.** 쓰기를 재시도하면 중복이 생길 수 있다(적재는 유일키가 막지만
 *   그건 적재 쪽의 계약이지 여기서 보장할 일이 아니다).
 * ⚠️ 영구 오류(권한·문법)는 재시도해도 같으므로 **네 번 만에 포기하고 그대로 던진다** —
 *   조용히 빈 배열을 돌려주면 "재고 0" 이라는 거짓말이 된다.
 */
export async function withRetry(label, run, tries = 4) {
  let lastErr
  for (let i = 0; i < tries; i += 1) {
    const { data, error } = await run()
    if (!error) return data
    lastErr = error
    const msg = String(error.message ?? '')
    const transient =
      /schema cache|statement timeout|525|timeout|fetch failed|socket|ECONN|EAI_AGAIN|handshake/i.test(msg)
    if (!transient) break
    // 1s → 3s → 9s. 끊긴 쪽이 회복할 시간을 준다.
    const wait = 1000 * 3 ** i
    console.error(`  ↻ ${label} 재시도 ${i + 1}/${tries - 1} (${wait / 1000}s) — ${msg.slice(0, 80)}`)
    await new Promise((r) => setTimeout(r, wait))
  }
  throw new Error(`${label} 조회 실패: ${lastErr?.message ?? '알 수 없음'}`)
}

export async function fetchAllPaged(db, build, page = 1000) {
  const out = []
  for (let from = 0; ; from += page) {
    const data = await withRetry('페이지', () => build(db).range(from, from + page - 1))
    if (!data?.length) break
    out.push(...data)
    if (data.length < page) break
  }
  return out
}

export async function fetchAllIn(db, table, columns, column, values, orderBy, apply) {
  const PAGE = 1000
  const out = []
  for (let i = 0; i < values.length; i += 20) {
    const slice = values.slice(i, i + 20)
    for (let from = 0; ; from += PAGE) {
      let q = db.from(table).select(columns).in(column, slice)
      // 추가 조건(`kind`·`type` 같은)을 붙이는 자리. 호출부가 제 손으로 페이징을 다시
      // 짜지 않게 하려고 둔다 — 그렇게 다시 짠 사본들이 전부 `.limit(20000)` 이었다.
      if (apply) q = apply(q)
      for (const col of orderBy) q = q.order(col)
      const data = await withRetry(table, () => q.range(from, from + PAGE - 1))
      if (!data?.length) break
      out.push(...data)
      if (data.length < PAGE) break
    }
  }
  return out
}

/**
 * 단원의 뼈대를 이루는 결정론 유형. 한 단원은 이 넷으로 시작한다(순서 2 + 삽입 2).
 */
export const CORE_TYPES = new Set(['order', 'insert'])

/**
 * 지문 하나를 통째로 묻는 생성형 유형 — Claude Code 드레인이 쓴다.
 *
 * ⚠️ **뼈대에 끼워 넣지 않고 덧붙인다.** 뼈대를 바꾸면 이 유형이 아직 없는 밴드의 권이
 *   통째로 줄어든다(지금은 V3 에만 있다). 있으면 더 실리고 없으면 그대로 — 그래야
 *   이미 완성된 다섯 권이 후퇴하지 않는다.
 */
export const EXTRA_TYPES = new Set([
  'gist', 'main_point', 'topic', 'title', 'blank', 'purpose', 'claim', 'mood', 'implication', 'summary', 'content_match',
  // 장문 ② 서사문(43~45). **지문 길이 창이 다르다**(260~400어) — 조합기가
  // `compose-unit.itemWordSpec` 으로 유형마다 자를 갈라 댄다. 이 목록에서 빠지면
  // 문항이 풀에 들어오지도 못해 "적재는 됐는데 책에는 없다" 가 된다.
  'long_order', 'long_reference', 'long_match',
  // 장문 ① 설명문(41~42). 같은 긴 창을 쓴다.
  'long_title', 'long_vocab',
])

/**
 * 학교 시험 축 — 중등 내신 유형. 지문이 `sentences`(문단) 또는 `stem`(문장 하나)에 있다.
 *
 * ⚠️ 이 갈래가 없던 동안 **13,351문항이 어느 권에도 안 실렸다.** 생성형에서 똑같은 일이
 *   한 번 있었는데(위 EXTRA_TYPES 주석), 같은 실수가 더 큰 규모로 반복돼 있었다.
 *   재료·조합·조판 셋이 다 열려야 학습자에게 닿는다.
 */
export const SCHOOL_TYPES = new Set([
  'unit_vocab', 'unit_grammar', 'grammar_choice', 'vocab_choice',
  'blank_word', 'grammar_fix', 'word_order',
])

/**
 * 초등 저학년 3종 — **사전에서 나온다. 원글이 없다.**
 *
 * ⚠️ 그래서 `csat_dcp_items` 에 저장되지 않는다(`ref_id` 가 NOT NULL 이다).
 *   `store-new-types.mjs` 머리말도 "초등 3종은 순수 함수로 남는다" 고 적어 두었다.
 *   그 결과 **사다리 1단이 책이 되지 않았다** — 실측 2026-08-30: V1 조합 0단원.
 *   재료는 있었다(교육과정 별표 808낱말). 없던 것은 **적재·조판 경로**였다.
 *
 * 저장하지 않고 **조판 시점에 만든다.** 결정론이라 같은 사전이면 같은 문항이 나오고,
 * 마이그레이션도 필요 없다. 원글이 없으므로 `ref_id` 자리에는 **낱말**을 넣는다 —
 * 조합기의 "한 단원 안에서 같은 출처를 두 번 쓰지 않는다" 규칙이 그대로 성립한다
 * (같은 낱말로 두 문항을 내지 않는다).
 */
export const ELEMENTARY_TYPES = new Set(['rhyme', 'word_meaning', 'spell_blank'])

/** 교육과정 별표 태그 — 밴드별 어휘 풀. */
const ELEMENTARY_TAG = { 1: 'kcurr2022_1', 2: 'kcurr2022_1' }

/**
 * 사전에서 초등 문항 풀을 만든다. 밴드가 별표를 안 쓰면 빈 배열.
 */
async function loadElementaryPool(db, band) {
  const tag = ELEMENTARY_TAG[band]
  if (!tag) return []
  const { buildRhyme, buildSpellBlank, buildWordMeaning, explainElementary } = await import('@vocaflow/library-pipeline')

  const rows = await fetchAllPaged(db, (q) =>
    q
      .from('shared_dictionary')
      .select('word, meaning_ko, rhyme_key, synonyms')
      .contains('list_tags', [tag])
      .order('word'))

  const pool = rows
    .map((r) => ({
      word: String(r.word).toLowerCase(),
      meaningKo: String(r.meaning_ko ?? ''),
      rhymeKey: r.rhyme_key || null,
      synonyms: r.synonyms ?? [],
    }))
    .filter((x) => /^[a-z]{2,12}$/.test(x.word) && x.meaningKo)

  const dictionary = new Set(pool.map((x) => x.word))
  const items = []
  for (const w of pool) {
    for (const [type, built] of [
      ['rhyme', buildRhyme(w, pool)],
      ['word_meaning', buildWordMeaning(w, pool)],
      ['spell_blank', buildSpellBlank(w, dictionary)],
    ]) {
      if (!built) continue
      items.push({
        // 저장된 문항이 아니므로 id 는 합성한다 — 같은 사전이면 같은 값이다.
        id: `elem:${type}:${w.word}`,
        type,
        ref_id: `word:${w.word}`,
        ref_title: w.word,
        v_level: band,
        // 지문이 없다. 길이 규격을 재는 자리이므로 물음+보기를 텍스트로 삼는다.
        passage_text: `${built.promptKo} ${built.stem}`,
        passage_words: 0,
        body_sentences: 1,
        payload: {
          prompt_ko: built.promptKo,
          stem: built.stem,
          choices: built.choices,
          answer_text: built.answerText,
        },
        // 해설도 여기서 붙인다 — 저장되지 않는 유형이라 `explain-fill` 이 닿지 않는다.
        // 안 붙이면 V1 한 권 120문항이 해설 0 이 된다(실측 2026-08-30).
        answer_key: {
          ...(built.answer > 0 ? { answer: built.answer } : { text: built.answerText }),
          ...(() => {
            const e = explainElementary(type, built.stem, built.choices, built.answer, built.answerText)
            return e ? { explanation_ko: e.ko, explanation_writer: e.writer } : {}
          })(),
        },
      })
    }
  }
  return items
}

/** `apps/web/.env.local` 을 process.env 에 얹는다. 이미 있는 키는 덮지 않는다. */
export function loadEnv() {
  for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

/**
 * 한 권의 재료를 통째로 읽어 조합까지 끝낸다.
 *
 * @returns `{ units, stoppedBecause, pool, articles, vocabByRef, itemIds }`
 *   `itemIds` 는 그 권에 **실제로 실릴** 문항 id 집합이다 — 드레인이 겨냥할 대상.
 */
// ⚠️ `marketMix` 기본값은 **켬**이다 (2026-08-30 변경).
//    끄고 조판하면 재고에 많은 유형이 그대로 실려 시중 구성과 크게 어긋난다 — 실측:
//      V5 20단원 · 끔  유형-학년 적합도 **31.3%** (order 40 + insert 40 = 120문항의 67%)
//      V5 20단원 · 켬  유형-학년 적합도 **67.4%**
//    시장에 맞는 책을 만드는 것이 옵트인일 이유가 없다. 끄려면 `--no-market-mix`.
export async function loadVolume(db, { band, unitCount, marketMix = true }) {
  const { composeUnits, rungMix } = await import('@vocaflow/library-pipeline')

  // ── 원글 ──────────────────────────────────────────────────────────
  // 밴드는 **원글** 기준이다. 문항의 `v_level` 로 거르면 조판과 어긋난다.
  //
  // ⚠️ **페이징 없이 읽으면 안 된다.** 밴드 하나가 1,000편을 넘는다 —
  //   실측 2026-08-30: V5 **3,055편** · V6 **2,339편**. 페이징이 없던 동안
  //   이 두 밴드의 권과 해설 드레인이 **앞 1,000편만 보고** 만들어지고 있었다.
  //   (같은 함정에 이 저장소가 다섯 번째다. 그래서 `scan-unpaged-queries.mjs` 를 만들었다.)
  const arts = await fetchAllPaged(db, (q) =>
    q
      .from('library_articles')
      .select('id, title, source, article_v_level, display_only')
      .in('status', ['ready', 'published'])
      .eq('article_v_level', band)
      .order('id'))
  // `display_only` 는 표시만 허용된 원글이다 — 문항으로 실을 수 없다.
  const usable = (arts ?? []).filter((a) => !a.display_only)
  const byId = new Map(usable.map((a) => [a.id, a]))
  const ids = [...byId.keys()]

  // ── 문항 ──────────────────────────────────────────────────────────
  const itemRows = (
    await fetchAllIn(
      db,
      'csat_dcp_items',
      'id, type, ref_id, payload, answer_key, v_level, kind',
      'ref_id',
      ids,
      ['id'],
    )
  ).filter(
    (r) => r.kind === 'article'
      && (CORE_TYPES.has(r.type) || EXTRA_TYPES.has(r.type) || SCHOOL_TYPES.has(r.type)),
  )
  const pool = []
  for (const r of itemRows) {
    const a = byId.get(r.ref_id)
    if (!a) continue
    const p = r.payload ?? {}
    // ── 생성형 유형은 지문이 통째로 payload 에 있다 ──────────────────
    // ⚠️ 이걸 안 넣으면 **문항을 만들어도 책에 안 실린다.** 실제로 그랬다 —
    //   생성형 64문항을 넣고도 조합기가 못 봐서 권은 그대로였다.
    if (EXTRA_TYPES.has(r.type)) {
      const passage = String(p.passage ?? '')
      pool.push({
        id: r.id,
        type: r.type,
        ref_id: r.ref_id,
        ref_title: a.title,
        v_level: r.v_level,
        passage_text: passage,
        passage_words: passage.split(/\s+/).filter(Boolean).length,
        body_sentences: passage.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 1).length,
        payload: p,
        answer_key: r.answer_key ?? {},
      })
      continue
    }
    // ── 학교 시험 축은 지문이 `sentences`(문단) 또는 `stem`/`context`(문장)에 있다 ──
    if (SCHOOL_TYPES.has(r.type)) {
      const lines = Array.isArray(p.sentences) ? p.sentences.map(String) : []
      const text = lines.length ? lines.join(' ') : String(p.stem ?? p.context ?? '')
      if (!text.trim()) continue
      pool.push({
        id: r.id,
        type: r.type,
        ref_id: r.ref_id,
        ref_title: a.title,
        v_level: r.v_level,
        passage_text: text,
        passage_words: text.split(/s+/).filter(Boolean).length,
        body_sentences: lines.length || 1,
        payload: p,
        answer_key: r.answer_key ?? {},
      })
      continue
    }
    const sentences = r.type === 'order' ? (p.presented ?? []) : (p.remaining ?? [])
    const text = [...sentences, p.insert_sentence].filter(Boolean).join(' ')
    pool.push({
      id: r.id,
      type: r.type,
      ref_id: r.ref_id,
      ref_title: a.title,
      v_level: r.v_level,
      passage_text: text,
      passage_words: text.split(/\s+/).filter(Boolean).length,
      body_sentences: sentences.length,
      payload: p,
      answer_key: r.answer_key ?? {},
    })
  }

  // ── 단원 어휘 ─────────────────────────────────────────────────────
  // `composeUnits` 가 이걸 조합에 쓴다 — 빈 Map 을 넘기면 **다른 문항이 뽑힌다.**
  // 원글 한 편이 1,000행을 넘기도 한다(Photosynthesis 1,072) — `fetchAllIn` 이 넘긴다.
  const vocabRows = await fetchAllIn(
    db,
    'library_article_vocabularies',
    'library_article_id, word, first_sentence, frequency_in_article',
    'library_article_id',
    ids,
    ['library_article_id', 'word'],
  )
  const words = [...new Set(vocabRows.map((v) => v.word))]
  const dictRows = await fetchAllIn(db, 'shared_dictionary', 'word, meaning_ko, v_level', 'word', words, ['word'])
  const dict = new Map()
  for (const r of dictRows) dict.set(r.word, r)
  vocabRows.sort(
    (a, b) =>
      a.library_article_id.localeCompare(b.library_article_id) ||
      (b.frequency_in_article ?? 0) - (a.frequency_in_article ?? 0) ||
      a.word.localeCompare(b.word),
  )
  const vocabByRef = new Map()
  for (const v of vocabRows) {
    const d = dict.get(v.word)
    if (!vocabByRef.has(v.library_article_id)) vocabByRef.set(v.library_article_id, [])
    vocabByRef.get(v.library_article_id).push({
      word: v.word,
      meaning_ko: d?.meaning_ko ?? null,
      v_level: d?.v_level ?? null,
      first_sentence: v.first_sentence ?? null,
      frequency_in_article: v.frequency_in_article ?? 0,
    })
  }

  // `marketMix` 를 켜면 유형 구성을 시장 밀도에 맞춘다(`rungMix`).
  // 기본은 꺼져 있다 — 이미 완성된 권이 조용히 달라지면 안 된다.
  // 초등 저학년 3종은 사전에서 나온다 — 원글 풀과 합친다.
  pool.push(...(await loadElementaryPool(db, band)))

  const mix = marketMix
    ? rungMix(band, new Set(pool.map((it) => it.type)))
    : null
  const { units, stoppedBecause, rejected } = composeUnits(pool, vocabByRef, {
    band,
    unitCount,
    ...(mix ? { targetShare: mix.targetShare, itemsPerUnit: 6 } : {}),
  })
  const itemIds = new Set(units.flatMap((u) => u.items.map((i) => i.id)))

  return { units, stoppedBecause, rejected, mix, pool, articles: byId, vocabByRef, itemIds }
}
