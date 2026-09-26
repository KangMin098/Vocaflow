// packages/video-factory/src/requests/outcome.ts
//
// **목적 평가가 셀 재생 기록의 창.** 순수 함수.
//
// 교체 편은 옛 편과 같은 video id 를 쓴다 — `funnel_events.meta.videoId` 만으로 세면 옛 편의
// 재생·완주가 새 편의 성적으로 섞인다. 그래서 요청이 applied 가 된 순간의 발행 시각(`applied_at`,
// 마이그레이션 20260926120000)부터만 센다. 그 시각이 없으면(마이그레이션 전에 applied 된 교체 편)
// **재지 않는다** — 옛 기록을 섞은 비율은 다음 기획이 근거로 쓰기 때문이다.

export interface OutcomeWindow {
  /** 이 시각 이후(포함)의 이벤트만 센다. null = 창 제한 없음(새 id 라 옛 편이 없다) */
  since: string | null
  /** false 면 세지 않고 「못 잼」으로 적는다 */
  measurable: boolean
  note: string | null
}

export function outcomeWindow(r: { mode: 'new' | 'replace'; applied_at: string | null }): OutcomeWindow {
  if (r.applied_at) return { since: r.applied_at, measurable: true, note: null }
  if (r.mode === 'replace') {
    return {
      since: null,
      measurable: false,
      note: '교체 편인데 발행 시각(applied_at)이 없다 — 옛 편의 재생 기록과 가를 수 없어 재지 않는다',
    }
  }
  return { since: null, measurable: true, note: null }
}
