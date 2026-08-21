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
export async function fetchAllIn(db, table, columns, column, values, orderBy) {
  const PAGE = 1000
  const out = []
  for (let i = 0; i < values.length; i += 20) {
    const slice = values.slice(i, i + 20)
    for (let from = 0; ; from += PAGE) {
      let q = db.from(table).select(columns).in(column, slice)
      for (const col of orderBy) q = q.order(col)
      const { data, error } = await q.range(from, from + PAGE - 1)
      if (error) throw new Error(`${table} 조회 실패: ${error.message}`)
      if (!data?.length) break
      out.push(...data)
      if (data.length < PAGE) break
    }
  }
  return out
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
export async function loadVolume(db, { band, unitCount }) {
  const { composeUnits } = await import('@vocaflow/library-pipeline')

  // ── 원글 ──────────────────────────────────────────────────────────
  // 밴드는 **원글** 기준이다. 문항의 `v_level` 로 거르면 조판과 어긋난다.
  const { data: arts, error } = await db
    .from('library_articles')
    .select('id, title, source, article_v_level, display_only')
    .in('status', ['ready', 'published'])
    .eq('article_v_level', band)
    .order('id')
  if (error) throw new Error('기사 조회 실패: ' + error.message)
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
  ).filter((r) => r.kind === 'article' && (r.type === 'order' || r.type === 'insert'))
  const pool = []
  for (const r of itemRows) {
    const a = byId.get(r.ref_id)
    if (!a) continue
    const p = r.payload ?? {}
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

  const { units, stoppedBecause } = composeUnits(pool, vocabByRef, { band, unitCount })
  const itemIds = new Set(units.flatMap((u) => u.items.map((i) => i.id)))

  return { units, stoppedBecause, pool, articles: byId, vocabByRef, itemIds }
}
