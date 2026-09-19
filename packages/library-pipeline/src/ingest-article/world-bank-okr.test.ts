// packages/library-pipeline/src/ingest-article/world-bank-okr.test.ts
//
// **이 소스에서 실제로 값을 치르고 배운 것 셋을 잠근다.**
//
//   ① `by-nc` 도 `by` 를 담는다 — 순서를 바꾸면 NC 30%가 CC BY 로 통과한다
//   ② `.txt` 는 선형 읽기 순서가 아니다 — 두 단 교차·각주·러닝헤더가 섞인다
//   ③ handle 이 열쇠다 — DOI 는 일부 유형에만 붙는다(표본 100건 중 26)
//
// 실제 OKR 평문에서 그대로 떼어 온 조각으로 잰다 — 만든 예제로 재면 진짜 함정을 못 잡는다.

import { describe, expect, it } from 'vitest'

import { sourceKey, stableId, isCanonicalSourceKey } from './source-key'
import {
  classifyLine,
  isEnglish,
  originalTextBitstream,
  proseRuns,
  runSourceKey,
  toRestContentUrl,
  trimToSentences,
  worldBankLicense,
} from './world-bank-okr'

// ── ① 라이선스 ───────────────────────────────────────────────────────

describe('라이선스 — NC/ND 를 먼저 떨어뜨린다', () => {
  // 실측 표기 네 갈래(2026-09-07, from=2026-06-01 첫 100건)
  it.each([
    ['CC BY 3.0 IGO', 'http://creativecommons.org/licenses/by/3.0/igo'],
    ['CC BY 3.0 IGO', 'http://creativecommons.org/licenses/by/3.0/igo/'],
    ['CC BY 3.0 IGO', 'https://creativecommons.org/licenses/by/3.0/igo/'],
  ])('표기가 갈려도 CC BY 는 통과한다 — %s', (...rights) => {
    expect(worldBankLicense([...rights, 'World Bank']).ok).toBe(true)
  })

  it('`by-nc` 를 `by` 로 읽지 않는다 — 순서가 뒤집히면 30%가 새어 들어온다', () => {
    const nc = worldBankLicense(['CC BY-NC 3.0 IGO', 'https://creativecommons.org/licenses/by-nc/3.0/igo'])
    expect(nc.ok).toBe(false)
    expect(nc.reason).toBe('nc')
  })

  it('실측된 표기 오류도 NC 로 읽는다 — 라벨이 BY-NC 인데 URL 이 by 인 행이 있다', () => {
    // `CC BY-NC 3.0 IGO | https://creativecommons.org/licenses/by/3.0/igo/ | World Bank` (실측 1건).
    // URL 만 보면 통과한다 — 그래서 **합쳐서** 본다.
    expect(worldBankLicense(['CC BY-NC 3.0 IGO', 'https://creativecommons.org/licenses/by/3.0/igo/']).ok).toBe(false)
  })

  it('ND 는 NC 보다 먼저 판정된다 (BY-NC-ND 를 NC 로 적지 않는다)', () => {
    expect(worldBankLicense(['CC BY-NC-ND 3.0 IGO']).reason).toBe('nd')
  })

  it('유보·없음을 CC BY 로 물러서지 않는다', () => {
    expect(worldBankLicense(['World Bank']).reason).toBe('reserved')
    expect(worldBankLicense([]).reason).toBe('missing')
  })
})

describe('언어 — 표기 여섯 갈래(실측)', () => {
  it.each([['English,en_US'], ['English'], ['en_US'], ['English,en'], ['EN']])('%s 는 영어다', (v) => {
    expect(isEnglish(v.split(','))).toBe(true)
  })
  it('표기가 없으면 영어로 치지 않는다 — 실측 100건 중 6건이 무표기다', () => {
    expect(isEnglish([])).toBe(false)
  })
  it('다른 언어를 영어로 읽지 않는다', () => {
    expect(isEnglish(['Portuguese'])).toBe(false)
    expect(isEnglish(['French,fr_FR'])).toBe(false)
  })
})

// ── ② 평문이 선형이 아니다 ───────────────────────────────────────────

/** WPS4733 첫 쪽 초록 — **두 단이 한 줄에 교차한다**(실측 그대로). */
const TWO_COLUMN =
  '  The present study uses the GIDD, a CGE-                          main cause being increasing skill premia. Third, a trend\n' +
  '  microsimulation model for Global Income Distribution              that may counter-balance the potential anti-globalization\n'

/** WPS4733 본문 — 각주가 쪽 중간에 끼어든다(실측 그대로 축약). */
const FOOTNOTE_SPLICE = [
  '     All of the literature on the global income distribution is concerned with ex-post',
  'assessments of its changes and a large proportion of this literature is focused on',
  'testing whether globalization has increased or decreased global inequality.',
  '',
  '',
  '1',
  '    Most of the discrepancies in the trends in global income distribution arise from the differences in data',
  '     sources, country/year coverage, and the way in which different studies impute missing data.',
].join('\n')

describe('연속 산문 런 — 「표제 + 300낱말」로 자르면 다른 단이 섞인다', () => {
  it('두 단 교차 줄은 산문이 아니다 — 이어 붙이면 문장이 뒤섞인다', () => {
    for (const line of TWO_COLUMN.split('\n').filter(Boolean)) {
      expect(classifyLine(line), `이 줄을 산문으로 읽으면 두 단이 합쳐진다: ${line.slice(0, 50)}`).toBe('break')
    }
    expect(proseRuns(TWO_COLUMN, 5)).toEqual([])
  })

  it('각주 블록은 런을 끊는다 — 본문 한복판에 각주가 박히지 않는다', () => {
    // 각주가 **다른 런**이 되는 것이 요구사항이다(각주만 남는 런은 본문 최소 낱말 120 에
    //   못 미쳐 실제 수확에서는 버려진다 — 여기서는 경계만 확인하려고 20 으로 낮췄다).
    const runs = proseRuns(FOOTNOTE_SPLICE, 20)
    expect(runs[0]!.text).toContain('All of the literature')
    expect(runs.every((r) => !(r.text.includes('All of the literature') && r.text.includes('Most of the discrepancies')))).toBe(true)
    expect(proseRuns(FOOTNOTE_SPLICE, 120)).toEqual([])
  })

  it('쪽 넘김(\\f)은 무조건 런을 끊는다 — 러닝헤더·쪽번호가 그 자리에 산다', () => {
    const a = 'The common understanding is that the recent globalization process has exacerbated inequalities between rich and poor countries and between rich and poor individuals within countries everywhere.'
    const b = 'Increased international trade flows and greater exposure to international travel have all made it easier to assess ones well being within an international context today.'
    const runs = proseRuns(`${a}\n\f${b}\n`, 10)
    expect(runs.map((r) => r.page)).toEqual([0, 1])
    expect(runs[0]!.text).not.toContain('Increased international')
  })

  it('쪽번호(오른쪽 끝)는 런을 끊지 않고 버린다 — 문단 사이에도 낀다', () => {
    expect(classifyLine('                                                     7')).toBe('skip')
    expect(classifyLine('                    iv')).toBe('skip')
  })

  it('왼쪽 끝 숫자는 **각주 번호**다 — 버리면 각주가 본문에 붙는다', () => {
    // 이 한 줄이 없으면 위 각주 테스트가 통과하지 못한다(실제로 그랬다).
    expect(classifyLine('1')).toBe('break')
    expect(classifyLine('  2.')).toBe('break')
  })

  it('표·캡션·서지·URL·불릿은 끊는다', () => {
    expect(classifyLine('Source: World Bank staff calculations.')).toBe('break')
    expect(classifyLine('Figure 2.1, Panel A')).toBe('break')
    expect(classifyLine('Bourguignon, F. and C. Morrisson. 2002. Inequality among world citizens.')).toBe('break')
    expect(classifyLine('  see http://econ.worldbank.org for details')).toBe('break')
    expect(classifyLine('  • the first component deals with the structure of the tax system')).toBe('break')
  })

  it('러닝헤더(대문자 표제)는 끊는다', () => {
    expect(classifyLine('  ON THE MEASUREMENT OF MARKET-ORIENTED REFORMS')).toBe('break')
  })

  it('인코딩이 깨진 줄은 끊는다 — 낱말이 이미 망가져 있다', () => {
    expect(classifyLine('We are grateful to Jos� Fanelli for valuable comments and suggestions here.')).toBe('break')
  })

  it('평범한 본문 줄은 산문이다 — 게이트가 전부를 끊으면 수확량이 0 이 된다', () => {
    expect(classifyLine('into the global economy, the debate on income disparities around the world has')).toBe('prose')
  })

  it('줄 끝 하이픈은 낱말을 붙인다 — `informa- tion` 을 만들지 않는다', () => {
    const runs = proseRuns(
      'The distribution of global income across countries and within them depends on house-\n' +
        'hold income has changed a great deal over the past three decades in ways that matter.\n',
      10,
    )
    expect(runs[0]!.text).toContain('household income')
  })

  it('런의 양 끝을 문장 경계로 자른다 — 쪽 첫 줄의 조각으로 시작하지 않는다', () => {
    expect(trimToSentences('reforms in the tax system, some changes must be made. They fall into three components. The first')).toBe(
      'They fall into three components.',
    )
  })

  it('앞 절반이 조각이면 그 런은 버린다 (억지로 살리지 않는다)', () => {
    expect(trimToSentences('aaaa bbbb cccc dddd eeee ffff gggg hhhh Xy.')).toBe('')
  })
})

// ── ③ 열쇠 ───────────────────────────────────────────────────────────

const XOAI_BUNDLES = `<element name="bundles">
   <element name="bundle">
      <field name="name">LICENSE</field>
      <element name="bitstreams"><element name="bitstream">
         <field name="name">license.txt</field>
         <field name="url">https://openknowledge.worldbank.org/bitstreams/AAA/download</field>
         <field name="size">1748</field>
      </element></element>
   </element>
   <element name="bundle">
      <field name="name">ORIGINAL</field>
      <element name="bitstreams">
        <element name="bitstream">
         <field name="name">WPS4733.pdf</field>
         <field name="url">https://openknowledge.worldbank.org/bitstreams/BBB/download</field>
         <field name="size">611534</field>
        </element>
        <element name="bitstream">
         <field name="name">WPS4733.txt</field>
         <field name="url">https://openknowledge.worldbank.org/bitstreams/4e108e1b-f8f3-50f0-bf73-a2193d3f0dc7/download</field>
         <field name="size">64203</field>
        </element>
      </element>
   </element>
</element>`

describe('비트스트림 — ORIGINAL 의 .txt 만 본다', () => {
  it('LICENSE 번들의 license.txt 를 본문으로 착각하지 않는다', () => {
    const got = originalTextBitstream(XOAI_BUNDLES)
    expect(got?.url).toContain('4e108e1b-f8f3-50f0-bf73-a2193d3f0dc7')
    expect(got?.bytes).toBe(64203)
  })

  it('프런트 경로가 아니라 REST content 경로를 준다 — 프런트는 500 이다(실측)', () => {
    // 「배선 성공 · 실행 성공 · 결과 0」이 여기서 났다. 되돌리면 14/14 가 다시 실패한다.
    expect(originalTextBitstream(XOAI_BUNDLES)!.url).toBe(
      'https://openknowledge.worldbank.org/server/api/core/bitstreams/4e108e1b-f8f3-50f0-bf73-a2193d3f0dc7/content',
    )
    expect(toRestContentUrl('https://openknowledge.worldbank.org/bitstreams/4e108e1b-f8f3-50f0-bf73-a2193d3f0dc7/download')).toContain(
      '/server/api/core/bitstreams/',
    )
    // uuid 를 못 읽으면 **바꾸지 않는다** — 조용히 망가진 주소를 만들지 않는다.
    expect(toRestContentUrl('https://example.org/x.txt')).toBe('https://example.org/x.txt')
  })

  it('.txt 가 없으면 null — PDF 로 물러서지 않는다(파싱기를 만들지 않는다)', () => {
    expect(originalTextBitstream(XOAI_BUNDLES.replace('WPS4733.txt', 'WPS4733.epub'))).toBeNull()
  })
})

describe('열쇠 — handle 이다 (DOI 가 아니다)', () => {
  it('OAI identifier 와 handle URL 이 같은 열쇠를 만든다', () => {
    const fromOai = stableId('worldbank', { guid: 'oai:openknowledge.worldbank.org:10986/6318' })
    const fromUrl = stableId('worldbank', { url: 'https://hdl.handle.net/10986/6318' })
    expect(fromOai).toBe('10986/6318')
    expect(fromUrl).toBe(fromOai)
  })

  it('DOI 만 있으면 던진다 — DOI 는 일부 유형에만 붙는다(표본 100건 중 26)', () => {
    expect(() => stableId('worldbank', { doi: '10.1596/1813-9450-2961' })).toThrow(/안정 식별자를 유도하지 못했다/)
  })

  it('curated URL 로 물러서지 않는다 — 연도 경로가 박혀 재구성이 불안정하다', () => {
    expect(() =>
      stableId('worldbank', { url: 'http://documents.worldbank.org/curated/en/2003/01/2138050/strategic-planning' }),
    ).toThrow()
  })

  it('쪽 발췌 열쇠는 원본과 다른 행이 되고 규약 모양이다', () => {
    const k = runSourceKey('10986/6318', { page: 19, words: 389, text: 'x' })
    expect(k).toBe('worldbank:10986/6318#p20-20')
    expect(isCanonicalSourceKey('worldbank', k)).toBe(true)
    expect(isCanonicalSourceKey('worldbank', sourceKey('worldbank', { url: 'https://hdl.handle.net/10986/6318' }))).toBe(true)
  })

  it('해시·제목 꼴은 규약이 아니다', () => {
    expect(isCanonicalSourceKey('worldbank', 'worldbank:strategic-planning-vietnam')).toBe(false)
  })
})
