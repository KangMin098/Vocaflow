// packages/video-factory/src/catalog/build.ts
//
// **공장 본체 — 플랫폼의 구성요소를 영상 설계도로 바꾼다.**
//
// 여기에 영상 47편이 손으로 적혀 있지 않다. 있는 것은 **여섯 개의 규칙**이고,
// 편수는 플랫폼이 자라면 같이 는다(시리즈를 하나 만들면 영상이 하나 는다).
// 그것이 "공장" 과 "영상 몇 편" 의 차이다.
//
//   소개 1 · 장점 N(=DIFFERENTIATORS) · 커리큘럼 1 · 시리즈 N(=SERIES_CATALOG)
//   · 유형 N(=TYPE_GUIDE) · 활동 N(=registry)
//
// ── 여기서 지키는 것 ────────────────────────────────────────────
//  · 화면에 나가는 **모든 수치는 번들(=DB 실측)에서 온다.** 상수로 적힌 숫자가 없다.
//  · 재고가 0 이거나 표본이 없으면 **지어내지 않고 그 컷을 뺀다.**
//  · 모든 컷에 자막이 있다(타입이 강제).
//  · 색은 토큰 키만 쓴다.

import type {
  AccentKey,
  Evidence,
  SceneSpec,
  VideoSpec,
  PassageToken,
} from '../spec/types'
import { sec } from '../spec/timing'
import { FORMAT_IDS } from '../spec/format'
import type { SourceBundle, BundleSeries, BundleHero } from './bundle'

/* ── 표기 ─────────────────────────────────────────────────────── */

const ko = new Intl.NumberFormat('ko-KR')

/** 숫자를 한국어 자리표기로. 못 잰 값(null)은 **0 으로 만들지 않는다.** */
function num(n: number | null): string | null {
  return n === null ? null : ko.format(n)
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`
}

/** 시리즈마다 색을 다르게 — 한 매대에 놓였을 때 같은 책으로 읽히지 않게(series-catalog.ts 의 이유). */
const SERIES_ACCENT: Record<string, AccentKey> = {
  reading: 'brand',
  vocab: 'gold',
  syntax: 'forest',
}

/** 활동의 훈련 면에 따라 색을 고른다 — 목록에서 계열이 눈으로 갈린다. */
const FACET_ACCENT: Record<string, AccentKey> = {
  recognize: 'brand',
  spell: 'gold',
  sound: 'slate',
  build: 'forest',
  use: 'amber',
  recall: 'clay',
}

/**
 * 망각 곡선 컷이 쓰는 안정도 S(일).
 *
 * **9 를 쓰고 있었는데 그건 실측 최대치를 넘는 값이었다.** 이 저장소의 FSRS 실측은
 * `복습한 234단어의 최대 S = 8.2956일`(`lib/srs/fsrs.ts` 주석)이고, 대부분은 그보다 훨씬 작다.
 * 게다가 S 가 크면 21일 곡선이 거의 직선이라 **"쇠퇴" 라는 전달 내용 자체가 사라진다**
 * (실측 2026-09-12 스틸에서 확인).
 * 3일은 실측 범위 안이면서 두 임계(0.95 · 0.70)를 모두 지나는 값이다.
 */
const DEMO_STABILITY = 3

/* ── 공통 컷 ──────────────────────────────────────────────────── */

/** 이 영상이 서 있는 실측 근거 — 광고에 쓰므로 출처 없는 수치를 만들지 않는다. */
function platformEvidence(b: SourceBundle): Evidence[] {
  const out: Evidence[] = []
  const at = b.measuredAt.slice(0, 10)
  const add = (label: string, v: number | null, table: string) => {
    const s = num(v)
    if (s) out.push({ label, value: s, source: `${table} ${at} 실측` })
  }
  add('사전 표제어', b.platform.dictionary, 'shared_dictionary')
  add('발행 도서', b.platform.booksPublished, 'library_books(published)')
  add('문항', b.platform.items, 'csat_dcp_items')
  add('챕터 퀴즈', b.platform.chapterQuiz, 'library_chapter_quiz')
  return out
}

/** 닫는 컷 — 다음 한 걸음(D5). 폭죽·트로피 없음. */
function closing(line: string, cta: string, url: string): SceneSpec {
  return { kind: 'closing', caption: `${line} — ${cta}`, line, cta, url, frames: sec(2.6) }
}

/**
 * 커버리지 증명 컷 — 랜딩 히어로와 **같은 지문·같은 계산**.
 *
 * `null` 이면 그 컷이 빠진다. 빈 지문을 그리지 않는다.
 */
function coverageScene(hero: BundleHero | null, level: number): SceneSpec | null {
  if (!hero) return null
  const reading = hero.readings.find((r) => r.level === level) ?? hero.readings[0]
  if (!reading) return null
  const tokens: PassageToken[] = hero.tokens.map((t) => {
    const isWord = t.v !== undefined
    if (!isWord) return { text: t.t, known: false, plain: true }
    // 그 레벨의 학습자가 아는 낱말 = 사전 V-Level 이 그 레벨 이하인 것.
    // 레벨 미상(null)은 **모르는 쪽**으로 센다 — 후하게 세면 커버리지가 부풀고 그건 거짓이다.
    return { text: t.t, known: t.v !== null && t.v !== undefined && t.v <= level }
  })
  return {
    kind: 'coverage',
    caption: `${reading.label} 기준 ${pct(reading.coverage)} — 모르는 낱말 ${reading.unknownWords}개`,
    tokens,
    // **%를 여기 넣지 않는다** — 큰 숫자가 이미 그 값을 세어 올린다. 둘을 나란히 두면
    // 진행 중인 숫자와 최종값이 서로를 부정한다(실측 2026-09-12: "46%" 옆에 "67%").
    label: reading.label,
    frames: sec(4),
  }
}

/* ── 1. 플랫폼 소개 ───────────────────────────────────────────── */

function introSpec(b: SourceBundle): VideoSpec {
  const scenes: SceneSpec[] = [
    {
      kind: 'hook',
      caption: '같은 글도 읽는 사람마다 난이도가 다릅니다.',
      line: '이 글, 나한테는 몇 퍼센트나 읽힐까?',
      sub: '글의 난이도가 아니라 내가 아는 비율',
      frames: sec(2.4),
    },
  ]

  // 두 레벨을 차례로 보여 준다 — **같은 글이 사람마다 다른 숫자를 낸다**는 것이 주장이고,
  // 한 레벨만 보여 주면 그 대조가 성립하지 않는다.
  const low = b.hero?.readings[0]
  const high = b.hero?.readings[b.hero.readings.length - 1]
  if (low) {
    const s = coverageScene(b.hero, low.level)
    if (s) scenes.push(s)
  }
  if (high && high.level !== low?.level) {
    const s = coverageScene(b.hero, high.level)
    if (s) scenes.push(s)
  }

  scenes.push({
    kind: 'decay',
    caption: '그 숫자는 고정이 아닙니다 — 복습을 미루면 내려갑니다.',
    stability: DEMO_STABILITY,
    days: 21,
    label: 'R(t) = exp(ln 0.9 · t / S)',
    frames: sec(4),
  })

  const stats = platformEvidence(b)
  if (stats.length > 0) {
    scenes.push({
      kind: 'stat',
      caption: '재는 데 쓰는 자료는 전부 실측입니다.',
      stats: stats.map((e) => ({ value: e.value, label: e.label, source: e.source })),
      frames: sec(3.4),
    })
  }

  scenes.push(closing('내 지문으로 바로 재 보세요.', '무료 · 로그인 없이', 'vocaflow.app/fit'))

  return {
    id: 'intro-platform',
    kind: 'intro',
    audience: 'learner',
    title: 'Vocaflow',
    subtitle: '글의 난이도가 아니라, 내가 아는 비율을 잽니다.',
    accent: 'brand',
    scenes,
    evidence: platformEvidence(b),
    formats: [...FORMAT_IDS],
  }
}

/* ── 2. 플랫폼 장점 ───────────────────────────────────────────── */

const BENEFIT_SLUG = ['coverage', 'decay', 'minimum'] as const

function benefitSpecs(b: SourceBundle): VideoSpec[] {
  return b.differentiators.map((d, i) => {
    const slug = BENEFIT_SLUG[i] ?? `n${i + 1}`
    const accent: AccentKey = i === 0 ? 'brand' : i === 1 ? 'amber' : 'gold'
    const scenes: SceneSpec[] = [
      {
        kind: 'hook',
        caption: d.title,
        line: d.title,
        frames: sec(1.8),
      },
      {
        kind: 'statement',
        caption: d.body,
        title: d.title,
        body: d.body,
        basis: d.basis,
        frames: sec(4.2),
      },
    ]

    // 첫 항목은 커버리지 주장이므로 **그 자리에서 증명**한다(N2 즉시 증명).
    if (i === 0) {
      const proof = coverageScene(b.hero, b.hero?.readings[0]?.level ?? 3)
      if (proof) scenes.push(proof)
    }
    // 두 번째는 망각 곡선이 곧 증명이다.
    if (i === 1) {
      scenes.push({
        kind: 'decay',
        caption: '2주 뒤 이 글이 얼마나 어려워지는지 미리 봅니다.',
        stability: DEMO_STABILITY,
        days: 21,
        label: 'FSRS 기억 안정도',
        frames: sec(3.8),
      })
    }

    scenes.push(closing('직접 확인해 보세요.', '지문 하나면 됩니다', 'vocaflow.app/fit'))

    return {
      id: `benefit-${slug}`,
      kind: 'benefit',
      audience: 'ad',
      title: d.title,
      subtitle: d.body.length > 90 ? d.body.slice(0, 89) + '…' : d.body,
      accent,
      scenes,
      evidence: [{ label: d.title, value: '근거', source: d.basis }],
      formats: [...FORMAT_IDS],
    }
  })
}

/* ── 3. 커리큘럼 ──────────────────────────────────────────────── */

function curriculumSpec(b: SourceBundle): VideoSpec {
  const rungs = b.spine.map((r) => ({
    step: r.step,
    schoolBand: r.schoolBand,
    title: r.volumeTitle,
    items: r.items,
  }))
  const filled = rungs.filter((r) => r.items > 0).length
  const total = b.spine.reduce((s, r) => s + r.items, 0)

  return {
    id: 'curriculum-ladder',
    kind: 'curriculum',
    audience: 'learner',
    title: '7단 커리큘럼',
    subtitle: '소리부터 수능까지, 한 사다리로 이어집니다.',
    accent: 'brand',
    scenes: [
      {
        kind: 'hook',
        caption: '어디서 시작해서 어디까지 가는지 먼저 보여 드립니다.',
        line: '지금 내 자리는 몇 단일까?',
        frames: sec(2.2),
      },
      {
        kind: 'ladder',
        caption: `학령 ${b.spine.length}단 — 각 단이 쓰는 문항이 다릅니다.`,
        rungs,
        frames: sec(5.5),
      },
      {
        kind: 'stat',
        caption: `재고가 찬 단 ${filled}/${b.spine.length}`,
        stats: [
          {
            value: ko.format(total),
            label: '사다리 전체 문항',
            source: `textbook_shelf_inventory() ${b.measuredAt.slice(0, 10)} 실측`,
          },
          {
            value: `${filled}/${b.spine.length}`,
            label: '재고가 찬 단',
            source: '같은 실측 · 재고 0 인 단은 비워 둔다',
          },
        ],
        frames: sec(3.2),
      },
      closing('내 단부터 시작하세요.', '진단 3분', 'vocaflow.app/fit'),
    ],
    evidence: [
      {
        label: '사다리 전체 문항',
        value: ko.format(total),
        source: `textbook_shelf_inventory() ${b.measuredAt.slice(0, 10)} 실측`,
      },
    ],
    formats: [...FORMAT_IDS],
  }
}

/* ── 4. 브랜드 시리즈 ─────────────────────────────────────────── */

function seriesSpec(b: SourceBundle, s: BundleSeries): VideoSpec {
  const shipped = s.status === 'shipping'
  const volumes = s.rungs.map((r) => ({
    title: r.volumeTitle,
    state: (r.items >= 60 ? (shipped ? 'published' : 'ready') : 'pending') as
      | 'published'
      | 'ready'
      | 'pending',
  }))
  const stock = s.rungs.reduce((sum, r) => sum + r.items, 0)
  const ready = volumes.filter((v) => v.state !== 'pending').length

  return {
    id: `series-${s.id}`,
    kind: 'series',
    audience: 'learner',
    title: s.brand,
    subtitle: s.question,
    accent: SERIES_ACCENT[s.id] ?? 'brand',
    scenes: [
      {
        kind: 'hook',
        caption: s.question,
        line: s.question,
        sub: s.brand,
        frames: sec(2.4),
      },
      {
        kind: 'shelf',
        caption: `${s.rungs.length}권이 학령을 계단으로 잇습니다.`,
        volumes,
        frames: sec(4.6),
      },
      {
        kind: 'stat',
        caption: `찍을 수 있는 권 ${ready}/${volumes.length}`,
        stats: [
          {
            value: ko.format(stock),
            label: `${s.brand} 재고`,
            source: `textbook_shelf_inventory() ${b.measuredAt.slice(0, 10)} 실측 · 단별 V레벨로 좁힘`,
          },
          {
            value: `${ready}/${volumes.length}`,
            label: '한 권을 채운 단',
            source: '한 권 = 60문항 (조판 기록 실측)',
          },
        ],
        frames: sec(3.2),
      },
      closing(
        shipped ? '지금 서가에 있습니다.' : '곧 나옵니다.',
        '시리즈 보기',
        'vocaflow.app/textbook',
      ),
    ],
    evidence: [
      {
        label: `${s.brand} 재고`,
        value: ko.format(stock),
        source: `textbook_shelf_inventory() ${b.measuredAt.slice(0, 10)} 실측`,
      },
      {
        label: '시장 경쟁 시리즈',
        value: String(s.marketSeries),
        source: `교재 코퍼스 실측 · ${s.marketExamples.join(' · ')}`,
      },
    ],
    formats: [...FORMAT_IDS],
  }
}

/* ── 5. 문항 유형 ─────────────────────────────────────────────── */

function typeSpecs(b: SourceBundle): VideoSpec[] {
  return Object.entries(b.typeGuide)
    .sort(([a], [c]) => a.localeCompare(c))
    .map(([code, g]) => {
      const sample = b.samples[code]
      const scenes: SceneSpec[] = [
        {
          kind: 'hook',
          caption: g.says,
          line: g.label,
          sub: g.says,
          frames: sec(2.6),
        },
      ]

      // 실제 문항이 있을 때만 문항 컷을 넣는다. 없으면 **만들어 넣지 않는다.**
      if (sample) {
        scenes.push({
          kind: 'item',
          caption: sample.abridged ? '실제 문항 (영상용으로 줄임)' : '실제 문항입니다.',
          typeCode: code,
          typeLabel: g.label,
          says: g.says,
          sample: { prompt: sample.prompt, choices: sample.choices, answer: sample.answer },
          frames: sec(5),
        })
      }

      if (g.items > 0) {
        scenes.push({
          kind: 'stat',
          caption: `이 유형 재고 ${ko.format(g.items)}문항`,
          stats: [
            {
              value: ko.format(g.items),
              label: `${g.label} 문항`,
              source: `textbook_shelf_inventory() ${b.measuredAt.slice(0, 10)} 실측`,
            },
            {
              value: ko.format(g.explained),
              label: '해설이 붙은 문항',
              source: '같은 실측 · explained_count',
            },
          ],
          frames: sec(3),
        })
      }

      scenes.push(closing('이 유형만 모아 풀 수 있어요.', '유형별 보기', 'vocaflow.app/textbook'))

      return {
        id: `type-${code.replace(/_/g, '-')}`,
        kind: 'type',
        audience: 'learner',
        title: g.label,
        subtitle: g.says.length > 90 ? g.says.slice(0, 89) + '…' : g.says,
        accent: g.items > 0 ? 'brand' : 'slate',
        scenes,
        evidence: [
          {
            label: `${g.label} 재고`,
            value: ko.format(g.items),
            source: `textbook_shelf_inventory() ${b.measuredAt.slice(0, 10)} 실측`,
          },
        ],
        formats: [...FORMAT_IDS],
      }
    })
}

/* ── 6. 학습 활동 ─────────────────────────────────────────────── */

function activitySpecs(b: SourceBundle): VideoSpec[] {
  return b.activities.map((a) => {
    const facets = a.facets
      .map((f) => b.facetLabels[f])
      .filter((f): f is NonNullable<typeof f> => Boolean(f))
    const accent = FACET_ACCENT[a.facets[0] ?? ''] ?? 'brand'

    const scenes: SceneSpec[] = [
      {
        kind: 'hook',
        caption: a.says,
        line: a.name,
        sub: a.says,
        frames: sec(2.6),
      },
    ]

    if (facets.length > 0) {
      scenes.push({
        kind: 'stat',
        caption: `훈련하는 면 ${facets.map((f) => f.name).join(' · ')}`,
        stats: facets.map((f) => ({
          value: f.name,
          label: f.says,
          source: 'lib/framework/axes.ts (면 정본)',
        })),
        frames: sec(3.4),
      })
    }

    scenes.push(
      closing(
        '한 판 해 보세요.',
        a.contentNeed === 'words' ? '내 단어만 있으면 됩니다' : '본문을 고르면 바로 시작',
        a.route ? `vocaflow.app${a.route.replace('[id]', '…')}` : 'vocaflow.app/hub',
      ),
    )

    return {
      id: `module-${a.id}`,
      kind: 'module',
      audience: 'learner',
      title: a.name,
      subtitle: a.says.length > 90 ? a.says.slice(0, 89) + '…' : a.says,
      accent,
      scenes,
      evidence: [
        {
          label: a.name,
          value: facets.map((f) => f.name).join(' · ') || '—',
          source: 'lib/framework/registry.ts (활동 정본)',
        },
      ],
      formats: [...FORMAT_IDS],
    }
  })
}

/* ── 조립 ─────────────────────────────────────────────────────── */

export function buildSpecs(b: SourceBundle): VideoSpec[] {
  return [
    introSpec(b),
    ...benefitSpecs(b),
    curriculumSpec(b),
    ...b.series.map((s) => seriesSpec(b, s)),
    ...typeSpecs(b),
    ...activitySpecs(b),
  ]
}

/** 구성요소 종류별 편수 — 진척을 셀 때 쓰는 분모다. */
export function countByKind(specs: VideoSpec[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of specs) out[s.kind] = (out[s.kind] ?? 0) + 1
  return out
}
