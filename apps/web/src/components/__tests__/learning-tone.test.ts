// apps/web/src/components/__tests__/learning-tone.test.ts
//
// **한글 글꼴의 성능 · 빌드 가드** — 루트 레이아웃의 한글 웹폰트가 preload 로 모든 페이지를 무겁게 하지 않고,
// 빌드가 외부 글꼴 서버(Google Fonts)에 묻지 않는다.
//
// 디자인·UX 금지 검사 16건(콘페티·PartyPopper·D6 오류색·하드코딩 ms·유령 예외·주묵 3건·한글 글꼴 로드·
// 라틴 전용 스택·emoji·Sparkles)은 DD-66(사용자 결정 2026-09-21)으로 삭제했다.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

/**
 * ⚠️ **주석을 먼저 걷어낸다.** 2026-09-16 에 이 검사가 layout.tsx 의 JSDoc 문자열을 선언으로 집어
 * 실패한 적이 있다. 코드를 보는 검사는 주석을 먼저 지운다.
 */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\n]*?\/\/[^\n]*$/gm, (m) => m.split('//')[0])

describe('v07 — 한글 글꼴', () => {
  const layout = () => stripComments(readFileSync(join(SRC, 'app', 'layout.tsx'), 'utf8'))

  it('빌드가 Google Fonts 다운로드에 의존하지 않는다 — next/font/google 금지(v6.2 P-F7e)', () => {
    /**
     * next/font/google 은 빌드 중 fonts.googleapis.com 에서 받는다. CI 가 그 다운로드 실패로
     * 간헐적으로 깨졌다(PR #246 · #254). 글꼴은 @fontsource(OFL) 패키지에서 읽는다.
     */
    expect(layout()).not.toMatch(/next\/font\/google/)
    expect(layout()).not.toMatch(/fonts\.googleapis\.com/)
  })

  it('한글 글꼴은 자체 호스팅 CSS 로 싣고 preload 하지 않는다', () => {
    /**
     * 한글은 굵기마다 unicode-range 조각 약 90개다. preload 하면 그 조각을 **전부** 받는다 —
     * 공개 사례로 281조각 2.32MB 가 모든 페이지에서 preload 된 것이 보고돼 있다.
     * 이건 화면을 깨지 않고 느리게만 만든다 = 혼자서는 절대 안 발견된다.
     * @font-face CSS 는 preload 를 만들지 않는다 — 레이아웃에 글꼴 preload 링크가 없어야 한다.
     */
    const src = layout()
    expect(src).toMatch(/@fontsource\/ibm-plex-sans-kr\/\d00\.css/)
    expect(src).toMatch(/@fontsource\/hahmlet\/\d00\.css/)
    expect(src).not.toMatch(/rel=["']preload["'][^>]*font/)
  })
})
