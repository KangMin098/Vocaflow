// apps/web/src/app/dev/replica/ours.ts
//
// **치환 네 가지**(DD-62 Stage 3). 구조·수치는 한 줄도 건드리지 않는다 — 같은 `BandStack` 이 같은
// `computed.json` 을 그리고, 여기서 주는 것은 색 · 서체 · 그림 · 문구뿐이다.
// 그래야 "급이 안 되면 넷 중 무엇이 떨어뜨렸는지" 를 하나씩 되돌려 시트로 볼 수 있다.
//
//   ① 색   — `docs/design/refs/substitution.json` (ΔE2000 최근접 · 액센트는 --ju 고정). 여기서 고르지 않는다.
//   ② 서체 — 표제 Hahmlet/Lora · 본문 IBM Plex Sans KR. 크기·행간·굵기·자간은 실측값 유지.
//   ③ 그림 — 골든 삽화 3점 + #10, 제품 화면 자리는 우리 실제 라우트 캡처.
//   ④ 문구 — 랜딩 카피 정본(`lib/marketing/differentiators.ts`).
//
// 컴포넌트는 여전히 하나도 import 하지 않는다 — 가져오는 것은 **데이터**(SVG 문자열 · 카피 배열)뿐이다.
// 우리 컴포넌트를 쓰면 "우리 컴포넌트가 원래 이 모양이라 비슷해 보이는 것" 이 섞인다.

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import { DIFFERENTIATORS } from '@/lib/marketing/differentiators'

import type { BlueprintChild } from './blueprint'

const REPO = join(process.cwd(), '..', '..')

// ── ① 색 ──────────────────────────────────────────────────────────────────
type SubstRow = { from: string; token: string; to: string; deltaE: number; count: number; rule: string }

export function colorMap(): Map<string, string> {
  const j = JSON.parse(readFileSync(join(REPO, 'docs/design/refs/substitution.json'), 'utf8')) as { colors: SubstRow[] }
  return new Map(j.colors.map((c) => [c.from.toLowerCase(), `var(${c.token})`]))
}

// ── ② 서체 ────────────────────────────────────────────────────────────────
// 변수는 루트 레이아웃의 next/font 가 내려 준다(`--font-ko-display` 등). 이름은 폴백이다.
const HEAD = "var(--font-ko-display), var(--font-serif), Hahmlet, Lora, Georgia, serif"
const BODY = "var(--font-display), 'IBM Plex Sans KR', system-ui, sans-serif"
export function fontFor(c: BlueprintChild): string {
  if (['h1', 'h2', 'h3'].includes(c.role)) return HEAD
  // 실측에서 참조의 도입 문단은 세리프 22~28px 다 — 크기가 그 자리에 있으면 표제 쪽으로 받는다.
  if (parseFloat(c.fontSize ?? '0') >= 22) return HEAD
  return BODY
}

// ── ③ 그림 ────────────────────────────────────────────────────────────────
const GOLDEN = [
  'docs/design/golden/illustrations/illo-02-text-hub-first.svg',
  'docs/design/golden/illustrations/illo-07-coverage.svg',
  'docs/design/golden/illustrations/illo-09-review-holds.svg',
  'docs/design/golden/illustrations/norm/illo-10-evidence-points.svg',
]

export type MediaAsset =
  | { kind: 'illustration'; id: string; svg: string }
  | { kind: 'screen'; id: string; url: string; ratio: number }
  | { kind: 'fill' }

export function illustrations(): { id: string; svg: string }[] {
  return GOLDEN.filter((p) => existsSync(join(REPO, p))).map((p) => ({
    id: p.split('/').pop()!.replace('.svg', ''),
    svg: readFileSync(join(REPO, p), 'utf8'),
  }))
}

export function screens(): { id: string; url: string; ratio: number }[] {
  const f = join(process.cwd(), 'public', 'dev', 'replica-shots', 'manifest.json')
  if (!existsSync(f)) return []
  const j = JSON.parse(readFileSync(f, 'utf8')) as { shots: { id: string; url: string; ratio: number }[] }
  return j.shots
}

/**
 * 그림 자리 배정 — **규칙으로** 정한다. 눈으로 하나씩 놓으면 손글씨가 된다.
 *   · 가장 큰 자리(면적 ≥ 120,000px²)이면서 가로로 누운 것 → 제품 화면 캡처
 *   · 짧은 변 ≥ 64px → 골든 삽화 순환
 *   · 그보다 작은 자리(아이콘·로고) → 중성 채움. 대응하는 우리 자산이 없다 — 있는 척하지 않는다.
 */
export function planMedia(slots: { key: string; w: number; h: number }[]): Map<string, MediaAsset> {
  const illos = illustrations()
  const shots = screens()
  const plan = new Map<string, MediaAsset>()
  let iIllo = 0
  let iShot = 0
  for (const s of slots) {
    const area = s.w * s.h
    if (area >= 120_000 && s.w >= s.h && shots.length) {
      // 가로/세로 비가 가까운 캡처를 먼저 쓴다 — 세로 화면을 가로 자리에 늘이면 그것만 눈에 띈다.
      const want = s.w / s.h
      const pick = [...shots].sort((a, b) => Math.abs(a.ratio - want) - Math.abs(b.ratio - want))[iShot % shots.length]
      plan.set(s.key, { kind: 'screen', ...pick })
      iShot++
    } else if (Math.min(s.w, s.h) >= 64 && illos.length) {
      const pick = illos[iIllo % illos.length]
      plan.set(s.key, { kind: 'illustration', ...pick })
      iIllo++
    } else {
      plan.set(s.key, { kind: 'fill' })
    }
  }
  return plan
}

// ── ④ 문구 ────────────────────────────────────────────────────────────────
// 랜딩 `app/page.tsx` 가 쓰는 문장. 세 항목은 정본 모듈에서 오고, 표제 두 줄만 여기 있다
// (page.tsx 안에 인라인이라 import 할 수 없다 — Stage 4 에서 실제 랜딩을 세울 때 정본으로 합친다).
const HEADLINE = '내가 아는 비율로 읽기를 설계합니다'
const SUBHEAD =
  '글의 난이도가 아니라 내가 아는 비율을 잽니다. 이 글이 편하게 읽히기까지 몇 단어가 남았는지 계산해 드려요. 로그인 없이 먼저 재 보세요.'
const SECTIONS = ['다른 점', '무엇을 읽나요', '가르치시나요', '플랫폼 규모']
const SHORTS = ['먼저 재 보기', '서가 둘러보기', '교사 허브', 'Vocaflow', '무료로 시작', '학급 만들기']

export type CopyPlan = Map<string, string>
export type TextSlot = { key: string; role: string; textLen: number; fontSize?: string }

/**
 * 문구 배정도 규칙이다 — 같은 순서면 같은 결과가 나온다.
 *
 * ⚠️ 역할(`role`)만 보면 안 된다. 참조의 히어로 제목은 `h1` 태그가 아니라 span/div 로 쪼개져 있어서
 *    역할이 `text` 로 잡힌다(실측). 역할만 보던 첫 판은 그래서 64px 제목 자리에 「근거 · Hu & Nation
 *    (2000)」 같은 **각주**를 넣었다. 글자 크기가 그 자리의 위계를 말해 준다 — 크기를 먼저 본다.
 *    절대 px 이 아니라 그 뷰포트의 **최대 제목 대비 비율**로 가른다(1440 은 64px · 375 는 38px).
 */
export function planCopy(slots: TextSlot[]): CopyPlan {
  const plan: CopyPlan = new Map()
  const bodies = DIFFERENTIATORS.map((d) => d.body)
  const bases = DIFFERENTIATORS.map((d) => d.basis)
  const titles = DIFFERENTIATORS.map((d) => d.title)
  const fs = (s: TextSlot) => parseFloat(s.fontSize ?? '0') || 0
  const maxFs = Math.max(0, ...slots.map(fs))
  let headline = 0
  let section = 0
  let title = 0
  let body = 0
  let basis = 0
  let short = 0
  for (const s of slots) {
    const rel = maxFs ? fs(s) / maxFs : 0
    if (rel >= 0.9 || s.role === 'h1') plan.set(s.key, headline++ === 0 ? HEADLINE : SECTIONS[headline % SECTIONS.length])
    else if (rel >= 0.5 || s.role === 'h2') plan.set(s.key, SECTIONS[section++ % SECTIONS.length])
    else if (rel >= 0.3 || s.role === 'h3') plan.set(s.key, titles[title++ % titles.length])
    else if (s.textLen >= 90) plan.set(s.key, body++ === 0 ? SUBHEAD : bodies[body % bodies.length])
    else if (s.textLen >= 40) plan.set(s.key, bodies[body++ % bodies.length])
    else if (s.textLen >= 18) plan.set(s.key, bases[basis++ % bases.length])
    else plan.set(s.key, SHORTS[short++ % SHORTS.length])
  }
  return plan
}
