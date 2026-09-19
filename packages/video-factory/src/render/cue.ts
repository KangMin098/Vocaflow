// packages/video-factory/src/render/cue.ts
//
// **자막 큐 나누기 — 컷 하나가 큐 하나일 필요는 없다.**
//
// ── 왜 필요한가 (실측 2026-09-13) ──────────────────────────────────
// 지금까지는 컷 하나에 큐 하나를 냈다. 컷 길이는 **나레이션 실측 길이**가 정하므로,
// 말이 길면 큐도 길어진다 — 269컷 중 **15컷이 7초를 넘었다**(최대 8.1초).
// Netflix Timed Text Style Guide 는 자막 한 건의 노출을 **최대 7초**로 못 박는다.
// 그보다 길면 시청자가 다 읽고 나서 같은 글을 다시 읽기 시작하고, 그 순간 화면과 어긋난다.
//
// ── 왜 이제야 제대로 나눌 수 있나 ─────────────────────────────────
// Edge TTS 가 **낱말 경계 타임스탬프**를 준다(`VoiceClip.words`). 이 데이터는 처음부터
// 있었는데 쓰이지 않았고, 문서에도 「데이터는 있는데 안 씀」으로 적혀 있었다.
// 그게 있으면 큐를 **말이 실제로 끊기는 자리**에서 나눌 수 있다 — 글자 수로 나누면
// 소리는 아직 그 낱말을 말하는 중인데 자막만 넘어간다.
//
// ── 나누지 못하는 경우 ────────────────────────────────────────────
// 나레이션이 자막과 다른 문장이면 낱말 눈금을 자막에 맞댈 수 없다. 그때는 **글자 수 비례**로
// 나눈다 — 완벽하지 않지만 7초짜리 큐 하나보다 낫고, 무엇보다 **지어낸 눈금이 아니다.**

import { MAX_CAPTION_SEC, MIN_CAPTION_SEC } from '../spec/timing'
import type { WordMark } from '../voice/timing'

export interface Cue {
  /** 컷 시작으로부터의 초. */
  start: number
  end: number
  text: string
}

/**
 * 큐 하나가 담을 수 있는 최대 길이(초).
 *
 * Netflix 의 7초에서 한 프레임 정도를 뺀 값이 아니라 **7초 그대로**를 상한으로 쓰되,
 * 나눌 개수를 정할 때는 이 값으로 나눈 뒤 올림한다 — 그러면 모든 조각이 상한 안에 든다.
 */
export const CUE_MAX_SEC = MAX_CAPTION_SEC

/**
 * 몇 조각으로 나눌 것인가.
 *
 * 길이만 보는 게 아니라 **읽기 속도**도 본다 — 3초짜리 컷에 80자를 얹으면 7초 규칙은
 * 지켜도 읽을 수가 없다. 두 제약 중 **더 많이 쪼개라는 쪽**을 따른다.
 */
export function cueCount(totalSec: number, textLength: number, cps: number): number {
  if (totalSec <= 0 || textLength === 0) return 1
  const byTime = Math.ceil(totalSec / CUE_MAX_SEC)
  const bySpeed = Math.ceil(textLength / cps / totalSec)
  const n = Math.max(1, byTime, bySpeed)
  // **조각이 최소 노출보다 짧아지면 안 된다.** 더 쪼개면 규격을 다른 쪽으로 어긴다.
  const maxPieces = Math.max(1, Math.floor(totalSec / MIN_CAPTION_SEC))
  return Math.min(n, maxPieces)
}

/** 공백으로 끊은 토막. 낱말 안에서는 절대 자르지 않는다(한글이든 영문이든). */
function tokens(text: string): string[] {
  return text.split(/\s+/).filter((t) => t.length > 0)
}

/**
 * 자막 낱말이 나레이션 눈금과 맞는가.
 *
 * 낱말 개수가 같아야만 1:1 로 맞댈 수 있다. 하나라도 어긋나면 **맞다고 가정하지 않는다** —
 * 어긋난 눈금으로 나누면 자막이 엉뚱한 자리에서 넘어가고, 그건 안 나눈 것보다 나쁘다.
 */
export function marksAlign(text: string, words: WordMark[] | undefined): boolean {
  if (!words || words.length === 0) return false
  return tokens(text).length === words.length
}

/**
 * 큐를 나눈다. 나눌 필요가 없으면 한 개짜리 배열을 돌려준다.
 *
 * @param text     이 컷의 자막
 * @param start    컷이 시작하는 절대 시각(초)
 * @param totalSec 컷 길이(초)
 * @param cps      읽기 속도 상한 (학습자 13 · 광고 17)
 * @param words    나레이션 낱말 눈금. 자막과 낱말 수가 같을 때만 쓴다.
 */
export function splitCaption(
  text: string,
  start: number,
  totalSec: number,
  cps: number,
  words?: WordMark[],
): Cue[] {
  const clean = text.trim()
  if (clean === '' || totalSec <= 0) return []

  const n = cueCount(totalSec, clean.length, cps)
  if (n === 1) return [{ start, end: start + totalSec, text: clean }]

  const parts = tokens(clean)
  if (parts.length < 2) {
    // 낱말이 하나면 나눌 수가 없다. 쪼개면 낱말이 깨진다 — 규격보다 뜻이 먼저다.
    return [{ start, end: start + totalSec, text: clean }]
  }

  const pieces = Math.min(n, parts.length)
  const aligned = marksAlign(clean, words)

  // 낱말을 조각에 고르게 나눈다. 앞 조각이 한 낱말 더 갖게 해 **마지막이 외톨이가 되지 않게** 한다.
  const per = Math.ceil(parts.length / pieces)
  const groups: string[][] = []
  for (let i = 0; i < parts.length; i += per) groups.push(parts.slice(i, i + per))

  const out: Cue[] = []
  let consumed = 0
  for (const [gi, g] of groups.entries()) {
    const isLast = gi === groups.length - 1
    let cueStart: number
    let cueEnd: number

    if (aligned && words) {
      // **말이 실제로 끊기는 자리**에서 나눈다.
      const firstWord = words[consumed]
      const lastWord = words[consumed + g.length - 1]
      cueStart = gi === 0 ? start : start + (firstWord?.at ?? 0)
      cueEnd = isLast
        ? start + totalSec
        : start + ((lastWord ? lastWord.at + lastWord.dur : totalSec) || totalSec)
    } else {
      // 눈금을 못 맞대면 **글자 수 비례**로 나눈다 — 지어낸 값이 아니라 관측 가능한 근사다.
      const before = groups.slice(0, gi).reduce((s, x) => s + x.join(' ').length + 1, 0)
      const here = g.join(' ').length
      const total = clean.length
      cueStart = start + (before / total) * totalSec
      cueEnd = isLast ? start + totalSec : start + ((before + here) / total) * totalSec
    }
    consumed += g.length

    // 순서가 뒤집히거나 겹치지 않게 — 플레이어는 겹친 큐를 예측 불가로 그린다.
    const prev = out[out.length - 1]
    if (prev && cueStart < prev.end) cueStart = prev.end
    if (cueEnd <= cueStart) cueEnd = Math.min(start + totalSec, cueStart + MIN_CAPTION_SEC)

    out.push({ start: cueStart, end: cueEnd, text: g.join(' ') })
  }

  // 마지막 큐는 컷 끝에 정확히 붙인다 — 반올림 오차가 쌓여 컷 경계를 넘으면 다음 컷 자막과 겹친다.
  const last = out[out.length - 1]
  if (last) last.end = start + totalSec
  return out
}
