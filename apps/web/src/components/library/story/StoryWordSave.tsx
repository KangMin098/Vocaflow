// apps/web/src/components/library/story/StoryWordSave.tsx
//
// LCP-D5-I01 — Story 단어 뜻 창 아래의 「내 단어장에 담기」(명시 저장 하나). 계약: docs/lcp-story/LCP_D5_INTEGRATION.md §4.1 · §5.5~9.
// - 사전이 확정한 영어 표제어일 때만 단추가 있다(없음 · 유사어 추정 · 이름 · 외국어는 「확정된 낱말만」 한 줄 — 임의 뜻을 만들지 않는다).
// - 본문 낱말과 담을 사전 표제어가 다르면 둘을 함께 보인다(무엇이 담기는지). 사전 예문은 사전 예문이며 Story 문장을 담지 않는다.
// - 저장 권위는 서버(saveStoryWordAction)에 있다 — 여기서는 고른 낱말 번호 · 글자만 넘긴다. 뜻 · 예문 · 원형을 보내지 않는다.
// - 단추는 같은 요소로 남는다(저장 중 · 완료에도 aria-disabled) — 초점이 사라지지 않는다. 결과는 같은 자리 aria-live=polite.
// - 늦은 응답: 창이 닫혔거나(단위 · 판본 · 계정이 바뀌면 창도 내려간다) 화면의 인증 세대가 바뀌었으면 결과를 적용하지 않는다.
// - 저장은 이동 · 위치 · 완료 · 복습을 만들지 않는다. 담은 뒤 「내 단어장에서 보기」는 명시 이동이며 Story 복귀 문맥(발행 키 · 단위)만 싣는다.

'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import type { WordLookup } from '@/lib/library/reader-queries'
import type { StoryWordSaveOutcome } from '@/lib/library/story/learner-types'

import styles from './story.module.css'

/** 서버 결과 · 또는 화면 쪽에서 버린 응답(stale — 인증 세대가 바뀌었거나 보낼 수 없었다). */
export type StoryWordSaveCall = (input: { wordIndex: number; surface: string }) => Promise<StoryWordSaveOutcome | { stale: true }>

/** 클라이언트가 단추를 보일지 판단(서버가 다시 판정한다 — 이것은 화면 표시용일 뿐). */
export function lookupIsSaveable(lookup: WordLookup | null): lookup is WordLookup & { resolvedWord: string } {
  return (
    !!lookup &&
    lookup.found &&
    typeof lookup.resolvedWord === 'string' &&
    lookup.resolvedWord.trim() !== '' &&
    lookup.matchVia !== 'suggestion' &&
    lookup.matchVia !== 'proper_noun' &&
    (lookup.lang === null || lookup.lang === 'en') &&
    !!lookup.meaningKo &&
    lookup.meaningKo.trim() !== ''
  )
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; headword: string }
  | { kind: 'already'; headword: string }
  | { kind: 'error'; message: string; retryable: boolean }

export function StoryWordSave({
  lookup,
  surface,
  wordIndex,
  onSave,
  vaultHref,
}: {
  lookup: WordLookup | null
  surface: string
  wordIndex: number
  onSave: StoryWordSaveCall
  vaultHref: string
}) {
  const [state, setState] = useState<SaveState>({ kind: 'idle' })
  const live = useRef(true)
  const seq = useRef(0)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  if (!lookupIsSaveable(lookup)) {
    return (
      <p className={styles.saveNote} data-story-word-save="unavailable">
        사전에서 확정된 낱말만 내 단어장에 담을 수 있어요.
      </p>
    )
  }

  const headword = lookup.resolvedWord.trim().toLowerCase()
  const differs = headword !== surface.toLowerCase()
  const busy = state.kind === 'saving'
  const done = state.kind === 'saved' || state.kind === 'already'
  const blocked = state.kind === 'error' && !state.retryable

  const save = async () => {
    if (busy || done || blocked) return
    const my = ++seq.current
    setState({ kind: 'saving' })
    let out: StoryWordSaveOutcome | { stale: true }
    try {
      out = await onSave({ wordIndex, surface })
    } catch {
      out = { ok: false, code: 'temporary', message: '잠시 연결이 불안정해요. 다시 시도해 주세요.', retryable: true }
    }
    if (!live.current || my !== seq.current) return
    if ('stale' in out) {
      setState({ kind: 'error', message: '화면 상태가 바뀌어 저장 결과를 적용하지 않았어요.', retryable: false })
      return
    }
    if (!out.ok) {
      setState({ kind: 'error', message: out.message, retryable: out.retryable })
      return
    }
    setState(out.data.status === 'saved' ? { kind: 'saved', headword: out.data.headword } : { kind: 'already', headword: out.data.headword })
  }

  const label = busy ? '담는 중…' : state.kind === 'saved' ? '내 단어장에 담았어요' : state.kind === 'already' ? '이미 내 단어장에 있어요' : state.kind === 'error' && state.retryable ? '다시 시도' : state.kind === 'error' ? '담을 수 없어요' : '내 단어장에 담기'

  return (
    <div className={styles.wordSave} data-story-word-save={state.kind}>
      <p className={styles.saveTarget}>
        담을 낱말 <strong lang="en">{headword}</strong>
        {differs ? (
          <span className={styles.saveSurface}>
            {' '}
            (본문 <span lang="en">{surface}</span>의 사전 원형)
          </span>
        ) : null}
      </p>
      <button
        type="button"
        className={styles.toolButton}
        onClick={() => void save()}
        aria-disabled={busy || done || blocked ? 'true' : undefined}
        aria-busy={busy ? 'true' : undefined}
        data-story-word-save-button
      >
        {label}
      </button>
      <p className={styles.saveStatus} role="status" aria-live="polite" data-story-word-save-status>
        {state.kind === 'saved'
          ? '담았어요. 읽던 곳은 그대로예요 — 원할 때 단어장에서 살펴보세요.'
          : state.kind === 'already'
            ? '이미 담겨 있어요. 기존 뜻 · 복습 기록은 그대로예요.'
            : state.kind === 'error'
              ? state.message
              : ''}
      </p>
      {done ? (
        <Link href={vaultHref} className={styles.saveVaultLink} data-story-word-save-vault>
          내 단어장에서 보기
        </Link>
      ) : null}
    </div>
  )
}
