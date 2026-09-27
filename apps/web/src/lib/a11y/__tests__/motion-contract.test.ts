// apps/web/src/lib/a11y/__tests__/motion-contract.test.ts
//
// **앰비언트 모션(§4.5 살아 있는 표면)의 계약** — 되돌아가면 조용히 깨지는 넷을 지킨다.
//
// ── 왜 이 회귀가 필요한가 ────────────────────────────────────────────────
// 상시 루프는 「멋있어서」 넣는 것이라, 끄는 쪽이 빠져도 만든 사람 화면에서는 멀쩡해 보인다.
// 빠졌을 때 손해를 보는 사람은 **모션에 민감한 학습자**와 **기준선 캡처**뿐이고, 둘 다
// 말이 없다. 그래서 텍스트로 센다.
//
//   ① 루프·시차는 `prefers-reduced-motion: no-preference` **안에서만** 정의된다.
//      밖에서 정의하고 나중에 끄려 하면 §4.4 전역 규칙의 `!important` 와 싸워야 하고,
//      새 표면마다 되살리는 코드가 흩어진다(그 어긋남은 globals.css 가 이미 적어 두었다).
//   ② 앱 토글 후크는 `data-reduced-motion` **하나뿐**이다. `/settings` 「모션 감소」가
//      쓰는 그 속성이다(`components/layout/DevicePreferences.tsx`). 새 속성을 만들면
//      한쪽만 꺼진다 — OS 설정은 듣는데 앱 토글은 안 듣는 루프가 생긴다.
//   ③ `animation-timeline` 은 `@supports` 없이 쓰지 않는다. Firefox 안정판은 아직
//      플래그 뒤라, 감싸지 않으면 그 브라우저에서 **요소가 시작 위치에 굳는다**.
//   ④ 캡처 결정론 후크(`data-motion-freeze`)가 살아 있다. 사라지면 `docs/design/golden/`
//      픽셀 diff 가 프레임 차이를 디자인 차이로 읽는다.
//
// ⚠️ 이 검사는 CSS **텍스트**를 읽는다 — 렌더 검증이 아니라 "규칙이 되돌아갔는가" 만 본다.
//    자매 검사 `reduced-motion.test.ts` 와 같은 방식이고, 같은 이유다.

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const CSS_PATH = path.resolve(__dirname, '../../../app/globals.css')
const CSS = fs.readFileSync(CSS_PATH, 'utf8')

/** 주석을 지운 CSS — 주석 안의 예시 코드가 검사에 잡히지 않게 한다. */
const CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

/** `@media (prefers-reduced-motion: no-preference)` 블록들의 본문(중괄호 균형으로 끝을 찾는다). */
function noPreferenceBodies(): string[] {
  const out: string[] = []
  const re = /@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{/g
  while (re.exec(CODE) !== null) {
    let depth = 1
    let i = re.lastIndex
    while (i < CODE.length && depth > 0) {
      if (CODE[i] === '{') depth++
      else if (CODE[i] === '}') depth--
      i++
    }
    out.push(CODE.slice(re.lastIndex, i - 1))
  }
  return out
}

/** 상시 루프 클래스 — 여기 이름이 늘면 이 목록도 늘려야 한다(늘리는 것이 이 검사의 일이다). */
const LOOP_CLASSES = ['vf-float', 'vf-flow', 'vf-breathe'] as const
const TIMELINE_CLASSES = ['vf-parallax'] as const

describe('§4.5 살아 있는 표면 — 앰비언트 모션 계약', () => {
  const noPref = noPreferenceBodies()

  it('① 상시 루프는 `no-preference` 안에서만 정의된다', () => {
    expect(noPref.length).toBeGreaterThan(0)
    const inside = noPref.join('\n')
    for (const cls of LOOP_CLASSES) {
      // 클래스의 `animation` 선언이 블록 **안에** 있다.
      expect(inside, `.${cls} 의 루프 선언이 no-preference 블록 안에 없다`).toMatch(
        new RegExp(`\\.${cls}\\b[^{]*\\{[^}]*animation`),
      )
      // 블록 **밖**에는 그 클래스의 `animation` 선언이 없다.
      const outside = noPref.reduce((acc, body) => acc.replace(body, ''), CODE)
      expect(
        new RegExp(`\\.${cls}\\b[^{]*\\{[^}]*animation:\\s*vf-`).test(outside),
        `.${cls} 가 no-preference 밖에서도 애니메이션을 건다 — 끌 때 !important 와 싸우게 된다`,
      ).toBe(false)
    }
  })

  it('② 앱 토글 후크는 `data-reduced-motion` 하나뿐이다 (DevicePreferences 와 같은 이름)', () => {
    const inside = noPref.join('\n')
    for (const cls of [...LOOP_CLASSES, ...TIMELINE_CLASSES]) {
      expect(inside, `.${cls} 가 앱 토글(data-reduced-motion)을 안 본다`).toMatch(
        new RegExp(`\\[data-reduced-motion=['"]on['"]\\]\\)[^{]*\\.${cls}\\b`),
      )
    }
    // 새 후크를 만들지 않았는지 — `data-motion='calm'` 류가 들어오면 여기서 걸린다.
    const hooks = [...CODE.matchAll(/\[data-motion[^\]]*\]/g)].map((m) => m[0])
    for (const h of hooks) {
      expect(h, `모르는 모션 후크: ${h} — 후크가 갈라지면 한쪽만 꺼진다`).toBe('[data-motion-freeze]')
    }
  })

  it('③ `animation-timeline` 은 `@supports` 안에서만 쓴다', () => {
    // `@supports (animation-timeline: view())` 의 **조건문**은 선언이 아니다 — 같은 글자라
    // 그냥 세면 자기 자신이 "감싸지지 않은 사용" 으로 잡힌다. 조건문은 먼저 지운다.
    const uses = [...CODE.replace(/@supports\s*\([^)]*\)\s*\)?/g, (s) => ' '.repeat(s.length))
      .matchAll(/animation-timeline\s*:/g)]
    expect(uses.length, 'animation-timeline 을 아무 데도 안 쓴다 — 시차가 사라졌나?').toBeGreaterThan(0)
    for (const u of uses) {
      const before = CODE.slice(0, u.index)
      const supports = before.lastIndexOf('@supports')
      expect(supports, '@supports 없이 쓰인 animation-timeline').toBeGreaterThan(-1)
      // 그 `@supports` 블록이 아직 안 닫혔는지 — 중괄호 균형으로 본다.
      const after = CODE.slice(supports, u.index)
      const depth = (after.match(/\{/g) ?? []).length - (after.match(/\}/g) ?? []).length
      expect(depth, '@supports 블록 밖에서 쓰인 animation-timeline').toBeGreaterThan(0)
      expect(CODE.slice(supports, supports + 80)).toMatch(/animation-timeline\s*:\s*(scroll|view)\(/)
    }
  })

  it('④ 캡처 결정론 후크가 살아 있다 — 끄지 않고, 목록이 아니라 전부 세운다', () => {
    expect(CODE).toMatch(/\[data-motion-freeze\][^{]*\{[^}]*animation-play-state:\s*paused/)
    expect(CODE).toMatch(/animation-delay:\s*calc\(var\(--scene-time[^)]*\)\s*\*\s*-1s\)/)
    // `*` 여야 한다. 클래스 목록으로 좁히면 §4.5 **밖의** 루프(마키 40s · 스피너)가 빠지고,
    // 기준선 캡처는 그 차이를 디자인 변화로 읽는다(2026-09-23 실측: 0.89% 흔들림).
    expect(
      /\[data-motion-freeze\]\s*\*[^{]*\{[^}]*animation-play-state:\s*paused/.test(CODE),
      'freeze 가 전체 선택자가 아니다 — §4.5 밖의 루프가 안 선다',
    ).toBe(true)
    // 진입 애니메이션을 `animation: none` 으로 끄면 시작 프레임(opacity 0)에 굳어
    // **투명한 화면**이 찍힌다 — freeze 가 rise 를 끄고 있지 않은지 본다.
    const freezeRules = [...CODE.matchAll(/\[data-motion-freeze\][^{]*\{[^}]*\}/g)].map((m) => m[0])
    const killsRise = freezeRules.some((r) => /\.vf-rise\b/.test(r) && /animation:\s*none/.test(r))
    expect(killsRise, 'freeze 가 .vf-rise 를 꺼 버린다 — 투명한 화면이 찍힌다').toBe(false)
  })

  it('낮추기다 — `reduce` 에서도 진입은 페이드로 남는다 (끄지 않는다)', () => {
    expect(CODE).toMatch(/\.vf-rise\s*\{[^}]*animation-name:\s*vf-fade/)
    expect(CODE).toMatch(/@keyframes\s+vf-fade\b/)
  })
})
