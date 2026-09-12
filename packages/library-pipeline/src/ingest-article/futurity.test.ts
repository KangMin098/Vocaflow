// packages/library-pipeline/src/ingest-article/futurity.test.ts
//
// **지문에 사이트 크롬이 섞이지 않는지 고정한다.**
//
// ── 왜 (실측 2026-08-21) ─────────────────────────────────────────────
// 크롬이 섞이면 **아무 에러도 안 난다.** 기사는 들어오고, 영어이고, 라이선스도 맞고,
// 어수도 규격 안이다. 틀리는 것은 딱 하나 — 문항 생성기가 크롬을 **문단으로 센다.**
//   머리에 남으면 "Topic · Tags · <태그들>" 이 첫 문단이 되고,
//   꼬리에 남으면 관련기사 제목이 마지막 문단이 된다.
// 그러면 순서·삽입 문항의 정답 위치가 조용히 한 칸씩 밀린다. 사람이 지문을 읽기 전에는
// 안 보인다.
//
// 이 파일을 만드는 동안 실제로 두 번 틀렸다:
//   ① 라이선스 문장만 경계로 삼아 머리 크롬(Topic/Tags/University)을 남겼다.
//   ② 블록 단위로만 꼬리를 떼려다, "Source: …\nOriginal Study\n DOI: …" 가 **한 블록**이고
//      관련기사가 그 뒤 별도 블록이라 관련기사 제목을 본문에 남겼다.
// 두 번 다 어수·문단 수만 보고 있었으면 못 잡았다 — 그래서 **표식 부재**를 잰다.
//
// 네트워크를 타지 않는다. 실측한 페이지 구조를 고정 표본으로 넣고 그것만 본다.

import { describe, expect, it } from 'vitest'

import { FUTURITY_FEEDS, stripFuturityChrome } from './futurity'
import { resolveArticleRegister, SOURCE_SPECS, licenseClassOf } from './_curation-spec'

/**
 * `htmlToPlainText` 를 거친 뒤의 실제 모양(2026-08-21 실측 축약).
 * 머리 크롬 → 본문 → 꼬리 크롬 순서와 **줄바꿈 개수**까지 실물과 같게 둔다 —
 * 꼬리가 단일 개행으로 붙어 있는 것이 ②를 만든 원인이었다.
 */
const SAMPLE = [
  'Childfree people are more common in some states than others',
  '',
  'August 20th, 2026',
  '',
  'Posted by Michigan State University',
  '',
  'Share this Article',
  '',
  'Facebook Twitter Reddit Email',
  '',
  'You are free to share this article under the Attribution 4.0 International license.',
  '',
  'Topic',
  '',
  ' -->',
  '',
  '-->',
  '',
  ' Tags',
  '',
  ' families',
  '',
  ' University',
  '',
  ' Michigan State University',
  '',
  'Researchers have found that childfree people are more common in some states than others.',
  '',
  '“We’ve known that childfree adults were a large and growing group,” says Zachary Neal.',
  '',
  'The team analyzed survey data across several states to see where the pattern held.',
  '',
  'Source: Michigan State University',
  'Original Study',
  ' DOI: 10.1371/journal.pone.0352872',
  '',
  'Related',
  '',
  'No, really: 50-60M American adults may be childfree',
  '',
  'Why are more women choosing not to have kids?',
].join('\n')

/**
 * 지문에 남으면 안 되는 것들.
 *
 * 처음엔 `stripFuturityChrome` 을 테스트 안에 **재구현**해 놓고 검사했는데,
 * 그러면 impl 을 고쳐도 테스트는 옛 규칙을 통과시킨다 — 실제로 비율 휴리스틱을
 * 고치는 동안 둘이 갈라졌다. 그래서 함수를 export 해 **같은 코드**를 검사한다.
 */
const CHROME_MARKS = [
  /\bShare this Article\b/i,
  /\bPosted by\b/i,
  /free to share this article/i,
  /^\s*Topic\s*$/m,
  /^\s*Tags\s*$/m,
  /^\s*University\s*$/m,
  /\bSource:\s/i,
  /\bOriginal Study\b/i,
  /^\s*Related\s*$/m,
]

describe('Futurity 본문 추출 — 크롬이 문단으로 세어지지 않는다', () => {
  const body = stripFuturityChrome(SAMPLE)

  it.each(CHROME_MARKS.map((re) => [String(re), re] as const))(
    '지문에 %s 가 남지 않는다',
    (_label, re) => {
      expect(re.test(body), `남은 지문:\n${body}`).toBe(false)
    },
  )

  it('본문 첫 문장부터 시작한다', () => {
    expect(body.startsWith('Researchers have found')).toBe(true)
  })

  it('본문 문단을 잃지 않는다 — 크롬을 떼다 본문까지 자르면 더 나쁘다', () => {
    const paras = body.split(/\n{2,}/).filter(Boolean)
    expect(paras).toHaveLength(3)
    expect(paras[2]).toMatch(/analyzed survey data/)
  })
})

describe('Futurity 배선', () => {
  it('피드가 하나 이상 있고 주소가 futurity.org 다', () => {
    expect(FUTURITY_FEEDS.length).toBeGreaterThan(0)
    for (const f of FUTURITY_FEEDS) expect(f.url).toMatch(/^https:\/\/www\.futurity\.org\//)
  })

  it('설명문으로 태깅된다 — 연구 소개는 주장하는 글이 아니다', () => {
    expect(resolveArticleRegister('futurity', 'all')).toBe('expository')
  })

  it('CC BY 로 등록돼 있다 — 이 값이 흔들리면 문항화 가능 여부가 뒤집힌다', () => {
    // 근거는 **기사 페이지**의 "free to share … Attribution 4.0 International license".
    // about 페이지에는 "All rights reserved"(사이트 크롬)가 있어 그것을 보면 틀린다.
    expect(licenseClassOf(SOURCE_SPECS.futurity.license)).toBe('cc_by')
  })
})
