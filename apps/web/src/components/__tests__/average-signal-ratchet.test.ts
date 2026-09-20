// apps/web/src/components/__tests__/average-signal-ratchet.test.ts
//
// **평균 회귀 신호를 라쳇으로 잠근다 — 늘어나면 실패, 줄어들면 기준선을 같이 내린다.**
//
// ── 왜 ───────────────────────────────────────────────────────────────
// 지침(vocaflow-design §G · DESIGN_SYSTEM §판면)은 "카드+그림자 · 3열 균등 · 그라디언트 · AI-보라 ·
// 떠오르는 hover · glass · 끝나지 않는 모션" 을 평균의 신호로 적어 두었다. 그런데 **적어 두기만 했다.**
// 규칙 위반 없이도 화면은 이 신호들로 조용히 평균에 수렴한다 — 어떤 e2e 도, axe 도 실패하지 않는다.
// 목표가 "평균은 절대 안 된다" 이므로(2026-09-18 사용자 지시) 문장이 아니라 숫자로 막는다.
//
// ── 무엇을 세는가 ─────────────────────────────────────────────────────
// `src/` 의 .tsx/.ts/.css(테스트 제외)에서 아래 8개 패턴의 출현 수를 **표면별로** 센다.
//   learner — 학습자 화면 전부(학습 세션 `flashcard/play` 등 포함)
//   admin   — `/admin` 과 `components/admin` (DD-01: 보라 액센트는 교체 결정 — 줄이기만 한다)
//   tokens  — `packages/design-tokens/src` (2026-09-20 추가 · 아래 「왜 토큰까지」)
//   제외    — 아케이드(`components/game` · `lib/game` · `(app)/play` · `arcade`). 게임의 리듬은
//             학습 화면과 다른 축이고 그 판단은 각 게임이 한다(DESIGN_SYSTEM §3.2 아케이드 예외와 같다).
//
// ── 왜 토큰까지 (2026-09-20 · DD-61 (가)) ─────────────────────────────
// Gate 4 (i) 이 `apps/web/src` 의 옛 AI-보라 리터럴 318곳을 전부 토큰으로 바꿔 `admin.ai-purple` 을
// **318 → 0** 으로 만들었다. 그런데 화면은 그대로 보라였다 — 마지막 한 자리가 **토큰 정의**
// (`--admin: #8B5CF6`)였고, 이 라쳇은 `apps/web/src` 만 훑기 때문에 그 자리를 **구조적으로 볼 수 없었다.**
// 즉 「0」은 "보라가 없다" 가 아니라 "내가 보는 곳에 없다" 였다. 그래서 두 가지를 더한다:
//   ① 토큰 패키지도 같은 8개 패턴으로 센다(`tokens` 표면).
//   ② **토큰 정의값 자체의 색**을 검사한다 — 클래스 이름이 아니라 색상환 위치로(아래 `금지 색상`).
//      리터럴 목록(#8B5CF6 …)으로는 한 글자만 달라도 새는데, 색상환은 새지 않는다.
//
// ── 라쳇 규칙 ─────────────────────────────────────────────────────────
//   실측 > 기준선 → 실패. 새 코드가 평균 신호를 **하나라도** 늘렸다. 형태 문법(F1–F5)으로 바꾼다.
//   실측 < 기준선 → 실패. 줄인 것은 좋다 — **기준선을 그 값으로 내려** 되돌아가는 길을 막는다.
//   (정당한 증가는 없다고 본다. 정말 필요하면 이 파일에서 기준선을 올리고 커밋 본문에 이유를 적는다 —
//    리뷰에서 보이게 하는 것이 목적이다.)
//
// ⚠️ 이것은 **상한**이지 목표가 아니다. 0 이 되어도 평범할 수 있다 — 평범함의 판정은 사람과
//    06-workflow 비평 (a) 익명성 · (b) 평균 회귀가 한다. 이 파일은 **후퇴만** 막는다.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')
/** 토큰 정의의 출처. 여기 없는 색은 화면에 없다 — 그래서 여기까지 세지 않으면 「0」이 거짓이 된다. */
const TOKENS_SRC = join(process.cwd(), '..', '..', 'packages', 'design-tokens', 'src')

type Surface = 'learner' | 'admin' | 'tokens'

const SURFACES = ['learner', 'admin', 'tokens'] as const

/** 평균 신호. 각 줄에 "왜 평균인가" 를 적는다 — 이유 없는 패턴은 넣지 않는다. */
const SIGNALS: Record<string, { re: RegExp; why: string }> = {
  'grid-3eq': {
    re: /(?<![\w-])(?:(?:sm|md|lg|xl):)?grid-cols-3(?![\w-])/g,
    why: '3열 균등 격자 — 템플릿의 기본 구도. 골격은 G1 축이어야 한다',
  },
  'shadow-heavy': {
    re: /(?<![\w-])(?:hover:)?shadow-(?:md|lg|xl|2xl)(?![\w-])/g,
    why: 'Tailwind 기본 그림자 — 판면은 뜨지 않는다(--sh-* 는 헤어라인 링)',
  },
  'rounded-big': {
    re: /(?<![\w-])rounded-(?:xl|2xl|3xl)(?![\w-])/g,
    why: '12px+ 둥근 카드 — 판면 radius 는 2–6px(--r-*)',
  },
  gradient: {
    re: /bg-gradient-to-|linear-gradient\(|radial-gradient\(/g,
    why: '장식 그라디언트 — N1 불통과(자산 없이 복제된다)',
  },
  'ai-purple': {
    re: /#8B5CF6|#7C3AED|#6D28D9|#A78BFA|(?<![\w-])(?:bg|text|border|from|to|via|ring)-(?:violet|purple|indigo)-\d{2,3}/gi,
    why: 'AI-보라 — 외부 스킬 공통 금지 1순위. Admin 액센트도 교체 결정(DD-01)',
  },
  glass: {
    re: /backdrop-blur/g,
    why: 'glassmorphism — 판면 방향과 반대, 대비를 깎는다',
  },
  'float-hover': {
    re: /hover:-translate-y-/g,
    why: '떠오르는 hover — 판면에서 요소는 뜨지 않는다. 눌리면 들어간다',
  },
  'infinite-anim': {
    re: /_infinite\]|animate-(?:bounce|ping)(?![\w-])/g,
    why: '끝나는 상태가 없는 모션 — 장식적 상시 모션 금지(로더 animate-spin·스켈레톤 animate-pulse 는 세지 않는다)',
  },
}

/**
 * 기준선 — 2026-09-18 실측, 2026-09-19 **커밋된 트리 기준으로 재측정**(처음에는 다른 세션의 미커밋 변경이
 * 섞인 작업 트리에서 재서 CI 와 어긋났다 — learner.grid-3eq 59→60 · admin.ai-purple 318→326). **내리기만 한다.**
 * learner 의 `infinite-anim` 는 `/text/[id]` risk 단어 `word-pulse` 제거(DD-06) 뒤의 값이다.
 * 2026-09-19 내림(커밋된 트리): grid-3eq 60→59(고아 MyTextsGrid 삭제 — DD-37) · gradient 171→168 · float-hover 66→65
 * 2026-09-20 내림: **admin.ai-purple 318 → 0** — 옛 AI-보라를 토큰으로 일괄 교체(Gate 4 (i) · DD-55/59).
 *   scripts/design/purple-to-token.mjs 가 정확 일치만 바꾼다(그라디언트 구조·Tailwind 팔레트 클래스는 손대지 않고 보고만).
 *   학습자 표면(38)은 이 회차 범위가 아니다 — 남은 곳은 그 표면의 화면 작업에서 함께 지운다.
 * (빈 상태 CTA 3곳 그라디언트·떠오르는 hover 제거 — DD-39). 작업 트리에는 Codex 미커밋 CSAT 몫이 더 있다(grid-3eq 58 · admin.ai-purple 318 — DD-33).
 */
const BASELINE: Record<Surface, Record<string, number>> = {
  learner: {
    'grid-3eq': 58,
    'shadow-heavy': 29,
    'rounded-big': 41,
    gradient: 167,
    'ai-purple': 38,
    glass: 49,
    'float-hover': 64,
    'infinite-anim': 12,
  },
  admin: {
    'grid-3eq': 35,
    'shadow-heavy': 0,
    'rounded-big': 4,
    gradient: 36,
    'ai-purple': 0,
    glass: 7,
    'float-hover': 8,
    'infinite-anim': 0,
  },
  // 2026-09-20 최초 측정(`packages/design-tokens/src`). `ai-purple` 에 남은 것은 아케이드 전용
  // `--combo`(tokens.css)와 `gameColors.combo`(colors.ts) 두 자리다 — 게임 색은 판면 규칙 밖이고
  // 「변경 금지」로 명시돼 있다(CLAUDE.md §게임 전용 예외). 그 둘 말고 새 보라가 들어오면 늘어서 실패한다.
  tokens: {
    'grid-3eq': 0,
    'shadow-heavy': 0,
    'rounded-big': 0,
    gradient: 0,
    // --combo(tokens.css) · gameColors.combo(colors.ts) 두 자리 — 아케이드 전용, 「변경 금지」
    'ai-purple': 2,
    glass: 0,
    'float-hover': 0,
    'infinite-anim': 0,
  },
}

const GAME = [
  `${sep}components${sep}game${sep}`,
  `${sep}lib${sep}game${sep}`,
  `${sep}(app)${sep}play${sep}`,
  `${sep}arcade${sep}`,
]

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : walk(p)
    return /\.(tsx|ts|css)$/.test(name) && !/\.test\./.test(name) ? [p] : []
  })
}

function surfaceOf(path: string): Surface | null {
  if (path.startsWith(TOKENS_SRC)) return 'tokens'
  if (GAME.some((g) => path.includes(g))) return null
  return path.includes(`${sep}admin${sep}`) ? 'admin' : 'learner'
}

function measure(): Record<Surface, Record<string, number>> {
  const out = { learner: {}, admin: {}, tokens: {} } as Record<Surface, Record<string, number>>
  for (const s of SURFACES) for (const k of Object.keys(SIGNALS)) out[s][k] = 0
  for (const file of [...walk(SRC), ...walk(TOKENS_SRC)]) {
    const surface = surfaceOf(file)
    if (!surface) continue
    const text = readFileSync(file, 'utf8')
    for (const [k, { re }] of Object.entries(SIGNALS)) out[surface][k] += text.match(re)?.length ?? 0
  }
  return out
}

describe('평균 회귀 신호 라쳇', () => {
  const actual = measure()

  it('세는 장치가 살아 있다 — 파일을 못 읽어 0 을 세고 통과하는 길을 막는다', () => {
    const total = Object.values(actual.learner).reduce((a, b) => a + b, 0)
    expect(total, 'learner 합계가 0 — walk 가 깨졌다').toBeGreaterThan(100)
    // 토큰 표면은 기준선이 전부 0 이라 "못 읽어도 통과" 한다 — 디렉터리 존재를 따로 확인한다.
    expect(existsSync(TOKENS_SRC), `토큰 소스를 못 찾았다: ${TOKENS_SRC}`).toBe(true)
    expect(walk(TOKENS_SRC).length, '토큰 파일을 하나도 못 읽었다').toBeGreaterThan(3)
  })

  for (const surface of SURFACES) {
    for (const [key, { why }] of Object.entries(SIGNALS)) {
      it(`${surface} · ${key} 는 늘지 않는다 (${why})`, () => {
        const now = actual[surface][key]
        const base = BASELINE[surface][key]
        expect(
          now,
          `${surface}.${key} 가 기준선 ${base} 을 넘었다 — 평균 신호를 새로 넣었다. DESIGN_SYSTEM §✒ 형태 문법으로 바꾼다`,
        ).toBeLessThanOrEqual(base)
        expect(
          now,
          `${surface}.${key} 가 ${base} → ${now} 로 줄었다 — 좋다. 이 파일의 BASELINE 을 ${now} 로 내려 잠근다`,
        ).toBe(base)
      })
    }
  }
})

// ─────────────────────────────────────────────────────────────────────
// 금지 색상 — **토큰 정의값**을 색상환 위치로 검사한다 (2026-09-20)
//
// 클래스 이름(`bg-violet-500`)과 리터럴 목록(`#8B5CF6`)으로는 한 글자만 달라도 샌다. 실제로 Gate 4 (i)
// 이 리터럴을 전부 치우고도 화면은 보라였다(DD-61 (가)) — 마지막 한 자리가 토큰 정의였기 때문이다.
// 그래서 이름이 아니라 **색 자체**를 본다: 토큰 패키지의 모든 색 리터럴을 HSL 로 바꿔
// 보라·인디고 구간(색상 235°–309°)에 앉은 것을 찾는다. 주석 안의 색은 세지 않는다 —
// "무엇을 왜 치웠는지" 를 적어 둔 문장이 실패를 만들면 기록을 지우게 된다.
// ─────────────────────────────────────────────────────────────────────

/** 보라·인디고로 읽히는 구간. 회색(저채도)·거의 흰색/검정은 제외한다. */
const FORBIDDEN_HUE = { from: 235, to: 309, minSat: 30, minLight: 10, maxLight: 97 }

/**
 * 남아 있는 것 — **줄이기만 한다.** 새 항목을 여기 더해 통과시키지 않는다(그러면 라쳇이 아니다).
 * 각 줄은 "왜 아직 있는가" 와 "치우려면 무엇을 먼저 결정해야 하는가" 를 적는다.
 */
const KNOWN_PURPLE: Record<string, string> = {
  'tokens.css:--combo':
    '아케이드 전용 콤보 색 — 게임 색은 판면 규칙 밖이고 「변경 금지」로 명시돼 있다(CLAUDE.md §게임 전용 예외)',
  'colors.ts:combo': '위와 같은 값의 TS 쪽 정의(gameColors)',
  'tokens.css:--cefr-C1-bg': 'CEFR 등급 척도 A1→C2 의 한 칸 — 장식이 아니라 의미(배지는 글자도 함께 읽힌다)',
  'tokens.css:--cefr-C1-text': '위와 같은 척도의 글자색',
  'colors.ts:purple':
    '단어장 표지 duotone 「unique」 가족이 쓰는 잉크(packages/library-pipeline/src/vocab/brand.ts). ' +
    'tokens.css 의 --ios-purple 은 v07 에서 자두로 옮겼지만 이쪽은 **이미 각인된 표지**와 어긋나므로 색만 바꿀 수 없다 — 재각인 여부를 먼저 결정한다',
  'colors.ts:purpleTint': '위 duotone 의 지면(paper). 같은 결정에 묶여 있다',
}

function toHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

/** 주석을 지운다 — 치운 색을 적어 둔 문장이 실패를 만들면 안 된다. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

function forbiddenColorsIn(file: string): { key: string; value: string; hsl: [number, number, number] }[] {
  const name = file.slice(file.lastIndexOf(sep) + 1)
  const hits: { key: string; value: string; hsl: [number, number, number] }[] = []
  // **선언 단위로** 읽는다 — 한 줄에 둘이 있는 자리가 실제로 있다
  // (`--cefr-C1-bg: #EDE6F7;  --cefr-C1-text: #4C2A85;`). 줄 단위로 세면 뒤의 것이
  // 앞의 이름으로 기록돼, 목록에 적어 둔 이름과 어긋난다.
  const text = stripComments(readFileSync(file, 'utf8'))
  for (const d of text.matchAll(/(--[\w-]+|[A-Za-z][\w]*)\s*:\s*([^;\n]+)/g)) {
    const [, declName, value] = d
    for (const m of value.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
      let hsl: [number, number, number]
      if (m[0].startsWith('#')) {
        const h = m[0].length === 4 ? m[0].slice(1).split('').map((c) => c + c).join('') : m[0].slice(1)
        hsl = toHsl(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255)
      } else {
        hsl = toHsl(Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255)
      }
      const [h, s, l] = hsl
      const forbidden =
        h >= FORBIDDEN_HUE.from &&
        h <= FORBIDDEN_HUE.to &&
        s >= FORBIDDEN_HUE.minSat &&
        l >= FORBIDDEN_HUE.minLight &&
        l <= FORBIDDEN_HUE.maxLight
      if (forbidden) hits.push({ key: `${name}:${declName}`, value: m[0], hsl })
    }
  }
  return hits
}

describe('토큰 정의값의 금지색(보라·인디고)', () => {
  const found = walk(TOKENS_SRC).flatMap(forbiddenColorsIn)

  it('세는 장치가 살아 있다 — 알려진 자리를 실제로 찾아낸다', () => {
    expect(
      found.some((f) => f.key === 'tokens.css:--combo'),
      '아는 보라(--combo)조차 못 찾았다 — 파서가 깨졌다. 0 건은 "깨끗하다" 가 아니라 "못 읽었다" 일 수 있다',
    ).toBe(true)
  })

  it('알려진 자리 밖에 보라·인디고가 없다 — 새로 들어오면 실패', () => {
    const unknown = found.filter((f) => !(f.key in KNOWN_PURPLE))
    expect(
      unknown.map((u) => `${u.key} = ${u.value} (h${u.hsl[0]} s${u.hsl[1]} l${u.hsl[2]})`),
      '토큰 정의에 보라·인디고가 새로 들어왔다 — 지면 팔레트(--p 딥잉크 · --ju 주묵)로 바꾼다. ' +
        '정말 필요하면 KNOWN_PURPLE 에 **이유와 남은 결정**을 적고 커밋 본문에 근거를 남긴다',
    ).toEqual([])
  })

  it('알려진 자리는 줄기만 한다 — 치웠으면 목록에서 지운다', () => {
    const gone = Object.keys(KNOWN_PURPLE).filter((k) => !found.some((f) => f.key === k))
    expect(gone, `${gone.join(' · ')} 의 보라가 사라졌다 — 좋다. KNOWN_PURPLE 에서 그 줄을 지워 잠근다`).toEqual([])
  })
})
