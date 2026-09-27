// apps/web/src/lib/textbook/source-process.ts
//
// **원문 한 편이 교재 재료가 되기까지 지나는 관문** — 화면의 「지금 해야 할 작업」이 읽는 모델.
//
// ── 왜 다시 짰나 (실측 2026-09-24) ─────────────────────────────────────────
// 앞선 작업 큐는 6항목 × 5줄 산문이었고, **같은 재고를 두 줄로 겹쳐** 보여주면서 서로 반대되는
// 처방을 달고 있었다:
//   「미판정 내용 검토 31,220편 — 판정 청크를 준비합니다」
//   「미절단 원본 31,220편 — 내용 판정만 반복해도 교재 지문이 되지 않습니다」
// 둘은 **같은 31,220편**이고, 실측하면 내용 미판정 중 판정으로 열리는 것은 **0편**이다
// (전부 `raw_content_unjudged`). 즉 첫째 줄은 지금 대상이 없는 지시였다.
//
// ── 이 모델이 지키는 것 ────────────────────────────────────────────────────
// ① **순서가 있다.** 관문은 `evaluateSource` 가 실제로 보는 차례대로 선다. 어느 관문에서
//    걸렸는지가 곧 다음에 할 일이라, 순서 없이 나열하면 처방이 섞인다.
// ② **겹침을 숨기지 않는다.** 한 원문이 여러 관문에 동시에 걸린다(추출 대기이면서 CEFR 초과).
//    그래서 걸린 수는 **합산하지 않는다** — 화면이 합을 그리면 그 순간 거짓말이 된다.
// ③ **열리는 방식을 적는다.** 드레인으로 열리는 것과 정책 결정이 있어야 열리는 것은
//    같은 「할 일」이 아니다. 섞으면 열리지 않을 재고를 계속 갈아 넣게 된다.
// ④ **처방을 한 줄로.** 이유·영향·전제·확인은 원문 하나를 열었을 때 볼 것이지,
//    목록에서 여섯 번 반복할 것이 아니다.

import type { SourceQueue, SourceBreakdownReason } from './source-operations'

/** 이 관문이 열리는 방식. 화면이 이것으로 「지금 할 수 있는 것」을 가른다. */
export type SourceGateBy =
  /** 배치 드레인으로 열린다 — 지금 돌릴 수 있다. */
  | 'drain'
  /** 사람이 표본을 보고 판단해야 한다. */
  | 'investigate'
  /** 정책·기준이 바뀌어야 열린다. 갈아 넣어도 안 열린다. */
  | 'policy'
  /** 영구 제한. 열리지 않는다. */
  | 'closed'

export interface SourceGate {
  id: string
  /** 공정 순번. `evaluateSource` 가 보는 차례다. */
  step: number
  name: string
  /** 이 관문에 걸린 편수. **다른 관문과 겹친다 — 합산 금지.** */
  stuck: number
  /** 이 수를 누르면 볼 목록. */
  target: { queue: SourceQueue; reason?: SourceBreakdownReason }
  /** 무엇이 이것을 여는가. 한 줄. */
  opens: string
  by: SourceGateBy
}

export interface SourceProcessView {
  /** 판정 대상 전량(조판 후보). 관문의 분모다. */
  intake: number
  gates: SourceGate[]
  /** 모든 관문을 통과한 편수. */
  eligible: number
  /**
   * **적격이면서** 교재 재료 태그가 실린 편수 — 실제로 교재로 갈 수 있는 유일한 몫.
   *
   * ⚠️ 「재료 태그가 있는 편수」(6,291)를 여기 넣지 않는다. 그 수는 등급을 보지 않아서,
   *   「관문 통과 → 재료 실림」 자리에 놓이면 **그만큼이 통과한 것처럼 읽힌다.**
   *   실측(2026-09-24)은 정반대다: 태그가 있는 6,291편 중 적격은 0편이고
   *   6,273편이 오직 `cefr_above_band` 로 막혀 있다.
   */
  ready: number
  /** 관문 총수(재고가 없어 안 그려진 것 포함). 번호가 건너뛰는 이유를 화면이 말할 수 있게 한다. */
  totalGates: number
  /**
   * 지금 가장 큰 병목 중 **드레인으로 열리는 것**. 없으면 null.
   *
   * ⚠️ 단순히 「가장 큰 수」를 고르지 않는다 — 그러면 늘 정책 관문(CEFR)이 뽑히고,
   *   화면은 아무도 손댈 수 없는 것을 「지금 할 일」로 내민다.
   */
  bottleneck: SourceGate | null
}

export interface SourceProcessCounts {
  intake: number
  analysisIncomplete: number
  rawPendingExtraction: number
  contentUnjudged: number
  /**
   * 판정에서 **버린** 편수(`content_rejected`).
   *
   * 여기에 법·안전·장르를 합치지 않는다 — 셋은 한 원문에 겹쳐서 붙어 정확한 합을 낼 수 없고
   * (처음에 max 로 얼버무렸다), 셋 다 합쳐도 457편(0.7%)이라 이 화면의 결정을 바꾸지 않는다.
   * 정확히 셀 수 없는 수를 관문에 세우면 그 줄이 그대로 다음 사람의 근거가 된다.
   */
  contentRejected: number
  cefrAboveBand: number
  qualitySignals: number
  rejectedWithItems: number
  eligible: number
  ready: number
}

/**
 * 관문을 순서대로 세운다.
 *
 * `contentUnjudged` 와 `rawPendingExtraction` 은 **겹친다.** 그 차이(= 판정 드레인으로
 * 열리는 몫)만 「내용 판정」 관문에 세우고, 나머지는 「추출」 관문으로 보낸다 —
 * 이렇게 해야 두 줄이 같은 재고를 두 번 세지 않는다. 실측(2026-09-24)에서 그 차이는 0이라
 * 「내용 판정」 관문은 화면에 아예 뜨지 않는다(걸린 게 없는 관문은 그린다고 도움이 안 된다).
 */
export function buildSourceProcess(counts: SourceProcessCounts): SourceProcessView {
  const judgeable = Math.max(0, counts.contentUnjudged - counts.rawPendingExtraction)

  const gates: SourceGate[] = [
    {
      id: 'analysis', step: 1, name: '분석',
      stuck: counts.analysisIncomplete,
      target: { queue: 'analysis' },
      opens: '학령·어수·문체·구문 중 빈 칸을 채우는 분석 경로',
      by: 'drain',
    },
    {
      id: 'extract', step: 2, name: '추출',
      stuck: counts.rawPendingExtraction,
      target: { queue: 'raw' },
      // 이 한 줄이 이 화면에서 가장 비싼 오해를 막는다.
      opens: '전문을 발췌로 자르는 추출. **내용 판정을 반복해도 열리지 않는다**',
      by: 'drain',
    },
    {
      id: 'judgment', step: 3, name: '내용 판정',
      stuck: judgeable,
      target: { queue: 'content' },
      opens: '본문을 읽고 verdict·genre·재료를 적는 판정 드레인',
      by: 'drain',
    },
    {
      id: 'rejected', step: 4, name: '내용 반려',
      stuck: counts.contentRejected,
      target: { queue: 'rejected', reason: 'content_rejected' },
      opens: '판정에서 버린 것 — 되살리려면 재판정이 필요하다',
      by: 'closed',
    },
    {
      id: 'cefr', step: 5, name: '학령(CEFR)',
      stuck: counts.cefrAboveBand,
      target: { queue: 'cefr' },
      opens: '학령 상한을 올리는 **정책 결정**. 임의 하향 판정 대상이 아니다',
      by: 'policy',
    },
  ]

  const quality: SourceGate = {
    id: 'quality', step: 6, name: '본문 품질 신호',
    stuck: counts.qualitySignals,
    target: { queue: 'quality' },
    opens: '표본을 눈으로 보고 추출기를 조사 — 오탐을 포함하므로 자동 반려 사유가 아니다',
    by: 'investigate',
  }
  const linked: SourceGate = {
    id: 'linked-rejected', step: 7, name: '반려 원문에 붙은 문항',
    stuck: counts.rejectedWithItems,
    target: { queue: 'p0', reason: 'content_rejected' },
    opens: '문항별 지문·앵커 대조 — 연결은 실제 노출의 증거가 아니다',
    by: 'investigate',
  }

  const all = [...gates, quality, linked].filter((g) => g.stuck > 0)

  // 드레인으로 열리는 것 중 가장 큰 것. 정책·영구 제한은 「지금 할 일」이 아니다.
  const openable = all.filter((g) => g.by === 'drain')
  const bottleneck = openable.length
    ? openable.reduce((a, b) => (b.stuck > a.stuck ? b : a))
    : null

  return {
    intake: counts.intake,
    gates: all,
    totalGates: [...gates, quality, linked].length,
    eligible: counts.eligible,
    ready: counts.ready,
    bottleneck,
  }
}
