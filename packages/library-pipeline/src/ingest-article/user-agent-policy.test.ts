// packages/library-pipeline/src/ingest-article/user-agent-policy.test.ts
//
// **Wikimedia 에 브라우저를 사칭해서 요청하지 않는다.**
//
// ── 왜 이 테스트가 있는가 (실측 2026-08-30) ─────────────────────────
// 수능 지문용 원문을 대량 확보하려고 카테고리를 여러 페이지 걷기 시작하자마자
// 위키백과 요청이 **전부 429** 로 막혔다. 같은 순간 손으로 친 요청은 200 에 60건을 줬다.
// 차이는 딱 하나였다:
//
//   Chrome 위장 UA            → 429
//   'Vocaflow/1.0 (probe)'   → 200
//
// Wikimedia 의 UA 정책은 API 클라이언트에 **식별 가능한 이름과 연락처**를 요구하고,
// 브라우저를 사칭하는 UA 를 봇으로 보고 공격적으로 스로틀한다.
// 즉 속도 문제가 아니라 **신원 문제**였다 — 간격만 늘렸으면 영영 못 고쳤을 종류다.
//
// 이 실패도 조용하다. 429 는 "목록을 못 가져왔다" 한 줄로 지나가고, 그 피드는 그냥
// 0건이 된다. 그래서 UA 를 **테스트로 못 박는다** — 누가 헤더를 정리하다 되돌리면 여기서 걸린다.

import { describe, expect, it } from 'vitest'

import { userAgentFor } from './_helpers'

const WIKIMEDIA_URLS = [
  'https://en.wikipedia.org/w/api.php?action=query',
  'https://simple.wikipedia.org/w/api.php',
  'https://en.wikivoyage.org/w/api.php',
  'https://en.wikisource.org/wiki/Main_Page',
  'https://en.wikibooks.org/w/api.php',
  'https://en.wikinews.org/w/api.php',
]

describe('User-Agent 정책', () => {
  it.each(WIKIMEDIA_URLS)('Wikimedia 호스트에는 사칭 UA 를 보내지 않는다 — %s', (url) => {
    const ua = userAgentFor(url)
    expect(ua).not.toMatch(/Mozilla|Chrome|Safari|AppleWebKit/)
  })

  it('Wikimedia UA 는 이름과 연락처를 담는다 (정책 요구사항)', () => {
    const ua = userAgentFor('https://en.wikipedia.org/w/api.php')
    expect(ua).toContain('Vocaflow')
    // 연락 수단이 없으면 정책상 차단 대상이다. @ 또는 URL 중 하나는 반드시 있어야 한다.
    expect(ua).toMatch(/@|https?:\/\//)
  })

  it('Wikimedia 가 아닌 곳은 기존 UA 그대로 — 이 변경의 영향 범위를 가둔다', () => {
    for (const url of [
      'https://www.voanews.com/api/rss',
      'https://theconversation.com/articles.atom',
      'https://journals.plos.org/plosone/feed/atom',
    ]) {
      expect(userAgentFor(url)).toMatch(/Mozilla/)
    }
  })

  it('URL 이 아닌 문자열에도 던지지 않는다', () => {
    expect(() => userAgentFor('not a url')).not.toThrow()
    expect(userAgentFor('not a url')).toMatch(/Mozilla/)
  })

  it('비슷한 이름의 남의 도메인을 Wikimedia 로 착각하지 않는다', () => {
    // 접미사 매칭이 느슨하면 wikipedia.org.evil.com 까지 걸린다.
    expect(userAgentFor('https://wikipedia.org.example.com/x')).toMatch(/Mozilla/)
    expect(userAgentFor('https://notwikipedia.org/x')).toMatch(/Mozilla/)
  })
})
