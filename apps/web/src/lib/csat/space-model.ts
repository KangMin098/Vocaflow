// apps/web/src/lib/csat/space-model.ts
//
// **기출 작업 공간의 모양과 규칙 — 순수.** 파일도 DB 도 React 도 모른다.
//
// 이 모델이 세우는 화면(`/csat/space`)은 참조(Tines 3B)의 **앱 화면**을 우리 자산으로 옮긴 것이다
// (tines-mapping §0 「앱 화면」 행 — 그동안 ○ 예정이었다). 참조의 골격은
//   좌측 레일(목록) · 무늬 띠 + 명령 상자 · 탭 · 한 줄이 한 작업인 표
// 인데, 그 표의 행이 참조에서는 workflow 고 우리에게는 **유형 26 · 함정 32** 다.
//
// ── 수치의 출처 ────────────────────────────────────────────────────────────
// `trap-atlas.json` 하나다(`scripts/csat/build-trap-atlas.mjs` 가 DB 에서 세어 구운 것).
// 그래서 이 화면은 **조회 왕복이 0** 이고 로그인 상태에 흔들리지 않는다. 회차 이름만
// 서버가 `skeletonExamMeta()`(역시 구운 JSON)로 읽어 넘긴다.
// ⚠️ 여기에 수치를 적지 않는다. 손으로 적은 수는 다음 빌드에 조용히 낡는다(AGENTS I5).
//
// ⚠️ `server-only` 를 들이지 않는다 — 표와 명령 상자가 클라이언트에서 다시 거르므로
//    이 모듈이 브라우저 그래프에 들어간다(`trap-atlas.ts` 머리말과 같은 이유).

import { ATLAS_TYPES, BUILT_AT, CORPUS, DETECTOR, RECENT_FROM, TRAPS, UNIVERSAL_MIN_TYPES, type TrapEntry } from './trap-atlas'

// ⚠️ **예시의 인용문(`tempting`·`reject`)은 이 화면에 오지 않는다.** 그 두 줄에는 지문 구절이
//    영어로 그대로 들어 있고, 지금까지 그것을 그린 화면은 관리자(`/admin/kice/*`)뿐이다.
//    학습자 쪽 원문은 기기의 PDF(reflow)에서만 온다 — `copyright-boundary` 회귀의 경계다.
//    그래서 여기서는 **어느 문항인지(회차 · 번호)**와 우리가 쓴 잡는 법만 내보낸다.

/** 참조가 면마다 색상을 바꾸는 자리 — globals 의 `.tone-*` 와 같은 이름을 쓴다. */
export const SPACE_TONES = ['lavender', 'green', 'peach', 'yellow', 'pink', 'teal'] as const
export type SpaceTone = (typeof SPACE_TONES)[number]

/** 색은 **자리(index)가 정한다** — 이름 해시로 고르면 데이터가 늘 때 색이 통째로 섞인다. */
export const toneAt = (i: number): SpaceTone => SPACE_TONES[((i % SPACE_TONES.length) + SPACE_TONES.length) % SPACE_TONES.length]

export type SpaceTab = 'type' | 'trap'

export interface SpaceBadge {
  label: string
  tone: SpaceTone
}

export interface SpaceRow {
  key: string
  kind: SpaceTab
  name: string
  tone: SpaceTone
  /** 참조의 `● Live` 자리 — 우리에게는 「출제 중」·「유형을 가로지름」이다. */
  live: boolean
  liveLabel: string
  /** 이름 아래 한 줄. 라벨 없이 사실만 — 참조의 `⑂ 1 branch · Last updated 2h ago` 자리. */
  meta: string[]
  /** 「갖춘 것」 칸(참조 Connectors) — 이 행으로 무엇까지 되는가. */
  badges: SpaceBadge[]
  /** 「걸친 범위」 칸(참조 Trigger). */
  reach: string
  /** 「갖춘 것」 칸의 채움 배지 — 유형은 계열 이름이 붙은 비율, 함정은 이름 붙은 오답 중 비중. */
  coverage: { label: string; pct: number }
  /** 「최근 4개년」 칸(참조 Created) — 옛 설계와 지금을 가르는 축. */
  recent: number
  /** 최근 비율(0~1). 막대의 길이가 된다. */
  recentRatio: number
  /** 「예시」 칸(참조 Created by) — 실제 기출 하나. 없으면 null 이고 화면이 그렇게 말한다. */
  example: { slug: string; label: string; no: number } | null
  /** 검색이 훑는 글자 — 이름 · 함정 이름 · 회차 이름 · 번호까지. */
  search: string
  /** 정렬 기준(큰 것 위로). 참조 표는 최근 갱신 순이지만 우리 표는 **양**이 먼저다. */
  weight: number
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0)

/** 이 유형에 **한 번이라도** 나온 함정. 0 인 칸은 없는 것이지 작은 것이 아니다. */
function trapsOfType(typeId: string): TrapEntry[] {
  return TRAPS.filter((t) => (t.by_type[typeId] ?? 0) > 0)
}

function exampleOf(entries: TrapEntry[], typeId?: string) {
  for (const t of entries) {
    const found = t.examples.find((e) => !typeId || e.type_id === typeId)
    if (found) return { slug: found.slug, label: found.exam_label, no: found.no }
  }
  return null
}

/** 유형 26 — 행 하나가 「이 유형을 해부할 준비가 어디까지 됐나」다. */
export function typeRows(): SpaceRow[] {
  return ATLAS_TYPES.map((type, i) => {
    const traps = trapsOfType(type.id)
    const named = pct(type.named, type.distractors)
    const example = exampleOf(traps, type.id)
    const coverage = { label: `계열 이름 ${named}%`, pct: named }
    const badges: SpaceBadge[] = [{ label: coverage.label, tone: toneAt(i) }]
    if (example) badges.push({ label: '예시 있음', tone: toneAt(i + 3) })
    return {
      key: type.id,
      kind: 'type' as const,
      name: type.name,
      tone: toneAt(i),
      live: type.status === 'active',
      liveLabel: type.status === 'active' ? '출제 중' : '지금은 안 나옴',
      meta: [`문항 ${type.items}`, `오답 ${type.distractors}`],
      badges,
      coverage,
      reach: `함정 ${traps.length}종`,
      recent: type.recent,
      recentRatio: type.distractors > 0 ? type.recent / type.distractors : 0,
      example,
      search: [type.name, type.id, ...traps.map((t) => t.key), example?.label ?? '', example ? String(example.no) : '']
        .join(' ')
        .toLowerCase(),
      weight: type.items,
    }
  }).sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
}

/** 함정 32 — 행 하나가 「평가원이 오답을 만드는 한 가지 방법」이다. */
export function trapRows(): SpaceRow[] {
  return TRAPS.map((trap, i) => {
    const universal = trap.types >= UNIVERSAL_MIN_TYPES
    const example = trap.examples[0] ?? null
    const share = pct(trap.n, CORPUS.named)
    const coverage = { label: `이름 붙은 오답의 ${share}%`, pct: share }
    const badges: SpaceBadge[] = [{ label: coverage.label, tone: toneAt(i) }]
    if (example) badges.push({ label: '예시 있음', tone: toneAt(i + 3) })
    return {
      key: trap.key,
      kind: 'trap' as const,
      name: trap.key,
      tone: toneAt(i),
      live: universal,
      liveLabel: universal ? '유형을 가로지름' : '유형에 매임',
      meta: [`오답 ${trap.n}`, `문항 ${trap.items}`],
      badges,
      coverage,
      reach: `${trap.types}유형`,
      recent: trap.recent,
      recentRatio: trap.n > 0 ? trap.recent / trap.n : 0,
      example: example ? { slug: example.slug, label: example.exam_label, no: example.no } : null,
      search: [trap.key, ...trap.examples.map((e) => `${e.exam_label} ${e.no}`)].join(' ').toLowerCase(),
      weight: trap.n,
    }
  }).sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
}

export interface SpaceFilter {
  /** 이름 · 함정 · 회차 이름 · 번호. 빈 문자열이면 거르지 않는다. */
  query: string
  /** 예시 기출이 붙은 행만 */
  withExample: boolean
  /** 최근 4개년에 실제로 나온 행만 */
  recentOnly: boolean
  /** 이 키(유형 id · 함정 이름)의 행만 — 목적별 경로(「킬러 유형 잡기」 등)가 미리 짠 묶음. null 이면 거르지 않는다 */
  keys?: string[] | null
}

export const EMPTY_SPACE_FILTER: SpaceFilter = { query: '', withExample: false, recentOnly: false, keys: null }

/**
 * 「킬러 유형」 — 빈칸 · 순서 · 삽입. **이름으로 고른다**(유형 id 를 손으로 적으면 코퍼스를 다시 구울 때
 * 조용히 빗나간다). 근거: needs-research N17(오답률 상위가 이 셋).
 */
export const KILLER_PATTERN = /빈칸|순서|삽입/
export function killerTypeIds(): string[] {
  return ATLAS_TYPES.filter((t) => KILLER_PATTERN.test(t.name)).map((t) => t.id)
}

/** 한 축이라도 맞지 않으면 뺀다(AND) — `browse-model.filterBrowse` 와 같은 규칙이다. */
export function filterRows(rows: SpaceRow[], filter: SpaceFilter): SpaceRow[] {
  const needle = filter.query.trim().toLowerCase()
  return rows.filter((row) => {
    if (filter.withExample && !row.example) return false
    if (filter.recentOnly && row.recent === 0) return false
    if (filter.keys && !filter.keys.includes(row.key)) return false
    if (!needle) return true
    return needle.split(/\s+/).every((word) => row.search.includes(word))
  })
}

// ── 펼친 줄이 말하는 것 ────────────────────────────────────────────────────
//
// 참조 상세 화면의 바닥에는 색 카드 넷이 있다(단계). 우리는 그것을 **한 줄을 펼쳤을 때**
// 나오는 넷으로 접었다 — 화면을 하나 더 만들지 않고도 「이 행으로 무엇을 할 수 있나」가 선다.

export interface SpaceStep {
  /** 카드 제목 */
  title: string
  /** 한 줄 설명 — 수치이거나 우리가 쓴 절차다. 지문 인용은 오지 않는다. */
  body: string
  tone: SpaceTone
  /** 이 카드가 여는 곳. 없으면 읽기만 하는 카드다. */
  href?: string
  hrefLabel?: string
}

/** 이 유형에서 가장 많이 쓰인 함정 셋 — 「이 유형은 무엇으로 오답을 만드나」. */
export function topTrapsOfType(typeId: string, take = 3): { key: string; n: number; share: number }[] {
  const total = ATLAS_TYPES.find((t) => t.id === typeId)?.named ?? 0
  return TRAPS.map((t) => ({ key: t.key, n: t.by_type[typeId] ?? 0, share: total > 0 ? (t.by_type[typeId] ?? 0) / total : 0 }))
    .filter((t) => t.n > 0)
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key))
    .slice(0, take)
}

/** 함정을 잡는 법 한 줄 — **우리가 쓴 글**이다(`DETECTOR`). 센 값과 섞어 읽지 않는다. */
export function detectorLine(key: string): string | null {
  return DETECTOR[key] ?? null
}

export function stepsFor(row: SpaceRow): SpaceStep[] {
  const steps: SpaceStep[] = []
  if (row.kind === 'type') {
    const top = topTrapsOfType(row.key)
    steps.push({
      title: '무엇으로 오답을 만드나',
      body: top.length
        ? top.map((t) => `${t.key} ${t.n}`).join(' · ')
        : '이 유형은 아직 이름 붙은 오답이 없다 — 세어 둔 것이 없다는 뜻이지 함정이 없다는 뜻이 아니다.',
      tone: toneAt(0),
    })
    steps.push({
      title: '얼마나 남아 있나',
      body:
        row.coverage.pct >= 100
          ? '이 유형의 오답은 전부 계열 이름이 붙었다 — 예측 보기를 만들 재료가 다 있다.'
          : `오답의 ${row.coverage.pct}% 에만 계열 이름이 붙었다 — 나머지는 아직 이름이 없다.`,
      tone: toneAt(1),
    })
  } else {
    steps.push({
      title: '잡는 법',
      body: detectorLine(row.key) ?? '아직 한 줄로 적어 두지 않았다 — 예시 문항에서 직접 확인한다.',
      tone: toneAt(0),
    })
    steps.push({
      title: '얼마나 넓은가',
      body: `${row.reach}에 걸친다. 최근 4개년에도 ${row.recent}번 나왔다.`,
      tone: toneAt(1),
    })
  }
  steps.push({
    title: '예시 기출',
    body: row.example ? `${row.example.label} ${row.example.no}번` : '골라 둔 예시가 아직 없다.',
    tone: toneAt(2),
    href: row.example ? `/csat/item/${row.example.slug}` : undefined,
    hrefLabel: '해설 극장에서 열기',
  })
  steps.push({
    title: '서가에서 보기',
    body: row.kind === 'type' ? '이 유형의 기출을 전부 훑는다.' : '이 함정이 나온 유형부터 훑는다.',
    tone: toneAt(3),
    href: row.kind === 'type' ? `/csat/browse?type=${encodeURIComponent(row.key)}` : '/csat/browse',
    hrefLabel: '전체 기출 서가',
  })
  return steps
}

// ── 무늬 띠 ────────────────────────────────────────────────────────────────
//
// 참조 앱 화면의 머리는 **무늬 한 장**이다(겹친 원 · 돔 · 네모별). 우리는 그 무늬를
// 장식으로 그리지 않고 **데이터로 그린다** — 원 하나가 행 하나이고, 지름이 그 행의 양이다.
// 그래서 띠를 보면 「상위 몇 개가 얼마나 큰가」가 그대로 보이고, 탭을 바꾸면 무늬가 바뀐다.
//
// ⚠️ 난수를 쓰지 않는다. 서버와 브라우저가 다른 그림을 그리면 hydration 이 깨지고,
//    캡처 diff 도 매번 달라진다(globals §4.5 「캡처 결정론」과 같은 이유).

export type PatternKind = 'circle' | 'dome' | 'star'

export interface PatternShape {
  kind: PatternKind
  cx: number
  cy: number
  r: number
  tone: SpaceTone
  /** 0~1 — 작은 도형일수록 옅다. */
  depth: number
}

export const PATTERN_VIEWBOX = { w: 1200, h: 240 } as const

/** 결정론 난수(mulberry32) — 씨가 같으면 그림이 같다. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 띠의 도형 목록. `weights` 는 행의 `weight` 를 그대로 넘긴다 — 무늬와 표가 **같은 수**를 본다.
 * `seed` 는 탭마다 다르게 준다(참조도 화면마다 다른 무늬를 쓴다).
 */
export function patternShapes(weights: number[], seed: number): PatternShape[] {
  if (weights.length === 0) return []
  const max = Math.max(...weights)
  const next = rng(seed)
  const { w, h } = PATTERN_VIEWBOX
  const step = w / weights.length
  // 표는 큰 것부터 내려오므로 그 순서 그대로 그리면 **왼쪽만 큰 띠**가 된다(실측 2026-09-23).
  // 큰 것과 작은 것을 번갈아 놓아 띠 전체에 크기가 퍼지게 한다 — 셈은 그대로다.
  const zigzag = weights.map((_, i) => (i % 2 === 0 ? i / 2 : weights.length - 1 - (i - 1) / 2))
  return zigzag.map((source, i) => {
    const weight = weights[source]
    const scale = max > 0 ? Math.sqrt(Math.max(weight, 0) / max) : 0
    const r = 34 + scale * 118
    const jitterX = (next() - 0.5) * step * 1.6
    const kindRoll = next()
    const kind: PatternKind = kindRoll > 0.86 ? 'star' : kindRoll > 0.58 ? 'dome' : 'circle'
    // 돔은 바닥선에 앉는다 — 참조 띠의 아랫줄이 그렇게 생겼다.
    const cy = kind === 'dome' ? h : 24 + next() * (h - 48)
    return {
      kind,
      cx: step * (i + 0.5) + jitterX,
      cy,
      r: kind === 'star' ? r * 0.42 : r,
      tone: toneAt(source + seed),
      depth: 0.35 + scale * 0.65,
    }
  })
}

/** 네모별(참조의 4각 반짝임) 경로 — 반지름 하나로 그린다. */
export function starPath(cx: number, cy: number, r: number): string {
  const k = r * 0.3
  return [
    `M ${cx} ${cy - r}`,
    `C ${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + r} ${cy}`,
    `C ${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx} ${cy + r}`,
    `C ${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - r} ${cy}`,
    `C ${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx} ${cy - r}`,
    'Z',
  ].join(' ')
}

/** 머리 눈금 — 화면이 스스로 「무엇을 세고 있는지」 말한다. 전부 구운 코퍼스에서 온다. */
export function spaceHeadline() {
  return {
    items: CORPUS.items,
    analyzed: CORPUS.analyzed,
    distractors: CORPUS.distractors,
    named: CORPUS.named,
    namedRecent: CORPUS.named_recent,
    types: ATLAS_TYPES.length,
    traps: TRAPS.length,
    recentTotal: CORPUS.recent,
    yearMin: CORPUS.year_min,
    yearMax: CORPUS.year_max,
    universalMinTypes: UNIVERSAL_MIN_TYPES,
    /** 최근 4개년의 시작 학년도 — 「최근」이 몇 년인지 화면이 직접 말한다. */
    recentFrom: RECENT_FROM,
    /** 구운 시각. 낡은 수치를 근거로 쓰지 않으려면 **언제 잰 것인지**가 같이 있어야 한다. */
    builtAt: BUILT_AT,
  }
}
