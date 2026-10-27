// apps/web/src/components/library/story/StoryUnitText.tsx
//
// 단위 본문 + 요청형 단어 뜻. 기본은 본문만(문단 = 텍스트 노드 · HTML 해석 없음).
// 「단어 뜻 보기」를 켜면 지금 단위 본문의 영어 낱말이 버튼이 되고(로빙 초점 — 본문에 탭 정지 하나 · 화살표 · Home · End 로 이동),
// 고른 낱말 하나에 대해서만 기존 사전 툴팁(WordLookupPopover — 읽기 전용 조회)을 연다.
// D4-UX03(Stories 만 켜는 비모달 초점): 창이 열리면 창으로 초점이 가고(스크롤 없이), Esc · 닫기 단추로 닫으면 창을 연 조작
// (그 낱말 또는 아래 44px 「뜻 보기」 단추)으로 초점이 돌아온다(preventScroll). 바깥을 누르거나 Tab 으로 창 밖에 나가면 초점은
// 사용자가 옮긴 곳에 둔다. 초점 가두기 · aria-modal 없음.
// 44px 대체 조작: 낱말 모드에서 도구 줄에 「지금 고른 낱말」 단추(44px)를 둔다 — 화살표로 고른 낱말의 뜻을 큰 단추로도 연다.
// 본문 낱말 간격 · 줄 높이는 넓히지 않는다(문장을 흩지 않는다).
// - 고른 낱말은 기록하지 않는다: 이벤트 · URL · 저장소 · 로그 없음. 단어장 등록 · FSRS · 완료 · 숙달 근거를 만들지 않는다.
// - 단위 · 발행본이 바뀌거나 인증이 무효 · 서버 거부가 되면 이 조각이 내려가므로 도움 상태도 함께 사라진다(부모가 key 로 묶는다).

'use client'

import { useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode } from 'react'

import { WordLookupPopover, type WordLookupCloseReason } from '@/components/library/reader/WordLookupPopover'

import styles from './story.module.css'
import { nextWordIndex, splitUnitParagraphs, tokenizeWords, type StoryTextPiece } from './story-view'

export interface StoryWordLookupProps {
  surface: string
  anchorRect: DOMRect
  onClose: (reason?: WordLookupCloseReason) => void
  desktopLearner?: boolean
  nonmodalFocus?: boolean
}

export interface StoryUnitTextProps {
  text: string
  /** 원문 대응 인용을 고른 동안 본문 옆 대응 표시. */
  tracing: boolean
  /** 사전 툴팁 주입(기본 WordLookupPopover) — 시험 · 하네스용. */
  lookup?: ComponentType<StoryWordLookupProps>
  /** 처음부터 낱말 고르기를 켠 채로(시험용 · 기본 false). */
  defaultWordMode?: boolean
  /** 같은 도구 줄에 함께 둘 조작(예: 이 단위의 맥락 설명 진입 — D4-UX02). */
  tools?: ReactNode
}

type Opener = 'word' | 'picker'

export function StoryUnitText({ text, tracing, lookup: Lookup = WordLookupPopover, defaultWordMode = false, tools }: StoryUnitTextProps) {
  const [wordMode, setWordMode] = useState(defaultWordMode)
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState<{ surface: string; rect: DOMRect; index: number; opener: Opener } | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLButtonElement>(null)

  const paragraphs: StoryTextPiece[][] = []
  const words: string[] = []
  let count = 0
  for (const paragraph of splitUnitParagraphs(text)) {
    const { pieces, next } = tokenizeWords(paragraph, count)
    paragraphs.push(pieces)
    for (const piece of pieces) if (piece.type === 'word') words.push(piece.text)
    count = next
  }
  const activeWord = words[Math.min(active, Math.max(words.length - 1, 0))] ?? null

  const wordEl = (index: number) => bodyRef.current?.querySelector<HTMLButtonElement>(`[data-word-index="${index}"]`) ?? null
  const focusWord = (index: number, preventScroll = false) => {
    wordEl(index)?.focus({ preventScroll })
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

  const close = (reason?: WordLookupCloseReason) => {
    const was = open
    setOpen(null)
    // Esc · 닫기 단추로 닫았을 때만 창을 연 조작으로 초점을 돌린다(스크롤 없이). 바깥 누름 · Tab 이탈 · 스크롤은 사용자가 옮긴 곳에 둔다.
    if (!was || (reason !== undefined && reason !== 'escape' && reason !== 'button')) return
    requestAnimationFrame(() => {
      if (was.opener === 'picker') pickerRef.current?.focus({ preventScroll: true })
      else focusWord(was.index, true)
    })
  }

  const openPicker = () => {
    if (activeWord === null) return
    const el = wordEl(active)
    if (!el) return
    setOpen({ surface: activeWord, rect: el.getBoundingClientRect(), index: active, opener: 'picker' })
  }

  return (
    <>
      {count > 0 || tools ? (
        <div className={styles.wordTools} data-story-tools>
          {count > 0 ? (
            <button
              type="button"
              className={styles.toolButton}
              aria-pressed={wordMode}
              onClick={() => {
                setWordMode((on) => !on)
                setOpen(null)
              }}
              data-story-word-mode={wordMode ? 'on' : 'off'}
            >
              {wordMode ? '단어 뜻 보기 끄기' : '단어 뜻 보기'}
            </button>
          ) : null}
          {wordMode && activeWord !== null ? (
            <button
              ref={pickerRef}
              type="button"
              className={styles.toolButton}
              aria-haspopup="dialog"
              aria-expanded={open?.opener === 'picker'}
              onClick={openPicker}
              data-story-word-picker
            >
              뜻 보기 · <span lang="en">{activeWord}</span>
            </button>
          ) : null}
          {tools}
          {wordMode ? (
            <span className={styles.meta} data-story-word-hint>
              낱말을 누르거나, 본문에서 화살표 · Home · End 로 고른 뒤 Enter 를 누르세요.
            </span>
          ) : null}
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
                      aria-expanded={open?.opener === 'word' && open.index === piece.index}
                      data-word-index={piece.index}
                      onFocus={() => setActive(piece.index)}
                      onClick={(event) =>
                        setOpen({ surface: piece.text, rect: event.currentTarget.getBoundingClientRect(), index: piece.index, opener: 'word' })
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
      {open ? <Lookup surface={open.surface} anchorRect={open.rect} onClose={close} desktopLearner nonmodalFocus /> : null}
    </>
  )
}
