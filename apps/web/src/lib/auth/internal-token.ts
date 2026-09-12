// apps/web/src/lib/auth/internal-token.ts
//
// 내부 토큰 비교 — **타이밍 세이프**.
//
// ── 왜 `!==` 로는 안 되는가 ───────────────────────────────────────────
// 문자열 `!==` 는 **다른 글자를 만나는 순간 멈춘다.** 그래서 맞은 접두사가 길수록 비교가
// 조금 더 오래 걸리고, 그 차이가 네트워크 잡음 아래에 있더라도 수천 번 재면 평균으로
// 드러난다. 공격자는 한 글자씩 늘려 가며 "조금 더 느린" 후보를 고르면 되므로,
// 전수 탐색(문자 종류^길이)이 **길이 × 문자 종류**로 줄어든다.
//
// 이 토큰이 지키는 것: `/api/lcp/process` 는 통과하면 service_role 로 DB 를 쓰고
// **Anthropic 유료 호출**(`analyzeBook`)까지 돈다. 가드가 이것 하나뿐이다.
//
// ── 왜 길이를 먼저 보지 않는가 ────────────────────────────────────────
// `timingSafeEqual` 은 길이가 다르면 던지므로 길이 비교가 불가피한데, 길이를 그대로
// 흘리면 그것도 정보다. 그래서 **양쪽을 같은 길이로 해싱한 뒤** 비교한다 —
// 해시 길이는 항상 32바이트라 입력 길이가 결과에 남지 않는다.

import { createHash, timingSafeEqual } from 'node:crypto'

function sha256(v: string): Buffer {
  return createHash('sha256').update(v, 'utf8').digest()
}

/**
 * 요청이 들고 온 토큰이 서버 토큰과 같은가.
 *
 * @param provided 요청 헤더 값 (없으면 `null`)
 * @param expected 서버 환경변수 값 (없거나 빈 문자열이면 **항상 false** — 토큰이 설정되지
 *                 않았는데 통과시키면 게이트가 통째로 사라진다)
 */
export function internalTokenMatches(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!expected) return false
  if (!provided) return false
  return timingSafeEqual(sha256(provided), sha256(expected))
}
