// apps/web/src/components/pairflip/__tests__/replay-config.test.tsx
// T-0255 — 「한 번 더(같은 난이도로 다시)」: 결과의 실제 level · mode 로 기존 시작 계약(sessionStorage config → /pairflip/play), 저장 실패면 이동 없음 + 안내.
// 실제 결과 화면 클릭 → 저장 → 이동 · 키보드 · 44px · 초점은 PC 하네스가 덮는다.
import fs from 'node:fs'
import path from 'node:path'

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { STORAGE_KEYS } from '../constants'
import { PairFlipNextActionCard } from '../PairFlipNextActionCard'
import { replayConfigFrom, storeReplayConfig } from '../replay'

const mem = () => {
  const m = new Map<string, string>()
  return { setItem: (k: string, v: string) => void m.set(k, v), getItem: (k: string) => m.get(k) ?? null, m }
}

describe('replayConfigFrom', () => {
  it('결과의 level · mode 그대로', () => {
    expect(replayConfigFrom({ level: 'hard', mode: 'word_definition' })).toEqual({ level: 'hard', mode: 'word_definition' })
  })
  it('알 수 없는 난이도 · 모드면 null', () => {
    expect(replayConfigFrom({ level: 'legend' as never, mode: 'word_meaning' })).toBeNull()
    expect(replayConfigFrom({ level: 'easy', mode: 'x' as never })).toBeNull()
  })
})

describe('storeReplayConfig', () => {
  it('이전 config 가 달라도 결과 설정으로 덮는다 · 없을 때도 쓴다', () => {
    const s = mem()
    s.m.set(STORAGE_KEYS.config, JSON.stringify({ level: 'easy', mode: 'word_meaning' }))
    expect(storeReplayConfig({ level: 'expert', mode: 'word_definition' }, s)).toBe(true)
    expect(JSON.parse(s.m.get(STORAGE_KEYS.config)!)).toEqual({ level: 'expert', mode: 'word_definition' })
    const e = mem()
    expect(storeReplayConfig({ level: 'normal', mode: 'word_meaning' }, e)).toBe(true)
  })
  it('저장 불가(null · 던짐 · 저장 안 됨)는 false', () => {
    expect(storeReplayConfig({ level: 'normal', mode: 'word_meaning' }, null)).toBe(false)
    expect(storeReplayConfig({ level: 'normal', mode: 'word_meaning' }, { setItem: () => { throw new Error('quota') }, getItem: () => null })).toBe(false)
    expect(storeReplayConfig({ level: 'normal', mode: 'word_meaning' }, { setItem: () => {}, getItem: () => null })).toBe(false)
  })
})

describe('PairFlipNextActionCard', () => {
  it('「한 번 더」는 단추(저장 뒤 이동) · 나머지(난이도 · WordVault · Flashcard)는 기존 링크 그대로', () => {
    const hot = renderToString(<PairFlipNextActionCard accuracy={90} replay={{ level: 'hard', mode: 'word_meaning' }} />)
    expect(hot).toMatch(/<button[^>]*type="button"[^>]*data-pairflip-replay/)
    expect(hot).toContain('href="/pairflip"')
    expect(hot).toContain('href="/wordvault"')
    expect(hot).not.toContain('href="/pairflip/play"')
    const warm = renderToString(<PairFlipNextActionCard accuracy={50} replay={null} />)
    expect(warm).toContain('href="/flashcard"')
    expect(warm).toMatch(/data-pairflip-replay/)
    const cold = renderToString(<PairFlipNextActionCard accuracy={10} />)
    expect(cold).not.toMatch(/data-pairflip-replay/)
  })
  it('소스 결속 — 저장 성공일 때만 이동, 실패면 안내(role=status) · 결과 화면이 결과 설정을 넘긴다', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../PairFlipNextActionCard.tsx'), 'utf8')
    expect(src).toMatch(/if \(!storeReplayConfig\(replay, sessionStore\(\)\)\) \{\n\s*setStoreFailed\(true\)\n\s*return\n\s*\}\n\s*setStoreFailed\(false\)\n\s*router\.push\(PAIRFLIP_PLAY_HREF\)/)
    expect(src).toMatch(/role="status" data-pairflip-replay-failed/)
    const screen = fs.readFileSync(path.resolve(__dirname, '../PairFlipResultScreen.tsx'), 'utf8')
    expect(screen).toContain('<PairFlipNextActionCard accuracy={accuracy} replay={replayConfigFrom(result)} />')
  })
})
