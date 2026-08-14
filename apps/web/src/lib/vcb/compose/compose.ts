// apps/web/src/lib/vcb/compose/compose.ts
//
// 컴포저 — 레시피 + 모집단 → 목차가 있는 단어장. 순수 함수 (DB 없이 테스트된다).
//
// 단계 순서가 계약이다:
//   selectPool(필터→차감→family) → **선별 전략**(목표 개수 · 커버리지 · 해금 · 재등장)
//   → organize(그룹→정렬→cap) → 증거 수집
//
// 왜 "선별 전략" 이 정렬과 분리돼 있나 (Round 1 에서 고친 것):
//   해금(U1)·재등장(U2)은 **무엇을 고르는가**의 규칙이다. 개수로 먼저 자른 뒤 그 안에서 순서만
//   바꾸면 대조군과 결과가 같아진다 — Round 1 실측이 정확히 그것이었다(해금 문장 155 vs 155).
//   그래서 목표 개수는 전략의 **예산**으로 넘기고, 선택 자체를 전략이 하게 한다.

import { selectPool } from './select'
import { applyObjective } from './select'
import { organize } from './organize'
import type { ComposedGroup } from './types'
import {
  baselineSentenceUnlock,
  buildSentenceIndex,
  greedySentenceUnlock,
  rankByRecycle,
  recycleStats,
} from './unlock'
import type { CandidateWord, ComposedSet, Recipe } from './types'

export interface ComposeContext {
  /** 이 사용자가 이미 아는 단어 (소문자) — select.subtract_known_for 가 있을 때만 쓰인다 */
  knownWords?: Set<string>
}

/**
 * 그룹에서 예산만큼 뽑는다 — 목차의 **폭**을 지키는 방식.
 *
 * 왜 필요한가 (Round 2 실측): 개수 목표를 그룹 구성 **전에** 자르면 빈도 상위가 몰린 두세 그룹만
 * 살아남는다. 주제 단어장 '여행' 이 5 챕터인데 결과가 2 챕터였던 것이 그것이다 —
 * 목차가 있다고 선언했는데 실제로는 없었다.
 *
 * 짝 유형(`atomic`)은 그룹 단위로 통째로 담는다. 라운드로빈으로 담으면 예산 경계에서
 * 짝의 한쪽만 들어가 유형이 깨진다.
 */
function fillFromGroups(
  groups: ComposedGroup[],
  budget: number,
  atomic: boolean,
): CandidateWord[] {
  const out: CandidateWord[] = []

  if (atomic) {
    for (const g of groups) {
      if (out.length + g.entries.length > budget) continue
      for (const e of g.entries) out.push(e.candidate)
      if (out.length >= budget) break
    }
    // 예산이 가장 작은 그룹보다도 작으면 한 그룹도 못 담는다 — 그때는 첫 그룹만 담아
    // 빈 세트가 되는 것을 막는다(빈 세트는 평가기가 즉시 blocker 로 잡는다).
    if (out.length === 0 && groups.length > 0) {
      for (const e of groups[0]!.entries) out.push(e.candidate)
    }
    return out
  }

  let depth = 0
  const maxDepth = Math.max(...groups.map((g) => g.entries.length), 0)
  while (out.length < budget && depth < maxDepth) {
    for (const g of groups) {
      const e = g.entries[depth]
      if (!e) continue
      out.push(e.candidate)
      if (out.length >= budget) break
    }
    depth += 1
  }
  return out
}

function budgetOf(recipe: Recipe, poolSize: number): number {
  const obj = recipe.select.objective
  if (obj.kind === 'count') return Math.min(obj.n, poolSize)
  if (obj.kind === 'coverage') return Math.min(obj.max_words ?? poolSize, poolSize)
  return poolSize
}

export function compose(
  recipe: Recipe,
  population: CandidateWord[],
  ctx: ComposeContext = {},
): ComposedSet {
  const { pool, filtered, dropped, counts } = selectPool(population, recipe.select, {
    knownWords: ctx.knownWords,
  })

  let chosen: CandidateWord[]
  let evidence: ComposedSet['evidence'] = {}
  let organizeSpec = recipe.organize
  let coverage: ComposedSet['coverage']

  const strategy = recipe.organize.order_within

  if (strategy === 'unlock_yield') {
    // 문장 해금 — 풀 전체에서 예산만큼 고른다. 대조군은 **일반 빈도순** 같은 예산.
    const budget = budgetOf(recipe, pool.length)
    const sentences = buildSentenceIndex(pool)

    if (sentences.length === 0) {
      // 코퍼스 문장이 없으면 해금은 정의되지 않는다 — 조용히 빈도순으로 대체하고 증거를 비운다.
      chosen = applyObjective(pool, recipe.select.objective, { knownWords: ctx.knownWords }).kept
    } else {
      const plan = greedySentenceUnlock(pool, sentences, { budget, knownWords: ctx.knownWords })
      const base = baselineSentenceUnlock(pool, sentences, {
        budget,
        knownWords: ctx.knownWords,
        by: 'frequency_rank',
      })
      chosen = plan.picks.map((p) => p.candidate)
      evidence = {
        ...evidence,
        sentence_unlock: {
          ours: plan.sentences_unlocked,
          baseline: base.sentences_unlocked,
          total: plan.sentences_total,
          budget,
        },
      }
    }
    organizeSpec = { ...recipe.organize, order_within: 'as_selected' }
  } else if (strategy === 'recycle_soon') {
    // 향후 재등장 우선 — 배운 다음에 책이 대신 복습해 주는 순서.
    const ranked = rankByRecycle(pool)
    const budget = budgetOf(recipe, ranked.length)
    chosen = ranked.slice(0, budget)
    const stats = recycleStats(chosen, pool)
    evidence = {
      ...evidence,
      future_encounters: {
        ours_mean: stats.picked_mean,
        baseline_mean: stats.baseline_mean,
        population_mean: stats.population_mean,
      },
    }
    organizeSpec = { ...recipe.organize, order_within: 'as_selected' }
  } else if (
    recipe.organize.group_by !== 'none' &&
    recipe.organize.group_by !== 'day' &&
    recipe.select.objective.kind === 'count'
  ) {
    // 그룹 인지 선별 — 목차를 먼저 짜고 거기서 예산을 채운다.
    const full = organize(pool, recipe.organize)
    const budget = budgetOf(recipe, pool.length)
    chosen = fillFromGroups(full.groups, budget, recipe.organize.keep_pairs_together === true)
    for (const [k, v] of Object.entries(full.dropped)) {
      dropped[k] = (dropped[k] ?? 0) + v
    }
    organizeSpec = { ...recipe.organize, order_within: 'as_selected' }
  } else {
    // 커버리지 목표는 차감 전 모집단의 토큰 총량을 분모로 써야 정직하다.
    const source = recipe.select.objective.kind === 'coverage' ? filtered : pool
    const applied = applyObjective(source, recipe.select.objective, { knownWords: ctx.knownWords })
    chosen = applied.kept
    if (applied.coverage && recipe.select.objective.kind === 'coverage') {
      coverage = {
        achieved: applied.coverage.achieved,
        target: recipe.select.objective.target,
        tokens_total: applied.coverage.tokens_total,
        tokens_covered: applied.coverage.tokens_covered,
      }
    }
  }

  const organized = organize(chosen, organizeSpec)

  return {
    recipe,
    groups: organized.groups,
    entries: organized.entries,
    funnel: {
      population: population.length,
      after_filters: counts.after_filters,
      after_subtract: counts.after_subtract,
      after_objective: chosen.length,
      final: organized.entries.length,
      dropped: { ...dropped, ...organized.dropped },
    },
    coverage,
    evidence: Object.keys(evidence).length > 0 ? evidence : undefined,
  }
}
