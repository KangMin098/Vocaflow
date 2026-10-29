// apps/web/src/components/wordvault/__tests__/study-keyboard-space.test.ts
// @vitest-environment node
// T-0263 — 학습 화면의 전역 Space(공개 · 재생)가 초점된 평가 단추의 Space 를 가로채 평가 대신 발음을 냈다.
// 실제 StudyMode.tsx 의 키보드 useEffect 본문을 소스에서 꺼내 변환해, 주입한 window · 콜백으로 돌린다(DOM · DB 없음).
// 실제 브라우저의 단추 Space → click(평가 1회) · 발음 0 은 PC 하네스(pe-t263)가 덮는다.
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { nativeControlOwnsKey } from '@/lib/ui/learner-keyboard-scope'

const SRC = fs.readFileSync(path.resolve(__dirname, '../StudyMode.tsx'), 'utf8').replace(/\r\n/g, '\n')

function extractKeyboardEffect(): string {
  const m = /\/\/ 키보드 단축키\n\s*useEffect\(\(\) => \{\n([\s\S]*?)\n {2}\}, \[state, revealMeaning[^\]]*\]\)/.exec(SRC)
  if (!m) throw new Error('키보드 effect 를 찾지 못했다')
  return ts.transpileModule(`function __effect() {\n${m[1]}\n}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  }).outputText + '\nreturn __effect'
}

function mount(state: 'hidden' | 'meaning-shown' | 'example-shown') {
  const listeners: ((e: unknown) => void)[] = []
  const deps = {
    state,
    ownsSession: () => true,
    revealMeaning: vi.fn(),
    revealExample: vi.fn(),
    playMain: vi.fn(),
    rateWord: vi.fn(),
    nativeControlOwnsKey,
    window: {
      addEventListener: (_t: string, f: (e: unknown) => void) => listeners.push(f),
      removeEventListener: (_t: string, f: (e: unknown) => void) => listeners.splice(listeners.indexOf(f), 1),
    },
  }
  const names = Object.keys(deps)
  const effect = new Function(...names, extractKeyboardEffect())(...names.map((k) => deps[k as keyof typeof deps])) as () => () => void
  effect()
  const press = (key: string, code: string, target: Record<string, unknown>) => {
    const e = { key, code, target, preventDefault: vi.fn() }
    for (const l of [...listeners]) l(e)
    return e
  }
  return { deps, press }
}

// nativeControlOwnsKey 는 closest(선택자) 로 조작부를 찾는다 — 단추 · 단추 안 글자 · 본문 영역 대역
const button = (): Record<string, unknown> => { const el: Record<string, unknown> = { tagName: 'BUTTON' }; el.closest = () => el; return el }
const insideButton = (): Record<string, unknown> => { const b = button(); return { tagName: 'SPAN', closest: () => b } }
const body = { tagName: 'DIV', closest: () => null }

describe('WordVault 학습 · Space', () => {
  it('초점된 평가 단추(또는 그 안 글자)의 Space 는 가로채지 않는다 — preventDefault · 공개 · 재생 0(단추 click 이 평가)', () => {
    for (const t of [button(), insideButton()]) {
      const c = mount('example-shown')
      const e = c.press(' ', 'Space', t)
      expect(e.preventDefault).not.toHaveBeenCalled()
      expect(c.deps.playMain).not.toHaveBeenCalled()
      expect(c.deps.rateWord).not.toHaveBeenCalled()
    }
  })

  it('본문 영역 Space 는 기존대로 공개 → 공개 → 재생', () => {
    expect(mount('hidden').press(' ', 'Space', body).preventDefault).toHaveBeenCalled()
    const h = mount('hidden'); h.press(' ', 'Space', body); expect(h.deps.revealMeaning).toHaveBeenCalledTimes(1)
    const m = mount('meaning-shown'); m.press(' ', 'Space', body); expect(m.deps.revealExample).toHaveBeenCalledTimes(1)
    const x = mount('example-shown'); x.press(' ', 'Space', body); expect(x.deps.playMain).toHaveBeenCalledTimes(1)
  })

  it('숫자 평가는 그대로(예문 공개 뒤 · 단추에 초점이 있어도 1회)', () => {
    const c = mount('example-shown')
    c.press('3', 'Digit3', button())
    expect(c.deps.rateWord).toHaveBeenCalledTimes(1)
    expect(c.deps.rateWord).toHaveBeenCalledWith(3)
    const h = mount('hidden'); h.press('3', 'Digit3', body); expect(h.deps.rateWord).not.toHaveBeenCalled()
  })

  it('입력칸 · 세션 주인 아님은 기존처럼 무시', () => {
    const c = mount('hidden')
    c.press(' ', 'Space', { tagName: 'INPUT', closest: () => null })
    expect(c.deps.revealMeaning).not.toHaveBeenCalled()
  })
})
