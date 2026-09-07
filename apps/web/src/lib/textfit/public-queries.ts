// apps/web/src/lib/textfit/public-queries.ts
//
// 공개(로그인 없음) 레벨 프로파일 — **서버 API 를 통해서만** 분석한다.
//
// 왜 브라우저에서 DB 를 직접 치지 않나 (2026-08-17 재설계):
//   원래 이 파일은 브라우저에서 `shared_words`·`lexicon_clean` 을 직접 조회했다. 동작은 했지만
//   지문 하나에 후보 수천 개를 300개씩 쪼개 **왕복 30회 이상**이 나갔고, 그 경로에 우리 서버가
//   없어서 **한도를 놓을 자리조차 없었다.**
//   레벨 맵 전체가 20,776 표제어 · 202 KB 라 서버 프로세스에 담을 수 있다는 걸 실측하고
//   `/api/fit` 로 옮겼다 → 지문당 DB 왕복 **30+ → 0~1회**, 그리고 한도·상한이 강제된다.
//
// 여전히 지키는 것:
//   · service_role 미사용 — 서버도 anon 키로 공개 테이블만 읽는다(RLS 그대로)
//   · 지문 미저장 — 요청 본문은 토큰 빈도표이고, 서버에 쓰기 경로가 없다
//   · 같은 토크나이저 — `lib/text-extract/tokenize` 결과를 그대로 넘긴다.
//     공개 화면과 로그인 화면이 같은 토큰 집합에서 나와야 두 숫자가 갈라지지 않는다.

import { buildLevelProfile } from './profile'
import type { LevelProfile } from './profile'

/** 공개 화면이 받는 지문 길이 상한(문자). 넘으면 앞에서 자르고 잘렸다고 알린다. */
export const PUBLIC_TEXT_LIMIT = 12_000

/** 서버가 한도를 초과했다고 답했을 때 던지는 오류 — 화면이 문구를 달리 낸다. */
export class FitRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('rate limited')
    this.name = 'FitRateLimitError'
  }
}

/**
 * 지문 하나의 레벨 프로파일을 만든다 — 로그인 불필요.
 *
 * @param signal 입력이 바뀌면 이전 요청을 취소한다(마지막 결과만 화면에 남게).
 */
export async function analyzePublicText(
  counts: Record<string, number>,
  totalTokens: number,
  signal?: AbortSignal,
): Promise<LevelProfile> {
  if (Object.keys(counts).length === 0) return buildLevelProfile([], totalTokens)

  const res = await fetch('/api/fit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ counts, totalTokens }),
    signal,
  })

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? '5')
    throw new FitRateLimitError(Number.isFinite(retryAfter) ? retryAfter : 5)
  }
  if (!res.ok) throw new Error(`분석 실패 (${res.status})`)

  return (await res.json()) as LevelProfile
}
