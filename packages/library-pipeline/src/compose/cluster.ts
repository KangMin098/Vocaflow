// packages/library-pipeline/src/compose/cluster.ts
//
// ACP §20 재저작 — 발행사별 후보를 **같은 사건**으로 묶는다.
//
// 왜 필요한가: 수집기는 발행사 단위로 후보를 준다. 그런데 I12(독립 출처 2곳)는 "같은 사실을
// 두 계통이 각각 확인했는가" 를 묻는다. 그러려면 먼저 어느 후보들이 같은 사건인지 알아야 한다.
//
// ⚠ 이 묶음은 **제안이지 판정이 아니다.**
//   클러스터가 "독립 2계통" 이라고 말해도 그것은 취재를 시작할 근거일 뿐이고, 실제 I12 는
//   사실 카드별 attestation 으로 판정된다. 이 구분이 중요한 이유:
//   제목이 비슷하다는 이유로 다른 사건을 잘못 묶으면, 실제로는 한 곳에서만 나온 사실이
//   "확인됨" 으로 보일 수 있다. 그래서 여기서는 **덜 묶는 쪽으로 기운다** —
//   놓친 묶음은 다음 수집에서 다시 만나지만, 잘못된 묶음은 게이트를 우회시킨다.

import type { StoryCandidate } from './news-feed'
import { FACT_SOURCES, type FactSourceSpec } from './sources'

/** 헤드라인에서 의미를 지지 않는 말. 이것들이 겹쳤다고 같은 사건이 되지 않는다. */
const HEADLINE_STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'but', 'with', 'as', 'by',
  'from', 'after', 'before', 'amid', 'over', 'into', 'up', 'down', 'out', 'off', 'its', 'his',
  'her', 'their', 'our', 'is', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had', 'will',
  'says', 'said', 'say', 'new', 'more', 'than', 'that', 'this', 'these', 'those', 'it', 'he',
  'she', 'they', 'we', 'you', 'not', 'no', 'how', 'why', 'what', 'who', 'live', 'update',
  'updates', 'breaking', 'watch', 'video', 'photos', 'analysis', 'opinion',
])

export const CLUSTER_THRESHOLDS = {
  /**
   * 제목 유사도(Dice) 하한. 헤드라인은 짧아서 우연 일치가 쉽다 — 낮게 잡으면
   * 서로 다른 사건이 붙는다. 0.4 는 "양쪽 내용어의 40%가 겹친다" 로, 같은 사건을
   * 다르게 쓴 두 헤드라인이 대개 넘고 무관한 헤드라인은 대개 못 넘는 지점이다.
   */
  minTitleDice: 0.4,
  /** 겹치는 내용어 최소 개수. 흔한 단어 하나로 붙는 것을 막는 2차 조건. */
  minSharedTokens: 2,
  /** 같은 사건으로 볼 발행 시각 차이 상한(시간). 후속 보도까지 흡수하되 무한정은 아니다. */
  maxHoursApart: 72,
} as const

/** 헤드라인 → 내용어 집합. */
export function headlineTokens(title: string): Set<string> {
  const out = new Set<string>()
  for (const t of title
    .toLowerCase()
    .replace(/[’']/g, '')
    // 마침표를 어절 안에서는 살린다 — "5.2"(규모) · "u.s" 는 사건을 식별하는 내용어인데
    // 통째로 쪼개면 한 글자 토큰이 되어 아래 길이 필터에 전부 걸린다.
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/(^|\s)\.+|\.+(\s|$)/g, '$1$2')
    .trim()
    .split(/\s+/)) {
    if (!t || t.length < 2) continue
    if (HEADLINE_STOPWORDS.has(t)) continue
    out.add(t)
  }
  return out
}

/** Dice 계수 — 짧은 문자열 비교에서 Jaccard 보다 겹침에 민감하다. */
export function diceCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const t of a) if (b.has(t)) shared++
  return (2 * shared) / (a.size + b.size)
}

function sharedCount(a: Set<string>, b: Set<string>): number {
  let n = 0
  for (const t of a) if (b.has(t)) n++
  return n
}

/** 두 후보가 같은 사건인가 — 유사도·공통 내용어·시간 창 세 조건을 모두 만족해야 한다. */
export function sameEvent(a: StoryCandidate, b: StoryCandidate): boolean {
  const ta = headlineTokens(a.title)
  const tb = headlineTokens(b.title)
  if (sharedCount(ta, tb) < CLUSTER_THRESHOLDS.minSharedTokens) return false
  if (diceCoefficient(ta, tb) < CLUSTER_THRESHOLDS.minTitleDice) return false

  const at = a.published_at ? new Date(a.published_at).getTime() : NaN
  const bt = b.published_at ? new Date(b.published_at).getTime() : NaN
  if (Number.isNaN(at) || Number.isNaN(bt)) return false
  return Math.abs(at - bt) <= CLUSTER_THRESHOLDS.maxHoursApart * 3_600_000
}

export interface StoryCluster {
  /** 이 묶음의 대표 제목 (가장 이른 보도의 제목) */
  headline: string
  members: StoryCandidate[]
  /** 서로 다른 취재 계통 수 — 통신사 원고는 여러 발행사여도 1 */
  independentLines: number
  /** 가장 이른 발행 시각 (사건 시각의 대용치 — batch.event_occurred_at 후보) */
  earliestAt: string
  /**
   * 취재를 시작할 만한가 = **본문을 읽을 수 있는** 독립 계통 2개 이상.
   *
   * 제목만으로 세면 안 된다 — 본문이 안 열리는 소스는 사실을 못 준다. 실제로 Solar
   * eclipse 사건이 dw+npr 2계통으로 올라왔는데 NPR 본문이 안 열려 취재 단계에서
   * 무너졌다(2026-08-19). 발견이 약속한 것을 취재가 지킬 수 있어야 한다.
   */
  worthPursuing: boolean
  /** 본문을 읽을 수 있는 계통 수 — worthPursuing 의 근거 */
  readableLines: number
}

function lineKey(c: StoryCandidate): string {
  return c.wire ?? c.publisher.toLowerCase()
}

/**
 * 이 후보의 본문을 읽을 수 있는가.
 *
 * 레지스트리에 'blocked' 로 **실측 기록**된 소스만 뺀다. 기록이 없으면(unknown) 읽을 수
 * 있다고 본다 — 모르는 것을 막으면 새 소스가 조용히 배제된다.
 */
function isReadable(c: StoryCandidate, registry: Record<string, FactSourceSpec>): boolean {
  return registry[c.sourceKey]?.bodyAccess !== 'blocked'
}

/**
 * 후보들을 사건별로 묶는다.
 *
 * 같은 계통(통신사) 안에서는 묶지 않는다 — 한 계통 안의 원고 여러 건을 묶어 봐야
 * 독립 출처가 늘지 않고, 오히려 "회원이 많은 묶음" 처럼 보여 판단을 흐린다.
 */
export function clusterStories(
  candidates: StoryCandidate[],
  /** 본문 접근 기록을 담은 레지스트리. 테스트가 주입할 수 있게 열어 둔다. */
  registry: Record<string, FactSourceSpec> = FACT_SOURCES,
): StoryCluster[] {
  const reg = registry
  const sorted = [...candidates].sort((a, b) => {
    const at = a.published_at ? Date.parse(a.published_at) : Infinity
    const bt = b.published_at ? Date.parse(b.published_at) : Infinity
    return at - bt
  })

  const clusters: StoryCandidate[][] = []
  for (const cand of sorted) {
    let placed = false
    for (const group of clusters) {
      // 이미 같은 계통이 들어 있으면 그 묶음에는 넣지 않는다.
      if (group.some((m) => lineKey(m) === lineKey(cand))) continue
      if (group.some((m) => sameEvent(m, cand))) {
        group.push(cand)
        placed = true
        break
      }
    }
    if (!placed) clusters.push([cand])
  }

  return clusters
    .map((members) => {
      const lines = new Set(members.map(lineKey))
      const readable = new Set(members.filter((m) => isReadable(m, reg)).map(lineKey))
      const earliest = members.reduce((min, m) =>
        !min.published_at || (m.published_at && m.published_at < min.published_at) ? m : min,
      )
      return {
        headline: earliest.title,
        members,
        independentLines: lines.size,
        earliestAt: earliest.published_at ?? '',
        readableLines: readable.size,
        worthPursuing: readable.size >= 2,
      }
    })
    .sort((a, b) => b.independentLines - a.independentLines || a.earliestAt.localeCompare(b.earliestAt))
}
