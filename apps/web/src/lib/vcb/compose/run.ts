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
  fetchLexicon,
  hasBaseIn,
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

  // 굴절 판정 — **사전 전체를 대조군으로** 한 번만 계산해 붙인다.
  //
  // 풀만 보고 판정하면 기본형이 필터에 먼저 걸려 사라진 경우를 놓친다. 실측:
  // `레벨 V8-V10` 의 `lent`(← lend) · `gearing`(← gear)은 기본형이 밴드 밖이라 통과했고,
  // `빈출` 의 `canned` 는 `can` 이 기능어로 빠져 통과했다. 기본형은 대개 쉬운 쪽이라
  // 이 누수는 **항상 같은 방향**으로 난다.
  //
  // 차집합(`except`) 안에서도 같은 계산을 하지만 그건 그 분기에서만이다. 여기서 한 번
  // 해 두면 모든 유형이 같은 판정을 쓴다 (이미 값이 있으면 건드리지 않는다).
  // ⚠️ 기본값은 `select.ts` 와 **같아야 한다**. 한때 여기만 `if (flag)` 였고 select 는
  // `?? true` 였다 — 그래서 판정이 계산되지 않은 채 필터만 켜져 절반(base_word 컬럼)만
  // 걸렀다. 같은 값을 두 곳에 두면 반드시 어긋난다.
  if (recipe.select.filters.exclude_inflections) {
    const lexicon = await fetchLexicon(client)
    for (const c of population) {
      if (c.is_inflection === undefined) c.is_inflection = hasBaseIn(c.word, lexicon)
    }
  }
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
