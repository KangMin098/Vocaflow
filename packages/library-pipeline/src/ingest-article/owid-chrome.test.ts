// packages/library-pipeline/src/ingest-article/owid-chrome.test.ts
//
// **OWID 페이지 껍데기 제거 — 머리는 걷어내고 꼬리는 자른다. 같은 문자열인데 다르게 다룬다.**
//
// ── 왜 이 테스트가 있는가 (실측 2026-09-06 · 적재된 owid 13편 전수) ──────────
// 적재된 13편이 **100% 오염**되어 있었다. 본문 첫 줄이 `HomeAnimal Welfare` 같은
// 내비게이션 껍데기였고(지문으로 뽑으면 그게 제목처럼 인쇄된다), 본문 한복판(20~87%)에
// 뉴스레터 구독 폼이, 말미에 감사말·관련글 위젯이 섞여 있었다.
//
// 절단 코드는 v06.210부터 있었지만 `Endnotes|Cite this work|Reuse this work freely` 를 찾고
// 있었다. 실제 페이지 문자열은 `Cite this article` · `Reuse our work freely` 이고 `Endnotes` 는
// 13편 중 **0회** 등장한다 — 즉 **한 번도 발동한 적이 없는 죽은 코드**였다.
//
// ⚠️ 그래서 이 결함의 재발 경로는 "문자열만 실제 값으로 맞추면 되겠네" 다 — 두 문자열은 페이지
//    **맨 위**(본문의 1~11% · 실측 최대 388자)에도 있고 기존 규칙은 "최초 발생에서 컷" 이다.
//    13편 전수 시뮬레이션: `\b` 를 남기면 여전히 매치 0(죽은 코드 그대로), `\b` 를 떼면
//    **5편이 44~54어로 파괴**되고(896→50 · 1,512→54 · 455→45 · 759→44 · 1,576→46)
//    나머지 8편은 머리 마커가 300자 안이라 `index > 300` 가드에 걸려 그대로 오염된 채 남는다.
//    **일부만 파괴되기 때문에** 원인이 더 안 보인다. 그래서 아래 머리 껍데기 fixture 는
//    인용 문구가 **300자 뒤**에 오도록 실제 페이지처럼 길게 잡는다 — 짧게 잡으면 가드에
//    가려져 이 회귀가 통과해 버린다.
//
// ⚠️ 두 번째 함정: `Acknowledgments` · `Continue reading on Our World in Data` 가 **꼬리라는
//    보장이 없다.** 보통 84~97% 지점이지만 「farm animals」 편은 둘 다 28~29% 에 있고 그 뒤
//    `Appendix 1: …` 이하 2,066어가 정상 산문이다. 최초 발생 절단은 2,970→809어(73% 손실),
//    **마지막 발생 절단도 똑같다**(이 편은 뒤에 마커가 없다). 위치·순서로는 못 가른다.
//    → 「뒤에 산문이 남아 있는가」로 가른다. 실측 마진: 꼬리 잔여 최대 123어 vs 부록 2,400어.
//
// 고친 뒤 13편 전수 실측: 보존 87%(16,372 → 14,230어), 잔존 마커 0, farm animals 2,970 → 2,804어.

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ingestOwidArticle } from './owid'

const URL_ = 'https://ourworldindata.org/farm-animal-welfare-attitudes'

const HEAD = '<meta property="og:title" content="Most people care about farm animals" />'

/**
 * 실제 페이지의 머리 껍데기 — `Home<주제>`부터 인용·라이선스 안내까지.
 * 인용 문구가 평문 **300자 뒤**에 오도록 잡는다(실측 범위 안 · 13편 최대 388자):
 * 순진한 수정의 `index > 300` 가드에 가려지지 않아야 회귀가 성립한다.
 */
const SHELL = [
  '<p>HomeAnimal Welfare</p>',
  '<h1>Most people care about farm animals — our food system does not reflect that</h1>',
  '<p>Surveys worldwide show that most people find common animal farming practices unacceptable, even in countries where meat consumption is high and where livestock farming is a large part of the national economy.</p>',
  '<p>By Pablo Rosado</p>',
  '<p>April 20, 2026</p>',
  '<p>Browse past versions</p>',
  // 실측: 두 문구는 개행 없이 붙어 있다.
  '<p>Cite this articleReuse our work freely</p>',
].join('')

const OPENER =
  'In a world that often feels deeply polarized, it is rare to find a topic where almost everyone agrees.'

const SENTENCE =
  'The share of animals raised in confined indoor systems has grown steadily across most regions of the world over recent decades. '

/** 본문 문단 한 줄 = 63어 (관련글 설명 최대 38어와 확실히 갈린다). */
function para(): string {
  return `<p>${SENTENCE.repeat(3)}</p>`
}

function prose(paras: number): string {
  return Array.from({ length: paras }, para).join('')
}

const ACK = [
  '<p>Acknowledgments</p>',
  '<p>I would like to thank Max Roser and Hannah Ritchie for their valuable suggestions on this article.</p>',
].join('')

const RELATED = [
  '<p>Continue reading on Our World in Data</p>',
  '<p>How many animals get slaughtered every day?</p>',
  '<p>Hundreds of millions of animals get killed for meat every day.</p>',
  '<p>How many animals are factory-farmed?</p>',
  '<p>The majority of farm animals in the world are factory-farmed.</p>',
].join('')

const APPENDIX_HEADING = 'Appendix 1: Common farming practices'

const NEWSLETTER = [
  '<p>Subscribe to our newsletters</p>',
  '<p>We send two regular newsletters so you can stay up to date on our work.</p>',
  '<p>Subscribe</p>',
].join('')

const AFTER_NEWSLETTER = 'Future energy demand for this sector is very uncertain and hard to predict.'

function page(inner: string): string {
  return `${HEAD}<article>${inner}</article>`
}

function stubPage(html: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, text: async () => html })),
  )
}

const words = (s: string) => (s.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OWID 페이지 껍데기 제거', () => {
  it('머리 껍데기를 걷어내고 본문 첫 문장부터 시작한다', async () => {
    stubPage(page(`${SHELL}<p>${OPENER}</p>${prose(6)}${ACK}${RELATED}`))
    const a = await ingestOwidArticle(URL_)

    expect(a.content.startsWith(OPENER)).toBe(true)
    expect(a.content).not.toContain('HomeAnimal Welfare')
    expect(a.content).not.toContain('Browse past versions')
    expect(a.content).not.toContain('By Pablo Rosado')
    expect(a.content).not.toContain('Reuse our work freely')
    expect(a.content).not.toContain('Cite this article')
  })

  it('머리 문구가 별도 줄로 나뉘어도 걷어낸다', async () => {
    const split = SHELL.replace(
      '<p>Cite this articleReuse our work freely</p>',
      '<p>Cite this article</p><p>Reuse our work freely</p>',
    )
    stubPage(page(`${split}<p>${OPENER}</p>${prose(6)}`))
    const a = await ingestOwidArticle(URL_)

    expect(a.content.startsWith(OPENER)).toBe(true)
    expect(a.content).not.toContain('Reuse our work freely')
  })

  it('함정 ①: 머리의 인용·라이선스 문구에서 잘려 본문이 통째로 사라지지 않는다', async () => {
    // 자기무력화 가드 — 인용 문구가 300자 안으로 들어오면 순진한 규칙의 `index > 300` 가드에
    // 가려져 이 검사가 통과해 버린다. fixture 가 조건을 지키는지 먼저 확인한다.
    expect(SHELL.replace(/<[^>]+>/g, '\n').indexOf('Cite this article')).toBeGreaterThan(300)

    // 「최초 발생에서 컷」 규칙이면 여기서 본문이 50어 아래로 떨어진다(실측 896→50어).
    stubPage(page(`${SHELL}<p>${OPENER}</p>${prose(6)}${ACK}${RELATED}`))
    const a = await ingestOwidArticle(URL_)

    expect(words(a.content)).toBeGreaterThan(370) // 본문 6문단 = 378어
    expect(a.content).toContain(SENTENCE.trim())
  })

  it('함정 ②: 감사말·관련글이 앞쪽(30%)에 있어도 그 뒤 본문이 살아남는다', async () => {
    // 「farm animals」 편의 실제 배치 — Acknowledgments·Continue reading 뒤에 부록 산문이 이어진다.
    stubPage(
      page(`${SHELL}<p>${OPENER}</p>${prose(1)}${ACK}${RELATED}<p>${APPENDIX_HEADING}</p>${prose(6)}`),
    )
    const a = await ingestOwidArticle(URL_)

    expect(a.content).toContain(APPENDIX_HEADING) // 부록 소제목까지 살린다
    expect(words(a.content)).toBeGreaterThan(430) // 본문 1 + 부록 6 문단 = 441어
    // 블록 자체(감사말 + 관련글 제목/설명 쌍)는 도려낸다.
    expect(a.content).not.toContain('Acknowledgments')
    expect(a.content).not.toContain('Continue reading on Our World in Data')
    expect(a.content).not.toContain('How many animals get slaughtered every day?')
    expect(a.content).not.toContain('Hundreds of millions of animals')
  })

  it('꼬리: 뒤에 산문이 없으면 감사말에서 절단한다', async () => {
    stubPage(page(`${SHELL}<p>${OPENER}</p>${prose(6)}${ACK}${RELATED}`))
    const a = await ingestOwidArticle(URL_)

    expect(a.content).not.toContain('Acknowledgments')
    expect(a.content).not.toContain('Max Roser')
    expect(a.content).not.toContain('Continue reading on Our World in Data')
    expect(a.content).not.toContain('factory-farmed')
    expect(a.content.endsWith('decades.')).toBe(true)
  })

  it('본문 한복판 뉴스레터 폼을 제거하고 그 뒤 본문을 유지한다', async () => {
    stubPage(
      page(
        `${SHELL}<p>${OPENER}</p>${prose(2)}${NEWSLETTER}<p>${AFTER_NEWSLETTER}</p>${prose(3)}${ACK}${RELATED}`,
      ),
    )
    const a = await ingestOwidArticle(URL_)

    expect(a.content).not.toContain('Subscribe')
    expect(a.content).toContain(AFTER_NEWSLETTER) // 폼 뒤 본문은 남는다
    expect(words(a.content)).toBeGreaterThan(330) // 5문단 = 315어 + 소제목
  })

  it('페이지 구조가 바뀌어 머리 마커가 없으면 본문을 파괴하지 않는다', async () => {
    // 오염이 남는 것은 다음 실측에서 보이지만, 파괴된 본문은 `body too short` 로 조용히 사라진다.
    const noMarker = SHELL.replace('<p>Cite this articleReuse our work freely</p>', '')
    stubPage(page(`${noMarker}<p>${OPENER}</p>${prose(6)}${ACK}${RELATED}`))
    const a = await ingestOwidArticle(URL_)

    expect(a.content).toContain(OPENER)
    expect(words(a.content)).toBeGreaterThan(370)
  })
})
