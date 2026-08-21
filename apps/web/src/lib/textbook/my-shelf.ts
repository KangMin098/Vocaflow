// apps/web/src/lib/textbook/my-shelf.ts
//
// **내 교재** 의 순수 계산 — 담은 step 목록을 화면이 그릴 수 있는 권으로 바꾼다.
// 조회는 `my-shelf-query.ts`, 쓰기는 `my-shelf-actions.ts` 가 맡는다.
//
// ⚠️ `server-only`/`react.cache` 금지 — 클라이언트 컴포넌트와 vitest 가 함께 쓴다
//    (`shelf.ts` · `shelf-filter.ts` 와 같은 이유. `react.cache` 하나면 스위트가 통째로 죽는다).
//
// 저장소에는 **step 번호밖에 없다.** 제목·학령·유형은 `SERIES_SPINE` 이 소유하므로
// 여기서 매번 붙인다 — DB 에 복사해 두면 시리즈를 고칠 때 낡은 이름을 계속 말한다.

import type { Shelf, ShelfVolume } from './shelf'

/** 몇 권까지 미리 보여줄까 — 서점 매대의 "이 시리즈 대표 3권" 과 같은 수. */
export const PREVIEW_COUNT = 3

/**
 * 담은 step → 권.
 *
 * ⚠️ 서가에 없는 step 은 **조용히 뺀다.** 시리즈가 줄면 담아 둔 번호가 남는데,
 *    그때 빈 행을 그리면 "제목 없는 교재" 를 파는 셈이다.
 * 순서는 항상 계단 순 — 이 서가에서 순서는 곧 난이도다.
 */
export function pickedVolumes(shelf: Shelf, steps: readonly number[]): ShelfVolume[] {
  return shelf.volumes.filter((v) => steps.includes(v.step))
}

/**
 * 다음 계단 — 담은 것 중 **가장 높은 권 다음**의, 아직 안 담은 권.
 *
 * 시리즈의 존재 이유가 "학년을 잇는" 것이라, 이 한 줄이 교재 면의 다음 행동이다.
 * 마지막 권까지 담았으면 `null` — 빈 제안을 파는 것보다 아무 말도 안 하는 게 낫다.
 */
export function nextRung(shelf: Shelf, steps: readonly number[]): ShelfVolume | null {
  const picked = pickedVolumes(shelf, steps)
  if (picked.length === 0) return null
  const highest = picked[picked.length - 1].step
  return shelf.volumes.find((v) => v.step > highest && !steps.includes(v.step)) ?? null
}

/**
 * 아직 안 담았을 때 **대신 진열할 권**.
 *
 * ── 왜 빈 상태를 진열로 바꾸나 ────────────────────────────────────────
// 실측(2026-08-21): 0권일 때 이 면은 본문의 37% 만 채웠다 — 얇은 안내 카드 하나가
 * 텅 빈 지면에 떠 있었다. 서점은 빈 책장을 보여주지 않는다. 매대를 세운다.
 * 고를 것을 눈앞에 두는 것이 "서가로 가세요" 링크 하나보다 정직하게 더 많은 정보를 준다.
 *
 * 지금 펼칠 수 있는 권(`ready`)을 먼저 놓고, 모자라면 계단 순서로 채운다 —
 * '근간 예정' 만 진열하면 매대가 약속만 파는 자리가 된다.
 */
export function previewVolumes(
  shelf: Shelf,
  steps: readonly number[],
  count = PREVIEW_COUNT,
): ShelfVolume[] {
  const candidates = shelf.volumes.filter((v) => !steps.includes(v.step))
  const ready = candidates.filter((v) => v.status === 'ready')
  const rest = candidates.filter((v) => v.status !== 'ready')
  return [...ready, ...rest].slice(0, count).sort((a, b) => a.step - b.step)
}

/** 담은 권의 합계. ⚠️ 단원 수는 **상한**이다 — 화면이 반드시 '최대' 라고 적어야 한다. */
export function pickedTotals(volumes: readonly ShelfVolume[]): {
  volumes: number
  items: number
  maxUnits: number
} {
  return {
    volumes: volumes.length,
    items: volumes.reduce((s, v) => s + v.itemCount, 0),
    maxUnits: volumes.reduce((s, v) => s + v.maxUnits, 0),
  }
}
