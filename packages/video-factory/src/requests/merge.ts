// packages/video-factory/src/requests/merge.ts
//
// **규칙 편 + 요청 편 + 내린 편 → 찍고 싣는 목록.** 순수 함수 — CLI(`store.ts`)와 Remotion 루트가
// 같은 규칙으로 합치게 한 곳에 둔다. 둘이 따로 합치면 렌더는 교체본을, 포장은 옛 편을 싣게 된다.
//
//   · 교체 편(`brief.replaces`)은 **같은 id 의 편을 이긴다** — 같은 자리를 이어받는 것이 교체의 뜻이다.
//   · 새 요청 편은 같은 id 가 있으면 **진다** — 새 편이 기존 편을 조용히 덮는 일은 없어야 한다.
//   · 내린 id 는 **빠진다** — 음성·렌더·포장·발행 어디에도 다시 나타나지 않는다.

import type { VideoSpec } from '../spec/types'

export function mergeSpecs(
  rule: VideoSpec[],
  requested: VideoSpec[],
  retired: ReadonlySet<string>,
): VideoSpec[] {
  const replacing = new Map(requested.filter((s) => s.brief?.replaces).map((s) => [s.id, s]))
  const out: VideoSpec[] = rule.map((s) => replacing.get(s.id) ?? s)
  const have = new Set(out.map((s) => s.id))
  for (const s of requested) {
    if (have.has(s.id)) continue
    out.push(s)
    have.add(s.id)
  }
  return out.filter((s) => !retired.has(s.id))
}
