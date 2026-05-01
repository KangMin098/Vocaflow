// apps/web/src/app/(main)/text/[id]/page.tsx

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

import { SpellForge } from '@/components/spellforge/SpellForge'
import { ContextBar } from '@/components/workspace/ContextBar'
import { FloatingAudioPlayer } from '@/components/workspace/FloatingAudioPlayer'
import { FloatingSparkle } from '@/components/workspace/FloatingSparkle'
import { InsightPanel } from '@/components/workspace/InsightPanel'
import { KeyboardHints } from '@/components/workspace/KeyboardHints'
import { ModePills } from '@/components/workspace/ModePills'
import { Pagination } from '@/components/workspace/Pagination'
import { ReadingUniverse } from '@/components/workspace/ReadingUniverse'
import { RecallCard } from '@/components/workspace/RecallCard'

import { useFocusMode } from '@/hooks/useFocusMode'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

import type { LibraryText, ModeKey, ModeStatus, Word } from '@/types/library'
import type { SpellForgeWord } from '@/types/spellforge'

// Mock data
const MOCK_TEXT: LibraryText = {
  id: '1',
  title: 'The Great Gatsby',
  author: 'F. Scott Fitzgerald',
  cefrLevel: 'B2',
  category: '클래식',
  preview: '',
  wordCount: 156,
  progressPercent: 78,
  totalPages: 12,
  currentPage: 3,
  coverGradient: { from: '#0F766E', to: '#064E3B' },
  addedAt: new Date(),
  lastStudiedAt: new Date(),
  isBookmarked: true,
}

const MOCK_PARAGRAPHS = [
  {
    id: 0,
    sentences: [
      {
        id: 0,
        parts: [
          { text: 'In my younger and more ' },
          {
            text: 'vulnerable',
            word: {
              id: 'w1',
              text: 'vulnerable',
              meaning: '취약한, 상처받기 쉬운',
              pronunciation: '/ˈvʌlnərəbl/',
              pos: 'adj',
              status: 'stable' as const,
              exampleSentence: '',
            } as Word,
          },
          {
            text: " years my father gave me some advice that I've been turning over in my mind ever since.",
          },
        ],
      },
      {
        id: 1,
        parts: [
          { text: '"Whenever you feel like ' },
          {
            text: 'criticizing',
            word: {
              id: 'w2',
              text: 'criticizing',
              meaning: '비판하는',
              pronunciation: '/ˈkrɪtɪˌsaɪzɪŋ/',
              pos: 'verb',
              status: 'shaky' as const,
              exampleSentence: '',
            } as Word,
          },
          {
            text: ' any one," he told me, "just remember that all the people in this world haven\'t had the ',
          },
          {
            text: 'advantages',
            word: {
              id: 'w3',
              text: 'advantages',
              meaning: '유리한 점, 이점',
              pronunciation: '/ədˈvæntɪdʒɪz/',
              pos: 'noun',
              status: 'shaky' as const,
              exampleSentence: '',
            } as Word,
          },
          { text: ' that you\'ve had."' },
        ],
      },
    ],
  },
  {
    id: 1,
    sentences: [
      {
        id: 2,
        parts: [
          { text: "He didn't say any more, but we've always been unusually " },
          {
            text: 'communicative',
            word: {
              id: 'w4',
              text: 'communicative',
              meaning: '의사 소통의',
              pronunciation: '/kəˈmjuːnɪkətɪv/',
              pos: 'adj',
              status: 'risk' as const,
              exampleSentence: '',
            } as Word,
          },
          { text: ' in a ' },
          {
            text: 'reserved',
            word: {
              id: 'w5',
              text: 'reserved',
              meaning: '내성적인, 신중한',
              pronunciation: '/rɪˈzɜːrvd/',
              pos: 'adj',
              status: 'stable' as const,
              exampleSentence: '',
            } as Word,
          },
          { text: ' way, and I understood that he meant a great deal more than that.' },
        ],
      },
      {
        id: 3,
        parts: [
          { text: 'In ' },
          {
            text: 'consequence',
            word: {
              id: 'w6',
              text: 'consequence',
              meaning: '결과, 영향',
              pronunciation: '/ˈkɒnsɪkwəns/',
              pos: 'noun',
              status: 'shaky' as const,
              exampleSentence: '',
            } as Word,
          },
          { text: ", I'm " },
          {
            text: 'inclined',
            word: {
              id: 'w7',
              text: 'inclined',
              meaning: '~하는 경향이 있는',
              pronunciation: '/ɪnˈklaɪnd/',
              pos: 'adj',
              status: 'stable' as const,
              exampleSentence: '',
            } as Word,
          },
          { text: ' to reserve all ' },
          {
            text: 'judgments',
            word: {
              id: 'w8',
              text: 'judgments',
              meaning: '판단, 평가',
              pronunciation: '/ˈdʒʌdʒmənts/',
              pos: 'noun',
              status: 'shaky' as const,
              exampleSentence: '',
            } as Word,
          },
          {
            text: ', a habit that has opened up many curious natures to me and also made me the victim of not a few veteran ',
          },
          {
            text: 'bores',
            word: {
              id: 'w9',
              text: 'bores',
              meaning: '지루한 사람들',
              pronunciation: '/bɔːrz/',
              pos: 'noun',
              status: 'new' as const,
              exampleSentence: '',
            } as Word,
          },
          { text: '.' },
        ],
      },
    ],
  },
]

const MODE_STATUS: Record<ModeKey, ModeStatus> = {
  read: 'done',
  listen: 'done',
  words: 'active',
  flashcard: 'pending',
  spellforge: 'pending',
  wordblitz: 'pending',
  quiz: 'pending',
}

interface PageProps {
  params: { id: string }
}

export default function WorkspacePage({ params }: PageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentMode = (searchParams.get('mode') ?? 'read') as ModeKey
  const currentPage = parseInt(searchParams.get('page') ?? '3', 10)

  const text: LibraryText = { ...MOCK_TEXT, id: params.id, currentPage }

  // Hooks
  const { isFocusMode, toggle: toggleFocus } = useFocusMode()

  // State
  const [isBookmarked, setIsBookmarked] = useState(text.isBookmarked)
  const [isInsightOpen, setIsInsightOpen] = useState(false)
  const [recallWord, setRecallWord] = useState<Word | null>(null)
  const [recallAnchor, setRecallAnchor] = useState<DOMRect | null>(null)
  const [playingSentenceId, setPlayingSentenceId] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioVisible, setAudioVisible] = useState(false)
  const [audioSpeed, setAudioSpeed] = useState(1.0)

  // Word handlers
  const handleWordHover = useCallback((word: Word, anchorRect: DOMRect) => {
    setRecallWord(word)
    setRecallAnchor(anchorRect)
  }, [])

  const handleRecallClose = useCallback(() => {
    setRecallWord(null)
    setRecallAnchor(null)
  }, [])

  const handleJudge = useCallback(
    (judgment: 'knew' | 'unsure' | 'didnt') => {
      // TODO: Supabase 저장
      console.log('Judged:', recallWord?.text, judgment)
      setTimeout(handleRecallClose, 300)
    },
    [recallWord, handleRecallClose]
  )

  // Sentence playback
  const handleSentencePlay = useCallback(
    (sentenceId: number) => {
      if (playingSentenceId === sentenceId && isPlaying) {
        setIsPlaying(false)
      } else {
        setPlayingSentenceId(sentenceId)
        setIsPlaying(true)
        setAudioVisible(true)
      }
    },
    [playingSentenceId, isPlaying]
  )

  // Total sentences
  const totalSentences = useMemo(() => {
    return MOCK_PARAGRAPHS.reduce((acc, p) => acc + p.sentences.length, 0)
  }, [])

  const currentSentenceIdx = useMemo(() => {
    if (playingSentenceId === null) return 0
    let idx = 0
    for (const p of MOCK_PARAGRAPHS) {
      for (const s of p.sentences) {
        if (s.id === playingSentenceId) return idx + 1
        idx++
      }
    }
    return 0
  }, [playingSentenceId])

  // SpellForge 모드용 — 원문 내 모든 학습 단어 수집
  const spellforgeWords: SpellForgeWord[] = useMemo(() => {
    const collected: SpellForgeWord[] = []
    for (const p of MOCK_PARAGRAPHS) {
      for (const s of p.sentences) {
        for (const part of s.parts) {
          if (part.word) collected.push(part.word)
        }
      }
    }
    return collected
  }, [])

  // Audio handlers
  const handlePlayPause = () => setIsPlaying((p) => !p)
  const handlePrev = () => {
    if (playingSentenceId !== null && playingSentenceId > 0) {
      setPlayingSentenceId(playingSentenceId - 1)
    }
  }
  const handleNext = () => {
    if (playingSentenceId !== null && playingSentenceId < totalSentences - 1) {
      setPlayingSentenceId(playingSentenceId + 1)
    }
  }
  const handleAudioClose = () => {
    setAudioVisible(false)
    setIsPlaying(false)
    setPlayingSentenceId(null)
  }
  const handleSpeedChange = () => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5]
    const idx = speeds.indexOf(audioSpeed)
    setAudioSpeed(speeds[(idx + 1) % speeds.length])
  }

  // Bookmark handler
  const handleBookmarkToggle = useCallback(() => {
    setIsBookmarked((b) => !b)
  }, [])

  // Pagination via keyboard
  const goToPage = useCallback(
    (page: number) => {
      if (page < 1 || page > text.totalPages) return
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', String(page))
      router.push(`/text/${text.id}?${params.toString()}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [router, searchParams, text.id, text.totalPages]
  )

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onArrowLeft: () => goToPage(currentPage - 1),
    onArrowRight: () => goToPage(currentPage + 1),
    onSpace: () => {
      if (audioVisible) handlePlayPause()
      else handleSentencePlay(0)
    },
    onBookmark: handleBookmarkToggle,
    onInsight: () => setIsInsightOpen((o) => !o),
    onFocusMode: toggleFocus,
    onEscape: () => {
      setIsInsightOpen(false)
      handleRecallClose()
    },
  })

  // Mock memory stats
  const memoryStats = { stable: 97, shaky: 28, risk: 14, newWords: 17 }
  const bookmarks = [
    { id: 'b1', text: 'In my younger and more vulnerable years...', page: 3, addedAt: '방금' },
    { id: 'b2', text: "He didn't say any more, but we've always...", page: 1, addedAt: '어제' },
  ]

  // SpellForge 모드 — 워크스페이스 레이아웃 우회, 전용 화면 단독 렌더
  if (currentMode === 'spellforge') {
    return <SpellForge textId={text.id} textTitle={text.title} words={spellforgeWords} />
  }

  return (
    <div className="min-h-screen bg-[var(--reading-bg)]">
      <ContextBar
        text={text}
        isBookmarked={isBookmarked}
        onToggleBookmark={handleBookmarkToggle}
        onToggleInsight={() => setIsInsightOpen((o) => !o)}
        onToggleFocus={toggleFocus}
        isFocusMode={isFocusMode}
      />

      <ModePills
        textId={text.id}
        currentMode={currentMode}
        modeStatus={MODE_STATUS}
        isFocusMode={isFocusMode}
      />

      <ReadingUniverse
        paragraphs={MOCK_PARAGRAPHS}
        isFocusMode={isFocusMode}
        onWordHover={handleWordHover}
        onSentencePlay={handleSentencePlay}
        playingSentenceId={playingSentenceId}
      />

      <div className="mx-auto max-w-[760px] px-8 pb-12">
        <Pagination textId={text.id} currentPage={currentPage} totalPages={text.totalPages} />
        <p className="mt-4 text-center font-body text-[12px] italic text-[var(--t3)]">
          이 페이지에서{' '}
          <strong className="font-display font-[700] not-italic text-[var(--t1)]">5</strong>개의 새
          단어를 만났어요 · 다음 페이지까지{' '}
          <strong className="font-display font-[700] not-italic text-[var(--t1)]">5분</strong>
        </p>
      </div>

      {/* Ambient Footer */}
      <footer
        className={`mx-auto mt-16 max-w-[760px] px-8 py-6 pb-12 text-center font-body text-[12px] italic tracking-[0.02em] text-[var(--t3)] transition-opacity duration-[var(--dur-slower)] ${isFocusMode ? 'opacity-40' : 'opacity-100'} `}
      >
        <span className="mx-auto mb-3 block h-px w-8 bg-[var(--bd)]" aria-hidden="true" />
        <p>20분의 깊은 시간 · 오늘 좋은 페이스예요</p>
      </footer>

      {/* Floating Components */}
      <RecallCard
        word={recallWord}
        anchorRect={recallAnchor}
        onClose={handleRecallClose}
        onJudge={handleJudge}
      />

      <FloatingAudioPlayer
        isVisible={audioVisible}
        isPlaying={isPlaying}
        currentSentence={currentSentenceIdx}
        totalSentences={totalSentences}
        currentTime="0:09"
        totalTime="0:24"
        progress={38}
        speed={audioSpeed}
        onPlayPause={handlePlayPause}
        onPrev={handlePrev}
        onNext={handleNext}
        onClose={handleAudioClose}
        onSpeedChange={handleSpeedChange}
      />

      <FloatingSparkle
        message="이 페이지의 5개 새 단어를 카드로 다시 만나보면, 더 깊이 기억에 남을 거예요."
        ctaLabel="Flashcard 시작"
        ctaHref={`/text/${text.id}?mode=flashcard`}
      />

      <InsightPanel
        isOpen={isInsightOpen}
        onClose={() => setIsInsightOpen(false)}
        softQuote="Page 3까지 왔어요. 이번 chapter의 1/4. 좋은 흐름이에요."
        bookmarks={bookmarks}
        memoryStats={memoryStats}
      />

      <KeyboardHints />
    </div>
  )
}
