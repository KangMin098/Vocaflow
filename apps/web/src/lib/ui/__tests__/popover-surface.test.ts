// apps/web/src/lib/ui/__tests__/popover-surface.test.ts
//
// **앵커형 팝오버는 한 껍데기를 쓰고, 열려 있으면 Esc 로 닫힌다**(DD-83 · learner-tines-audit B4).
// 모서리·그림자를 파일마다 손으로 적으면 다음 팝오버가 또 자기 껍데기를 그린다(2026-10-18 실측: 모서리 md/lg/xl ·
// 그림자 md/lg/xl 이 9곳에 섞여 있었다). 모달은 `components/ui/Dialog` 가 맡으므로 여기서 다루지 않는다.

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const C = path.resolve(__dirname, '../../../components')
const read = (rel: string) => readFileSync(path.join(C, rel), 'utf8')

const SURFACE = [
  'workspace/TypePopover.tsx',
  'workspace/FloatingSparkle.tsx',
  'workspace/SupportGloss.tsx',
  'workspace/RecallCard.tsx',
  'workspace/WorkspaceChapterNav.tsx',
  'library/reader/WordLookupPopover.tsx',
]

describe('팝오버 껍데기', () => {
  it.each(SURFACE)('%s 는 POPOVER 를 쓴다', (rel) => {
    const src = read(rel)
    expect(src).toMatch(/import \{[^}]*\bPOPOVER\b[^}]*\} from '@\/components\/ui\/tines-kit'/)
    expect(src).toContain('${POPOVER}')
  })

  it.each(SURFACE)('%s 는 껍데기 그림자를 손으로 다시 적지 않는다', (rel) => {
    expect(read(rel)).not.toMatch(/border border-\[var\(--bd\)\] bg-\[var\(--bg\)\][^`"]*shadow-\[var\(--sh-(lg|xl)\)\]/)
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
