// packages/library-pipeline/src/textbook/excerpt.ts
//
// **긴 이야기에서 그 학년 칸에 드는 조각을 떼어 낸다.**
//
// ── 왜 필요한가 (실측 2026-09-02) ────────────────────────────────────
// 학년 칸(FK)과 어수창을 **동시에** 만족하는 후보를 세니 **초5~6 이 표본 400건 중 0건**이었다.
//
//     초3~4 1,056 · **초5~6 0** · 초6~중1 7,493 · 중1~2 65,313 · 중3 59,427
//
// 왜 0인지 열어 보니 원인이 난이도가 아니라 **길이**였고, 그것도 두 갈래였다:
//
//     이야기(StoryWeaver·ASB)   FK 3.5~5.5 인 글이 137~2,787어 — **너무 길다**
//     백과(Vikidia·SimpleWiki)  같은 FK 대의 도입부가 10~39어  — **너무 짧다**
//
// **그 학년 난이도의 글은 이미 있다. 없는 것은 그 난이도이면서 그 길이인 덩어리다.**
// 이 파일이 앞의 갈래(너무 긴 이야기)를 맡는다.
//
// ── 두 가지를 반드시 지킨다 ──────────────────────────────────────────
//
// **① 문단(쪽) 경계에서만 자른다.** 문장 중간에서 자르면 지문이 아니라 조각이다.
//    그림책은 쪽마다 문단이 나뉘어 있어 경계가 이미 있다.
//
// **② 자른 뒤 다시 잰다.** 발췌는 난이도를 바꾼다 — 실측으로 **평균 −0.43 ·
//    최소 −3.74 · 최대 +2.05** 움직였다. 원본 FK 로 칸을 정하면 세 칸까지 어긋난다:
//
//        What's Neema Eating Today?  원본 5.03 → 발췌 1.29
//        Annual Haircut Day          원본 5.32 → 발췌 7.37
//
//    그래서 이 함수는 원본 FK 를 **보지 않는다.** 후보 조각을 만들고 그 조각을 잰다.
//
// 실측 수율: StoryWeaver L2·L3 28권 중 26권이 창에 드는 조각을 냈고
// 그중 8권이 초5~6 칸이었다(28.6%).

import { READING_LEVEL_BANDS, readability, type ReadingLevelBand } from './readability'

export interface ExcerptCandidate {
  /** 떼어 낸 글. */
  text: string
  /** 몇 번째 문단부터 몇 번째까지인가(0-based, `end` 는 미포함). */
  start: number
  end: number
  words: number
  fk: number
  band: string
  /**
   * 이야기 첫머리인가. **첫머리가 아니면 대명사가 설명 없이 나온다** —
   * 지문으로 쓸 수는 있지만 첫머리 쪽이 낫고, 그 사실을 숨기지 않는다.
   */
  fromOpening: boolean
}

const countWords = (t: string) => (t.match(/[A-Za-z][A-Za-z'-]*/g) || []).length

/**
 * 문단 배열에서 목표 칸에 드는 조각을 찾는다. **첫머리를 먼저 본다.**
 *
 * 첫머리 조각이 칸에 들면 그것을 쓴다. 안 들면 뒤쪽의 이어진 문단 묶음도 본다 —
 * 재고를 0으로 만드는 것보다는 낫지만, `fromOpening: false` 로 표시해 둔다.
 *
 * @param paragraphs 문단(그림책이면 쪽) 순서대로. 빈 문단은 건너뛴다.
 * @param band 목표 학년 칸.
 * @param options.allowMidStory 첫머리가 아닌 조각도 받을지. 기본 `true`.
 */
export function excerptForBand(
  paragraphs: readonly string[],
  band: ReadingLevelBand,
  options: { allowMidStory?: boolean } = {}
): ExcerptCandidate | null {
  const allowMid = options.allowMidStory ?? true
  const parts = paragraphs.map((p) => String(p ?? '').trim())
  const n = parts.length
  if (!n) return null

  let fallback: ExcerptCandidate | null = null

  for (let start = 0; start < n; start++) {
    if (!parts[start]) continue
    // 첫머리가 아닌 시작점은 허용할 때만 본다.
    if (start > 0 && !allowMid) break

    let acc = ''
    for (let end = start; end < n; end++) {
      const p = parts[end]
      if (!p) continue
      acc = acc ? `${acc} ${p}` : p
      const words = countWords(acc)
      if (words < band.wordsMin) continue
      // 창을 넘겼으면 이 시작점에서는 더 볼 것이 없다 — 문단을 더하면 더 길어질 뿐이다.
      if (words > band.wordsMax) break

      // **여기서 다시 잰다.** 원본이 아니라 이 조각을 잰다 — 그게 이 함수의 요점이다.
      const r = readability(acc)
      if (!r) continue
      const candidate: ExcerptCandidate = {
        text: acc,
        start,
        end: end + 1,
        words,
        fk: r.fk,
        band: band.id,
        fromOpening: start === 0,
      }
      if (r.fk >= band.fkMin && r.fk <= band.fkMax) {
        // 첫머리 조각이면 즉시 채택. 아니면 첫머리 후보를 더 찾아본 뒤 쓴다.
        if (candidate.fromOpening) return candidate
        fallback ??= candidate
      }
    }
  }
  return fallback
}

export interface ExcerptFit extends ExcerptCandidate {
  /** 원본이 어느 칸이었나 — 발췌가 칸을 얼마나 옮겼는지 보이려고 함께 낸다. */
  sourceFk: number | null
  /** 발췌가 FK 를 움직인 폭. 실측 범위는 −3.74 ~ +2.05. */
  fkShift: number | null
}

/**
 * **어느 칸이든** 좋으니 이 이야기가 채울 수 있는 칸을 찾는다.
 *
 * 소스를 통째로 훑을 때 쓴다 — 책마다 "이 책은 어느 학년 자리에 맞는가" 를 묻는 쪽이,
 * "이 책을 초5~6 으로 만들 수 있는가" 를 묻는 것보다 수율이 높다.
 * 목표 칸이 정해져 있으면 `excerptForBand` 를 직접 쓴다.
 *
 * 칸을 고르는 순서는 `READING_LEVEL_BANDS` 순(쉬운 쪽부터)이다 — **먼저 드는 칸을 쓴다.**
 * 창이 겹치므로(초3~4 와 초5~6 이 3.5~4.0 에서 겹친다) 순서가 결과를 정한다.
 */
export function fitExcerptToAnyBand(
  paragraphs: readonly string[],
  options: { allowMidStory?: boolean; bands?: readonly ReadingLevelBand[] } = {}
): ExcerptFit | null {
  const bands = options.bands ?? READING_LEVEL_BANDS
  const sourceFk = readability(paragraphs.join(' '))?.fk ?? null
  for (const band of bands) {
    const c = excerptForBand(paragraphs, band, options)
    if (c)
      return { ...c, sourceFk, fkShift: sourceFk == null ? null : +(c.fk - sourceFk).toFixed(2) }
  }
  return null
}
