// apps/web/src/components/spellforge/__tests__/error-retry.test.ts
// @vitest-environment node
// SpellForge 오답 뒤 학습자 주도 재시도 — 실제 SpellForge.tsx 의 handleError · handleInputChange 콜백을 소스에서 꺼내 변환해
//   주입한 setter · 가짜 타이머로 돌린다(DOM · DB · 음성 없음). 옛 코드(3초 자동 삭제)에서는 「고쳐 쓴 river 가 3초 뒤 사라짐」으로 실패한다.
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bumpRetryEpoch, makeRetry, type RetryEpoch } from '../error-retry'

const SRC = fs.readFileSync(path.resolve(__dirname, '../SpellForge.tsx'), 'utf8').replace(/\r\n/g, '\n')

function extract(name: string): string {
  const m = new RegExp(`const ${name} = useCallback\\(\\s*([\\s\\S]*?),\\n\\s*\\[[^\\]]*\\]\\n\\s*\\)`).exec(SRC)
  if (!m) throw new Error(`${name} 를 찾지 못했다`)
  return ts.transpileModule(`const __f = (${m[1]})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  }).outputText.replace(/^const __f = /m, 'return ')
}

type Mode = 'delayed' | 'blind'

function mount(mode: Mode, owns = { v: true }) {
  const st = { userInput: '', domValue: '', phase: 'typing', reflection: '', focus: 0, feedbackResets: 0 }
  const input = {
    get value() {
      return st.domValue
    },
    set value(v: string) {
      st.domValue = v
    },
    focus: () => {
      st.focus += 1
    },
  }
  const pushOwnedResult = vi.fn()
  const deps: Record<string, unknown> & { retryRef: { current: (() => boolean) | null }; retryEpochRef: { current: RetryEpoch }; handleSuccess: ReturnType<typeof vi.fn> } = {
    setPhase: (p: string) => (st.phase = p),
    setReflectionMsg: (m: string) => (st.reflection = m),
    setUserInput: (v: string) => (st.userInput = v),
    generateReflectionMessage: () => '첫 글자는 맞아요 — 가운데를 다시 떠올려 보세요',
    resetFeedback: () => (st.feedbackResets += 1),
    inputRef: { current: input },
    errorTimerRef: { current: null as ReturnType<typeof setTimeout> | null },
    retryEpochRef: { current: { current: 0 } as RetryEpoch },
    retryRef: { current: null as (() => boolean) | null },
    setRetryAction: (f: () => () => boolean) => (deps.retryRef.current = f()),
    makeRetry,
    ownsSession: () => owns.v,
    checkInput: (v: string) => v,
    mode,
    currentWord: { id: 'w1', text: 'rivet' },
    handleSuccess: vi.fn(),
    // 완료 화면 복기용 놓친 낱말 표시 — 화면 상태일 뿐 기록 · 평가가 아니다(P-4)
    markMissed: vi.fn(),
    pushOwnedResult,
    setTimeout,
    clearTimeout,
  }
  const names = Object.keys(deps)
  const build = (n: string) => new Function(...names, extract(n))(...names.map((k) => deps[k]))
  const handleError = build('handleError') as (r: unknown) => void
  const handleInputChange = build('handleInputChange') as (e: { target: { value: string } }) => void
  return {
    st,
    deps,
    pushOwnedResult,
    wrong: () => {
      st.userInput = 'rivr'
      st.domValue = 'rivr'
      handleError({ correct: false, errorPositions: [3] })
    },
    type: (v: string) => {
      const t = { value: v }
      handleInputChange({ target: t })
      st.domValue = t.value
    },
    retry: () => deps.retryRef.current?.() ?? false,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe.each<Mode>(['delayed', 'blind'])('SpellForge 오답 재시도 · %s', (mode) => {
  it('오답 뒤 5초가 지나도 입력 · 안내가 남는다', () => {
    const c = mount(mode)
    c.wrong()
    vi.advanceTimersByTime(6000)
    expect(c.st).toMatchObject({ userInput: 'rivr', domValue: 'rivr', phase: 'error' })
    expect(c.st.reflection.length).toBeGreaterThan(0)
  })

  it('2.9초에 고쳐 쓴 river 는 3초를 넘겨도 지워지지 않는다', () => {
    const c = mount(mode)
    c.wrong()
    vi.advanceTimersByTime(2900)
    c.type('river')
    vi.advanceTimersByTime(3200)
    expect(c.st.userInput).toBe('river')
    expect(c.st.domValue).toBe('river')
  })

  it('「다시 입력하기」는 입력 · 오답 표시를 비우고 입력 칸으로 포커스를 돌린다', () => {
    const c = mount(mode)
    c.wrong()
    const f0 = c.st.focus
    expect(c.retry()).toBe(true)
    expect(c.st).toMatchObject({ userInput: '', domValue: '', phase: 'typing', reflection: '' })
    expect(c.st.feedbackResets).toBe(1)
    expect(c.st.focus).toBe(f0 + 1)
  })

  it('모드 · 단어가 바뀐 뒤(세대 증가) 옛 재시도는 아무것도 하지 않는다', () => {
    const c = mount(mode)
    c.wrong()
    const old = c.deps.retryRef.current!
    bumpRetryEpoch(c.deps.retryEpochRef.current)
    c.st.userInput = 'new'
    c.st.domValue = 'new'
    expect(old()).toBe(false)
    vi.advanceTimersByTime(5000)
    expect(c.st).toMatchObject({ userInput: 'new', domValue: 'new' })
  })

  it('단어 A 오답의 보관된 재시도는 단어 B 오답 뒤 B 입력을 지우지 않는다(Codex 반례)', () => {
    const c = mount(mode)
    c.wrong()
    const heldA = c.deps.retryRef.current!
    bumpRetryEpoch(c.deps.retryEpochRef.current)
    c.wrong()
    c.type('new-b')
    expect(heldA()).toBe(false)
    expect(c.st).toMatchObject({ userInput: 'new-b', domValue: 'new-b', phase: 'error' })
    expect(c.retry()).toBe(true)
    expect(c.st.userInput).toBe('')
  })

  it('보관된 재시도 콜백은 계정이 바뀐 뒤 아무것도 하지 않는다', () => {
    const owns = { v: true }
    const c = mount(mode, owns)
    c.wrong()
    const held = c.deps.retryRef.current!
    owns.v = false
    expect(held()).toBe(false)
    expect(c.st).toMatchObject({ userInput: 'rivr', phase: 'error' })
  })

  it('오답 → 재시도를 반복해도 평가 대기열에 아무것도 넣지 않는다', () => {
    const c = mount(mode)
    for (let i = 0; i < 3; i++) {
      c.wrong()
      c.retry()
    }
    vi.advanceTimersByTime(10000)
    expect(c.pushOwnedResult).not.toHaveBeenCalled()
    expect(c.deps.handleSuccess).not.toHaveBeenCalled()
  })
})

describe('SpellForge 소스 계약', () => {
  it('오답 처리에 자동 삭제 타이머가 없고, 대기열 적재는 정답 · 건너뛰기 경로에만 있다', () => {
    expect(extract('handleError')).not.toMatch(/setTimeout/)
    expect(SRC).not.toMatch(/errorTimerRef/)
    expect((SRC.match(/pushOwnedResult\(/g) ?? []).length).toBe(
      (SRC.slice(SRC.indexOf('const handleSuccess'), SRC.indexOf('const handleConfirm')).match(/pushOwnedResult\(/g) ?? []).length +
        (SRC.slice(SRC.indexOf('const handleSkip')).match(/pushOwnedResult\(/g) ?? []).length,
    )
  })
})
