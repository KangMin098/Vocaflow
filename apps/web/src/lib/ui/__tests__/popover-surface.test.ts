// apps/web/src/lib/ui/__tests__/popover-surface.test.ts
//
// **앵커형 팝오버는 역할별 껍데기 두 벌 중 하나를 쓰고, 열려 있으면 Esc 로 닫힌다**(DD-83 · learner-tines-audit).
// 모서리·그림자를 파일마다 손으로 적으면 다음 팝오버가 또 자기 껍데기를 그린다(2026-10-18 실측: 모서리 md/lg/xl ·
// 그림자 md/lg/xl 이 섞여 있었다). 두 벌의 값은 tines.com 실측(드롭다운 10px · 검색 패널 16px)이다 — `tines-kit.ts`.
// 모달은 `components/ui/Dialog` 가 맡으므로 여기서 다루지 않는다.

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const C = path.resolve(__dirname, '../../../components')
const read = (rel: string) => readFileSync(path.join(C, rel), 'utf8')

/** 목록·설정형 → MENU · 본문 위 내용 면 → CARD */
const SURFACE: Array<[string, 'POPOVER_MENU' | 'POPOVER_CARD']> = [
  ['workspace/TypePopover.tsx', 'POPOVER_MENU'],
  ['workspace/WorkspaceChapterNav.tsx', 'POPOVER_MENU'],
  ['workspace/FloatingSparkle.tsx', 'POPOVER_CARD'],
  ['workspace/SupportGloss.tsx', 'POPOVER_CARD'],
  ['workspace/RecallCard.tsx', 'POPOVER_CARD'],
  ['library/reader/WordLookupPopover.tsx', 'POPOVER_CARD'],
]

describe('팝오버 껍데기', () => {
  it.each(SURFACE)('%s 는 %s 를 쓴다', (rel, kind) => {
    const src = read(rel)
    expect(src).toMatch(new RegExp(`import \\{[^}]*\\b${kind}\\b[^}]*\\} from '@/components/ui/tines-kit'`))
    expect(src).toContain('${' + kind + '}')
  })

  it.each(SURFACE.map(([rel]) => rel))('%s 는 껍데기 그림자를 손으로 다시 적지 않는다', (rel) => {
    expect(read(rel)).not.toMatch(/border border-\[var\(--bd\)\] bg-\[var\(--bg\)\][^`"]*shadow-\[var\(--sh-(lg|xl)\)\]/)
  })

  it('두 벌의 값은 참조 실측과 같다(모서리 10 · 16)', () => {
    const kit = read('ui/tines-kit.ts')
    expect(kit).toMatch(/POPOVER_MENU = 'rounded-\[10px\]/)
    expect(kit).toMatch(/'rounded-\[16px\]/)
  })
})

describe('Esc 로 닫기', () => {
  const ESC = [
    'workspace/FloatingSparkle.tsx',
    'workspace/InsightPanel.tsx',
  ]
  it.each(ESC)('%s 는 열린 동안 useEscapeKey 를 건다', (rel) => {
    expect(read(rel)).toMatch(/useEscapeKey\(/)
  })

  it('훅은 닫힌 동안 듣지 않는다(바깥 Esc 를 삼키지 않게)', () => {
    const hook = readFileSync(path.resolve(__dirname, '../use-escape-key.ts'), 'utf8')
    expect(hook).toMatch(/if \(!active\) return/)
  })
})

describe('타이포 설정', () => {
  it('열기만 해서는 본문을 바꾸지 않는다 — 고를 때만 적용·저장', () => {
    const src = read('workspace/TypePopover.tsx')
    expect(src).toMatch(/useState<ReaderTypePrefs>\(readReaderTypePrefs\)/)
    // 예전 결함: 마운트 효과가 초기값(19px)을 곧바로 문서에 썼다
    expect(src).not.toMatch(/useEffect\(\(\) => \{\s*document\.documentElement\.style\.setProperty\('--reader-font-size'/)
  })

  it('「기본」 칸 = 실제 기본값(15px · 1.55)', async () => {
    const { READER_TYPE_DEFAULT } = await import('@/lib/reader/type-prefs')
    const src = read('workspace/TypePopover.tsx')
    expect(src).toContain(`{ px: ${READER_TYPE_DEFAULT.fontSize}, label: 'A', size: 12, name: '기본' }`)
    expect(src).toContain(`{ value: ${READER_TYPE_DEFAULT.lineHeight}, label: '기본'`)
    const css = readFileSync(path.resolve(__dirname, '../../../app/globals.css'), 'utf8')
    expect(css).toMatch(new RegExp(`--reader-font-size:\\s*${READER_TYPE_DEFAULT.fontSize}px`))
    expect(css).toMatch(new RegExp(`--reader-line-height:\\s*${READER_TYPE_DEFAULT.lineHeight}`))
  })
})
