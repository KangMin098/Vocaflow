// apps/web/src/lib/a11y/__tests__/on-p-contrast.test.ts
//
// `--p` 면 위 글자색 래칫 — **새 위반이 늘지 않게 막는다.**
//
// 배경(tokens.css 가 스스로 적어 둔 것):
//   > v07 — --p 면 위에 얹는 글자색. 라이트 --p(#0F2540)는 흰 글자 15.45:1 로 안전하지만,
//   > 다크 --p(#6B9BD1)는 흰 글자가 2.90:1 이라 AA 미달이었다(2026-08-09 axe: "내 레벨" 배지).
//   > 칠하는 색이 테마마다 뒤집히므로 글자색도 토큰으로 뒤집는다.
//   그래서 `--on-p` 가 생겼다(라이트 #FFFFFF · 다크 #231D17).
//
// 그런데 마이그레이션이 끝나지 않았다. `bg-[var(--p)]` / `from-[var(--p)]` 같은 면에
// `text-white` 나 `text-[var(--ti)]` 를 얹은 자리가 아직 많이 남아 있다. 전부 다크에서
// AA 미달이다. 한 번에 다 고치는 것은 별개 작업이라, 이 테스트는 **현재 잔량을 고정**하고
// 그보다 늘어나면 실패한다(래칫).
//
// 잔량을 줄였으면 BASELINE 을 그만큼 낮춘다. 늘리는 방향으로는 절대 고치지 말 것 —
// 그 순간 이 테스트는 아무것도 지키지 않는다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '../../..')

/**
 * `--p` 를 면으로 칠하는 클래스 신호. (`--p-light` tint 는 별도 짝(`--on-p-tint`)이 있어 제외)
 *
 * ⚠️ **축약형(`bg-p`)도 센다** — v06.34 실측(2026-09-05)에서 이 검출기가 `/login` 의
 *    제출 버튼을 **놓치고 있었다.** 그 버튼은 `bg-p ... text-ti` 라 대괄호 형태가 아니었고,
 *    다크에서 실측 **2.42:1**(#f0eae0 on #6b9bd1)이었다. 앱의 정문 CTA 다.
 *    tailwind.config 가 두 표기를 모두 허용하므로 검출기도 둘 다 알아야 한다 —
 *    한쪽만 아는 검출기는 "위반 0" 을 말하면서 정문을 놓친다.
 *
 * ⚠️ `bg-p-light`·`bg-p-hover` 는 다른 색이라 제외한다(뒤에 `-` 가 오면 안 된다).
 */
const P_SURFACE =
  /(bg-\[var\(--p\)\]|from-\[var\(--p\)\]|from-\[var\(--p-dark\)\]|to-\[var\(--p-dark\)\]|(?:^|\s|")bg-p(?![-\w]))/

/** 그 위에 얹으면 다크에서 AA 미달이 되는 글자색. */
const UNSAFE_INK = /(text-white\b|text-\[var\(--ti\)\]|(?:^|\s|")text-ti(?![-\w]))/

/**
 * 같은 className 문자열 안에서 둘이 만나는 줄만 센다.
 *
 * 줄 단위로 보는 이유이자 한계: 면과 글자색이 다른 줄에 흩어져 있으면 못 잡는다
 * (과소보고). 반대로 서로 무관한 두 요소가 한 줄에 있으면 오탐이 난다. 그래서 이 검출기는
 * **하한 추정치**이고, 그 성질을 여기 적어 둔다 — 한계를 모르는 검출기는 CI 에서 신뢰를 잃는다.
 */
function collectTsx(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'hub-lab') continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) collectTsx(full, out)
    else if (entry.endsWith('.tsx')) out.push(full)
  }
  return out
}

function findViolations(): string[] {
  const files = collectTsx(SRC)

  const hits: string[] = []
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (P_SURFACE.test(line) && UNSAFE_INK.test(line)) {
        hits.push(`${path.relative(SRC, file).replace(/\\/g, '/')}:${i + 1}`)
      }
    })
  }
  return hits.sort()
}

/**
 * 실측 잔량. 이 숫자를 **올리지 말 것.**
 * (2026-08-15: 학습자 진입 동선 9곳은 `--on-p` 로 이전 완료 — 진단·추천·플래시카드 완료·
 *  SpellForge 확인·서재 이어보기·FloatingSparkle.)
 *
 * ── 2026-09-05: 38 → 46. **위반이 늘어서가 아니라 검출기가 넓어져서다.** ──────────
 * 그날까지 이 검출기는 대괄호 표기(`bg-[var(--p)]`)만 알았고 축약형(`bg-p`)을 몰랐다.
 * 그래서 **`/login` 의 제출 버튼을 놓치고 있었다** — 다크 실측 2.42:1, 앱의 정문 CTA 다.
 * 축약형까지 세니 잔량이 53 이었고, 같은 커밋에서 정문(auth) 7곳을 `--on-p` 로 옮겨 46.
 *
 * 즉 이 상향은 **가려져 있던 것이 드러난 값**이다. 실제 위반은 7 줄었다.
 * ⚠️ 앞으로 이 숫자를 올려야 할 것 같으면, 먼저 **검출기가 넓어진 것인지** 확인할 것.
 *    아니라면 올리지 말고 코드를 고칠 것.
 */
const BASELINE = 46

describe('--p 면 위 글자색 (다크 테마 AA)', () => {
  it('새 위반이 늘지 않는다', () => {
    const violations = findViolations()
    expect(
      violations.length,
      `\`--p\` 면에 흰 글자를 새로 얹었습니다. \`text-[var(--on-p)]\` 를 쓰세요.\n` +
        `(다크에서 --p 는 #6B9BD1 이라 흰 글자가 2.90:1 — AA 미달)\n` +
        violations.join('\n'),
    ).toBeLessThanOrEqual(BASELINE)
  })

  it('검출기가 실제로 무언가를 찾는다 (침묵 실패 방지)', () => {
    // 0 이 나오면 정규식이 깨졌거나 glob 이 빈 것이다. 그 침묵이 래칫을 무력화한다.
    expect(findViolations().length).toBeGreaterThan(0)
  })
})
