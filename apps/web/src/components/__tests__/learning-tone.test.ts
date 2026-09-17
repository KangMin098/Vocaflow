// apps/web/src/components/__tests__/learning-tone.test.ts
//
// **학습 화면의 어조와 모션 예산** — CLAUDE.md §🚫 학습 UX · §🎯 D6 · DESIGN_SYSTEM §🎯 3.
//
// 왜 기계가 지켜야 하나:
//   이 규칙들은 지침에만 있었고 강제하는 것이 없었다. 그리고 어기는 방식이 **눈에 안 띈다** —
//   빨간 배지 하나, 하드코딩된 600ms 하나는 화면을 멀쩡히 뜨게 하면서 제품 철학만 깎는다.
//   2026-09-06 실측으로 세 건이 실제로 있었다(아래 각 검사의 근거 주석).
//
// ⚠️ 이 검사는 **정적**이다. 색 토큰 이름과 클래스 문자열을 본다 — 렌더 결과가 아니라.
//    그래도 "완료 화면에 오류색을 다시 들이는" 종류의 회귀는 잡는다.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')
const COMPONENTS = join(SRC, 'components')

/**
 * 아케이드(`components/game/`)는 제외한다.
 *
 * DESIGN_SYSTEM 이 이미 게임에 하드코딩 색 예외를 준다(§게임 전용 하드코딩 색상). 모션도 같다 —
 * 게임의 리듬은 학습 화면의 차분함과 다른 축이고, 그 판단은 각 게임이 한다.
 * **학습 모듈은 예외가 아니다.**
 */
const ARCADE = join(COMPONENTS, 'game')

function walk(dir: string): string[] {
  let out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (p.startsWith(ARCADE)) continue
    if (name === 'dist' || name === '.next' || name === 'node_modules') continue
    if (name === '__tests__' || name === 'node_modules') continue
    if (statSync(p).isDirectory()) out = out.concat(walk(p))
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const FILES = walk(COMPONENTS).map((path) => ({ path, src: readFileSync(path, 'utf8') }))
const BACKSLASH = String.fromCharCode(92)
/** 경로를 src 기준 슬래시 표기로 — Windows 구분자를 통일한다. */
const rel = (p: string) => p.slice(SRC.length + 1).split(BACKSLASH).join("/")

describe('학습 UX — 축하로 압박하지 않는다', () => {
  it('콘페티·폭죽 라이브러리를 들이지 않는다', () => {
    // 진행률 100% 에 폭죽을 터뜨리는 것은 CLAUDE.md 가 이름 대어 금지한 패턴이다
    // (차분한 "오늘 잘 마쳤어요" 선호). 라이브러리가 들어오는 순간 쓰게 된다.
    const pkg = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    expect(pkg).not.toMatch(/confetti|firework/i)

    const offenders = FILES.filter(({ src }) => /from '[^']*confetti/i.test(src)).map(({ path }) =>
      rel(path),
    )
    expect(offenders, `콘페티 라이브러리를 쓴다: ${offenders.join(', ')}`).toEqual([])
  })

  it('폭죽 아이콘(PartyPopper)을 학습자 화면에 두지 않는다', () => {
    const offenders = FILES.filter(({ src }) => src.includes('PartyPopper')).map(({ path }) =>
      rel(path),
    )
    expect(offenders, `폭죽 아이콘: ${offenders.join(', ')}`).toEqual([])
  })
})

describe('D6 — 완료·결과 화면이 오류색으로 성과를 세지 않는다', () => {
  /**
   * 완료·결과 화면 — 학습을 **끝낸** 사람이 보는 자리.
   *
   * 여기서 빨간 숫자는 "이만큼 틀렸다" 로 읽힌다. 그게 CLAUDE.md 가 금지한 「정답률 빨간 글씨
   * 압박」이고 철학 3(Empathetic Feedback)과 정면으로 부딪힌다.
   *
   * 2026-09-06 실측: `flashcard/CompletionState.tsx` 가 「어려웠던 단어」의 시도 횟수를
   * `--error-light`/`--error-ink` 배지로 세고 있었다 → `--warning-*`(주의)로 바꿨다.
   *
   * ⚠️ **세션 중** 화면은 대상이 아니다. 받아쓰기가 틀린 낱말을 빨갛게 긋는 것은 비난이 아니라
   *    피드백이고, CLAUDE.md 는 오히려 색+아이콘+애니메이션 3중 피드백을 요구한다.
   */
  const COMPLETION = FILES.filter(({ path }) => /(Completion|Results)[A-Za-z]*\.tsx$/.test(path))

  it('완료·결과 화면을 실제로 찾았다', () => {
    expect(COMPLETION.length, '파일명 규칙이 바뀌었으면 이 회귀도 같이 고친다').toBeGreaterThan(0)
  })

  it.each(COMPLETION.map(({ path, src }) => [rel(path), src]))(
    '%s 이 오류색을 쓰지 않는다',
    (name, src) => {
      const hits = [...(src as string).matchAll(/--error[a-z-]*/g)].map((m) => m[0])
      expect(
        [...new Set(hits)],
        `${name} 이 오류색으로 성과를 표시한다 — 주의(--warning-*)나 중립 톤을 쓴다`,
      ).toEqual([])
    },
  )
})

describe('모션 예산 — 지속시간은 토큰 경유 (아케이드 제외)', () => {
  it('학습자 컴포넌트에 하드코딩 ms 지속시간이 없다', () => {
    // 실측 2026-09-06: `flashcard/RecallPhase`(100ms) · `pairflip/PairFlipProgress`(600ms).
    // 후자는 DESIGN_SYSTEM §Motion 이 「진행률 바 = --dur-slow(300ms)」로 이미 정해 둔 자리였고,
    // 토큰을 안 쓴 탓에 상한(300ms)을 두 배 넘긴 채 아무도 몰랐다.
    const offenders = FILES.flatMap(({ path, src }) => {
      const hits = [...src.matchAll(/duration-\[(\d+)ms\]/g)].map((m) => m[0])
      return hits.length > 0 ? [`${rel(path)} → ${[...new Set(hits)].join(' ')}`] : []
    })
    expect(
      offenders,
      `토큰 대신 ms 를 박았다(--dur-fast 100 · --dur-normal 200 · --dur-slow 300):\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})

describe('예외 목록이 스스로 검증된다 — 유령 예외 금지', () => {
  /**
   * DESIGN_SYSTEM §게임 전용 하드코딩 색상 이 "변경 금지" 로 지키는 색들.
   *
   * 2026-09-06 실측: 그 목록의 **6색이 저장소 전체에 0건**이었다 — Flashcard 카드 gradient
   * (`#FFFDE7 #FFF9C4 #FFF59D` / `#E8F5E9 #C8E6C9 #A5D6A7`). 없어진 색을 지키고 있었던 셈이고,
   * 그 상태로는 "이 목록에 있으니 예외" 라는 판단을 아무도 신뢰할 수 없다.
   *
   * 반대 방향(목록에 없는 하드코딩 308건)은 **일부러 검사하지 않는다.** 색 축의 예외 범위를
   * 먼저 정하지 않고 회귀부터 걸면 전부 오탐이 된다 — 이 파일 위쪽 §모션 예산이 정확히 그
   * 실수를 한 번 했다(「루프 애니메이션 금지」가 정당한 로더 20여 곳을 걸었다).
   */
  const DESIGN_SYSTEM = readFileSync(
    join(process.cwd(), '..', '..', 'docs', 'DESIGN_SYSTEM.md'),
    'utf8',
  )

  /** 예외 절의 코드블록에서 색을 뽑는다 — 설명 표의 색은 세지 않는다. */
  function exceptionColors(): string[] {
    const secStart = DESIGN_SYSTEM.indexOf('### 게임 전용 하드코딩 색상 (예외)')
    expect(secStart, '예외 절을 찾지 못했다 — 제목이 바뀌었으면 이 회귀도 같이 고친다').toBeGreaterThan(-1)
    const fenceStart = DESIGN_SYSTEM.indexOf('```css', secStart)
    const fenceEnd = DESIGN_SYSTEM.indexOf('```', fenceStart + 6)
    const block = DESIGN_SYSTEM.slice(fenceStart, fenceEnd)
    return [...new Set([...block.matchAll(/#[0-9A-Fa-f]{6}/g)].map((m) => m[0].toUpperCase()))]
  }

  /** 저장소에서 그 색을 쓰는가 — 소스 전체를 한 번만 읽어 둔다. */
  const HAYSTACK = [
    ...walk(join(SRC)),
    ...walk(join(process.cwd(), '..', '..', 'packages')),
  ]
    .map((p) => readFileSync(p, 'utf8').toUpperCase())
    .join('\n')

  const COLORS = exceptionColors()

  it('검사가 스스로를 무력화하지 않는다 — 건초더미에 테스트 자신이 없다', () => {
    /**
     * 함정: 이 파일의 주석이 유령 색 이름(`#FFFDE7` 등)을 적고 있다. 건초더미에 `__tests__` 가
     * 섞이면 **그 주석 때문에 유령이 "실재" 로 세어져** 검사가 조용히 무력해진다.
     * (2026-09-06, 변이 검사를 임시 스크립트로 돌리다 정확히 그 일이 났다 — `walk` 가
     *  `__tests__` 를 거르는 덕에 실제 검사는 멀쩡했지만, 그 규칙이 풀리면 여기부터 썩는다.)
     */
    expect(
      HAYSTACK.includes('#FFFDE7'),
      '테스트 파일이 건초더미에 섞였다 — walk 의 __tests__ 제외가 풀렸다',
    ).toBe(false)
  })

  it('예외 색을 실제로 뽑았다', () => {
    expect(COLORS.length).toBeGreaterThan(5)
  })

  it.each(COLORS)('%s 이 코드에 실재한다', (hex) => {
    expect(
      HAYSTACK.includes(hex),
      `${hex} 은 "변경 금지" 로 적혀 있는데 저장소 어디에도 없다 — 유령 예외다. 지웠으면 목록에서도 지운다`,
    ).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// v07 「주묵 판면」 — 새 방향이 스스로를 지킨다
//
// 두 규칙을 코드에 닿게 한다. 둘 다 **문서에만 적어 두면 반드시 새어 나가는** 종류다:
//   ① 주묵(`--ju`)은 앱이 지면에 남기는 표식이지 학습자에 대한 평가가 아니다.
//      오답·틀림 경로에 붉은색을 다시 들이면 CLAUDE.md 「정답률 빨간 글씨 압박 금지」로 되돌아간다.
//   ② 한글에 웹폰트가 있어야 한다. 이 저장소는 그게 없는 채로 오래 굴러갔고
//      (폰트 4종 전부 latin subset), 화면 글자의 48~75% 가 OS 기본꼴로 나왔다.
//      폰트를 바꾸는 커밋은 **조용히** 그 상태로 되돌릴 수 있다 — 화면은 멀쩡히 뜬다.
// ══════════════════════════════════════════════════════════════════════════════

describe('v07 — 주묵은 표식이지 낙인이 아니다', () => {
  /** 오답·틀림을 다루는 코드로 보이는 이름들. 좁게 잡는다(넓히면 전부 오탐이 된다). */
  const WRONG_CONTEXT =
    /(isWrong|wasWrong|incorrect|isIncorrect|wrongAnswer|오답|틀렸|실패했|missed)/i

  it('오답을 다루는 줄에서 주묵 토큰을 쓰지 않는다', () => {
    const offenders: string[] = []
    for (const { path, src } of FILES) {
      const lines = src.split('\n')
      lines.forEach((line, i) => {
        if (!/var\(--ju\b|--ju-ink|--ju-light|bg-ju\b|text-ju\b/.test(line)) return
        // 같은 줄, 그리고 바로 위아래 한 줄까지 본다 — 삼항 조건이 줄바꿈되는 경우가 있다.
        const near = [lines[i - 1] ?? '', line, lines[i + 1] ?? ''].join(' ')
        if (WRONG_CONTEXT.test(near)) offenders.push(`${rel(path)}:${i + 1}`)
      })
    }
    expect(
      offenders,
      `주묵이 오답 경로에 쓰였다: ${offenders.join(', ')} — 주묵은 앱의 표식 전용이다(tokens.css §주묵)`,
    ).toEqual([])
  })

  it('SRS 채점 4단계와 오답 토큰에 원색 빨강이 없다', () => {
    // #EF4444 / #F87171 / #DC2626 — 이전 값들. 되돌아오면 여기서 걸린다.
    const globals = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8')
    const grading = globals
      .split('\n')
      .filter((l) => /--srs-[14](-ink)?\s*:|--learn-error|--slot-error/.test(l))
      .join('\n')
    expect(grading, 'SRS/오답 토큰에 원색 빨강이 돌아왔다').not.toMatch(
      /#(EF4444|F87171|DC2626|B42318|A32218|FEE2E2|FEF2F2)/i,
    )
  })

  it('주묵 토큰이 실재한다 — 규칙이 빈 공간을 지키지 않는다', () => {
    const tokens = readFileSync(
      join(process.cwd(), '..', '..', 'packages', 'design-tokens', 'src', 'tokens.css'),
      'utf8',
    )
    expect(tokens, '--ju 정의가 없다').toMatch(/--ju:\s*#C0392B/)
    expect(tokens, '--on-ju 정의가 없다').toMatch(/--on-ju:/)
    // 다크에서도 짝이 있어야 한다 — 한쪽만 있으면 다크에서 대비가 무너진다(C6 의 재발).
    const dark = tokens.slice(tokens.indexOf('[data-theme="dark"]'))
    expect(dark, '다크 주묵 짝이 없다').toMatch(/--ju:/)
    expect(dark, '다크 --on-ju 짝이 없다').toMatch(/--on-ju:/)
  })
})

describe('v07 — 한글에 글꼴이 있다', () => {
  const layout = () => readFileSync(join(SRC, 'app', 'layout.tsx'), 'utf8')
  const tw = () => readFileSync(join(process.cwd(), 'tailwind.config.ts'), 'utf8')

  it('루트 레이아웃이 한글 글꼴을 로드한다', () => {
    const src = layout()
    expect(src, '한글 UI 글꼴(IBM Plex Sans KR)이 없다').toMatch(/IBM_Plex_Sans_KR/)
    expect(src, '한글 디스플레이 글꼴(Hahmlet)이 없다').toMatch(/Hahmlet/)
  })

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
     *
     * 같은 종류의 함정을 이 세션이 세 번 만났다 — 일괄 치환이 주석의 hex 를 바꾸고,
     * 검사가 주석을 코드로 세고, 건초더미에 테스트 자신이 섞였다(§예외 목록).
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

  it('Tailwind 의 본문·UI 스택이 라틴 전용으로 되돌아가지 않았다', () => {
    const src = tw()
    const block = src.slice(src.indexOf('fontFamily:'), src.indexOf('spacing:'))
    // display/body 가 가리키는 변수는 한글을 그리는 글꼴이어야 한다.
    expect(block, 'UI 스택에 한글 글꼴이 없다').toMatch(/IBM Plex Sans KR/)
    // editorial 은 영문 Lora + 한글 Hahmlet 한 줄로 성립한다.
    expect(block, 'editorial 스택에 한글 세리프가 없다').toMatch(/--font-ko-display/)
    // 되돌아오면 안 되는 것 — 한글 글리프가 없는 글꼴만 남기는 스택
    expect(block, 'Plus Jakarta / DM Sans 전용 스택이 돌아왔다').not.toMatch(
      /"DM Sans",\s*\n?\s*"-apple-system"/,
    )
  })
})

describe('v07 — 학습자 판면에 그림문자를 그리지 않는다', () => {
  // 실측 2026-09-17: 세션 머리·채점·판정의 이모지를 걷어낸 뒤에도 `/library/books` 17 ·
  // `/library/vocab` 18 · `/diagnostic` 5 개가 남아 있었다. 전부 **데이터 필드**(`emoji:`)를
  // 렌더러가 그대로 찍은 것이었다 — 데이터는 두고(기능 불변) 그리는 쪽만 `SealMark`·라벨로 바꿨다.
  // 렌더러가 다시 `{x.emoji}` 를 찍으면 기기마다 다른 그림이 판면에 돌아온다.
  it('컴포넌트가 emoji 필드를 JSX 로 찍지 않는다', () => {
    const offenders = FILES.filter(({ path, src }) => {
      if (rel(path).startsWith('components/admin/')) return false
      return /\{\s*[A-Za-z_$][\w$]*\.emoji\s*\}/.test(src)
    }).map(({ path }) => rel(path))
    expect(offenders, `emoji 필드를 그린다: ${offenders.join(', ')}`).toEqual([])
  })

  it('학습 중 쉼 화면에 무한 반복 장식 모션이 없다', () => {
    for (const f of ['flashcard/MicroPause.tsx', 'spellforge/MicroPause.tsx']) {
      const src = readFileSync(join(COMPONENTS, f), 'utf8')
      expect(src, `${f} 에 끝나지 않는 장식 모션`).not.toMatch(/_infinite\]/)
    }
  })
})

describe('v07 — 반짝이(Sparkles)는 우리 표식이 아니다', () => {
  // 워드마크에서 뺀 「AI 생성 UI 공통 표식」이 학습자 화면 45파일에 56번 남아 있었다(실측 2026-09-17).
  // 같은 뜻(「여기를 보라」)은 권점 `components/ui/press/Gwonjeom` 이 맡는다 — lucide 와 같은 타입이라
  // 이름만 바꾸면 된다. 관리자 화면(보라 액센트 체계)과 마케팅 소개면은 이 의뢰의 범위 밖이다.
  it('학습자 컴포넌트가 lucide Sparkles 를 들이지 않는다', () => {
    const offenders = FILES.filter(({ path, src }) => {
      const r = rel(path)
      if (r.startsWith('components/admin/') || r.startsWith('components/marketing/')) return false
      const m = src.match(/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/)
      return !!m && /\bSparkles\b/.test(m[1])
    }).map(({ path }) => rel(path))
    expect(offenders, `Sparkles 를 쓴다: ${offenders.join(', ')}`).toEqual([])
  })
})
