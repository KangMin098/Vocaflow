// apps/web/src/lib/topic-corpus/__tests__/topic-corpus.test.ts
//
// TCP 회귀 — 이 파이프라인이 조용히 깨질 수 있는 세 지점을 잠근다.
//
//  ①  원문 미저장 계약 — 수확 결과에 본문이 실려 나가면 라이선스 판단이 무너진다.
//  ②  페이징 착각      — 주제 페이지는 `?page=N` 으로 페이징되지 않는다(실측). 그래서
//                        "찾은 편수 vs 총 편수" 격차를 반드시 노출해야 한다.
//  ③  빈도 집계        — counts 는 words 와 같은 집합이어야 한다. 어긋나면 화면에 없는
//                        단어가 사전 통계에 쌓인다.

import { describe, expect, it } from 'vitest'

import { tokenizeText } from '@/lib/text-extract/tokenize'

import { detectBoilerplateLines, stripBoilerplate } from '../boilerplate'
import { contentHash } from '../harvest'
import { parseTedTopicHtml, talkUrlFromSlug } from '../ted-discover'
import {
  parseTedTranscriptHtml,
  TedTranscriptError,
  tedSlugFromUrl,
  toTranscriptUrl,
} from '../ted-transcript'

/** 실제 페이지 구조만 본뜬 최소 픽스처 — 본문은 테스트용으로 지어낸 문장이다. */
function nextDataHtml(payload: unknown): string {
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    payload,
  )}</script></body></html>`
}

const TRANSCRIPT_FIXTURE = nextDataHtml({
  props: {
    pageProps: {
      videoData: {
        slug: 'sample_talk',
        title: 'A Sample Talk',
        presenterDisplayName: 'Sample Speaker',
        publishedAt: '2020-01-02T03:04:05Z',
        topics: { nodes: [{ name: 'AI' }, { name: 'Technology' }] },
      },
      transcriptData: {
        translation: {
          paragraphs: [
            {
              cues: [
                { text: 'Algorithms reshape how societies allocate attention.' },
                { text: "They don't decide alone; incentives decide with them." },
              ],
            },
            {
              cues: [
                {
                  text: 'Consider a pre-industrial village and a hyper-connected metropolis, and CO2 budgets alike.',
                },
                {
                  text: 'Measurement without interpretation is noise, and interpretation without measurement is opinion.',
                },
                {
                  text: 'The instruments we build quietly decide which questions remain askable at all.',
                },
                {
                  text: 'So we should ask what our tools make cheap, and what they make invisible.',
                },
              ],
            },
          ],
        },
      },
    },
  },
})

describe('TED 자막 파싱', () => {
  it('cue 를 이어 붙이고 메타데이터를 뽑는다', () => {
    const t = parseTedTranscriptHtml(TRANSCRIPT_FIXTURE, 'https://www.ted.com/talks/sample_talk/transcript')
    expect(t.externalId).toBe('sample_talk')
    expect(t.title).toBe('A Sample Talk')
    expect(t.speaker).toBe('Sample Speaker')
    expect(t.tedTopics).toEqual(['AI', 'Technology'])
    // cue 경계에 공백이 들어가야 한다 — 붙이면 'attention.They' 같은 유령 단어가 생긴다.
    expect(t.text).toContain('attention. They')
  })

  it('__NEXT_DATA__ 가 없으면 조용히 0건이 아니라 에러를 낸다', () => {
    // 셀렉터가 깨졌는데 성공으로 보고하면 큐는 done 이 되고 통계는 안 쌓인다 — 최악의 실패.
    expect(() => parseTedTranscriptHtml('<html></html>', 'u')).toThrow(TedTranscriptError)
  })

  it('자막이 비어 있으면 에러', () => {
    const empty = nextDataHtml({
      props: { pageProps: { videoData: { slug: 'x' }, transcriptData: { translation: { paragraphs: [] } } } },
    })
    expect(() => parseTedTranscriptHtml(empty, 'u')).toThrow(/자막 없음/)
  })

  it('URL 헬퍼', () => {
    expect(toTranscriptUrl('https://www.ted.com/talks/abc')).toBe('https://www.ted.com/talks/abc/transcript')
    expect(toTranscriptUrl('https://www.ted.com/talks/abc/transcript')).toBe(
      'https://www.ted.com/talks/abc/transcript',
    )
    expect(tedSlugFromUrl('https://www.ted.com/talks/abc?x=1')).toBe('abc')
    expect(talkUrlFromSlug('abc')).toBe('https://www.ted.com/talks/abc')
  })
})

describe('주제 발견 — 커버리지를 숨기지 않는다', () => {
  const topicHtml = nextDataHtml({
    props: {
      pageProps: {
        talksTotalCount: 343,
        talks: [
          { slug: 'a', title: 'A', canonicalUrl: 'https://www.ted.com/talks/a' },
          { slug: 'b', title: 'B' },
          { slug: 'a', title: 'dup' },
        ],
      },
    },
  })

  it('중복 slug 를 접고 총 편수와의 격차를 돌려준다', () => {
    const r = parseTedTopicHtml(topicHtml, 'ai')
    expect(r.talks.map((t) => t.externalId)).toEqual(['a', 'b'])
    expect(r.talks[1]!.url).toBe('https://www.ted.com/talks/b')
    expect(r.totalCount).toBe(343)
    // 이 값이 0 으로 보고되면 운영자는 전량을 모았다고 믿는다. 실측상 주제 페이지는
    // 16편만 노출하므로 격차는 항상 크게 남는다.
    expect(r.coverageGap).toBe(341)
  })
})

describe('토큰화 빈도 — words 와 counts 는 같은 집합', () => {
  const sample =
    'Language shapes thought. Language shapes memory, and memory shapes language again.'

  it('counts 의 키가 words 와 정확히 일치한다', () => {
    const r = tokenizeText(sample)
    expect(Object.keys(r.counts).sort()).toEqual([...r.words].sort())
  })

  it('반복 등장을 센다', () => {
    const r = tokenizeText(sample)
    expect(r.counts.language).toBe(3)
    expect(r.counts.shapes).toBe(3)
    expect(r.counts.memory).toBe(2)
    expect(r.counts.thought).toBe(1)
  })

  it('빈 입력도 counts 를 돌려준다', () => {
    expect(tokenizeText('').counts).toEqual({})
  })

  it('축약형·결합접두사 처리가 빈도에도 그대로 반영된다', () => {
    const t = parseTedTranscriptHtml(TRANSCRIPT_FIXTURE, 'u')
    const r = tokenizeText(t.text)
    // "don't" → do. 'do' 자체는 stopword 라 최종 목록에서 빠지는 것이 정상이고,
    // 여기서 잠그는 것은 **파편 'don' 이 만들어지지 않는다**는 쪽이다 — 'don' 은 사전에
    // 실재하는 단어라서, 한번 새면 원문에 없던 단어를 학습자에게 가르치게 된다.
    expect(r.words).not.toContain('don')
    expect(Object.keys(r.counts)).not.toContain('don')
    // 결합형 접두사는 단독 후보로 올리지 않는다
    expect(r.words).not.toContain('pre')
    expect(r.words).not.toContain('hyper')
    expect(r.words).toContain('pre-industrial')
    // 숫자 결합 토큰은 통째로 제외 — 'co' 파편을 만들지 않는다
    expect(r.words).not.toContain('co')
  })
})

describe('상용구 제거 — 과하게 지우면 본문이 조용히 사라진다', () => {
  const footer = 'Cite this article and reuse our work freely.'
  const signoff = 'Subscribe to our newsletters for weekly highlights.'
  const docs = [
    `Malaria deaths fell sharply across the region.\n${footer}\n${signoff}`,
    `Diarrheal disease remains a leading cause of child mortality.\n${footer}\n${signoff}`,
    `Infectious disease burden shifted over two decades.\n${footer}\n${signoff}`,
    `Income growth tracked closely with life expectancy.\n${footer}\n${signoff}`,
  ]

  it('여러 문서에 그대로 반복되는 줄을 찾는다', () => {
    const bp = detectBoilerplateLines(docs)
    expect(bp.has(footer)).toBe(true)
    expect(bp.has(signoff)).toBe(true)
    // 본문 문장은 문서마다 다르므로 걸리지 않는다.
    expect(bp.size).toBe(2)
  })

  it('제거 후에도 본문은 남고 상용구 어휘만 사라진다', () => {
    const bp = detectBoilerplateLines(docs)
    const cleaned = stripBoilerplate(docs[0]!, bp)
    expect(cleaned).toContain('Malaria')
    expect(cleaned).not.toContain('Cite this article')
    const words = tokenizeText(cleaned).words
    expect(words).toContain('malaria')
    // 'cite'·'subscribe'·'newsletters' 가 주제 어휘로 승격되던 원인이 바로 이 줄들이었다.
    expect(words).not.toContain('cite')
    expect(words).not.toContain('subscribe')
  })

  it('문서가 3편 미만이면 아예 적용하지 않는다', () => {
    // 표본이 작으면 우연한 일치를 상용구로 오인한다 — 그 오인은 본문 삭제로 이어진다.
    expect(detectBoilerplateLines([docs[0]!, docs[1]!]).size).toBe(0)
  })

  it('모든 문서에 나오는 핵심 주제어는 지우지 않는다', () => {
    // NOAA 전 문서에 'temperature' 가 정당하게 등장한다. 단어 빈도로 상용구를 추정했다면
    // 이런 핵심어가 지워졌을 것이다 — 그래서 판정 단위를 **줄 완전 일치**로 잡았다.
    const noaa = [
      'Global temperature rose again this decade.',
      'Ocean temperature drives the carbon cycle.',
      'Surface temperature varies by hemisphere.',
      'Atmospheric temperature responds to greenhouse gases.',
    ]
    const bp = detectBoilerplateLines(noaa)
    expect(bp.size).toBe(0)
    expect(tokenizeText(stripBoilerplate(noaa[0]!, bp)).words).toContain('temperature')
  })

  it('상용구가 없으면 원문을 그대로 돌려준다', () => {
    const text = 'One line.\nAnother line.'
    expect(stripBoilerplate(text, new Set())).toBe(text)
  })
})

describe('원문 미저장 계약', () => {
  it('content hash 는 원문 없이 동일성을 판정한다', () => {
    expect(contentHash('Hello World')).toBe(contentHash('hello world'))
    expect(contentHash('a')).not.toBe(contentHash('b'))
    expect(contentHash('a')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('HarvestResult 타입에 본문 필드가 없다', async () => {
    // 타입만으로는 런타임에서 못 잡으므로 소스를 직접 읽어 잠근다.
    // 본문 컬럼/필드가 생기면 라이선스 판단을 다시 해야 하는 사안이라, 조용히 통과시키지 않는다.
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const src = await fs.readFile(
      path.join(process.cwd(), 'src/lib/topic-corpus/harvest.ts'),
      'utf8',
    )
    const iface = /export interface HarvestResult \{([\s\S]*?)\n\}/.exec(src)?.[1] ?? ''
    expect(iface.length).toBeGreaterThan(0)
    for (const banned of ['text:', 'content:', 'transcript:', 'body:']) {
      expect(iface).not.toContain(banned)
    }
  })
})
