// apps/web/src/components/workspace/__tests__/shadow-echo-link.test.tsx
// 따라읽기 패널 → 같은 글 EchoMatch 연결: 시작 전 · 완료에만 명시적 링크 · 진행 중엔 없음 · 주소가 없으면 없음.
// 완료 문구는 관측하지 않은 발화 · 기억 향상을 말하지 않는다(인식 미지원 · 침묵으로도 done 에 닿는다).
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ShadowReadAlong } from '../ShadowReadAlong'
import type { ShadowControls, ShadowState } from '@/lib/workspace/use-shadow-session'

const controls = {} as ShadowControls
const sentences = [{ sentenceIdx: 0, text: 'One two.' }] as never

function state(over: Partial<ShadowState>): ShadowState {
  return {
    running: false,
    paused: false,
    phase: 'idle',
    index: 0,
    total: 3,
    sentenceIdx: null,
    transcript: '',
    matchedKeys: new Set<string>(),
    tone: null,
    rate: 1,
    autoAdvance: true,
    recognitionSupported: false,
    micDenied: false,
    ...over,
  }
}

const html = (s: Partial<ShadowState>, echoHref?: string) =>
  renderToString(<ShadowReadAlong sentences={sentences} state={state(s)} controls={controls} onExit={() => {}} echoHref={echoHref} />)

describe('ShadowReadAlong → EchoMatch', () => {
  it('시작 전: 같은 글의 녹음 비교 링크 · 보이는 focus · 44px', () => {
    const out = html({}, '/text/t1/echo')
    expect(out).toContain('href="/text/t1/echo"')
    expect(out).toContain('내 녹음과 억양 비교')
    expect(out).toMatch(/data-testid="shadow-echo-link"[^>]*focus-visible:ring-2|focus-visible:ring-2[^>]*data-testid="shadow-echo-link"/)
    expect(out).toContain('h-11')
  })

  it('완료: 링크가 있고, 발화 · 기억을 확인했다고 말하지 않는다', () => {
    const out = html({ phase: 'done' }, '/text/t1/echo')
    expect(out).toContain('href="/text/t1/echo"')
    expect(out).toContain('따라읽기 연습이 끝났어요')
    expect(out).not.toMatch(/모두 따라 읽었|또렷하게 남/)
    expect(out).toContain('처음부터 다시')
    expect(out).toContain('본문으로')
  })

  it('진행 중에는 링크가 없다 — 따라읽기를 끊지 않는다', () => {
    expect(html({ running: true, phase: 'speaking', sentenceIdx: 0 }, '/text/t1/echo')).not.toContain('shadow-echo-link')
  })

  it('주소가 없으면 링크가 없다', () => {
    expect(html({ phase: 'done' })).not.toContain('shadow-echo-link')
    expect(html({})).not.toContain('shadow-echo-link')
  })
})
