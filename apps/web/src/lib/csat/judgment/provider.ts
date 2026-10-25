// apps/web/src/lib/csat/judgment/provider.ts
// 제품 RevealProvider — T-0147 판단 라우트(POST /api/csat/item/[slug]/judgment)를 학습자 요청 때만 부른다.
// 라우트는 인증 → 보류 → 분석 판본 결속(409) → 노출 원장 answer_direct 커밋 → 성공 뒤에만 공개 자료를 낸다.
// 판단 도구는 그 응답의 `judgment`(RevealData, lib/csat/judgment/server.ts 의 loadJudgmentReveal) 를 쓴다.
// 공개 제어는 서버(owner csat-lecture-disclosure)의 책임이다 — 이 파일은 그 계약을 우회하는 경로를 만들지 않는다.
import { RevealError, type RevealProvider } from './types'

export type JudgmentRouteDeps = {
  fetch?: typeof fetch
  /** 노출 원장 멱등 키 — 같은 문항 · 같은 provider 의 재시도는 같은 id 를 다시 보낸다 */
  newId?: () => string
  source?: 'judgment_scene'
}

const STATUS_REASON: Record<number, RevealError['reason']> = { 401: 'auth', 403: 'auth', 409: 'version', 423: 'held' }

/** UUID v4 — randomUUID 는 보안 컨텍스트(https · localhost)에서만 있어 http 개발 주소에서는 getRandomValues 로 만든다 */
export function uuidV4(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function judgmentRouteProvider(slug: string, deps: JudgmentRouteDeps = {}): RevealProvider {
  const doFetch = deps.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  const newId = deps.newId ?? uuidV4
  const ids = new Map<string, string>()
  return async (item) => {
    const key = `${item.id}@${item.version.analysisVersion}`
    const clientExposureId = ids.get(key) ?? newId()
    ids.set(key, clientExposureId)
    let res: Response
    try {
      res = await doFetch(`/api/csat/item/${encodeURIComponent(slug)}/judgment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ analysisVersion: item.version.analysisVersion, clientExposureId, source: deps.source ?? 'judgment_scene' }),
      })
    } catch {
      throw new RevealError('fetch')
    }
    if (!res.ok) throw new RevealError(STATUS_REASON[res.status] ?? 'fetch')
    const body = (await res.json().catch(() => null)) as { ok?: boolean; judgment?: unknown } | null
    if (!body?.ok || body.judgment == null) throw new RevealError('shape')
    // 판본 · 형식 검사는 useReveal 의 checkReveal 이 한 번 더 한다
    return body.judgment as Awaited<ReturnType<RevealProvider>>
  }
}
