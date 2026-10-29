// apps/web/src/lib/srs/push-owned.ts
//
// 주인이 정해진 평가만 대기열에 넣는다 — 연습 화면(SpellForge · StudyMode · PairFlip)의 새 평가용.
//
// pushPendingResult 는 넣는 순간의 전역 대기열 주인(queueOwner)을 붙인다. 그런데 그 주인은 화면 마운트 뒤
// flush-session 이 브라우저 세션을 읽어야 정해진다(resolveSrsQueueOwner). 정해지기 전에 넣은 평가는 주인 없이 보류되고,
// T-0172 규칙상 나중에 A 로 자동 인수되지 않는다 — 학습자의 첫 평가가 영영 반영되지 않았다(Codex 반례 2026-10-28).
// 주인 해석을 기다렸다가 넣는 판은 해석이 실패하면 평가를 **어느 큐에도** 남기지 못했다(Codex 반례 — 그래서 기다리지 않는다).
//
//   주인 = 판 주인(viewer)                       → 그대로 넣는다
//   주인 미정(null) · 판이 지금 긍정 확인(same)   → 이 새 평가 하나만 판 주인 몫으로 명시해 남긴다(pushPendingResultAs)
//                                                 주인이 그 사람으로 정해지면 다음 flush 가 보낸다
//   주인 = 다른 사람 · 판이 확인 안 됨             → 넣지 않는다(호출부는 이미 ownsSession 으로 입력을 막는다)
//   판 주인이 null(로그인 없이 한 판) · 미지정    → 기존 그대로(pushPendingResult)
// 이미 쌓인 항목(주인 없는 예전 항목 포함)은 건드리지 않는다. 전역 주인을 덮지 않는다. 권한 증명이 아니다 — 반영은 서버가 주인별로 다시 계산한다.

import { getSrsQueueOwner, pushPendingResult, pushPendingResultAs, type PendingSrsResult } from '@/lib/srs/session-storage'

export function pushOwnedResult(
  item: PendingSrsResult,
  viewerId: string | null | undefined,
  /** 이 판이 지금 그 사람으로 긍정 확인됐는가(계정 경계 same) */
  confirmed: () => boolean = () => true,
): void {
  if (viewerId === undefined || viewerId === null) {
    pushPendingResult(item)
    return
  }
  const q = getSrsQueueOwner()
  if (q === viewerId) {
    pushPendingResult(item)
    return
  }
  if (q === null && confirmed()) pushPendingResultAs(item, viewerId)
}
