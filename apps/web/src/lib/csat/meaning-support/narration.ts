// apps/web/src/lib/csat/meaning-support/narration.ts
//
// **원문 이해 교수 판 읽어 주기 — 검수된 설명을 그대로 큐로 바꾼다.** (v3.1 보완안 「새 교수 설명의 TTS 연동」 · 2026-10-14)
//
// 새 대본을 쓰지 않는다: sidecar 에 이미 있고 독립 검수된 본문(명제 · 관계 변화 · 전체 설명 · 정확한 뜻 · 쉬운 말 · 지킬 조건)을
// 화면에 보이는 순서 그대로 큐로 만든다. 각 큐는 **화면의 같은 자리**(단계 · 연결 · 결론 · 의미 칸)를 가리키는 key 와
// 그 설명이 걸린 원문 문장(지도 막대, 0부터)을 함께 싣는다 — 말과 강조가 같은 근거를 가리키게.
// 한/영이 섞이면 발음이 무너지므로 기존 분석 듣기와 같은 분할(analysisSpeech)을 쓴다.

import { analysisSpeech } from '../analysis-sections'
import { estimateSec } from '../lecture/speakable'
import type { Lecture, LectureCue, LectureRole } from '../lecture/types'
import type { MeaningSupportView, MsUnit } from './labels'
import { FACET_LABEL, RELATION_KIND_LABEL, WHOLE_TITLE } from './labels'
import { relationSentences, sentencesOf } from './model'

export interface NarrationCue extends LectureCue {
  /** 화면 자리 — `step:<propId>` · `link:<relId>` · `result` · `unit:<unitId>:exact|simple|preserve` */
  key: string
  /** 이 큐가 말하는 원문 문장(1부터) */
  sentences: number[]
}

function cue(itemId: string, order: number, key: string, role: LectureRole, text: string, sentences: number[]): NarrationCue {
  const segments = analysisSpeech(text)
  return {
    id: `${itemId}:ms:${key}`,
    order,
    key,
    sentences,
    // 지도 막대는 0부터 — 첫 문장을 대표로 비춘다(없으면 설명 블록)
    target: sentences.length ? { kind: 'anchor', id: `sentence:${sentences[0] - 1}` } : { kind: 'analysis', id: 'map' },
    focus: sentences.map((n) => n - 1),
    role,
    segments,
    est_sec: estimateSec(segments),
    pause_after_ms: 400,
  }
}

const propSentences = (view: MeaningSupportView, pid: string) => {
  const p = view.propositions.find((x) => x.id === pid)
  const ns = (p?.anchorIds ?? []).map((id) => view.anchors.find((a) => a.id === id)?.sentence).filter((n): n is number => typeof n === 'number')
  return [...new Set(ns)].sort((a, b) => a - b)
}

/** 글 전체 통합 단계 — 명제 → (연결) → 명제 … → 결론. `steps` 는 화면이 그린 순서(integrationSteps) 그대로 받는다 */
export function wholeNarration(
  view: MeaningSupportView,
  steps: { props: { id: string; textKo: string }[]; links: ({ id: string; kind: keyof typeof RELATION_KIND_LABEL; changeKo: string } | null)[] },
): NarrationCue[] {
  const out: NarrationCue[] = []
  steps.props.forEach((p, i) => {
    const link = i > 0 ? steps.links[i - 1] : null
    if (link) out.push(cue(view.itemId, out.length, `link:${link.id}`, 'structure', `${RELATION_KIND_LABEL[link.kind]}. ${link.changeKo}`, relationSentences(view, link.id)))
    out.push(cue(view.itemId, out.length, `step:${p.id}`, i === 0 ? 'intro' : 'evidence', `${i + 1}단계. ${p.textKo}`, propSentences(view, p.id)))
  })
  out.push(cue(view.itemId, out.length, 'result', 'wrapup', `그래서, ${WHOLE_TITLE[view.whole.genre]}. ${view.whole.summaryKo}`, []))
  return out
}

/** 의미 하나 — 정확한 뜻 → 쉬운 말 → 쉬운 말에서도 지킬 조건 */
export function unitNarration(view: MeaningSupportView, unit: MsUnit): NarrationCue[] {
  const ns = sentencesOf(view, unit.id)
  const out: NarrationCue[] = [
    cue(view.itemId, 0, `unit:${unit.id}:exact`, 'intro', `${unit.labelKo}. 정확한 뜻. ${unit.exactKo}`, ns),
    cue(view.itemId, 1, `unit:${unit.id}:simple`, 'structure', `쉬운 말로. ${unit.simpleKo}`, ns),
  ]
  if (unit.preserves.length) {
    const text = `쉬운 말에서도 지킬 조건. ${unit.preserves.map((p) => `${FACET_LABEL[p.facet]}, ${p.valueKo}`).join('. ')}`
    out.push(cue(view.itemId, 2, `unit:${unit.id}:preserve`, 'wrapup', text, ns))
  }
  return out
}

export function asLecture(itemId: string, cues: NarrationCue[]): Lecture {
  return { item_id: itemId, version: 1, generated_by: 'meaning-support-narration', rubric_score: 0, total_sec_est: cues.reduce((s, c) => s + c.est_sec, 0), cues }
}
