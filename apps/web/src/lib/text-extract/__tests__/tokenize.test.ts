// apps/web/src/lib/text-extract/__tests__/tokenize.test.ts
//
// 토크나이저 누수 회귀 — v06.35 이전 구현이 실측으로 흘리던 6종을 고정한다.
// 각 describe 는 "무엇이 새던 문제인가" 를 제목에 담는다. 실패하면 그 누수가 되살아난 것.

import { describe, expect, it } from 'vitest'

import { tokenizeText } from '../tokenize'

/** 테스트 가독성 — 결과 단어를 Set 으로 */
function wordsOf(text: string): Set<string> {
  return new Set(tokenizeText(text).words)
}

describe('축약형 — 비단어 파편을 만들지 않는다', () => {
  it('n\'t 축약을 어간으로 되돌린다 (didn → did)', () => {
    const w = wordsOf("We didn't know. It wasn't obvious. They aren't simple.")
    expect(w.has('didn')).toBe(false)
    expect(w.has('wasn')).toBe(false)
    expect(w.has('aren')).toBe(false)
    // 어간은 stopword(did/was/are) 라 최종 목록엔 없지만, 파편이 없다는 것이 핵심
    expect([...w].every((x) => !/n$/.test(x) || x.length > 4)).toBe(true)
  })

  it('원문에 없던 실재 단어를 만들어내지 않는다 — won\'t→won, don\'t→don', () => {
    // 이것이 가장 위험한 누수였다: 'won'·'don' 은 사전에 있으므로
    // 전 단계 필터를 통과해 "원문에 없던 단어" 를 학습자에게 가르쳤다.
    const w = wordsOf("They won't tell you why, and they don't have to.")
    expect(w.has('won')).toBe(false)
    expect(w.has('don')).toBe(false)
  })

  it('modal 축약 파편을 만들지 않는다 — couldn/shouldn/wouldn/isn/hasn', () => {
    const w = wordsOf("Couldn't we ask? Shouldn't we? It isn't done and hasn't been.")
    for (const fragment of ['couldn', 'shouldn', 'wouldn', 'isn', 'hasn']) {
      expect(w.has(fragment)).toBe(false)
    }
  })

  it('clitic 파편(ll/re/ve/rm)을 만들지 않고 어간을 남긴다', () => {
    const w = wordsOf("You've heard it. They'll answer. We're building. Humanity's future.")
    for (const fragment of ['ll', 're', 've', 'm']) {
      expect(w.has(fragment)).toBe(false)
    }
    // 소유격은 어간이 살아남아야 한다
    expect(w.has('humanity')).toBe(true)
  })

  it('불규칙 축약을 올바른 어간으로 복원한다', () => {
    const r = tokenizeText("We can't stop. It won't end. Let's begin.")
    const w = new Set(r.words)
    // "ca"·"wo" 같은 절단 파편이 없어야 한다
    expect(w.has('ca')).toBe(false)
    expect(w.has('wo')).toBe(false)
    expect(r.diagnostics.contractionsResolved).toBeGreaterThan(0)
  })

  it('어휘 내부 아포스트로피는 전체형을 보존한다 — o\'clock', () => {
    const w = wordsOf("The meeting starts at three o'clock sharp.")
    expect(w.has("o'clock")).toBe(true)
  })
})

describe('아포스트로피 종류 — 붙여넣기 출처가 결과를 바꾸지 않는다', () => {
  const ascii = "We didn't know what they'd built, and it wasn't obvious."
  const curly = ascii.replace(/'/g, '’')

  it('U+0027 과 U+2019 가 동일한 결과를 낸다', () => {
    expect(tokenizeText(curly).words).toEqual(tokenizeText(ascii).words)
  })

  it('타이포그래픽 아포스트로피에서도 파편이 없다', () => {
    const w = new Set(tokenizeText(curly).words)
    for (const fragment of ['didn', 'wasn', 'll', 're', 've']) {
      expect(w.has(fragment)).toBe(false)
    }
  })
})

describe('숫자 결합 토큰 — 알파벳 앞부분만 남기지 않는다', () => {
  it('CO2·Cas9 에서 co·cas 파편을 만들지 않는다', () => {
    const r = tokenizeText('Concentrations passed 420 ppm. CRISPR-Cas9 and CO2 levels rose.')
    const w = new Set(r.words)
    expect(w.has('co')).toBe(false)
    expect(w.has('cas')).toBe(false)
    expect(r.diagnostics.numericDropped).toBeGreaterThan(0)
  })

  it('숫자 없는 이웃 단어는 그대로 살아남는다', () => {
    const w = wordsOf('Concentrations passed 420 ppm worldwide.')
    expect(w.has('concentrations')).toBe(true)
    expect(w.has('ppm')).toBe(true)
    expect(w.has('worldwide')).toBe(true)
  })

  it('자릿수 구분 쉼표가 붙은 수를 조각내지 않는다', () => {
    const w = wordsOf('The Earth absorbs 173,000 terawatts of energy.')
    expect(w.has('terawatts')).toBe(true)
    expect([...w].some((x) => /^\d/.test(x))).toBe(false)
  })
})

describe('상한 절단 — 알파벳 편향이 없다', () => {
  /** a..z 로 고르게 시작하는 인공 unique 단어 생성 */
  function synth(n: number): string {
    const letters = 'abcdefghijklmnopqrstuvwxyz'
    // 접미 글자를 k..t 로 둔다 — a..j 였을 때 `iii`(로마숫자)가 생성돼
    // 비어휘 필터에 걸렸다. 인공 코퍼스가 실재 표기와 겹치면 절단 검사가 아니라
    // 필터 검사가 되어 버린다.
    const digits = 'klmnopqrst'
    const out: string[] = []
    for (let i = 0; i < n; i++) {
      const l = letters[i % 26]!
      const suffix = String(Math.floor(i / 26))
        .split('')
        .map((c) => digits[Number(c)]!)
        .join('')
      out.push(`${l}${l}${suffix}`)
    }
    return out.join(' ')
  }

  it('1,200 unique 를 잘라내지 않는다 (기존 상한 1000 초과)', () => {
    const r = tokenizeText(synth(1200))
    expect(r.diagnostics.truncated).toBe(0)
    expect(r.words.length).toBe(1200)
  })

  it('상한 내에서 어떤 시작 글자도 통째로 사라지지 않는다', () => {
    const r = tokenizeText(synth(1200))
    const firstLetters = new Set(r.words.map((x) => x[0]))
    expect(firstLetters.size).toBe(26)
  })

  it('등장 순서를 유지한다 (알파벳 정렬 금지)', () => {
    const r = tokenizeText('zebra yacht xylophone walnut')
    expect(r.words).toEqual(['zebra', 'yacht', 'xylophone', 'walnut'])
  })
})

describe('비ASCII 자모 — 이름을 파편으로 쪼개지 않는다', () => {
  it('ø 를 포함한 이름이 j + rgensen 으로 갈라지지 않는다', () => {
    const w = wordsOf('Jørgensen presented the findings.')
    expect(w.has('rgensen')).toBe(false)
    expect(w.has('jorgensen')).toBe(true)
  })

  it('결합 발음기호를 ASCII 로 접는다', () => {
    const w = wordsOf('The café in Reykjavík hosted a soirée.')
    expect(w.has('cafe')).toBe(true)
    expect(w.has('reykjavik')).toBe(true)
  })
})

describe('스크립트 관습 — 마커와 화자 라벨이 어휘가 되지 않는다', () => {
  it('[Laughter] 류 대괄호 마커를 제거한다', () => {
    const r = tokenizeText('And then everything changed. [Laughter] But seriously, listen.')
    const w = new Set(r.words)
    expect(w.has('laughter')).toBe(false)
    expect(r.diagnostics.bracketMarkers).toBe(1)
    expect(w.has('seriously')).toBe(true)
  })

  it('줄머리 화자 라벨을 제거한다 (2인 강연·대담)', () => {
    const r = tokenizeText(
      'Chris Anderson: So tell me about the turbines.\nJane Doe: They generate enormous power.',
    )
    const w = new Set(r.words)
    expect(w.has('anderson')).toBe(false)
    expect(w.has('chris')).toBe(false)
    expect(r.diagnostics.speakerLabels).toBe(2)
    expect(w.has('turbines')).toBe(true)
    expect(w.has('enormous')).toBe(true)
  })

  it('문장 중간 콜론은 건드리지 않는다', () => {
    const w = wordsOf('There is one lesson here: perseverance beats talent.')
    expect(w.has('perseverance')).toBe(true)
    expect(w.has('lesson')).toBe(true)
  })
})

describe('하이픈 vs 대시 — 복합어는 잇고 구두점은 끊는다', () => {
  it('하이픈 복합어는 부분과 전체를 모두 후보로 올린다', () => {
    const r = tokenizeText('These self-taught machine-learning systems surprised us.')
    const w = new Set(r.words)
    expect(w.has('self')).toBe(true)
    expect(w.has('taught')).toBe(true)
    expect(w.has('self-taught')).toBe(true)
    expect(w.has('machine-learning')).toBe(true)
    expect(r.diagnostics.hyphenCompounds).toBeGreaterThan(0)
  })

  it('결합형 접두사는 단독 후보가 아니다 — 전체형은 남긴다', () => {
    // 실측(발행 콘텐츠 31편): `non` 8편 · `pre` 6편 · `mid` 4편이 "배울 단어" 로 나갔고,
    // 사전에 없으니 pending_words 에 사전 갭으로도 오적재됐다.
    const r = tokenizeText('Pre-industrial and non-functional mid-century designs were re-examined.')
    const w = new Set(r.words)
    expect(w.has('pre')).toBe(false)
    expect(w.has('non')).toBe(false)
    expect(w.has('mid')).toBe(false)
    expect(w.has('re')).toBe(false)
    // 정보는 사라지지 않는다 — 자유 형태소와 전체형은 그대로 후보
    expect(w.has('industrial')).toBe(true)
    expect(w.has('functional')).toBe(true)
    expect(w.has('pre-industrial')).toBe(true)
    expect(r.diagnostics.boundAffixesDropped).toBeGreaterThan(0)
  })

  it('자유 형태소로도 쓰이는 조각은 그대로 둔다 (self·water·life)', () => {
    // 결합형 목록에 `self`·`water` 류를 넣으면 배울 가치가 있는 단어가 사라진다.
    // (`over`·`well` 은 기능어라 stopword 단계에서 빠지므로 여기서 쓰지 않는다 —
    //  두 단계를 섞으면 무엇이 걸렀는지 알 수 없는 테스트가 된다.)
    const w = wordsOf('A self-taught engineer studied water-based and life-long methods.')
    expect(w.has('self')).toBe(true)
    expect(w.has('water')).toBe(true)
    expect(w.has('life')).toBe(true)
  })

  it('em dash 는 구두점이므로 단어를 잇지 않는다', () => {
    const w = wordsOf('The urgent risks — and what to do about them.')
    expect(w.has('risks')).toBe(true)
    expect([...w].some((x) => x.includes('-'))).toBe(false)
  })

  it('공백에 둘러싸인 하이픈도 구두점으로 본다', () => {
    const w = wordsOf('Renewable energy - and storage - changed everything.')
    expect(w.has('renewable')).toBe(true)
    expect(w.has('storage')).toBe(true)
    expect([...w].some((x) => x.includes('-'))).toBe(false)
  })

  it('soft hyphen 이 단어를 조용히 쪼개지 않는다', () => {
    const w = wordsOf('extra­ordinary discoveries')
    expect(w.has('extraordinary')).toBe(true)
  })
})

describe('빈 입력 · 경계', () => {
  it('빈 문자열은 빈 결과', () => {
    const r = tokenizeText('')
    expect(r.words).toEqual([])
    expect(r.uniqueFinal).toBe(0)
  })

  it('공백만 있는 입력은 빈 결과', () => {
    expect(tokenizeText('   \n\t  ').words).toEqual([])
  })

  it('한 글자 단어는 제외한다', () => {
    const w = wordsOf('I saw a bird.')
    expect(w.has('i')).toBe(false)
    expect(w.has('a')).toBe(false)
    expect(w.has('bird')).toBe(true)
  })

  it('구두점만으로 이루어진 토큰을 만들지 않는다', () => {
    const r = tokenizeText('--- ... !!! ??? \'\'\' ')
    expect(r.words).toEqual([])
  })
})

describe('원문 보존 — 실제 단어를 흘리지 않는다', () => {
  it('구어체 문단에서 내용어가 모두 살아남는다', () => {
    const w = wordsOf(
      "We've spent decades building models, and we're only beginning to " +
        "understand what they've learned. Don't assume the answer is simple.",
    )
    for (const expected of ['spent', 'decades', 'building', 'models', 'beginning', 'understand', 'learned', 'assume', 'answer', 'simple']) {
      expect(w.has(expected)).toBe(true)
    }
  })
})

describe('어휘가 아닌 관습 표기 — 인용·약어·로마숫자·도메인', () => {
  it('et al. 의 al 은 단어가 아니다', () => {
    // 실측: 발행 콘텐츠 31편 중 8편에서 `al` 이 학습 후보로 나갔다(학술 인용 관습).
    const w = wordsOf('As shown by Ritchie et al. (2020), the trend continued.')
    expect(w.has('al')).toBe(false)
    expect(w.has('et')).toBe(false)
    expect(w.has('trend')).toBe(true)
  })

  it('도메인 조각과 약어는 제외한다', () => {
    const w = wordsOf('Available at journals.plos.org and www.usgs.gov, see Table vs Figure.')
    for (const junk of ['org', 'www', 'gov', 'vs']) expect(w.has(junk)).toBe(false)
    expect(w.has('available')).toBe(true)
  })

  it('로마숫자는 열거한 것만 뺀다 — 영어 단어를 삼키지 않는다', () => {
    const w = wordsOf('Chapter ii and section xiv describe a civil mix of methods.')
    expect(w.has('ii')).toBe(false)
    expect(w.has('xiv')).toBe(false)
    // `[ivxlcdm]+` 정규식이었다면 함께 사라졌을 단어들
    expect(w.has('civil')).toBe(true)
    expect(w.has('mix')).toBe(true)
  })

  it('제외 내역을 stopword 와 분리해 보고한다', () => {
    const r = tokenizeText('Ritchie et al. reported vs. the baseline at plos.org.')
    expect(r.diagnostics.nonLexicalDropped).toBeGreaterThan(0)
  })
})
