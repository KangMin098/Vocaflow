// labs/claw-poc/src/hooks/useSequence.ts
import { create } from 'zustand'

export type SeqState =
  | 'idle'
  | 'moveToTarget'
  | 'descend'
  | 'grip'
  | 'lift'
  | 'moveToChute'
  | 'release'
  | 'returnHome'

type Store = {
  state: SeqState
  targetX: number
  targetZ: number
  setTarget: (x: number, z: number) => void
  setState: (s: SeqState) => void
  start: () => void
  reset: () => void
}

export const useSequenceStore = create<Store>((set, get) => ({
  state: 'idle',
  targetX: 0,
  targetZ: 0,
  setTarget: (x, z) => set({ targetX: x, targetZ: z }),
  setState: (s) => set({ state: s }),
  start: () => {
    if (get().state === 'idle') set({ state: 'moveToTarget' })
  },
  reset: () => set({ state: 'idle' }),
}))

export const CHUTE_TARGET = { x: -1.5, z: -1.5 }
export const HOME = { x: 0, z: 0 }
export const HOME_Y = 4.2
export const DESCEND_Y = 0.9
