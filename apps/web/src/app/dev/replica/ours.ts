// apps/web/src/app/dev/replica/ours.ts
//
// **치환 네 가지**(DD-62 Stage 3). 구조·수치는 한 줄도 건드리지 않는다 — 같은 `BandStack` 이 같은
// `computed.json` 을 그리고, 여기서 주는 것은 색 · 서체 · 그림 · 문구뿐이다.
// 그래야 "급이 안 되면 넷 중 무엇이 떨어뜨렸는지" 를 하나씩 되돌려 시트로 볼 수 있다.
//
//   ① 색   — `docs/design/refs/substitution.json`. **역할(면/선/글자) 먼저, 역할 안에서 ΔE2000 최근접.**
//            액센트의 면 → --bg2 · 선 → --ju · 글자 → --t1 (고정). 여기서 고르지 않는다.
//   ② 서체 — 표제 Hahmlet/Lora · 본문 IBM Plex Sans KR. 크기·행간·굵기·자간은 실측값 유지.
//   ③ 그림 — 규격 L 장면 2점(띠 전체) + 골든 스팟 4점 + 제품 화면 자리 한 곳에 우리 실제 라우트 캡처.
//   ④ 문구 — 랜딩 카피 정본 + 새 문장(제품 사실만). 숫자는 DB 실측 마커이고, 못 읽으면 문장을 버린다.
//
// 컴포넌트는 여전히 하나도 import 하지 않는다 — 가져오는 것은 **데이터**(SVG 문자열 · 카피 배열)뿐이다.
// 우리 컴포넌트를 쓰면 "우리 컴포넌트가 원래 이 모양이라 비슷해 보이는 것" 이 섞인다.

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import { DIFFERENTIATORS } from '@/lib/marketing/differentiators'

import type { BlueprintChild } from './blueprint'

const REPO = join(process.cwd(), '..', '..')

// ── ① 색 ──────────────────────────────────────────────────────────────────
//
// 색은 **역할과 함께** 치환된다(2회차). 같은 `#714bd0` 라도 면이면 `--bg2`, 선이면 `--ju`, 글자면 `--t1` 이다.
// 역할 없이 하나로 묶었던 1회차는 참조의 면 20% 를 주묵 벽으로 만들었다 — DD-55 「면 금지」를 기계가 어긴 것이다.
export type ColorRole = '면' | '선' | '글자'
/** 작은 칠은 면이 아니라 표식이다 — `substitute.mjs` 의 MARK_AREA 와 **같은 값**이어야 한다. */
export const MARK_AREA = 2000
export const fillRole = (w: number, h: number): ColorRole => (w * h >= MARK_AREA ? '면' : '선')

type SubstRow = { from: string; role: ColorRole; token: string; to: string; deltaE: number; count: number; rule: string }
export type ColorFn = (hex: string | undefined | null, role: ColorRole) => string | undefined

export function colorFn(): ColorFn {
  const j = JSON.parse(readFileSync(join(REPO, 'docs/design/refs/substitution.json'), 'utf8')) as { colors: SubstRow[] }
  const map = new Map(j.colors.map((c) => [`${c.from.toLowerCase()}|${c.role}`, `var(${c.token})`]))
  return (hex, role) => {
    if (!hex) return undefined
    const k = hex.toLowerCase()
    // 그 역할로 쓰인 적이 없는 색이면 다른 역할의 배정이라도 쓴다 — 없는 색을 지어내지 않는다.
    return map.get(`${k}|${role}`) ?? map.get(`${k}|면`) ?? map.get(`${k}|선`) ?? map.get(`${k}|글자`) ?? hex
  }
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
/** 규격 L 장면 — 띠 하나를 통째로 채운다(03-system §3-9, 2026-09-20 추가). */
const SCENES = [
  'docs/design/illustrations/scene/illo-19-shelf-fills.svg',
  'docs/design/illustrations/scene/illo-26-past-papers.svg',
]

export type MediaAsset =
  | { kind: 'illustration'; id: string; svg: string; scene?: boolean }
  | { kind: 'screen'; id: string; url: string; ratio: number }
  | { kind: 'fill' }

const readSvgs = (paths: string[]) =>
  paths
    .filter((p) => existsSync(join(REPO, p)))
    .map((p) => ({ id: p.split('/').pop()!.replace('.svg', ''), svg: readFileSync(join(REPO, p), 'utf8') }))

export const illustrations = () => readSvgs(GOLDEN)
export const scenes = () => readSvgs(SCENES)

export function screens(): { id: string; url: string; ratio: number }[] {
  const f = join(process.cwd(), 'public', 'dev', 'replica-shots', 'manifest.json')
  if (!existsSync(f)) return []
  const j = JSON.parse(readFileSync(f, 'utf8')) as { shots: { id: string; url: string; ratio: number }[] }
  return j.shots
}

/**
 * 그림 자리 배정 — **규칙으로** 정한다. 눈으로 하나씩 놓으면 손글씨가 된다.
 *
 *   ① 제품 화면 자리 = 가장 큰 가로 자리 **하나**(면적 최대). 참조의 히어로 제품 스크린샷 자리다.
 *   ② 그 밖의 넓은 가로 자리(폭 ≥ 600 · 비 ≥ 1.6) → 규격 **L 장면** 순환.
 *      1회차에는 이 규칙이 없어서 띠가 비었다 — 320px 스팟을 1000px 자리에 놓으면 화면이 빈 것으로 읽힌다.
 *   ③ 짧은 변 ≥ 64px → 골든 스팟 삽화 순환(규격 상한 320px, replica.css).
 *   ④ 그보다 작은 자리(아이콘·로고) → 중성 채움. 대응하는 우리 자산이 없다 — 있는 척하지 않는다.
 */
export function planMedia(slots: { key: string; w: number; h: number }[]): Map<string, MediaAsset> {
  const illos = illustrations()
  const sceneArt = scenes()
  const shots = screens()
  const plan = new Map<string, MediaAsset>()

  // ① 제품 화면은 **한 자리**다. 여러 자리에 같은 캡처를 뿌리면 그 자체가 평균 신호가 된다.
  const heroKey = slots
    .filter((s) => s.w >= s.h && s.w * s.h >= 120_000)
    .sort((a, b) => b.w * b.h - a.w * a.h)[0]?.key

  let iIllo = 0
  let iScene = 0
  for (const s of slots) {
    const wide = s.w >= 600 && s.w / s.h >= 1.6
    if (s.key === heroKey && shots.length) {
      const want = s.w / s.h
      const pick = [...shots].sort((a, b) => Math.abs(a.ratio - want) - Math.abs(b.ratio - want))[0]
      plan.set(s.key, { kind: 'screen', ...pick })
    } else if (wide && sceneArt.length) {
      plan.set(s.key, { kind: 'illustration', ...sceneArt[iScene++ % sceneArt.length], scene: true })
    } else if (Math.min(s.w, s.h) >= 64 && illos.length) {
      plan.set(s.key, { kind: 'illustration', ...illos[iIllo++ % illos.length] })
    } else {
      plan.set(s.key, { kind: 'fill' })
    }
  }
  return plan
}

// ── ④ 문구 ────────────────────────────────────────────────────────────────
//
// 1회차에는 정본 카피(섹션 4 · 항목 3)를 자리 수보다 적게 가지고 돌려 써서 「가르치시나요」가 세 번 나왔다.
// 2회차는 **반복되던 자리에 새 문장**을 쓴다. 두 규칙만 지킨다:
//   · **제품 사실만** — 이 저장소의 코드가 실제로 하는 일. 후기·이용자 수·평점·도입 기관은 한 줄도 없다.
//   · **숫자는 실측 마커** — `{headwords}` 같은 자리표시자로 두고 렌더할 때 DB 에서 채운다.
//     못 읽으면 그 문장을 **버린다**(상수로 대체하지 않는다 — AGENTS.md I5 · trust-signals 와 같은 규칙).
//
// 여기 쓴 문장은 **복제 시트용**이다. 랜딩 카피 정본(`lib/marketing/differentiators.ts`) 확장은
// 별도 PR 제안으로 남겼다: `docs/design/proposals/landing-copy-expansion.md`.

/**
 * DB 실측치 — **항목별**이다.
 *
 * 전부 아니면 전무가 아닌 이유: 2026-09-20 실측에서 넷 중 `csatOrderInsert` 하나가 타임아웃 났는데,
 * 전부를 버리니 읽히는 세 개(표제어 · 한국어 뜻 % · 도서–어휘 연결)까지 화면에서 사라졌다.
 * 못 읽은 **항목이 든 문장만** 버린다. 상수로 대체하는 길은 여기에도 없다.
 */
export type Facts = Partial<{
  headwords: number
  meaningKoPct: number
  bookVocabLinks: number
  csatOrderInsert: number
}> | null

const MARKER = /\{(\w+)\}/g
const fmtNum = (n: number) => n.toLocaleString('en-US')

/** 마커를 실측치로 채운다. 채울 수 없으면 `null` — 부르는 쪽이 그 문장을 버린다. */
export function resolveMarkers(s: string, facts: Facts): string | null {
  if (!MARKER.test(s)) {
    MARKER.lastIndex = 0
    return s
  }
  MARKER.lastIndex = 0
  if (!facts) return null
  let ok = true
  const out = s.replace(MARKER, (m, k: string) => {
    const v = (facts as Record<string, number>)[k]
    if (typeof v !== 'number') {
      ok = false
      return m
    }
    return k.endsWith('Pct') ? String(v) : fmtNum(v)
  })
  return ok ? out : null
}

const HEADLINE = '내가 아는 비율로 읽기를 설계합니다'
const SUBHEAD =
  '글의 난이도가 아니라 내가 아는 비율을 잽니다. 이 글이 편하게 읽히기까지 몇 낱말이 남았는지 계산해 드려요. 로그인 없이 먼저 재 보세요.'

/** 섹션 제목 — 자리마다 다른 말을 해야 한다. 같은 말이 두 번 나오면 그 자리는 없어도 되는 자리다. */
const SECTIONS = [
  '지문을 붙여 넣으면 모르는 낱말이 칠해집니다',
  '같은 글도 사람마다 다른 숫자가 나옵니다',
  '복습을 미루면 커버리지가 내려갑니다',
  '이 글이 편해지기까지 몇 낱말이 남았는지',
  '퍼블릭 도메인 고전을 챕터별 어휘와 함께',
  '학급을 만들고 초대코드를 나눠 줍니다',
  '기출은 소재가 아니라 형식으로 읽습니다',
  '로그인 없이 먼저 재 봅니다',
]

const CARD_TITLES = [
  '내 기준 커버리지',
  '시간에 따라 변하는 숫자',
  '남은 낱말 수',
  '학급에 나눠 줄 한 장',
  '챕터별 어휘',
  '받아쓰기와 발음 대조',
]

/** 본문 — 마커가 든 문장은 DB 를 못 읽으면 통째로 빠진다. */
const BODIES = [
  '글의 난이도가 아니라 내가 아는 비율을 잽니다. 같은 글도 아는 낱말이 다르면 다른 숫자가 나옵니다.',
  '표제어 {headwords}개에 한국어 뜻이 {meaningKoPct}% 붙어 있습니다. 붙여 넣은 지문의 낱말은 그 사전으로 분해됩니다.',
  '도서–어휘 연결 {bookVocabLinks}행으로 챕터마다 나올 낱말을 미리 셉니다.',
  '수능 유형 문항 {csatOrderInsert}개가 순서·삽입으로 분류돼 있습니다.',
  '복습을 미루면 기억 안정도가 내려가고, 같은 글의 커버리지도 따라 내려갑니다. 2주 뒤 이 글이 얼마나 어려워지는지 미리 보여 줍니다.',
  '학급을 만들고 초대코드를 나눠 주면 학생들의 어휘 진행을 한 화면에서 봅니다.',
  '받아쓴 문장을 원문과 맞춰 보고, 읽은 소리의 높낮이를 원문과 겹쳐 봅니다.',
  '막연히 낱말을 외우는 대신, 이 글이 편하게 읽히는 최소 낱말 집합을 계산해 줍니다.',
]

/** 근거 한 줄 — 논문 또는 계산식. 근거를 못 대는 문장은 여기 들어올 수 없다. */
const BASES = [
  '근거 · Hu & Nation (2000) 읽기 이해 임계 98/95%',
  '근거 · FSRS 기억 안정도 R(t) = exp(ln 0.9 · t / S)',
  '근거 · 출현 빈도 기여도 순 최소 집합',
  '근거 · Karpicke & Roediger (2008) 인출 연습',
  '근거 · 표제어 {headwords} 실측',
]

const SHORTS = ['먼저 재 보기', '서가 둘러보기', '교사 허브', '무료로 시작', '학급 만들기', '요금제', '소개', '기출 분석', 'Vocaflow', '로그인']

export type CopyPlan = Map<string, string>
export type TextSlot = {
  key: string
  role: string
  textLen: number
  fontSize?: string
  x?: number
  y?: number
  w?: number
  h?: number
}

/**
 * **한 제목이 여러 줄로 쪼개져 있는 것**을 묶는다.
 *
 * 참조의 히어로 제목은 한 문장인데 굵기가 다른 두 줄(태그도 다르다)로 나뉘어 있다. 그걸 모르고
 * 줄마다 **다른 문장**을 넣으면 두 문장이 한 자리에서 겹쳐 읽힌다 — 2026-09-20 1:1 캡처에서 드러난 결함.
 * 세로로 잇닿아 있고 가로로 겹치며 글자 크기가 비슷하면 한 덩어리로 본다.
 */
function groupLines(slots: TextSlot[]): TextSlot[][] {
  const size = (s: TextSlot) => parseFloat(s.fontSize ?? '0') || 0
  const groups: TextSlot[][] = []
  for (const s of slots) {
    const last = groups[groups.length - 1]
    const prev = last?.[last.length - 1]
    const joinable =
      prev &&
      prev.y !== undefined && s.y !== undefined && prev.h !== undefined &&
      prev.x !== undefined && s.x !== undefined && prev.w !== undefined && s.w !== undefined &&
      // 세로로 잇닿아 있다(줄 사이 틈이 글자 크기의 60% 이내)
      s.y >= prev.y && s.y - (prev.y + prev.h) <= size(s) * 0.6 &&
      // 가로로 절반 이상 겹친다
      Math.max(0, Math.min(prev.x + prev.w, s.x + s.w) - Math.max(prev.x, s.x)) >= Math.min(prev.w, s.w) * 0.5 &&
      // 글자 크기가 비슷하다(굵기는 달라도 된다 — 참조가 그렇게 쓴다)
      size(prev) > 0 && Math.abs(size(prev) - size(s)) / size(prev) <= 0.25 &&
      // 제목급만 묶는다. 본문 문단이 이어지는 것을 한 문장으로 붙이면 안 된다.
      s.textLen <= 60 && prev.textLen <= 60
    if (joinable) last.push(s)
    else groups.push([s])
  }
  return groups
}

/** 문장 하나를 낱말 단위로 n 줄에 나눈다 — 참조의 「굵기가 다른 두 줄」 장치를 우리 문장으로 재현한다. */
function splitAcross(text: string, n: number): string[] {
  if (n <= 1) return [text]
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= 1) return [text, ...Array(n - 1).fill('')]
  const out: string[] = []
  let at = 0
  for (let i = 0; i < n; i++) {
    const take = Math.max(1, Math.round((words.length - at) / (n - i)))
    out.push(words.slice(at, at + take).join(' '))
    at += take
  }
  return out
}

/**
 * 문구 배정도 규칙이다 — 같은 순서면 같은 결과가 나온다.
 *
 * ⚠️ 역할(`role`)만 보면 안 된다. 참조의 히어로 제목은 `h1` 태그가 아니라 span/div 로 쪼개져 있어서
 *    역할이 `text` 로 잡힌다(실측). 역할만 보던 첫 판은 그래서 64px 제목 자리에 「근거 · Hu & Nation
 *    (2000)」 같은 **각주**를 넣었다. 글자 크기가 그 자리의 위계를 말해 준다 — 크기를 먼저 본다.
 *    절대 px 이 아니라 그 뷰포트의 **최대 제목 대비 비율**로 가른다(1440 은 64px · 375 는 38px).
 */
export function planCopy(slots: TextSlot[], facts: Facts = null): CopyPlan {
  const plan: CopyPlan = new Map()
  // 정본이 먼저다 — 새 문장은 정본이 모자란 자리를 채우는 것이지 정본을 대체하지 않는다.
  // 마커를 채울 수 없는 문장은 여기서 **빠진다**(상수로 때우지 않는다).
  const usable = (xs: string[]) => xs.map((s) => resolveMarkers(s, facts)).filter((s): s is string => s !== null)
  const bodies = usable([...DIFFERENTIATORS.map((d) => d.body), ...BODIES])
  const bases = usable([...DIFFERENTIATORS.map((d) => d.basis), ...BASES])
  const titles = usable([...DIFFERENTIATORS.map((d) => d.title), ...CARD_TITLES])
  const fs = (s: TextSlot) => parseFloat(s.fontSize ?? '0') || 0
  const maxFs = Math.max(0, ...slots.map(fs))
  let headline = 0
  let section = 0
  let title = 0
  let body = 0
  let basis = 0
  let shortIdx = 0
  // 자리 하나가 아니라 **덩어리 하나**에 문장 하나를 준다 — 쪼개진 제목 줄들이 서로 다른 말을 하지 않게.
  for (const group of groupLines(slots)) {
    const s = group[0]
    const rel = maxFs ? fs(s) / maxFs : 0
    // ⚠️ 크기 하나만 보면 안 된다. 자리들이 전부 같은 크기면 `rel` 이 모두 1 이 되어 **전부 표제**가 되고,
    //    본문(숫자가 든 문장이 사는 곳)이 한 줄도 안 들어간다 — 2026-09-20 회귀가 잡은 결함.
    //    120자짜리는 크기가 무엇이든 표제가 아니다. 길이로 한 번 더 거른다.
    const short = s.textLen <= 60
    let text: string
    if ((rel >= 0.9 && short) || s.role === 'h1') text = headline++ === 0 ? HEADLINE : SECTIONS[headline % SECTIONS.length]
    else if ((rel >= 0.5 && short) || s.role === 'h2') text = SECTIONS[section++ % SECTIONS.length]
    else if ((rel >= 0.3 && s.textLen <= 40) || s.role === 'h3') text = titles[title++ % titles.length]
    else if (s.textLen >= 90) text = body++ === 0 ? SUBHEAD : bodies[body % bodies.length]
    else if (s.textLen >= 40) text = bodies[body++ % bodies.length]
    else if (s.textLen >= 18) text = bases[basis++ % bases.length]
    else text = SHORTS[shortIdx++ % SHORTS.length]

    const lines = splitAcross(text, group.length)
    group.forEach((slot, i) => plan.set(slot.key, lines[i] ?? ''))
  }
  return plan
}
