// packages/video-factory/src/__tests__/loudness.test.ts
//
// **음량 판정 회귀.**
//
// 이 파일이 있는 이유는 셋 다 **실제로 겪은 사고**다(2026-09-13):
//   ① 템플릿 리터럴에서 `\s` 가 `s` 로 줄어 정규식이 아무것도 못 맞혔고 — 186편 전부 «못 잼»
//   ② `execFileSync` 가 성공 시 stdout 만 주는데 `loudnorm` 요약은 **stderr** 로 나온다
//   ③ 같은 출력에 `Output Integrated` 가 함께 찍히는데 그건 **필터를 통과시켰다면** 나왔을 값이라
//      분석 실행에서도 늘 -14 근처다 — 그걸 읽으면 **무엇을 재도 합격**한다
//
// ①과 ③은 순수 함수라 여기서 잠근다. ②는 실행부라 `pnpm video loudness` 가 실제 파일에서 잡는다.

import { describe, expect, it } from 'vitest'

import {
  offsetFromTarget,
  parseLoudness,
  report,
  spread,
  TARGET_LUFS,
  TARGET_TP,
  TOLERANCE_LU,
  withinSpec,
  type Loudness,
} from '../render/loudness'

/**
 * **진짜 ffmpeg 출력**이다 — `out/wide/intro-platform.mp4` 를 실제로 재서 그대로 붙였다.
 * 손으로 줄인 예시를 쓰면 형식이 바뀌었을 때 테스트만 통과한다.
 */
const REAL_OUTPUT = `
Stream mapping:
  Stream #0:1 -> #0:0 (aac (native) -> pcm_s16le (native))
Press [q] to stop, [?] for help
Output #0, null, to 'pipe:':
  Stream #0:0(und): Audio: pcm_s16le, 192000 Hz, stereo, s16, 6144 kb/s (default)
[Parsed_loudnorm_0 @ 0000020dbd706640]
Input Integrated:    -16.9 LUFS
Input True Peak:      -6.1 dBTP
Input LRA:             2.8 LU
Input Threshold:     -27.4 LUFS

Output Integrated:   -23.9 LUFS
Output True Peak:    -13.2 dBTP
Output LRA:            2.0 LU
Output Threshold:    -34.3 LUFS

Normalization Type:   Dynamic
Target Offset:        -0.1 LU
size=N/A time=00:00:24.80 bitrate=N/A speed=34.4x
`

const at = (integrated: number | null, truePeak = -3): Loudness => ({
  file: 'x.mp4',
  integrated,
  truePeak,
  range: 2.5,
})

describe('parseLoudness — 진짜 ffmpeg 출력에서', () => {
  it('세 값을 꺼낸다', () => {
    const l = parseLoudness('intro.mp4', REAL_OUTPUT)
    expect(l.integrated).toBe(-16.9)
    expect(l.truePeak).toBe(-6.1)
    expect(l.range).toBe(2.8)
  })

  it('**Output 이 아니라 Input 을 읽는다** — 이걸 헷갈리면 무엇을 재도 합격한다', () => {
    const l = parseLoudness('intro.mp4', REAL_OUTPUT)
    // Output Integrated 는 -23.9 다. 그 값이 나오면 잘못 읽은 것.
    expect(l.integrated).not.toBe(-23.9)
    expect(l.truePeak).not.toBe(-13.2)
  })

  it('값이 없으면 null — 0 이 아니다 (0 LUFS 는 「못 쟀다」가 아니라 「엄청 크다」다)', () => {
    const l = parseLoudness('x.mp4', '아무 말도 없는 출력')
    expect(l.integrated).toBeNull()
    expect(l.truePeak).toBeNull()
    expect(l.range).toBeNull()
  })

  it('줄을 넘어가 다음 항목의 수를 집어 오지 않는다', () => {
    // 라벨만 있고 값이 다음 줄에 있는 (있을 수 없는) 형태 — 그래도 -6.1 을 집으면 안 된다.
    const l = parseLoudness('x.mp4', 'Input Integrated:\nInput True Peak: -6.1 dBTP\n')
    expect(l.integrated).toBeNull()
  })
})

describe('withinSpec — YouTube 규격 판정', () => {
  it('목표 ±허용치 안이면 통과', () => {
    expect(withinSpec(at(TARGET_LUFS))).toBe(true)
    expect(withinSpec(at(TARGET_LUFS + TOLERANCE_LU))).toBe(true)
    expect(withinSpec(at(TARGET_LUFS - TOLERANCE_LU))).toBe(true)
  })

  it('**실측된 우리 영상 셋은 전부 불합격이었다** — 이 테스트가 그 사실을 박아 둔다', () => {
    expect(withinSpec(at(-16.9, -6.1))).toBe(false) // intro-platform
    expect(withinSpec(at(-16.5, -6.3))).toBe(false) // type-blank
    expect(withinSpec(at(-19.6, -7.2))).toBe(false) // benefit-coverage
  })

  it('트루 피크가 넘으면 음량이 맞아도 불합격 — 재인코딩에서 깨진다', () => {
    expect(withinSpec(at(TARGET_LUFS, TARGET_TP + 0.5))).toBe(false)
    expect(withinSpec(at(TARGET_LUFS, TARGET_TP))).toBe(true)
  })

  it('못 쟀으면 null — **통과도 실패도 아니다**', () => {
    expect(withinSpec(at(null))).toBeNull()
    expect(withinSpec({ file: 'x', integrated: -14, truePeak: null, range: null })).toBeNull()
  })
})

describe('편차 — 한 편의 음량만큼 중요하다', () => {
  it('최대-최소를 LU 로 준다', () => {
    // 실측값 셋. 3.1 LU 벌어져 있었다 — 이어 보면 음량이 튄다.
    expect(spread([at(-16.9), at(-16.5), at(-19.6)])).toBe(3.1)
  })

  it('못 잰 것은 빼고 센다', () => {
    expect(spread([at(-14), at(null), at(-15)])).toBe(1)
  })

  it('전부 못 쟀으면 null', () => {
    expect(spread([at(null), at(null)])).toBeNull()
  })

  it('목표 대비 부호 — 조용하면 음수', () => {
    expect(offsetFromTarget(at(-16.9))).toBe(-2.9)
    expect(offsetFromTarget(at(-12.0))).toBe(2)
    expect(offsetFromTarget(at(null))).toBeNull()
  })
})

describe('report — 화면·CLI·회귀가 같은 함수를 본다', () => {
  it('못 잰 것을 합격으로 세지 않는다', () => {
    const r = report([at(-14), at(null), at(-19.6)])
    expect(r.pass).toBe(1)
    expect(r.fail).toBe(1)
    expect(r.unknown).toBe(1)
    // 합격+불합격이 전체가 아니다 — 못 잰 것이 조용히 어느 쪽에도 안 섞여야 한다.
    expect(r.pass + r.fail).not.toBe(r.measured)
  })

  it('가장 먼 편을 집어낸다 — 다음에 손볼 것', () => {
    const r = report([at(-16.9), at(-19.6), at(-16.5)])
    expect(r.worst?.integrated).toBe(-19.6)
  })

  it('전부 규격 안이면 fail 0 · worst 없음', () => {
    const r = report([at(-14), at(-13.5), at(-14.6)])
    expect(r.fail).toBe(0)
    expect(r.worst).toBeNull()
    expect(r.spreadLu).toBe(1.1)
  })
})

describe('규격 상수 — 짐작이 아니라 공개된 값', () => {
  it('YouTube 목표 -14 LUFS · 트루 피크 -1 dBTP', () => {
    // 이 수를 바꾸면 「시중 대비 우위」의 근거가 바뀐다. 바꾸려면 출처부터 바꿔야 한다.
    expect(TARGET_LUFS).toBe(-14)
    expect(TARGET_TP).toBe(-1)
  })
})
