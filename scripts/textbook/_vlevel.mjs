// scripts/textbook/_vlevel.mjs
//
// **적재 전에 `article_v_level` 을 맞힌다 — 채점자와 같은 산식.**
//
// ── 왜 필요한가 (2026-09-05 실측) ───────────────────────────────────
// MediaWiki 도입부 36편을 FK(Flesch-Kincaid) 칸으로 조준해 넣었더니 목표였던 V1~V3 에는
// **11편만** 들어갔다(V4 10 · V5 12 · V6 3). FK 는 문장 길이와 음절 수로 재고,
// 사다리의 `article_v_level` 은 **글에 쓰인 서로 다른 낱말의 V-Level 75분위**다.
// **둘은 다른 자다.** 조준하는 자와 채점하는 자가 다르면 아무리 잘 조준해도 빗나간다.
//
// ── 채점자 (`compute_article_vrl`) ───────────────────────────────────
//   PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY v_level)
//   FROM (SELECT DISTINCT lav.word, sd.v_level
//         FROM library_article_vocabularies lav
//         JOIN shared_dictionary sd ON sd.word = lav.word
//         WHERE sd.v_level IS NOT NULL AND sd.v_level <> 11)
//
// ── 추정기가 다를 수 있는 지점 ───────────────────────────────────────
// 채점자가 쓰는 `library_article_vocabularies` 는 `extractBookLemmas` 결과를
// `lookupAndEnrich` → `computeLearningValue` 로 한 번 더 거른 것이다. 추정기는 그
// 거르는 단계를 흉내 내지 않는다 — **그래서 검증했다.**
//
//   `vlevel-estimate-probe.mjs` · 정답이 있는 36편 · **정확 일치 36/36 (100%)** · 평균 편차 +0.00칸
//
// 거르는 단계가 75분위를 옮기지 않는다는 뜻이다. 표본이 한 소스뿐이므로 다른 소스를
// 붙일 때는 **다시 대 보고 쓴다** — 100% 는 이 소스에서 잰 값이지 보장이 아니다.

/**
 * `PERCENTILE_DISC(0.75)` — **이산** 백분위다. 보간하지 않는다.
 * 평균이나 연속 백분위로 바꾸면 채점자와 값이 갈린다.
 */
export function p75Disc(sortedAsc) {
  if (!sortedAsc.length) return null
  const idx = Math.ceil(0.75 * sortedAsc.length) - 1
  return sortedAsc[Math.max(0, Math.min(idx, sortedAsc.length - 1))]
}

/**
 * 사전을 **한 번만** 통째로 읽어 `word → v_level` 표로 만든다.
 *
 * 처음에는 글마다 `.in('word', [...])` 로 물었다. 어휘 게이트를 켠 동안에는 그 게이트가
 * 대부분을 앞에서 걸러 줘 호출이 적었는데, **게이트를 끄자 호출이 3배로 늘면서
 * `fetch failed` 가 났다**(2026-09-05). 청크를 400→200 으로 줄이고 3회 재시도를 붙여도
 * 마찬가지였다 — 일시적 장애가 아니라 **글마다 사전을 묻는 방식 자체가 틀렸다.**
 *
 * 사전은 48,969행이고 필요한 것은 두 열뿐이라 한 번에 들고 있을 수 있다.
 * 그러면 글당 조회가 **0** 이 되고, 대조 실험도 마음대로 돌릴 수 있다.
 */
/**
 * **첫 REST 호출을 미리 때려 둔다.**
 *
 * 실측(2026-09-05, 같은 프로세스 안에서 연속 3회):
 *
 *   1회 **105,486ms** · 2회 1,327ms · 3회 **287ms**
 *
 * 프로세스마다 **첫 호출만** 이렇게 느리다(연결 수립 쪽 문제로 보인다). 그동안
 * "사전 적재가 실패한다" 고 본 것들은 전부 **그 첫 호출이 타임아웃한 것**이었다 —
 * 스로틀에 걸린 줄 알고 청크를 줄이고 재시도를 붙였지만 원인이 아니었다.
 * 한 번만 성공시켜 두면 나머지는 빠르다.
 *
 * 실패해도 던지지 않는다. 예열은 편의이지 계약이 아니다 — 진짜 판정은 뒤 단계가 한다.
 */
export async function warmUpRest(db, { attempts = 4 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const t = Date.now()
    const r = await db
      .from('shared_dictionary')
      .select('word')
      .limit(1)
      .then((x) => x, (e) => ({ error: e }))
    if (!r.error) return { ok: true, ms: Date.now() - t, attempts: i + 1 }
  }
  return { ok: false, ms: 0, attempts }
}

export async function loadVLevelMap(db, { pageSize = 1000 } = {}) {
  const map = new Map()
  for (let from = 0; ; from += pageSize) {
    /**
     * **재시도가 필요하다.** 49쪽을 잇달아 받으면 그중 몇 쪽이 `TypeError: fetch failed`
     * 로 떨어진다(2026-09-05 실측). 주소 길이 문제가 아니라 간헐적 연결 실패다 —
     * 처음엔 `.in()` 이 길어서인 줄 알고 청크를 줄였는데 통째 적재에서도 같은 것이 났다.
     * 한 쪽이라도 조용히 빠지면 **사전에 없는 낱말이 되어 글이 실제보다 쉬워 보인다.**
     */
    let data = null
    let lastErr = null
    for (let attempt = 0; attempt < 4; attempt++) {
      const r = await db
        .from('shared_dictionary')
        .select('word, v_level')
        .not('v_level', 'is', null)
        .neq('v_level', 11)
        .order('word', { ascending: true })
        .range(from, from + pageSize - 1)
        .then((x) => x, (e) => ({ data: null, error: e }))
      if (!r.error) {
        data = r.data
        break
      }
      lastErr = r.error
      await new Promise((z) => setTimeout(z, 500 * (attempt + 1)))
    }
    if (data == null) throw new Error(`사전 적재 실패(${from}~): ${lastErr?.message ?? lastErr}`)
    for (const r of data) map.set(r.word, r.v_level)
    if (data.length < pageSize) break
  }
  return map
}

/**
 * 글 하나의 `article_v_level` 을 적재 전에 추정한다. **DB 를 안 부른다.**
 *
 * @param map      `loadVLevelMap` 결과
 * @param extract  `extractBookLemmas`
 * @param content  본문
 * @returns `{ vLevel, matched, lemmas }` — `vLevel` 이 `null` 이면 사전에 걸린 낱말이 없다.
 */
export function estimateArticleVLevel(map, extract, content) {
  const index = extract([{ title: '', content }])
  const lemmas = [...index.bookFrequency.keys()]
  if (!lemmas.length) return { vLevel: null, matched: 0, lemmas: 0 }

  // 채점자는 `DISTINCT lav.word, sd.v_level` 을 센다 — lemma 는 이미 유일하므로
  //   그대로 한 번씩만 담는다.
  const levels = []
  for (const w of lemmas) {
    const v = map.get(w)
    if (v != null) levels.push(v)
  }
  levels.sort((a, b) => a - b)
  return { vLevel: p75Disc(levels), matched: levels.length, lemmas: lemmas.length }
}
