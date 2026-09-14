// packages/video-factory/src/__tests__/plan-evaluate.test.ts
//
// **기획·평가 두 단계의 회귀.**
//
// 이 파일이 지키는 것은 "영상이 좋은가" 가 아니라 — 그건 기계가 못 본다 — 아래 넷이다:
//   1. **기획이 자기 분모를 맞게 센다.** 설계도 수와 「덮은 자리」 수가 어긋나면
//      기획이 「없다」고 말하는 편을 공장은 이미 만들고 있게 된다.
//   2. **없는 것이 목록에 뜬다.** 교재 권별처럼 설계도 규칙이 아예 없는 후보가
//      화면에 나타나야 한다 — 안 보이면 영원히 안 만들어진다.
//   3. **재고 0 은 「순위가 낮은 것」이 아니라 「지금 만들면 안 되는 것」이다.**
//   4. **평가가 눈이 멀지 않았다.** 규격을 어긴 것을 실제로 잡아낸다.
//
// 4번이 이 파일에서 가장 중요하다. 전부 통과하는 평가는 아무것도 재지 않는 평가와
// 화면에서 구별되지 않는다.

import { describe, expect, it } from 'vitest'

import { buildSpecs } from '../catalog/build'
import { loadBundle } from '../catalog/bundle'
import { backlog, planItems, summarizePlan } from '../catalog/plan'
import { cueCount, splitCaption, CUE_MAX_SEC, marksAlign } from '../render/cue'
import { cuesOf } from '../render/captions'
import { evaluateVideo, summarize, SHORTS_MAX_SEC, SOURCES } from '../spec/evaluate'
import { CPS, MAX_CAPTION_SEC, MIN_CAPTION_SEC } from '../spec/timing'
import { loadVoiceManifest } from '../voice/edge-tts'
import { applyVoiceTiming } from '../voice/timing'
import type { VideoSpec } from '../spec/types'

const bundle = loadBundle()
const specs = buildSpecs(bundle)
const timed = specs.map((s) => applyVoiceTiming(s, loadVoiceManifest(s.id)))
const items = planItems(bundle, new Set(specs.map((s) => s.id)))
const bl = backlog(items)

/* ── 기획 ─────────────────────────────────────────────────────── */

describe('기획 — 다음에 무엇을 찍을 것인가', () => {
  it('덮은 자리 수가 설계도 수와 같다 — 기획이 자기 분모를 틀리게 세면 안 된다', () => {
    // 예전에 장점 3편을 빼먹어 70/73 으로 셌다. 그 상태로는 「다 했다」가 거짓이 된다.
    expect(bl.covered.length).toBe(specs.length)
  })

  it('덮은 자리의 id 가 실제 설계도 id 와 정확히 같은 집합이다', () => {
    // 개수만 맞고 id 가 어긋나면 「덮었다」고 적힌 자리가 실제로는 다른 편이다.
    expect(new Set(bl.covered.map((i) => i.id))).toEqual(new Set(specs.map((s) => s.id)))
  })

  it('**설계도 규칙이 없는 후보가 목록에 뜬다** — 교재 권별', () => {
    const volumes = items.filter((i) => i.kind === 'volume')
    expect(volumes.length).toBeGreaterThan(0)
    // 하나도 covered 면 안 된다 — 아직 규칙이 없으니까. 생기면 이 기대가 먼저 깨진다.
    expect(volumes.every((v) => v.state !== 'covered')).toBe(true)
  })

  it('후보 수가 번들의 권 수와 같다 — 손으로 센 수가 아니다', () => {
    const rungs = bundle.series.reduce((n, s) => n + s.rungs.length, 0)
    expect(items.filter((i) => i.kind === 'volume').length).toBe(rungs)
  })

  it('재고 0 인 자리는 「막힘」이고 사유가 적혀 있다', () => {
    for (const i of items) {
      if (i.state !== 'blocked') continue
      expect(i.backing, `${i.id}`).toBe(0)
      expect(i.blockedWhy?.length ?? 0, `${i.id} 에 사유가 없다`).toBeGreaterThan(0)
    }
    // 실측 2026-09-14: `Vocaflow Reading Starter` 가 문항 0 이라 여기 걸린다.
    expect(bl.blocked.length).toBeGreaterThan(0)
  })

  it('재고 0 이 「후보」로 새지 않는다 — 빈 서가를 광고하게 된다', () => {
    for (const i of bl.next) expect(i.backing === null || i.backing > 0, i.id).toBe(true)
  })

  it('순서가 재고 큰 순이고, **못 센 것(null)은 맨 뒤**다', () => {
    const withNum = bl.next.filter((i) => i.backing !== null).map((i) => i.backing!)
    expect([...withNum].sort((a, b) => b - a)).toEqual(withNum)
    const firstNull = bl.next.findIndex((i) => i.backing === null)
    if (firstNull >= 0) {
      // null 뒤에는 숫자가 오면 안 된다 — 0 과 같은 자리에 두면 「없다」로 읽힌다.
      expect(bl.next.slice(firstNull).every((i) => i.backing === null)).toBe(true)
    }
  })

  it('덮개 계산에서 **막힌 자리를 분모에서 뺀다**', () => {
    const s = summarizePlan(bl)
    expect(s.addressable).toBe(bl.covered.length + bl.next.length + bl.blocked.length)
    expect(s.coverage).toBeCloseTo(bl.covered.length / (bl.covered.length + bl.next.length), 6)
    // 막힌 자리가 분모에 들어갔다면 이 값보다 작아진다.
    expect(s.coverage!).toBeGreaterThan(bl.covered.length / s.addressable)
  })

  it('모든 항목에 재고 라벨이 있다 — 근거 없는 순위를 만들지 않는다', () => {
    for (const i of items) expect(i.backingLabel.trim(), i.id).not.toBe('')
  })

  it('id 가 겹치지 않는다', () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
  })
})

/* ── 자막 큐 나누기 ───────────────────────────────────────────── */

const WORDS = (n: number, each: number) =>
  Array.from({ length: n }, (_, i) => ({ at: i * each, dur: each, text: `w${i}` }))

describe('자막 큐 — 컷 하나가 큐 하나일 필요는 없다', () => {
  it('상한 안이면 나누지 않는다', () => {
    const c = splitCaption('짧은 자막입니다', 0, 3, 13)
    expect(c).toHaveLength(1)
    expect(c[0]!.text).toBe('짧은 자막입니다')
  })

  it('**7초를 넘으면 나눈다** — 실측 2026-09-13에 15컷이 그랬다', () => {
    const text = '가 나 다 라 마 바 사 아 자 차 카 타'
    const cues = splitCaption(text, 0, 8.1, 17)
    expect(cues.length).toBeGreaterThan(1)
    for (const c of cues) expect(c.end - c.start).toBeLessThanOrEqual(CUE_MAX_SEC + 0.001)
  })

  it('나눠도 **낱말 안에서 자르지 않는다**', () => {
    const text = '가나다 라마바 사아자 차카타 파하가 나다라'
    const cues = splitCaption(text, 0, 9, 13)
    expect(cues.map((c) => c.text).join(' ')).toBe(text)
  })

  it('큐가 겹치지 않고 순서대로다 — 겹치면 플레이어가 예측 불가로 그린다', () => {
    const cues = splitCaption('가 나 다 라 마 바 사 아 자 차', 5, 10, 13, WORDS(10, 1))
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i]!.start).toBeGreaterThanOrEqual(cues[i - 1]!.end)
    }
    for (const c of cues) expect(c.end).toBeGreaterThan(c.start)
  })

  it('마지막 큐가 컷 끝에 정확히 붙는다 — 어긋나면 다음 컷 자막과 겹친다', () => {
    const cues = splitCaption('가 나 다 라 마 바 사 아', 2, 9, 13, WORDS(8, 1))
    expect(cues[cues.length - 1]!.end).toBeCloseTo(11, 6)
    expect(cues[0]!.start).toBeCloseTo(2, 6)
  })

  it('낱말 눈금이 **안 맞으면 쓰지 않는다** — 어긋난 눈금은 안 나눈 것보다 나쁘다', () => {
    // 자막은 8낱말인데 눈금은 3개 — 나레이션이 다른 문장이라는 뜻이다.
    expect(marksAlign('가 나 다 라 마 바 사 아', WORDS(3, 1))).toBe(false)
    expect(marksAlign('가 나 다', WORDS(3, 1))).toBe(true)
    const cues = splitCaption('가 나 다 라 마 바 사 아', 0, 9, 13, WORDS(3, 1))
    // 그래도 나뉘기는 한다(글자 수 비례). 안 나누면 7초 규격을 어긴다.
    expect(cues.length).toBeGreaterThan(1)
  })

  it('빈 자막은 큐를 만들지 않는다', () => {
    expect(splitCaption('   ', 0, 5, 13)).toEqual([])
    expect(splitCaption('있다', 0, 0, 13)).toEqual([])
  })

  it('낱말이 하나면 쪼개지 않는다 — 규격보다 뜻이 먼저다', () => {
    expect(splitCaption('한낱말', 0, 9, 13)).toHaveLength(1)
  })

  it('조각이 최소 노출보다 짧아지지 않는다 — 다른 쪽으로 규격을 어기게 된다', () => {
    // 1.2초에 100자면 CPS 로는 많이 쪼개야 하지만, 그러면 조각이 0.83초보다 짧아진다.
    const n = cueCount(1.2, 100, 13)
    expect(n).toBeLessThanOrEqual(Math.floor(1.2 / MIN_CAPTION_SEC))
  })

  it('읽기 속도가 넘으면 길이가 상한 안이어도 나눈다', () => {
    // 3초 × 13 CPS = 39자가 한계. 80자면 두 조각 이상이어야 한다.
    expect(cueCount(3, 80, 13)).toBeGreaterThan(1)
  })
})

/* ── 평가 ─────────────────────────────────────────────────────── */

describe('평가 — 찍은 것이 규격 안인가', () => {
  const cards = timed.map((spec) =>
    evaluateVideo({ spec, cues: cuesOf(spec, loadVoiceManifest(spec.id)) }),
  )

  it('발행된 모든 편의 자막이 Netflix 규격 안이다', () => {
    const bad = cards.flatMap((c) =>
      c.axes.filter((a) => a.id === 'cue-length' && a.verdict === 'fail').map((a) => `${c.videoId}: ${a.offenders.join(', ')}`),
    )
    expect(bad).toEqual([])
  })

  it('모든 편이 Shorts 길이 안이다 — 넘으면 세로 규격을 찍은 의미가 없다', () => {
    const bad = cards.filter((c) =>
      c.axes.some((a) => a.id === 'shorts' && a.verdict === 'fail'),
    )
    expect(bad.map((c) => c.videoId)).toEqual([])
  })

  it('**규격을 어긴 것을 실제로 잡는다** — 전부 통과하는 평가는 아무것도 재지 않는 평가와 같다', () => {
    const spec = timed[0]!
    // 8초짜리 큐 하나를 억지로 넣는다. 잡히지 않으면 이 평가는 눈이 먼 것이다.
    const card = evaluateVideo({
      spec,
      cues: [{ start: 0, end: 8, text: '가'.repeat(200) }],
    })
    const len = card.axes.find((a) => a.id === 'cue-length')!
    const speed = card.axes.find((a) => a.id === 'cue-speed')!
    expect(len.verdict).toBe('fail')
    expect(speed.verdict).toBe('fail')
    expect(len.offenders.length).toBeGreaterThan(0)
  })

  it('길이가 넘치면 Shorts 축이 실제로 실패한다', () => {
    const long: VideoSpec = {
      ...timed[0]!,
      scenes: [{ ...timed[0]!.scenes[0]!, frames: (SHORTS_MAX_SEC + 5) * 30 }],
    }
    const card = evaluateVideo({ spec: long, cues: [] })
    expect(card.axes.find((a) => a.id === 'shorts')!.verdict).toBe('fail')
  })

  it('**못 잰 축은 합격이 아니다** — 0 으로 접으면 조용히 통과한다', () => {
    const card = evaluateVideo({ spec: timed[0]! }) // cues·loudness 없음
    const unknowns = card.axes.filter((a) => a.verdict === 'unknown')
    expect(unknowns.length).toBeGreaterThan(0)
    expect(unknowns.every((a) => a.verdict !== 'pass')).toBe(true)
    // 합격+불합격이 전체가 아니어야 한다.
    expect(card.pass + card.fail).toBeLessThan(card.axes.length)
  })

  it('음량을 못 재도 「합격」으로 새지 않는다', () => {
    const card = evaluateVideo({
      spec: timed[0]!,
      loudness: {
        wide: { integrated: null, truePeak: null, targetLufs: -14, targetTp: -1, toleranceLu: 1 },
      },
    })
    expect(card.axes.find((a) => a.id === 'loudness:wide')!.verdict).toBe('unknown')
  })

  it('**출처 없는 임계값이 없다** — 판정하는 축은 전부 출처를 댄다', () => {
    for (const c of cards) {
      for (const a of c.axes) {
        if (a.verdict === 'pass' || a.verdict === 'fail') {
          expect(a.source, `${c.videoId} · ${a.id} 에 출처가 없다`).not.toBeNull()
          expect(a.limit, `${c.videoId} · ${a.id} 에 규격이 없다`).not.toBeNull()
          expect(Object.keys(SOURCES)).toContain(a.source!)
        } else if (a.verdict === 'measured') {
          // 재기만 하는 축은 **규격을 적지 않는다.** 적으면 그게 근거처럼 보인다.
          expect(a.limit, `${a.id} 는 판정 안 하는데 규격이 적혀 있다`).toBeNull()
        }
      }
    }
  })

  it('첫 컷 길이는 판정하지 않는다 — 공개된 임계값이 없다', () => {
    const hook = cards[0]!.axes.find((a) => a.id === 'hook')!
    expect(hook.verdict).toBe('measured')
    expect(hook.source).toBeNull()
  })

  it('요약이 못 잰 편을 합격으로 세지 않는다', () => {
    // 축을 **전부** 채운 편 하나와, 아무것도 안 넘긴 편 하나를 나란히 둔다.
    const full = timed[1]!
    const loudness = Object.fromEntries(
      full.formats.map((f) => [
        f,
        { integrated: -14, truePeak: -3, targetLufs: -14, targetTp: -1, toleranceLu: 1 },
      ]),
    )
    const s = summarize([
      evaluateVideo({ spec: timed[0]! }), // 자막·음량 둘 다 못 잼
      evaluateVideo({ spec: full, cues: cuesOf(full, loadVoiceManifest(full.id)), loudness }),
    ])
    expect(s.incomplete).toBe(1)
    expect(s.clean).toBe(1)
    // 못 잰 편이 clean 이나 failing 어느 쪽에도 안 섞여야 한다.
    expect(s.clean + s.failing + s.incomplete).toBe(s.videos)
  })
})

/* ── 자막 규격 상수 ───────────────────────────────────────────── */

describe('규격 상수 — 짐작이 아니라 공개된 값', () => {
  it('Netflix 자막 5/6초 ~ 7초 · 아동물 13 CPS · 성인 17 CPS', () => {
    expect(MIN_CAPTION_SEC).toBeCloseTo(5 / 6, 6)
    expect(MAX_CAPTION_SEC).toBe(7)
    expect(CPS.learner).toBe(13)
    expect(CPS.ad).toBe(17)
  })

  it('YouTube Shorts 60초', () => {
    expect(SHORTS_MAX_SEC).toBe(60)
  })
})
