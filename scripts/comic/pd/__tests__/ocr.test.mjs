// scripts/comic/pd/__tests__/ocr.test.mjs
//
// 대사 추출 순수 함수 회귀.
// 이 파이프라인의 실패는 조용하다 — 깨진 문장이 그대로 학습 콘텐츠가 되고,
// 좌표가 어긋나면 대사존이 그림을 가린다. 그래서 판정·정규화·그룹화를 전부 고정한다.

import { describe, expect, it } from 'vitest'

import { groupLines, isGarbledWord, judgeBubble, normalize, parseHocr, truecase } from '../ocr.mjs'

// ─── truecase ─────────────────────────────────────────────────────
describe('truecase — 전대문자 레터링 복원', () => {
  it('문장 케이스로 낮춘다', () => {
    const { text } = truecase('THE FOLLOWING MORNING HARVEY BIRCH APPEARED.')
    expect(text).toBe('The following morning harvey birch appeared.')
  })

  it('종결부호 뒤를 다시 대문자로 시작한다', () => {
    const { text } = truecase('GO HOME. IT IS LATE! WHY WAIT?')
    expect(text).toBe('Go home. It is late! Why wait?')
  })

  it('1인칭 I 를 복원한다 (단독)', () => {
    const { text } = truecase('YOU AND I WILL GO')
    expect(text).toBe('You and I will go')
  })

  it("축약형 I'm / I'll 을 복원한다", () => {
    const { text } = truecase("I'M GRATEFUL AND I'LL RETURN")
    expect(text.startsWith("I'm grateful")).toBe(true)
    expect(text).toContain("I'll")
  })

  it('gazetteer 에 있는 고유명사는 대문자로 복원한다', () => {
    const { text } = truecase('MY NAME IS WHARTON', new Set(['wharton']))
    expect(text).toBe('My name is Wharton')
  })

  it('gazetteer 에 없으면 후보로만 보고한다 (임의 대문자화 금지)', () => {
    const { text, properNounCandidates } = truecase('MY NAME IS WHARTON')
    expect(text).toBe('My name is wharton') // 멋대로 올리지 않는다
    expect(properNounCandidates).toContain('wharton')
  })

  it('기능어는 고유명사 후보가 아니다', () => {
    const { properNounCandidates } = truecase('THE HOUSE IS OPEN TO STRANGERS')
    expect(properNounCandidates).not.toContain('the')
    expect(properNounCandidates).not.toContain('is')
  })

  it('빈 문자열에서 터지지 않는다', () => {
    expect(() => truecase('')).not.toThrow()
    expect(truecase('').text).toBe('')
  })
})

// ─── 오인식 판정 ──────────────────────────────────────────────────
describe('isGarbledWord — 비라틴 오인식', () => {
  it('라틴 단어는 통과', () => {
    expect(isGarbledWord('Wharton')).toBe(false)
    expect(isGarbledWord("I'm")).toBe(false)
  })

  it('키릴 혼입을 잡는다 (Tesseract 스크립트 자동판별 오류)', () => {
    for (const t of ['іп', 'сай', 'гіз', 'му', 'НЕ']) {
      expect(isGarbledWord(t), `${t} 를 놓쳤다`).toBe(true)
    }
  })
})

describe('judgeBubble — 검수 필요 판정', () => {
  it('정상 문장은 통과한다', () => {
    const r = judgeBubble('Night was coming on and the storm grew worse.', 94)
    expect(r.needsReview).toBe(false)
    expect(r.reasons).toEqual([])
  })

  it('비라틴 혼입이면 사유와 함께 반려', () => {
    const r = judgeBubble('Tu be сай when this war гіз win', 90)
    expect(r.needsReview).toBe(true)
    expect(r.reasons.join(' ')).toMatch(/비라틴/)
  })

  it('짧은 파편이 많으면 반려', () => {
    const r = judgeBubble('a b c d house e f', 95)
    expect(r.needsReview).toBe(true)
    expect(r.reasons.join(' ')).toMatch(/파편/)
  })

  it('3토큰 미만 + 종결부호 없음 = 대사가 아니다 (표지 장식 차단)', () => {
    // 실측: "Featuring" "Stor" 같은 표지 로고가 고신뢰로 통과하던 구멍
    for (const t of ['Featuring', 'Stor', 'Dead wife']) {
      expect(judgeBubble(t, 96).needsReview, `${t} 가 통과했다`).toBe(true)
    }
  })

  it('종결부호가 있으면 짧아도 대사로 인정', () => {
    expect(judgeBubble('Ask?', 90).needsReview).toBe(false)
  })

  it('알파벳 단어가 없으면 반려', () => {
    expect(judgeBubble('%', 97).needsReview).toBe(true)
    expect(judgeBubble('1 2 3', 97).needsReview).toBe(true)
  })

  it('저신뢰는 사유에 남는다', () => {
    const r = judgeBubble('This sentence is perfectly fine.', 61)
    expect(r.needsReview).toBe(true)
    expect(r.reasons.join(' ')).toMatch(/신뢰도/)
  })

  it('빈 텍스트는 반려', () => {
    expect(judgeBubble('   ', 90).needsReview).toBe(true)
  })
})

// ─── 좌표 ─────────────────────────────────────────────────────────
describe('normalize — 컷 기준 0~1 정규화', () => {
  const panel = { x: 100, y: 200, w: 400, h: 300 }

  it('컷 내부 박스를 비율로 바꾼다', () => {
    const n = normalize({ x0: 200, y0: 350, x1: 300, y1: 410 }, panel)
    expect(n).toEqual({ x: 0.25, y: 0.5, w: 0.25, h: 0.2 })
  })

  it('컷 위로 삐져나온 부분은 잘라낸다 — 음수 좌표 금지', () => {
    // 실측 결함: y 가 -0.0295 로 나와 대사존이 컷 밖에 그려졌다
    const n = normalize({ x0: 50, y0: 150, x1: 300, y1: 260 }, panel)
    expect(n.x).toBeGreaterThanOrEqual(0)
    expect(n.y).toBe(0)
    expect(n.x + n.w).toBeLessThanOrEqual(1)
  })

  it('컷 아래로 넘친 부분도 1 을 넘지 않는다', () => {
    const n = normalize({ x0: 400, y0: 400, x1: 900, y1: 900 }, panel)
    expect(n.x + n.w).toBeLessThanOrEqual(1)
    expect(n.y + n.h).toBeLessThanOrEqual(1)
  })
})

describe('groupLines — 라인 → 말풍선', () => {
  const panel = { x: 0, y: 0, w: 1000, h: 1000 }
  const line = (x0, y0, x1, y1, text, lineClass = 'ocr_line') => ({
    rb: { x0, y0, x1, y1 },
    text,
    words: [{ text, conf: 90 }],
    lineClass,
  })

  it('세로로 붙어 있고 가로로 겹치면 한 말풍선', () => {
    const g = groupLines([line(10, 10, 200, 40, 'first'), line(12, 45, 210, 75, 'second')], panel)
    expect(g).toHaveLength(1)
    expect(g[0].lines).toHaveLength(2)
  })

  it('세로로 멀면 다른 말풍선', () => {
    const g = groupLines([line(10, 10, 200, 40, 'a'), line(10, 500, 200, 530, 'b')], panel)
    expect(g).toHaveLength(2)
  })

  it('가로로 안 겹치면 다른 말풍선 (좌우 나란한 풍선)', () => {
    const g = groupLines([line(10, 10, 200, 40, 'left'), line(700, 12, 900, 42, 'right')], panel)
    expect(g).toHaveLength(2)
  })

  it('라인 클래스가 다르면 섞지 않는다 (캡션 ↔ 말풍선)', () => {
    const g = groupLines(
      [line(10, 10, 200, 40, 'cap', 'ocr_caption'), line(12, 45, 210, 75, 'bub', 'ocr_line')],
      panel,
    )
    expect(g).toHaveLength(2)
  })

  it('빈 입력에서 터지지 않는다', () => {
    expect(groupLines([], panel)).toEqual([])
  })
})

// ─── hOCR 파싱 ────────────────────────────────────────────────────
const HOCR = `<?xml version='1.0'?><html><body>
<div class="ocr_page" id="page_000000" title="image &quot;/tmp/a.jp2&quot;; bbox 0 0 2089 3000; ppageno 0">
 <div class="ocr_carea" id="b0" title="bbox 10 10 900 200">
  <p class="ocr_par">
   <span class="ocr_line" id="l0" title="bbox 20 20 500 60; baseline 0 -5">
    <span class="ocrx_word" id="w0" title="bbox 20 20 120 60; x_wconf 96">NIGHT</span>
    <span class="ocrx_word" id="w1" title="bbox 130 20 260 60; x_wconf 91">WAS</span>
   </span>
   <span class="ocr_caption" id="l1" title="bbox 600 20 640 60">
    <span class="ocrx_word" id="w2" title="bbox 600 20 640 60; x_wconf 85">&lt;=</span>
   </span>
  </p>
 </div>
</div>
<div class="ocr_page" id="page_000001" title="image &quot;/tmp/b.jp2&quot;; bbox 0 0 2089 3000; ppageno 0">
 <div class="ocr_carea" id="b1" title="bbox 0 0 100 100">
  <p class="ocr_par">
   <span class="ocr_line" id="l2" title="bbox 5 5 90 40">
    <span class="ocrx_word" id="w3" title="bbox 5 5 90 40; x_wconf 70">HOME</span>
   </span>
  </p>
 </div>
</div>
</body></html>`

describe('parseHocr', () => {
  const pages = parseHocr(HOCR)

  it('페이지를 순서대로 나눈다', () => {
    expect(pages).toHaveLength(2)
    expect(pages[0].box).toEqual({ x0: 0, y0: 0, x1: 2089, y1: 3000 })
  })

  it('단어 bbox 와 신뢰도를 읽는다', () => {
    const w = pages[0].lines[0].words[0]
    expect(w.text).toBe('NIGHT')
    expect(w.box).toEqual({ x0: 20, y0: 20, x1: 120, y1: 60 })
    expect(w.conf).toBe(96)
  })

  it('HTML 엔티티를 푼다', () => {
    const all = pages[0].lines.flatMap((l) => l.words.map((w) => w.text))
    expect(all).toContain('<=')
  })

  it('라인 클래스를 보존한다 (ocr_caption 은 실측상 노이즈 — 하류가 걸러낼 수 있어야)', () => {
    const classes = pages[0].lines.map((l) => l.lineClass)
    expect(classes).toContain('ocr_line')
    expect(classes).toContain('ocr_caption')
  })

  it('빈 입력·깨진 입력에서 터지지 않는다', () => {
    expect(parseHocr('')).toEqual([])
    expect(() => parseHocr('<div class="ocr_page" title="garbage">')).not.toThrow()
  })
})

// ─── 비라틴 판정 — 문장부호 오판 회귀 (2026-08-11) ───────────────────
//
// NON_LATIN 범위를 U+2018(‘)부터로 잡았다가 em-dash(U+2014)가 비라틴으로 오판됐다.
// 만화 레터링에 대시·말줄임표는 흔하다("LATER—" "…"). 그 오판은 노이즈로 끝나지 않았다 —
// 자기발전 스윕이 nonLatinBubbles 를 ×3 으로 감점하므로 **지표 자체가 왜곡됐다.**

describe('isGarbledWord — 문장부호는 비라틴이 아니다', () => {
  it('대시·말줄임표·굽은따옴표는 정상', () => {
    for (const s of ['-\u2014', 'LATER\u2014', 'wait\u2026', 'don\u2019t', '\u201Chi\u201D', 'co\u2010op']) {
      expect(isGarbledWord(s), s).toBe(false)
    }
  })

  it('키릴·한글 오인식은 잡는다 — 이게 원래 목적이다', () => {
    for (const s of ['\u0441\u0430\u0439', '\u0456\u043F', '\u0433\u0456\u0437', '\uAC00\uB098']) {
      expect(isGarbledWord(s), s).toBe(true)
    }
  })

  it('평범한 라틴 단어는 정상', () => {
    for (const s of ['ok', 'Wharton', "I'll", 'caf\u00E9']) {
      expect(isGarbledWord(s), s).toBe(false)
    }
  })
})
