// apps/web/src/lib/csat/reflow/__tests__/reflow.test.ts
//
// **reflow 가 조용히 짧게 뽑는 경로를 잠근다** — 원문 없이, 합성 조각으로.
//
// Gate 1(2026-09-17)에서 실측으로 잡은 결함 셋(docs/csat-learner/DECISIONS.md D6)은 전부 오류 없이
// **덜 뽑히는** 종류였다 — 화면은 멀쩡히 뜨고 선지 하나·지문 꼬리가 사라진다. 여기서 그대로 재현한다.
//   ① 바닥글 규칙 `/저작권/` 이 선지 「…저작권 보호…」를 버렸다
//   ② `※` 로 자르기가 안내문 본문 `※ All passes…` 에서 지문을 잘랐다
//   ③ 묶음 머리글 발문이 두 줄인데 첫 줄만 읽었다
// 그리고 기호 선지 목록이 코퍼스 빌드와 같은지, 문장 정렬이 쪽 번호 잡음을 견디는지.

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { alignSentences, anchorMatchRate, skeletonToReflow } from '../align'
import { detectAnchors, examIdFromText } from '../detect'
import { INLINE_SYMBOL_TYPES, choiceStart, joinLines, readingLines, reflowExam } from '../reflow'
import type { PageFrags, PdfFrag, ReflowAnchors } from '../types'

const W = 842
const H = 1191
const L = 88 // 왼 단 여백(문항 번호 x)
const R = 437 // 오른 단 여백
const STEP = 16.5

/** 한 줄 = 조각 하나(글자당 6pt 폭). 번호 줄은 번호 조각을 따로 둔다. */
function line(str: string, x: number, y: number): PdfFrag {
  return { str, x, y, w: str.length * 6, h: 11.5 }
}

/** 단 하나를 위에서부터 채운다 — 문항 번호가 있는 줄은 `'18. 발문'` 처럼 쓴다 */
function column(lines: string[], x0: number, top = 1000): PdfFrag[] {
  const out: PdfFrag[] = []
  lines.forEach((t, i) => {
    const y = top - i * STEP
    const m = t.match(/^(\d{1,2}\.)\s(.*)$/)
    if (m) {
      out.push({ str: m[1], x: x0, y, w: 12, h: 13.5 })
      out.push(line(m[2], x0 + 20, y))
    } else {
      out.push(line(t, x0 + 12, y))
    }
  })
  return out
}

const PAGE1_LEFT = [
  '18. 다음 글의 목적으로 가장 적절한 것은?',
  'Dear members, we changed the club rules this week.',
  'The new rules protect well-',
  'known traditions of the club. Thank you.',
  '① 규칙 변경을 알리려고',
  '② 디지털 창작물의 저작권 보호를 요청하려고',
  '③ 회비 인상을 공지하려고',
  '④ 모임 장소를 바꾸려고',
  '⑤ 신입 회원을 모집하려고',
  '19. Fun Pass에 관한 다음 안내문의 내용과 일치하는 것은?',
  'Fun Pass Season Two free games a day.',
  '※ All passes include a food discount.',
  '① 온라인 구매만 가능하다.',
  '② 양도할 수 있다.',
  '③ 하루 세 게임이다.',
  '④ 음식 할인이 없다.',
  '⑤ 지점 제한이 있다.',
]
const PAGE1_RIGHT = [
  '[20～21] 글의 흐름으로 보아, 주어진 문장이 들어가기에 가장',
  '적절한 곳을 고르시오.',
  '20. The difference is that games are models.',
  'A game has its own reality. ( ① ) Players act. ( ② ) Players see.',
  '( ③ ) Players feel. ( ④ ) Players learn. ( ⑤ ) It ends. [3점]',
  '21. Rules shape play in every game we know.',
  'Players accept them. ( ① ) They agree. ( ② ) They wait.',
  '( ③ ) They move. ( ④ ) They stop. ( ⑤ ) They win.',
  '※ 확인 사항',
  '◦ 답안지의 해당란에 필요한 내용을 정확히 기입(표기)했는지 확인',
  '하시오.',
]

function fixture(): { pages: PageFrags[]; anchors: ReflowAnchors } {
  const frags = [
    ...column(PAGE1_LEFT, L),
    ...column(PAGE1_RIGHT, R),
    // 머리글·바닥글 — 걸러져야 한다
    line('홀수형', 95, 1060),
    line('이 문제지에 관한 저작권은 한국교육과정평가원에 있습니다.', 495, 77),
    line('3', 400, 97),
  ]
  const pages: PageFrags[] = [{ p: 1, w: W, h: H, frags }]
  const detected = detectAnchors([...pages, ...pages.map((p) => ({ ...p, p: 2, frags: [] }))])
  // 색인과 같은 모양 — 번호 줄의 좌표
  const items = [
    { no: 18, col: 0, y: 1000 },
    { no: 19, col: 0, y: 1000 - 9 * STEP },
    { no: 20, col: 1, y: 1000 - 2 * STEP },
    { no: 21, col: 1, y: 1000 - 5 * STEP },
  ].map((i) => ({ ...i, p: 1, x: i.col ? R : L, w: 12, h: 13.5 }))
  void detected
  return { pages, anchors: { form_pages: 1, items } }
}

const TYPES: Record<number, string> = { 18: 'R-PURPOSE', 19: 'R-NOTICE', 20: 'R-INSERT', 21: 'R-INSERT' }

describe('reflow — 조용히 덜 뽑히는 경로', () => {
  const { pages, anchors } = fixture()
  const out = reflowExam(pages, anchors, (no) => TYPES[no] ?? null)

  it('머리글·바닥글·쪽 번호는 줄이 되지 않는다', () => {
    const texts = readingLines(pages, anchors).map((l) => l.text)
    expect(texts.some((t) => /홀수형|문제지에 관한 저작권은/.test(t))).toBe(false)
    expect(texts).not.toContain('3')
  })

  it('① 선지 속 「저작권」은 바닥글이 아니다 — 선지 5개가 다 남는다', () => {
    const it18 = out.get(18)!
    expect(it18.choices).toHaveLength(5)
    expect(it18.choices[1]).toContain('저작권 보호')
    expect(it18.stem).toBe('다음 글의 목적으로 가장 적절한 것은?')
  })

  it('줄 끝 하이픈은 공백 없이 잇는다(`well-` + `known`)', () => {
    expect(out.get(18)!.passage).toContain('well-known traditions')
  })

  it('② 안내문 본문의 `※` 에서 자르지 않는다', () => {
    const it19 = out.get(19)!
    expect(it19.passage).toContain('※ All passes include a food discount.')
    expect(it19.choices).toHaveLength(5)
  })

  it('③ 두 줄짜리 묶음 머리글 발문을 끝까지 읽는다', () => {
    expect(out.get(20)!.stem).toBe('글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳을 고르시오. [3점]')
    expect(out.get(21)!.stem).toContain('적절한 곳을 고르시오.')
  })

  it('지문 꼬리의 「[3점]」은 지문이 아니라 발문으로 간다', () => {
    expect(out.get(20)!.passage).not.toContain('3점')
    expect(out.get(20)!.passage.endsWith('It ends.')).toBe(true)
  })

  it('기호 선지 유형은 본문의 ①~⑤ 에서 자르지 않는다', () => {
    const it20 = out.get(20)!
    expect(it20.inline).toBe(true)
    expect(it20.choices).toEqual([])
    for (const c of '①②③④⑤') expect(it20.passage).toContain(c)
  })

  it('마지막 쪽 「확인 사항」 상자는 마지막 문항에 붙지 않는다', () => {
    const it21 = out.get(21)!
    expect(it21.passage).not.toMatch(/확인|답안지|하시오/)
    expect(it21.ok).toBe(true)
  })

  it('문항이 차지한 자리(크롭 폴백용)가 단마다 있다', () => {
    expect(out.get(18)!.boxes).toEqual([expect.objectContaining({ p: 1, col: 0 })])
  })
})

describe('선지 블록 판정 — 코퍼스 빌드와 같은 규칙', () => {
  it('줄머리 ① 뒤로 ②③④⑤ 가 차례로 나와야 선지 블록이다', () => {
    expect(choiceStart(['본문', '① a', '② b', '③ c', '④ d', '⑤ e'])).toBe(1)
    expect(choiceStart(['① her mother dealt', 'with it', '② and so on'])).toBe(-1)
  })

  it('기호 선지 유형 목록이 `scripts/csat/lib-passage.mjs` 와 같다', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../../../../../scripts/csat/lib-passage.mjs'), 'utf8')
    const block = src.slice(src.indexOf('export const INLINE_SYMBOL_TYPES'))
    const ids = [...block.slice(0, block.indexOf('])')).matchAll(/'([A-Z]-[A-Z0-9]+)'/g)].map((m) => m[1]).sort()
    expect([...INLINE_SYMBOL_TYPES].sort()).toEqual(ids)
  })

  it('줄 잇기 — 긴 줄표 뒤도 공백 없이', () => {
    expect(joinLines(['it was—', 'finally over'])).toBe('it was—finally over')
    expect(joinLines(['one', 'two'])).toBe('one two')
  })
})

describe('문장 정렬 — DB 지문 잡음을 견딘다', () => {
  it('순번이 한 칸 밀려도(쪽 번호가 두 문장을 붙임) 나머지가 맞는다', () => {
    const skel = [40, 50, 100, 30, 60, 70] // 셋째 = 두 문장이 「8 」로 붙은 것(48 + 50 + 2)
    const mine = [40, 50, 48, 50, 30, 60, 70]
    expect(anchorMatchRate(skel, mine)).toEqual({ matched: 6, total: 6 })
    const map = skeletonToReflow(skel, mine)
    expect(map[2]).toEqual([2, 3])
    expect(map[5]).toEqual([6])
  })

  it('대응이 없는 문장은 빈 배열 — 억지로 붙이지 않는다', () => {
    const blocks = alignSentences([40, 50], [40, 50, 300])
    expect(blocks.at(-1)).toMatchObject({ a: [], b: [2], ok: false })
  })
})

describe('모르는 파일 — 그 자리에서 번호 찾기 · 회차 식별', () => {
  it('합성 쪽에서 색인과 같은 번호 자리를 찾는다', () => {
    const { pages, anchors } = fixture()
    // 번호 20개 문턱 — 합성 쪽은 넷뿐이라 같은 쪽을 다섯 번 붙인다
    const many: PageFrags[] = Array.from({ length: 5 }, (_, k) => ({
      ...pages[0],
      p: k + 1,
      frags: pages[0].frags.map((f) =>
        /^\d{1,2}\.$/.test(f.str) ? { ...f, str: `${Number(f.str.slice(0, -1)) + k * 4}.` } : f,
      ),
    }))
    const got = detectAnchors(many)
    expect(got).not.toBeNull()
    const first = got!.items.filter((i) => i.p === 1).map((i) => ({ no: i.no, col: i.col }))
    expect(first).toEqual(anchors.items.map((i) => ({ no: i.no, col: i.col })))
  })

  it('첫 쪽 글자로 회차를 읽는다 — 2014 A/B 는 고르게 둔다', () => {
    expect(examIdFromText('2026학년도 대학수학능력시험 문제지 영어 영역')).toBe('2026')
    expect(examIdFromText('2027학년도 대학수학능력시험 6월 모의평가 문제지')).toBe('M2706')
    expect(examIdFromText('2026학년도 대학수학능력시험 9월 모의평가')).toBe('M2609')
    expect(examIdFromText('2014학년도 대학수학능력시험 문제지')).toBeNull()
    expect(examIdFromText('영어 듣기 대본')).toBeNull()
  })
})
