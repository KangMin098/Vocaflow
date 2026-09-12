// packages/video-factory/src/__tests__/factory.test.ts
//
// **공장의 보증을 잠근다.**
//
// 이 테스트가 지키는 것은 "영상이 예쁜가" 가 아니라 — 그건 기계가 못 본다 — 아래 넷이다:
//   1. **덮는 범위**: 플랫폼 구성요소가 늘면 설계도도 는다. 하나라도 빠지면 실패한다.
//   2. **근거**: 화면에 나가는 수치가 전부 번들(=DB 실측)에 실재한다. 지어낸 숫자 0.
//   3. **자막**: 자막 없는 컷이 없다.
//   4. **한글 조판**: 한글에 Lora/이탤릭이 걸리지 않는다 (CLAUDE.md 절대 금지).
//
// 1번이 이 파일의 존재 이유다. 시리즈를 하나 추가하고 영상을 안 만들면 **조용히** 빠지는데,
// 그 조용함이 곧 "공장이 아니라 수작업" 이라는 뜻이다.

import { describe, expect, it } from 'vitest'

import { buildSpecs, countByKind } from '../catalog/build'
import { loadBundle } from '../catalog/bundle'
import { sceneFrames, validateAll } from '../spec/validate'
import { captionFrames, CPS, MAX_CAPTION_SEC, MIN_CAPTION_SEC } from '../spec/timing'
import { FPS, FORMAT_IDS } from '../spec/format'
import { ACCENT, retention, decayColor, DECAY } from '../theme/palette'
import { spread } from '../remotion/motion'
import { VIDEO_MOTION } from '../spec/timing'
import { applyVoiceTiming } from '../voice/timing'
import { loadVoiceManifest } from '../voice/edge-tts'

const bundle = loadBundle()
const specs = buildSpecs(bundle)

describe('덮는 범위 — 플랫폼이 자라면 설계도도 자란다', () => {
  const byKind = countByKind(specs)

  it('문항 유형 하나에 영상 하나', () => {
    expect(byKind.type).toBe(Object.keys(bundle.typeGuide).length)
  })

  it('브랜드 시리즈 하나에 영상 하나', () => {
    expect(byKind.series).toBe(bundle.series.length)
  })

  it('학습 활동 하나에 영상 하나', () => {
    expect(byKind.module).toBe(bundle.activities.length)
  })

  it('장점 하나에 영상 하나', () => {
    expect(byKind.benefit).toBe(bundle.differentiators.length)
  })

  it('소개·커리큘럼은 각 한 편', () => {
    expect(byKind.intro).toBe(1)
    expect(byKind.curriculum).toBe(1)
  })

  it('모든 설계도가 세 규격을 낸다 — 학습자 화면·쇼츠·피드 광고', () => {
    for (const s of specs) expect([...s.formats].sort()).toEqual([...FORMAT_IDS].sort())
  })

  it('id 가 겹치지 않는다', () => {
    expect(new Set(specs.map((s) => s.id)).size).toBe(specs.length)
  })
})

describe('품질 게이트', () => {
  it('설계도 검사 위반 0', () => {
    expect(validateAll(specs)).toEqual([])
  })

  it('모든 컷에 자막이 있다', () => {
    for (const s of specs) {
      for (const [i, scene] of s.scenes.entries()) {
        expect(scene.caption.trim(), `${s.id} 컷 ${i}`).not.toBe('')
      }
    }
  })

  it('모든 근거에 출처가 있다', () => {
    for (const s of specs) {
      for (const e of s.evidence) expect(e.source.trim(), `${s.id} · ${e.label}`).not.toBe('')
    }
  })

  it('강조색은 토큰 키만 쓴다 (원시 hex 금지)', () => {
    for (const s of specs) expect(Object.keys(ACCENT)).toContain(s.accent)
  })

  it('닫는 컷 = 다음 한 걸음이 모든 영상에 있다', () => {
    for (const s of specs) {
      expect(s.scenes.some((sc) => sc.kind === 'closing'), s.id).toBe(true)
    }
  })
})

describe('수치의 출처 — 지어낸 숫자가 없다', () => {
  /** 번들 안에 실재하는 모든 수. 화면 수치는 반드시 이 집합 안에 있어야 한다. */
  const known = new Set<number>()
  const walk = (v: unknown): void => {
    if (typeof v === 'number') known.add(v)
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(bundle)
  // 설계도가 번들 수치들을 **더해서** 만드는 값도 정당하다(단 재고 합 등).
  // 그래서 합계를 따로 넣어 준다 — 이 목록 밖의 수가 나오면 그건 지어낸 것이다.
  for (const s of bundle.series) known.add(s.rungs.reduce((a, r) => a + r.items, 0))
  known.add(bundle.spine.reduce((a, r) => a + r.items, 0))

  it('stat 컷의 숫자는 전부 번들에서 온다', () => {
    const strays: string[] = []
    for (const spec of specs) {
      for (const scene of spec.scenes) {
        if (scene.kind !== 'stat') continue
        for (const st of scene.stats) {
          const n = Number(st.value.replace(/,/g, ''))
          if (!Number.isFinite(n)) continue // `3/7` 같은 비율 표기는 숫자가 아니다
          if (!known.has(n)) strays.push(`${spec.id}: ${st.label} = ${st.value}`)
        }
      }
    }
    expect(strays).toEqual([])
  })
})

describe('자막 길이 — Netflix Timed Text 규격을 바닥으로 쓴다', () => {
  it('아무리 짧은 문장도 최소 노출을 지킨다', () => {
    expect(captionFrames('짧다')).toBe(Math.ceil(MIN_CAPTION_SEC * FPS))
  })

  it('아무리 긴 문장도 최대 노출을 넘지 않는다', () => {
    expect(captionFrames('가'.repeat(500))).toBe(Math.ceil(MAX_CAPTION_SEC * FPS))
  })

  it('학습자용이 광고용보다 느리게 읽힌다 (아동물 13 CPS)', () => {
    expect(CPS.learner).toBeLessThan(CPS.ad)
    const text = '가'.repeat(60)
    expect(captionFrames(text, 'learner')).toBeGreaterThan(captionFrames(text, 'ad'))
  })
})

describe('Memory Decay — CLAUDE.md 4색 임계를 그대로 쓴다', () => {
  it('R ≥ 0.95 는 stable', () => {
    expect(decayColor(0.96)).toBe(DECAY.stable)
    expect(decayColor(0.95)).toBe(DECAY.stable)
  })
  it('0.70 ≤ R < 0.95 는 shaky', () => {
    expect(decayColor(0.94)).toBe(DECAY.shaky)
    expect(decayColor(0.7)).toBe(DECAY.shaky)
  })
  it('R < 0.70 은 risk', () => {
    expect(decayColor(0.69)).toBe(DECAY.risk)
  })
  it('R(t) 는 저장하지 않고 계산한다 — t=0 이면 1', () => {
    expect(retention(0, 3)).toBe(1)
    expect(retention(3, 3)).toBeCloseTo(0.9, 10)
  })
})

describe('목록이 컷 안에 다 들어온다 — 조용히 삼켜지는 항목이 없다', () => {
  // 실측 2026-09-12: 커리큘럼 7단 중 **7단이 화면에 없었다.** 고정 스태거(항목당 8프레임)가
  // 48프레임까지 쌓였는데 컷은 107프레임뿐이라, 마지막 단이 컷 절반이 지나도록 안 떴다.
  // 오류가 나지 않는 종류의 결함이라 스틸을 봐야 보인다 — 그래서 산술로 잠근다.
  const specsWithVoice = specs.map((s) => applyVoiceTiming(s, loadVoiceManifest(s.id)))

  it('마지막 항목이 컷의 절반 전에는 다 떠 있다', () => {
    const late: string[] = []
    for (const spec of specsWithVoice) {
      for (const [i, scene] of spec.scenes.entries()) {
        const duration = sceneFrames(scene, spec.audience)
        const count =
          scene.kind === 'ladder'
            ? scene.rungs.length
            : scene.kind === 'shelf'
              ? scene.volumes.length
              : scene.kind === 'stat'
                ? scene.stats.length
                : scene.kind === 'item'
                  ? scene.sample.choices.length
                  : 0
        if (count < 2) continue
        // 마지막 항목의 지연 + 진입 시간이 컷 절반을 넘으면 "늦게 뜨는" 것이다.
        const lastDelay = spread(count - 1, count, duration)
        const visibleAt = lastDelay + VIDEO_MOTION.enterFrames
        if (visibleAt > duration / 2) {
          late.push(`${spec.id} 컷 ${i}(${scene.kind}): ${visibleAt}f / ${duration}f`)
        }
      }
    }
    expect(late).toEqual([])
  })

  it('spread 는 항목이 많아질수록 간격을 줄인다', () => {
    const short = spread(9, 10, 60)
    const long = spread(9, 10, 600)
    expect(short).toBeLessThan(long) // 짧은 컷에서는 눌린다
    expect(spread(9, 10, 60) + VIDEO_MOTION.enterFrames).toBeLessThanOrEqual(60 * 0.3 + VIDEO_MOTION.enterFrames)
  })
})
