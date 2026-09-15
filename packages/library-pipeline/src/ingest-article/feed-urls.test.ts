// packages/library-pipeline/src/ingest-article/feed-urls.test.ts
//
// **피드 주소가 조용히 다른 것을 가리키게 되는 부류를 막는다.**
//
// ── 왜 (실측 2026-08-19) ─────────────────────────────────────────────
// The Conversation 피드 4개 중 **3개가 엉뚱한 주제를 가져오고 있었다.**
// 주소가 `topics/<슬러그>-<번호>` 형태인데 해소되는 것은 번호이고 슬러그는 장식이다.
// 그 번호의 주제명이 바뀌자 301 로 다른 곳에 도착했다:
//
//   topics/science-1391 → topics/molecular-biology-1391
//   topics/health-39    → topics/transport-39     (건강 라벨인데 교통)
//   topics/politics-127 → topics/nbn-127          (정치 라벨인데 광대역망)
//
// **아무 경보도 안 울렸다** — 기사는 계속 들어오고, 영어이고, 라이선스도 같고, 형식도 맞다.
// 틀린 것은 오직 "무엇에 관한 글인가" 뿐이라 자동 검사로는 안 잡히고 사람이 읽어야 보인다.
//
// 그래서 **형태를 금지한다.** 이름이 곧 주소인 섹션 경로만 쓰면, 그쪽이 바뀔 때는
// 404 로 드러나 프로브(`scripts/acp/feed-probe.mjs`)가 즉시 잡는다.
//
// ⚠️ 이 테스트는 네트워크를 타지 않는다. 주소가 **살아 있는지**가 아니라 **드리프트에
//   취약한 형태인지**를 본다. 살아 있는지는 프로브가 실측으로 확인한다.

import { describe, expect, it } from 'vitest'

import { THE_CONVERSATION_FEEDS } from './the-conversation'
import { VOA_FEEDS } from './voa'

/** `…/topics/<슬러그>-<번호>/…` — 번호가 정본이고 슬러그가 장식인 형태. */
const NUMBERED_TOPIC = /\/topics\/[a-z0-9-]+-\d+\//i

describe('피드 주소 — 조용한 주제 드리프트 차단', () => {
  it('The Conversation 은 번호가 박힌 topics 주소를 쓰지 않는다', () => {
    const bad = THE_CONVERSATION_FEEDS.filter((f) => NUMBERED_TOPIC.test(f.url))
    // 실패 메시지에 이유가 담겨야 한다 — 다음 사람이 "왜 안 되지" 로 시간을 쓰지 않도록.
    expect(
      bad.map((f) => `${f.id}: ${f.url}`),
      '번호 토픽 주소는 그 번호의 주제명이 바뀌면 조용히 다른 주제가 된다. ' +
        '섹션 경로(/us/<이름>/articles.atom)를 쓸 것.',
    ).toEqual([])
  })

  it('The Conversation 피드는 전부 섹션 경로 형태다', () => {
    for (const f of THE_CONVERSATION_FEEDS) {
      // 전체 피드(`/articles.atom`)만 예외 — 섹션이 없는 최상위다.
      const ok =
        f.url === 'https://theconversation.com/articles.atom' ||
        /^https:\/\/theconversation\.com\/(us|ca|uk|au)\/[a-z-]+\/articles\.atom$/.test(f.url)
      expect(ok, `${f.id} 의 주소 형태가 낯설다: ${f.url}`).toBe(true)
    }
  })

  it('VOA 는 z-코드가 곧 RSS 라 zoneid 를 쓴다 — 스크래핑 경로가 필요 없다', () => {
    for (const f of VOA_FEEDS) {
      expect(f.url, `${f.id}`).toMatch(
        /^https:\/\/learningenglish\.voanews\.com\/rss\/\?count=\d+&zoneid=\d+$/,
      )
    }
  })

  it('피드 id 가 겹치지 않는다 — 겹치면 FEED_REGISTER 매핑이 조용히 덮인다', () => {
    for (const feeds of [VOA_FEEDS, THE_CONVERSATION_FEEDS]) {
      const ids = feeds.map((f) => f.id)
      expect(new Set(ids).size, ids.join(' · ')).toBe(ids.length)
    }
  })

  it('사건·정치 전용 피드를 배선하지 않는다 — 이 서비스가 일부러 피하는 소재다', () => {
    const politics = THE_CONVERSATION_FEEDS.filter((f) => /politic/i.test(f.id))
    expect(politics).toEqual([])
  })
})
