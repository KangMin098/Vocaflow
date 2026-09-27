// packages/video-factory/src/__tests__/typography.test.ts
//
// **한글 줄바꿈을 잠근다.**
//
// 왜 이 파일이 따로 있나: 실제로 어겼기 때문이다(2026-09-12 렌더 스틸).
//   · 글리프 확인 스틸에서 한국어가 낱말 중간("아 / 는")에서 쪼개졌다 — I7 위반.
// **오류가 나지 않는 결함**이라 사람이 화면을 볼 때만 발견된다. 그래서 잠근다.
//
// 소스 문자열을 직접 읽는다(렌더 없이) — 렌더는 느리고, 규칙은 코드에 있다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { hasHangul } from '../remotion/Frame'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '..')

// 디자인 금지 검사 5건은 DD-66(사용자 결정 2026-09-21)으로 삭제했다.

describe('한글 판정', () => {
  it('한글 판정이 자모·완성형을 모두 잡는다', () => {
    expect(hasHangul('가')).toBe(true)
    expect(hasHangul('ㄱ')).toBe(true)
    expect(hasHangul('abc 123 %')).toBe(false)
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
