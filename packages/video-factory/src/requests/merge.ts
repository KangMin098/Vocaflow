// packages/video-factory/src/requests/merge.ts
//
// **규칙 편 + 요청 편 + 내린 편 → 찍고 싣는 목록.** 순수 함수 — CLI(`store.ts`)와 Remotion 루트가
// 같은 규칙으로 합치게 한 곳에 둔다. 둘이 따로 합치면 렌더는 교체본을, 포장은 옛 편을 싣게 된다.
//
//   · 교체 편(`brief.replaces`)은 **같은 id 의 편을 이긴다** — 같은 자리를 이어받는 것이 교체의 뜻이다.
//   · 새 요청 편은 같은 id 가 있으면 **진다** — 새 편이 기존 편을 조용히 덮는 일은 없어야 한다.
//   · 내린 id 는 **빠진다** — 음성·렌더·포장·발행 어디에도 다시 나타나지 않는다.
//   · 요청 편끼리 같은 id 가 여럿이면 **뒤의 것이 이긴다**(규칙 편 자리든 아니든 똑같이).
//     `requests:pull` 이 자리마다 주인 하나만 파일에 쓰므로(`pickRequestOwners`) 정상 경로에서는
//     중복이 없다 — 이 규칙은 손으로 고친 파일에서도 결과가 입력 순서 한 가지로만 정해지게 하는 안전판이다.

import type { VideoSpec } from '../spec/types'

export function mergeSpecs(
  rule: VideoSpec[],
  requested: VideoSpec[],
  retired: ReadonlySet<string>,
): VideoSpec[] {
  // 같은 id 는 마지막 것 하나로 — Map 은 덮어쓰되 처음 자리를 지키므로 순서도 안정적이다
  const latest = new Map<string, VideoSpec>()
  for (const s of requested) latest.set(s.id, s)
  const ruleIds = new Set(rule.map((s) => s.id))
  const out: VideoSpec[] = rule.map((s) => {
    const r = latest.get(s.id)
    return r?.brief?.replaces ? r : s
  })
  for (const s of latest.values()) {
    if (ruleIds.has(s.id)) continue
    out.push(s)
  }
  return out.filter((s) => !retired.has(s.id))
}

/** 자리 주인을 고르는 데 필요한 요청 한 줄 */
export interface OwnerCandidate {
  id: string
  /** 이 요청이 쓰는 영상 id(교체면 대상 id, 새 편이면 요청 id 로 지은 것) */
  videoId: string
  phase: string
  created_at: string
}

export interface OwnerPick<T extends OwnerCandidate> {
  /** 자리마다 하나 — 설계도 파일에 들어갈 요청 */
  owners: T[]
  /** 이번에 적용을 시작할 요청(approved, 또는 자리의 주인인 failed 재시도) */
  starters: T[]
  /** 같은 자리에 더 새 요청이 있어 시작하지 않는 요청 */
  superseded: T[]
}

/**
 * **같은 자리(video id)의 요청이 여럿일 때 주인 하나를 고른다.** 순수 함수.
 *
 * 주인 = 그 자리에서 **가장 나중에 만든 요청**(created_at, 같으면 id 순). DB 조회 순서에 기대지 않는다 —
 * 순서 없는 조회로 첫 행을 고르면 두 번째 교체 뒤에도 옛 설계도가 찍히고 발행될 수 있다.
 * 시작은 주인만 한다: 옛 failed 를 자동 재시도하면 새 교체 요청과 함께 applying 이 되어
 * `video_requests_video_id_live_uniq` 에 걸려 파이프라인이 멈춘다.
 */
export function pickRequestOwners<T extends OwnerCandidate>(rows: readonly T[]): OwnerPick<T> {
  const groups = new Map<string, T[]>()
  for (const r of rows) groups.set(r.videoId, [...(groups.get(r.videoId) ?? []), r])
  const owners: T[] = []
  const starters: T[] = []
  const superseded: T[] = []
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) =>
      a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at < b.created_at ? -1 : 1,
    )
    const owner = sorted[sorted.length - 1]!
    owners.push(owner)
    if (owner.phase === 'approved' || owner.phase === 'failed') starters.push(owner)
    for (const r of sorted.slice(0, -1)) {
      if (r.phase === 'approved' || r.phase === 'failed') superseded.push(r)
    }
  }
  return { owners, starters, superseded }
}
