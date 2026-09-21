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
import { loadTestBundle } from './test-bundle'
import { sceneFrames, validateAll } from '../spec/validate'
import { captionFrames, CPS, MAX_CAPTION_SEC, MIN_CAPTION_SEC } from '../spec/timing'
import { FPS, FORMAT_IDS, proseScale, typeScale } from '../spec/format'
import { shelfTotalWidth, usableWidth } from '../spec/layout'
import { ACCENT, ACCENT_SOFT, accentColor, accentSoft, retention, decayColor, DECAY } from '../theme/palette'
import { voiceFont } from '../remotion/Frame'
import { spread } from '../remotion/motion'
import { VIDEO_MOTION } from '../spec/timing'
import { applyVoiceTiming } from '../voice/timing'
import { loadVoiceManifest } from '../voice/edge-tts'

// work/ 가 없으면(CI) tests/fixtures/ 고정 원료 — test-bundle.ts · 이슈 #101
const bundle = loadTestBundle()
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

  it('학습방법 = 총론 1 + 면마다 1', () => {
    expect(byKind.method).toBe(1 + bundle.facetOrder.length)
  })

  it('권장안 = 다음 자리로 올려 주는 면이 있는 이동마다 1', () => {
    // Fluent 에는 다음이 없고, 첫 자리(Met)는 노출뿐이라 올려 주는 면이 없다 —
    // 그래서 「자리 수 - 1」 이 아니라 **조건을 세어** 비교한다. 상수를 적으면
    // 단계가 늘 때 이 테스트가 틀린 이유로 깨진다.
    const movable = b_stageTransitions()
    expect(byKind.advice).toBe(movable)
    expect(movable).toBeGreaterThan(0)
  })

  function b_stageTransitions(): number {
    let n = 0
    for (let i = 0; i < bundle.stages.length - 1; i++) {
      if (bundle.stages[i + 1]?.by) n++
    }
    return n
  }

  it('**사용자가 이름 댄 구성요소가 전부 있다** — 학습방법·권장안이 한동안 0 이었다', () => {
    // 2026-09-13 실측: 종류가 여섯뿐이라 「학습방법」·「권장안」 영상이 한 편도 없었다.
    // 규칙이 아니라 **원료**가 없어서였다(번들에 단계·임계값이 안 들어 있었다).
    for (const kind of ['intro', 'curriculum', 'series', 'type', 'method', 'advice'] as const) {
      expect(byKind[kind] ?? 0, `${kind} 종류가 0편이다`).toBeGreaterThan(0)
    }
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

  // 「강조색은 토큰 키만 (원시 hex 금지)」 제한은 DD-66 으로 풀었다 — 키든 원시 색이든 받는다.
  it('강조색 — 키는 토큰 값으로, 원시 CSS 색은 그대로 풀린다', () => {
    expect(accentColor('brand')).toBe(ACCENT.brand)
    expect(accentSoft('brand')).toBe(ACCENT_SOFT.brand)
    expect(accentColor('#714bd0')).toBe('#714bd0')
    expect(accentColor('rgb(12, 34, 56)')).toBe('rgb(12, 34, 56)')
    expect(accentSoft('#714bd0')).toBe('color-mix(in srgb, #714bd0 14%, transparent)')
  })

  it('말하는 자리 서체 — 기본값을 두고, 장면의 voice 가 적은 항목만 덮어쓴다', () => {
    expect(voiceFont('안녕하세요')).toMatchObject({ fontStyle: 'normal', fontWeight: 500 })
    expect(voiceFont('Hello')).toMatchObject({ fontStyle: 'italic', fontWeight: 600 })
    expect(voiceFont('안녕하세요', { fontStyle: 'italic' })).toMatchObject({ fontStyle: 'italic', fontWeight: 500 })
    expect(voiceFont('Hello', { fontFamily: 'Pretendard', fontStyle: 'normal' })).toMatchObject({ fontFamily: 'Pretendard', fontStyle: 'normal', fontWeight: 600 })
  })

  it('「나아가는 차례」 컷의 수치가 전부 프레임워크 정본에서 온다', () => {
    const names = new Set(bundle.stages.map((s) => s.name))
    const codes = new Set(bundle.stages.map((s) => s.code))
    for (const s of specs) {
      for (const scene of s.scenes) {
        if (scene.kind !== 'progression') continue
        // 자리를 **전부** 그린다 — 몇 개만 그리면 "여기가 끝" 으로 읽힌다.
        expect(scene.steps.length, s.id).toBe(bundle.stages.length)
        for (const step of scene.steps) {
          expect(names.has(step.name), `${s.id}: 없는 자리 ${step.name}`).toBe(true)
          expect(codes.has(step.code), `${s.id}: 없는 코드 ${step.code}`).toBe(true)
          // `by` 는 **빈 문자열이 아니라 null** 이어야 한다 — 빈 줄을 그리면
          // "조건이 있는데 안 적혔다" 로 읽힌다.
          expect(step.by === null || step.by.length > 0, `${s.id}: 빈 조건 줄`).toBe(true)
        }
        // 「지금 여기」는 **한 자리 이하**다. 둘이면 어디 서 있는지 화면이 두 번 말한다.
        expect(scene.steps.filter((x) => x.now).length, s.id).toBeLessThanOrEqual(1)
      }
    }
  })

  it('권장안이 말하는 임계값이 `flow` 실값과 같다 — 영상용으로 고쳐 적지 않는다', () => {
    const pct = (x: number) => `${Math.round(x * 100)}%`
    for (const s of specs.filter((x) => x.kind === 'advice')) {
      const numbers = s.scenes
        .filter((sc): sc is Extract<typeof sc, { kind: 'stat' }> => sc.kind === 'stat')
        .flatMap((sc) => sc.stats.map((st) => st.value))
      expect(numbers, s.id).toContain(pct(bundle.flow.accuracyHoldBelow))
      expect(numbers, s.id).toContain(pct(bundle.flow.accuracyTarget))
      expect(numbers, s.id).toContain(`${bundle.flow.encountersFloor}회`)
      // 출처가 파일까지 적혀 있어야 한다 — 「어디서 온 수인가」에 답할 수 있어야 광고에 쓴다.
      for (const sc of s.scenes) {
        if (sc.kind !== 'stat') continue
        for (const st of sc.stats) {
          expect(st.source, `${s.id}: 출처 없는 수치 ${st.value}`).toMatch(/lib\/framework\//)
        }
      }
    }
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

describe('규격마다 안전 여백을 넘지 않는다', () => {
  // 실측 2026-09-13 — 눈으로 보기 전에는 몰랐던 것 둘:
  //   · 정사각 서가에서 7권이 **화면 끝에 닿았다**(고정 폭 × 권 수 > 가용 폭)
  //   · 세로에서 커버리지 지문이 위로 넘쳐 **브랜드 표기와 겹쳤다**
  // 둘 다 오류가 나지 않는다. 산술로 확인할 수 있는 것은 산술로 잠근다.

  it('서가의 책 묶음이 가용 폭 안에 들어온다 — 권 수가 늘어도', () => {
    const over: string[] = []
    for (const format of FORMAT_IDS) {
      for (let count = 1; count <= 12; count++) {
        const total = shelfTotalWidth(format, count)
        const avail = usableWidth(format)
        // 하한(52*scale)에 걸리는 아주 많은 권 수는 예외 — 그건 폭이 아니라 담은 양의 문제다.
        if (count <= 8 && total > avail) over.push(`${format} ${count}권: ${total} > ${avail}`)
      }
    }
    expect(over).toEqual([])
  })

  it('실제 시리즈 권 수에서도 들어온다', () => {
    const over: string[] = []
    for (const spec of specs) {
      for (const scene of spec.scenes) {
        if (scene.kind !== 'shelf') continue
        for (const format of spec.formats) {
          const total = shelfTotalWidth(format, scene.volumes.length)
          const avail = usableWidth(format)
          if (total > avail) over.push(`${spec.id} ${format}: ${total} > ${avail}`)
        }
      }
    }
    expect(over).toEqual([])
  })

  it('긴 글 배율은 짧은 글 배율과 **반대 방향**이다 (세로에서 1 미만)', () => {
    // 좁은 화면에서 제목은 키워야 읽히고, 긴 글은 줄여야 줄 수가 감당된다.
    expect(typeScale('vertical')).toBeGreaterThan(1)
    expect(proseScale('vertical')).toBeLessThan(1)
    expect(proseScale('square')).toBeLessThan(1)
    expect(proseScale('wide')).toBe(1)
    expect(typeScale('wide')).toBe(1)
  })
})
