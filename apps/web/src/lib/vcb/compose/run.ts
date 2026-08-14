// apps/web/src/lib/vcb/compose/run.ts
//
// 드라이런 — blueprint + 파라미터 → 실 DB 후보 → 목차 → 채점. 발행은 하지 않는다.
//
// 발행과 분리한 이유: 평가가 발행의 전제여야 하기 때문이다. 지금은 다섯 생성기가 곧바로
// shared_word_sets 에 쓰고, 잘못 뽑혔다는 사실은 발행 뒤에야(또는 영원히) 드러난다.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Blueprint, BlueprintParams } from './blueprints'
import { getBlueprint } from './blueprints'
import { compose } from './compose'
import { evaluateSet, type Scorecard } from './evaluate'
import {
  fetchKnownWords,
  pushdownFrom,
  resolvePopulation,
  type ResolveOptions,
} from './resolve'
import type { ComposedSet, Recipe } from './types'

export interface DryRunResult {
  blueprint: string
  recipe: Recipe
  set: ComposedSet
  scorecard: Scorecard
  timing_ms: { resolve: number; compose: number; evaluate: number }
}

export interface DryRunOptions {
  /** novelty 계산용 — 호출자가 한 번 받아 여러 blueprint 에 재사용한다 (세트 1,300개 조회는 비싸다) */
  existingWords?: Set<string>
  maxPopulation?: number
  now?: string
}

export async function dryRun(
  client: SupabaseClient,
  blueprintId: string,
  params: BlueprintParams = {},
  opts: DryRunOptions = {},
): Promise<DryRunResult> {
  const blueprint: Blueprint | null = getBlueprint(blueprintId)
  if (!blueprint) throw new Error(`unknown blueprint: ${blueprintId}`)

  const recipe = blueprint.build(params)

  const resolveOpts: ResolveOptions = {
    maxPopulation: opts.maxPopulation,
    pushdown: pushdownFrom(recipe.select.filters),
  }

  const t0 = Date.now()
  const population = await resolvePopulation(client, recipe.population, resolveOpts)
  const t1 = Date.now()

  const knownWords = recipe.select.subtract_known_for
    ? await fetchKnownWords(client, recipe.select.subtract_known_for)
    : undefined

  const set = compose(recipe, population, { knownWords })
  const t2 = Date.now()

  const scorecard = evaluateSet(set, { existingWords: opts.existingWords, now: opts.now })
  const t3 = Date.now()

  return {
    blueprint: blueprintId,
    recipe,
    set,
    scorecard,
    timing_ms: { resolve: t1 - t0, compose: t2 - t1, evaluate: t3 - t2 },
  }
}
