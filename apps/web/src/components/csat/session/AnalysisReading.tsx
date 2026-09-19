// apps/web/src/components/csat/session/AnalysisReading.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { analysisLecture, analysisSections } from '@/lib/csat/analysis-sections'
import type { DissectionItem } from '@/lib/csat/dissect'
import { LecturePlayer, type PlayerState } from '@/lib/csat/lecture/player'
import { loadVoices, pickVoice, SilentAdapter, WebSpeechAdapter } from '@/lib/csat/lecture/tts'
import type { ReflowItem } from '@/lib/csat/reflow/types'
import { buildDissectionPassage } from '@/lib/csat/dissection-passage'
import styles from './session.module.css'
import { AnalysisWorkbench } from './AnalysisWorkbench'
import type { AnalysisFocus } from './QuestionArchitecture'
import { track } from '@/lib/analytics/client'

export function AnalysisReading({ item, paper, onReadAgain }: { item: DissectionItem; paper: ReflowItem; onReadAgain: () => void }) {
  const sections = useMemo(() => analysisSections(item), [item])
  const model = useMemo(() => buildDissectionPassage(paper.passage, item.skeleton), [paper.passage, item.skeleton])
  const player = useRef<LecturePlayer | null>(null)
  const generation = useRef(0)
  const [state, setState] = useState<PlayerState | null>(null)
  const [loading, setLoading] = useState(false)
  const [silent, setSilent] = useState(false)
  const [error, setError] = useState(false)
  const root = useRef<HTMLElement>(null)
  const [focus, setFocus] = useState<AnalysisFocus>('evidence')
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (sections.some(section => id === `analysis-${section.id}`)) {
      setFocus(id.replace('analysis-', '') as AnalysisFocus)
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'auto' }))
    }
  }, [sections])
  useEffect(() => () => { generation.current++; player.current?.destroy(); player.current = null }, [])
  const play = async (index: number) => {
    const ticket = ++generation.current
    setLoading(true); setError(false)
    try {
      if (!player.current) {
        const voices = await loadVoices()
        if (ticket !== generation.current) return
        const ko = pickVoice(voices, 'ko-KR')
        setSilent(!ko)
        const adapter = ko ? new WebSpeechAdapter({ ko, en: pickVoice(voices, 'en-US') }) : new SilentAdapter()
        adapter.onCueEnd = (_cue, outcome) => { if (outcome.errors.length) setError(true) }
        player.current = new LecturePlayer(analysisLecture(item), adapter, setState)
      }
      await player.current.play(index)
    } catch { if (ticket === generation.current) setError(true) }
    finally { if (ticket === generation.current) setLoading(false) }
  }
  const active = state && (state.status === 'playing' || state.status === 'paused') ? sections[state.index]?.id : null
  useEffect(() => { if (active) setFocus(active as AnalysisFocus) }, [active])
  const select = (next: AnalysisFocus) => {
    // Manual inspection stops speech so voice and visual cannot silently diverge.
    stop(); setFocus(next)
    track({ name: 'csat_session_explained', props: { kind: next === 'evidence' ? 'evidence' : next === 'distractor' ? 'reject' : 'more' } })
  }
  const stop = () => { generation.current++; player.current?.destroy(); player.current = null; setState(null); setLoading(false) }
  const locate = () => root.current?.querySelector(`[data-analysis="${active}"]`)?.scrollIntoView({ block: 'center', behavior: 'auto' })
  if (!paper.ok || !model.sentences.some(s => s.marks.some(m => m.anchorId === 'answer'))) return <section className={styles.empty}><p>분석의 근거 문장 위치를 확인하지 못했어요. 문제지를 다시 놓아 주세요.</p><button className={styles.primary} onClick={onReadAgain}>문제지 다시 놓기</button></section>
  return <article ref={root} className={styles.reading} data-testid="analysis-reading">
    <header className={styles.itemHeader}><p className={styles.eyebrow}>{item.exam_id} · {item.no}번 · 분석 읽기</p><h1>{item.topic}</h1><p className={styles.description}>{item.format}</p></header>
    <div className={styles.listening} aria-label="분석 듣기">
      <button className={styles.textButton} disabled={loading} onClick={() => state && state.status !== 'ended' ? player.current?.toggle() : void play(0)}>{loading ? '음성 준비 중…' : state?.status === 'playing' ? '일시정지' : state?.status === 'paused' ? '이어서 듣기' : '분석 듣기'}</button>
      {active && <><button className={styles.textButton} onClick={locate}>현재 설명 위치</button><button className={styles.textButton} onClick={stop}>듣기 종료</button></>}
      <p className={styles.quiet} role="status">{active ? `${state?.status === 'paused' ? '멈춤' : '설명 중'} · ${sections[state!.index].title}` : '읽는 분석을 같은 순서로 들어요.'}{silent && ' 한국어 음성이 없어 강조만 진행해요.'}{error && ' 음성을 시작하지 못했어요. 다시 눌러 주세요.'}</p>
    </div>
    <AnalysisWorkbench item={item} paper={paper} model={model} focus={focus} active={active} onSelect={select} onPlay={index => void play(index)} loading={loading} />
  </article>
}

