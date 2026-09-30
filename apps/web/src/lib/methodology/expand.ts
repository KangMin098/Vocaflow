// apps/web/src/lib/methodology/expand.ts
// 가져오기 원장 워크벤치 — 주장 한 줄이 펼쳐져 있는가 (순수).
//
// openClaim 의 세 상태를 구분한다:
//   · 주장 id  — 그 주장이 열려 있다
//   · ''       — 사용자가 **직접 접었다**. 기본 펼침으로 되살리지 않는다
//   · 이 방법에 없는 id — 선택이 필터로 다른 방법에 넘어간 경우. 그때만 원칙을 기본으로 편다
// 예전 식은 ''(접음)도 「이 방법에 없는 id」로 읽어 접자마자 원칙을 다시 폈다(Codex 리뷰 P3, 2026-09-30).
export function isClaimExpanded(openClaim: string, claimId: string, kind: string, activeClaimIds: readonly string[]): boolean {
  if (openClaim === claimId) return true
  if (openClaim === '') return false
  return !activeClaimIds.includes(openClaim) && kind === 'principle'
}
