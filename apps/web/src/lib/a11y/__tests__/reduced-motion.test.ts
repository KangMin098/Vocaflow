// apps/web/src/lib/a11y/__tests__/reduced-motion.test.ts
//
// **`prefers-reduced-motion` 은 끄기가 아니라 낮추기다** — 전역 규칙이 되돌아가는 것을 막는다.
//
// ── 왜 이 회귀가 필요한가 ────────────────────────────────────────────────
// 인터넷에 널리 도는 스니펫은 이렇게 생겼다:
//
//   @media (prefers-reduced-motion: reduce) {
//     * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
//   }
//
// 손에 익어서 누구든 다시 적게 되는데, 이 저장소의 디자인 정본(`vocaflow-design` §5.1)은
// 정반대를 요구한다 — **이동·회전·스케일은 걷어내되 페이드는 남긴다.** 전부 0.01ms 로
// 죽이면 상태가 바뀌었다는 사실 자체가 사라져서, 모션에 민감한 학습자만 정답/오답 피드백과
// 패널 펼침을 **못 보고 지나친다.** 접근성을 위한 규칙이 접근성을 깎는 셈이다.
//
// 실제로 v06.34 까지 그 상태였다(2026-09-05 실측).
//
// ⚠️ 이 검사는 CSS **텍스트**를 읽는다. 브라우저 렌더 검증이 아니라 "규칙이 되돌아갔는가" 만
//    본다 — 그것이 이 결함이 재발하는 방식이기 때문이다(누군가 스니펫을 다시 붙여넣는다).

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const CSS = fs.readFileSync(
  path.resolve(__dirname, '../../../app/globals.css'),
  'utf8',
)

/** 전역 `prefers-reduced-motion` 블록 — 전체 선택자(`*`)를 건드리는 것만 고른다. */
function globalReducedMotionBlocks(): string[] {
  const out: string[] = []
  const re = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g
  while (re.exec(CSS) !== null) {
    // 중괄호 균형을 세어 블록 끝을 찾는다 — 정규식만으로는 중첩을 못 읽는다.
    let depth = 1
    let i = re.lastIndex
    while (i < CSS.length && depth > 0) {
      if (CSS[i] === '{') depth++
      else if (CSS[i] === '}') depth--
      i++
    }
    const body = CSS.slice(re.lastIndex, i - 1)
    if (/(^|\s|,)\*\s*[,{]/.test(body)) out.push(body)
  }
  return out
}

describe('prefers-reduced-motion — 끄기가 아니라 낮추기 (vocaflow-design §5.1)', () => {
  const blocks = globalReducedMotionBlocks()

  it('전역 블록이 실제로 있다 (사라지면 이 검사가 알리바이가 된다)', () => {
    expect(blocks).toHaveLength(1)
  })

  it('상태 전환을 0으로 죽이지 않는다 — 페이드는 남는다', () => {
    const body = blocks[0]
    const transition = body.match(/transition-duration:\s*([^;!]+)/)
    expect(transition, 'transition-duration 선언이 없다').not.toBeNull()
    const value = transition![1].trim()
    // 0.01ms · 0s · 0ms 는 전부 "안 보이게 하기" 다.
    expect(value, `전환을 죽이고 있다: ${value}`).not.toMatch(/^0(\.0+)?(m?s)?$/)
    expect(value).not.toBe('0.01ms')
    // 토큰을 쓴다 — 숫자를 손으로 박으면 모션 예산과 어긋난다.
    expect(value).toContain('--dur-')
  })

  it('전환 대상을 움직이지 않는 속성으로 제한한다', () => {
    const body = blocks[0]
    const prop = body.match(/transition-property:\s*([^;!]+)/)
    expect(prop, 'transition-property 를 제한하지 않으면 100ms 전환이 all 에 걸린다').not.toBeNull()
    const list = prop![1]
    expect(list, '페이드는 반드시 남는다').toContain('opacity')
    // 이동·회전·스케일·레이아웃은 중간 프레임 없이 즉시 최종값으로.
    for (const banned of ['transform', 'translate', 'rotate', 'scale', 'width', 'height', 'all']) {
      expect(list, `${banned} 는 전환 대상이 아니다`).not.toContain(banned)
    }
  })

  it('transform 을 지우지 않는다 — 중앙 정렬이 무너진다', () => {
    // `-translate-x-1/2` 로 가운데 맞추는 요소가 많아 `transform: none` 은 레이아웃을 깬다.
    expect(blocks[0]).not.toMatch(/transform:\s*none/)
  })

  it('루프·앰비언트 애니메이션은 끝난다', () => {
    // 여기서 시간을 늘리면 `breathing`(4s) 같은 것이 빠른 팝이 되어 더 나쁘다 —
    // 키프레임은 끄고, 페이드가 필요한 표면만 개별적으로 되살린다.
    expect(blocks[0]).toMatch(/animation-iteration-count:\s*1/)
  })

  it('페이드가 필요한 표면은 개별적으로 되살아난다', () => {
    // 전역이 키프레임을 끄므로, 진입 연출이 필요한 곳은 자기 규칙으로 페이드를 남겨야 한다.
    expect(CSS).toMatch(/\.wayfinder-reveal\s*\{[^}]*animation-name:\s*wayfinder-fade/)
  })
})
