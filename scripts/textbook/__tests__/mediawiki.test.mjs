// scripts/textbook/__tests__/mediawiki.test.mjs
//
// **MediaWiki 수확기 회귀 — 질의 한 글자와 공백 한 칸이 DB 에 남는다.**
//
// 여기서 조용히 갈라지면 화면에도 로그에도 아무것도 안 뜬다. 적재는 성공하고, 어수도 FK 도
// 정상으로 세어지고, 다만 지문 안에 `== Plot ==` 이 박히거나 절 표제가 앞 문장 뒤에 붙는다
// (`…lives in Ohio. Plot The film opens…`). **동작하는 오답**이라 사람이 본문을 읽기 전엔 모른다.
//
// 실측 근거 (2026-09-06 · 위키 계열 199편 전수):
//   · `== X ==` 가 든 글 — wikipedia 0 · wikivoyage 0 · **simple_wikipedia 35편/74개**
//     (74개 전수 확인 결과 전부 절 표제. 수식·코드 오탐 0)
//   · 줄바꿈이 아예 없는 글 — simple_wikipedia **59편(59.6%)**
//   · 표제가 앞 문장에 붙을 수 있는 자리 — 위키 3원천 합계 **941군데**
//
// 실행: npx vitest run scripts/textbook/__tests__/mediawiki.test.mjs
//   (`scripts/` 는 pnpm workspace 밖이라 `turbo run test` 가 안 집는다 —
//    `scripts/comic/pd/__tests__/*` 와 같은 조건이다.)

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  countWords,
  mediawikiExtractUrl,
  mediawikiLead,
  normalizeExtract,
  trimToWindow,
} from '../_mediawiki.mjs'

const API = 'https://simple.wikipedia.org/w/api.php'

describe('질의 — 정규 ingester 와 같은 모양으로 묻는다', () => {
  it('`exsectionformat=plain` 이 들어간다 (없으면 MediaWiki 기본값 `wiki` → `== Plot ==`)', () => {
    expect(mediawikiExtractUrl(API, 'Toy Story')).toContain('exsectionformat=plain')
  })

  it('전문 요청(intro:false)에도 붙는다 — 절 표제는 도입부가 아니라 본문에 있다', () => {
    const url = mediawikiExtractUrl(API, 'Toy Story', { intro: false })
    expect(url).toContain('exsectionformat=plain')
    expect(url).not.toContain('exintro')
  })

  it('도입부 요청에는 exintro 가 함께 붙는다', () => {
    expect(mediawikiExtractUrl(API, 'Toy Story', { intro: true })).toContain('&exintro=1')
  })

  it('평문 요청과 제목 인코딩은 그대로다 — 이번 변경이 다른 파라미터를 건드리지 않았다', () => {
    const url = mediawikiExtractUrl(API, 'Toy Story 2')
    expect(url).toContain('action=query')
    expect(url).toContain('prop=extracts')
    expect(url).toContain('explaintext=1')
    expect(url).toContain('format=json')
    expect(url).toContain(`&titles=${encodeURIComponent('Toy Story 2')}`)
  })

  it('정규 ingester 가 주는 추출 파라미터를 빠짐없이 준다', () => {
    // packages/library-pipeline/src/ingest-article/_mediawiki.ts 와 대조.
    // 그쪽이 더 주는 `prop=info&inprop=url`(원문 URL)은 여기선 안 쓴다 —
    // 적재기가 site base + 제목으로 URL 을 스스로 만든다.
    const url = mediawikiExtractUrl(API, 'X', { intro: false })
    for (const p of ['explaintext=1', 'exsectionformat=plain']) expect(url).toContain(p)
  })
})

describe('공백 정규화 — 줄바꿈은 살리고 가로 공백만 접는다', () => {
  it('절 표제가 앞 문장에 붙지 않는다 (이 회귀의 본체)', () => {
    const out = normalizeExtract('She lives in Ohio.\n\n\nPlot\n\nThe film opens at dawn.')
    expect(out).toBe('She lives in Ohio.\n\nPlot\n\nThe film opens at dawn.')
    expect(out).not.toContain('Ohio. Plot')
  })

  it('가로 공백·탭은 한 칸으로 접는다', () => {
    expect(normalizeExtract('a  \t b  c')).toBe('a b c')
  })

  it('줄 앞뒤에 남은 공백은 지우되 줄 자체는 남긴다', () => {
    expect(normalizeExtract('one line.   \n   next line.')).toBe('one line.\nnext line.')
  })

  it('빈 줄은 최대 하나로 접는다 — 문단 경계로 충분하다', () => {
    expect(normalizeExtract('a.\n\n\n\n\nb.')).toBe('a.\n\nb.')
  })

  it('CRLF 도 같은 결과가 된다 — 원천마다 줄끝이 달라도 한 모양으로 저장된다', () => {
    expect(normalizeExtract('a.\r\n\r\nHistory\r\n\r\nb.')).toBe('a.\n\nHistory\n\nb.')
  })

  it('홀로 선 CR 도 줄바꿈으로 센다 — 공백으로 접으면 표제가 다시 앞 문장에 붙는다', () => {
    expect(normalizeExtract('a.\r\rHistory\r\rb.')).toBe('a.\n\nHistory\n\nb.')
  })

  it('양끝은 잘라내고, 빈 입력·null 은 빈 문자열이다', () => {
    expect(normalizeExtract('\n\n  hi.  \n\n')).toBe('hi.')
    expect(normalizeExtract(null)).toBe('')
    expect(normalizeExtract(undefined)).toBe('')
  })

  it('`==` 를 지우지 않는다 — 그 규칙을 본문에 걸면 다른 원천에서 오탐이 난다', () => {
    // plos 250편 표본에서 `gene_biotype == 'snoRNA'`(비교 연산자)가 1건 걸렸다.
    // 고치는 자리는 **질의**(exsectionformat)이지 본문 세척이 아니다.
    const code = "We kept rows where gene_biotype == 'snoRNA' for the analysis."
    expect(normalizeExtract(code)).toBe(code)
  })

  it('개행을 살려도 어수는 그대로다 — 프로브가 잰 수율이 이 변경으로 흔들리지 않는다', () => {
    const raw = 'She lives in Ohio.\n\nPlot\n\nThe film opens at dawn.'
    expect(countWords(normalizeExtract(raw))).toBe(countWords(raw.replace(/\s+/g, ' ')))
  })
})

describe('창 자르기 — 문단 경계를 들고 간다', () => {
  // 적재되는 글의 대부분이 이 자르기를 거친다(전문을 받아 창만큼 뗀다).
  // 여기서 `' '` 로 다시 이으면 위의 정규화가 사실상 무효가 된다.
  const TEXT = 'Alpha beta gamma delta epsilon.\n\nPlot\n\nZeta eta theta iota kappa.'

  it('문장 사이의 빈 줄이 살아남는다 — 표제가 앞 문장에 안 붙는다', () => {
    const cut = trimToWindow(TEXT, 8, 20)
    expect(cut).toBe('Alpha beta gamma delta epsilon.\n\nPlot\n\nZeta eta theta iota kappa.')
    expect(cut).not.toContain('epsilon. Plot')
  })

  it('최소치를 넘기면 거기서 멈춘다 — 길수록 좋은 것이 아니다', () => {
    expect(trimToWindow(TEXT, 5, 20)).toBe('Alpha beta gamma delta epsilon.')
  })

  it('창을 못 채우면 null — 없는 문장을 만들지 않는다', () => {
    expect(trimToWindow(TEXT, 30, 40)).toBeNull()
  })

  it('한 문장이 이미 창을 넘으면 null', () => {
    expect(trimToWindow('one two three four five six seven.', 2, 4)).toBeNull()
  })

  it('한 줄짜리 글은 예전과 똑같이 한 칸 공백으로 이어진다', () => {
    expect(trimToWindow('A b c d e. F g h i j. K l m n o.', 8, 12)).toBe('A b c d e. F g h i j.')
  })

  it('빈 입력·null 은 null', () => {
    expect(trimToWindow('', 1, 10)).toBeNull()
    expect(trimToWindow(null, 1, 10)).toBeNull()
  })
})

describe('mediawikiLead 배선 — 질의와 정규화가 실제로 연결돼 있다', () => {
  // 위의 두 검사가 다 통과해도 `mediawikiLead` 가 그 둘을 안 쓰면 DB 에는 예전 값이 들어간다.
  // 그래서 fetch 를 세워 두고 **실제로 나가는 URL 과 실제로 나오는 body** 를 본다(네트워크 없음).
  afterEach(() => vi.unstubAllGlobals())

  const stub = (extract) => {
    const calls = []
    vi.stubGlobal('fetch', async (url) => {
      calls.push(String(url))
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ query: { pages: { 123: { pageid: 123, extract } } } }),
      }
    })
    return calls
  }

  it('나가는 URL 에 exsectionformat=plain 이 실린다', async () => {
    const calls = stub('x.')
    await mediawikiLead(API, 'Toy Story', { intro: false })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('exsectionformat=plain')
  })

  it('돌려주는 body 에 문단 경계가 남는다 — 절 표제가 앞 문장에 안 붙는다', async () => {
    stub('She lives in Ohio.\n\n\nPlot\n\nThe film opens at dawn.  ')
    const r = await mediawikiLead(API, 'Toy Story', { intro: false })
    expect(r.body).toBe('She lives in Ohio.\n\nPlot\n\nThe film opens at dawn.')
    expect(r.body).not.toContain('Ohio. Plot')
    expect(r.pageid).toBe(123)
  })
})

describe('낱말 세기 — 개행이 낱말을 만들지 않는다', () => {
  it('줄바꿈·빈 줄이 있어도 같은 수를 센다', () => {
    expect(countWords('a\n\nb\tc  d')).toBe(4)
    expect(countWords('  ')).toBe(0)
    expect(countWords(null)).toBe(0)
  })
})
