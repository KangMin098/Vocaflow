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
//   제외    — 아케이드(`components/game` · `lib/game` · `(app)/play` · `arcade`). 게임의 리듬은
//             학습 화면과 다른 축이고 그 판단은 각 게임이 한다(DESIGN_SYSTEM §3.2 아케이드 예외와 같다).
//
// ── 라쳇 규칙 ─────────────────────────────────────────────────────────
//   실측 > 기준선 → 실패. 새 코드가 평균 신호를 **하나라도** 늘렸다. 형태 문법(F1–F5)으로 바꾼다.
//   실측 < 기준선 → 실패. 줄인 것은 좋다 — **기준선을 그 값으로 내려** 되돌아가는 길을 막는다.
//   (정당한 증가는 없다고 본다. 정말 필요하면 이 파일에서 기준선을 올리고 커밋 본문에 이유를 적는다 —
//    리뷰에서 보이게 하는 것이 목적이다.)
//
// ⚠️ 이것은 **상한**이지 목표가 아니다. 0 이 되어도 평범할 수 있다 — 평범함의 판정은 사람과
//    06-workflow 비평 (a) 익명성 · (b) 평균 회귀가 한다. 이 파일은 **후퇴만** 막는다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

type Surface = 'learner' | 'admin'

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
 */
const BASELINE: Record<Surface, Record<string, number>> = {
  learner: {
    'grid-3eq': 59, // 2026-09-19 /flashcard/play 완료 3열 통계 카드(60→59)
    'shadow-heavy': 29,
    'rounded-big': 39, // 2026-09-19 /signup 그림자 카드 rounded-xl 2(41→39)
    gradient: 165, // 2026-09-19 /diagnostic 헤더 2(171→169) · /flashcard/play 회상 막대·예문·완료 박스·버튼 4(169→165)
    'ai-purple': 37, // 2026-09-19 /text/[id] UnifiedHeader 칩 hover #6D28D9(38→37)
    glass: 49, // 2026-09-19 /diagnostic 모달 2(52→50) · /text/[id] ModePills backdrop-blur(50→49)
    'float-hover': 64, // 2026-09-19 /hub TodayPlanCard 칩(66→65) · /flashcard/play 완료 버튼(65→64)
    'infinite-anim': 10, // 2026-09-19 /flashcard/play 발음 무한 펄스 2(12→10)
  },
  admin: {
    'grid-3eq': 35,
    'shadow-heavy': 0,
    'rounded-big': 4,
    gradient: 36,
    'ai-purple': 326,
    glass: 7,
    'float-hover': 8,
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
  if (GAME.some((g) => path.includes(g))) return null
  return path.includes(`${sep}admin${sep}`) ? 'admin' : 'learner'
}

function measure(): Record<Surface, Record<string, number>> {
  const out: Record<Surface, Record<string, number>> = { learner: {}, admin: {} }
  for (const s of ['learner', 'admin'] as const) for (const k of Object.keys(SIGNALS)) out[s][k] = 0
  for (const file of walk(SRC)) {
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
  })

  for (const surface of ['learner', 'admin'] as const) {
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
