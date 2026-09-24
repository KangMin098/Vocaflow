// packages/video-factory/src/requests/to-spec.ts
//
// **초안(설계) + 원료 → 설계도(VideoSpec).**
//
// 여기서 수치가 처음으로 값이 된다 — 초안에는 경로만 있고, 값은 원료(`work/source-bundle.json`,
// DB 실측)에서만 온다. 원료에 없는 경로를 인용한 초안은 설계도가 되지 못한다.
//
// 기존 catalog 규칙(플랫폼 PR)의 장면은 `borrow` 로 가져온다 — 서가·계단·문항 컷은
// 원료에서 그려지는 것이라 초안이 흉내 낼 수 없고, 흉내 내게 두면 수치가 지어진다.

import type { SourceBundle } from '../catalog/bundle'
import type { FormatId } from '../spec/format'
import { sec } from '../spec/timing'
import type { Evidence, SceneSpec, VideoSpec } from '../spec/types'
import { validateSpec } from '../spec/validate'
import { timingAudience } from './audiences'
import { fillPlaceholders, formatFact, resolveFact } from './facts'
import type {
  DesignCheck,
  DraftScene,
  RequestAudience,
  RequestDesign,
  RequestPlan,
  RequestPurpose,
} from './types'

export interface RequestMeta {
  videoId: string
  purpose: RequestPurpose
  audience: RequestAudience
  formats: FormatId[]
  plan: RequestPlan
}

export interface BuildContext {
  bundle: SourceBundle
  /** 기존 규칙이 만든 설계도 — `borrow` 가 찾는 곳 */
  catalog: VideoSpec[]
}

export interface BuildResult {
  spec: VideoSpec | null
  problems: DesignCheck[]
}

function err(rule: string, detail: string): DesignCheck {
  return { rule, level: 'error', detail }
}

export function buildRequestSpec(
  design: RequestDesign,
  meta: RequestMeta,
  ctx: BuildContext,
): BuildResult {
  const problems: DesignCheck[] = []
  const measured = ctx.bundle.measuredAt.slice(0, 10)

  // ── 1. 수치: 경로 → 값 ─────────────────────────────────────
  const values: Record<string, string> = {}
  const evidence: Evidence[] = []
  const byName: Record<string, Evidence> = {}
  for (const f of design.facts) {
    const r = resolveFact(ctx.bundle, f.path)
    if (!r.ok || r.value === null) {
      problems.push(err('fact-unresolved', `${f.name}: ${r.reason ?? '값 없음'}`))
      continue
    }
    const shown = formatFact(r.value)
    values[f.name] = shown
    const ev: Evidence = { label: f.label, value: shown, source: `원료 ${measured} 실측 · ${f.path}` }
    byName[f.name] = ev
    evidence.push(ev)
  }
  const fill = (t: string): string => fillPlaceholders(t, values)
  const fillOpt = (t: string | undefined): string | undefined => (t === undefined ? undefined : fill(t))

  // ── 2. 장면 ─────────────────────────────────────────────────
  let accent: VideoSpec['accent'] = 'brand'
  const scenes: SceneSpec[] = []
  design.scenes.forEach((d: DraftScene, i) => {
    const base = { caption: fill(d.caption), narration: fillOpt(d.narration) }
    switch (d.kind) {
      case 'hook':
        scenes.push({ ...base, kind: 'hook', line: fill(d.line), sub: fillOpt(d.sub) })
        break
      case 'statement':
        scenes.push({ ...base, kind: 'statement', title: fill(d.title), body: fill(d.body), basis: fill(d.basis) })
        break
      case 'stat': {
        const stats = d.stats.map((s) => {
          const e = byName[s.fact]
          if (!e) {
            problems.push(err('stat-fact', `컷 ${i}: 수치 ${s.fact} 가 facts 에 없거나 못 풀렸다`))
            return null
          }
          return { value: e.value, label: s.label, source: e.source }
        })
        if (stats.every((s) => s !== null)) {
          scenes.push({ ...base, kind: 'stat', stats: stats as { value: string; label: string; source: string }[] })
        }
        break
      }
      case 'closing':
        scenes.push({ ...base, kind: 'closing', line: fill(d.line), cta: d.cta, url: d.url, frames: sec(2.6) })
        break
      case 'borrow': {
        const src = ctx.catalog.find((s) => s.id === d.videoId)
        const scene = src?.scenes[d.sceneIndex]
        if (!src || !scene) {
          problems.push(err('borrow-missing', `컷 ${i}: ${d.videoId}#${d.sceneIndex} 가 기존 설계도에 없다`))
          break
        }
        if (i === 0 || scenes.length === 0) accent = src.accent
        const copy = structuredClone(scene) as SceneSpec
        const captionChanged = copy.caption !== base.caption
        copy.caption = base.caption
        copy.narration = base.narration ?? (captionChanged ? undefined : copy.narration)
        // 자막이 바뀌면 원래 컷 길이는 더 이상 맞지 않는다 — 계산(또는 음성 실측)에 맡긴다
        if (captionChanged && copy.kind !== 'closing') delete copy.frames
        scenes.push(copy)
        // 빌린 컷의 수치 근거도 같이 온다 — 근거 없는 수치가 새어 들지 않게
        for (const e of src.evidence) {
          if (!evidence.some((x) => x.label === e.label && x.value === e.value)) evidence.push(e)
        }
        break
      }
    }
  })

  if (problems.some((p) => p.level === 'error')) return { spec: null, problems }

  const spec: VideoSpec = {
    id: meta.videoId,
    kind: 'request',
    audience: timingAudience(meta.purpose),
    title: fill(design.title),
    subtitle: fill(design.subtitle),
    accent,
    scenes,
    evidence,
    formats: meta.formats,
    brief: {
      purpose: meta.purpose,
      audience: meta.audience,
      message: meta.plan.message,
    },
  }

  for (const p of validateSpec(spec)) problems.push(err(`spec:${p.rule}`, p.detail))
  return { spec: problems.some((p) => p.level === 'error') ? null : spec, problems }
}
