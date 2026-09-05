// scripts/textbook/_mediawiki.mjs
//
// **MediaWiki 표집·도입부 추출 — 프로브와 적재기가 함께 쓴다.**
//
// ── 왜 따로 빼는가 ───────────────────────────────────────────────────
// 이 두 함수는 `kid-source-probe.mjs` 안에 있었고, 거기서 **두 소스**가 쓴다
// (`simple_wikipedia_lead` 284,760 · `vikidia_en` 6,099 — 조사에서 가장 큰 두 풀).
// 적재기가 같은 일을 다시 쓰면 **프로브가 잰 것과 적재기가 넣는 것이 갈린다** —
// "50% 가 초등 창에 든다" 고 재 놓고 다른 방법으로 가져오면 그 수치는 근거가 아니다.
// 그래서 한 벌로 두고 양쪽이 부른다.
//
// ── 여기 담긴 실측 ───────────────────────────────────────────────────
// · `rnlimit` 상한은 50 이다. `--sample 100` 을 줘도 50건만 오므로 채울 때까지 여러 번 부른다.
// · 무작위 표집은 같은 항목을 다시 준다 — 제목으로 거른다.
// · 429 는 250ms 간격으로 두드리면 16번째부터 온다. 물러서는 것이 예의이자 정확도다.
// · Node(undici) connectTimeout 기본값이 10초이고 **AbortController 로는 못 늘린다** —
//   `timeout` 을 180초로 줘도 연결은 10초에 끊긴다. 그래서 재시도로 넘긴다.

const DEFAULT_UA =
  'Vocaflow-SourceProbe/1.0 (+https://vocaflow.app; educational corpus research; contact killerapp51@empal.com)'

/** 표집·추출이 함께 쓰는 GET. 429·연결 타임아웃만 물러섰다 다시 친다. */
export async function mediawikiGet(
  url,
  { json = false, timeout = 30_000, retry = 2, ua = DEFAULT_UA } = {},
) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeout)
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': ua, accept: json ? 'application/json' : '*/*' },
      signal: ac.signal,
    })
    const body = await res.text()
    if (res.status === 429 && retry > 0) {
      await new Promise((r) => setTimeout(r, 3_000))
      return mediawikiGet(url, { json, timeout, retry: retry - 1, ua })
    }
    if (!res.ok) return { ok: false, status: res.status, body }
    return { ok: true, status: res.status, body, data: json ? JSON.parse(body) : null }
  } catch (e) {
    const cause = String(e.cause?.message ?? '')
    if (/Connect Timeout/i.test(cause) && retry > 0) {
      await new Promise((r) => setTimeout(r, 2_000))
      return mediawikiGet(url, { json, timeout, retry: retry - 1, ua })
    }
    return { ok: false, status: 0, error: `${e.message ?? e}${cause ? ` (${cause})` : ''}`, body: '' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * MediaWiki 무작위 표집 — **`rnlimit` 상한(50)을 넘겨 모은다.**
 *
 * 표본 수가 요청보다 적으면 같이 적은 오차 폭이 거짓이 되므로 채울 때까지 여러 번 부른다.
 * 전체 규모는 짐작하지 않는다 — `siteinfo` 가 스스로 말한다.
 */
export async function mediawikiRandom(api, n, opts = {}) {
  const seen = new Set()
  const items = []
  let total = null
  for (let round = 0; items.length < n && round < 12; round++) {
    const r = await mediawikiGet(
      `${api}?action=query&list=random&rnnamespace=0&rnlimit=${Math.min(n, 50)}` +
        `&meta=siteinfo&siprop=statistics&format=json`,
      { json: true, ...opts },
    )
    if (!r.ok) {
      if (items.length) break
      return { error: r.error ? `연결 실패 — ${r.error}` : `HTTP ${r.status}`, items: [] }
    }
    total ??= r.data?.query?.statistics?.articles ?? null
    for (const p of r.data?.query?.random ?? []) {
      if (seen.has(p.title)) continue
      seen.add(p.title)
      items.push({ id: p.title, title: p.title })
    }
    await new Promise((z) => setTimeout(z, 400))
  }
  return { total, items: items.slice(0, n) }
}

/** MediaWiki 도입부(`exintro`). 본문 전체가 아니라 **도입부가 곧 지문 단위**다. */
export async function mediawikiLead(api, title, opts = {}) {
  const r = await mediawikiGet(
    `${api}?action=query&prop=extracts&explaintext=1&exintro=1&titles=${encodeURIComponent(title)}&format=json`,
    { json: true, ...opts },
  )
  if (!r.ok) return { error: r.error ? `연결 실패 — ${r.error}` : `HTTP ${r.status}` }
  const pages = r.data?.query?.pages ?? {}
  const page = Object.values(pages)[0]
  return {
    body: (page?.extract ?? '').replace(/\s+/g, ' ').trim(),
    pageid: page?.pageid ?? null,
  }
}
