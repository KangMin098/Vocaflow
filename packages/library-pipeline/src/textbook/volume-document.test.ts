// packages/library-pipeline/src/textbook/volume-document.test.ts
//
// **완성된 한 권이 교재로 보이는지** 본다 — 「처음부터 발행까지」의 마지막 칸.
//
// ⚠️ 이 회귀가 2026-09-06 까지 **없었던 이유는 구조였다.** 문서 조립이 조판 스크립트
//    최상위 스코프의 템플릿 리터럴이라 임포트가 안 됐고, 그래서 판형·인쇄 규칙·활자·판권면이
//    맞는지는 **사람이 스크립트를 돌려 눈으로 보는 수밖에** 없었다. 같은 날 배럴 누락으로
//    조판이 통째로 죽었을 때도 아무 신호가 없었다.
//
// 여기서 보는 것은 「예쁜가」가 아니라 **상업 교재라면 반드시 있는 것들**이다:
//   · 시중과 같은 판형으로 찍히는가 (실측 최빈 215×290)
//   · 쪽 경계에서 문항이 잘리지 않는가 — 시중 교재에서 안 일어나는 일이다
//   · 표지·정답해설·판권면이 각자 쪽을 갖는가
//   · **해설 없는 문항을 해설 있는 척하지 않는가** — 빈 칸이 아니라 없다고 적어야 한다
//   · 내부 QA 표시가 지면에 안 나가는가 (상업 교재 표지에 「자동 검수 9/9」는 없다)

import { describe, expect, it } from 'vitest'

import { buildColophon } from './brand'
import { renderVolumeDocument, type VolumeDocumentInput } from './volume-document'

/** 최소한의 한 권. 값은 조판 실측(V6 3단원 18문항)에서 가져왔다. */
function input(over: Partial<VolumeDocumentInput> = {}): VolumeDocumentInput {
  return {
    colophon: buildColophon({
      title: 'Vocaflow Reading V6',
      step: 5,
      schoolBand: '고1',
      vLevel: 6,
      autoPassed: 9,
      autoTotal: 10,
    }),
    step: 5,
    schoolBand: '고1',
    vLevel: 6,
    totalSteps: 7,
    unitCount: 3,
    itemCount: 18,
    totalMinutes: 75,
    autoPassed: 9,
    autoTotal: 10,
    passageChip: '규격 안 100%',
    answerBias: { chi2: 3.2, cramersV: 0.13, biased: false },
    proof: { passages: 18, defective: 0 },
    unitsHtml: '<section class="unit"><h2><span class="unum">UNIT 01</span></h2></section>',
    answers: [
      { no: 1, answer: 3, explanation: { text: '두 번째 문단이 근거다.', from: 'batch' } },
      { no: 2, answer: 1, explanation: null },
    ],
    ...over,
  }
}

describe('한 권의 문서 — 상업 교재의 최소 조건', () => {
  const html = renderVolumeDocument(input())

  it('시중 실측 판형으로 찍힌다 — 215 × 290 mm', () => {
    // 이 값이 바뀌면 `scripts/textbook-corpus/trim-size.mjs` 를 다시 돌려 근거를 대야 한다.
    expect(html).toContain('@page{size:215mm 290mm')
  })

  it('쪽 경계에서 한 덩어리를 쪼개지 않는다 — 시중 교재에서 안 일어나는 일이다', () => {
    for (const sel of ['.q', '.arow', '.vocab', '.given', '.choices']) {
      expect(html, `${sel} 이 쪽 경계에서 잘릴 수 있다`).toMatch(
        new RegExp(`\\${sel}\\{[^}]*break-inside:avoid`),
      )
    }
    // 지문은 길어서 넘어갈 수 있다 — 대신 한 줄만 남는 것을 막는다.
    expect(html).toMatch(/\.passage\{[^}]*orphans:2;widows:2/)
  })

  it('표지·정답해설·판권면이 각자 쪽을 갖는다 — 상업 교재의 기본 구성', () => {
    expect(html).toMatch(/\.cover\{break-after:page/)
    expect(html).toMatch(/\.answers\{break-before:page/)
    expect(html).toMatch(/\.colophon\{break-before:page/)
    expect(html).toMatch(/\.unit\{break-before:page/)
  })

  it('활자가 7단 스케일로 나온다 — 이 값이 비면 글자 크기가 통째로 없어진다', () => {
    // 배럴 누락으로 이 산출물이 사라진 적이 있다(2026-09-06). 그때는 조판이 즉사했지만,
    // 조용히 빈 문자열이 돌아오는 미래를 대비해 **결과물에서** 확인한다.
    for (const v of ['--fs-micro', '--fs-caption', '--fs-body', '--fs-stem', '--fs-display']) {
      expect(html, `${v} 가 없다`).toContain(v)
    }
  })

  it('해설 없는 문항을 있는 척하지 않는다 — 빈 칸이 아니라 없다고 적는다', () => {
    expect(html).toContain('근거를 지문에서 확정하지 못해 해설을 싣지 않았다')
    // 있는 쪽은 근거의 출처까지 적는다 — 배치가 쓴 것인지 규칙이 뽑은 것인지.
    expect(html).toContain('두 번째 문단이 근거다')
    expect(html).toContain('해설')
  })

  it('내부 QA 는 지면에 안 나간다 — 상업 교재 표지에 「자동 검수 9/10」은 없다', () => {
    // 화면(검수용)에는 남는다 — 지우는 게 아니라 인쇄에서만 감춘다.
    expect(html).toContain('자동 검수 9/10 통과')
    expect(html).toMatch(/\.scorebar\{display:none\}/)
  })

  it('판권면이 발행 정보를 갖는다 — 판차·발행·출처', () => {
    for (const label of ['제목', '사다리', '판차', '발행', '검수', '출처']) {
      expect(html, `판권면에 ${label} 이 없다`).toContain(`<dt>${label}</dt>`)
    }
  })

  it('정답 번호 쏠림을 못 잰 것과 균등한 것을 다르게 적는다', () => {
    expect(renderVolumeDocument(input())).toContain('균등')
    // null 은 「지적 0건」이 아니라 「단답 위주라 못 잰다」.
    const noBias = renderVolumeDocument(input({ answerBias: null }))
    expect(noBias).toContain('단답 위주')
    expect(noBias).not.toContain('균등')
  })

  it('같은 입력이면 같은 문서다 — 시각도 난수도 안 쓴다', () => {
    expect(renderVolumeDocument(input())).toBe(renderVolumeDocument(input()))
  })

  it('사다리 밖 밴드는 단수를 주장하지 않는다', () => {
    const off = renderVolumeDocument(input({ step: null }))
    expect(off).toContain('일곱 단 중 —단')
  })

  it('지문·해설의 태그를 이스케이프한다 — 안 하면 문서가 깨진다', () => {
    const evil = renderVolumeDocument(
      input({
        answers: [
          { no: 1, answer: 1, explanation: { text: '<script>alert(1)</script>', from: 'rule' } },
        ],
      }),
    )
    expect(evil).not.toContain('<script>alert(1)</script>')
    expect(evil).toContain('&lt;script&gt;')
  })
})
