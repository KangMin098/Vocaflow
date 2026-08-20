// packages/library-pipeline/src/textbook/compose-unit.ts
//
// **독해 교재 단원을 풀에서 조합한다.** 문항 자체가 지문이다.
//
// ── Cycle 1 의 정의가 틀렸다 (실측 2026-08-21) ───────────────────────
// 처음엔 "지문 1편 + 그 지문에서 순서 3 + 삽입 2" 로 잡았다. 산술적으로 불가능했다:
//
//   교재 지문 길이(120~250어) 구간의 글 5편 · **편당 최대 문항 2개**
//   길이 게이트를 넣자 38단원 → 0단원
//
// 원인은 단순하다. DCP 는 4~6문장 문단마다 문항을 만들고, 그런 문단 하나가 60~120어다.
// 250어 안에 그런 문단 3개를 넣을 수 없다.
//
// **실제 수능도 그렇게 하지 않는다** — 순서 문항과 삽입 문항은 각각 **독립 지문**이다.
// 그리고 DCP 문항의 payload 에 이미 그 지문이 들어 있다(`presented` · `remaining`).
//
//   order   379문항 · 평균 4.8문장 · **중앙값 114어** (p10 64 · p90 186)
//   insert  379문항 · 평균 3.8문장 · 중앙값 114어
//
// 수능 순서·삽입 지문이 대략 100~130어다. **문항이 곧 수능 규격 지문이다.**
// 그래서 단원은 "지문에서 뽑는" 것이 아니라 **"풀에서 고르는"** 것이다.

import { type UnitVocab, pickVocabulary } from './assemble-unit'

export type UnitItemType = 'order' | 'insert'

/** 풀에 담긴 문항 하나. 문항 자체가 지문을 품고 있다. */
export interface PoolItem {
  id: string
  type: UnitItemType
  /** 이 문항이 나온 원글. **한 단원 안에서는 서로 달라야 한다.** */
  ref_id: string
  ref_title: string
  v_level: number | null
  /** 문항이 품은 지문의 낱말 수. */
  passage_words: number
  payload: Record<string, unknown>
  answer_key: Record<string, unknown>
}

export interface Unit {
  no: number
  band: number
  items: PoolItem[]
  vocabulary: UnitVocab[]
  estimated_minutes: number
  /** 출처. PD·CC 라도 밝힌다 — 교재에 실을 때 필요하다. */
  sources: string[]
}

export interface ComposeResult {
  units: Unit[]
  /** 왜 더 못 만들었는지. 조용히 짧은 권을 내지 않는다. */
  stoppedBecause: string | null
  /** 규격 밖이라 쓰지 않은 문항 수 — 유형별. */
  rejected: { tooShort: number; tooLong: number }
}

/**
 * 수능 순서·삽입 지문의 길이 범위.
 *
 * 실측 중앙값 114어 · p10 64 · p90 186. 하한 90 은 **64어짜리를 걸러내기 위한 것**이다 —
 * 4문장 미만으로 읽히면 순서를 맞출 단서가 부족해 찍기가 된다.
 * 상한 200 은 수능 지문 상단(약 130어)에 여유를 둔 값이다.
 */
export const CSAT_ITEM_WORDS = { min: 90, max: 200 } as const

/** 단원 기본 구성 — 순서 2 + 삽입 2. 실제 수능 배점 비율과 같다. */
export const DEFAULT_SLOTS = { order: 2, insert: 2 } as const

/** 문항 1개 소요(분). 지문을 읽고 순서를 맞춰야 해서 짧지 않다. */
export const MINUTES_PER_ITEM = 3
/** 어휘 1개 소요(분). */
export const MINUTES_PER_VOCAB = 0.25

export interface ComposeOptions {
  band: number
  /** 만들 단원 수. 재료가 모자라면 만들 수 있는 만큼만 만들고 사유를 남긴다. */
  unitCount?: number
  slots?: { order: number; insert: number }
  vocabCount?: number
}

/**
 * 풀에서 단원을 조합한다.
 *
 * 규칙 셋이 전부다:
 *   ① 문항 지문이 수능 규격 길이일 것
 *   ② **한 단원 안의 문항은 서로 다른 원글에서** 올 것
 *   ③ 어휘는 그 단원이 쓴 원글들에서, 학습자 밴드 ±1 우선
 *
 * ②가 핵심이다. 우리 풀은 원글이 적고 문항이 많다(V6 은 17편에서 168문항).
 * 이 규칙이 없으면 한 단원의 네 문항이 전부 같은 글에서 나와, 학습자가 같은 소재를
 * 네 번 읽는다 — 문항 수는 채워지지만 교재로는 실패다.
 */
export function composeUnits(
  pool: ReadonlyArray<PoolItem>,
  vocabByRef: ReadonlyMap<string, ReadonlyArray<UnitVocab>>,
  options: ComposeOptions,
): ComposeResult {
  const slots = options.slots ?? DEFAULT_SLOTS
  const wantUnits = options.unitCount ?? 20
  const wantVocab = options.vocabCount ?? 20

  let tooShort = 0
  let tooLong = 0
  const fit = pool.filter((p) => {
    if (p.passage_words < CSAT_ITEM_WORDS.min) {
      tooShort++
      return false
    }
    if (p.passage_words > CSAT_ITEM_WORDS.max) {
      tooLong++
      return false
    }
    return true
  })

  // 원글이 골고루 쓰이도록 — 같은 글의 문항이 앞 단원에 몰리면 뒤 단원이 굶는다.
  const byType: Record<UnitItemType, PoolItem[]> = {
    order: fit.filter((p) => p.type === 'order'),
    insert: fit.filter((p) => p.type === 'insert'),
  }
  for (const t of ['order', 'insert'] as const) {
    byType[t] = roundRobinByRef(byType[t])
  }

  const used = new Set<string>()
  const units: Unit[] = []
  let stoppedBecause: string | null = null

  for (let n = 1; n <= wantUnits; n++) {
    const picked: PoolItem[] = []
    const refsInUnit = new Set<string>()
    let short: UnitItemType | null = null

    for (const t of ['order', 'insert'] as const) {
      const need = slots[t]
      let got = 0
      for (const it of byType[t]) {
        if (got >= need) break
        if (used.has(it.id)) continue
        if (refsInUnit.has(it.ref_id)) continue // ② 같은 글 두 번 금지
        picked.push(it)
        refsInUnit.add(it.ref_id)
        got++
      }
      if (got < need) short = t
    }

    if (short) {
      const label = short === 'order' ? '순서' : '삽입'
      stoppedBecause =
        `${n - 1}단원까지 만들고 멈췄다 — ${label} 문항이 모자란다. ` +
        `한 단원 안에서 원글이 겹치면 안 되므로, 문항 수보다 **원글 수**가 먼저 바닥난다.`
      break
    }

    for (const it of picked) used.add(it.id)

    // ③ 이 단원이 쓴 글들의 어휘만 모은다 — 안 읽은 글의 낱말을 외우게 하지 않는다.
    //
    // ⚠️ 글별 쿼터를 준다. 다 합쳐 빈도순으로 고르면 **긴 글 하나가 독식한다** —
    //   실측: 단원 1의 어휘 12개가 전부 'Black hole'(위키백과) 에서 나왔고
    //   나머지 세 글의 낱말은 하나도 안 실렸다. 학습자는 네 지문을 읽는데
    //   어휘 목록은 한 지문 것만 준 셈이다.
    const perRef = Math.ceil(wantVocab / Math.max(1, refsInUnit.size))
    const quota: UnitVocab[] = []
    for (const ref of refsInUnit) {
      quota.push(...pickVocabulary(vocabByRef.get(ref) ?? [], perRef, options.band))
    }
    const vocabulary = pickVocabulary(dedupeWords(quota), wantVocab, options.band)

    units.push({
      no: n,
      band: options.band,
      items: picked,
      vocabulary,
      estimated_minutes:
        picked.length * MINUTES_PER_ITEM + Math.ceil(vocabulary.length * MINUTES_PER_VOCAB),
      sources: [...new Set(picked.map((p) => p.ref_title))],
    })
  }

  if (!stoppedBecause && units.length < wantUnits) {
    stoppedBecause = `${units.length}단원만 만들었다.`
  }
  return { units, stoppedBecause, rejected: { tooShort, tooLong } }
}

/**
 * 같은 원글의 문항이 연달아 오지 않게 재배열한다.
 *
 * 정렬 없이 그대로 쓰면 원글 하나의 문항 10개가 앞 단원들을 다 채우고, 뒤 단원은
 * 남은 글이 없어 굶는다. 글을 번갈아 꺼내면 같은 재료로 더 많은 단원이 나온다.
 */
export function roundRobinByRef(items: ReadonlyArray<PoolItem>): PoolItem[] {
  const groups = new Map<string, PoolItem[]>()
  for (const it of items) {
    if (!groups.has(it.ref_id)) groups.set(it.ref_id, [])
    groups.get(it.ref_id)!.push(it)
  }
  const queues = [...groups.values()]
  const out: PoolItem[] = []
  let moved = true
  while (moved) {
    moved = false
    for (const q of queues) {
      const next = q.shift()
      if (next) {
        out.push(next)
        moved = true
      }
    }
  }
  return out
}

/** 같은 낱말이 여러 글에서 오면 빈도를 합친다 — 목록에 두 번 싣지 않는다. */
function dedupeWords(pool: ReadonlyArray<UnitVocab>): UnitVocab[] {
  const byWord = new Map<string, UnitVocab>()
  for (const v of pool) {
    const prev = byWord.get(v.word)
    if (!prev) byWord.set(v.word, { ...v })
    else prev.frequency_in_article += v.frequency_in_article
  }
  return [...byWord.values()]
}
