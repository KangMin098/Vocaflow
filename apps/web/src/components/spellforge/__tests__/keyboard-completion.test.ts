// apps/web/src/components/spellforge/__tests__/keyboard-completion.test.ts
// @vitest-environment node
// T-0201 보정 — 완료 화면에서 게임 Enter 가 마지막 단어를 다시 채점하던 결함(Codex 반례: srs_pending 3→4 · 링크 click 없음).
// 실제 SpellForge.tsx 의 키보드 useEffect 본문을 소스에서 꺼내 변환해, 주입한 document · 콜백으로 돌린다(DOM · DB 없음).
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { nativeControlOwnsKey } from '@/lib/ui/learner-keyboard-scope'

const SRC = fs.readFileSync(path.resolve(__dirname, '../SpellForge.tsx'), 'utf8').replace(/\r\n/g, '\n')

function extractKeyboardEffect(): string {
  const m = /\* Keyboard\n\s*\*\/\n\s*useEffect\(\(\) => \{\n([\s\S]*?)\n {2}\}, \[mode, currentWord[^\]]*\]\)/.exec(SRC)
  if (!m) throw new Error('키보드 effect 를 찾지 못했다')
  return ts.transpileModule(`function __effect() {\n${m[1]}\n}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  }).outputText + '\nreturn __effect'
}

function mount(opts: { showCompletion: boolean; phase?: string }) {
  const listeners: ((e: unknown) => void)[] = []
  const deps = {
    showCompletion: opts.showCompletion,
    phase: opts.phase ?? 'typing',
    mode: 'delayed',
    currentWord: { id: 'w3', text: 'flooding' },
    inputRef: { current: { tagName: 'INPUT' } },
    ownsSession: () => true,
    triggerHint: vi.fn(),
    playWordAudio: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    nativeControlOwnsKey,
    document: {
      addEventListener: (_t: string, f: (e: unknown) => void) => listeners.push(f),
      removeEventListener: (_t: string, f: (e: unknown) => void) => listeners.splice(listeners.indexOf(f), 1),
    },
  }
  const names = Object.keys(deps)
  const effect = new Function(...names, extractKeyboardEffect())(...names.map((k) => deps[k as keyof typeof deps])) as () =>
    | (() => void)
    | undefined
  const cleanup = effect()
  const press = (key: string, target: Record<string, unknown>) => {
    const e = { key, shiftKey: false, target, preventDefault: vi.fn() }
    for (const l of [...listeners]) l(e)
    return e
  }
  return { deps, listeners, cleanup, press }
}

const button = { tagName: 'BUTTON', closest: () => null }
const link = { tagName: 'A', closest: () => null }
// 기본 조작부 대역 — nativeControlOwnsKey 의 closest(선택자) 에 자기 자신을 돌려준다(retry 표지는 없음)
const control = (tagName: string, extra: Record<string, unknown> = {}) => {
  const el: Record<string, unknown> = { tagName, ...extra }
  el.closest = (sel: string) => (sel.includes('[data-sf-retry]') ? null : el)
  return el
}

describe('SpellForge 키보드 · 완료 화면', () => {
  it('완료 화면에서는 keydown 을 걸지 않는다 — 버튼·링크 Enter 는 채점·preventDefault 없이 브라우저 몫', () => {
    const c = mount({ showCompletion: true })
    expect(c.listeners).toHaveLength(0)
    expect(c.cleanup).toBeUndefined()
    const eb = c.press('Enter', button)
    const el = c.press('Enter', link)
    expect(c.deps.handleConfirm).not.toHaveBeenCalled()
    expect(eb.preventDefault).not.toHaveBeenCalled()
    expect(el.preventDefault).not.toHaveBeenCalled()
  })

  it('게임 중 Enter 는 그대로 확인(채점)한다', () => {
    const c = mount({ showCompletion: false })
    expect(c.listeners).toHaveLength(1)
    const e = c.press('Enter', c.deps.inputRef.current)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(c.deps.handleConfirm).toHaveBeenCalledTimes(1)
  })

  it('게임 중 「다시 입력하기」 단추의 Enter 는 확인하지 않는다(기존 오답 재시도)', () => {
    const c = mount({ showCompletion: false, phase: 'error' })
    c.press('Enter', { tagName: 'BUTTON', closest: (s: string) => (s === '[data-sf-retry]' ? {} : null) })
    expect(c.deps.handleConfirm).not.toHaveBeenCalled()
  })

  it('완료로 바뀌면 이전 리스너는 해제된다', () => {
    const c = mount({ showCompletion: false })
    c.cleanup?.()
    expect(c.listeners).toHaveLength(0)
  })
})

describe('SpellForge 키보드 · 학습 중 단추 · 링크 Enter (T-0261)', () => {
  it('모드 · 발음 단추 · 닫기 링크의 Enter 는 채점하지 않고 preventDefault 하지 않는다(그 조작의 기본 동작)', () => {
    const c = mount({ showCompletion: false })
    for (const t of [control('BUTTON', { role: 'radio' }), control('BUTTON'), control('A')]) {
      const e = c.press('Enter', t)
      expect(e.preventDefault).not.toHaveBeenCalled()
    }
    expect(c.deps.handleConfirm).not.toHaveBeenCalled()
  })

  it('입력칸 Enter 는 그대로 확인 1회(입력칸은 기본 조작부지만 게임의 확인 키다)', () => {
    const c = mount({ showCompletion: false })
    const input = c.deps.inputRef.current as Record<string, unknown>
    input.closest = (sel: string) => (sel.includes('[data-sf-retry]') ? null : input)
    const e = c.press('Enter', input)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(c.deps.handleConfirm).toHaveBeenCalledTimes(1)
  })

  it('조작부가 아닌 곳(본문 영역)의 Enter 는 기존처럼 확인', () => {
    const c = mount({ showCompletion: false })
    c.press('Enter', { tagName: 'DIV', closest: () => null })
    expect(c.deps.handleConfirm).toHaveBeenCalledTimes(1)
  })
})
