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
//      ⚠️ 여기 오래 "어휘가 고르는 문항을 바꾼다" 고 적혀 있었으나 **지금 코드는 아니다** —
//      `compose-unit.ts` 에서 `vocabByRef` 는 문항을 다 고른 뒤 `refsInUnit` 으로만 조회된다.
//      두 방식으로 조판해 **HTML 이 바이트까지 같음을 실측했다**(2026-08-31). 그 성질을
//      아래 §단원 어휘 의 예행 조합이 쓴다. 남은 차이는 1·3 이다.
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
/**
 * ⚠️ **기다리는 것만으로는 안 된다 — 덜 물어보는 것이 답이다.**
 *
 * statement timeout 은 "지금 바쁘다" 가 아니라 "이 요청이 이 부하에서 너무 크다" 는 뜻이다.
 * 실측 2026-08-31: 같은 500행 질의가 한가할 때 0.2초, 배치 둘이 돌 때 네 번 연속 timeout.
 * 그래서 재시도마다 페이지를 절반으로 줄인다. `run` 은 지금 쓸 크기를 인자로 받는다.
 *
 * 줄인 크기는 호출부가 이어서 쓴다(`page` 를 돌려준다) — 다시 키우면 같은 자리에서 또 걸린다.
 */
export async function withRetry(label, run, tries = 4, page = null, pageMin = 25) {
  let lastErr
  let size = page
  for (let i = 0; i < tries; i += 1) {
    const { data, error } = await run(size)
    if (!error) return page == null ? data : { data, page: size }
    lastErr = error
    const msg = String(error.message ?? '')
    // ⚠️ 게이트웨이는 **오류를 HTML 페이지로** 돌려준다 — 그때 message 는 문장이 아니라
    //   `<!DOCTYPE html>…` 통째다. 위 낱말들만 보면 그게 안 걸려 **재시도 없이 죽는다**
    //   (실측 2026-08-31: content 를 1,000행씩 받다가 페이지당 11MB 가 되어 524 가 났는데
    //    한 번도 재시도하지 않고 배치가 끝났다).
    const transient =
      /schema cache|statement timeout|525|timeout|fetch failed|socket|ECONN|EAI_AGAIN|handshake/i.test(msg) ||
      /<html|<!doctype|error code:\s*5\d\d|\b50[234]\b|\b52[0-4]\b/i.test(msg)
    if (!transient) break
    if (i === tries - 1) break
    // 무거워서 끊긴 것이면 더 기다려도 같다 — 페이지를 절반으로.
    if (size != null) size = Math.max(pageMin, Math.floor(size / 2))
    // 1s → 3s → 9s. 끊긴 쪽이 회복할 시간도 준다.
    const wait = 1000 * 3 ** i
    console.error(
      `  ↻ ${label} 재시도 ${i + 1}/${tries - 1} (${wait / 1000}s` +
        (size != null ? ` · 페이지 ${size}` : '') +
        `) — ${msg.slice(0, 70)}`,
    )
    await new Promise((r) => setTimeout(r, wait))
  }
  throw new Error(`${label} 조회 실패: ${lastErr?.message ?? '알 수 없음'}`)
}

/**
 * 전수 조회를 **커서(keyset)** 로 넘긴다 — 표가 커져도 페이지 비용이 일정하다.
 *
 * ⚠️ `fetchAllPaged`(= OFFSET)는 표가 커지면 **자가 부러진다.** OFFSET 은 건너뛸 행을
 *   매번 처음부터 세므로 깊은 페이지가 통째로 느려진다. 실측 2026-08-31 —
 *   `csat_dcp_items` 42만 행에서 `offset 400000 limit 500` 의 **실행 시간 97.6초**
 *   (`explain analyze`: 인덱스 스캔이 400,500행을 훑는다). 그래서 페이지를 500 → 25 로
 *   줄여도 살아나지 않는다. 오히려 같은 오프셋 비용을 더 여러 번 낸다.
 *
 *   그 때문에 `item-health-report.mjs`(검수 도구)가 **아예 안 도는 상태**였다.
 *
 * 정렬은 커서 컬럼 하나로 고정한다 — `order(col)` 과 `gt(col, …)` 가 같은 정렬을 써야
 * 페이지가 겹치거나 새지 않는다(uuid 는 바이트 순으로 둘이 일치한다).
 *
 * @param build `(q, cursor)` 를 받아 질의를 만든다. 커서 조건은 이 함수가 붙인다.
 * @param col   커서로 쓸 컬럼. 유일하고 정렬 가능해야 한다(보통 pk).
 */
export async function fetchAllKeyset(db, table, columns, col = 'id', page = 1000, apply) {
  const out = []
  let cursor = null
  for (;;) {
    const at = cursor
    const data = await withRetry(`${table} 커서`, () => {
      let q = db.from(table).select(columns).order(col).limit(page)
      if (apply) q = apply(q)
      if (at != null) q = q.gt(col, at)
      return q
    })
    if (!data?.length) break
    out.push(...data)
    if (data.length < page) break
    cursor = data[data.length - 1][col]
    if (cursor == null) break
  }
  return out
}

export async function fetchAllPaged(db, build, page = 1000) {
  const out = []
  let size = page
  let from = 0
  for (;;) {
    const res = await withRetry('페이지', (n) => build(db).range(from, from + n - 1), 4, size)
    const data = res.data
    // 줄어든 크기를 이어서 쓴다 — 다시 키우면 같은 자리에서 또 걸린다.
    size = res.page
    if (!data?.length) break
    out.push(...data)
    if (data.length < size) break
    from += size
  }
  return out
}

/**
 * `.in()` 한 번에 넣는 값의 수 — **실측으로 정했다(2026-08-30).**
 *
 * V6 원글 600편의 문항 키를 묶음 크기별로 받아 보니:
 *
 *   묶음  20   1,129ms · 요청 30 · 행 3,950   ← 이전 값
 *   묶음  50     406ms · 요청 12 · 행 3,950
 *   묶음 **100**  282ms · 요청  6 · 행 3,950   ← **4배 빠르고 행 수가 같다**
 *   묶음 200     178ms · 요청  3 · 행 2,987   ← 한 묶음이 1000행을 넘겨 **잘렸다**
 *
 * 200 의 행 손실은 이 함수의 문제가 아니라 계측 스크립트가 페이징을 안 해서 난 것이지만,
 * **묶음이 커질수록 한 묶음이 1000행을 넘길 확률이 오른다** — 이 저장소가 세 번 밟은 함정이
 * 바로 그것이다. 아래 `range` 루프가 그것을 받아 내지만, 여유를 두어 100 으로 잡는다.
 * (UUID 100개면 URL 약 3.8KB — 실측 엔드포인트에서 통과했다.)
 *
 * ⚠️ 20 은 원글이 늘수록 비용이 선형으로 는다. V6 원글이 하루 만에 6천 → **10,808편**이
 *   되자 이 조회만 541회 왕복이 됐다.
 */
// `VOCAFLOW_IN_CHUNK` 로 덮어쓸 수 있다 — **묶음 크기가 산출물을 바꾸지 않는다는 것을
// 실제로 확인하기 위한 손잡이다.** 아래 전역 정렬이 그 성질을 보장하는데, 보장한다고
// 적어 두는 것과 두 크기로 돌려 같은 책이 나오는 것을 보는 것은 다르다.
const IN_CHUNK = Number(process.env.VOCAFLOW_IN_CHUNK) || 100

export async function fetchAllIn(db, table, columns, column, values, orderBy, apply) {
  const out = []
  // 한 번 줄인 페이지는 이 호출 내내 유지한다 — 다시 키우면 같은 자리에서 또 걸린다.
  let size = 1000
  for (let i = 0; i < values.length; i += IN_CHUNK) {
    const slice = values.slice(i, i + IN_CHUNK)
    let from = 0
    for (;;) {
      // ⚠️ **질의를 매 시도마다 새로 만든다.** PostgREST 빌더는 한 번 await 하면 결과가
      //   붙박이라, 같은 객체를 다시 await 해도 새 요청이 나가지 않는다 — 재시도가
      //   같은 실패를 즉시 되풀이할 뿐이다(2026-08-31 실측).
      const build = (n) => {
        let q = db.from(table).select(columns).in(column, slice)
        // 추가 조건(`kind`·`type` 같은)을 붙이는 자리. 호출부가 제 손으로 페이징을 다시
        // 짜지 않게 하려고 둔다 — 그렇게 다시 짠 사본들이 전부 `.limit(20000)` 이었다.
        if (apply) q = apply(q)
        for (const col of orderBy) q = q.order(col)
        return q.range(from, from + n - 1)
      }
      const res = await withRetry(table, build, 4, size)
      const data = res.data
      size = res.page
      if (!data?.length) break
      out.push(...data)
      if (data.length < size) break
      from += size
    }
  }
  // ⚠️ **묶음 안에서만 정렬하면 배열 순서가 묶음 크기에 딸린다.**
  //   `.order()` 는 각 요청 안에서만 듣고, 묶음끼리는 그냥 이어 붙는다. 그래서 묶음을
  //   20 → 100 으로 바꿨더니 **같은 재고인데 다른 책이 나왔다** — 실측 2026-08-30 V3:
  //   적합도(97.7%)와 자동 검수(9/9)는 같은데 한 권이 쓴 원글이 32 → 41편이 되어
  //   카탈로그가 6권 → 4권으로 보였다. 조합기가 이 배열 순서로 문항을 고르기 때문이다.
  //
  //   묶음 크기는 **성능 손잡이**여야 하고 산출물을 바꾸면 안 된다. 마지막에 전역으로
  //   한 번 더 정렬해 그 의존을 끊는다 — 이제 20이든 100이든 같은 책이 나온다.
  const cmp = (a, b) => {
    for (const col of orderBy) {
      const x = a?.[col]
      const y = b?.[col]
      if (x === y) continue
      if (x == null) return -1
      if (y == null) return 1
      return x < y ? -1 : 1
    }
    return 0
  }
  return orderBy.length ? out.sort(cmp) : out
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
  // 흐름 무관(35번) — `compose-unit.EXTRA_ITEM_TYPES` 와 **짝이어야 한다.** 한쪽만
  //   있으면 풀에는 들어오는데 조합이 안 집거나 그 반대가 된다. 둘 다 없던 동안
  //   1,479문항이 어느 권에도 안 실렸다(실측 2026-08-31).
  'irrelevant',
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
  // 낱말 → 뜻. 단원 어휘를 만들 때 되쓴다(사전을 두 번 읽지 않는다).
  const meanings = new Map(pool.map((x) => [x.word, x.meaningKo]))
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
  return { items, meanings }
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
/**
 * 철회·취하된 논문인가 — **제목으로만 알 수 있다.**
 *
 * 재고에 `RETRACTED:` 로 시작하는 원글이 16편 있고 그중 10편에 이미 문항 268개가
 * 붙어 있었다(한 편은 120개, 실측 2026-08-31). 철회된 연구를 지문으로 실으면 교재의
 * 신뢰가 통째로 깎이는데, **지문 자체는 멀쩡히 읽히므로 자동 검수로는 안 걸린다.**
 *
 * ⚠️ 조판과 드레인이 각각 거르면 한쪽만 고쳐지고 드리프트가 난다 — 판정은 여기 하나다.
 * 행을 지우지는 않는다. 재고에서 막으면 인쇄도 제작도 같이 막힌다.
 *
 * 철회를 **다룬** 글("Retraction studies in ethics")은 통과해야 한다 — 그래서 앞머리를 본다.
 */
export function isRetractedTitle(title) {
  const t = String(title ?? '').trim()
  return /^(retracted|withdrawn)/i.test(t) || t.toLowerCase().includes('[retracted')
}

export async function loadVolume(db, { band, unitCount, marketMix = true }) {
  const {
    composeUnits,
    rungMix,
    stripSectionLabels,
    dropRepeatedTail,
    normalizeQuotes,
    pairStraightQuotes,
    stripSpaceBeforePunct,
    dropDuplicatedLeadWord,
  } = await import('@vocaflow/library-pipeline')

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
  //
  // ⚠️ **철회된 논문도 뺀다.** 재고에 `RETRACTED:` 로 시작하는 원글이 16편 있고
  //   그중 10편에 이미 문항 268개가 붙어 있었다(한 편은 120개, 실측 2026-08-31).
  //   철회된 연구를 지문으로 실으면 교재의 신뢰가 통째로 깎인다 — 지문 자체는
  //   멀쩡히 읽히므로 자동 검수로는 절대 안 걸린다. **제목에서 막는 수밖에 없다.**
  //   행은 지우지 않는다 — 여기서 막으면 조판도 드레인도 같은 풀을 쓰므로 충분하다.
  const usable = (arts ?? []).filter((a) => !a.display_only && !isRetractedTitle(a.title))
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
  // ── 절 이름 정제 ──────────────────────────────────────────────────
  // 학술 원문의 절 이름은 자기 줄에 홀로 서 있다가, 문장으로 자른 뒤 공백으로 다시
  // 이으면 첫 문장에 붙는다 — "Abstract The coexistence of…". 실측 2026-08-31:
  // 절 이름이 붙은 문항 **28,652개**(V6 20,050 · V7 5,700 · V5 2,881).
  //
  // ⚠️ **버리지 않고 지운다.** 절 이름을 근거로 지문을 버리면 상위 밴드 재고가 통째로
  //   날아간다. 오탐은 실측했다 — 학술 소스가 없는 V3·V4 지문 4,452개 중 **0개**가
  //   바뀌었다(문장을 여는 자리 + 뒤가 대문자일 때만 지우기 때문).
  //
  // 저장은 그대로 두고 **인쇄에 쓰는 사본만** 고친다 — 재생성이 필요 없다.
  // ⚠️ **순서가 중요하다.** 절 이름을 먼저 지워야 반복 꼬리가 글머리와 글자 그대로
  //   같아진다. 뒤집으면 꼬리가 "Abstract The Amazon…" 이라 접두사 대조가 실패하고
  //   중복이 그대로 인쇄된다.
  // ⚠️ **순서는 안에서 밖으로 읽는다.** 절 이름 → 반복 꼬리 → 눌어붙은 제목 →
  //   구두점 앞 공백 → 따옴표. 제목 제거를 꼬리 절단보다 뒤에 두는 이유는, 꼬리 대조가
  //   **글머리와 글자 그대로** 같은지를 보기 때문이다 — 글머리를 먼저 손대면 대조가 깨진다.
  const clean = (v) =>
    typeof v === "string"
      ? pairStraightQuotes(
          normalizeQuotes(stripSpaceBeforePunct(dropDuplicatedLeadWord(dropRepeatedTail(stripSectionLabels(v))))),
        )
      : v
  const cleanPayload = (raw) => {
    if (!raw || typeof raw !== "object") return raw
    const out = { ...raw }
    for (const k of ["passage", "intro", "stem", "context", "insert_sentence", "summary_sentence"]) {
      if (typeof out[k] === "string") out[k] = clean(out[k])
    }
    for (const k of ["sentences", "presented", "remaining", "choices"]) {
      if (Array.isArray(out[k])) out[k] = out[k].map(clean)
    }
    return out
  }

  const pool = []
  for (const r of itemRows) {
    const a = byId.get(r.ref_id)
    if (!a) continue
    const p = cleanPayload(r.payload ?? {})
    // ── 생성형 유형은 지문이 통째로 payload 에 있다 ──────────────────
    // ⚠️ 이걸 안 넣으면 **문항을 만들어도 책에 안 실린다.** 실제로 그랬다 —
    //   생성형 64문항을 넣고도 조합기가 못 봐서 권은 그대로였다.
    // ── 흐름 무관(35번)은 지문이 `intro` + `sentences` 에 있다 ──
    //
    // ⚠️ EXTRA_TYPES 에 넣기만 하면 `p.passage` 가 undefined 라 낱말 수가 0 으로 잡히고
    //   조합기가 "너무 짧다" 로 **전량 버린다.** 풀에는 들어오는데 책에는 안 나온다 —
    //   실측 2026-08-31: 목록에 넣고 조판했더니 풀 +312, 인쇄 0 이었다.
    if (r.type === 'irrelevant') {
      const lines2 = Array.isArray(p.sentences) ? p.sentences.map(String) : []
      const text = [String(p.intro ?? ''), ...lines2].filter(Boolean).join(' ')
      if (!text.trim() || lines2.length !== 5) continue
      pool.push({
        id: r.id,
        type: r.type,
        ref_id: r.ref_id,
        ref_title: a.title,
        v_level: r.v_level,
        passage_text: text,
        passage_words: text.split(/\s+/).filter(Boolean).length,
        body_sentences: lines2.length,
        payload: p,
        answer_key: r.answer_key ?? {},
      })
      continue
    }
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
        passage_words: text.split(/\s+/).filter(Boolean).length,
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
  //
  // ⚠️ **어휘는 문항 선택에 관여하지 않는다.** 예전 주석은 "빈 Map 을 넘기면 다른 문항이
  //   뽑힌다" 고 적고 있었는데 지금 코드는 그렇지 않다 — `compose-unit.ts` 에서
  //   `vocabByRef` 는 **문항을 다 고른 뒤** `refsInUnit` 으로만 조회된다(단원 낱말 목록을
  //   만드는 데만 쓴다). 그래서 **두 번 조합해도 같은 책이 나온다.**
  //
  // 그 성질을 써서 어휘를 **이 권이 실제로 쓰는 원글에만** 묻는다:
  //   1) 빈 Map 으로 한 번 조합해 쓸 원글을 알아낸다(순수 CPU, 조회 없음)
  //   2) 그 30~50편의 어휘만 받는다
  //   3) 같은 옵션으로 다시 조합한다 — 문항은 같고 낱말 목록만 채워진다
  //
  // 왜 필요한가 — 실측 2026-08-31(V6): pool 의 원글 11,698편치 어휘 **7,989,857행**을
  // 1,000행씩 8,000번 왕복해 받고 있었다. 조판 한 번이 22분이었다. 한 권이 쓰는 원글은
  // 50편 안팎이다.
  //
  // 원글 한 편이 1,000행을 넘기도 한다(Photosynthesis 1,072) — `fetchAllIn` 이 넘긴다.
  // ⚠️ **문항이 없는 원글의 어휘는 받을 필요가 없다 — 읽히지 않는다.**
  //   `composeUnits` 는 `pool` 의 문항만 순회하며 `vocabByRef` 를 `ref_id` 로 조회한다.
  //   그런데 여기서는 **밴드의 모든 원글**(`ids`)의 어휘를 받고 있었다. 실측 2026-08-30 V6:
  //
  //     원글 11,368편 · 어휘 **7,396,262행** · **490초**   ← 조판 시간의 전부
  //
  //   10단원 한 권은 원글을 30~50편 쓴다. 코퍼스의 63%가 문항 0개인데 그 어휘까지 받았다.
  //   pool 에 있는 원글로 좁힌다 — **산출물은 바뀔 수 없다**(없는 문항은 못 고른다).
  //   `VOCAFLOW_VOCAB_ALL=1` 이면 옛 방식(밴드 전체)으로 돌린다 — **같은 시점에 두 방식을
  //   비교해 산출물이 같은지 확인하기 위한 손잡이다.** 데이터가 계속 바뀌는 저장소라
  //   "전에 잰 값과 다르다" 만으로는 원인을 못 가른다.
  // 초등 저학년 3종은 사전에서 나온다 — 원글 풀과 합친다.
  const { items: elementary, meanings: elementaryMeaning } = await loadElementaryPool(db, band)
  pool.push(...elementary)

  const mix = marketMix
    ? rungMix(band, new Set(pool.map((it) => it.type)))
    : null

  // 두 조합이 **글자 그대로 같은 옵션**을 써야 같은 문항이 나온다 — 한 번만 만든다.
  const composeOpts = {
    band,
    unitCount,
    ...(mix ? { targetShare: mix.targetShare, itemsPerUnit: 6 } : {}),
  }
  // 1) 빈 Map 으로 예행 — 어떤 원글을 쓰는지만 알아낸다.
  const dry = composeUnits(pool, new Map(), composeOpts)
  const usedRefs = [...new Set(dry.units.flatMap((u) => u.items.map((i) => i.ref_id)))]

  // `VOCAFLOW_VOCAB_ALL=1` 이면 옛 방식(밴드 전체)으로 돌린다 — **같은 시점에 두 방식을
  // 비교해 산출물이 같은지 확인하기 위한 손잡이다.** 데이터가 계속 바뀌는 저장소라
  // "전에 잰 값과 다르다" 만으로는 원인을 못 가른다.
  // `VOCAFLOW_VOCAB_POOL=1` 은 그 중간 — pool 전체(예행 이전 방식).
  const poolRefs = process.env.VOCAFLOW_VOCAB_ALL
    ? ids
    : process.env.VOCAFLOW_VOCAB_POOL
      ? [...new Set(pool.map((it) => it.ref_id).filter((r) => byId.has(r)))]
      : usedRefs.filter((r) => byId.has(r))
  const vocabRows = await fetchAllIn(
    db,
    'library_article_vocabularies',
    // ⚠️ **`first_sentence` 를 받지 않는다.** 조합기(`pickVocabulary`)는 `meaning_ko` 와
    //   `frequency_in_article` 로만 고르고, 조판물의 어휘 표는 낱말+뜻만 인쇄한다.
    //   받아서 `vocabByRef` 까지 실어 나르지만 **아무도 읽지 않는다.**
    //   실측 2026-08-31(V6): 어휘 7,989,857행 중 이 컬럼만 **1,166 MB** 를 네트워크로
    //   끌어오고 있었다. 조판이 10분씩 걸린 주된 이유다.
    //   (발행 경로는 다르다 — `select_article_vocab` → `publish_article_word_set` 가
    //    이 값을 `shared_words.source_sentence` 로 복사한다. 컬럼 자체는 지우면 안 된다.)
    'library_article_id, word, frequency_in_article',
    'library_article_id',
    poolRefs,
    ['library_article_id', 'word'],
  )
  const words = [...new Set(vocabRows.map((v) => v.word))]
  // 낱말이 많으면 **사전을 통째로 받는 편이 싸다.** 사전은 48,969행뿐이라 1,000행씩
  // 49회면 끝나는데, 낱말별로 묶어 물으면 낱말 수에 비례해 요청이 는다.
  //   실측 2026-08-30 (V6 · 고유 낱말 100,694개):
  //     묶어 조회  25,297행 · **38.5초**
  //     통째로     48,969행 · **10.6초**   ← 3.6배 빠르다
  // 통째로 받으면 안 쓰는 낱말도 들어오지만 **조회되지 않으므로 산출물은 같다**
  // (아래 `dict` 는 `vocabRows` 의 낱말로만 읽힌다).
  const DICT_ROWS = 48_969
  const dictRows =
    words.length * 10 > DICT_ROWS
      ? await fetchAllPaged(db, (q) => q.from('shared_dictionary').select('word, meaning_ko, v_level').order('word'))
      : await fetchAllIn(db, 'shared_dictionary', 'word, meaning_ko, v_level', 'word', words, ['word'])
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
      frequency_in_article: v.frequency_in_article ?? 0,
    })
  }

  // ⚠️ **초등 저학년 권은 단원 어휘가 통째로 비어 있었다** (실측 2026-08-31).
  //   `vocabByRef` 는 `library_article_vocabularies` 에서만 만들어지는데, 이 3종은
  //   원글이 아니라 **사전**에서 나오므로 그 표에 행이 없다. 결과: V1 한 권의
  //   10단원이 전부 어휘 0 개였고, 채점기의 "어휘가 고르다" 는 목표를 데이터에서
  //   끌어오는 탓에 **9/9 통과**로 찍혔다(`scorecard.ts` 같은 자리 주석 참조).
  //
  //   재료는 이미 문항 안에 있다 — `ref_id` 가 `word:<낱말>` 이고 사전에서 뜻을 받아 왔다.
  //   시중 초등 교재도 단원마다 낱말 목록을 싣는다. 그래서 그 낱말을 어휘로 되돌려준다.
  //   (문항과 같은 낱말이지만 인쇄물에서는 **문항과 단어장이 다른 자리**다.)
  for (const it of elementary) {
    if (vocabByRef.has(it.ref_id)) continue
    const word = it.ref_title
    const meaning = elementaryMeaning.get(word)
    if (!word || !meaning) continue
    vocabByRef.set(it.ref_id, [{ word, meaning_ko: meaning, v_level: band, frequency_in_article: 1 }])
  }

  // `marketMix` 를 켜면 유형 구성을 시장 밀도에 맞춘다(`rungMix`).
  // 기본은 꺼져 있다 — 이미 완성된 권이 조용히 달라지면 안 된다.
  // 3) 예행과 **같은 옵션**으로 다시 조합한다 — 문항은 같고 낱말 목록만 채워진다.
  const { units, stoppedBecause, rejected } = composeUnits(pool, vocabByRef, composeOpts)
  const itemIds = new Set(units.flatMap((u) => u.items.map((i) => i.id)))

  return { units, stoppedBecause, rejected, mix, pool, articles: byId, vocabByRef, itemIds }
}
