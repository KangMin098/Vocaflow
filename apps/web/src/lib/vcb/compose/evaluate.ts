// apps/web/src/lib/vcb/compose/evaluate.ts
//
// 평가 — 만든 단어장이 좋은가에 **수치로** 답한다. 순수 함수.
//
// 왜 이것이 재설계의 절반인가:
//   기존 5 생성기 중 어느 것도 이 질문에 답하지 못했다. 그래서 `topic-appearance` 의 제목 오타나
//   "어원 세트인데 어근 링크가 없는 단어" 같은 것이 검수 없이 발행됐다. 지표가 없으면 개선도
//   측정되지 않고, 개선이 측정되지 않으면 루프가 성립하지 않는다.
//
// 점수는 전부 0~1 이고, blueprint 가정한 가중치로 합산한다. 통과선 0.80.

import type { Blueprint, FitRule, MetricId } from './blueprints'
import { getBlueprint } from './blueprints'
import { facetReadiness, hasField, type FacetReadiness } from './facets'
import { isUngroupedKey } from './organize'
import { NOISE_REGISTERS, type ComposedSet } from './types'

export const PASS_THRESHOLD = 0.8

/**
 * 개별 지표가 이 값 아래면 총점이 통과선을 넘어도 발행을 막는다.
 *
 * 왜 총점만으로 판정하지 않나: 가중치가 낮은 지표 하나가 0 이어도 총점은 0.9 를 넘을 수 있다.
 * "예문이 하나도 없는 Use 세트" 가 0.9 로 발행되는 것을 막는 하한이다.
 */
export const BLOCKER_FLOOR = 0.5

export interface MetricScore {
  id: MetricId
  score: number
  weight: number
  /** 왜 이 점수인가 — 한국어 한 줄. 리포트가 그대로 읽는다 */
  note: string
}

export interface Scorecard {
  blueprint: string
  slug: string
  total: number
  passed: boolean
  metrics: MetricScore[]
  facets: FacetReadiness[]
  /** 통과선 미달 원인 — 개선 루프의 입력 */
  blockers: string[]
  warnings: string[]
  entry_count: number
  group_count: number
  evaluated_at: string
}

export interface EvaluateContext {
  /** 이미 발행된 세트의 단어 (소문자) — 신규성 계산 */
  existingWords?: Set<string>
  /** 평가 시각. 결정론적 테스트를 위해 주입한다 */
  now?: string
}

const clamp01 = (x: number): number => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0)

// ── fill — 선언 면의 요구 필드 충전율 ───────────────────────────────

function scoreFill(set: ComposedSet): { score: number; note: string; facets: FacetReadiness[] } {
  const candidates = set.entries.map((e) => e.candidate)
  const readiness = facetReadiness(candidates, set.recipe.present.facets)
  if (readiness.length === 0) {
    return { score: 0, note: '선언한 면이 없다 — 무엇을 훈련하는 세트인지 데이터가 말하지 않는다', facets: [] }
  }

  // full 을 1.0, fallback 을 0.7 로 센다. fallback 을 1.0 으로 세면 녹음 자산 0% 가 리포트에서 사라진다.
  let sum = 0
  for (const r of readiness) {
    const fallbackShare = r.ready_ratio - r.full_ratio
    sum += r.full_ratio + fallbackShare * 0.7
  }
  const score = clamp01(sum / readiness.length)

  const worst = [...readiness].sort((a, b) => a.ready_ratio - b.ready_ratio)[0]!
  const note =
    worst.ready_ratio >= 1
      ? '선언한 모든 면의 요구 필드가 전부 채워져 있다'
      : `가장 약한 면 ${worst.code} ${worst.name} — ${Math.round(worst.ready_ratio * 100)}% 만 훈련 가능 (결측 ${worst.missing_count}건)`

  return { score, note, facets: readiness }
}

// ── level_fit — 목표 레벨 밴드 적합 ────────────────────────────────

function scoreLevelFit(set: ComposedSet): { score: number; note: string } {
  const f = set.recipe.select.filters
  const levels = set.entries.map((e) => e.candidate.v_level).filter((v): v is number => v != null)
  if (levels.length === 0) return { score: 0.5, note: 'V-Level 이 없는 항목뿐이라 판정 보류 (0.5)' }

  // 코퍼스 세트는 **콘텐츠가 레벨을 정한다.** 책에 나오는 단어의 레벨은 퍼져 있는 것이 정상이고,
  // 그것을 응집도로 깎으면 원서 단어장이 구조적으로 감점된다 (Round 2 실측: unlock 0.49 ·
  // book-companion 0.70). 밴드를 명시적으로 선언했을 때만 이탈을 잡는다.
  const isCorpus = set.recipe.population.kind === 'corpus'
  if (isCorpus && f.v_level_min == null && f.v_level_max == null) {
    const sorted = [...levels].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]!
    return { score: 1, note: `코퍼스가 레벨을 정한다 (중위 V${median}) — 응집도 판정 대상 아님` }
  }

  if (f.v_level_min != null || f.v_level_max != null) {
    const lo = f.v_level_min ?? 0
    const hi = f.v_level_max ?? 11
    const inBand = levels.filter((v) => v >= lo && v <= hi).length
    const ratio = inBand / levels.length
    return {
      score: clamp01(ratio),
      note:
        ratio >= 1
          ? `목표 밴드 V${lo}-V${hi} 를 벗어난 항목 없음`
          : `밴드 이탈 ${levels.length - inBand}건 (V${lo}-V${hi} 선언)`,
    }
  }

  // 밴드 선언이 없으면 **응집도**를 본다 — 중위 ±2 안에 얼마나 모여 있나.
  const sorted = [...levels].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]!
  const near = levels.filter((v) => Math.abs(v - median) <= 2).length
  const ratio = near / levels.length
  return {
    score: clamp01(ratio),
    note: `밴드 미선언 — 중위 V${median} ±2 응집도 ${Math.round(ratio * 100)}%`,
  }
}

// ── noise — register 잡음·중복·고유명사 ─────────────────────────────

const PROPER_NOUN_RE = /^[A-Z][a-z]/

function scoreNoise(set: ComposedSet): { score: number; note: string; warnings: string[] } {
  const n = set.entries.length || 1
  const warnings: string[] = []
  // 레시피가 **허용한** register 는 잡음이 아니다. 구동사·관용어 세트는 `phrase_unit` 을
  // 일부러 허용하는데, 기본 잡음 목록으로 재면 그 유형이 자기 정의 때문에 감점된다
  // (Round 2 실측: phrasal-idiom noise 0.56 — 88건이 '허용한 잡음' 이었다).
  const allowed = new Set(set.recipe.select.filters.exclude_registers)
  const noiseSet = new Set<string>(
    (NOISE_REGISTERS as readonly string[]).filter((r) => allowed.has(r)),
  )

  let noisy = 0
  let proper = 0
  const seen = new Set<string>()
  let dup = 0

  for (const e of set.entries) {
    const c = e.candidate
    if (noiseSet.has(c.word_register ?? 'standard')) noisy += 1
    if (PROPER_NOUN_RE.test(c.word) && (c.primary_pos ?? c.pos) !== 'proper_noun') proper += 1
    const key = c.word.toLowerCase()
    if (seen.has(key)) dup += 1
    seen.add(key)
  }

  if (noisy > 0) warnings.push(`register 잡음 ${noisy}건 (archaic/brand/proper 등)`)
  if (dup > 0) warnings.push(`중복 단어 ${dup}건 — 같은 세트에 두 번 들어갔다`)
  if (proper > 0) warnings.push(`대문자 시작 ${proper}건 — 고유명사 혼입 의심`)

  const penalty = (noisy * 1.0 + dup * 1.0 + proper * 0.5) / n
  return {
    score: clamp01(1 - penalty),
    note: penalty === 0 ? '잡음 없음' : `잡음 비율 ${(penalty * 100).toFixed(1)}%`,
    warnings,
  }
}

// ── novelty — 기존 발행 세트와 비중복 ──────────────────────────────

function scoreNovelty(set: ComposedSet, ctx: EvaluateContext): { score: number; note: string } {
  const existing = ctx.existingWords
  if (!existing || existing.size === 0) {
    return { score: 1, note: '대조할 기존 세트 없음 (전량 신규로 계산)' }
  }
  const n = set.entries.length || 1
  let overlap = 0
  for (const e of set.entries) if (existing.has(e.word.toLowerCase())) overlap += 1
  const ratio = overlap / n

  // 중복이 곧 결함은 아니다 — 시험 어휘는 여러 세트에 나오는 것이 정상이다.
  // 그래서 100% 중복만 0 점이 되게 완만하게 깎는다.
  return {
    score: clamp01(1 - ratio * 0.6),
    note: `기존 발행 세트와 겹치는 단어 ${overlap}건 (${Math.round(ratio * 100)}%)`,
  }
}

// ── organize — 그룹 균형·원리 적합 ─────────────────────────────────

// 분류 실패 판정은 organize 가 유일한 정의를 들고 있다 (두 곳에 두면 한 곳만 고쳐진다).
const isUngrouped = isUngroupedKey

function scoreOrganize(set: ComposedSet): { score: number; note: string; warnings: string[] } {
  const warnings: string[] = []
  const groups = set.groups
  if (groups.length === 0) return { score: 0, note: '그룹이 없다', warnings }

  // group_by='none' 을 선언한 세트는 목차가 없는 것이 의도다 — 감점하지 않는다.
  if (set.recipe.organize.group_by === 'none') {
    return { score: 1, note: '목차 없음(none) 선언 — 균형 판정 대상 아님', warnings }
  }

  const sizes = groups.map((g) => g.entries.length)
  const total = sizes.reduce((s, x) => s + x, 0) || 1
  const ungrouped = groups.filter((g) => isUngrouped(g.key))
  const ungroupedEntries = ungrouped.reduce((s, g) => s + g.entries.length, 0)

  if (ungroupedEntries > 0) {
    warnings.push(
      `분류 실패 ${ungroupedEntries}건 — '미상/짝없음' 그룹에 남았다 (${ungrouped.map((g) => g.key).slice(0, 3).join(', ')})`,
    )
  }

  // 균형: 최대 그룹이 전체를 삼키면 목차가 있으나 없으나다.
  const maxShare = Math.max(...sizes) / total
  const balance = clamp01(1 - Math.max(0, maxShare - 0.4) / 0.6)
  const grouped = clamp01(1 - ungroupedEntries / total)
  // 그룹이 2개 미만이면 목차가 갈리지 않았다.
  const split = groups.length >= 2 ? 1 : 0.3

  const score = clamp01(grouped * 0.5 + balance * 0.3 + split * 0.2)
  return {
    score,
    note: `${groups.length}개 그룹 · 최대 그룹 점유 ${Math.round(maxShare * 100)}% · 미분류 ${ungroupedEntries}건`,
    warnings,
  }
}

// ── blueprint_fit — 유형 고유 조건 ─────────────────────────────────

function evalFitRule(rule: FitRule, set: ComposedSet): { ok: boolean; detail: string } {
  const entries = set.entries
  const n = entries.length

  switch (rule.kind) {
    case 'all_have_field': {
      const missing = entries.filter((e) => !hasField(e.candidate, rule.field)).length
      return {
        ok: missing === 0 && n > 0,
        detail: missing === 0 ? `${rule.field} 전량 보유` : `${rule.field} 결측 ${missing}/${n}`,
      }
    }
    case 'all_grouped': {
      const bad = set.groups.filter((g) => isUngrouped(g.key)).reduce((s, g) => s + g.entries.length, 0)
      return { ok: bad === 0 && n > 0, detail: bad === 0 ? '전량 분류됨' : `미분류 ${bad}/${n}` }
    }
    case 'min_group_size': {
      const small = set.groups.filter((g) => g.entries.length < rule.n)
      const affected = small.reduce((s, g) => s + g.entries.length, 0)
      return {
        ok: small.length === 0 && set.groups.length > 0,
        detail:
          small.length === 0
            ? `모든 그룹 ${rule.n}개 이상`
            : `${rule.n}개 미만 그룹 ${small.length}개 (항목 ${affected}건) — 짝이 성립하지 않는다`,
      }
    }
    case 'coverage_met': {
      const cov = set.coverage
      if (!cov) return { ok: false, detail: '커버리지 목표가 계산되지 않았다 (코퍼스 빈도 없음)' }
      return {
        ok: cov.achieved >= cov.target,
        detail: `커버리지 ${(cov.achieved * 100).toFixed(1)}% / 목표 ${(cov.target * 100).toFixed(0)}%`,
      }
    }
    case 'senses_min': {
      const bad = entries.filter((e) => e.candidate.sense_count < rule.n).length
      return {
        ok: bad === 0 && n > 0,
        detail: bad === 0 ? `전량 뜻 ${rule.n}개 이상` : `뜻 ${rule.n}개 미만 ${bad}/${n}`,
      }
    }
    case 'has_corpus_sentence': {
      const bad = entries.filter(
        (e) => !e.candidate.corpus_sentence || e.candidate.corpus_sentence.trim().length === 0,
      ).length
      return {
        ok: bad === 0 && n > 0,
        detail: bad === 0 ? '전량 원문 문장 보유' : `원문 문장 없음 ${bad}/${n}`,
      }
    }
    case 'beats_baseline': {
      if (rule.metric === 'sentence_unlock') {
        const ev = set.evidence?.sentence_unlock
        if (!ev) return { ok: false, detail: '해금 증거가 수집되지 않았다 (코퍼스 문장 없음)' }
        const gain = ev.ours - ev.baseline
        return {
          ok: gain > 0,
          detail: `해금 문장 ${ev.ours} vs 빈도순 ${ev.baseline} (${gain >= 0 ? '+' : ''}${gain}, 전체 ${ev.total})`,
        }
      }
      const ev = set.evidence?.future_encounters
      if (!ev) return { ok: false, detail: '재등장 증거가 수집되지 않았다' }
      const gain = ev.ours_mean - ev.baseline_mean
      return {
        ok: gain > 0,
        detail: `평균 향후 재등장 ${ev.ours_mean.toFixed(2)} vs 빈도순 ${ev.baseline_mean.toFixed(2)} (${gain >= 0 ? '+' : ''}${gain.toFixed(2)})`,
      }
    }
    case 'min_groups':
      return {
        ok: set.groups.length >= rule.n,
        detail: `그룹 ${set.groups.length}개 (요구 ${rule.n}개 이상)`,
      }
    default:
      return { ok: true, detail: '' }
  }
}

function scoreBlueprintFit(
  set: ComposedSet,
  blueprint: Blueprint | null,
): { score: number; note: string; blockers: string[] } {
  if (!blueprint) {
    return { score: 0, note: '카탈로그에 없는 blueprint — 조건을 검사할 수 없다', blockers: ['unknown_blueprint'] }
  }
  if (blueprint.fit_rules.length === 0) {
    return { score: 1, note: '고유 조건 없음', blockers: [] }
  }

  const results = blueprint.fit_rules.map((r) => ({ rule: r, ...evalFitRule(r, set) }))
  const passed = results.filter((r) => r.ok).length
  const blockers = results.filter((r) => !r.ok).map((r) => `${r.rule.kind}: ${r.detail}`)

  return {
    score: clamp01(passed / results.length),
    note: results.map((r) => `${r.ok ? '✓' : '✗'} ${r.detail}`).join(' · '),
    blockers,
  }
}

// ── value — 빈도 가중 학습 가치 ────────────────────────────────────

// `phrase`·`compound` 를 포함하는 이유: 구·복합어는 빈도 랭크가 낮게 잡히지만 학습 가치가
// 낮은 것이 아니다. 제외하면 관용어·구동사 단어장이 구조적으로 0 점이 된다
// (Round 2 실측: phrasal-idiom value 0.05).
const VALUED_BANDS = new Set(['top1k', 'top2k', 'top3k', 'top5k', 'top10k', 'phrase', 'compound'])

function scoreValue(set: ComposedSet): { score: number; note: string } {
  const n = set.entries.length || 1
  let valued = 0
  for (const e of set.entries) {
    const c = e.candidate
    // 코퍼스 세트는 그 책에서의 빈도가 곧 가치다 — 일반 빈도로 재면 원서 단어장이 부당하게 깎인다.
    if ((c.corpus_freq ?? 0) >= 2) valued += 1
    else if (c.frequency_band && VALUED_BANDS.has(c.frequency_band)) valued += 1
    else if ((c.frequency_rank ?? Number.MAX_SAFE_INTEGER) <= 20000) valued += 1
  }
  const ratio = valued / n
  return {
    score: clamp01(ratio),
    note: `학습 가치 대리지표(빈도·코퍼스 등장) 충족 ${Math.round(ratio * 100)}%`,
  }
}

// ── 종합 ───────────────────────────────────────────────────────────

export function evaluateSet(set: ComposedSet, ctx: EvaluateContext = {}): Scorecard {
  const blueprint = getBlueprint(set.recipe.blueprint)
  const weights = blueprint?.weights ?? {}

  const fill = scoreFill(set)
  const level = scoreLevelFit(set)
  const noise = scoreNoise(set)
  const novelty = scoreNovelty(set, ctx)
  const organizeScore = scoreOrganize(set)
  const fit = scoreBlueprintFit(set, blueprint)
  const value = scoreValue(set)

  const raw: { id: MetricId; score: number; note: string }[] = [
    { id: 'fill', ...fill },
    { id: 'level_fit', ...level },
    { id: 'noise', ...noise },
    { id: 'novelty', ...novelty },
    { id: 'organize', ...organizeScore },
    { id: 'blueprint_fit', ...fit },
    { id: 'value', ...value },
  ]

  const metrics: MetricScore[] = raw.map((m) => ({
    id: m.id,
    score: m.score,
    weight: weights[m.id] ?? 0,
    note: m.note,
  }))

  const weightSum = metrics.reduce((s, m) => s + m.weight, 0)
  const total =
    weightSum > 0 ? metrics.reduce((s, m) => s + m.score * m.weight, 0) / weightSum : 0

  const blockers: string[] = [...fit.blockers]
  if (set.entries.length === 0) blockers.unshift('빈 세트 — 모집단 또는 필터가 전부 걸러 냈다')

  // 규모 미달 — 요청한 개수의 30% 도 못 채우면 그 유형은 **약속을 못 지킨 것**이다.
  //
  // 왜 이 가드가 필요한가: 항목별 품질을 올리는 필터를 세게 걸면 지표는 전부 1.00 이 되는데
  // 세트가 쪼그라들어 상품이 아니게 된다. 실측으로 그 일이 났다 — 구동사 유형에
  // `require_frequency_rank` 를 걸었더니 200개 요청에 10개가 나왔고, 7지표는 모두 통과였다.
  // 품질 지표만으로는 이 실패가 보이지 않으므로 개수를 따로 본다.
  const objective = set.recipe.select.objective
  if (objective.kind === 'count' && set.entries.length > 0) {
    const ratio = set.entries.length / objective.n
    if (ratio < 0.3) {
      blockers.push(
        `규모 미달 — 요청 ${objective.n}개 중 ${set.entries.length}개 (${Math.round(ratio * 100)}%). 필터가 과하거나 모집단이 부족하다`,
      )
    }
  }
  for (const m of metrics) {
    if (m.weight === 0) continue
    // novelty 는 blocker 가 아니다 — 시험·빈도 어휘가 여러 세트에 겹치는 것은 정상이고
    // (Round 1 실측: mnemonic-story 93% 중복), 그것을 발행 차단 사유로 두면 정상 세트가 막힌다.
    // 점수에는 그대로 반영되므로 "겹침이 많다" 는 사실은 사라지지 않는다.
    if (m.id === 'novelty') continue
    if (m.score < BLOCKER_FLOOR) blockers.push(`${m.id} ${m.score.toFixed(2)} — ${m.note}`)
  }

  const warnings = [...noise.warnings, ...organizeScore.warnings]

  // 필터가 모집단을 몇 % 남겼나 — **필터가 조용히 풀을 죽이는 것**을 잡는 가드.
  //
  // 오늘 이 실패를 두 번 냈다: `require_frequency_rank` 가 구동사 풀을 984 → 26 으로,
  // 과한 `meaning_clean` 규칙이 좋은 항목 1,640개를 모든 세트에서 뺐다. 두 경우 모두
  // **품질 지표는 전부 1.00** 이었다 — 남은 것만 보면 완벽하기 때문이다. 남지 않은 것을 봐야 한다.
  const funnel = set.funnel
  if (funnel.population > 0) {
    const survival = funnel.after_filters / funnel.population
    if (survival < 0.05) {
      warnings.push(
        `필터 생존율 ${(survival * 100).toFixed(1)}% — 모집단 ${funnel.population} 중 ${funnel.after_filters}만 남았다. 필터가 과한지 확인할 것`,
      )
    }
    const top = Object.entries(funnel.dropped).sort((a, b) => b[1] - a[1])[0]
    if (top && top[1] > funnel.population * 0.5) {
      warnings.push(`탈락 사유 편중 — '${top[0]}' 하나가 ${top[1]}건(모집단의 절반 이상)을 걸렀다`)
    }
  }
  const noveltyMetric = metrics.find((m) => m.id === 'novelty')
  if (noveltyMetric && noveltyMetric.weight > 0 && noveltyMetric.score < 0.6) {
    warnings.push(`신규성 낮음 — ${noveltyMetric.note}`)
  }
  const facetGap = fill.facets.filter((f) => f.missing_count > 0)
  for (const f of facetGap) {
    const worst = Object.entries(f.missing_by_field).sort((a, b) => b[1] - a[1])[0]
    warnings.push(
      `${f.code} ${f.name} 결측 ${f.missing_count}건${worst ? ` — 주 원인 ${worst[0]} ${worst[1]}건` : ''}`,
    )
  }
  for (const f of fill.facets) {
    if (f.fallback_note) warnings.push(`${f.code} ${f.name} — ${f.fallback_note}`)
  }

  return {
    blueprint: set.recipe.blueprint,
    slug: set.recipe.meta.slug,
    total,
    passed: total >= PASS_THRESHOLD && blockers.length === 0,
    metrics,
    facets: fill.facets,
    blockers,
    warnings,
    entry_count: set.entries.length,
    group_count: set.groups.length,
    evaluated_at: ctx.now ?? '',
  }
}
