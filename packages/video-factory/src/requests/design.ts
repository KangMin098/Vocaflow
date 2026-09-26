// packages/video-factory/src/requests/design.ts
//
// **설계 초안 자동 검사 — 사람이 검토하기 전에 기계가 거르는 것.**
//
// 사람의 검토(승인·수정·반려)는 「이 이야기가 이 수요자에게 맞나」를 본다. 그 전에
// 기계로 확인 가능한 것은 여기서 전부 막는다 — 사람이 자막 글자 수를 세게 두면 안 된다.
//
// 원료(ctx)가 있으면 설계도까지 지어 보고(`buildRequestSpec`) 그 문제도 합친다.
// 원료가 없는 곳(앱 화면)에서도 돌 수 있게, 원료가 필요 없는 규칙은 따로 돈다.

import { FPS, type FormatId } from '../spec/format'
import { CPS, MAX_CAPTION_SEC, captionFrames } from '../spec/timing'
import { totalFrames } from '../spec/validate'
import { timingAudience } from './audiences'
import { PLACEHOLDER, strayDigits } from './facts'
import { buildRequestSpec, type BuildContext, type RequestMeta } from './to-spec'
import type { DesignCheck, DesignChecks, DraftScene, RequestDesign, RequestPlan, ResolvedPreview } from './types'

/** 첫 장면 안에 문제를 짚어야 하는 시간(초) */
export const HOOK_MAX_SEC = 3

/** 세로(Shorts) 상한 — `spec/evaluate.ts` 의 SHORTS_MAX_SEC 와 같은 값 */
const SHORTS_MAX_SEC = 60

/** 학습 영상이 넘기면 경고하는 길이(초) — 한 편에 한 가지를 가르친다 */
const LEARN_MAX_SEC = 120

/**
 * **근거 없는 효과 주장** — 원료가 뒷받침할 수 없는 말. 표시광고법 리스크이자
 * 이 저장소가 공개 화면에서 지워 온 종류의 문장이다.
 */
const CLAIM_PATTERNS: { re: RegExp; why: string }[] = [
  { re: /보장/, why: '결과 보장' },
  { re: /무조건|반드시\s*(오른|는다|된다)/, why: '단정' },
  { re: /(성적|점수|등급)[이가을를]?\s*(오[르른릅를]|올라|향상|상승)/, why: '성적 향상 주장' },
  { re: /(효과|효과가)\s*(입증|검증|증명)/, why: '효과 입증 주장' },
  { re: /최고|최초|1위|유일한/, why: '최상급 비교' },
  { re: /\d+\s*배\s*(빠르|높|좋)/, why: '배수 비교' },
]

function textsOf(d: DraftScene): string[] {
  const out = [d.caption, d.narration ?? '']
  switch (d.kind) {
    case 'hook':
      out.push(d.line, d.sub ?? '')
      break
    case 'statement':
      out.push(d.title, d.body, d.basis)
      break
    case 'closing':
      out.push(d.line, d.cta)
      break
    case 'stat':
      out.push(...d.stats.map((s) => s.label))
      break
    case 'borrow':
      break
  }
  return out.filter((t) => t.length > 0)
}

export function checkPlan(plan: RequestPlan): DesignCheck[] {
  const out: DesignCheck[] = []
  for (const k of ['need', 'problem', 'promise', 'message', 'action'] as const) {
    if (typeof plan[k] !== 'string' || plan[k].trim().length < 4) {
      out.push({ rule: 'plan-field', level: 'error', detail: `기획 ${k} 가 비었거나 너무 짧다` })
    }
  }
  return out
}

/**
 * 초안 검사. `ctx` 가 있으면 설계도까지 지어 본다.
 *
 * `seconds` 는 음성을 굽기 전의 **자막 길이 계산**이다 — 음성을 구우면 실측으로 바뀐다.
 */
export function checkDesign(
  plan: RequestPlan,
  design: RequestDesign,
  meta: RequestMeta,
  ctx?: BuildContext,
): DesignChecks {
  const items: DesignCheck[] = [...checkPlan(plan)]
  const e = (rule: string, detail: string) => items.push({ rule, level: 'error', detail })
  const w = (rule: string, detail: string) => items.push({ rule, level: 'warn', detail })
  const audience = timingAudience(meta.purpose)

  if (!design.title?.trim()) e('title', '제목이 없다')
  if (!Array.isArray(design.scenes) || design.scenes.length < 3) {
    e('scenes', '장면은 최소 3개 — 문제 · 해결 · 다음 행동')
    return { ok: false, seconds: 0, items }
  }

  // ── 이야기 구조: 문제 → 해결 → 행동 ─────────────────────────
  const first = design.scenes[0] as DraftScene
  const last = design.scenes[design.scenes.length - 1] as DraftScene
  if (first.role !== 'problem') e('open-with-problem', '첫 장면은 수요자의 문제(role=problem)여야 한다')
  const firstSec = first.caption.length / CPS[audience]
  if (firstSec > HOOK_MAX_SEC) {
    e('hook-too-slow', `첫 장면 자막이 ${firstSec.toFixed(1)}초 — ${HOOK_MAX_SEC}초 안에 문제를 짚어야 한다`)
  }
  if (!design.scenes.some((s) => s.role === 'solution')) e('no-solution', '해결 장면(role=solution)이 없다')
  if (last.kind !== 'closing' || last.role !== 'action') {
    e('close-with-action', '마지막 장면은 다음 행동(kind=closing, role=action)이어야 한다')
  }

  // ── 수치: 자리표시로만 ───────────────────────────────────────
  const declared = new Set((design.facts ?? []).map((f) => f.name))
  const allTexts = [design.title, design.subtitle, ...design.scenes.flatMap(textsOf)]
  for (const t of allTexts) {
    const stray = strayDigits(t)
    if (stray.length > 0) {
      e('stray-number', `근거 없이 적힌 수치 ${stray.join(', ')} — 「${t}」. facts 로 인용하고 {{이름}} 으로 쓴다`)
    }
    for (const m of t.matchAll(PLACEHOLDER)) {
      const name = m[1] ?? ''
      if (!declared.has(name)) e('unknown-fact', `{{${name}}} 가 facts 에 없다`)
    }
    for (const c of CLAIM_PATTERNS) {
      if (c.re.test(t)) e('unsupported-claim', `${c.why}: 「${t}」`)
    }
  }
  design.scenes.forEach((s, i) => {
    if (s.kind === 'stat') {
      for (const st of s.stats) if (!declared.has(st.fact)) e('unknown-fact', `컷 ${i}: ${st.fact} 가 facts 에 없다`)
    }
    if (s.caption.length / CPS[audience] > MAX_CAPTION_SEC) {
      e('caption-too-long', `컷 ${i} 자막이 ${MAX_CAPTION_SEC}초를 넘는다 — 쪼갠다`)
    }
    if (s.narration && /[A-Za-z]{2,}/.test(s.narration) && !/[가-힣]/.test(s.narration)) {
      w('tts-mixed', `컷 ${i} 나레이션이 영어뿐 — 한국어 음성이 영어를 읽는다. 뜻을 한국어로 풀거나 자막에만 둔다`)
    }
  })

  // ── 설계도까지 지어 본다 ─────────────────────────────────────
  let seconds = design.scenes.reduce((n, s) => n + captionFrames(s.caption, audience), 0) / FPS
  let preview: ResolvedPreview | undefined
  if (ctx) {
    const built = buildRequestSpec(design, meta, ctx)
    items.push(...built.problems)
    if (built.spec) {
      seconds = totalFrames(built.spec) / FPS
      preview = {
        title: built.spec.title,
        subtitle: built.spec.subtitle,
        scenes: built.spec.scenes.map((s) => ({ kind: s.kind, caption: s.caption, narration: s.narration })),
        evidence: built.spec.evidence,
      }
    }
  }

  const formats: FormatId[] = meta.formats
  if (formats.includes('vertical') && seconds > SHORTS_MAX_SEC) {
    w('shorts-length', `${seconds.toFixed(0)}초 — 세로 규격(Shorts) 상한 ${SHORTS_MAX_SEC}초를 넘는다`)
  }
  if (meta.purpose === 'learn' && seconds > LEARN_MAX_SEC) {
    w('learn-length', `${seconds.toFixed(0)}초 — 학습 영상은 ${LEARN_MAX_SEC}초 안에 한 가지만`)
  }

  return {
    ok: !items.some((i) => i.level === 'error'),
    seconds: Math.round(seconds * 10) / 10,
    items,
    ...(preview ? { preview } : {}),
  }
}
