// packages/video-factory/src/catalog/plan.ts
//
// **기획 — 다음에 무엇을 찍을 것인가.**
//
// 파이프라인 세 단계(기획·제작·평가) 중 첫째. 없는 동안 `/admin/video` 는
// **"무엇이 밀렸나"** 는 답해도 **"다음에 무엇을 찍어야 하나"** 는 못 답했다.
//
// ── 왜 「밀린 것」 만으로는 기획이 아닌가 ──────────────────────────
// 공장은 번들에 있는 것을 **전부** 설계도로 만든다. 그래서 정상 상태에서 「안 만든 편」은
// 늘 0 이고, 화면은 "다 했다" 고 말한다. 그런데 실제로는 **설계도로 표현조차 못 하는 후보**가
// 남아 있다 — 이를테면 교재 **권별** 영상은 규칙이 없어서 목록에 아예 안 나타났다.
// 「없는 것」이 화면에 안 보이면 영원히 안 만들어진다.
//
// 그래서 기획은 **설계도보다 넓은 목록**에서 시작한다: 플랫폼이 가진 주소 가능한 자리 전부.
//
// ── 무엇으로 순서를 정하나 ────────────────────────────────────────
// 재생 수로 정하는 것이 맞지만 **지금 재생은 0** 이다(채널이 없다). 없는 신호로 순위를
// 매기는 대신, 지금 실제로 관측되는 것을 쓴다 — **그 구성요소 뒤에 있는 재고**.
// 재고가 큰 자리를 먼저 찍는 것은 "보여 줄 것이 실제로 많은 자리" 를 먼저 찍는다는 뜻이다.
//
// ⚠️ **재고가 0 인 후보는 순위가 낮은 게 아니라 「지금 만들면 안 되는 것」이다.**
//    빈 서가를 광고하는 영상이 되고, 그건 이 저장소가 공개 화면에서 금지한 종류의 거짓이다.

import {
  VIDEO_IDS,
  adviceVideoId,
  benefitVideoId,
  methodVideoId,
  seriesVideoId,
  typeVideoId,
  activityVideoId,
  volumeVideoId,
} from './ids'
import type { SourceBundle } from './bundle'

/**
 * 장점 영상의 슬러그 — 공장(`build.ts`)의 `BENEFIT_SLUG` 와 **같은 순서**여야 한다.
 * 어긋나면 기획이 「없다」고 말하는 편을 공장은 이미 만들고 있게 된다.
 */
const BENEFIT_SLUG = ['coverage', 'decay', 'minimum'] as const

export type PlanState =
  /** 설계도가 있다 — 공장이 만들 수 있다 */
  | 'covered'
  /** 후보인데 설계도가 없다 — 규칙을 쓰면 만들 수 있다 */
  | 'candidate'
  /** 후보이지만 **지금 만들면 안 된다** — 뒤에 보여 줄 것이 없다 */
  | 'blocked'

export interface PlanItem {
  /** 만들어진다면 가질 영상 id. */
  id: string
  kind: string
  /** 화면에 쓰는 이름 — 구성요소의 실제 이름이다. */
  name: string
  state: PlanState
  /**
   * 이 자리 뒤에 있는 재고. **못 셌으면 null** — 0 과 구분한다.
   * 순서를 정하는 유일한 관측값이다.
   */
  backing: number | null
  /** 그 수가 무엇을 센 것인가. 근거 없는 순위를 만들지 않기 위해 함께 나른다. */
  backingLabel: string
  /** `blocked` 일 때 왜 막혔는지. 그 외에는 null. */
  blockedWhy: string | null
}

/**
 * 지금 플랫폼이 가진 **주소 가능한 자리** 전부.
 *
 * 설계도가 있는 것(`covered`)과 없는 것(`candidate`·`blocked`)을 한 목록에 담는다 —
 * 갈라 두면 "없는 것" 쪽을 아무도 안 본다.
 */
export function planItems(b: SourceBundle, existingIds: Set<string>): PlanItem[] {
  const out: PlanItem[] = []

  const push = (
    id: string,
    kind: string,
    name: string,
    backing: number | null,
    backingLabel: string,
    blockedWhy: string | null = null,
  ) => {
    const state: PlanState = existingIds.has(id)
      ? 'covered'
      : blockedWhy
        ? 'blocked'
        : 'candidate'
    out.push({ id, kind, name, state, backing, backingLabel, blockedWhy })
  }

  // ── 플랫폼 · 커리큘럼 — 각 한 편 고정 ──
  push(VIDEO_IDS.intro, 'intro', 'Vocaflow', b.platform.dictionary, '사전 표제어')
  push(
    VIDEO_IDS.curriculum,
    'curriculum',
    '7단 커리큘럼',
    b.spine.reduce((n, r) => n + r.items, 0),
    '계단 전체 문항',
  )

  // ── 장점 — 하나에 한 편 ──
  b.differentiators.forEach((d, i) => {
    // 슬러그는 공장(`build.ts`)의 `BENEFIT_SLUG` 와 같은 순서여야 한다.
    const slug = BENEFIT_SLUG[i] ?? `n${i + 1}`
    // 장점의 재고는 셀 수 있는 것이 아니다 — **null**. 0 으로 적으면 "보여 줄 것이 없다" 가 된다.
    push(benefitVideoId(slug), 'benefit', d.title, null, '셀 수 있는 재고 없음')
  })

  // ── 학습방법 · 권장안 ──
  push(VIDEO_IDS.methodStages, 'method', '단어 하나가 거치는 다섯 자리', b.stages.length, '단계')
  for (const f of b.facetOrder) {
    const label = b.facetLabels[f]
    if (!label) continue
    // 그 면을 훈련하는 활동 수 = 학습자가 실제로 할 수 있는 것의 수.
    const trains = b.activities.filter((a) => a.facets.includes(f)).length
    push(methodVideoId(f), 'method', label.name, trains, '이 면을 훈련하는 활동')
  }
  for (let i = 0; i < b.stages.length - 1; i++) {
    const from = b.stages[i]!
    const to = b.stages[i + 1]!
    if (!to.by) continue
    const trains = b.activities.filter((a) => a.facets.includes(to.by!)).length
    push(adviceVideoId(from.id), 'advice', `${from.name} 다음 한 걸음`, trains, '권하는 활동')
  }

  // ── 시리즈 · 유형 · 활동 ──
  for (const s of b.series) {
    push(
      seriesVideoId(s.id),
      'series',
      s.brand,
      s.rungs.reduce((n, r) => n + r.items, 0),
      '시리즈 전체 문항',
    )
  }
  for (const [code, g] of Object.entries(b.typeGuide).sort(([a], [c]) => a.localeCompare(c))) {
    push(typeVideoId(code), 'type', g.label, g.items, '이 유형의 문항')
  }
  for (const a of b.activities) {
    // 활동의 재고는 셀 수 있는 것이 아니다 — **null 로 둔다.** 0 으로 적으면
    // "보여 줄 것이 없다" 로 읽혀 순서가 거짓이 된다.
    push(activityVideoId(a.id), 'module', a.name, null, '셀 수 있는 재고 없음')
  }

  // ── 교재 권별 — **지금 규칙이 없는 후보.** 이 목록의 존재 이유다. ──
  for (const s of b.series) {
    for (const r of s.rungs) {
      push(
        volumeVideoId(s.id, r.step),
        'volume',
        r.volumeTitle,
        r.items,
        '이 권의 문항',
        r.items === 0
          ? '이 권에 문항이 0개다 — 지금 찍으면 빈 서가를 광고하게 된다'
          : null,
      )
    }
  }

  return out
}

export interface Backlog {
  /** 설계도가 있는 자리 */
  covered: PlanItem[]
  /** 만들 수 있고 만들어야 하는 자리 — **재고 큰 순** */
  next: PlanItem[]
  /** 지금 만들면 안 되는 자리 — 사유와 함께 */
  blocked: PlanItem[]
}

/**
 * 후보를 순서대로 정리한다.
 *
 * 재고를 **못 센 항목(null)은 맨 뒤**로 보낸다 — 0 과 같은 자리에 두면 "없다" 로 읽힌다.
 */
export function backlog(items: PlanItem[]): Backlog {
  const rank = (a: PlanItem, b: PlanItem): number => {
    if (a.backing === null && b.backing === null) return a.name.localeCompare(b.name)
    if (a.backing === null) return 1
    if (b.backing === null) return -1
    return b.backing - a.backing
  }
  return {
    covered: items.filter((i) => i.state === 'covered'),
    next: items.filter((i) => i.state === 'candidate').sort(rank),
    blocked: items.filter((i) => i.state === 'blocked').sort(rank),
  }
}

export interface PlanSummary {
  /** 주소 가능한 자리 전부 */
  addressable: number
  covered: number
  next: number
  blocked: number
  /** 덮개 — 만들 수 있는 자리 중 설계도가 있는 비율. 막힌 자리는 분모에서 뺀다. */
  coverage: number | null
}

export function summarizePlan(b: Backlog): PlanSummary {
  const addressable = b.covered.length + b.next.length + b.blocked.length
  // **막힌 자리를 분모에 넣지 않는다** — 넣으면 만들 수 없는 것 때문에 덮개가 영원히 100%
  // 미만이 되고, 그러면 그 수치로 아무 결정도 못 한다.
  const denom = b.covered.length + b.next.length
  return {
    addressable,
    covered: b.covered.length,
    next: b.next.length,
    blocked: b.blocked.length,
    coverage: denom === 0 ? null : b.covered.length / denom,
  }
}
