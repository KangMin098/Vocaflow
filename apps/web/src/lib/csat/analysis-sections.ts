// apps/web/src/lib/csat/analysis-sections.ts
import type { DissectionItem } from './dissect'
import type { Lecture, LectureRole } from './lecture/types'
import { estimateSec, speakSegments } from './lecture/speakable'

export function analysisSpeech(text: string) {
  return speakSegments(text.split(/([A-Za-z][A-Za-z’'\-]*(?:[ ,;:]+[A-Za-z][A-Za-z’'\-]*)*)/).filter(part => part.trim()).map(part => ({
    lang: /[A-Za-z]/.test(part) ? 'en-US' as const : 'ko-KR' as const, text: part,
  })))
}

export function analysisSections(item: DissectionItem) {
  return [
    { id: 'context', title: '무엇을 연결하는 문항인가', text: `${item.topic}. ${item.format}`, role: 'intro' as LectureRole },
    { id: 'evidence', title: '근거에서 정답으로', text: item.evidence, role: 'evidence' as LectureRole },
    { id: 'distractor', title: '그 관계를 비튼 오답', text: `${item.distractor.family}. ${item.distractor.line}`, role: 'trap' as LectureRole },
    { id: 'intent', title: '출제자가 확인하려는 읽기', text: item.intent, role: 'strategy' as LectureRole },
    { id: 'pattern', title: '다음 지문에 가져갈 원리', text: item.formula, role: 'wrapup' as LectureRole },
  ].filter(section => section.text.trim())
}
export function analysisLecture(item: DissectionItem): Lecture {
  const cues = analysisSections(item).map((section, order) => ({
    id: `${item.id}:${section.id}`, order, target: { kind: 'analysis' as const, id: section.id }, role: section.role,
    segments: analysisSpeech(section.text),
    est_sec: estimateSec(analysisSpeech(section.text)), pause_after_ms: 500,
  }))
  return { item_id: item.id, version: 1, generated_by: 'analysis-sections', rubric_score: 0, total_sec_est: cues.reduce((sum, c) => sum + c.est_sec, 0), cues }
}
