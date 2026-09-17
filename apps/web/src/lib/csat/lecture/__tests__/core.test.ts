// apps/web/src/lib/csat/lecture/__tests__/core.test.ts
//
// **강의 코어의 계약** — 낭독 표기 · 타깃 목록 · 목소리 고르기 · 재생 엔진.
// 엔진은 가짜 어댑터로 돌린다(소리 없이, 시간만 흐르게) — 순서·붙들기·건너뛰기·멈춤이
// 소리와 무관하게 옳은지를 본다. 소리가 걸린 검사는 Gate 0·2 하네스의 몫이다.

import { describe, expect, it } from 'vitest'

import { LecturePlayer, type PlayerState } from '../player'
import { estimateSec, segmentIssues, sinoKorean, speakKo, speakSegments } from '../speakable'
import { isValidTarget, lectureTargets } from '../targets'
import { pickVoice, utterancePlan, WebSpeechAdapter, type CueOutcome, type TtsAdapter } from '../tts'
import type { Lecture, LectureCue } from '../types'
import { spokenHereOrdinals, validateLecture, type ValidateContext } from '../validate'

describe('한자어 수', () => {
  it.each([
    [1, '일'],
    [10, '십'],
    [11, '십일'],
    [23, '이십삼'],
    [100, '백'],
    [2014, '이천십사'],
    [2026, '이천이십육'],
    [10000, '만'],
    [45000, '사만오천'],
  ])('%i → %s', (n, s) => expect(sinoKorean(n)).toBe(s))
})

describe('낭독 표기', () => {
  it('원문자는 「번」을 겹치지 않고 한글로', () => {
    expect(speakKo('정답은 ③입니다')).toBe('정답은 삼 번입니다')
    expect(speakKo('①번과 ② 번')).toBe('일 번과 이 번')
  })
  it('학년도 · 번 · 퍼센트', () => {
    expect(speakKo('2014학년도 23번')).toBe('이천십사 학년도 이십삼 번')
    expect(speakKo('정답률 40%')).toBe('정답률 사십 퍼센트')
  })
  it('달 이름은 따로 읽는다 — 유월 · 시월', () => {
    expect(speakKo('6월 모의평가와 10월 학력평가')).toBe('유월 모의평가와 시월 학력평가')
  })
  it('글의 순서 기호 (A)(B)(C) 와 A/B', () => {
    expect(speakKo('(A) 다음에 (C)가 옵니다')).toBe('에이 다음에 씨가 옵니다')
    expect(speakKo('A/B 둘 중')).toBe('에이 비 둘 중')
  })
  it('변환 뒤 한국어 조각에는 숫자·원문자가 남지 않는다', () => {
    const [g] = speakSegments([{ lang: 'ko-KR', text: '2019학년도 ④번, 3개 중 1개, 12.5%' }])
    expect(segmentIssues(g)).toEqual([])
  })
  it('한국어 조각의 로마자는 막는다 — 영어는 en-US 조각으로 빼야 한다', () => {
    expect(segmentIssues({ lang: 'ko-KR', text: 'however 가 나오죠' }).join()).toContain('로마자')
    expect(segmentIssues({ lang: 'en-US', text: 'however 가' }).join()).toContain('한글')
    expect(segmentIssues({ lang: 'en-US', text: 'However, less is more.' })).toEqual([])
  })
  it('추정 초 — 음절 수 / 초당 음절 + 문장 쉼', () => {
    // 20음절 한 문장 → 20/4 + 0.3
    expect(estimateSec([{ lang: 'ko-KR', text: '가나다라마바사아자차카타파하가나다라마바.' }])).toBeCloseTo(5.3, 1)
    expect(estimateSec([{ lang: 'en-US', text: 'less is more' }])).toBeCloseTo(3 / 2.6 + 0.3, 1)
  })
})

describe('타깃 목록 — 해설 화면이 실제로 그리는 블록', () => {
  const base = {
    answer: 3,
    answer_unknown: false,
    has_ability: true,
    has_intent: true,
    distractors: [1, 2, 4, 5],
    procedure_len: 4,
    vocab_len: 2,
  }
  it('골격이 있으면 지도와 문장 자리가 생긴다', () => {
    const t = lectureTargets({ ...base, skeleton: { sentences: 6, placedAnchorIds: ['answer', 'reject:2'] } })
    expect(t.useMap).toBe(true)
    expect(t.analysis).toEqual(['head', 'ability', 'intent', 'map', 'answer', 'reject:1', 'reject:2', 'reject:4', 'reject:5', 'procedure', 'vocab'])
    expect(t.anchor).toHaveLength(6)
    expect(isValidTarget(t, { kind: 'anchor', id: 'sentence:5' })).toBe(true)
    expect(isValidTarget(t, { kind: 'anchor', id: 'sentence:6' })).toBe(false)
  })
  it('지도가 있는데 정답이 지도에 못 들면 정답 블록은 **어디에도 없다**', () => {
    const t = lectureTargets({ ...base, skeleton: { sentences: 6, placedAnchorIds: ['reject:2'] } })
    expect(t.useMap).toBe(true)
    expect(t.analysis).not.toContain('answer')
  })
  it('골격이 없으면 문장 자리도 지도도 없고, 정답은 절로 그려진다', () => {
    const t = lectureTargets({ ...base, skeleton: null })
    expect(t.useMap).toBe(false)
    expect(t.anchor).toEqual([])
    expect(t.analysis).toContain('answer')
    expect(t.analysis).not.toContain('map')
  })
  it('정답표가 없는 회차는 정답 블록이 없다', () => {
    const t = lectureTargets({ ...base, answer_unknown: true, skeleton: null })
    expect(t.analysis).not.toContain('answer')
  })
})

describe('목소리 고르기', () => {
  const voices = [
    { name: 'Microsoft Heami', lang: 'ko-KR', localService: true },
    { name: 'Google 한국의', lang: 'ko-KR', localService: false },
    { name: 'Microsoft SunHi Online (Natural) - Korean', lang: 'ko-KR', localService: false },
    { name: 'Google US English', lang: 'en-US', localService: false },
  ]
  it('Natural → Google → 기기 순', () => {
    expect(pickVoice(voices, 'ko-KR')?.name).toContain('Natural')
    expect(pickVoice(voices.slice(0, 2), 'ko-KR')?.name).toContain('Google')
    expect(pickVoice(voices.slice(0, 1), 'ko-KR')?.name).toBe('Microsoft Heami')
  })
  it('해당 언어가 없으면 null — 무음 모드로 간다', () => {
    expect(pickVoice(voices.slice(3), 'ko-KR')).toBeNull()
  })
  it('발화 계획 — 한국어는 문장마다, 영어는 조각째', () => {
    const plan = utterancePlan([
      { lang: 'ko-KR', text: '자, 보세요. 여기 있죠.' },
      { lang: 'en-US', text: 'less is more' },
    ])
    expect(plan.map((p) => p.text)).toEqual(['자, 보세요.', '여기 있죠.', 'less is more'])
  })
})

// ── 엔진 ────────────────────────────────────────────────────────────────
function cue(i: number, target = `reject:${i}`): LectureCue {
  return {
    id: `c${i}`,
    order: i,
    target: { kind: 'analysis', id: target },
    role: 'eliminate',
    segments: [{ lang: 'ko-KR', text: '자, 여기 보세요.' }],
    est_sec: 1,
    pause_after_ms: 30,
  }
}
const lecture = (n: number): Lecture => ({
  item_id: 'T#1',
  version: 1,
  total_sec_est: n,
  generated_by: 'test',
  rubric_score: 90,
  cues: Array.from({ length: n }, (_, i) => cue(i + 1)),
})

/** 소리 없이 `ms` 만큼 걸리는 가짜 어댑터 */
class FakeAdapter implements TtsAdapter {
  readonly kind = 'silent' as const
  readonly leadMs = 0
  spoken: string[] = []
  private seq = 0
  private paused = false
  constructor(private ms = 20) {}
  setRate() {}
  async speak(c: LectureCue): Promise<CueOutcome> {
    const my = ++this.seq
    let left = this.ms
    while (left > 0) {
      await new Promise((r) => setTimeout(r, 5))
      if (my !== this.seq) return { completed: false, cancelled: true, errors: [], spoken: 0, planned: 1 }
      if (!this.paused) left -= 5
    }
    this.spoken.push(c.id)
    return { completed: true, cancelled: false, errors: [], spoken: 1, planned: 1 }
  }
  pause() {
    this.paused = true
  }
  resume() {
    this.paused = false
  }
  cancel() {
    this.seq += 1
    this.paused = false
  }
}

const until = async (f: () => boolean, ms = 3000) => {
  const t = Date.now()
  while (!f()) {
    if (Date.now() - t > ms) throw new Error('시간 초과')
    await new Promise((r) => setTimeout(r, 5))
  }
}

describe('재생 엔진', () => {
  it('처음부터 끝까지 — 큐 순서대로, 매 큐 target 을 알린다', async () => {
    const a = new FakeAdapter()
    const seen: string[] = []
    let last: PlayerState | null = null
    const p = new LecturePlayer(lecture(4), a, (s) => {
      last = s
      if (s.target && seen.at(-1) !== s.target.id) seen.push(s.target.id)
    })
    await p.play(0)
    await until(() => last?.status === 'ended')
    expect(a.spoken).toEqual(['c1', 'c2', 'c3', 'c4'])
    expect(seen).toEqual(['reject:1', 'reject:2', 'reject:3', 'reject:4'])
    // 매 큐 뒤에 붙들기가 있었다
    expect(p.log.filter((e) => e.type === 'hold-end')).toHaveLength(4)
  })

  it('건너뛰기는 앞 큐를 끝까지 취소한 뒤 시작한다 — 두 큐가 겹쳐 읽히지 않는다', async () => {
    const a = new FakeAdapter(200)
    let last: PlayerState | null = null
    const p = new LecturePlayer(lecture(4), a, (s) => (last = s))
    await p.play(0)
    await new Promise((r) => setTimeout(r, 30))
    await p.jump(2)
    await until(() => last?.status === 'ended')
    expect(a.spoken).toEqual(['c3', 'c4'])
  })

  it('멈춘 동안에는 진행하지 않고, 재개하면 그 큐를 마친다', async () => {
    const a = new FakeAdapter(60)
    let last: PlayerState | null = null
    const p = new LecturePlayer(lecture(2), a, (s) => (last = s))
    await p.play(0)
    p.pause()
    expect(last!.status).toBe('paused')
    await new Promise((r) => setTimeout(r, 150))
    expect(a.spoken).toEqual([])
    p.resume()
    await until(() => last?.status === 'ended')
    expect(a.spoken).toEqual(['c1', 'c2'])
  })

  it('다음 · 이전은 범위 안에서만 움직인다', async () => {
    const a = new FakeAdapter(500)
    let last: PlayerState | null = null
    const p = new LecturePlayer(lecture(3), a, (s) => (last = s))
    await p.play(0)
    await p.prev()
    expect(last!.index).toBe(0)
    await p.jump(2)
    await p.next()
    expect(last!.index).toBe(2)
    p.destroy()
  })
})

// ── 검사기 — 파일럿에서 실제로 나온 두 종류 ────────────────────────────────

describe('귀와 눈이 같은 곳 — pointing', () => {
  it('「여기 N번째 문장」을 읽어 낸다', () => {
    expect(spokenHereOrdinals('자, 여기 세 번째 문장을 보세요.')).toEqual([3])
    expect(spokenHereOrdinals('여기, 첫 문장이죠. 그리고 여기 여덟 번째 문장')).toEqual([1, 8])
    // 「여기」 없이 번호만 말한 것은 가리키기가 아니다
    expect(spokenHereOrdinals('다섯 번째 문장을 짚어 보세요.')).toEqual([])
  })

  const ctx: ValidateContext = {
    targets: lectureTargets({
      answer: 1,
      answer_unknown: false,
      has_ability: true,
      has_intent: true,
      distractors: [2],
      procedure_len: 1,
      vocab_len: 0,
      skeleton: { sentences: 8, placedAnchorIds: ['answer'] },
    }),
    answer: 1,
    wrongChoices: [],
    hasTrapLabels: false,
    hasVocab: false,
    analysisTexts: [],
    sourceTexts: [],
  }
  const one = (text: string, target: { kind: 'analysis' | 'anchor'; id: string }): Lecture => ({
    ...lecture(1),
    cues: [{ ...cue(1), role: 'evidence', target, segments: [{ lang: 'ko-KR', text }] }],
  })
  const codes = (l: Lecture) => validateLecture(l, ctx).issues.map((i) => i.code)

  it('화면이 다른 문장을 켜면 막는다 (파일럿 M2706#34 c5 의 재현)', () => {
    expect(codes(one('여러분, 여기 두 번째 문장을 보세요.', { kind: 'anchor', id: 'sentence:6' }))).toContain('pointing')
  })
  it('분석 블록을 켜 놓고 「여기 N번째 문장」이라 말해도 막는다', () => {
    expect(codes(one('여러분, 여기 세 번째 문장을 보세요.', { kind: 'analysis', id: 'answer' }))).toContain('pointing')
  })
  it('맞게 켜면 통과한다', () => {
    expect(codes(one('여러분, 여기 두 번째 문장을 보세요.', { kind: 'anchor', id: 'sentence:1' }))).not.toContain('pointing')
  })
})

describe('무근거 난이도 판정 — banned', () => {
  const ctx = {
    targets: { analysis: ['head', 'answer'], anchor: [], useMap: false },
    answer: 1,
    wrongChoices: [],
    hasTrapLabels: false,
    hasVocab: false,
    analysisTexts: [],
    sourceTexts: [],
  }
  const has = (text: string) =>
    validateLecture(
      { ...lecture(1), cues: [{ ...cue(1), role: 'evidence', target: { kind: 'analysis', id: 'answer' }, segments: [{ lang: 'ko-KR', text }] }] },
      ctx,
    ).issues.some((i) => i.code === 'banned')
  it('문제에 대한 판정은 막는다', () => {
    expect(has('여기 보세요. 이 문제는 쉽습니다.')).toBe(true)
    expect(has('여기, 어려운 문항이죠.')).toBe(true)
  })
  it('지문 논리를 풀어 말한 「쉽죠」는 막지 않는다 (파일럿 오탐의 재현)', () => {
    expect(has('여기 보세요. 속마음이 새면 읽기는 오히려 쉽죠.')).toBe(false)
  })
})

describe('붙들기 — 정확한 쉼', () => {
  const holdLecture = (pause: number): Lecture => ({ ...lecture(2), cues: lecture(2).cues.map((c) => ({ ...c, pause_after_ms: pause })) })

  it('쉼은 올림되지 않는다 — 옛 100ms 틱은 최대 +100ms 를 더했다', async () => {
    const a = new FakeAdapter(5)
    let last: PlayerState | null = null
    const p = new LecturePlayer(holdLecture(250), a, (s) => (last = s))
    await p.play(0)
    await until(() => last?.status === 'ended')
    const e = p.log.find((x) => x.type === 'cue-end' && x.index === 0)!
    const h = p.log.find((x) => x.type === 'hold-end' && x.index === 0)!
    expect(h.t - e.t).toBeGreaterThanOrEqual(245)
    expect(h.t - e.t).toBeLessThan(250 + 60)
  })

  it('붙드는 중에 멈추면 시간이 흐르지 않고, 재개하면 남은 만큼만 붙든다', async () => {
    const a = new FakeAdapter(5)
    let last: PlayerState | null = null
    const p = new LecturePlayer(holdLecture(300), a, (s) => (last = s))
    await p.play(0)
    await until(() => last?.holding === true)
    await new Promise((r) => setTimeout(r, 100))
    p.pause()
    await new Promise((r) => setTimeout(r, 400))
    // 멈춘 400ms 동안 다음 큐로 넘어가지 않았다
    expect(last!.index).toBe(0)
    p.resume()
    await until(() => last?.index === 1)
    p.destroy()
  })
})

// ── Web Speech 어댑터 — 막힌 발화를 끊고 한 번 더 ─────────────────────────

describe('Web Speech — 막힌 발화', () => {
  /** 가짜 speechSynthesis: `hangs` 번째 발화까지는 끝 신호를 안 준다 */
  function stub(hangs: number) {
    let n = 0
    const cancels = { count: 0 }
    class Utt {
      lang = ''
      rate = 1
      voice: unknown = null
      onstart: (() => void) | null = null
      onend: (() => void) | null = null
      onerror: ((e: unknown) => void) | null = null
      constructor(public text: string) {}
    }
    const g = globalThis as unknown as Record<string, unknown>
    g.SpeechSynthesisUtterance = Utt
    g.window = {
      setTimeout: (f: () => void, ms: number) => setTimeout(f, ms),
      clearTimeout: (t: ReturnType<typeof setTimeout>) => clearTimeout(t),
      speechSynthesis: {
        speak(u: Utt) {
          n += 1
          setTimeout(() => u.onstart?.(), 1)
          if (n > hangs) setTimeout(() => u.onend?.(), 5)
        },
        cancel() {
          cancels.count += 1
        },
      },
    }
    g.performance ??= { now: () => Date.now() }
    return cancels
  }
  const oneCue: LectureCue = { ...cue(1), segments: [{ lang: 'ko-KR', text: '자, 여기 보세요.' }] }

  it('한 번 막히면 끊고 다시 읽어 살린다 — 오류가 아니라 recovered 로 남는다', async () => {
    const cancels = stub(1)
    const a = new WebSpeechAdapter({ ko: null, en: null }, { perCharMs: 1, floorMs: 30 })
    const o = await a.speak(oneCue)
    expect(o.completed).toBe(true)
    expect(o.errors).toEqual([])
    expect(o.recovered).toEqual(['timeout@0:ko-KR'])
    expect(cancels.count).toBeGreaterThanOrEqual(1)
  })

  it('두 번 막히면 그때 오류로 센다 — 강의는 멈추지 않는다', async () => {
    stub(2)
    const a = new WebSpeechAdapter({ ko: null, en: null }, { perCharMs: 1, floorMs: 30 })
    const o = await a.speak(oneCue)
    expect(o.completed).toBe(true)
    expect(o.errors).toEqual(['timeout@0:ko-KR'])
  })
})
