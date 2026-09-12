// packages/video-factory/src/__tests__/typography.test.ts
//
// **한글 조판 규칙을 잠근다.**
//
// 왜 이 파일이 따로 있나: 실제로 어겼기 때문이다(2026-09-12 렌더 스틸).
//   · 닫는 컷의 한국어가 **가짜 이탤릭**으로 나왔다 — Lora 에 한글이 없어 시스템 고딕이
//     기울어졌다. CLAUDE.md 「절대 하지 않을 것 · Typography」의 **한글에 Lora** 위반이다.
//   · 글리프 확인 스틸에서 한국어가 낱말 중간("아 / 는")에서 쪼개졌다 — I7 위반.
// 둘 다 **오류가 나지 않는 결함**이라 사람이 화면을 볼 때만 발견된다. 그래서 잠근다.
//
// 소스 문자열을 직접 읽는다(렌더 없이) — 렌더는 느리고, 규칙은 코드에 있다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { hasHangul, voiceFont } from '../remotion/Frame'
import { FONT } from '../theme/palette'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '..')

function sourceFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? e.name === '__tests__'
          ? []
          : sourceFiles(path.join(dir, e.name))
        : /\.tsx?$/.test(e.name)
          ? [path.join(dir, e.name)]
          : [],
    )
}

describe('한글에 Lora·이탤릭을 걸지 않는다', () => {
  it('한글 문장은 본문 서체 정체로 그린다', () => {
    const s = voiceFont('내 지문으로 바로 재 보세요.')
    expect(s.fontFamily).toBe(FONT.body)
    expect(s.fontStyle).toBe('normal')
  })

  it('영문 문장만 Lora italic 을 쓴다', () => {
    const s = voiceFont('Every reader encounters the same page differently.')
    expect(s.fontFamily).toBe(FONT.english)
    expect(s.fontStyle).toBe('italic')
  })

  it('한글 판정이 자모·완성형을 모두 잡는다', () => {
    expect(hasHangul('가')).toBe(true)
    expect(hasHangul('ㄱ')).toBe(true)
    expect(hasHangul('abc 123 %')).toBe(false)
  })

  it('컷 컴포넌트에 italic 하드코딩이 남아 있지 않다', () => {
    // `voiceFont()` 를 거치지 않고 직접 기울이면 한글이 다시 찌그러진다.
    const offenders: string[] = []
    for (const f of sourceFiles(path.join(SRC, 'remotion'))) {
      const text = fs.readFileSync(f, 'utf8')
      // 주석과 `voiceFont` 정의 자체는 뺀다.
      if (f.endsWith('Frame.tsx')) continue
      if (/fontStyle:\s*'italic'/.test(text)) offenders.push(path.relative(SRC, f))
    }
    expect(offenders).toEqual([])
  })
})

describe('한글 줄바꿈 — 낱말을 쪼개지 않는다', () => {
  it('틀이 keep-all 을 깔고 있다', () => {
    const frame = fs.readFileSync(path.join(SRC, 'remotion/Frame.tsx'), 'utf8')
    expect(frame).toContain("wordBreak: 'keep-all'")
  })

  it('자막 영역이 KO 를 쓴다', () => {
    const frame = fs.readFileSync(path.join(SRC, 'remotion/Frame.tsx'), 'utf8')
    // 자막 블록 안에 전개 연산자로 KO 가 들어가 있어야 한다.
    const caption = frame.slice(frame.indexOf('{/* 자막 */}'))
    expect(caption.slice(0, 600)).toContain('...KO')
  })
})

describe('색은 토큰에서만 온다', () => {
  it('theme/palette.ts 에 새 hex 리터럴이 없다', () => {
    const palette = fs.readFileSync(path.join(SRC, 'theme/palette.ts'), 'utf8')
    const hexes = palette.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(hexes).toEqual([])
  })

  it('컷 컴포넌트에 hex 리터럴이 없다', () => {
    const offenders: string[] = []
    for (const f of sourceFiles(path.join(SRC, 'remotion'))) {
      const text = fs.readFileSync(f, 'utf8')
      const hexes = text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
      if (hexes.length > 0) offenders.push(`${path.relative(SRC, f)}: ${hexes.join(' ')}`)
    }
    expect(offenders).toEqual([])
  })
})
