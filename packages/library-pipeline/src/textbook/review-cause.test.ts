// packages/library-pipeline/src/textbook/review-cause.test.ts
//
// ⚠️ **표본은 전부 DB 실측 문장이다**(csat_item_reviews.findings · 2026-09-13).
//   지어낸 문장으로 검사하면 규칙이 실제 사유를 못 맞혀도 초록이 된다.
import { describe, expect, it } from 'vitest'

import { CAUSE_LABEL, REVIEW_CAUSES, classifyCause, tallyCauses } from './review-cause'

const real = {
  extraction: [
    '밑줄 ① "Collect" 가 지문 제목("Why Does USGS Collect Storm-Tide Sensor Data?")에 있다 — 제목이 본문 첫 문장으로 추출됐다',
    '"Explanation:" 라벨을 학습자가 문제의 일부로 읽는다',
    '지문 분할이 약어에서 두 번 깨졌다 — a.m. 의 마침표가 문장을 쪼갰다.',
    '(C) 는 여는 따옴표만, (A) 는 닫는 따옴표만 있다 — 블록 경계가 한 인용문의 가운데를 자른다',
    '지문이 서로 무관한 아포리즘 다섯 편의 조각이고 제목이 전부 본문에 눌어붙었다',
  ],
  standalone: [
    '(C)의 performance on the task 의 the task 도 선행사가 지문에 없다',
    '근거가 지문 밖(원논문의 모형 설정)에 있다 — 학습자가 알 수 없는 사실로 답을 가른다.',
    '화자가 중간에 바뀌어 누가 말하는지 학습자가 못 가른다',
  ],
  item_build: [
    '치환이 고정 복합명사 "climate change" 의 한쪽을 갈아 끼웠다',
    '① 이 밑줄 친 "Internal" 은 정답 ③이 돌려놓아야 할 낱말 그 자체다',
    '밑줄 ① 이 "William" — 고유명사라 오답 자리를 하나 버린 셈이다',
  ],
  answer: [
    '정답 ①(A)-(C)-(B) 가 유일하지 않다 — ②(B)-(A)-(C) 도 성립한다.',
    '바꿔 넣은 반대말이 그 문맥에서 오히려 자연스럽다',
    '정답이 마지막 자리 ⑤ 다 — 글 끝에 덧붙이는 자리는 논리 단서가 약해 변별력이 낮다',
  ],
  level_fit: [
    '고1(V-Level 5) 창 밖 어휘가 지문 해석을 좌우한다 — gwely · da · tribesmen · husbandry',
    '지문이 기상 관측 일지라 산문이 아니다 — wet bulb(습구)는 과학 용어이고 고1이 읽을 글의 형태가 아니다',
    '소재가 학습자의 세계 밖이다 — Competency Based Medical Education · ambulatory settings',
  ],
  sensitive: [
    '지문 마지막 문장에 the deep-seated treachery in the oriental mind 가 인쇄된다 — 동양인 전체를 기만적이라고 규정하는 문장이고 지문 교체로만 해결된다',
  ],
  distractor: [
    '① "cannot" 과 ④ "walking" 이 같은 이유로 틀린다 — 둘 다 중립어라 반의어를 넣어 볼 자리가 아니다',
    '오답 배열 4개 중 셋이 읽기 전에 탈락한다 — 실질 2지선다다',
    '③ "current" 는 고1 눈에는 정답보다 더 수상해 보인다 — 매력이 아니라 오도다',
  ],
  explanation: ['해설이 가리키는 자리가 정답 자리와 다르다'],
  type_fit: [
    'answer_key.rule 이 demonstrative 인데 ⑤ 자리의 that 은 지시어가 아니라 접속사다',
  ],
} as const

describe('classifyCause — 실측 사유를 계열로 접는다', () => {
  for (const [cause, samples] of Object.entries(real)) {
    for (const s of samples) {
      it(`${cause}: ${s.slice(0, 28)}…`, () => {
        expect(classifyCause(s).cause).toBe(cause)
      })
    }
  }

  // ⚠️ 이 검사가 이 모듈의 정직성 그 자체다 — 가까운 칸에 밀어 넣으면 「추출만 고치면 된다」는
  //   거짓 확신이 생기고, 고친 뒤에도 차단이 안 줄어든다.
  it('못 맞히면 unknown — 가까운 계열에 밀어 넣지 않는다', () => {
    expect(classifyCause('학습자가 이 문항을 좋아하지 않을 것 같다').cause).toBe('unknown')
    expect(classifyCause('').cause).toBe('unknown')
    expect(classifyCause(undefined as unknown as string).cause).toBe('unknown')
  })

  it('여러 계열에 걸리면 그 사실을 함께 낸다 — 접은 것은 보고지 판정이 아니다', () => {
    const v = classifyCause('밑줄 ① "Collect" 가 지문 제목에 있다 — 제목이 본문 첫 문장으로 추출됐다')
    expect(v.matched.length).toBeGreaterThan(1)
    expect(v.matched).toContain('item_build')
    // 겉 증상은 밑줄이지만 고칠 곳은 추출이다.
    expect(v.cause).toBe('extraction')
  })

  it('뿌리 우선순위는 REVIEW_CAUSES 의 순서다', () => {
    const v = classifyCause('선행사가 없고 해설도 틀렸다')
    expect(v.matched).toEqual(expect.arrayContaining(['standalone', 'explanation']))
    expect(REVIEW_CAUSES.indexOf(v.cause as never)).toBe(
      Math.min(...v.matched.map((m) => REVIEW_CAUSES.indexOf(m))),
    )
  })

  it('계열마다 이름과 고칠 자리가 있다 — 없으면 화면이 계열 코드를 그대로 찍는다', () => {
    for (const c of [...REVIEW_CAUSES, 'unknown' as const]) {
      expect(CAUSE_LABEL[c]?.label, c).toBeTruthy()
      expect(CAUSE_LABEL[c]?.fixes, c).toBeTruthy()
    }
  })

  // ⚠️ 넓은 낱말을 쓰면 unknown 이 0 이 되고, 0 이 된 순간 이 자는 아무것도 안 가린다.
  it('흔한 낱말만으로는 안 걸린다 — 규칙이 무엇이든 잡으면 집계가 무의미해진다', () => {
    for (const s of ['근거가 약하다', '학습자가 어려워한다', '지문이 길다', '문항이 쉽다']) {
      expect(classifyCause(s).cause, s).toBe('unknown')
    }
  })
})

describe('tallyCauses', () => {
  const rows = [
    { itemId: 'a', finding: real.extraction[0] },
    { itemId: 'a', finding: real.standalone[0] },
    { itemId: 'b', finding: real.extraction[1] },
    { itemId: 'c', finding: '아무 규칙에도 안 걸리는 말' },
  ]

  it('사유 수와 문항 수를 따로 센다 — 한 문항이 여러 사유를 받는다', () => {
    const r = tallyCauses(rows)
    expect(r.totalFindings).toBe(4)
    expect(r.totalItems).toBe(3)
    const ext = r.tally.find((t) => t.cause === 'extraction')!
    expect(ext.findings).toBe(2)
    expect(ext.items).toBe(2)
  })

  it('미분류 비율을 낸다 — 이 값이 크면 집계를 근거로 쓰면 안 된다', () => {
    expect(tallyCauses(rows).unknownShare).toBeCloseTo(0.25, 6)
  })

  it('겹쳐 걸린 사유 수를 낸다 — 접기의 불확실성 크기다', () => {
    expect(tallyCauses(rows).ambiguous).toBeGreaterThan(0)
  })

  it('많은 계열이 위에 온다 — 다음에 고칠 것을 그 순서로 고른다', () => {
    const t = tallyCauses(rows).tally
    expect(t[0]!.findings).toBeGreaterThanOrEqual(t[t.length - 1]!.findings)
  })

  it('빈 입력에서 0 으로 나눈 NaN 을 내지 않는다', () => {
    expect(tallyCauses([]).unknownShare).toBe(0)
  })
})
