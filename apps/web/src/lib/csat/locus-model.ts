// apps/web/src/lib/csat/locus-model.ts
//
// **「정답 근거는 어디 있나」를 주장이 아니라 실측으로 말한다.**
//
// 유형 화면은 이 질문을 **산문 평균 1,763자**(최대 5,931자)로 답한다. 산문은 학습자가 검증할
// 수 없다 — 읽고 믿거나 말거나다. 그런데 우리에겐 골격이 있으므로 **세어서 보여 줄 수 있다.**
//
// ── 세는 것 ───────────────────────────────────────────────────────────
// 정답 앵커가 걸린 문장의 **상대 위치** = 문장번호 / (문장수 − 1). 0 이 첫 문장, 1 이 끝 문장.
// 문장이 하나뿐인 지문은 분모가 0 이라 제외한다(안내문 유형에 실제로 있다).
//
// ── 실측이 말해 준 것 (2026-09-15 · 561문항 · 25유형) ─────────────────
// 유형별 편차가 **0.57** 이다 — 전체 평균 하나로 뭉뚱그릴 수 없다:
//   R-IRRELEVANT 1.00(100% 마지막 문장) · R-INSERT 0.77 · R-NOTICE 0.75
//   … X-ORDER 0.48(앞 56%) · R-PURPOSE 0.43
//
// ⚠️ **표본이 적으면 수치를 내지 않는다.** 8문항 미만에서 「대개 뒤쪽」이라고 적으면 그건
//    관찰이 아니라 우연이고, 학습자는 그것을 규칙으로 외운다. 이 저장소가 되풀이해
//    경계하는 것이다(«3명 중 1명» 을 «33%» 로 인쇄하지 않는다 — RetentionPanel 과 같은 판단).
//
// 순수 함수다 — 위치 배열을 받아 접기만 한다. 읽는 것은 부르는 쪽의 몫이다.

/** 표본이 이보다 적은 유형은 수치를 내지 않는다. */
export const MIN_SAMPLE = 8

/** 다섯 구간 — 이름이 곧 라벨이다(색만으로 말하지 않는다). */
export const BANDS = [
  { key: 'head', label: '앞머리', from: 0, to: 0.2 },
  { key: 'early', label: '앞', from: 0.2, to: 0.4 },
  { key: 'mid', label: '가운데', from: 0.4, to: 0.6 },
  { key: 'late', label: '뒤', from: 0.6, to: 0.8 },
  { key: 'end', label: '끝', from: 0.8, to: 1.0001 },
] as const

export type BandKey = (typeof BANDS)[number]['key']

export interface LocusSummary {
  /** 센 문항 수. */
  n: number
  /** 평균 상대 위치 (0 = 첫 문장 · 1 = 끝 문장). */
  avg: number
  /** 구간별 문항 수 — 순서는 `BANDS`. 0 인 구간도 자리를 지킨다. */
  bands: { key: BandKey; label: string; count: number; share: number }[]
  /** 가장 큰 구간. 동점이면 **뒤쪽**을 고른다(전체 분포가 뒤로 치우쳐 있다). */
  top: { key: BandKey; label: string; count: number; share: number }
  /** 뒤 + 끝의 비율 — 한 줄 요약에 쓴다. */
  lateShare: number
}

export function bandOf(rel: number): BandKey {
  for (const b of BANDS) if (rel >= b.from && rel < b.to) return b.key
  return 'end'
}

/**
 * 위치 배열 → 요약. 표본이 `MIN_SAMPLE` 미만이면 **`null`** — 없는 규칙을 있는 척하지 않는다.
 */
export function summarizeLocus(positions: number[]): LocusSummary | null {
  const xs = positions.filter((p) => Number.isFinite(p) && p >= 0 && p <= 1)
  if (xs.length < MIN_SAMPLE) return null

  const counts = new Map<BandKey, number>(BANDS.map((b) => [b.key, 0]))
  for (const x of xs) counts.set(bandOf(x), (counts.get(bandOf(x)) ?? 0) + 1)

  const bands = BANDS.map((b) => {
    const count = counts.get(b.key) ?? 0
    return { key: b.key, label: b.label, count, share: count / xs.length }
  })

  // 동점이면 뒤쪽을 고른다 — `reduce` 가 뒤 원소를 이기게 두면 자연히 그렇게 된다.
  const top = bands.reduce((best, b) => (b.count >= best.count ? b : best), bands[0])
  const lateShare = bands.filter((b) => b.key === 'late' || b.key === 'end').reduce((a, b) => a + b.share, 0)

  return {
    n: xs.length,
    avg: xs.reduce((a, b) => a + b, 0) / xs.length,
    bands,
    top,
    lateShare,
  }
}

/**
 * 한 줄 요약 문장. **숫자를 말하되 과장하지 않는다.**
 *
 * 한 구간이 압도적일 때만 그렇게 말하고(«전부» 는 100% 일 때만), 아니면 분포를 그대로 읽는다.
 * 「대개 뒤쪽」 같은 말을 60% 에도 붙이면 학습자가 그것을 규칙으로 외운다.
 */
export function locusSentence(s: LocusSummary): string {
  const pct = Math.round(s.top.share * 100)
  if (s.top.share >= 1) return `이 유형 ${s.n}문항이 **전부** 지문 ${s.top.label}에 근거가 있었어요.`
  if (s.top.share >= 0.6) return `${s.n}문항 중 ${pct}%가 지문 ${s.top.label}에 근거가 있었어요.`
  const late = Math.round(s.lateShare * 100)
  if (s.lateShare >= 0.6) return `${s.n}문항 중 ${late}%가 지문 뒤쪽(뒤·끝)에 근거가 있었어요.`
  return `${s.n}문항을 세어 보면 근거 자리가 고르게 흩어져 있어요 — 가장 잦은 곳은 ${s.top.label}(${pct}%)예요.`
}
