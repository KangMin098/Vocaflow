// packages/library-pipeline/src/ingest/standard-ebooks-resilient.ts
//
// Standard Ebooks 인제스트 — 웹 우선, 실패 시 공개 저장소로 폴백.
//
// 왜 하나로 합치지 않는가:
//   두 경로는 성격이 다르다. 웹(single-page)은 SE 가 독자용으로 제공하는 화면이고,
//   저장소는 배포용 원본이다. 어느 한쪽만 남기면 그쪽이 막혔을 때 파이프라인이 선다 —
//   실제로 대량 수집 뒤 웹이 차단돼 배치 55건이 전부 실패했다(UND_ERR_CONNECT_TIMEOUT).
//
// 폴백 조건을 "네트워크 실패" 로 좁힌 이유:
//   본문 파싱 실패(예: front-matter 가 본문을 삼킴)까지 폴백하면 **결함이 조용히 감춰진다**.
//   같은 파싱 로직을 두 경로가 공유하므로 저장소 쪽도 같은 결과가 나올 뿐이고,
//   문제는 드러나지 않은 채 남는다. 연결 자체가 안 될 때만 경로를 바꾼다.
//
// 두 경로의 분절 품질은 동등하다(실측):
//   Christmas Carol  웹 5ch/8,250   · git 5ch/8,258
//   Plato Dialogues  웹 43ch/133,322 · git 50ch/133,340   (git 이 더 잘게 나뉨)
//   Proust           웹 24ch/134,335 · git 24ch/134,344

import type { RawBook } from '../types'
import { ingestFromStandardEbooks } from './standard-ebooks'
import { ingestFromStandardEbooksGit } from './standard-ebooks-git'

/** 네트워크 계층 실패인가 — 파싱·검증 실패와 구분한다 */
function isNetworkFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const code = (err as { cause?: { code?: string } }).cause?.code ?? ''
  if (/^(UND_ERR_|ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|CERT_)/.test(code)) return true
  // undici 는 원인을 cause 에만 담고 message 는 'fetch failed' 로 뭉뚱그린다
  return /fetch failed|network|socket|timeout|ECONNRESET/i.test(err.message)
}

/**
 * 웹 경로로 먼저 시도하고, **연결이 안 될 때만** 공개 저장소로 폴백한다.
 *
 * @param sourceId '<author>/<title>[/<contributor>…]' — 두 경로가 같은 형식을 쓴다
 */
export async function ingestFromStandardEbooksResilient(sourceId: string): Promise<RawBook> {
  try {
    return await ingestFromStandardEbooks(sourceId)
  } catch (err) {
    if (!isNetworkFailure(err)) throw err
    const reason = err instanceof Error ? err.message : String(err)
    console.error(`[SE] 웹 경로 실패 → 저장소로 폴백 (${sourceId}): ${reason.slice(0, 80)}`)
    return ingestFromStandardEbooksGit(sourceId)
  }
}
