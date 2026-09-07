// apps/web/src/lib/csat/series-model.ts
//
// **카탈로그(시리즈 × 학령)의 순수 모델** — 타입·상수·판정만. DB 도 파일도 안 읽는다.
//
// ⚠️ 실측 쪽(`series-view.ts`)은 `server-only` 를 import 하므로, 클라이언트 컴포넌트가
//   거기서 **값**을 하나라도 가져오면 라우트가 통째로 500 이 난다
//   (실측 2026-09-06 — `SERIES_STEPS` 를 그대로 두었다가 그렇게 됐다. 이 저장소는 같은 사고를
//   `factory-line-model.ts` 에서 이미 한 번 겪고 그 주석까지 남겨 두었는데 또 밟았다).
//   그래서 화면과 서버가 함께 쓰는 것은 전부 여기 둔다.

import {
  SERIES_CATALOG,
  SERIES_ITEMS_PER_VOLUME,
  type SeriesDef,
  type SeriesId,
} from '@vocaflow/library-pipeline/textbook-series-catalog'

/** 한 권의 상태 — **다음에 할 일**로 가른다. */
export type VolumeStatus =
  /** 이미 조판돼 나갔다. */
  | 'published'
  /** 재고도 해설도 찼다 — 찍기만 하면 된다. */
  | 'ready'
  /** 문항은 찼는데 해설이 모자란다. */
  | 'needsExplain'
  /** 문항이 모자란다. */
  | 'needsItems'
  /** 이 시리즈에 그 단이 없다 — 빈칸이지 결함이 아니다. */
  | 'noRung'
  /** 재고를 못 쟀다. 0 이 아니다. */
  | 'unmeasured'

export const VOLUME_STATUS_KO: Record<VolumeStatus, { label: string; mark: string; color: string }> =
  {
    published: { label: '냈음', mark: '●', color: '#2E7D5A' },
    ready: { label: '찍으면 됨', mark: '○', color: '#2E7D5A' },
    needsExplain: { label: '해설 모자람', mark: '◐', color: '#B5803A' },
    needsItems: { label: '문항 모자람', mark: '◔', color: '#B5803A' },
    noRung: { label: '단 없음', mark: '·', color: '#8A8278' },
    unmeasured: { label: '못 잼', mark: '?', color: '#8A8278' },
  }

export interface VolumeCell {
  step: number
  schoolBand: string
  /** 이 시리즈에 그 단이 있으면 권 이름. 없으면 null. */
  title: string | null
  /** 그 권이 쓰는 유형의 재고 합. 못 쟀으면 null. */
  items: number | null
  explained: number | null
  status: VolumeStatus
  /**
   * **이 권이 무엇으로 만들어지는가** — 그 단이 쓰는 문항 유형(한국어 이름).
   *
   * 사슬은 이미 데이터에 있었는데 화면이 안 썼다: 시리즈 단 → 유형 → 그 유형이 요구하는
   * 원문 규격. 그래서 「어떤 원문을 어떤 기준으로」의 답이 세 화면에 흩어져 있었다.
   */
  types: string[]
  /** 왜 이 유형 배합인가. `SeriesRung.rationale` 을 그대로 나른다 — 화면에서 짓지 않는다. */
  recipe: string | null
}

export interface SeriesRow {
  id: SeriesId
  brand: string
  question: string
  accent: string
  status: SeriesDef['status']
  nextStep: string | null
  marketSeries: number
  marketExamples: readonly string[]
  volumes: VolumeCell[]
  /** 이 시리즈에서 찍을 수 있는 권 / 정의된 단. */
  ready: number
  published: number
  rungs: number
}

export interface SeriesCatalogView {
  rows: SeriesRow[]
  /** 우리 시리즈 / 시장 시리즈. 이 화면의 분모다. */
  counts: { shipping: number; defined: number; market: number }
  /** 재고를 언제 센 값인가 (ISO). 못 읽었으면 null — 신선도를 주장하지 않는다. */
  inventoryAt: string | null
  /** 만들지 않는 것과 그 이유 — 죽은 칸을 격자에 그리는 대신 한 줄로 적는다. */
  notMaking: { name: string; why: string }[]
  loadError: string | null
}

/** 격자에 안 그리는 것들. **칸으로 그리면 42칸 중 14칸이 영영 회색이다** — 한 줄이 낫다. */
export const NOT_MAKING: { name: string; why: string }[] = [
  {
    name: '기출',
    why: '평가원 저작물이라 학습자 경로로 못 낸다 — 파는 것은 기출 분석이지 기출이 아니다',
  },
  {
    name: '내신',
    why: '학교 교과서 본문이 있어야 하는데 그것은 출판사 저작물이다 — 우리 경로는 BYO 뿐이라 미리 찍는 상품이 아니다',
  },
  {
    name: '개인 맞춤',
    why: '종이가 못 하는 유일한 칸인데 관측이 없어서 못 짠다 — 문항 시도 기록 위에서만 만들어진다',
  },
]

/** 한 권을 판정한다 — 조판 기록 → 재고 → 해설 순. */
export function judgeVolume(f: {
  hasRung: boolean
  published: boolean
  items: number | null
  explained: number | null
}): VolumeStatus {
  if (!f.hasRung) return 'noRung'
  if (f.published) return 'published'
  if (f.items == null || f.explained == null) return 'unmeasured'
  if (f.items < SERIES_ITEMS_PER_VOLUME) return 'needsItems'
  if (f.explained < SERIES_ITEMS_PER_VOLUME) return 'needsExplain'
  return 'ready'
}

/** 모든 시리즈가 쓰는 학령 축 — 가장 긴 시리즈의 단을 그대로 쓴다. */
export const SERIES_STEPS = SERIES_CATALOG.reduce<{ step: number; schoolBand: string }[]>(
  (acc, s) => {
    for (const r of s.rungs) {
      if (!acc.some((a) => a.step === r.step)) acc.push({ step: r.step, schoolBand: r.schoolBand })
    }
    return acc
  },
  [],
).sort((a, b) => a.step - b.step)

/** 격자 전체에서 **찍기만 하면 되는 권**. 이 화면에서 가장 행동을 부르는 수다. */
export function readyToPrint(rows: readonly SeriesRow[]): number {
  return rows.reduce((n, r) => n + r.ready, 0)
}
