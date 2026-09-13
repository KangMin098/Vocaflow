// packages/library-pipeline/src/textbook/sensitive-topic.test.ts
//
// **형식이 멀쩡해도 학교 교재에 못 싣는 글이 있다.**
//
// 실측 2026-08-31 — V6 `content_match` 드레인 8편을 손으로 채우다 첫 편이 낙태권 논쟁이었다.
// 규격도 맞고 선택지도 만들어지는데, 한국 중·고등 영어 교재에는 실을 수 없는 글이다.
// 검사기 아홉 개 중 소재를 보는 것이 하나도 없었다. 저장소 전체로는 원글 1,042편
// (V6 6.7% · V7 4.0% · V5 3.3% · V4 1.4%) 위에 문항 25,316개가 서 있었다.
//
// ⚠️ 이 테스트가 지키는 것은 **좁음**이다. 목록을 넓히면 전쟁사·선거제도·종교문화처럼
//   시중 교재가 실제로 다루는 소재까지 잘려 나가고, 그건 이 게이트를 쓸모없게 만든다.
import { describe, expect, it } from 'vitest'

import { hasSensitiveTopic, isPrintablePassage } from './csat-format'

describe('학교 교재에 못 싣는 소재', () => {
  it('실측으로 걸린 네 갈래를 잡는다', () => {
    // 전부 저장소에 실재하는 원글의 실제 문장·제목에서 왔다.
    expect(hasSensitiveTopic('the US Supreme Court revoked the constitutional right to abortion')).toBe(true)
    expect(hasSensitiveTopic('An Urgent Need to Restrict Access to Pesticides Based on Human Lethality: suicide')).toBe(true)
    expect(hasSensitiveTopic('HIV transmission among sex work networks in the region')).toBe(true)
    expect(hasSensitiveTopic('a qualitative assessment of schemas linked to substance abuse')).toBe(true)
  })

  it('시중 교재가 **실제로 다루는** 소재는 건드리지 않는다', () => {
    // 넓은 목록이 잘라 낼 뻔한 것들 — 전쟁사·선거·종교문화·의약품·보건정책은 교재의 단골 소재다.
    const fine = [
      'The election of the president brought disputes over development plans back into the spotlight.',
      'During the war, civilians relied on rationed supplies for four years.',
      'Buddhist temple architecture in Korea developed its own regional style.',
      'The drug was approved after three phases of clinical trials.',
      'Public health campaigns reduced smoking rates by a third.',
      'Sexual reproduction in flowering plants depends on pollinators.',
    ]
    for (const s of fine) expect(hasSensitiveTopic(s), s).toBe(false)
  })

  it('낱말 경계를 지킨다 — 부분 일치로 번지지 않는다', () => {
    expect(hasSensitiveTopic('The cocoa harvest failed that year.')).toBe(false)
    expect(hasSensitiveTopic('Heroines of the revolution were later erased from the record.')).toBe(false)
  })

  it('**인쇄 가능 판정 한 곳**에서 걸린다 — 게이트를 각자 들게 두지 않는다', () => {
    // 생성기 8곳과 드레인 뽑기가 `isPrintablePassage` 를 공유한다. 소재 규칙을 따로 두면
    // 반드시 한 곳이 빠진다 — 이 저장소에서 이미 세 번 그랬다(인용 잔해 · 용어풀이 · 기사 껍데기).
    expect(isPrintablePassage('A clean sentence about photosynthesis in leaves.')).toBe(true)
    expect(isPrintablePassage('A clean sentence that nevertheless discusses abortion access.')).toBe(false)
  })
})

/**
 * **시대적 인종·민족 비하 표현.**
 *
 * 3인 검수가 인쇄 직전에 잡았다(실측 2026-09-13) — V5 지면 문항의 마지막 문장이
 * `the deep-seated treachery in the oriental mind` 였다. 독자가 한국 고등학생인 교재다.
 * 이 밴드의 재고는 공개 도메인 **고전**에서 오므로 시대의 차별 표현이 본문에 그대로 있고,
 * **형식 검사로는 영원히 안 걸린다** — 문장은 완벽하게 멀쩡하게 읽힌다.
 */
describe('hasSensitiveTopic — 인종·민족 비하', () => {
  it('검수가 실제로 잡아낸 그 문장을 막는다', () => {
    expect(
      hasSensitiveTopic('He wrote of the deep-seated treachery in the oriental mind.'),
    ).toBe(true)
  })

  it('고전에 흔한 비하 표현을 막는다', () => {
    for (const s of [
      'The negroes worked the fields from dawn.',
      'They called the islanders savages.',
      'The savage tribes had no written law.',
      'Missionaries were sent to the heathen.',
    ]) {
      expect(hasSensitiveTopic(s), s).toBe(true)
    }
  })

  /**
   * ⚠️ **낱말 하나로 막지 않는다.** `savage` 가 형용사면 비하가 아니다 —
   * 여기서 넓게 잡으면 멀쩡한 지문이 통째로 날아간다.
   */
  it('형용사로 쓰인 것은 막지 않는다 — 넓은 자가 재고를 죽인다', () => {
    expect(hasSensitiveTopic('A savage storm tore through the harbour.')).toBe(false)
    expect(hasSensitiveTopic('The competition was savage but fair.')).toBe(false)
  })

  it('지리·언어를 가리키는 평범한 말은 막지 않는다', () => {
    expect(hasSensitiveTopic('The Oriental Institute published the tablets.')).toBe(true)
    // ↑ 기관명이라도 막힌다. 지문 하나를 잃는 비용 < 비하 표현을 인쇄하는 비용.
    expect(hasSensitiveTopic('East Asian trade routes expanded in the period.')).toBe(false)
  })
})
