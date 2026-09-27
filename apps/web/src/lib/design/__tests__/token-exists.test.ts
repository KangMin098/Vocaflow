// apps/web/src/lib/design/__tests__/token-exists.test.ts
//
// **코드가 부르는 CSS 변수가 실제로 정의돼 있는가.**
//
// ── 왜 이 검사가 필요한가 (같은 함정을 세 번 겪었다) ─────────────────────────
// 정의되지 않은 `var()` 는 **예외를 내지 않는다.** 브라우저는 그 선언을 통째로 버리고
// 조용히 다음으로 넘어간다. 화면은 멀쩡히 뜨고, 그 자리만 색을 잃는다.
//
//   ① 2026-08-22 — `components/library/CEFRBadge.tsx` 가 `var(--cefr-A1-bg)` 식으로 12개를
//      참조했는데 `tokens.css` 에 **하나도 없었다.** 다크에서 `/library` 의 A1~C2 배지가
//      1.08:1(사실상 안 보임)이었다. tokens.css 가 그때 이렇게 적었다 —
//      "이 저장소가 「색상 하드코딩 금지」를 지키느라 var() 를 썼는데 토큰이 없어서
//       오히려 색을 잃은 경우다 — **var() 는 오타를 알려 주지 않는다**".
//
//   ② 2026-09-16 — `/csat/*` 14파일이 `bg-[var(--sf)]`·`var(--sf-2)` 를 **80번** 불렀는데
//      둘 다 정의된 적이 없었다(실행 중 화면에서 확인: 빈 문자열). 카드 수십 장이
//      **배경 없이** 렌더돼 캔버스가 그대로 비쳤다. 아무도 오류를 보지 못했다.
//
//   ③ 같은 날 이 검사를 붙이자 **세 건이 더 나왔다** — /settings 의 `--danger`(저장 실패
//      알림이 배경도 글자색도 없이 떴다) · MorphmergeGame 의 `--ease-settle`(대체값이 없어
//      transition 선언이 통째로 버려졌다) · admin/video 의 `--bdw`.
//
// 세 번 같은 방식으로 당했으면 그건 우연이 아니라 **구조**다. 기계가 지킨다.
//
// ── 무엇을 세지 않는가 ────────────────────────────────────────────────────
// · `--font-*` 는 `next/font` 가 런타임에 html 클래스로 주입한다 — 소스에 정의가 없는 게 정상.
// · `--tw-*` 는 Tailwind 내부 변수다.
// · 컴포넌트가 **자기 스코프에서 직접 정의하고 쓰는** 지역 변수(같은 파일에 `--x:` 가 있다).
// · `--sidebar-w` 처럼 JS 가 `style.setProperty` 로 넣는 것 — 그 사실을 아래 목록에 적는다.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')
const TOKENS = join(process.cwd(), '..', '..', 'packages', 'design-tokens', 'src', 'tokens.css')
const GLOBALS = join(SRC, 'app', 'globals.css')

/** 런타임에 주입돼서 소스에 정의가 없는 것이 **정상**인 변수들. 이유를 함께 적는다. */
const RUNTIME_INJECTED: Record<string, string> = {
  '--sidebar-w': 'AppHeader 가 useEffect 에서 0px 으로 넣는다(v08.6 이전 사이드바 폭 — fixed 오버레이 오프셋)',
  '--m-accent': '아케이드 무드 색 — app/(main)/arcade/page.tsx 가 조상 요소의 인라인 style 로 넣는다',
  '--m-glow': '같은 곳에서 함께 넣는다',
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (name === 'node_modules' || name === '.next') continue
    // ⚠️ **테스트 자신을 건초더미에서 뺀다.** 이 파일의 주석이 `--sf` 를 예로 들고 있어서,
    //    섞이면 자기 문서 때문에 실패한다. 같은 함정을 이 저장소가 이미 두 번 겪었다
    //    (learning-tone §유령 예외 · preload 검사가 JSDoc 을 선언으로 집은 것).
    if (name === '__tests__') continue
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|css)$/.test(name)) out.push(p)
  }
  return out
}

/**
 * ⚠️ **주석을 먼저 지운다.**
 *
 * 이 저장소에서 주석은 장식이 아니라 **측정 기록**이라 코드 예시를 자주 담는다 —
 * `// ctx.strokeStyle = 'var(--x)' 는 조용히 무시된다` 같은 줄이 그대로 위반으로 잡힌다.
 * 같은 함정을 이 세션이 세 번 만났다(일괄 치환이 주석의 hex 를 바꾸고 · preload 검사가
 * JSDoc 을 선언으로 집고 · 여기). **코드를 보는 검사는 주석을 먼저 지운다.**
 */
function stripComments(s: string): string {
  // ⚠️ **지우지 않고 공백으로 덮는다.** 지우면 줄 수가 달라져서 위반 위치가 엉뚱한 줄을
  //    가리킨다 — 실제로 그렇게 보고했다가 그 줄에 아무것도 없는 것을 보고 알았다.
  //    길이와 줄바꿈을 보존해야 `:줄번호` 가 원본과 맞는다.
  const blank = (m: string) => m.replace(/[^\n]/g, ' ')
  return s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/[^\n]*/g, blank)
}

/** 정의된 변수 이름 전부 — `--x:` 꼴로 선언된 것. */
function definedNames(): Set<string> {
  const css = [TOKENS, GLOBALS].map((p) => readFileSync(p, 'utf8')).join('\n')
  const set = new Set<string>()
  for (const m of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) set.add(m[1])
  return set
}

const FILES = walk(SRC)
const DEFINED = definedNames()

describe('CSS 변수 — 부르는 이름이 실제로 정의돼 있다', () => {
  it('정의 목록을 실제로 읽었다', () => {
    // 0 이면 파일 경로가 틀린 것이다 — 그 상태로는 아래 검사가 전부 거짓 실패한다.
    expect(DEFINED.size, 'tokens.css / globals.css 에서 변수를 하나도 못 읽었다').toBeGreaterThan(80)
  })

  it('없는 변수를 부르는 곳이 없다', () => {
    const offenders: string[] = []
    for (const path of FILES) {
      // ⚠️ **주석을 먼저 지운다.** 이 저장소에서 주석은 측정 기록이라 코드 예시를 자주 담는다 —
      //    `// ctx.strokeStyle = 'var(--x)' 는 무시된다` 같은 줄이 위반으로 잡힌다.
      //    같은 함정을 세 번 겪었다(일괄 치환 · preload 검사 · 여기).
      const src = stripComments(readFileSync(path, 'utf8'))
      // 이 파일이 스스로 정의하는 지역 변수는 제외한다.
      // ⚠️ CSS 의 `--x:` 만 보면 안 된다. 아케이드·게임은 인라인 style 객체로
      //    `{ '--fall': ... }` 처럼 **JS 에서** 변수를 넘긴다 — 그것도 정의다.
      const local = new Set([
        ...[...src.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]),
        // `{ '--fall': … }` · `{ ['--m-accent']: … }` · `{ ['--cn-group' as string]: … }` 전부.
        ...[...src.matchAll(/['"`](--[a-zA-Z0-9-]+)['"`][^\n:]{0,24}:/g)].map((m) => m[1]),
      ])
      const lines = src.split('\n')
      lines.forEach((line, i) => {
        for (const m of line.matchAll(/var\((--[a-zA-Z0-9-]+)/g)) {
          const name = m[1]
          if (name.startsWith('--font-') || name.startsWith('--tw-')) continue
          const after = line.slice((m.index ?? 0) + m[0].length)
          // 이름을 실행 중에 조립하는 곳 — `var(--cefr-${band}-bg)`. 정적으로는 확인할 수 없다.
          // (그 조립 결과가 실재하는지는 `token-parity` 가 이름 쌍으로 따로 본다.)
          if (after.startsWith('${')) continue
          // **대체값이 있으면 안전하다** — `var(--el-3, 0 8px 24px …)` 는 토큰이 없어도
          // 그 값으로 그려진다. 이 검사가 잡으려는 것은 *조용히 사라지는* 선언이지
          // 의도적으로 기본값을 둔 자리가 아니다.
          if (/^\s*,/.test(after)) continue
          if (local.has(name) || DEFINED.has(name) || name in RUNTIME_INJECTED) continue
          offenders.push(`${path.slice(SRC.length + 1)}:${i + 1} ${name}`)
        }
      })
    }
    expect(
      offenders,
      [
        '정의되지 않은 CSS 변수를 부르고 있습니다.',
        '⚠️ 이건 오류를 내지 않습니다 — 브라우저가 그 선언을 통째로 버리고 화면은 멀쩡히 뜹니다.',
        '   그 자리만 색(또는 여백·반경)을 잃습니다. 같은 일이 CEFR 배지(2026-08-22)와',
        '   /csat 의 --sf(2026-09-16, 80곳)에서 이미 두 번 났습니다.',
        '토큰을 tokens.css 에 추가하거나, 이미 있는 정본 이름으로 바꾸세요.',
        '(같은 개념에 이름을 새로 만들지 말 것 — 갈라지면 한쪽만 고쳐집니다.)',
        '',
        ...offenders.slice(0, 40),
      ].join('\n'),
    ).toEqual([])
  })

  it('런타임 주입 목록이 유령이 아니다 — 적어 둔 것이 실제로 쓰인다', () => {
    // 목록이 낡으면 "예외라서 통과" 가 아무 의미 없는 면제가 된다(learning-tone §유령 예외와 같은 규칙).
    const haystack = FILES.map((p) => readFileSync(p, 'utf8')).join('\n')
    for (const name of Object.keys(RUNTIME_INJECTED)) {
      expect(haystack.includes(name), `${name} 은 예외 목록에 있는데 코드에 없다 — 유령 예외다`).toBe(
        true,
      )
    }
  })
})
