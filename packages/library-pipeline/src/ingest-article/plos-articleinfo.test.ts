// packages/library-pipeline/src/ingest-article/plos-articleinfo.test.ts
//
// **서지 블록이 본문에 실려 있었다 — 후미가 아니라 머리에.**
//
// ── 무엇이 잘못이었나 (실측 2026-09-07) ──────────────────────────────
// PLOS 는 `Citation:` 부터 `Competing interests:` 까지 아홉 항목을 **한 div** 에 몰아 넣고,
// 그 div 를 `article-text` 의 **자식**으로, **초록 바로 뒤 · 첫 절(Introduction) 앞**에 둔다:
//
//   <div xmlns:plos="http://plos.org" class="articleinfo"> … </div>
//
// `10.1371/journal.pone.0348669` 원본 실측 오프셋:
//   `article-text` 안쪽 100,834–232,578 · `abstract-content` 101,046 ·
//   `articleinfo` 104,574–107,086 (내부 **2,452자** · 아홉 항목 전부 이 안)
//
// `extractProse` 의 절단 세 줄은 `references` div 와 `References` / `Supporting information`
// **제목 이하**만 자른다 — 전부 **후미** 규칙이다. 머리에 있는 이 블록은 셋 중 어디에도 안 걸리고
// figure/table 제거 규칙에도 안 걸려 **그대로 산문에 실렸다.** 저장된 PLOS 24편 표본에서
// **24편 전부**가 본문 안에 이 서지문을 갖고 있었다.
//
// 최신 40편 전수 실측: `articleinfo` 없는 편 **0** · 내부 길이 중앙 **1,566자**(694–2,632) ·
// 항목 수 3–10.
//
// ── 고침 전/후를 같은 원본으로 돌린 결과 (실제 기사 HTML 18편) ──────────
//   서지문이 남아 있던 편: **18/18 → 0/18**
//   산문 감소: 중앙 **1,435자 / 203단어**(626–2,208자 · 84–334단어) · 비율 중앙 **5.45%**(2.09–23.29%)
//   `10.1371/journal.pone.0348669` 단건: 24,487 → 22,368자(**-2,119**) · 3,839 → 3,535단어(**-304** · -7.9%)
//
// ⚠️ 이 결함도 눈에 안 띈다 — 산출물은 문법적으로 멀쩡하고 학술 어휘까지 들어 있어서
//   길이·난이도 지표를 **그럴듯하게** 부풀린다. `word_count` 가 틀리면 학령 판정과
//   지문 규격 판정이 그만큼 틀린 분모 위에서 돈다.
//
// ⚠️ 고치는 쪽으로 과하게 가면 **본문 첫 절이 통째로 날아간다** — 그래서 아래 과절단 회귀를 둔다.
//   그리고 `Citation:` `Funding:` 같은 낱말은 **본문 산문에도 정상적으로 나온다**(연구비·이해충돌을
//   논하는 논증문이 PLOS 의 주요 지면이다). 문자열로 지우면 그런 문장을 같이 지운다 —
//   그 갈래도 못 박는다.

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ingestPlosArticle } from './plos'

const URL_ = 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0348669'

const HEAD =
  '<meta name="citation_title" content="Vital signs and the Hospital Frailty Risk Score" />' +
  '<meta name="citation_publication_date" content="2026/02/11" />' +
  '<meta name="citation_author" content="Kutrani H" />'

/** 200단어 게이트를 넘기려는 채움 산문. */
function filler(times: number, marker: string): string {
  return `The cohort ${marker} was followed for twelve months and the outcome was recorded by trained staff. `.repeat(
    times,
  )
}

/**
 * 실제 `articleinfo` 의 아홉 항목. 실측 순서 그대로.
 * 각 항목에 표식을 박아 **한 항목이라도 살아남으면** 검사가 잡게 한다.
 */
const INFO_LABELS = [
  'Citation',
  'Editor',
  'Received',
  'Accepted',
  'Published',
  'Copyright',
  'Data Availability',
  'Funding',
  'Competing interests',
] as const

/** `nestedChildren` = 자식 div 로 한 겹 감싼 변형(오늘 실측은 0개지만 언제든 생길 수 있다). */
function articleInfoDiv(nestedChildren: boolean): string {
  const body = INFO_LABELS.map((label, i) => {
    const line = `<p><strong>${label}: </strong>INFO_SENTINEL_${i} Kutrani H, Briggs J (2026) PLoS One 21(5): e0348669.</p>`
    return nestedChildren ? `<div class="info-item"><div class="inner">${line}</div></div>` : line
  }).join('')
  return `<div xmlns:plos="http://plos.org" class="articleinfo">${body}</div>`
}

const ABSTRACT = `<div class="abstract-content"><p>ABSTRACT_SENTINEL. ${filler(
  10,
  'in the abstract',
)}</p></div>`

/** 본문 절 두 개 — `articleinfo` 바로 뒤에 온다(실측 배치). */
const SECTIONS =
  `<div id="section1" class="section toc-section"><h2>Introduction</h2><p>INTRO_SENTINEL. ${filler(
    12,
    'in the intro',
  )}</p></div>` +
  `<div id="section2" class="section toc-section"><h2>Discussion</h2><p>DISCUSSION_SENTINEL. ${filler(
    8,
    'in the discussion',
  )}</p></div>`

/**
 * 실측 배치 — `articleinfo` 가 초록 **뒤**, 첫 절 **앞**, 그리고 `article-text` **안쪽**이다.
 * 이 세 관계가 이 결함의 전부라서 픽스처가 셋을 다 재현해야 한다.
 */
function page(opts: { nestedChildren?: boolean; info?: boolean; extra?: string } = {}): string {
  const info = opts.info === false ? '' : articleInfoDiv(opts.nestedChildren ?? false)
  return (
    `${HEAD}<div class="article-text" id="artText">` +
    `<div class="abstract abstract-type-toc"><h2>Abstract</h2>${ABSTRACT}</div>` +
    `${info}${opts.extra ?? ''}${SECTIONS}</div>`
  )
}

function stubPage(html: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, text: async () => html })),
  )
}

function count(s: string, needle: string): number {
  return s.split(needle).length - 1
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PLOS articleinfo — 초록 뒤 · 첫 절 앞에 박힌 서지 블록', () => {
  it('아홉 항목이 통째로 사라진다', async () => {
    stubPage(page())
    const article = await ingestPlosArticle(URL_)

    for (const label of INFO_LABELS) {
      // 고치기 전에는 아홉 개 전부 본문에 남아 있었다.
      expect(article.content).not.toContain(`${label}:`)
    }
    for (let i = 0; i < INFO_LABELS.length; i++) {
      expect(article.content).not.toContain(`INFO_SENTINEL_${i}`)
    }
  })

  it('자식 div 로 감싼 변형도 통째로 사라진다 (깊이 세기 증거)', async () => {
    // 비탐욕 `<div…>[\s\S]*?</div>` 였다면 첫 번째 `</div>` 에서 끊겨
    // 두 번째 항목부터가 산문에 남는다.
    stubPage(page({ nestedChildren: true }))
    const article = await ingestPlosArticle(URL_)

    for (let i = 0; i < INFO_LABELS.length; i++) {
      expect(article.content).not.toContain(`INFO_SENTINEL_${i}`)
    }
    expect(article.content).not.toContain('Competing interests:')
  })

  it('본문 첫 절이 살아남는다 — 과절단 회귀', async () => {
    stubPage(page())
    const article = await ingestPlosArticle(URL_)

    // `articleinfo` 바로 뒤가 Introduction 이다. 제거 범위가 한 글자라도 넘치면 여기가 죽는다.
    expect(count(article.content, 'INTRO_SENTINEL')).toBe(1)
    expect(count(article.content, 'DISCUSSION_SENTINEL')).toBe(1)
    expect(article.content).toContain('Introduction')
    expect(article.content).toContain('Discussion')
    // 초록도 그대로다.
    expect(count(article.content, 'ABSTRACT_SENTINEL')).toBe(1)
  })

  // ⚠️ **여기 있던 「지운 자리에 낱말이 붙지 않는다」 검사는 지웠다** — 변이 검사에서
  //   `removeDivByClass` 의 개행을 빈 문자열로 바꿔도 통과했다. `htmlToPlainText` 가
  //   `</div>` 를 이미 개행으로 바꾸므로(`_helpers.ts`) 그 경계는 어차피 생긴다.
  //   **어떤 변이로도 죽지 않는 검사는 통과해도 아무것도 증명하지 않는다** — 오히려
  //   "덮여 있다" 는 착각만 준다. 개행은 보험으로 남기되, 검사는 두지 않는다.

  it('본문 산문에 정상적으로 나오는 `Citation:` 은 안 지운다 (문자열 매칭이 아니라는 증거)', async () => {
    // 연구비·인용 관행 자체를 논하는 절. PLOS 의 Essay/Opinion 지면에 실제로 흔하다.
    const prose =
      `<div id="section0" class="section toc-section"><h2>Background</h2>` +
      `<p>PROSE_SENTINEL. Citation: counts remain a contested proxy for impact, and Funding: ` +
      `disclosures rarely change how readers weigh a result. ${filler(6, 'about citations')}</p></div>`
    stubPage(page({ extra: prose }))
    const article = await ingestPlosArticle(URL_)

    expect(count(article.content, 'PROSE_SENTINEL')).toBe(1)
    // 낱말은 살고, 서지 블록의 같은 낱말은 죽었다 — 경계는 마크업이 갖고 있다.
    expect(article.content).toContain('Citation: counts remain a contested proxy')
    expect(article.content).toContain('Funding: disclosures rarely change')
    expect(article.content).not.toContain('INFO_SENTINEL_0')
  })

  it('`articleinfo` 가 없는 편도 그대로 통과한다', async () => {
    stubPage(page({ info: false }))
    const article = await ingestPlosArticle(URL_)

    expect(count(article.content, 'ABSTRACT_SENTINEL')).toBe(1)
    expect(count(article.content, 'INTRO_SENTINEL')).toBe(1)
    expect(count(article.content, 'DISCUSSION_SENTINEL')).toBe(1)
  })

  it('초록 중복 수정이 깨지지 않는다 — 지우는 자리는 그 판정보다 앞이다', async () => {
    // `articleinfo` 는 `abstract-content` **뒤**에 있으므로 제거해도 초록 문자열은 안 변한다.
    // 따라서 "본문이 초록을 이미 품고 있는가" 판정 결과가 그대로여야 한다.
    stubPage(page())
    const article = await ingestPlosArticle(URL_)

    expect(count(article.content, 'ABSTRACT_SENTINEL')).toBe(1)
    expect(article.content.indexOf('ABSTRACT_SENTINEL')).toBeLessThan(
      article.content.indexOf('INTRO_SENTINEL'),
    )
  })

  it('초록이 본문 밖인 배치에서도 둘 다 성립한다', async () => {
    // 초록이 `article-text` 의 형제인 레이아웃 + `articleinfo` 는 본문 안.
    stubPage(
      `${HEAD}<div class="abstract"><h2>Abstract</h2>${ABSTRACT}</div>` +
        `<div class="article-text" id="artText">${articleInfoDiv(false)}${SECTIONS}</div>`,
    )
    const article = await ingestPlosArticle(URL_)

    expect(count(article.content, 'ABSTRACT_SENTINEL')).toBe(1)
    expect(count(article.content, 'INTRO_SENTINEL')).toBe(1)
    expect(article.content).not.toContain('Competing interests:')
    expect(article.content.indexOf('ABSTRACT_SENTINEL')).toBeLessThan(
      article.content.indexOf('INTRO_SENTINEL'),
    )
  })
})
