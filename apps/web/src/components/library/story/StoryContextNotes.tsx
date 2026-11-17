// apps/web/src/components/library/story/StoryContextNotes.tsx
//
// 단위 본문 뒤의 시대적 맥락 설명(T-0189 W2) — 편집 기준이 「맥락과 함께 남김」으로 정한 민감 표현에 붙인 검수된 설명(접힌 <details>).
// - 설명 문장은 저장값 그대로 · 순서 그대로다. 펼치기 전 요약에는 개수만 쓴다. 필수 확인 · 자동 열림 · 계측 이벤트 없음.
// - 이 단위에 설명이 없으면 아무것도 그리지 않는다. 불러오지 못함 · 확인하지 못함은 「설명 없음」과 다른 한 줄이다.
// - 받은 결과가 지금 화면의 발행 키 · 단위와 다르면(늦은 응답 · 결속 어긋남) 설명을 보이지 않고 「확인하지 못함」으로 다룬다.
// - 네이티브 <details> 라 키보드(Enter · Space)로 열고 닫는다. 요약 높이 44px 은 .cautions summary 가 보장한다.
// - D4-UX02: 도구 줄의 진입(StoryReader)이 열 수 있도록 열림 상태를 부모가 쥘 수 있다(open · onOpenChange). 진입으로 열었으면
//   펼친 안의 「도구로 돌아가기」와 Esc 가 진입 단추로 초점을 돌린다. 열고 닫는 것은 진도 · 완료를 기록하지 않는다.

import type { KeyboardEvent } from 'react'

import type { StoryContextNotesView } from '@/lib/library/story/learner-types'

import styles from './story.module.css'
import { contextNotesSummary, contextNotesUnavailableText } from './story-view'

export const CONTEXT_NOTES_ID = 'story-context-notes'

export function StoryContextNotes({
  view,
  releaseKey,
  unitIndex,
  open,
  onOpenChange,
  onReturn,
}: {
  view: StoryContextNotesView | null
  releaseKey: string
  unitIndex: number
  /** 부모가 쥔 열림 상태(없으면 네이티브 그대로). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** 도구 줄 진입으로 돌아가기(진입으로 열었을 때만 넘긴다). */
  onReturn?: () => void
}) {
  if (view === null) return null
  if (view.status === 'ready' && (view.releaseKey !== releaseKey || view.unitIndex !== unitIndex)) {
    return <Unavailable reason="invalid" />
  }
  if (view.status === 'unavailable') return <Unavailable reason={view.reason} />
  if (view.notes.length === 0) return null
  const onKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key !== 'Escape' || !onReturn || !(event.currentTarget as HTMLDetailsElement).open) return
    event.preventDefault()
    onOpenChange?.(false)
    onReturn()
  }
  return (
    <details
      id={CONTEXT_NOTES_ID}
      className={`${styles.cautions} ${styles.contextNotes}`}
      data-story-context-notes={view.notes.length}
      open={open}
      onToggle={onOpenChange ? (event) => onOpenChange((event.currentTarget as HTMLDetailsElement).open) : undefined}
      onKeyDown={onKeyDown}
    >
      <summary>{contextNotesSummary(view.notes.length)}</summary>
      <ul>
        {view.notes.map((note) => (
          <li key={note.id} data-story-context-note={note.id}>
            {note.text}
          </li>
        ))}
      </ul>
      {onReturn ? (
        <button type="button" className={styles.ctaQuiet} onClick={onReturn} data-story-context-return>
          ↑ 읽기 도구로 돌아가기
        </button>
      ) : null}
    </details>
  )
}

function Unavailable({ reason }: { reason: 'not_ready' | 'invalid' | 'temporary' }) {
  return (
    <p className={`${styles.meta} ${styles.contextNotes}`} data-story-context-notes="unavailable" data-story-context-notes-reason={reason}>
      {contextNotesUnavailableText(reason)}
    </p>
  )
}
