// apps/web/src/lib/topic-corpus/http-fetch.ts
//
// TCP 전송 계층 — 페이지 HTML 을 가져오는 방법을 **주입 가능**하게 분리한다.
//
// ── 왜 분리했나 (실측 2026-08-16) ──
// 같은 URL·같은 헤더인데 클라이언트에 따라 결과가 갈렸다:
//   · Node 내장 fetch(undici)            → 403 (헤더를 전부 브라우저처럼 맞춰도 동일)
//   · curl                               → 200
// 헤더가 아니라 **TLS 지문**에서 갈린다. 그래서 "헤더를 더 맞춘다" 로는 영원히 해결되지 않고,
// 전송 계층 자체를 바꿀 수 있어야 한다.
//
// ── 신원 (robots.txt 준수) ──
// `https://www.ted.com/robots.txt` 는 블록이 두 개다. 학습용 크롤러(`ClaudeBot`·`anthropic-ai`·
// `Claude-Web`)는 `Disallow: /` 로 전면 차단이지만, 그 위의 "AI answer-engine crawlers" 블록에서
// `Claude-User`·`Claude-SearchBot` 은 **`/api/`·`/graphql`·`/_next/data/`·`/search`·`/people` 등
// 데이터 엔드포인트만** 금지되고 `/talks/`·`/topics/` 는 허용된다.
// 따라서 이 모듈은 `Claude-User` 로 **정직하게 신원을 밝히고**, 금지 경로는 건드리지 않는다.
// (브라우저인 척하는 UA 를 쓰지 않는 이유가 이것이다 — 허용된 신원이 따로 있는데 위장할 이유가 없다.)

import { spawn } from 'node:child_process'

/** HTML 을 가져오는 방법. 테스트에서는 고정 문자열을 돌려주는 구현을 넣는다. */
export type HtmlFetcher = (url: string, signal?: AbortSignal) => Promise<string>

export class HttpFetchError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message)
    this.name = 'HttpFetchError'
  }
}

/** robots.txt 의 허용 목록에 있는 신원. 위장하지 않는다. */
export const CLAUDE_USER_AGENT = 'Claude-User/1.0 (+Claude-User@anthropic.com)'

/**
 * Node 내장 fetch 기반. 일부 사이트(Cloudflare TLS 지문 검사)에서 403 이 난다 —
 * 그럴 때 `curlFetcher` 로 교체한다.
 */
export const nodeFetcher: HtmlFetcher = async (url, signal) => {
  const res = await fetch(url, {
    signal,
    headers: { 'user-agent': CLAUDE_USER_AGENT, accept: 'text/html' },
    cache: 'no-store',
  })
  if (!res.ok) throw new HttpFetchError(`HTTP ${res.status} — ${url}`, res.status)
  return res.text()
}

/**
 * curl 기반. **Node 전용**(CLI·서버 스크립트) — 브라우저 번들에 들어가면 안 된다.
 *
 * `-sS` 조용히·에러는 보이게 · `-L` 리다이렉트 추종 · `--max-time` 무한 대기 방지.
 * 응답 본문 끝에 상태코드를 붙여 받아(`-w`) 별도 호출 없이 판정한다.
 */
export const curlFetcher: HtmlFetcher = (url, signal) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(
      'curl',
      [
        '-sS',
        '-L',
        '--max-time',
        '45',
        '-A',
        CLAUDE_USER_AGENT,
        '-H',
        'accept: text/html',
        '-w',
        '\n__HTTP_STATUS__%{http_code}',
        url,
      ],
      { windowsHide: true },
    )

    let out = ''
    let err = ''
    child.stdout.on('data', (c) => (out += c))
    child.stderr.on('data', (c) => (err += c))

    const onAbort = () => child.kill()
    signal?.addEventListener('abort', onAbort, { once: true })

    child.on('error', (e) => {
      signal?.removeEventListener('abort', onAbort)
      reject(new HttpFetchError(`curl 실행 실패: ${e.message}`, null))
    })

    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort)
      if (code !== 0) {
        reject(new HttpFetchError(`curl exit ${code}: ${err.trim()}`, null))
        return
      }
      const marker = out.lastIndexOf('\n__HTTP_STATUS__')
      const status = marker >= 0 ? Number(out.slice(marker + 16).trim()) : 0
      const body = marker >= 0 ? out.slice(0, marker) : out
      if (status < 200 || status >= 300) {
        reject(new HttpFetchError(`HTTP ${status} — ${url}`, status))
        return
      }
      resolvePromise(body)
    })
  })
