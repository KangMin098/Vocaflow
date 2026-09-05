// scripts/lib/supabase-client.mjs
//
// **물러설 줄 아는 Supabase 클라이언트.** 스크립트는 이걸로 만든다.
//
// ── 무슨 일이 있었나 (실측 2026-09-05) ───────────────────────────────
// 적재는 됐는데 처리가 "처리 대상 0건" 으로 조용히 끝났다. DB 에는 152편이 `queued` 였다.
// `error` 를 던지게 고치니 `TypeError: fetch failed` 가 나왔고, 파고드니 원인은
// **우리 쪽이 아니라 프로젝트였다**:
//
//   · 관리 API 가 보고한 상태 = `RESTARTING`
//   · Cloudflare **522**(오리진 응답 없음) — 07:00 창에서 요청 60건 중 **58건이 5xx**
//   · `postgrest_logs` 에 `Warp server error: Thread killed by timeout manager` 가 내내
//
// 그리고 그 포화는 **우리가 만든 것**이다. 7시간 동안 한 행씩 보낸 쓰기가 198,188건:
//
//     PATCH library_articles         142,986건 / 서로 다른 행 42,886 (행당 3.3 = 상태 3전이)
//     PATCH library_book_vocabularies 55,202건 / 서로 다른 행 55,163 (행당 1.0)
//
// 되풀이 루프가 아니라 **정상 작업의 양**이었다. 무료 등급 PostgREST 가 그 양을 못 견뎠다.
//
// ⚠️ **"node 의 fetch 가 고장" 이 아니다.** 재시작이 끝난 뒤 같은 머신·같은 클라이언트로
//   8/8 성공했다(69~418ms). 클라이언트가 고장이었다면 지금도 실패해야 한다.
//   `csat/lib-curl-fetch.mjs` 는 같은 증상을 클라이언트 탓으로 보고 요청마다 curl 프로세스를
//   띄우는데, 원인이 오리진 포화라면 **그건 부하를 늘리는 쪽**이다. 옵트인(`--curl`)이라
//   지우지 않았지만, 기본으로 쓸 것은 이쪽이다.
//
// ── 그래서 무엇을 하는가 ─────────────────────────────────────────────
// 1. 5xx·연결 실패에 **지수 백오프로 물러선다** — 다시 두드리는 것이 아니라 쉰다.
// 2. 다 쓰고도 안 되면 **진짜 이유를 담아 던진다** — 조용한 0건을 만들지 않는다.
// 3. **POST 는 재시도하지 않는다** (아래 §멱등성).
//
// ── §멱등성 — 아무거나 다시 보내면 안 된다 ───────────────────────────
// 522 는 "Cloudflare 가 오리진을 기다리다 끊었다" 는 뜻이지 **"안 들어갔다" 가 아니다.**
// 오리진은 쓰기를 끝냈는데 응답만 늦었을 수 있다. 그래서:
//
//     GET · HEAD          다시 보내도 같다              → 재시도
//     PATCH(id=eq.) · PUT 같은 값을 다시 쓸 뿐이다      → 재시도
//     DELETE              이미 지워졌으면 0행이다       → 재시도
//     **POST**            **다시 보내면 두 번 들어간다** → **재시도 안 한다**
//
// 적재 스크립트가 POST 로 넣다 실패하면 그대로 올라온다. 그 편이 낫다 —
// 중복 적재는 조용하고, 실패는 눈에 보인다.

import { createClient } from '@supabase/supabase-js'

/** 물러설 값어치가 있는 응답. 4xx 는 다시 보내도 같으므로 넣지 않는다(429만 예외). */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504, 520, 521, 522, 523, 524])
/** 다시 보내도 같은 뜻인 메서드. POST 가 없는 이유는 §멱등성. */
const IDEMPOTENT = new Set(['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE'])

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * @param {object} opts
 * @param {number} [opts.retries]  물러서는 횟수 (기본 5 → 최대 약 31초)
 * @param {number} [opts.baseMs]   첫 대기 (기본 1000ms, 이후 2배씩)
 * @param {(info: {attempt:number, wait:number, why:string, url:string}) => void} [opts.onRetry]
 */
export function retryingFetch({ retries = 5, baseMs = 1_000, onRetry } = {}) {
  return async function fetchWithBackoff(url, init = {}) {
    const method = String(init.method ?? 'GET').toUpperCase()
    const canRetry = IDEMPOTENT.has(method)
    let lastWhy = ''

    for (let attempt = 0; ; attempt++) {
      let res = null
      try {
        res = await fetch(url, init)
        if (!RETRYABLE_STATUS.has(res.status)) return res
        lastWhy = `HTTP ${res.status}`
      } catch (e) {
        // 연결 자체가 안 된 것. 원인 사슬까지 담는다 — `fetch failed` 만으로는 아무것도 모른다.
        lastWhy = `${e.message}${e.cause?.message ? ` (${e.cause.message})` : ''}`
      }

      // POST 는 여기서 끝낸다 — 오리진이 이미 썼을 수 있다.
      if (!canRetry) {
        if (res) return res
        throw new Error(`${method} ${url} — ${lastWhy} (POST 는 재시도하지 않는다: 중복 적재 방지)`)
      }
      if (attempt >= retries) {
        if (res) return res // 5xx 본문을 그대로 올려 보낸다 — 호출부가 상태를 보고 판단한다
        throw new Error(`${method} ${url} — ${retries + 1}번 시도했으나 실패: ${lastWhy}`)
      }

      const wait = baseMs * 2 ** attempt
      onRetry?.({ attempt: attempt + 1, wait, why: lastWhy, url: String(url) })
      await sleep(wait)
    }
  }
}

/**
 * 스크립트용 서비스롤 클라이언트. 자격은 `loadSupabaseEnv` 규칙(환경변수 우선)을 따른다.
 *
 * 물러설 때는 **조용히 하지 않는다** — 몇 초 멈춘 이유가 안 보이면
 * "느리네" 로 읽히고, 그러면 부하를 더 얹는다.
 */
export function createScriptClient({ url, key, retries, baseMs, quiet = false } = {}) {
  const resolvedUrl = url ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const resolvedKey = key ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!resolvedUrl || !resolvedKey) {
    throw new Error(
      '자격이 없다: ' +
        [!resolvedUrl && 'NEXT_PUBLIC_SUPABASE_URL', !resolvedKey && 'SUPABASE_SERVICE_ROLE_KEY']
          .filter(Boolean)
          .join(' · ')
    )
  }
  return createClient(resolvedUrl, resolvedKey, {
    auth: { persistSession: false },
    global: {
      fetch: retryingFetch({
        retries,
        baseMs,
        onRetry: quiet
          ? undefined
          : ({ attempt, wait, why }) =>
              console.log(
                `  … DB 가 응답하지 않는다 (${why}) — ${wait / 1000}초 쉬고 ${attempt}번째 재시도`
              ),
      }),
    },
  })
}
