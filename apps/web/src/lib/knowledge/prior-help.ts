// apps/web/src/lib/knowledge/prior-help.ts
//
// **세션을 건너온 도움**을 읽을 때 판정한다 — 같은 문항의 다른 세션(새로고침 · 문항 재선택 · 다른 기기 · 해설 극장 공개)에서
// 먼저 받은 도움 · 해설 열람이 이 판단보다 앞섰나(2026-10-09 원인 분석 뒤 재설계).
//
// 왜 쓰기 때가 아니라 읽기 때인가: 「판단이 도움보다 먼저였나」는 기기 시각(판단)과 다른 세션의 시각(도움)의 순서 문제다.
// 쓰기 때 값 하나로 덮으면 — 시각을 비교하면 다른 기기 시계가 앞설 때 앞선 열람을 놓치고, 시각을 무시하면 먼저 판단하고
// 늦게 도착한 판단을 도움받은 것으로 잘못 센다(Codex P1 두 개가 서로를 다시 연다). 그래서 기록은 기기가 보낸 사실 그대로 두고,
// 읽을 때 M8 과 같은 규칙(판단 시각 vs 도움 시각 · 2분 안 · 서버 수신 순서 모순 · 판단 기기 지연 폭 · 도움 기기 시계 의심)으로
// 「도움받음 / 시각 불확실 / 독립」을 가른다. 불확실은 독립으로 세지 않는다(보류).

const NEAR_MS = 120_000

export interface CrossSession {
  id: string
  item_ref: string | null
  help_received_at: string | null
  explanation_viewed_at: string | null
  help_server_at: string | null
  explanation_server_at: string | null
  help_clock_suspect?: boolean | null
}

export interface CrossAttempt {
  sessionId: string | null
  itemId: string
  answeredAt: string
  /** 서버 수신 시각(M8 received_at) — 옛 기록은 null */
  receivedAt: string | null
}

export type CrossVerdict = 'independent' | 'helped' | 'uncertain'

const t = (s: string | null | undefined) => (s ? Date.parse(s) : Number.NaN)

/** 다른 세션의 도움 · 해설 열람이 이 판단에 앞섰나 — 같은 세션 안의 도움은 M8 첫 시도 뷰가 이미 가른다 */
export function crossSessionHelp(a: CrossAttempt, sessions: readonly CrossSession[]): CrossVerdict {
  const answered = t(a.answeredAt)
  const received = t(a.receivedAt)
  const delay = Number.isFinite(received) ? received - answered : Number.NaN
  let verdict: CrossVerdict = 'independent'
  for (const s of sessions) {
    if (s.item_ref !== a.itemId || s.id === a.sessionId) continue
    const events = [
      { at: t(s.help_received_at), srv: t(s.help_server_at) },
      { at: t(s.explanation_viewed_at), srv: t(s.explanation_server_at) },
    ].filter((e) => Number.isFinite(e.at))
    if (events.length === 0) continue
    // 도움 기록 기기의 시계가 미래였다 — 그 세션의 시각 순서는 믿지 않는다
    if (s.help_clock_suspect) verdict = 'uncertain'
    for (const e of events) {
      if (e.at <= answered - NEAR_MS) return 'helped' // 판단 2분 넘게 전에 도움 — 분명히 앞섰다
      if (Math.abs(answered - e.at) < NEAR_MS) verdict = 'uncertain' // 2분 안 · 동률
      // 서버는 도움을 먼저 받았는데 그 뒤 도착한 판단이 도움보다 이르다고 주장 — 판단 기기 시계가 늦거나 오프라인
      else if (Number.isFinite(e.srv) && Number.isFinite(received) && e.srv <= received && answered < e.at) verdict = 'uncertain'
      // 판단 기기 지연(수신 − 판단 > 2분) 폭 안에 도움 시각이 있으면 순서를 믿지 않는다
      else if (Number.isFinite(delay) && delay > NEAR_MS && Math.abs(answered - e.at) < delay) verdict = 'uncertain'
    }
  }
  return verdict
}
