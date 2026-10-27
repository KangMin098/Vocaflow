// packages/library-pipeline/src/ingest-article/voa-credit.test.ts
// 실제 VOA 크레딧 문장(2026-10-27 DB 원문에서 그대로) — 제3자 기반 각색만 PD 기본값에서 뺀다.
import { describe, expect, it } from 'vitest'
import { voaCreditLicense, voaThirdPartySources } from './voa-credit'
import { rightsClassOf, rightsTag } from './rights-tag'

const tail = (credit: string) => `Some story text here.\nI’m Dan Friedell.\n\n${credit}\nWe want to hear from you. Write to us in the Comments section.\n____\n\nalert – n. a warning`

describe('voaThirdPartySources — 크레딧 문장의 제3자 출처', () => {
  it.each([
    ['Dan Friedell adapted this story for Learning English based on reporting by the Associated Press. Hai Do was the editor.', ['Associated Press']],
    ['Bryan Lynn wrote this story for VOA Learning English, based on reports from The Associated Press, Reuters and Agence France-Presse. Ashley Thompson was the editor.', ['Associated Press', 'Reuters', 'Agence France-Presse']],
    ['Mario Ritter adapted this story for VOA Learning English from VOA News, AP, Reuters and the Nobel site. Kelly Jean Kelly was the editor.', ['Associated Press', 'Reuters']],
    ['John Russell adapted this story based on an AFP report.', ['Agence France-Presse']],
    ['Dan Friedell wrote this story for Learning English based on reporting from the Associated Press, BBC, Reuters and The Telegraph. Kathleen Struck was the editor.', ['Associated Press', 'Reuters']],
    // 전량 실측에서 처음 판이 놓친 형태(「통신사 reported this story. X adapted it」)
    ['The Associated Press reported this story. Mario Ritter adapted it for VOA Learning English. George Grow was the editor.', ['Associated Press']],
    ['Katherine Roth reported this story for the Associated Press. Jonathan Evans adapted her report for VOA Learning English.', ['Associated Press']],
    ['The Reuters news service reported this story. Pete Musto adapted it for VOA Learning English. Mario Ritter was the editor.', ['Reuters']],
    ['The Associated Press and VOA News reported on this story. Bryan Lynn adapted the reports for Learning English. Hai Do was the editor.', ['Associated Press']],
    // 문장 단위 판의 전량 실측 누락 형태
    ['Mario Ritter Jr. adapted this Associated Press report for VOA Learning English. George Grow was the editor.', ['Associated Press']],
    ['Hai Do adpated this story for Learning English based on reporting from The Associated Press and Reuters.', ['Associated Press', 'Reuters']],
    ['Maria Danilova reported on this for AP News. John Russell adapted it for Learning English. Hai Do was the editor.', ['Associated Press']],
    ['Bryan Lynn wrote this story for VOA Learning English. Additional material came from VOA correspondent Jeff Seldin, the Associated Press and Reuters.', ['Associated Press', 'Reuters']],
    ['Dan Friedell wrote this story for Learning English. Reuters and the Associated Press contributed material. Mario Ritter, Jr. was the editor.', ['Associated Press', 'Reuters']],
    ['Terry Tang reported this for the Associated Press. Pete Musto adapted it for VOA Learning English.', ['Associated Press']],
    ['Bryan Lynn wrote this story for VOA Learning English. Additional information came from the Associated Press and Reuters.', ['Associated Press', 'Reuters']],
    ['Marsha James wrote this story for VOA Learning English. Her story includes information from an Associated Press report.', ['Associated Press']],
    ['Bryan Lynn wrote this story for VOA Learning English. His story was based on reports from from VOA News, the Associated Press, Reuters and Agence France-Presse.', ['Associated Press', 'Reuters', 'Agence France-Presse']],
    ['Dan Novak adapted this for VOA Learning English from reporting by The Associated Press.', ['Associated Press']],
  ])('%s', (credit, expected) => {
    expect(voaThirdPartySources(tail(credit))).toEqual(expected)
  })

  it.each([
    ['VOA 단독(작성 · 각색 모두 VOA)', 'Nancy Steinbach wrote this story for VOA Learning English. John Russell adapted it.'],
    ['VOA 자체 보도 각색', 'Anna Matteo adapted this story from a VOA News report. Caty Weaver was the editor.'],
    ['크레딧 없음', 'Kelly Jean Kelly was the editor.'],
    // Codex 의미 반례(2026-10-27) — 같은 줄의 단순 동시 출현은 출처가 아니다
    ['기사 내용 보도(대상이 이 글이 아님)', 'Reuters reported that local teachers adapted their teaching method for young students.'],
    ['사진 크레딧 + VOA 각색', 'Photo: Associated Press. John Russell adapted a VOA Learning English story.'],
    ['본문 속 통신사 보도(this 없음)', 'The Associated Press has reported on Russia’s efforts to support the separatists in Ukraine.'],
    ['본문 속 「reported this week」', 'Reuters reported this week that the company adapted its plans.'],
    // 처음 판의 오탐 — 지명 dateline
    ['dateline(지명)', 'Mario Ritter reported this story from Washington for VOA Learning English. George Grow was the editor.'],
    ['통신사 밖 매체만(한계 — 잡지 않음)', 'Dan Friedell wrote this story for Learning English based on reporting from the BBC and The Telegraph.'],
  ])('제3자 아님: %s', (_n, credit) => {
    expect(voaThirdPartySources(tail(credit))).toBeNull()
  })

  it('본문 속 통신사 언급 · 사진 크레딧 · 인터뷰는 크레딧 문장이 아니다', () => {
    const body = [
      'Reuters reported that the river rose two meters overnight.',
      'An official told the Associated Press that roads were closed.',
      'Photo: AFP',
      'Nancy Steinbach wrote this story for VOA Learning English.',
    ].join('\n')
    expect(voaThirdPartySources(body)).toBeNull()
  })
})

describe('권리 표지로 — 기존 분류기가 PD 로 되돌리지 않는다', () => {
  it('제3자 기반 각색: license 는 원문 단위 표기, 분류기 unknown, 해소 필요', () => {
    const license = voaCreditLicense(tail('John Russell adapted this story based on an AFP report.'))!
    expect(license).toContain('Agence France-Presse')
    expect(rightsClassOf(license)).toBe('unknown')
    // DB 트리거 acp_classify_license(2026-10-27 정의)가 public_domain · cc 로 읽지 않는다 → 'restricted'
    expect(license).not.toMatch(/public domain|^PD|CC0|CC-0|CC[- ]BY|-NC|commercial/i)
    const tag = rightsTag({ license, licenseEvidence: 'page' })
    expect(tag.class).toBe('unknown')
    expect(tag.needsResolution).toBe(true)
  })

  it('VOA 단독: 표지 없음(컬렉션 기본값 PD-Government 가 그대로 쓰인다)', () => {
    expect(voaCreditLicense(tail('Nancy Steinbach wrote this story for VOA Learning English. John Russell adapted it.'))).toBeNull()
    expect(rightsClassOf('PD-Government')).toBe('PD')
  })
})

describe('크레딧이 두 줄로 갈린 형태(리뷰 후속-B)', () => {
  it('통신사 보도 문장과 VOA 각색 문장이 다른 줄이어도 통신사 문장으로 잡는다', () => {
    const body = 'Story text.\nThe Associated Press reported this story.\nMario Ritter adapted it for VOA Learning English.\nGeorge Grow was the editor.'
    expect(voaThirdPartySources(body)).toEqual(['Associated Press'])
  })
})
