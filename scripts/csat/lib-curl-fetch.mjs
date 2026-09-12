// scripts/csat/lib-curl-fetch.mjs
//
// **node 의 fetch 대신 curl 로 HTTP 를 낸다.**
//
// ── 왜 필요한가 (실측) ──────────────────────────────────────────────
// 이 환경에서 node 내장 fetch 가 `TypeError: fetch failed` 로 죽는데 **같은 순간
// curl 은 같은 주소에 정상 응답**한다. 두 번 겪었다(2026-09-05):
//   · Gutenberg 수확 — node fetch ECONNRESET / curl 200
//   · 게이트 적용 — node fetch 첫 요청부터 실패 / curl 401(정상 응답)
// 소켓 고갈도 아니었다(TIME_WAIT 4개). 네트워크가 아니라 **클라이언트 쪽 문제**다.
//
// 그래서 재시도를 아무리 붙여도 안 낫는다 — 같은 fetch 를 다시 부르기 때문이다.
// `createClient(url, key, { global: { fetch: curlFetch } })` 로 갈아 끼우면 낫는다.
//
// ⚠️ 성능은 내장 fetch 보다 나쁘다(요청마다 프로세스 하나). 연결이 멀쩡한 환경에서는
//   쓰지 말 것 — 여기서는 "느리지만 끝난다" 가 "빠르지만 안 끝난다" 보다 낫다.

import { execFile } from 'node:child_process'

const MARK = '\n__CURL_STATUS__'

function headerPairs(h) {
  if (!h) return []
  if (typeof h.entries === 'function') return [...h.entries()]
  return Object.entries(h)
}

export async function curlFetch(url, init = {}) {
  const args = ['-sS', '--max-time', '90', '--compressed', '-X', String(init.method ?? 'GET')]
  for (const [k, v] of headerPairs(init.headers)) args.push('-H', `${k}: ${v}`)
  const body = init.body == null ? null : typeof init.body === 'string' ? init.body : String(init.body)
  if (body != null) args.push('--data-binary', '@-')
  args.push('-w', `${MARK}%{http_code}`, String(url))

  const out = await new Promise((resolve, reject) => {
    const child = execFile(
      'curl',
      args,
      { maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout, stderr) => {
        if (err && !stdout) return reject(new Error(String(stderr || err.message).slice(0, 160)))
        resolve(stdout)
      },
    )
    if (body != null) {
      child.stdin.end(body)
    }
  })

  const i = out.lastIndexOf(MARK)
  if (i < 0) throw new Error('curl 응답에 상태 표시가 없다')
  const status = Number(out.slice(i + MARK.length).trim()) || 0
  // curl 이 요청 자체를 못 낸 경우 000 을 준다. Response 는 200~599 만 받으므로
  // 여기서 걸러 **무슨 일인지 알 수 있는 오류**로 바꾼다(안 그러면 RangeError 만 보인다).
  if (status < 200 || status > 599) {
    throw new Error(`curl 이 응답을 못 받았다(상태 ${status}) — URL 길이/타임아웃을 볼 것`)
  }
  const text = out.slice(0, i)
  // ⚠️ 204·205·304 는 **본문을 가질 수 없다** — 문자열을 주면 Response 생성자가 던진다.
  //   PostgREST 의 UPDATE 가 정확히 204 를 돌려주므로, 이걸 놓치면 읽기는 되는데
  //   쓰기만 전부 실패한다.
  const NO_BODY = status === 204 || status === 205 || status === 304
  // supabase-js 는 `res.text()` / `res.json()` / `res.status` / `res.headers.get` 만 쓴다.
  return new Response(NO_BODY ? null : text, {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
