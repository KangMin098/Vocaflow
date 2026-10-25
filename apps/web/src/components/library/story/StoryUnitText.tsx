// apps/web/src/components/library/story/StoryUnitText.tsx
//
// 단위 본문 + 요청형 단어 뜻. 기본은 본문만(문단 = 텍스트 노드 · HTML 해석 없음).
// 「단어 뜻 보기」를 켜면 지금 단위 본문의 영어 낱말이 버튼이 되고(로빙 초점 — 본문에 탭 정지 하나 · 화살표로 이동),
// 고른 낱말 하나에 대해서만 기존 사전 툴팁(WordLookupPopover — 읽기 전용 조회)을 연다. Esc · 닫기 뒤 초점은 그 낱말로 돌아간다.
// - 고른 낱말은 기록하지 않는다: 이벤트 · URL · 저장소 · 로그 없음. 단어장 등록 · FSRS · 완료 · 숙달 근거를 만들지 않는다.
// - 단위 · 발행본이 바뀌거나 인증이 무효 · 서버 거부가 되면 이 조각이 내려가므로 도움 상태도 함께 사라진다(부모가 key 로 묶는다).

'use client'

import { useRef, useState, type ComponentType, type KeyboardEvent } from 'react'

import { WordLookupPopover } from '@/components/library/reader/WordLookupPopover'

import styles from './story.module.css'
import { nextWordIndex, splitUnitParagraphs, tokenizeWords, type StoryTextPiece } from './story-view'

export interface StoryWordLookupProps {
  surface: string
  anchorRect: DOMRect
  onClose: () => void
  desktopLearner?: boolean
}

export interface StoryUnitTextProps {
  text: string
  /** 원문 대응 인용을 고른 동안 본문 옆 대응 표시. */
  tracing: boolean
  /** 사전 툴팁 주입(기본 WordLookupPopover) — 시험 · 하네스용. */
  lookup?: ComponentType<StoryWordLookupProps>
  /** 처음부터 낱말 고르기를 켠 채로(시험용 · 기본 false). */
  defaultWordMode?: boolean
}

export function StoryUnitText({ text, tracing, lookup: Lookup = WordLookupPopover, defaultWordMode = false }: StoryUnitTextProps) {
  const [wordMode, setWordMode] = useState(defaultWordMode)
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState<{ surface: string; rect: DOMRect; index: number } | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const paragraphs: StoryTextPiece[][] = []
  let count = 0
  for (const paragraph of splitUnitParagraphs(text)) {
    const { pieces, next } = tokenizeWords(paragraph, count)
    paragraphs.push(pieces)
    count = next
  }

  const focusWord = (index: number) => {
    bodyRef.current?.querySelector<HTMLButtonElement>(`[data-word-index="${index}"]`)?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!wordMode) return
    const target = event.target as HTMLElement
    const current = Number(target.dataset.wordIndex)
    if (!Number.isInteger(current)) return
    const next = nextWordIndex(event.key, current, count)
    if (next === null) return
    event.preventDefault()
    setActive(next)
    focusWord(next)
  }

  const close = () => {
    const index = open?.index
    setOpen(null)
    if (index !== undefined) requestAnimationFrame(() => focusWord(index))
  }

  return (
    <>
      {count > 0 ? (
        <div className={styles.wordTools}>
          <button
            type="button"
            className={styles.ctaQuiet}
            aria-pressed={wordMode}
            onClick={() => {
              setWordMode((on) => !on)
              setOpen(null)
            }}
            data-story-word-mode={wordMode ? 'on' : 'off'}
          >
            {wordMode ? '단어 뜻 보기 끄기' : '단어 뜻 보기'}
          </button>
          {wordMode ? <span className={styles.meta}>낱말을 누르거나 화살표로 옮겨 Enter 를 누르세요.</span> : null}
        </div>
      ) : null}
      <div
        ref={bodyRef}
        className={styles.unitBody}
        lang="en"
        data-story-body
        data-tracing={tracing ? 'true' : 'false'}
        onKeyDown={onKeyDown}
      >
        {paragraphs.map((pieces, p) => (
          <p key={p}>
            {wordMode
              ? pieces.map((piece, i) =>
                  piece.type === 'text' ? (
                    piece.text
                  ) : (
                    <button
                      key={i}
                      type="button"
                      className={styles.wordButton}
                      tabIndex={piece.index === active ? 0 : -1}
                      aria-haspopup="dialog"
                      aria-expanded={open?.index === piece.index}
                      data-word-index={piece.index}
                      onFocus={() => setActive(piece.index)}
                      onClick={(event) =>
                        setOpen({ surface: piece.text, rect: event.currentTarget.getBoundingClientRect(), index: piece.index })
                      }
                    >
                      {piece.text}
                    </button>
                  ),
                )
              : pieces.map((piece) => piece.text).join('')}
          </p>
        ))}
      </div>
      {open ? <Lookup surface={open.surface} anchorRect={open.rect} onClose={close} desktopLearner /> : null}
    </>
  )
}
