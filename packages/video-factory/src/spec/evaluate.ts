// packages/video-factory/src/spec/evaluate.ts
//
// **평가 — 찍은 것이 규격 안인가.**
//
// 파이프라인의 세 단계(기획·제작·평가) 중 마지막. 이게 없어서 지금까지 "찍었다" 는 알아도
// **"잘 찍었나"** 는 아무도 답하지 못했다 — 결함은 스틸을 띄워 눈으로 볼 때만 드러났고,
// 그 방식은 219개 컴포지션에서 되풀이할 수가 없다.
//
// ── 이 파일이 지키는 규칙 하나 ─────────────────────────────────────
// **출처 없는 임계값을 만들지 않는다.**
//
// 「시중 광고보다 우위」를 대부분의 축에서 잴 수 없는 이유와 같다 — 경쟁사 파이프라인은
// 관측이 안 되므로 비교값이 아니라 인상이 된다. 그래서 여기서는 **바깥에 공개된 규격**이
// 있는 축만 합격/불합격을 매기고, 없는 축은 **재기만 하고 판정하지 않는다**
// (`/admin/video` 의 「수치 낡음」 탭이 임계값을 두지 않은 것과 같은 판단).
//
// 재기만 하는 축을 0 으로 접거나 "대충 이 정도면" 하고 선을 그으면, 그 선이 다음 사람에게는
// 근거처럼 보인다. 이 저장소가 반복해서 경계해 온 실패 모양이다.

import { FPS } from './format'
import { CPS, MAX_CAPTION_SEC, MIN_CAPTION_SEC } from './timing'
import { sceneFrames, totalFrames } from './validate'
import type { VideoSpec } from './types'

/** 외부 규격의 출처 — 판정에 쓰는 모든 수는 이 중 하나를 댄다. */
export const SOURCES = {
  youtube: 'YouTube 라우드니스 정규화 규격 (2026-09-13 확인)',
  shorts: 'YouTube Shorts 길이 상한 (2026-09-13 확인)',
  netflix: 'Netflix Timed Text Style Guide (2026-09-12 확인)',
  repo: 'CLAUDE.md · 이 저장소의 규칙',
} as const

export type SourceKey = keyof typeof SOURCES

/** YouTube Shorts 로 나갈 수 있는 최대 길이(초). 세로 규격에만 건다. */
export const SHORTS_MAX_SEC = 60

export type Verdict = 'pass' | 'fail' | 'unknown' | 'measured'

export interface AxisResult {
  id: string
  /** 사람이 읽는 이름 */
  label: string
  /**
   * `pass`/`fail` — 외부 규격이 있는 축.
   * `measured` — **규격이 없어 판정하지 않는 축.** 값만 남긴다.
   * `unknown` — 잴 수 없었다(0 이 아니다).
   */
  verdict: Verdict
  /** 관측값 — 화면에 그대로 낸다. */
  value: string
  /** 규격. 판정하지 않는 축은 null. */
  limit: string | null
  source: SourceKey | null
  /** 어긋난 자리(컷 번호 등). 통과면 빈 배열. */
  offenders: string[]
}

export interface Scorecard {
  videoId: string
  kind: string
  axes: AxisResult[]
  pass: number
  fail: number
  unknown: number
  /** 판정 대상 축 중 통과 비율. 판정 대상이 없으면 null. */
  ratio: number | null
}

/** 잰 음량 — `render/loudness.ts` 가 준다. 없으면 그 축은 `unknown`. */
export interface LoudnessInput {
  integrated: number | null
  truePeak: number | null
  targetLufs: number
  targetTp: number
  toleranceLu: number
}

/** 실제로 쓰인 자막 큐 — `render/cue.ts` 가 나눈 결과. */
export interface CueInput {
  start: number
  end: number
  text: string
}

export interface EvaluateInput {
  /** 음성 실측 길이가 반영된 설계도. */
  spec: VideoSpec
  /** 그 편의 자막 큐 전부. 없으면 자막 축은 `unknown`. */
  cues?: CueInput[]
  /** 규격별 음량. 없으면 음량 축은 `unknown`. */
  loudness?: Record<string, LoudnessInput>
}

function fixed(n: number, d = 1): string {
  return n.toFixed(d)
}

/** 이 편의 총 길이(초) — 음성 실측이 반영된 값. */
export function durationSec(spec: VideoSpec): number {
  // `frames` 는 선택 필드다 — 음성을 안 구운 컷은 자막 길이 계산으로 떨어진다.
  // 여기서 `?? 0` 으로 접으면 그 컷이 **길이 0** 이 되어 총 길이가 거짓이 된다.
  return totalFrames(spec) / FPS
}

/* ── 축 ───────────────────────────────────────────────────────── */

function axisLoudness(input: EvaluateInput): AxisResult[] {
  const out: AxisResult[] = []
  for (const format of input.spec.formats) {
    const l = input.loudness?.[format]
    const base = {
      id: `loudness:${format}`,
      label: `음량 (${format})`,
      limit: l ? `${l.targetLufs} LUFS ±${l.toleranceLu} · 피크 ≤ ${l.targetTp} dBTP` : null,
      source: 'youtube' as SourceKey,
    }
    if (!l || l.integrated === null || l.truePeak === null) {
      // **못 잰 것은 합격이 아니다.** 0 으로 접으면 조용히 통과한다.
      out.push({ ...base, verdict: 'unknown', value: '못 잼', offenders: [] })
      continue
    }
    const ok =
      Math.abs(l.integrated - l.targetLufs) <= l.toleranceLu && l.truePeak <= l.targetTp
    out.push({
      ...base,
      verdict: ok ? 'pass' : 'fail',
      value: `${l.integrated} LUFS · 피크 ${l.truePeak} dBTP`,
      offenders: ok ? [] : [format],
    })
  }
  return out
}

function axisShorts(input: EvaluateInput): AxisResult {
  const sec = durationSec(input.spec)
  // 세로를 안 찍는 편에는 이 규격이 적용되지 않는다 — 없는 제약을 걸지 않는다.
  if (!input.spec.formats.includes('vertical')) {
    return {
      id: 'shorts',
      label: 'Shorts 길이',
      verdict: 'measured',
      value: `${fixed(sec)}초 (세로 없음 — 해당 없음)`,
      limit: null,
      source: null,
      offenders: [],
    }
  }
  const ok = sec <= SHORTS_MAX_SEC
  return {
    id: 'shorts',
    label: 'Shorts 길이',
    verdict: ok ? 'pass' : 'fail',
    value: `${fixed(sec)}초`,
    limit: `≤ ${SHORTS_MAX_SEC}초`,
    source: 'shorts',
    offenders: ok ? [] : [`${fixed(sec)}초`],
  }
}

function axisCueLength(input: EvaluateInput): AxisResult {
  const base = {
    id: 'cue-length',
    label: '자막 노출 길이',
    limit: `${MIN_CAPTION_SEC.toFixed(2)}~${MAX_CAPTION_SEC}초`,
    source: 'netflix' as SourceKey,
  }
  if (!input.cues) {
    return { ...base, verdict: 'unknown', value: '자막을 못 읽었다', offenders: [] }
  }
  const bad: string[] = []
  let longest = 0
  for (const [i, c] of input.cues.entries()) {
    const d = c.end - c.start
    if (d > longest) longest = d
    // 최소 미달은 **마지막 큐 하나**에서 반올림으로 생길 수 있어 0.02초 여유를 둔다.
    if (d > MAX_CAPTION_SEC || d < MIN_CAPTION_SEC - 0.02) {
      bad.push(`큐 ${i + 1} ${fixed(d, 2)}초`)
    }
  }
  return {
    ...base,
    verdict: bad.length === 0 ? 'pass' : 'fail',
    value: `큐 ${input.cues.length}개 · 가장 긴 것 ${fixed(longest, 2)}초`,
    offenders: bad,
  }
}

function axisCueSpeed(input: EvaluateInput): AxisResult {
  const limit = CPS[input.spec.audience]
  const base = {
    id: 'cue-speed',
    label: '자막 읽기 속도',
    limit: `≤ ${limit} CPS (${input.spec.audience === 'learner' ? '아동물' : '성인'})`,
    source: 'netflix' as SourceKey,
  }
  if (!input.cues) {
    return { ...base, verdict: 'unknown', value: '자막을 못 읽었다', offenders: [] }
  }
  const bad: string[] = []
  let fastest = 0
  for (const [i, c] of input.cues.entries()) {
    const d = c.end - c.start
    if (d <= 0) continue
    const cps = c.text.length / d
    if (cps > fastest) fastest = cps
    if (cps > limit) bad.push(`큐 ${i + 1} ${fixed(cps)} CPS`)
  }
  return {
    ...base,
    verdict: bad.length === 0 ? 'pass' : 'fail',
    value: `가장 빠른 것 ${fixed(fastest)} CPS`,
    offenders: bad,
  }
}

function axisEvidence(input: EvaluateInput): AxisResult {
  const bad = input.spec.evidence.filter((e) => e.source.trim() === '').map((e) => e.label)
  return {
    id: 'evidence',
    label: '수치의 출처',
    verdict: bad.length === 0 ? 'pass' : 'fail',
    value: `근거 ${input.spec.evidence.length}건`,
    // 광고로 쓰는 화면이라 출처 없는 수치는 표시광고법 문제다. 취향이 아니다.
    limit: '전부 출처 있음',
    source: 'repo',
    offenders: bad,
  }
}

function axisCaptionPresence(input: EvaluateInput): AxisResult {
  const bad = input.spec.scenes
    .map((s, i) => (s.caption.trim() === '' ? `컷 ${i + 1}` : null))
    .filter((x): x is string => x !== null)
  return {
    id: 'caption-presence',
    label: '자막 없는 컷',
    verdict: bad.length === 0 ? 'pass' : 'fail',
    value: `${input.spec.scenes.length}컷 중 ${bad.length}개 없음`,
    limit: '0개',
    source: 'repo',
    offenders: bad,
  }
}

/**
 * 첫 컷 길이 — **판정하지 않는다.**
 *
 * "첫 3초가 중요하다" 는 말은 널리 쓰이지만, 우리가 근거로 댈 만한 **공개된 임계값**이 없다.
 * 숫자를 정해 놓으면 그 숫자가 다음 사람에게 근거처럼 보인다. 그래서 재기만 한다 —
 * 재생 데이터가 쌓이면 그때 **우리 데이터로** 선을 그을 수 있다(지금 재생은 0이다).
 */
function axisHook(input: EvaluateInput): AxisResult {
  const first = input.spec.scenes[0]
  return {
    id: 'hook',
    label: '첫 컷 길이',
    verdict: 'measured',
    value: first ? `${fixed(sceneFrames(first, input.spec.audience) / FPS)}초` : '컷 없음',
    limit: null,
    source: null,
    offenders: [],
  }
}

/* ── 조립 ─────────────────────────────────────────────────────── */

export function evaluateVideo(input: EvaluateInput): Scorecard {
  const axes: AxisResult[] = [
    ...axisLoudness(input),
    axisShorts(input),
    axisCueLength(input),
    axisCueSpeed(input),
    axisCaptionPresence(input),
    axisEvidence(input),
    axisHook(input),
  ]
  const pass = axes.filter((a) => a.verdict === 'pass').length
  const fail = axes.filter((a) => a.verdict === 'fail').length
  const unknown = axes.filter((a) => a.verdict === 'unknown').length
  const judged = pass + fail
  return {
    videoId: input.spec.id,
    kind: input.spec.kind,
    axes,
    pass,
    fail,
    unknown,
    ratio: judged === 0 ? null : pass / judged,
  }
}

export interface EvaluationSummary {
  videos: number
  /** 한 축도 어긋나지 않은 편 */
  clean: number
  /** 어긋난 축이 하나라도 있는 편 */
  failing: number
  /** 못 잰 축이 있는 편 — 합격으로도 불합격으로도 세지 않는다 */
  incomplete: number
  /** 축 id → 어긋난 편 수 */
  failsByAxis: Record<string, number>
}

export function summarize(cards: Scorecard[]): EvaluationSummary {
  const failsByAxis: Record<string, number> = {}
  let clean = 0
  let failing = 0
  let incomplete = 0
  for (const c of cards) {
    if (c.fail > 0) failing++
    else if (c.unknown > 0) incomplete++
    else clean++
    for (const a of c.axes) {
      if (a.verdict === 'fail') failsByAxis[a.id] = (failsByAxis[a.id] ?? 0) + 1
    }
  }
  return { videos: cards.length, clean, failing, incomplete, failsByAxis }
}
