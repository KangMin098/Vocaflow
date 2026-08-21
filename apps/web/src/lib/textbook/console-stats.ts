// apps/web/src/lib/textbook/console-stats.ts
//
// **교재(TBP) 콘솔 집계 — 사다리 · 문항 건강 · 평가 우위를 한 번에 읽는다.**
//
// ── 왜 한 곳에 모으나 ────────────────────────────────────────────────
// 교재 파이프라인의 상태는 지금까지 **스크립트 일곱 개를 따로 돌려야** 보였다
// (`series-report` · `item-health-report` · `evaluation-report` · 유형별 수율 프로브 넷).
// 관리자가 "지금 어디가 막혔나" 를 묻는 자리는 하나인데 답이 일곱 군데에 흩어져 있으면
// 아무도 안 본다 — 이 저장소는 그 사고를 이미 겪었다(잠긴 화면을 아무도 안 봐서 이틀간
// 결함이 남아 있었다).
//
// ⚠️ **없는 것을 0 으로 뭉개지 않는다.** `head:true` 카운트 요청은 없는 테이블에도
//   204/count=null 을 돌려주므로 `count ?? 0` 은 "미처리 0건" 이라는 거짓 안심을 만든다.
//   여기서는 오류를 그대로 올려 화면이 이유를 말하게 한다.

import {
  EVAL_DIMENSIONS,
  SERIES_SPINE,
  assessAnswerBias,
  measureEvaluation,
  measureSeriesFill,
  type EvalReport,
  type SeriesItemType,
  type SeriesFill,
} from '@vocaflow/library-pipeline'

import { createAdminClient } from '@/lib/supabase/admin'

/** 유형별 저장 문항 — 콘솔 첫 줄. */
export interface TypeRow {
  type: string
  count: number
  /** 정답 번호가 균등한가. 답지가 없는 유형(단답)이면 null. */
  answerBiased: boolean | null
  chi2: number | null
}

export interface TextbookConsoleStats {
  /** 저장 문항 총수. */
  totalItems: number
  byType: TypeRow[]
  series: SeriesFill
  evaluation: EvalReport
  /** 학습자 관측 수 — 0 이면 난이도·변별도를 못 낸다. */
  observations: number
  /** 조회가 깨졌을 때 그 이유. 화면이 빈 표 대신 이것을 말한다. */
  loadError: string | null
}

/** 저장 형식에 정답 번호가 있는 유형만 쏠림을 잰다. */
const ANSWER_IN_PAYLOAD = new Set(['irrelevant', 'vocab_choice', 'grammar_choice'])
const CHOICES = 5

export async function getTextbookConsoleStats(): Promise<TextbookConsoleStats> {
  const empty: TextbookConsoleStats = {
    totalItems: 0,
    byType: [],
    series: measureSeriesFill([]),
    evaluation: measureEvaluation(EVAL_DIMENSIONS),
    observations: 0,
    loadError: null,
  }

  const db = createAdminClient()

  // 1,000행 조용한 절단에 두 번 당한 저장소다 — 페이지로 받는다.
  const rows: { type: string; v_level: number | null; answer_key: unknown }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('csat_dcp_items')
      .select('type, v_level, answer_key')
      .order('id')
      .range(from, from + 999)
    if (error) return { ...empty, loadError: `문항 조회 실패: ${error.message}` }
    if (!data?.length) break
    rows.push(...(data as typeof rows))
    if (data.length < 1000) break
  }

  const counts = new Map<string, number>()
  const answers = new Map<string, number[]>()
  const inventory: { type: SeriesItemType; vLevel: number | null; count: number }[] = []
  const invKey = new Map<string, number>()

  for (const r of rows) {
    counts.set(r.type, (counts.get(r.type) ?? 0) + 1)
    const k = `${r.type}|${r.v_level}`
    invKey.set(k, (invKey.get(k) ?? 0) + 1)
    if (!ANSWER_IN_PAYLOAD.has(r.type)) continue
    const pos = (r.answer_key as { position?: number } | null)?.position
    if (typeof pos !== 'number' || pos < 1 || pos > CHOICES) continue
    const arr = answers.get(r.type) ?? new Array(CHOICES).fill(0)
    arr[pos - 1]! += 1
    answers.set(r.type, arr)
  }

  for (const [k, count] of invKey) {
    const [type, v] = k.split('|')
    inventory.push({
      type: type as SeriesItemType,
      vLevel: v === 'null' ? null : Number(v),
      count,
    })
  }

  const byType: TypeRow[] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => {
      const hist = answers.get(type)
      if (!hist) return { type, count, answerBiased: null, chi2: null }
      const bias = assessAnswerBias(hist)
      return { type, count, answerBiased: bias.biased, chi2: bias.chi2 }
    })

  // 관측 — 0 이면 그 사실 자체가 정보다(평가·개정 단계가 반쪽이라는 뜻).
  const { count: attempts, error: aErr } = await db
    .from('csat_item_attempts')
    .select('id', { count: 'exact', head: true })
  if (aErr) return { ...empty, loadError: `관측 조회 실패: ${aErr.message}` }

  return {
    totalItems: rows.length,
    byType,
    // ⚠️ 초등 3종은 DB 에 없다(사전의 순수 함수) — 여기 사다리는 **저장 문항 기준**이라
    //   초등 계단이 비어 보인다. 전체 수율은 `series-report` 스크립트가 낸다.
    series: measureSeriesFill(inventory, SERIES_SPINE),
    evaluation: measureEvaluation(EVAL_DIMENSIONS),
    observations: attempts ?? 0,
    loadError: null,
  }
}
