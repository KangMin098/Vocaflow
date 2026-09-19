// packages/library-pipeline/src/ingest-article/europe-pmc.test.ts
//
// **Europe PMC 어댑터 — 라이선스 관문과 서론 파서를 못으로 박는다.**
//
// ── 무엇이 여기서 틀릴 수 있는가 ──────────────────────────────────────
// ① **라이선스.** ND·NC 본문을 잘라 문항으로 만들면 아무 오류도 나지 않고 위법 교재가 나온다.
//    이 저장소는 그 실패를 이미 두 번 겪었다(The Conversation 46편 · Aeon/Quanta/Knowable).
//    그래서 관문이 세 겹이다 — 질의 · 목록 · 적재. 세 겹 중 하나라도 새면 검사가 잡아야 한다.
// ② **서론 파서.** 중첩 `<sec>` 를 비탐욕 정규식으로 잡으면 Introduction 이 **있는** 논문을
//    「없음」으로 센다(실측 2026-09-13, 수확률이 15%p 낮게 나왔다). 그리고 `<sec>` 이 아예
//    없는 문서가 15% 있다. 둘 다 **조용히** 재고를 깎는다 — 오류가 안 난다.
//
// 네트워크를 타지 않는다. 고정 XML 조각으로 판정만 본다.

import { describe, expect, it, vi } from 'vitest'

import {
  EPMC_FEEDS,
  EPMC_MIN_WORDS,
  buildEpmcListUrl,
  buildEpmcQuery,
  epmcArticleUrl,
  epmcIntroSection,
  epmcLicenseAllowed,
  epmcLicenseCode,
  epmcParagraphs,
  epmcTopLevelSections,
  epmcWordCount,
  ingestEuropePmcArticle,
} from './europe-pmc'

describe('라이선스 관문 — ND·NC 는 절대 통과하지 않는다', () => {
  it.each([
    ['cc by', 'by-sa', 'CC-BY-SA-4.0'],
    ['cc by-sa', 'by', 'CC-BY-SA-4.0'],
    ['cc0', 'by', 'CC-BY-4.0'],
  ])('목록 %s / 전문 %s 충돌에서도 더 제한적인 의무를 보존한다', async (list, xmlLicense, expected) => {
    const content = 'Research describes how learning changes communities through shared experience. '.repeat(20)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`<article><front><article-title>Learning</article-title><license xlink:href="https://creativecommons.org/licenses/${xmlLicense}/4.0/"/></front><body><sec sec-type="intro"><title>Introduction</title><p>${content}</p></sec></body></article>`)))
    try {
      expect((await ingestEuropePmcArticle('PMC123', list)).license).toBe(expected)
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('CC BY · CC BY-SA · CC0 만 통과한다', () => {
    for (const ok of ['cc by', 'CC BY', ' cc-by ', 'cc by-sa', 'cc0']) {
      expect(epmcLicenseAllowed(ok), `${ok} 가 막혔다`).toBe(true)
    }
  })

  it('ND·NC 는 전부 막힌다 — 여기가 새면 위법 교재가 조용히 나온다', () => {
    for (const no of ['cc by-nd', 'cc by-nc', 'cc by-nc-nd', 'cc by-nc-sa', 'copyright', '']) {
      expect(epmcLicenseAllowed(no), `${no || '(빈 값)'} 가 통과했다`).toBe(false)
    }
  })

  it('라이선스가 없으면 통과하지 않는다 — 모르는 것을 가능으로 접지 않는다', () => {
    expect(epmcLicenseAllowed(null)).toBe(false)
    expect(epmcLicenseAllowed(undefined)).toBe(false)
  })

  it('모르는 코드는 null 을 낸다 — 추측한 코드로 DB 에 적지 않는다', () => {
    expect(epmcLicenseCode('cc by')).toBe('CC-BY-4.0')
    expect(epmcLicenseCode('cc by-sa')).toBe('CC-BY-SA-4.0')
    expect(epmcLicenseCode('cc0')).toBe('CC0-1.0')
    expect(epmcLicenseCode('cc by-nc')).toBeNull()
    expect(epmcLicenseCode('무엇인지 모를 값')).toBeNull()
  })
})

describe('질의문 — 라이선스·언어가 피드 손에 있지 않다', () => {
  it('모든 피드의 질의에 라이선스·언어·전문보유가 박혀 있다', () => {
    for (const f of EPMC_FEEDS) {
      const q = buildEpmcQuery(f.id)
      expect(q, `${f.id}: 라이선스가 질의에 없다`).toContain('LICENSE:"cc by"')
      expect(q, `${f.id}: 언어가 질의에 없다`).toContain('LANG:"eng"')
      // 전문이 없으면 본문을 못 받는다 — 목록만 늘고 지문은 안 는다.
      expect(q, `${f.id}: IN_EPMC 가 질의에 없다`).toContain('IN_EPMC:y')
    }
  })

  it('피드 filter 에 LICENSE 를 심어도 공통 조건이 사라지지 않는다', () => {
    // 피드가 라이선스를 건드릴 수 있으면 「필터가 질의에 있다」는 보장이 없어진다.
    for (const f of EPMC_FEEDS) {
      expect(f.filter, `${f.id} 의 filter 가 라이선스를 건드린다`).not.toMatch(/LICENSE:/i)
      expect(f.filter, `${f.id} 의 filter 가 언어를 건드린다`).not.toMatch(/LANG:/i)
    }
  })

  it('모르는 피드는 던진다 — 조용히 기본 피드로 물러서지 않는다', () => {
    expect(() => buildEpmcQuery('없는피드')).toThrow(/모른다/)
  })

  it('이미 배선된 소스는 목록기에서 뺀다 — source_id 로는 중복이 안 잡힌다', () => {
    const q = buildEpmcQuery('review')
    expect(q).toContain('NOT PUBLISHER:"PLOS"')
    expect(q).toContain('NOT PUBLISHER:"Frontiers Media SA"')
  })

  it('목록 주소는 커서로 넘긴다 — page 는 깊이가 깊어지면 흔들린다', () => {
    const u = buildEpmcListUrl('review', 100, '*')
    expect(u).toContain('cursorMark=')
    expect(u).not.toMatch(/[?&]page=/)
    // pageSize 는 소스 상한(1000) 안으로 접힌다
    expect(buildEpmcListUrl('review', 99999)).toContain('pageSize=1000')
    expect(buildEpmcListUrl('review', 0)).toContain('pageSize=1')
  })
})

describe('서론 파서 — 중첩 절에서 끊기지 않는다', () => {
  // 실제 문서 모양: <label> 이 <title> 앞에 오고, Introduction 안에 하위 절이 있다.
  const nested = `<article><body>
    <sec id="s1" disp-level="1"><label>1.</label><title>Introduction</title>
      <p>First paragraph of the introduction.</p>
      <sec id="s1a"><title>1.1 Scope</title><p>Nested paragraph.</p></sec>
    </sec>
    <sec id="s2"><title>Methods</title><p>Method text.</p></sec>
  </body></article>`

  it('최상위 절만 센다 — 하위 절을 따로 세지 않는다', () => {
    const secs = epmcTopLevelSections(nested)
    expect(secs.map((s) => s.title)).toEqual(['Introduction', 'Methods'])
  })

  it('Introduction 을 찾는다 — label 이 사이에 끼어도', () => {
    const intro = epmcIntroSection(nested)
    expect(intro?.title).toBe('Introduction')
    // 하위 절의 </sec> 에서 끊기면 Nested paragraph 가 빠진다
    expect(epmcParagraphs(intro!.xml)).toEqual([
      'First paragraph of the introduction.',
      'Nested paragraph.',
    ])
  })

  it('Methods 를 서론으로 집지 않는다', () => {
    const intro = epmcIntroSection(nested)
    expect(epmcParagraphs(intro!.xml).join(' ')).not.toContain('Method text')
  })

  it('절이 하나도 없는 문서도 버리지 않는다 — 표본의 15% 가 이 모양이다', () => {
    const flat = `<article><body><p>Plain body paragraph one.</p><p>Two.</p></body></article>`
    const intro = epmcIntroSection(flat)
    expect(intro, '절 없는 문서를 버렸다 — 멀쩡한 논문 15% 가 사라진다').not.toBeNull()
    expect(epmcParagraphs(intro!.xml)).toEqual(['Plain body paragraph one.', 'Two.'])
  })

  it('제목이 Background 인 문서도 서론으로 본다', () => {
    const bg = `<article><body><sec><title>Background</title><p>Bg text.</p></sec>
      <sec><title>Results</title><p>R.</p></sec></body></article>`
    expect(epmcIntroSection(bg)?.title).toBe('Background')
  })

  it('서론 제목이 없으면 첫 절을 쓴다', () => {
    const un = `<article><body><sec><title>Overview</title><p>O.</p></sec>
      <sec><title>Methods</title><p>M.</p></sec></body></article>`
    expect(epmcIntroSection(un)?.title).toBe('Overview')
  })

  it('body 가 없으면 null — 초록만 있는 레코드를 지문으로 세지 않는다', () => {
    expect(epmcIntroSection('<article><front><abstract><p>A.</p></abstract></front></article>')).toBeNull()
  })
})

describe('본문 정리 — 지문이 아닌 것을 걷어 낸다', () => {
  it('표·그림·인용 번호는 지문에 들어가지 않는다', () => {
    const xml = `<sec><title>Introduction</title>
      <p>Sentence with a citation <xref ref-type="bibr" rid="b1">[1]</xref> inside.</p>
      <fig id="f1"><caption><p>Figure caption text.</p></caption></fig>
      <table-wrap id="t1"><caption><p>Table caption text.</p></caption></table-wrap>
    </sec>`
    const paras = epmcParagraphs(xml)
    expect(paras.join(' ')).not.toContain('[1]')
    expect(paras.join(' ')).not.toContain('Figure caption')
    expect(paras.join(' ')).not.toContain('Table caption')
    expect(paras[0]).toContain('Sentence with a citation')
  })

  it('HTML 엔티티가 본문에 남지 않는다', () => {
    const xml = `<sec><p>Darwin&#x2019;s idea &amp; its critics said &ldquo;no&rdquo;.</p></sec>`
    const [p] = epmcParagraphs(xml)
    expect(p).not.toMatch(/&[a-z]+;|&#x?[0-9a-f]+;/i)
    expect(p).toContain('Darwin’s idea & its critics')
  })

  it('어수는 공백 기준으로 센다 — 빈 문자열은 0', () => {
    expect(epmcWordCount('one two three')).toBe(3)
    expect(epmcWordCount('')).toBe(0)
  })

  it('최소 어수 하한이 조판 최소 창(90어)보다 크다', () => {
    // 90어 미만은 어떤 유형에도 못 들어간다. 하한이 그보다 낮으면 못 쓸 본문을 담게 된다.
    expect(EPMC_MIN_WORDS).toBeGreaterThanOrEqual(90)
  })
})

describe('열쇠와 주소', () => {
  it('표시 주소가 PMCID 로 만들어진다', () => {
    expect(epmcArticleUrl('PMC13539362')).toBe('https://europepmc.org/article/PMC/13539362')
    expect(epmcArticleUrl('13539362')).toBe('https://europepmc.org/article/PMC/13539362')
  })
})
