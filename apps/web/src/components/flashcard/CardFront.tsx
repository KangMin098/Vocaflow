// apps/web/src/components/flashcard/CardFront.tsx

'use client'

import type { FlashcardWord } from '@/types/flashcard'
import { Bookmark, Volume2 } from 'lucide-react'

interface CardFrontProps {
  word: FlashcardWord
  hintVisible: boolean
  showFlipHint: boolean
  /** 회상·평가 중 — 뒤집기가 아직(이미) 동작하지 않는다. */
  flipLocked: boolean
  isAudioPlaying: boolean
  onPlayAudio: () => void
  /** 이 브라우저가 음성 합성을 지원하는가 — 아니면 버튼을 그리지 않는다. */
  canPlayAudio: boolean
  isBookmarked: boolean
  onToggleBookmark: () => void
}

export function CardFront({
  word,
  hintVisible,
  showFlipHint,
  flipLocked,
  isAudioPlaying,
  onPlayAudio,
  canPlayAudio,
  isBookmarked,
  onToggleBookmark,
}: CardFrontProps) {
  const firstLetters = word.text.slice(0, 2) + '-'

  return (
    <>
      {/* Meta Row */}
      <div data-card-meta className="mb-6 flex items-center justify-between opacity-50 transition-opacity duration-[var(--dur-normal)] group-hover/card:opacity-100">
        {/* v07 — `italic` 을 뺐다. 한글에는 이탤릭 자형이 없어서 브라우저가 **기울여 그린다**
            (가짜 이탤릭). 사람의 목소리는 Lora italic 이 영문에서 맡는다(DESIGN_SYSTEM §6). */}
        <span data-card-meta className="font-display text-[10.5px] text-[var(--t2)]">{word.textTitle}에서</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleBookmark()
          }}
          aria-label={isBookmarked ? '북마크 해제' : '북마크 추가'}
          aria-pressed={isBookmarked}
          /* 24×24 였다 — 44px 미만 탭 대상이었다(CLAUDE.md 절대 금지 · 실측 390px). 아이콘은 그대로, 누를 면적만 넓힌다. */
          className={`flex h-11 w-11 items-center justify-center rounded-[var(--r-sm)] transition-all duration-[var(--dur-normal)] ${
            isBookmarked
              ? 'text-[var(--active)]'
              : 'text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]'
          } `}
        >
          <Bookmark
            size={14}
            strokeWidth={1.75}
            fill={isBookmarked ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Word Display */}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h2 className="mb-3 break-words font-english text-[56px] font-[600] leading-[1.1] tracking-[-0.01em] text-[var(--t1)]">
          {/* 키보드·보조기기의 뒤집기 컨트롤. onClick 을 따로 두지 않는다 — 클릭이 카드(Card.tsx)로 올라가
              카드 면 클릭과 같은 경로로 뒤집는다(두 번 뒤집히지 않게). 회상 중에는 카드가 클릭을 받지 않는다. */}
          <button
            type="button"
            data-card-flip
            aria-label={`${word.text} — 카드 뒤집어 정답 확인`}
            aria-disabled={flipLocked}
            className={`break-words rounded-[var(--r-sm)] ${flipLocked ? 'cursor-default' : 'cursor-pointer'}`}
          >
            {word.text}
          </button>
        </h2>

        <p className="mb-7 font-mono text-[16px] text-[var(--t2)]">{word.pronunciation}</p>

        {/* Recall Hint Area (1.5초 후 노출) */}
        <div
          className={`mb-4 flex h-6 items-center justify-center gap-2 font-body text-[12px] italic text-[var(--t2)] transition-opacity duration-[var(--dur-slow)] ${hintVisible ? 'opacity-100' : 'opacity-0'} `}
          aria-hidden={!hintVisible}
        >
          <span>첫 글자가 떠오르지 않으면:</span>
          <span className="inline-block rounded-[var(--r-sm)] bg-[var(--ju-light)] px-2 py-1 font-english text-[14px] font-[600] not-italic tracking-[0.04em] text-[var(--ju-ink)]">
            {firstLetters}
          </span>
        </div>

        {/* Audio Button — 지원하지 않는 브라우저에서는 아예 그리지 않는다.
            눌러도 소리가 안 나면 학습자는 자기 기기를 의심한다. */}
        {canPlayAudio && (
          <button
          onClick={(e) => {
            e.stopPropagation()
            onPlayAudio()
          }}
          aria-label="발음 듣기"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-5 py-3 font-display text-[13px] font-[600] text-[var(--t2)] transition-[background-color,border-color,color,transform] duration-[var(--dur-fast)] hover:border-[var(--ju)] hover:bg-[var(--bg)] hover:text-[var(--ju-ink)] active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)] focus-visible:ring-offset-2"
        >
          <Volume2
            size={14}
            strokeWidth={2}
            className={isAudioPlaying ? 'animate-[audio-pulse_0.8s_ease-in-out_infinite]' : ''}
            aria-hidden="true"
          />
            <span>발음 듣기</span>
          </button>
        )}
      </div>

      {/* Flip Hint */}
      <p
        data-card-instruction={showFlipHint ? '' : undefined}
        className={`mt-3 flex h-4 items-center justify-center gap-2 text-center font-display text-[11px] font-[600] tracking-[0.04em] text-[var(--t2)] opacity-60 transition-opacity duration-[var(--dur-normal)] ${showFlipHint ? 'opacity-60' : 'pointer-events-none opacity-0'} `}
      >
        <span>탭 또는</span>
        <kbd className="rounded border border-[var(--bd)] bg-[var(--bg2)] px-2 py-1 font-mono text-[10px] font-[700] text-[var(--t2)]">
          Space
        </kbd>
        <span>로 정답 확인</span>
      </p>
    </>
  )
}
