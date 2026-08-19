// packages/library-pipeline/src/compose/copy-lines.ts
//
// ACP §20 — **선언된 계통이 아니라 측정된 계통.**
//
// ── 왜 이 파일이 생겼나 (실측 2026-08-19) ─────────────────────────────
// 로카르노 영화제 사건을 취재하려다, 연합뉴스와 코리아헤럴드의 문장이 **글자 그대로 같은 것**을
// 발견했다. 코리아헤럴드가 연합 원고를 그대로 실은 것이다. 그런데 화면에는 `계통 2/2` 로 떴다
// — 발행사가 둘이라는 이유만으로 독립 2계통으로 셌기 때문이다.
//
// 이것이 왜 치명적인가: 재저작의 정당성은 **"여러 곳이 각자 취재한 사실은 누구의 표현도
// 아니다"** 하나에 걸려 있다. 한 곳의 원고를 두 곳이 실은 것을 2계통으로 세면, 실제로는
// **한 매체의 기사 하나를 바꿔 쓴 것**이 된다. 그건 재저작이 아니라 2차 저작물이다.
// 게이트 여섯을 다 통과해도 전제가 무너져 있으면 통과가 의미를 잃는다.
//
// `wire` 필드가 이걸 막게 돼 있었지만 **손으로 적는 값**이라, 표시되지 않은 전재는 그냥
// 통과한다. 지문은 소스마다 이미 만들어 두므로, 소스끼리 견주면 측정으로 잡을 수 있다.

import { containment, type Fingerprint } from './fingerprint'

/**
 * 사실상 같은 원고로 보는 담김(containment) 하한.
 *
 * ── 실측 근거 (2026-08-19) ────────────────────────────────
 * 각자 취재한 쌍 4건: **0.0% · 0.7% · 1.3% · 1.3%**
 *   (연합↔헤럴드 두 쌍 · dw↔bbc · bbc↔dw)
 * 전재로 확인된 쌍 1건: **31.3%**
 *   (연합 로카르노 기사 ↔ 코리아헤럴드가 그 원고를 실은 기사)
 *
 * 31%가 더 높지 않은 이유는 **부분 전재**이기 때문이다 — 두 기사의 서두는 각자 쓰고
 * (연합은 참석, 헤럴드는 수상) 작품 소개·수상 이력 문단만 그대로 옮겼다. 전문 전재라면
 * 90%를 넘는다. 즉 이 값은 **부분 전재까지 잡을 수 있는 자리**에 있어야 한다.
 *
 * 10%는 관측된 독립 최대치(1.3%)의 약 8배이고 관측된 전재 최소치(31.3%)의 3분의 1이다.
 * 양쪽에서 멀다. ⚠️ 다만 전재 표본이 **1건뿐**이다 — 반례가 나오면 조이지 말고 먼저 재고,
 * 그 수치를 여기 적는다.
 */
export const SAME_COPY_CONTAINMENT = 0.1

export interface CopyCandidate {
  /** 소스를 가리키는 값 — 발행사든 id든, 호출부가 알아볼 수 있으면 된다. */
  key: string
  fingerprint: Fingerprint
}

export interface CopyGroup {
  /** 이 계통에 속한 소스들. 둘 이상이면 한쪽이 다른 쪽 원고를 실은 것이다. */
  keys: string[]
  /** 묶인 근거 — 가장 높았던 담김 비율(0~1). 혼자면 0. */
  worstContainment: number
}

/**
 * 소스들을 **실제 원고 기준**으로 묶는다.
 *
 * 담김은 방향이 있다(짧은 쪽이 긴 쪽에 담긴 비율이 더 높게 나온다). 어느 쪽이 베꼈는지는
 * 판정하지 않는다 — 우리가 알아야 하는 것은 **둘을 따로 세면 안 된다**는 것뿐이다.
 * 그래서 양방향 중 큰 값을 쓴다.
 *
 * 전이적으로 묶는다: A-B 가 같은 원고이고 B-C 가 같은 원고면 셋이 한 계통이다.
 */
export function groupByCopy(
  sources: ReadonlyArray<CopyCandidate>,
  threshold: number = SAME_COPY_CONTAINMENT,
): CopyGroup[] {
  const parent = sources.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)))
  const worst = new Map<number, number>()

  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const a = sources[i]!
      const b = sources[j]!
      const c = Math.max(
        containment(a.fingerprint, b.fingerprint),
        containment(b.fingerprint, a.fingerprint),
      )
      if (c < threshold) continue
      const ra = find(i)
      const rb = find(j)
      if (ra !== rb) parent[rb] = ra
      const root = find(i)
      worst.set(root, Math.max(worst.get(root) ?? 0, c))
    }
  }

  const groups = new Map<number, string[]>()
  for (let i = 0; i < sources.length; i++) {
    const r = find(i)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r)!.push(sources[i]!.key)
  }
  return [...groups.entries()].map(([root, keys]) => ({
    keys,
    worstContainment: keys.length > 1 ? (worst.get(root) ?? 0) : 0,
  }))
}

/**
 * 측정된 독립 계통 수 — 발행사 수가 아니다.
 *
 * 발행이 요구하는 "독립 2계통" 은 이 값으로 세야 한다. 발행사 수로 세면 전재를 두 번 센다.
 */
export function measuredLineCount(
  sources: ReadonlyArray<CopyCandidate>,
  threshold: number = SAME_COPY_CONTAINMENT,
): number {
  return groupByCopy(sources, threshold).length
}

/** 사람이 읽을 사유 — 왜 계통이 줄었는지 화면·로그에 그대로 쓴다. */
export function describeCopyGroups(groups: ReadonlyArray<CopyGroup>): string[] {
  return groups
    .filter((g) => g.keys.length > 1)
    .map(
      (g) =>
        `${g.keys.join(' · ')} — 본문이 ${(100 * g.worstContainment).toFixed(0)}% 겹친다. ` +
        `한쪽이 다른 쪽 원고를 실은 것이므로 한 계통으로 센다.`,
    )
}
