// packages/video-factory/src/spec/validate.ts
//
// **설계도가 품질 규칙을 어기면 렌더 전에 막는다.**
//
// 왜 렌더 뒤가 아니라 앞인가: 한 편 렌더에 분 단위가 든다. 자막 빠진 컷을 90편 찍고 나서
// 알면 그 시간이 전부 버려진다 — 이 저장소가 드레인에서 배운 것과 같다("빈 값을 넣지 않는다").

import type { VideoSpec } from './types'
import { captionFrames, MAX_CAPTION_SEC } from './timing'
import { FPS } from './format'

export interface SpecProblem {
  specId: string
  rule: string
  detail: string
}

/** 부제 상한 — 공개 화면 I4 와 같은 바닥을 영상에도 쓴다. */
export const SUBTITLE_MAX = 90

export function sceneFrames(
  scene: VideoSpec['scenes'][number],
  audience: VideoSpec['audience'],
): number {
  return scene.frames ?? captionFrames(scene.caption, audience)
}

export function totalFrames(spec: VideoSpec): number {
  return spec.scenes.reduce((sum, s) => sum + sceneFrames(s, spec.audience), 0)
}

/**
 * 설계도 한 편을 검사한다. 문제가 없으면 빈 배열.
 *
 * 규칙은 전부 **기계로 확인 가능한 것만** 넣었다 — "임팩트 있는가" 같은 것은 여기 못 넣는다.
 */
export function validateSpec(spec: VideoSpec): SpecProblem[] {
  const out: SpecProblem[] = []
  const push = (rule: string, detail: string) => out.push({ specId: spec.id, rule, detail })

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(spec.id)) {
    push('id-slug', `id 는 소문자 kebab 이어야 한다: ${spec.id}`)
  }
  if (spec.subtitle.length > SUBTITLE_MAX) {
    push('subtitle-length', `부제 ${spec.subtitle.length}자 > ${SUBTITLE_MAX}자`)
  }
  if (spec.scenes.length === 0) {
    push('empty', '컷이 하나도 없다')
  }
  if (spec.formats.length === 0) {
    push('no-format', '출력 규격이 없다')
  }

  spec.scenes.forEach((scene, i) => {
    if (scene.caption.trim().length === 0) {
      push('caption-required', `컷 ${i}(${scene.kind})에 자막이 없다`)
    }
    const f = sceneFrames(scene, spec.audience)
    if (f > MAX_CAPTION_SEC * FPS && scene.frames === undefined) {
      push('caption-too-long', `컷 ${i} 자막이 ${MAX_CAPTION_SEC}초를 넘는다 — 쪼개야 한다`)
    }
    if (f < 1) push('zero-length', `컷 ${i} 길이가 0`)
  })

  spec.evidence.forEach((e, i) => {
    if (e.source.trim().length === 0) {
      push('evidence-source', `근거 ${i}(${e.label})에 출처가 없다`)
    }
  })

  // 닫는 컷이 없으면 "다음 한 걸음" 이 없는 영상이 된다(D5).
  if (!spec.scenes.some((s) => s.kind === 'closing')) {
    push('no-closing', '닫는 컷(다음 한 걸음)이 없다')
  }

  return out
}

export function validateAll(specs: VideoSpec[]): SpecProblem[] {
  const seen = new Set<string>()
  const out: SpecProblem[] = []
  for (const spec of specs) {
    if (seen.has(spec.id)) {
      out.push({ specId: spec.id, rule: 'duplicate-id', detail: '같은 id 가 두 번 나왔다' })
    }
    seen.add(spec.id)
    out.push(...validateSpec(spec))
  }
  return out
}
