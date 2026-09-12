// packages/library-pipeline/src/ingest-article/noaa-body-selection.test.ts
//
// **본문 후보 중 무엇을 고르는가 — 길이가 아니라 산문 양이다.**
//
// ── 왜 이 테스트가 있는가 (실측 2026-08-30) ─────────────────────────
// 목록 페이지네이션을 열어 NOAA 지문 211편을 발견했는데 적재된 것은 **25편**이었다.
// 나머지는 전부 `NOAA body too short: 0 words` 였다. HTML 에는 본문이 멀쩡히 있었다.
//
// 원인은 본문 후보를 고르는 휴리스틱이었다. climate.gov 의 모든 기사에는
// `field--name-body` 클래스를 단 **11,345자짜리 공통 보일러플레이트 div** 가 있고
// 그 안에는 산문이 한 글자도 없다. 그런데 코드는 **가장 긴 HTML 조각**을 본문으로 골랐다:
//
//   understanding-cop                 [11345, 8343, 361] → 최장 = 껍데기 → 0 words → 버려짐
//   climate-change-global-temperature [11345, 21113, 361] → 최장 = 본문   → 1,579 words → 통과
//
// 즉 **본문이 껍데기보다 짧은 기사만 조용히 실패했다.** 같은 코드가 어떤 기사는 되고
// 어떤 기사는 안 되니 "일부 페이지가 이상하다" 로 보이지, 선택 규칙이 틀렸다고는 안 보인다.
// 고친 뒤 실측: understanding-cop 0 → 644 words · global-climate-summary-january-2024 0 → 746.
//
// 길이 휴리스틱은 되돌리기 쉬운 종류라(“가장 큰 게 본문이겠지”) 테스트로 못 박는다.

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ingestNoaaArticle } from './noaa'

const URL_ = 'https://www.climate.gov/news-features/understanding-climate/understanding-cop'

/** 산문 없는 껍데기 — 실제 climate.gov 의 공통 div 를 성격만 본떴다(마크업만 길다). */
function boilerplate(padTo: number): string {
  const cell = '<div class="wrap"><span class="icon"></span><a href="/x"></a></div>'
  return `<div class="clearfix text-formatted field field--name-body field--type-text-with-summary">${cell.repeat(
    Math.ceil(padTo / cell.length),
  )}</div>`
}

/** 진짜 본문 — 마크업은 짧지만 산문이 있다. 200 단어 게이트를 넘겨야 한다. */
function proseBody(words: number): string {
  const sentence = 'The conference brings governments together to review progress on climate commitments. '
  const reps = Math.ceil(words / sentence.trim().split(/\s+/).length)
  return `<div class="clearfix text-formatted field field--name-body"><p>${sentence.repeat(reps)}</p></div>`
}

function stubPage(html: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, text: async () => html })),
  )
}

const HEAD = '<meta property="og:title" content="Understanding COP" />'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('NOAA 본문 선택', () => {
  it('마크업이 더 긴 껍데기가 있어도 산문이 있는 쪽을 고른다', async () => {
    // 껍데기가 본문보다 2배 이상 길다 — 예전 규칙(최장 HTML)이면 여기서 0 words 가 났다.
    stubPage(`${HEAD}${boilerplate(24_000)}${proseBody(260)}`)
    const article = await ingestNoaaArticle(URL_)
    expect(article.content).toContain('climate commitments')
    expect(article.content.trim().split(/\s+/).length).toBeGreaterThan(200)
  })

  it('본문이 앞에 오든 뒤에 오든 결과가 같다 — 순서에 기대지 않는다', async () => {
    stubPage(`${HEAD}${proseBody(260)}${boilerplate(24_000)}`)
    const article = await ingestNoaaArticle(URL_)
    expect(article.content.trim().split(/\s+/).length).toBeGreaterThan(200)
  })

  it('진짜로 짧은 기사는 여전히 거절한다 — 0 words 오탐을 고치되 게이트는 유지', async () => {
    stubPage(`${HEAD}${boilerplate(24_000)}${proseBody(30)}`)
    // 38 words 짜리 월간 요약이 실제로 있었다. 그건 거절이 맞다.
    await expect(ingestNoaaArticle(URL_)).rejects.toThrow(/body too short/)
  })

  it('거절 메시지가 실제 단어 수를 말한다 — 항상 0 이면 원인을 못 찾는다', async () => {
    stubPage(`${HEAD}${boilerplate(24_000)}${proseBody(30)}`)
    await expect(ingestNoaaArticle(URL_)).rejects.toThrow(/too short: (?!0 words)\d+ words/)
  })
})
