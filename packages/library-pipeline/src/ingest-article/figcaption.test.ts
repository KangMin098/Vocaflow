// packages/library-pipeline/src/ingest-article/figcaption.test.ts
//
// **사진 설명이 본문 문장으로 새어 들어오지 않는지 고정한다.**
//
// ── 왜 (실측 2026-08-21) ─────────────────────────────────────────────
// 캡션은 마침표가 있어 문장처럼 보이지만 정형동사가 없다:
//   "Cindy Evans during an Artemis II Lunar Science Team simulation at Johnson Space Center."
// 이게 본문에 섞이면 순서·삽입 문항의 한 칸이 되고, 학습자는 글의 흐름이 아니라
// 사진 설명을 읽고 순서를 맞춰야 한다. 아무 에러도 안 난다.
//
// `htmlToPlainText` 는 `<figure>…</figure>` 를 오래전부터 떼고 있었는데, **NASA 는
// `<figcaption>` 을 `</figure>` 뒤에 형제로 둔다.** 그래서 안 잡혔다.
//
// ⚠️ 이 실패를 **문장 쪽에서** 고치려다 기각했다. "정형동사 없는 명사구" 판정은
//   품사 태거 없이 정밀도가 안 나온다 — 가장 넓은 규칙은 25,843문장의 24.3%를 잡는데
//   대부분이 멀쩡한 문장이었고("the crew flew by the far side"), 가장 좁은 규칙조차
//   표본 8개 중 실제 캡션이 2개였다. 구조로 잡히는 것을 추론으로 잡으면 안 된다.

import { describe, expect, it } from 'vitest'

import { htmlToPlainText } from './_helpers'

/** NASA 실물 마크업(2026-08-21 실측 축약) — 캡션이 `</figure>` **뒤**에 온다. */
const NASA_SHAPE = `
<p>The crew relied on extensive geology training they received on Earth.</p>
<figure class="attachment"><a href="/x.jpg"><img src="/x.jpg" alt="" /></a></figure>
<figcaption class="hds-caption padding-y-2">
  <div class="hds-caption-text p-sm margin-0">Cindy Evans during an Artemis II Lunar Science Team simulation at Johnson Space Center.</div>
</figcaption>
<p>That effort centers around a core curriculum of classroom science.</p>
`

/** 표준 마크업 — 캡션이 `<figure>` 안에 있다. 이쪽은 원래 잡히던 경로다. */
const STANDARD_SHAPE = `
<p>Rain fell across the valley for three days.</p>
<figure><img src="/y.jpg" /><figcaption>A flooded road near the river.</figcaption></figure>
<p>The river crested on Sunday morning.</p>
`

describe('사진 설명이 본문에 섞이지 않는다', () => {
  it('`</figure>` 뒤에 놓인 figcaption 도 뗀다 — NASA 마크업', () => {
    const text = htmlToPlainText(NASA_SHAPE)
    expect(text).not.toContain('Cindy Evans')
    expect(text).not.toContain('Johnson Space Center')
  })

  it('figure 안의 figcaption 도 그대로 뗀다 — 표준 마크업', () => {
    const text = htmlToPlainText(STANDARD_SHAPE)
    expect(text).not.toContain('flooded road')
  })

  it('본문 문장은 잃지 않는다 — 캡션을 떼다 본문까지 자르면 더 나쁘다', () => {
    const text = htmlToPlainText(NASA_SHAPE)
    expect(text).toContain('The crew relied on extensive geology training')
    expect(text).toContain('That effort centers around a core curriculum')
  })

  it('캡션 자리가 줄바꿈으로 남아 앞뒤 문장이 한 줄로 붙지 않는다', () => {
    // 한 줄로 붙어 버리면 두 문장이 한 문단이 되어 순서 문항의 덩어리 나누기가 어긋난다.
    // (처음엔 `/on Earth\.\s*That effort/` 로 단언했는데 `\s` 가 줄바꿈을 삼켜
    //  **분리돼 있는데도 실패**했다 — 코드가 아니라 단언이 틀렸다.)
    const text = htmlToPlainText(NASA_SHAPE)
    expect(text).not.toMatch(/on Earth\.[ \t]+That effort/)
    const lines = text.split('\n').filter(Boolean)
    expect(lines.some((l) => l.includes('on Earth.') && l.includes('That effort'))).toBe(false)
  })

  it('대문자 태그·속성이 섞여도 뗀다', () => {
    const text = htmlToPlainText('<P>Body sentence here.</P><FIGCAPTION ID="c1">Caption text.</FIGCAPTION>')
    expect(text).toContain('Body sentence here.')
    expect(text).not.toContain('Caption text.')
  })
})
