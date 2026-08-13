// apps/web/src/hooks/dictation/useDictationSession.ts
//
// 받아쓰기 세션 런타임 — 문항 진행 + 채점 + 적재.
//
// v07 구조:
//   생성  createDictationSession(source, config) → DB 세션 INSERT + 로컬 캐시
//   진행  submitAnswer → 채점 · 오류 태깅 · 타깃 판정 → dictation_attempts INSERT(비동기)
//   완주  finish → 세션 통계 UPDATE + scores + 타깃 단어 FSRS flush
//
// 문항마다 즉시 적재하는 이유는 persist.ts 헤더 참조 — 중도 이탈해도 푼 만큼 남는다.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { deriveErrorTags } from '@/lib/dictation/error-tags'
import {
  completeDictationSession,
  saveDictationAttempt,
  startDictationSession,
  type CompleteResult,
} from '@/lib/dictation/persist'
import { scoreSentence } from '@/lib/dictation/scoring'
import { getSession, saveSession } from '@/lib/dictation/storage'
import { evaluateTargets, reduceTargetRatings } from '@/lib/dictation/targets'
import {
  countWords,
  pickBySpan,
  spanBand,
  type DictationSentence,
  type DictationSource,
} from '@/lib/dictation/source'
import type {
  ChunkSize,
  DictationConfig,
  DictationItem,
  DictationSession,
  ScoringResult,
} from '@/lib/dictation/types'

// ── 문항 조립 ─────────────────────────────────────────────────────

/** 연속 문장 N개를 한 문항으로 묶는다. 묶으면 타깃 단어도 합쳐진다. */
function chunkSentences(sentences: DictationSentence[], size: ChunkSize): DictationSentence[] {
  if (size <= 1) return sentences
  const out: DictationSentence[] = []
  for (let i = 0; i < sentences.length; i += size) {
    const group = sentences.slice(i, i + size)
    if (group.length === 0) continue
    const targetForms: Record<string, string[]> = {}
    const targetWords: string[] = []
    for (const g of group) {
      for (const w of g.targetWords) {
        if (!targetWords.includes(w)) targetWords.push(w)
        targetForms[w] = g.targetForms[w] ?? []
      }
    }
    out.push({
      text: group.map((g) => g.text).join(' '),
      targetWords: targetWords.slice(0, 4),
      targetForms,
      contextLabel: group[0].contextLabel,
      reason: group[0].reason,
      translation: group[0].translation,
    })
  }
  return out
}

function buildItems(
  source: DictationSource,
  config: DictationConfig,
  /** 학습자의 청취 폭 — 문항을 고를 때 길이대를 맞춘다. 없으면 짧은 쪽부터. */
  span?: number | null,
): DictationItem[] {
  // 묶고 나서 섞는다 — 먼저 섞으면 이어지지 않는 문장이 한 문항에 붙는다.
  let chunks = chunkSentences(source.sentences, config.chunkSize)
  if (config.order === 'random') {
    chunks = [...chunks]
    for (let i = chunks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[chunks[i], chunks[j]] = [chunks[j], chunks[i]]
    }
  }
  if (config.count !== 'all') {
    // 앞에서 N개 자르지 않는다 — 챕터 첫 부분만 반복되고 길이도 학습자와 무관해진다.
    // 청취 폭에 맞는 문항을 고르되 **등장 순서는 그대로**(pickBySpan 이 보존).
    // 오늘의 받아쓰기는 이미 이유별로 골라 온 목록이라 그대로 앞에서 자른다.
    chunks =
      source.kind === 'daily'
        ? chunks.slice(0, config.count)
        : pickBySpan(chunks, config.count, spanBand(span))
  }

  return chunks.map((c, idx) => ({
    index: idx,
    expectedText: c.text,
    translation: c.translation,
    targetWords: c.targetWords,
    targetForms: c.targetForms,
    contextLabel: c.contextLabel,
    reason: c.reason,
    attemptCount: 0,
    hintsUsed: 0,
    maxHintLevel: 0,
    replayCount: 0,
  }))
}

/**
 * 세션 생성 — DB 행을 먼저 만들고 그 uuid 를 세션 id 로 쓴다.
 * 비로그인이면 `local-*` id 로 degrade (학습은 되고 기록만 이 기기 한정).
 */
export async function createDictationSession(
  source: DictationSource,
  config: DictationConfig,
  /** 학습자 청취 폭(`dictation_overview().span`). 문항 길이 적응에 쓴다. */
  span?: number | null,
): Promise<DictationSession | null> {
  const items = buildItems(source, config, span)
  if (items.length === 0) return null

  const client = createClient()
  const started = await startDictationSession(client, source, config, items.length)

  const session: DictationSession = {
    id: started.id,
    persisted: started.persisted,
    config,
    resourceTitle: source.title,
    resourceSubtitle: source.subtitle,
    sourceKind: source.kind,
    textId: source.textId,
    libraryBookId: source.libraryBookId,
    chapterIdx: source.chapterIdx,
    sharedSetId: source.sharedSetId,
    items,
    currentIndex: 0,
    startedAt: Date.now(),
    totalHintsUsed: 0,
  }
  saveSession(session)
  return session
}

export type DictationSessionStatus = 'loading' | 'ready' | 'not-found'

export interface SubmitOutcome {
  result: ScoringResult
  errorTags: string[]
  targetHits: string[]
  targetMisses: string[]
}

export function useDictationSession(sessionId: string | null) {
  const [session, setSession] = useState<DictationSession | null>(null)
  const [status, setStatus] = useState<DictationSessionStatus>('loading')
  const [finishResult, setFinishResult] = useState<CompleteResult | null>(null)
  // 완주 적재는 정확히 1회 (StrictMode 이중 마운트·재렌더 방어)
  const finishedRef = useRef(false)

  useEffect(() => {
    if (!sessionId) {
      setStatus('not-found')
      return
    }
    const s = getSession(sessionId)
    if (s) {
      setSession(s)
      setStatus('ready')
    } else {
      setStatus('not-found')
    }
  }, [sessionId])

  const persist = useCallback((next: DictationSession) => {
    setSession(next)
    saveSession(next)
  }, [])

  /** 다시 듣기 1회 — 난이도 판정(FSRS 등급)의 입력이라 세션에 남긴다. */
  const noteReplay = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev
      const items = prev.items.map((it, idx) =>
        idx === prev.currentIndex ? { ...it, replayCount: it.replayCount + 1 } : it,
      )
      const next = { ...prev, items }
      saveSession(next)
      return next
    })
  }, [])

  const submitAnswer = useCallback(
    (userInput: string, timeMs: number): SubmitOutcome | null => {
      if (!session) return null
      const item = session.items[session.currentIndex]
      if (!item) return null

      const result = scoreSentence(item.expectedText, userInput, session.config.scoring)

      const outcomes = evaluateTargets({
        expected: item.expectedText,
        targetWords: item.targetWords,
        targetForms: item.targetForms,
        wordResults: result.wordResults,
        hintsUsed: item.hintsUsed,
        maxHintLevel: item.maxHintLevel,
        replayCount: item.replayCount,
        skipped: false,
      })
      const targetHits = outcomes.filter((o) => o.hit).map((o) => o.word)
      const targetMisses = outcomes.filter((o) => !o.hit).map((o) => o.word)

      const errorTags = deriveErrorTags({
        wordResults: result.wordResults,
        expected: item.expectedText,
        actual: userInput,
        missedTargets: targetMisses,
      })

      const updated: DictationItem = {
        ...item,
        userInput,
        result,
        attemptCount: item.attemptCount + 1,
        timeMs,
        errorTags,
        targetHits,
        skipped: false,
      }
      persist({
        ...session,
        items: session.items.map((it, idx) => (idx === session.currentIndex ? updated : it)),
      })

      void saveDictationAttempt(createClient(), {
        sessionId: session.id,
        itemIdx: item.index,
        expected: item.expectedText,
        userInput,
        accuracy: result.accuracy,
        hintsUsed: item.hintsUsed,
        replayCount: item.replayCount,
        durationMs: timeMs,
        skipped: false,
        wordResults: result.wordResults,
        errorTags,
        targetWords: item.targetWords,
        targetHits,
      })

      return { result, errorTags, targetHits, targetMisses }
    },
    [session, persist],
  )

  /** 힌트 1회 — 단계(level)를 함께 받는다. 강도가 등급을 가른다(targets.ts 참조). */
  const consumeHint = useCallback(
    (level: number) => {
      if (!session) return
      const items = session.items.map((it, idx) =>
        idx === session.currentIndex
          ? {
              ...it,
              hintsUsed: it.hintsUsed + 1,
              maxHintLevel: Math.max(it.maxHintLevel, level),
            }
          : it,
      )
      persist({ ...session, items, totalHintsUsed: session.totalHintsUsed + 1 })
    },
    [session, persist],
  )

  /** 완주 — 통계 집계 + 3곳 적재. */
  const finish = useCallback(
    async (final: DictationSession) => {
      if (finishedRef.current) return
      finishedRef.current = true

      const answered = final.items.filter((it) => it.result != null || it.skipped)
      const totalAccuracy =
        answered.length > 0
          ? answered.reduce((sum, it) => sum + (it.result?.accuracy ?? 0), 0) / answered.length
          : 0
      const totalTimeMs = Date.now() - final.startedAt

      // 청취 폭 — 힌트 없이 100% 로 받아쓴 문항 중 가장 긴 것의 단어 수
      const span = final.items.reduce((max, it) => {
        if (!it.result || it.hintsUsed > 0 || it.skipped) return max
        if (it.result.accuracy < 100) return max
        return Math.max(max, countWords(it.expectedText))
      }, 0)

      const completed: DictationSession = {
        ...final,
        completedAt: Date.now(),
        totalAccuracy,
        totalTimeMs,
      }
      persist(completed)

      const allOutcomes = final.items.flatMap((it) =>
        it.result
          ? evaluateTargets({
              expected: it.expectedText,
              targetWords: it.targetWords,
              targetForms: it.targetForms,
              wordResults: it.result.wordResults,
              hintsUsed: it.hintsUsed,
              maxHintLevel: it.maxHintLevel,
              replayCount: it.replayCount,
              skipped: !!it.skipped,
            })
          : it.skipped
            ? it.targetWords.map((w) => ({ word: w, hit: false, partial: false, rating: 1 as const }))
            : [],
      )

      const res = await completeDictationSession(createClient(), {
        sessionId: final.id,
        source: {
          kind: final.sourceKind as DictationSource['kind'],
          title: final.resourceTitle,
          subtitle: final.resourceSubtitle,
          sentences: [],
          textId: final.textId,
          libraryBookId: final.libraryBookId,
          chapterIdx: final.chapterIdx,
          sharedSetId: final.sharedSetId,
        },
        completedItems: answered.length,
        totalItems: final.items.length,
        avgAccuracy: totalAccuracy,
        totalHints: final.totalHintsUsed,
        durationMs: totalTimeMs,
        longestPerfectWords: span,
        targetRatings: reduceTargetRatings(allOutcomes),
      })
      setFinishResult(res)
    },
    [persist],
  )

  const next = useCallback(() => {
    if (!session) return
    if (session.currentIndex >= session.items.length - 1) {
      void finish(session)
      return
    }
    persist({ ...session, currentIndex: session.currentIndex + 1 })
  }, [session, persist, finish])

  const skip = useCallback(() => {
    if (!session) return
    const item = session.items[session.currentIndex]
    if (!item) return
    const updated: DictationItem = {
      ...item,
      userInput: item.userInput ?? '',
      attemptCount: item.attemptCount + 1,
      skipped: true,
      errorTags: item.targetWords.length > 0 ? ['missed-target'] : [],
      targetHits: [],
    }
    const nextSession = {
      ...session,
      items: session.items.map((it, idx) => (idx === session.currentIndex ? updated : it)),
    }
    persist(nextSession)

    void saveDictationAttempt(createClient(), {
      sessionId: session.id,
      itemIdx: item.index,
      expected: item.expectedText,
      userInput: '',
      accuracy: 0,
      hintsUsed: item.hintsUsed,
      replayCount: item.replayCount,
      durationMs: 0,
      skipped: true,
      wordResults: [],
      errorTags: updated.errorTags ?? [],
      targetWords: item.targetWords,
      targetHits: [],
    })

    if (nextSession.currentIndex >= nextSession.items.length - 1) {
      void finish(nextSession)
      return
    }
    persist({ ...nextSession, currentIndex: nextSession.currentIndex + 1 })
  }, [session, persist, finish])

  const isComplete = !!session?.completedAt
  const currentItem = session?.items[session.currentIndex]
  const progress = session ? (session.currentIndex + 1) / session.items.length : 0

  return {
    session,
    status,
    currentItem,
    progress,
    isComplete,
    finishResult,
    submitAnswer,
    consumeHint,
    noteReplay,
    next,
    skip,
  }
}
