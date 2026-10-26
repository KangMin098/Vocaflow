// apps/web/src/components/library/story/StoryContextNotes.tsx
//
// 단위 본문 뒤의 시대적 맥락 설명(T-0189 W2) — 편집 기준이 「맥락과 함께 남김」으로 정한 민감 표현에 붙인 검수된 설명(접힌 <details>).
// - 설명 문장은 저장값 그대로 · 순서 그대로다. 펼치기 전 요약에는 개수만 쓴다. 필수 확인 · 자동 열림 · 계측 이벤트 없음.
// - 이 단위에 설명이 없으면 아무것도 그리지 않는다. 불러오지 못함 · 확인하지 못함은 「설명 없음」과 다른 한 줄이다.
// - 받은 결과가 지금 화면의 발행 키 · 단위와 다르면(늦은 응답 · 결속 어긋남) 설명을 보이지 않고 「확인하지 못함」으로 다룬다.
// - 네이티브 <details> 라 키보드(Enter · Space)로 열고 닫는다. 요약 높이 44px 은 .cautions summary 가 보장한다.

import type { StoryContextNotesView } from '@/lib/library/story/learner-types'

import styles from './story.module.css'
import { contextNotesSummary, contextNotesUnavailableText } from './story-view'

export function StoryContextNotes({
  view,
  releaseKey,
  unitIndex,
}: {
  view: StoryContextNotesView | null
  releaseKey: string
  unitIndex: number
}) {
  if (view === null) return null
  if (view.status === 'ready' && (view.releaseKey !== releaseKey || view.unitIndex !== unitIndex)) {
    return <Unavailable reason="invalid" />
  }
  if (view.status === 'unavailable') return <Unavailable reason={view.reason} />
  if (view.notes.length === 0) return null
  return (
    <details className={`${styles.cautions} ${styles.contextNotes}`} data-story-context-notes={view.notes.length}>
      <summary>{contextNotesSummary(view.notes.length)}</summary>
      <ul>
        {view.notes.map((note) => (
          <li key={note.id} data-story-context-note={note.id}>
            {note.text}
          </li>
        ))}
      </ul>
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
