// apps/web/src/components/pairflip/replay.ts
//
// T-0255 — 결과의 「한 번 더(같은 난이도로 다시)」를 방금 끝낸 판의 실제 설정(level · mode)으로 시작한다.
// 기존 시작 계약(PairFlipHub.handleStart — sessionStorage STORAGE_KEYS.config 에 { level, mode } 를 넣고 /pairflip/play)을 그대로 쓴다.
// 결과 값이 알려진 난이도 · 모드가 아니면 설정을 만들지 않는다. 저장에 실패하면 이동하지 않고 화면이 안내한다(이전 · 없는 설정으로 시작하지 않는다).
// 자료 · 단어 범위는 복원하지 않는다(새 계약 없음).

import { PAIRFLIP_LEVELS, STORAGE_KEYS } from './constants'
import type { PairFlipConfig, PairFlipResultData } from './types'

const MODES: readonly PairFlipConfig['mode'][] = ['word_meaning', 'word_definition']

export const PAIRFLIP_PLAY_HREF = '/pairflip/play'

export function replayConfigFrom(result: Pick<PairFlipResultData, 'level' | 'mode'>): PairFlipConfig | null {
  if (!PAIRFLIP_LEVELS.some((l) => l.id === result.level) || !MODES.includes(result.mode)) return null
  return { level: result.level, mode: result.mode }
}

/** 시작 설정을 기존 키에 넣는다 — 성공이면 true(그때만 이동한다). */
export function storeReplayConfig(config: PairFlipConfig, storage: Pick<Storage, 'setItem' | 'getItem'> | null): boolean {
  if (!storage) return false
  try {
    const raw = JSON.stringify(config)
    storage.setItem(STORAGE_KEYS.config, raw)
    return storage.getItem(STORAGE_KEYS.config) === raw
  } catch {
    return false
  }
}
