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
import type { SourceBundle, BundleSeries, BundleHero, BundleStage } from './bundle'
import {
  VIDEO_IDS,
  activityVideoId,
  adviceVideoId,
  benefitVideoId,
  methodVideoId,
  seriesVideoId,
  typeVideoId,
} from './ids'

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
    id: VIDEO_IDS.intro,
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
      id: benefitVideoId(slug),
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
    id: VIDEO_IDS.curriculum,
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
    id: seriesVideoId(s.id),
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
        id: typeVideoId(code),
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
      id: activityVideoId(a.id),
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

/* ── 7. 학습방법 ──────────────────────────────────────────────── */
//
// 사용자가 이름을 댄 구성요소인데 **한 편도 없었다**(실측 2026-09-13: 종류가
// intro·benefit·curriculum·series·type·module 여섯뿐이었다). 원료가 없어서였다 —
// 번들에 단계와 면의 성질이 안 들어 있었고, 공장은 번들에 있는 것만 만든다.
//
// 두 규칙이다:
//   · **총론 1편** — 단어 하나가 거치는 5자리. 여기서만 「나아가는 차례」 컷을 쓴다.
//   · **면별 N편** — 각 면이 무엇이고, 무엇으로 통과를 재고, 어느 자리로 올려 주는가.
//
// 면의 개수를 세어 적지 않는다. `FACETS` 에 면을 하나 더하면 영상이 한 편 는다.

/** 면 하나가 올려 주는 자리. spine 이 아닌 면은 자리를 올리지 않는다 — null. */
function stageRaisedBy(b: SourceBundle, facetId: string): BundleStage | null {
  return b.stages.find((s) => s.by === facetId) ?? null
}

function methodStagesSpec(b: SourceBundle): VideoSpec {
  const steps = b.stages.map((s) => ({
    code: s.code,
    name: s.name,
    says: s.says,
    // 「무엇이 올려 주는가」는 면의 **인출 형식**으로 말한다 — 면 이름만 적으면
    // 학습자에겐 낱말 하나가 더 늘 뿐이다.
    by: s.by ? (b.facetLabels[s.by]?.retrieval ?? b.facetLabels[s.by]?.name ?? null) : null,
  }))

  return {
    id: VIDEO_IDS.methodStages,
    kind: 'method',
    audience: 'learner',
    title: '단어 하나가 거치는 다섯 자리',
    subtitle: '외웠다/못 외웠다 둘로 나누지 않습니다 — 어디까지 왔는지를 봅니다',
    accent: 'brand',
    scenes: [
      {
        kind: 'hook',
        caption: '«외웠다» 와 «못 외웠다» 사이에 자리가 셋 더 있습니다',
        line: '어디까지 왔나',
        sub: '단어는 아는/모르는 둘이 아닙니다',
        frames: sec(2.8),
      },
      {
        kind: 'progression',
        caption: b.stages.map((s) => s.name).join(' → '),
        steps,
        frames: sec(6.4),
      },
      {
        kind: 'stat',
        caption: `한 번에 새로 들이는 면 ${b.flow.newFacetsPerSession}개 · 하루 ${b.flow.dailyBlocks.target}블록`,
        stats: [
          {
            value: String(b.flow.newFacetsPerSession),
            label: '한 세션에 새로 들이는 면',
            // 출처를 파일까지 적는다 — 광고에 쓰는 화면이라 근거 없는 수치를 두지 않는다.
            source: 'lib/framework/flow.ts NEW_FACETS_PER_SESSION',
          },
          {
            value: String(b.flow.dailyBlocks.target),
            label: '하루 목표 블록',
            source: 'lib/framework/flow.ts DAILY_BLOCKS.target',
          },
          {
            value: String(b.flow.hitsToPass),
            label: '한 면을 통과로 보는 최소 성공',
            source: 'lib/framework/flow.ts HITS_TO_PASS',
          },
        ],
        frames: sec(3.8),
      },
      closing('지금 어디까지 왔는지 보여 드릴게요.', '내 단어로 확인', 'vocaflow.app/hub'),
    ],
    evidence: b.stages.map((s) => ({
      label: s.code,
      value: s.name,
      source: 'lib/framework/axes.ts STAGES (단계 정본)',
    })),
    formats: [...FORMAT_IDS],
  }
}

function methodFacetSpecs(b: SourceBundle): VideoSpec[] {
  const out: VideoSpec[] = []
  for (const facetId of b.facetOrder) {
    const f = b.facetLabels[facetId]
    if (!f) continue
    const raises = stageRaisedBy(b, facetId)
    // 이 면을 훈련하는 활동 — 번들의 활동 목록에서 **찾는다**. 적어 두지 않는다.
    const trains = b.activities.filter((a) => a.facets.includes(facetId))

    const scenes: SceneSpec[] = [
      {
        kind: 'hook',
        caption: f.says,
        line: f.name,
        sub: f.says,
        frames: sec(2.6),
      },
      {
        kind: 'statement',
        caption: `이 면은 «${f.retrieval}» 으로 잽니다`,
        title: '무엇으로 재나',
        body: f.retrieval,
        basis:
          f.kind === 'spine'
            ? '이 면의 통과가 단계를 정의한다 (spine)'
            : '단계를 정의하지 않고 폭을 넓힌다 (cross)',
        frames: sec(4),
      },
    ]

    // 훈련하는 활동이 하나도 없으면 그 컷을 **빼고**, 없는 활동을 지어내지 않는다.
    if (trains.length > 0) {
      scenes.push({
        kind: 'stat',
        caption: `이 면을 훈련하는 활동 ${trains.length}개`,
        stats: trains.slice(0, 3).map((a) => ({
          value: a.name,
          label: a.says.length > 42 ? a.says.slice(0, 41) + '…' : a.says,
          source: 'lib/framework/registry.ts (활동 정본)',
        })),
        frames: sec(3.6),
      })
    }

    if (raises) {
      scenes.push({
        kind: 'progression',
        caption: `통과하면 ${raises.name} — ${raises.says}`,
        steps: b.stages.map((s) => ({
          code: s.code,
          name: s.name,
          says: s.says,
          by: s.by ? (b.facetLabels[s.by]?.name ?? null) : null,
          now: s.id === raises.id,
        })),
        frames: sec(5),
      })
    }

    scenes.push(
      closing(
        '이 면부터 해 볼까요.',
        trains[0] ? `${trains[0].name} 로 시작` : '내 단어로 시작',
        trains[0]?.route ? `vocaflow.app${trains[0].route.replace('[id]', '…')}` : 'vocaflow.app/hub',
      ),
    )

    out.push({
      id: methodVideoId(facetId),
      kind: 'method',
      audience: 'learner',
      title: `${f.name} — ${f.says}`.length > 42 ? f.name : `${f.name} — ${f.says}`,
      subtitle: f.says.length > 90 ? f.says.slice(0, 89) + '…' : f.says,
      accent: FACET_ACCENT[facetId] ?? 'brand',
      scenes,
      evidence: [
        { label: f.name, value: f.retrieval, source: 'lib/framework/axes.ts FACETS (면 정본)' },
        ...(raises
          ? [
              {
                label: '올려 주는 자리',
                value: `${raises.code} ${raises.name}`,
                source: 'lib/framework/axes.ts STAGE_BY_FACET',
              },
            ]
          : []),
      ],
      formats: [...FORMAT_IDS],
    })
  }
  return out
}

/* ── 8. 권장안 ────────────────────────────────────────────────── */
//
// **여기 나오는 임계값은 전부 `lib/framework/flow.ts` 의 상수 그대로다.** 영상용으로 고쳐
// 적으면 화면과 영상이 다른 말을 하게 되고, 그걸 알아챌 방법이 없다.
//
// 한 자리에서 다음 자리로 갈 때 무엇을 권하고, **무엇이면 아직 안 권하는지**를 말한다.
// 후자가 중요하다 — 시중 광고는 "이것만 하면 됩니다" 로 끝나는데, 우리 처방의 값은
// **아직 아니라고 말할 줄 아는 것**에 있다(`flow.ts`: 막지 않고 권한다 · 후퇴는 조용히).

function adviceSpecs(b: SourceBundle): VideoSpec[] {
  const out: VideoSpec[] = []
  for (let i = 0; i < b.stages.length - 1; i++) {
    const from = b.stages[i]!
    const to = b.stages[i + 1]!
    // 다음 자리로 올려 주는 면. 없으면 그 이동은 영상으로 만들 수 없다 — **건너뛴다.**
    const facetId = to.by
    if (!facetId) continue
    const f = b.facetLabels[facetId]
    if (!f) continue
    const trains = b.activities.filter((a) => a.facets.includes(facetId))

    const scenes: SceneSpec[] = [
      {
        kind: 'hook',
        caption: `«${from.says}» 다음에 무엇을 할까요`,
        line: `${from.name} → ${to.name}`,
        sub: from.says,
        frames: sec(2.8),
      },
      {
        kind: 'progression',
        caption: `지금 ${from.name} — 다음은 ${to.name}`,
        steps: b.stages.map((s) => ({
          code: s.code,
          name: s.name,
          says: s.says,
          by: s.by ? (b.facetLabels[s.by]?.name ?? null) : null,
          now: s.id === from.id,
        })),
        frames: sec(4.8),
      },
      {
        kind: 'statement',
        caption: `권하는 것 — ${f.name}`,
        title: `${f.name} 을 권합니다`,
        body: f.says,
        basis: `${f.retrieval} 으로 잽니다`,
        frames: sec(4),
      },
      {
        // **안 권하는 조건.** 이 컷이 이 영상의 값이다.
        kind: 'stat',
        caption: `아직 안 권하는 때 — 정답률 ${pct(b.flow.accuracyHoldBelow)} 미만 · 만남 ${b.flow.encountersFloor}회 미만`,
        stats: [
          {
            value: pct(b.flow.accuracyHoldBelow),
            label: '앞 면이 이 아래면 다음을 얹지 않습니다',
            source: 'lib/framework/flow.ts ACCURACY_HOLD_BELOW',
          },
          {
            value: `${b.flow.encountersFloor}회`,
            label: '만남이 이보다 적으면 읽기를 먼저 권합니다',
            source: 'lib/framework/flow.ts ENCOUNTERS_FLOOR',
          },
          {
            value: pct(b.flow.accuracyTarget),
            label: '난이도를 맞추는 목표 정답률',
            source: 'lib/framework/flow.ts ACCURACY_TARGET',
          },
        ],
        frames: sec(4.2),
      },
      closing(
        '막지 않고 권합니다.',
        trains[0] ? `${trains[0].name} 로 한 걸음` : '내 단어로 한 걸음',
        trains[0]?.route ? `vocaflow.app${trains[0].route.replace('[id]', '…')}` : 'vocaflow.app/hub',
      ),
    ]

    out.push({
      id: adviceVideoId(from.id),
      kind: 'advice',
      audience: 'learner',
      title: `${from.name} 다음 한 걸음`,
      subtitle: `${from.says} — 그다음은 ${f.name} 입니다`,
      accent: FACET_ACCENT[facetId] ?? 'brand',
      scenes,
      evidence: [
        {
          label: '다음 면',
          value: f.name,
          source: 'lib/framework/axes.ts SPINE (단계를 정의하는 면)',
        },
        {
          label: '보류 임계',
          value: `정답률 ${pct(b.flow.accuracyHoldBelow)} · 만남 ${b.flow.encountersFloor}회`,
          source: 'lib/framework/flow.ts (처방 임계 정본)',
        },
      ],
      formats: [...FORMAT_IDS],
    })
  }
  return out
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
    methodStagesSpec(b),
    ...methodFacetSpecs(b),
    ...adviceSpecs(b),
  ]
}

/** 구성요소 종류별 편수 — 진척을 셀 때 쓰는 분모다. */
export function countByKind(specs: VideoSpec[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of specs) out[s.kind] = (out[s.kind] ?? 0) + 1
  return out
}
