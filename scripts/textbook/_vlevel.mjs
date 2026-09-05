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
 * 글 하나의 `article_v_level` 을 적재 전에 추정한다.
 *
 * @param db        service-role Supabase 클라이언트
 * @param extract   `extractBookLemmas`
 * @param content   본문
 * @returns `{ vLevel, matched, lemmas }` — `vLevel` 이 `null` 이면 사전에 걸린 낱말이 없다.
 */
export async function estimateArticleVLevel(db, extract, content) {
  const index = extract([{ title: '', content }])
  const lemmas = [...index.bookFrequency.keys()]
  if (!lemmas.length) return { vLevel: null, matched: 0, lemmas: 0 }

  const levels = []
  const CHUNK = 400
  for (let i = 0; i < lemmas.length; i += CHUNK) {
    const { data, error } = await db
      .from('shared_dictionary')
      .select('word, v_level')
      .in('word', lemmas.slice(i, i + CHUNK))
      .not('v_level', 'is', null)
      .neq('v_level', 11)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) levels.push(r.v_level)
  }
  levels.sort((a, b) => a - b)
  return { vLevel: p75Disc(levels), matched: levels.length, lemmas: lemmas.length }
}
