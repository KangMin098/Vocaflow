// apps/web/src/lib/csat/passage-map-model.ts
//
// **지문 지도의 판단부 — 화면이 아니라 여기서 정한다.**
//
// 이 저장소는 컴포넌트를 `renderToString` 으로만 검사한다(@testing-library 가 없다).
// 그래서 «칩을 눌렀을 때 어느 막대가 열리는가» 같은 것을 컴포넌트에 두면 **검사할 길이
// 없어진다.** 판단을 순수 함수로 빼면 클릭 한 번마다의 결과를 전부 검사할 수 있다.
// (저장소의 `order-model`/`order-view` · `series-model`/`series-view` 와 같은 가름이다.)
//
// `server-only` 를 들이지 않는다 — 화면이 값으로 부른다.

import type { AnchorOrigin, SkeletonSentence } from './passage-skeleton'

export interface MapAnchor {
  /** 골격의 anchorId 와 같아야 한다. 'answer' · 'reject:2' */
  id: string
  /** 칩에 쓰는 짧은 이름. '③' · '①' */
  label: string
  kind: 'answer' | 'reject'
  detail?: string | null
  /** 이 오답이 왜 끌리는가. kind === 'reject' 일 때만. */
  tempting?: string | null
  /**
   * 칠해진 자리의 **출처**. `'tempt'` 면 그 자리는 이 선지를 **지우지 않는다** —
   * 이 선지로 **끌어당긴다**(골격이 「지우는 근거」에서 위치를 못 찾아 「끌리는 이유」에서
   * 찾은 경우). 없으면 예전 골격이라 `'reject'` 로 읽는다.
   * 화면이 이 값을 무시하면 미끼 자리를 «지우는 근거» 라고 부르게 된다.
   */
  origin?: AnchorOrigin
}

export interface MapPlacement {
  id: string
  /** 빈 배열 = 근거를 못 찾았다. */
  sentences: number[]
}

/** 지금 화면이 그려야 할 것 전부. */
export interface MapState {
  active: MapAnchor | null
  /** 열린 문장 번호. */
  lit: number[]
  /** 고른 근거의 위치를 못 찾았는가 — 화면이 그 사실을 말해야 한다. */
  notFound: boolean
}

/** 앵커 목록에서 처음 고를 것. **정답 근거를 먼저 세운다.** */
export function initialAnchorId(anchors: MapAnchor[]): string | null {
  // 오답부터 보여 주면 "내가 왜 틀렸나" 로 시작해 자책이 앞선다(철학 3 Empathetic Feedback).
  // 정답 근거를 먼저 세워 두면 오답 넷은 그 근거에 비추어 읽힌다.
  return anchors.find((a) => a.kind === 'answer')?.id ?? anchors[0]?.id ?? null
}

export function mapState(anchors: MapAnchor[], placements: MapPlacement[], activeId: string | null): MapState {
  const active = anchors.find((a) => a.id === activeId) ?? null
  if (!active) return { active: null, lit: [], notFound: false }
  const lit = placements.find((p) => p.id === active.id)?.sentences ?? []
  return { active, lit, notFound: lit.length === 0 }
}

/**
 * 문장을 [가림][글자][가림] 조각으로 쪼갠다. 글자는 인용문 안이다.
 *
 * ⚠️ **겹치는 구간에서 글자를 두 번 내지 않는다.** 한 문장에 두 앵커가 걸릴 수 있고,
 *    겹친 만큼 두 번 그리면 화면에 같은 낱말이 두 번 나와 «지문이 그렇게 생겼나» 로 읽힌다.
 */
export function segments(
  sentence: SkeletonSentence,
  reveals: SkeletonSentence['reveals'],
): { chars: number; text?: string }[] {
  const sorted = [...reveals].sort((a, b) => a.start - b.start)
  const out: { chars: number; text?: string }[] = []
  let at = 0
  for (const r of sorted) {
    if (r.start > at) out.push({ chars: r.start - at })
    if (r.end > at) {
      const skip = Math.max(0, at - r.start)
      out.push({ chars: r.end - Math.max(at, r.start), text: r.text.slice(skip) })
      at = r.end
    }
  }
  if (at < sentence.chars) out.push({ chars: sentence.chars - at })
  return out.filter((x) => x.chars > 0)
}

/**
 * 칩을 눌렀을 때 «연 근거» 로 셀 것인가.
 *
 * 계측의 `seq` 는 「클릭/클릭/클릭」이 실제로 일어나는지를 재는 수라, **부풀면 안 된다.**
 *   · 같은 칩을 다시 누르는 것은 새로 연 것이 아니다 — 세면 한 사람이 10을 만들 수 있다.
 *   · 첫 근거는 서버가 이미 펴 둔 채로 오므로 «눌러서 연 것» 이 아니다. 그래서 세는 쪽은
 *     0에서 시작한다(이 함수가 아니라 부르는 쪽의 초깃값이 그 규칙을 담는다).
 */
export function countsAsOpen(activeId: string | null, clickedId: string): boolean {
  return clickedId !== activeId
}

/** 막대 폭 — 가장 긴 문장을 100% 로 둔다. 지문의 «모양» 이 그대로 보인다. */
export function widthPct(chars: number, max: number): number {
  // 아주 짧은 문장도 보이게 바닥을 둔다 — 0에 가까우면 «문장이 없다» 로 읽힌다.
  return Math.max(6, Math.round((chars / Math.max(max, 1)) * 100))
}

/**
 * **지도가 들지 못한 선지** — 이 선지들의 근거는 산문으로 내려간다.
 *
 * 지도는 `how_to_reject` 안의 영어 조각이 **지문에서 찾힐 때만** `reject:n` 앵커를 얻는다
 * (노출 예산에 걸려 버려지기도 한다 — `scripts/csat/build-skeleton-data.mjs` §fitBudget).
 * 그래서 「골격이 있으면 산문 절을 안 그린다」는 규칙이 문항 단위로는 **틀렸다**.
 *
 * 실측 2026-09-15 — 골격 589문항 중 **136문항(23.1%)이 answer 앵커 하나뿐**이었고,
 * 그 136문항 **전부**가 오답 분석을 갖고 있었다(배제 근거 544문단 · 평균 867자 · 최대 1,616자).
 * 화면은 그것을 **한 글자도 안 보여 주고 있었다.** 지도가 대신하기로 한 내용을 그 문항에서는
 * 지도가 들고 있지 않았는데, 조건이 문항 단위라 조용히 사라졌다.
 *
 * 규칙은 선지 단위다 — **모든 선지는 칩이거나 글이거나, 둘 중 하나로는 반드시 닿는다.**
 */
export function offMapChoices<T extends { n: number }>(
  distractors: readonly T[],
  shownIds: readonly string[],
): T[] {
  const on = new Set(shownIds)
  return distractors.filter((d) => !on.has(`reject:${d.n}`))
}
