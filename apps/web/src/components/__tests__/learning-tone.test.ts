// apps/web/src/components/__tests__/learning-tone.test.ts
//
// **한글 글꼴의 성능 가드** — 루트 레이아웃의 한글 웹폰트가 preload 로 모든 페이지를 무겁게 하지 않는다.
//
// 디자인·UX 금지 검사 16건(콘페티·PartyPopper·D6 오류색·하드코딩 ms·유령 예외·주묵 3건·한글 글꼴 로드·
// 라틴 전용 스택·emoji·Sparkles)은 DD-66(사용자 결정 2026-09-21)으로 삭제했다.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

describe('v07 — 한글 글꼴', () => {
  const layout = () => readFileSync(join(SRC, 'app', 'layout.tsx'), 'utf8')

  it('한글 글꼴에 preload 를 켜지 않는다', () => {
    /**
     * Google Fonts 의 한글은 `unicode-range` 로 수백 조각으로 쪼개져 온다.
     * `next/font` 의 preload 기본값(true)이면 그 조각을 **전부** preload 한다 —
     * 공개 사례로 281조각 2.32MB 가 모든 페이지에서 preload 된 것이 보고돼 있다.
     * 이건 화면을 깨지 않고 느리게만 만든다 = 혼자서는 절대 안 발견된다.
     */
    /**
     * ⚠️ **주석을 먼저 걷어낸다.**
     *
     * 2026-09-16: 이 검사가 **자기 문서 때문에 실패**했다. `app/layout.tsx` 의 JSDoc 이
     * "`IBM_Plex_Sans_KR({...})` 로 선언했는데" 라고 적고 있었는데, 아래 추출기가 그 문자열을
     * 선언으로 집어 `preload: false` 가 없다고 판정했다. 코드는 멀쩡했다.
     * **코드를 보는 검사는 주석을 먼저 지운다.**
     */
    const stripComments = (s: string) =>
      s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\n]*?\/\/[^\n]*$/gm, (m) => m.split('//')[0])

    const src = stripComments(layout())
    for (const name of ['IBM_Plex_Sans_KR', 'Hahmlet']) {
      // 선언 블록(여는 괄호 ~ 닫는 괄호)을 잘라 그 안에 preload: false 가 있는지 본다.
      // 정규식을 만들지 않고 문자열로 자른다 — 템플릿 리터럴 안의 역슬래시가 조용히
      // 먹히면(`[\s\S]` → `[sS]`) 검사는 통과도 실패도 아닌 "못 찾음" 이 된다.
      const blocks: string[] = []
      let from = 0
      for (;;) {
        const at = src.indexOf(`${name}({`, from)
        if (at < 0) break
        const end = src.indexOf('})', at)
        if (end < 0) break
        blocks.push(src.slice(at, end))
        from = end
      }
      expect(blocks.length, `${name} 선언을 못 찾았다`).toBeGreaterThan(0)
      for (const b of blocks) {
        expect(b, `${name} 에 preload: false 가 없다`).toMatch(/preload:\s*false/)
      }
    }
  })
})
