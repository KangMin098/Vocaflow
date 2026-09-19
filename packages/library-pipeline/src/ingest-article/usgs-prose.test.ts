// packages/library-pipeline/src/ingest-article/usgs-prose.test.ts
//
// **USGS 본문에서 「화면에 보이지 않는 글자」가 문장으로 승격되지 않는지 고정한다.**
//
// ── 왜 (실측 2026-09-06 · usgs 수확분 738편 전수 + 신규 24편 직접 수확) ──────────────
// `_helpers.ts` 의 `htmlToPlainText` 는 태그만 벗기고 안의 글자는 남긴다. USGS(USWDS/Drupal)
// 마크업에는 시각 독자가 본 적 없는 글자가 두 종류 섞여 있다:
//
//   ① `<span class="usa-sr-only">Media</span>` — 이미지 링크의 스크린리더 전용 라벨.
//        단독 `Media` 줄 **98편 / 322줄**(2회 이상 63편) · 단독 `Close` 줄 11편.
//   ③ `usgs-storytelling-media-grid` 갤러리 — 썸네일 오버레이 **제목**(캡션 띠)과
//        `aria-hidden="true"` 인 **빈 모달 틀**의 `Close` 버튼.
//
// 이 줄들은 짧고 마침표가 없어 문장처럼 보이지 않지만, 문단 사이에 홀로 서면 순서·삽입
// 문항의 **한 칸**이 된다. 학습자는 글의 흐름이 아니라 버튼 이름을 읽고 순서를 맞춰야 한다.
// 그리고 아무 에러도 안 난다.
//
// ② 는 다른 종류다 — `\$12M` 같은 **마크다운 이스케이프가 usgs.gov 원문에 들어 있다**
//    (87편/207회). 우리 변환기가 만든 게 아니라 원문을 다시 받아도 그대로다.
//
// ⚠️ 이 스위트가 지키는 가장 중요한 것은 **반례**다. `social media`(44편)처럼 문장 속
//   낱말은 살아남아야 한다. 그래서 세척은 텍스트가 아니라 **구조**(class)로만 한다 —
//   `_helpers.ts` figcaption 주석의 교훈과 같다.
//
// ⚠️ ③ 을 처음엔 plain-text 추론 규칙(「`Close` 줄 위 90자 이하·`.!?` 미종료 연속 줄」)으로
//   짜려 했다. 원문을 열어 보니 class 가 그대로 있어서 폐기했다. 짧은 소제목
//   (`Meeting a Crucial Need`)은 캡션과 형태가 완전히 같아 추론으로는 못 가른다 —
//   그 반례도 아래에 넣어 둔다.

import { describe, expect, it } from 'vitest'

import { extractProse } from './usgs'

/** USGS 본문 컨테이너로 감싼다 — `extractProse` 가 실제로 밟는 경로를 타게 하려고. */
function body(inner: string): string {
  return `<div class="node-main-body"><div class="field-intro">${inner}</div></div>`
}

/** 줄 단위 비교용 — 홀로 뜬 줄인지가 쟁점이라 문자열 포함이 아니라 줄 집합으로 본다. */
function lines(html: string): string[] {
  return extractProse(html)
    .split('\n')
    .map((l) => l.trim())
}

/**
 * 실물 마크업 (2026-09-06 `landsat-illustrates-life-cycle-a-mine` 축약).
 * `<figure>` **밖**의 맨 `div` 에 놓인 미디어 링크 — `htmlToPlainText` 의 `<figure>` 제거가
 * 못 잡는 모양이다. 실제로 새는 것이 이쪽이다.
 */
const MEDIA_LINK = `
<p>Using surface coal mining methods, the overburden is removed to expose the coal beds.</p>
<div class="align-center d-media embedded-media d-media--type--image">
  <a href="/media/images/diagram-open-pit-coal-mining-operation" class="media-link" aria-label="Media Link">
    <span class="usa-sr-only">Media</span>
    <div class="field field--name--image"><div class="image"><img loading="lazy" src="/x.jpg" alt="Diagram" /></div></div>
  </a>
</div>
<p>The solid rock layers are drilled and blasted with explosives to break up the rock.</p>
`

/**
 * 실물 마크업 (2026-09-06 `securing-nations-need-native-seed` 축약).
 * 캡션 띠 = `media--storytelling-grid__overlay--title-text`,
 * `Close` = `usgs-storytelling-media-grid--overlay`(aria-hidden) 안의 빈 모달 틀.
 * **자식 div 를 여러 겹 품고 있어 `<div …>[\s\S]*?</div>` 꼴 정규식으로는 못 뗀다.**
 */
const STORYTELLING_GALLERY = `
<h2>Meeting a Crucial Need</h2>
<p>Investing in native seeds is essential to securing the future of natural resources.</p>
<div class="usgs-storytelling-media-grid--wrapper">
  <div class="grid-col-6 usgs-storytelling-media-grid--item" data-media-type="image" data-title="Bike-produced seedballs">
    <div class="media--storytelling-grid media--type--image">
      <div class="field field--name--image"><div class="image"><img src="/s.jpg" alt="Seedballs" /></div></div>
      <div class="media--storytelling-grid__overlay--title-wrapper"></div>
      <div class="media--storytelling-grid__overlay--title-text">Bike-produced seedballs before field implementation</div>
    </div>
  </div>
  <div class="usgs-storytelling-media-grid--overlay" aria-hidden="true">
    <div class="usgs-storytelling-media-grid--detail">
      <div class="usgs-storytelling-media-grid--media"></div>
      <div class="usgs-storytelling-media-grid--content">
        <div class="usgs-storytelling-media-grid--title"></div>
        <div class="usgs-storytelling-media-grid--description"></div>
        <button type="button" class="usgs-storytelling-media-grid--close ui-button" title="Close"><span class="ui-button-icon ui-icon"></span>Close</button>
      </div>
    </div>
  </div>
</div>
<p>Using native plants to restore ecosystems provides critical social and environmental benefits.</p>
`

describe('① usa-sr-only 라벨이 본문 문장으로 승격되지 않는다', () => {
  it('미디어 링크의 `Media` 라벨이 홀로 뜬 줄로 남지 않는다', () => {
    expect(lines(body(MEDIA_LINK))).not.toContain('Media')
  })

  it('본문 문장은 그대로 남는다 — 라벨을 떼다 본문까지 자르면 더 나쁘다', () => {
    const text = extractProse(body(MEDIA_LINK))
    expect(text).toContain('Using surface coal mining methods')
    expect(text).toContain('drilled and blasted with explosives')
  })

  it('`<label class="usa-sr-only">` 도 같이 뗀다 — 같은 USWDS 유틸리티다', () => {
    const html = body('<p>Seismic data arrived overnight.</p><label class="usa-sr-only">Label</label>')
    expect(lines(html)).not.toContain('Label')
  })

  it('라벨 자리가 공백으로 남아 앞뒤 낱말이 붙지 않는다', () => {
    // 빈 문자열로 지우면 `Readmore` 가 된다 — 사전에 없는 낱말이 새로 생긴다.
    const html = body('<p>Read<span class="usa-sr-only">Media</span>more about the survey.</p>')
    const text = extractProse(html)
    expect(text).toContain('Read more about the survey')
    expect(text).not.toContain('Readmore')
  })
})

describe('① 반례 — 문장 속 낱말은 절대 건드리지 않는다', () => {
  it('`social media` 는 살아남는다 (실측 44편)', () => {
    const html = body(
      '<p>The USGS shares hazard updates on social media during an eruption.</p>' +
        '<div class="d-media"><a class="media-link"><span class="usa-sr-only">Media</span></a></div>' +
        '<p>Follow the news media coverage for evacuation orders.</p>',
    )
    const text = extractProse(html)
    expect(text).toContain('on social media during an eruption')
    expect(text).toContain('Follow the news media coverage')
    expect(lines(html)).not.toContain('Media')
  })

  it('sr-only 가 아닌 span 안의 글자는 그대로 둔다', () => {
    const html = body('<p>Coverage came from the <span class="term">media</span> and from field crews.</p>')
    expect(extractProse(html)).toContain('from the media and from field crews')
  })

  it('`usa-sr-only-legend` 처럼 이름만 겹치는 class 는 삼키지 않는다 — 부분일치 금지', () => {
    const html = body('<p>Intro sentence.</p><span class="usa-sr-only-legend">Magnitude scale</span>')
    expect(extractProse(html)).toContain('Magnitude scale')
  })
})

describe('③ 스토리텔링 갤러리 — 캡션 띠와 `Close` 를 구조로 뗀다', () => {
  it('썸네일 오버레이 제목(캡션)이 본문 줄로 남지 않는다', () => {
    expect(extractProse(body(STORYTELLING_GALLERY))).not.toContain(
      'Bike-produced seedballs before field implementation',
    )
  })

  it('빈 모달 틀의 `Close` 가 남지 않는다 — 자식 div 를 품고 있어 깊이 추적이 필요하다', () => {
    expect(lines(body(STORYTELLING_GALLERY))).not.toContain('Close')
  })

  it('갤러리 **바로 위** 짧은 소제목은 살아남는다 — 추론 규칙이었다면 먹혔을 줄', () => {
    // `Meeting a Crucial Need` 는 캡션과 길이·문장부호가 똑같다. 구조로 잡기에 안전하다.
    expect(extractProse(body(STORYTELLING_GALLERY))).toContain('Meeting a Crucial Need')
  })

  it('갤러리 앞뒤 본문 문단을 둘 다 잃지 않는다', () => {
    const text = extractProse(body(STORYTELLING_GALLERY))
    expect(text).toContain('Investing in native seeds is essential')
    expect(text).toContain('provides critical social and environmental benefits')
  })
})

describe('② usgs.gov 원문에 남은 마크다운 이스케이프 `\\$`', () => {
  it('`\\$12M` → `$12M` (실측 87편 / 207회)', () => {
    const html = body('<p>The 1994 flood resulted in over \\$12M&nbsp;in damage to the gage network.</p>')
    const text = extractProse(html)
    expect(text).toContain('over $12M')
    expect(text).not.toContain('\\$')
  })

  it('한 문장에 여러 번 나와도 전부 되돌린다', () => {
    const html = body('<p>Losses of \\$6.1 billion in 2023 and \\$510 million in 2024 were recorded.</p>')
    const text = extractProse(html)
    // ⚠️ `toContain('$6.1 billion')` 만으로는 부족하다 — 고치지 않은 `\$6.1 billion` 도
    //   그 부분문자열을 **포함**해서 통과한다(변이 검사에서 실제로 통과했다).
    expect(text).toContain('of $6.1 billion in 2023')
    expect(text).toContain('and $510 million in 2024')
    expect(text).not.toMatch(/\\/)
  })

  it('⚠️ 넓히지 않는다 — `$` 외의 백슬래시 이스케이프는 손대지 않는다', () => {
    // 이 원천에서 백슬래시 뒤에 온 문자는 `$` 뿐이었다(개행 1건 제외). 일반 규칙으로 넓히면
    // 경로·LaTeX 를 조용히 망가뜨리고, 그 손상은 어휘 노이즈 지표에도 안 잡힌다.
    const html = body('<p>Recovery reached 40\\% and the file lives at C:\\data\\gage while \\alpha held.</p>')
    const text = extractProse(html)
    expect(text).toContain('40\\%')
    expect(text).toContain('C:\\data\\gage')
    expect(text).toContain('\\alpha')
  })
})
