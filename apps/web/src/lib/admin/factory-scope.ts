// apps/web/src/lib/admin/factory-scope.ts
import { SERIES_CATALOG } from '@vocaflow/library-pipeline/textbook-series-catalog'

export type FactoryScope =
  | { kind: 'all' }
  | { kind: 'volume'; series: string; step: number }
  | { kind: 'invalid' }
type Params = Record<string, string | string[] | undefined> | Pick<URLSearchParams, 'get'>

/** Legacy URL key band contains the catalogue step, not textbook_volume_renders.band. */
export function parseFactoryScope(params: Params): FactoryScope {
  const get = (key: string) => 'get' in params && typeof params.get === 'function'
    ? params.get(key) : (params as Record<string, string | string[] | undefined>)[key]
  const series = get('series'), band = get('band')
  if (series == null && band == null) return { kind: 'all' }
  if (typeof series !== 'string' || typeof band !== 'string' || !/^\d+$/.test(band)) return { kind: 'invalid' }
  const step = Number(band)
  const definition = SERIES_CATALOG.find(item => item.id === series)
  return definition?.rungs.some(rung => rung.step === step)
    ? { kind: 'volume', series, step } : { kind: 'invalid' }
}

export function factoryScopeDescription(scope: FactoryScope, render: boolean): string {
  if (scope.kind === 'invalid') return '제작 기준이 올바르지 않습니다. 제작 기준에서 시리즈·단계를 다시 선택하세요.'
  if (scope.kind === 'all') return render ? '조회 범위: 전체 시리즈의 조판 기록.' : '조회 범위: 공장 전체 공유 재고.'
  return render
    ? `조회 범위: ${scope.series} ${scope.step}단계의 조판 기록. Product Order별 진척은 아닙니다.`
    : `제작 기준: ${scope.series} ${scope.step}단계. 조회 범위: 공장 전체 공유 재고이며 선택 기준으로 필터링되지 않습니다.`
}
