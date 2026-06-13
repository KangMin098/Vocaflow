// apps/web/src/app/(main)/text/[id]/page.tsx

'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { SpellForge } from '@/components/spellforge/SpellForge'
import { ExtractionPanel } from '@/components/text-extract/ExtractionPanel'
import { ChapterBottomNav } from '@/components/workspace/ChapterBottomNav'
import { FloatingAudioPlayer } from '@/components/workspace/FloatingAudioPlayer'
import { useTTS, type SentenceItem } from '@/lib/workspace/tts-controller'
import { useShadowSession } from '@/lib/workspace/use-shadow-session'
import { FloatingSparkle } from '@/components/workspace/FloatingSparkle'
import { InsightPanel } from '@/components/workspace/InsightPanel'
import { KeyboardHints } from '@/components/workspace/KeyboardHints'
import { Pagination } from '@/components/workspace/Pagination'
import { ReadingUniverse } from '@/components/workspace/ReadingUniverse'
import { RecallCard } from '@/components/workspace/RecallCard'
import { ShadowReadAlong } from '@/components/workspace/ShadowReadAlong'
import { SupportGloss } from '@/components/workspace/SupportGloss'
import { WordLookupPopover } from '@/components/library/reader/WordLookupPopover'
import { UnifiedHeader } from '@/components/workspace/UnifiedHeader'
import type { ChapterDisplayStatus } from '@/components/workspace/CompleteChapterButton'

import { useFocusMode } from '@/hooks/useFocusMode'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

import {
  actionToHref,
  getMockNextAction,
  MOCK_USER_CONTEXTS,
} from '@/lib/recommend/next-action.mock'

import type { LibraryText, ModeKey, ModeStatus, Word } from '@/types/library'
import type { SpellForgeWord } from '@/types/spellforge'
import type { SupportToken } from '@/lib/workspace/support'

import {
  useTextContentSafe,
  type TextParagraph,
} from './text-content-context'
import { annotateSupport } from './text-content-helpers'

// Mock fallback — layout.tsx 가 textId 를 DB 에서 못 찾았을 때만 사용.
// 실제 라이브러리 책/사용자 텍스트는 layout 의 TextContentProvider 가 전달.
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
  bookId: null,
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
  listen: 'done',
  read: 'done',
  shadow: 'pending',
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
  const currentPage = parseInt(searchParams.get('page') ?? '1', 10)

  // layout.tsx 가 v_text_content 에서 실 데이터 주입. 없으면 mock fallback.
  const ctx = useTextContentSafe()

  const text: LibraryText = useMemo(() => {
    const base: LibraryText = { ...MOCK_TEXT, id: params.id, currentPage }
    if (!ctx) return base
    const t = ctx.text
    // 실 데이터 기반 진척률: chapter list 에서 completed 비율
    let progressPercent = base.progressPercent
    if (ctx.chapters.length > 0) {
      const completed = ctx.chapters.filter((c) => c.status === 'completed').length
      const current = ctx.chapters.findIndex((c) => c.textId === ctx.textId)
      // completed + 현재 chapter 의 0.5 기여 (in_progress 일 때만)
      const inProgressBoost =
        ctx.currentChapterStatus === 'in_progress' && current >= 0 ? 0.5 : 0
      progressPercent = Math.round(((completed + inProgressBoost) / ctx.chapters.length) * 100)
    }
    return {
      ...base,
      ...(t.title ? { title: t.title } : {}),
      ...(t.author ? { author: t.author } : {}),
      ...(t.cefrLevel ? { cefrLevel: t.cefrLevel } : {}),
      ...(typeof t.wordCount === 'number' ? { wordCount: t.wordCount } : {}),
      bookId: ctx.libraryBookId,
      progressPercent,
      totalPages: t.totalPages ?? 1,
      currentPage,
    }
  }, [ctx, params.id, currentPage])

  // Chapter 메타 — ReadingUniverse 상단 kicker + 하단 풋터 공용
  const chapterMeta = useMemo(() => {
    if (!ctx) return undefined
    // 라이브러리 도서이면 "Chapter N", 사용자 텍스트면 텍스트 title 그대로
    const label =
      ctx.libraryBookId && ctx.chapterIdx != null
        ? `Chapter ${ctx.chapterIdx}`
        : (ctx.text.title ?? '').trim()
    if (!label) return undefined
    const wc = ctx.text.wordCount ?? 0
    // 영어 학습자 평균 ~ 150wpm — 1분 이하 0으로 처리
    const readingMinutes = wc > 0 ? Math.max(1, Math.round(wc / 150)) : 0
    return { label, readingMinutes }
  }, [ctx])

  const paragraphs: TextParagraph[] = useMemo(
    () => annotateSupport(ctx && ctx.paragraphs.length > 0 ? ctx.paragraphs : MOCK_PARAGRAPHS),
    [ctx],
  )

  // Chapter 내 학습 단어 카운트 (참고 풋터용)
  const wordsOnPage = useMemo(() => {
    let count = 0
    for (const p of paragraphs) {
      for (const s of p.sentences) {
        for (const part of s.parts) if (part.word) count++
      }
    }
    return count
  }, [paragraphs])

  // §17.3 추천 축 (3곳 중 1곳: FloatingSparkle)
  // 사용자가 이미 Workspace에 있으므로 warm_urgent 컨텍스트 — Flashcard 추천이 학습 흐름의 자연스러운 다음 단계
  // DB 연동 시: getMockNextAction → getNextAction(userId, { context: 'workspace', textId })
  const recommendation = useMemo(() => getMockNextAction(MOCK_USER_CONTEXTS.warm_urgent), [])
  const recommendationHref = useMemo(() => actionToHref(recommendation), [recommendation])

  // "단어" 모드 목적지: WordVault Browse 풀스크린 + 현재 chapter 단어장 자동 활성
  //   · 라이브러리 도서 chapter (단어장 발행됨) → filter=set:{setId} + book/chapter query
  //     - ScriptsChipNav 자동 활성 + SessionFrame resource (book › Chapter N)
  //     - Browse 안에서 prev/next chapter nav 가능 (allChapterWordSets 전달)
  //   · 라이브러리 도서 chapter (단어장 없음)   → filter={textId}
  //   · 사용자 스크립트                        → filter={textId}
  //   · ctx 없음                               → 전체
  const wordsHref = useMemo(() => {
    if (ctx?.currentChapterWordSet && ctx?.libraryBookId && ctx?.chapterIdx != null) {
      const qs = new URLSearchParams({
        filter: `set:${ctx.currentChapterWordSet.id}`,
        book: ctx.libraryBookId,
        chapter: String(ctx.chapterIdx),
      })
      return `/wordvault/browse?${qs.toString()}`
    }
    if (ctx?.textId) return `/wordvault/browse?filter=${encodeURIComponent(ctx.textId)}`
    return `/wordvault/browse`
  }, [ctx?.currentChapterWordSet, ctx?.libraryBookId, ctx?.chapterIdx, ctx?.textId])

  // 게임 모드(카드·블리츠) 자료 스코프 — wordsHref 와 동일 규칙.
  //   · 도서 챕터(단어장 발행됨) → ?set={setId}  (shared_words)
  //   · 사용자 스크립트          → ?text={textId} (vocabularies)
  //   · ctx 없음(스코프 X)       → null → 각 모듈 일반 허브로
  const scopeQuery = useMemo(() => {
    if (ctx?.currentChapterWordSet && ctx?.libraryBookId && ctx?.chapterIdx != null) {
      return `?set=${ctx.currentChapterWordSet.id}`
    }
    if (ctx?.textId) return `?text=${encodeURIComponent(ctx.textId)}`
    return null
  }, [ctx?.currentChapterWordSet, ctx?.libraryBookId, ctx?.chapterIdx, ctx?.textId])

  const flashcardHref = scopeQuery ? `/flashcard/play${scopeQuery}` : '/flashcard'
  const wordblitzHref = scopeQuery ? `/play/wordblitz${scopeQuery}` : '/wordblitz'

  // 직접 스크립트 단어 추출용 — paragraphs 로부터 원문 재구성 (ExtractionPanel tokenize 입력)
  const scriptContent = useMemo(
    () =>
      paragraphs
        .map((p) => p.sentences.map((s) => s.parts.map((pt) => pt.text).join('')).join(' '))
        .join('\n\n'),
    [paragraphs],
  )

  // Hooks
  const { isFocusMode, toggle: toggleFocus } = useFocusMode()

  // State
  const [isBookmarked, setIsBookmarked] = useState(text.isBookmarked)
  const [isInsightOpen, setIsInsightOpen] = useState(false)
  const [recallWord, setRecallWord] = useState<Word | null>(null)
  const [recallAnchor, setRecallAnchor] = useState<DOMRect | null>(null)
  const [supportToken, setSupportToken] = useState<SupportToken | null>(null)
  const [supportAnchor, setSupportAnchor] = useState<DOMRect | null>(null)
  const [lookupSurface, setLookupSurface] = useState<string | null>(null)
  const [lookupAnchor, setLookupAnchor] = useState<DOMRect | null>(null)
  const tts = useTTS()
  // v06.32 — 듣기 player 항상 가시화 (사용자 명시 요청)
  const [audioVisible, setAudioVisible] = useState(true)

  // v06.x — 듣기 소스: 브라우저 TTS(문장/단락) vs LibriVox 원어민 보이스(챕터 전체)
  // 현재 챕터에 연결된 보이스가 있을 때만 LibriVox 선택 가능.
  const chapterAudio = ctx?.chapterAudio ?? null
  const [audioSource, setAudioSource] = useState<'browser' | 'librivox'>('browser')
  // 사용자 명시 선택은 챕터 이동 후에도 기억 (LS). 문장 클릭으로 인한 전환은 비저장.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vocaflow:audio:source')
      if (saved === 'librivox' || saved === 'browser') setAudioSource(saved)
    } catch {
      // localStorage 차단 — 기본값 browser
    }
  }, [])
  const handleSourceChange = useCallback((s: 'browser' | 'librivox') => {
    setAudioSource(s)
    try {
      localStorage.setItem('vocaflow:audio:source', s)
    } catch {
      // silent
    }
  }, [])
  // 연결된 보이스가 없으면 항상 브라우저 (LibriVox 선택 무효화)
  const effectiveSource: 'browser' | 'librivox' = chapterAudio ? audioSource : 'browser'

  // 🚨 워크스페이스 진입 즉시 + 매번 body 상태 강제 reset (다른 페이지 stale 누적 차단)
  // — sidebar / ModePills 클릭 결함 안전망. v06.34 — 진단 출력 추가.
  useEffect(() => {
    // 마운트 시점 진단 출력 (개발자가 콘솔에서 확인 가능)
    if (process.env.NODE_ENV !== 'production') {
      const stale = {
        overflow: document.body.style.overflow,
        focusMode: document.body.classList.contains('focus-mode'),
        pointerEvents: document.body.style.pointerEvents,
        overlays: document.querySelectorAll(
          '.fixed.inset-0.pointer-events-auto, [role="dialog"][aria-hidden="false"]',
        ).length,
      }
      if (
        stale.overflow === 'hidden' ||
        stale.focusMode ||
        stale.pointerEvents === 'none' ||
        stale.overlays > 0
      ) {
        // eslint-disable-next-line no-console
        console.warn('[workspace] body stale detected on mount — forcing reset:', stale)
      }
    }
    // 강제 reset (3중)
    document.body.style.overflow = ''
    document.body.style.pointerEvents = ''
    document.body.classList.remove('focus-mode')
    // raf 1 프레임 후 한 번 더 (다른 cleanup 보다 늦게 실행 보장)
    const id = requestAnimationFrame(() => {
      document.body.style.overflow = ''
      document.body.style.pointerEvents = ''
      document.body.classList.remove('focus-mode')
    })
    return () => cancelAnimationFrame(id)
  }, [])

  // Word handlers
  const handleWordHover = useCallback((word: Word, anchorRect: DOMRect) => {
    // 팝오버 상호배타 — 학습 카드 열 때 지원 gloss·사전 lookup 닫기
    setSupportToken(null)
    setSupportAnchor(null)
    setLookupSurface(null)
    setLookupAnchor(null)
    setRecallWord(word)
    setRecallAnchor(anchorRect)
  }, [])

  const handleRecallClose = useCallback(() => {
    setRecallWord(null)
    setRecallAnchor(null)
  }, [])

  // 읽기-중 이해 지원 — RecallCard 와 분리된 수동 gloss (학습 플로우 진입 없음)
  const handleSupportTap = useCallback((support: SupportToken, anchorRect: DOMRect) => {
    setRecallWord(null)
    setRecallAnchor(null)
    setLookupSurface(null)
    setLookupAnchor(null)
    setSupportToken(support)
    setSupportAnchor(anchorRect)
  }, [])

  const handleSupportClose = useCallback(() => {
    setSupportToken(null)
    setSupportAnchor(null)
  }, [])

  // 평범한 단어 클릭 — 사전 lookup (학습 대상·노이즈 아님). SRS·단어장 진입 없음.
  const handleWordLookup = useCallback((surface: string, anchorRect: DOMRect) => {
    setRecallWord(null)
    setRecallAnchor(null)
    setSupportToken(null)
    setSupportAnchor(null)
    setLookupSurface(surface)
    setLookupAnchor(anchorRect)
  }, [])

  const handleLookupClose = useCallback(() => {
    setLookupSurface(null)
    setLookupAnchor(null)
  }, [])

  // v06.32 — paragraphs → SentenceItem[] (TTS controller queue)
  const sentenceItems: SentenceItem[] = useMemo(() => {
    const items: SentenceItem[] = []
    paragraphs.forEach((p) => {
      p.sentences.forEach((s) => {
        const text = s.parts.map((part) => part.text).join('')
        items.push({
          paragraphId: String(p.id),
          sentenceIdx: s.id,
          text,
        })
      })
    })
    return items
  }, [paragraphs])

  // v06.x — 따라읽기(shadow): 같은 페이지에서 문장 듣기 → 따라 말하기 연속 루프
  const shadow = useShadowSession(sentenceItems, tts.state.selectedVoiceURI)
  const isShadow = currentMode === 'shadow'

  // 따라읽기 진입 시 듣기 player 정리(speechSynthesis 자원 충돌 차단) · 이탈 시 세션 종료
  useEffect(() => {
    if (isShadow) {
      tts.stop()
      setAudioVisible(false)
    } else {
      shadow.controls.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShadow])

  // Sentence playback — controller playFromMode 호출
  const handleSentencePlay = useCallback(
    (sentenceId: number) => {
      const idx = sentenceItems.findIndex((s) => s.sentenceIdx === sentenceId)
      if (idx < 0) return
      // 문장 클릭은 문장 단위 재생 — 브라우저 TTS 로 전환 (비저장: 사용자의 LibriVox 선호는 유지)
      setAudioSource('browser')
      // 같은 문장 재생 중이면 pause toggle
      if (tts.state.currentSentenceIdx === sentenceId && tts.state.state === 'playing') {
        tts.pause()
        return
      }
      tts.playFromMode(tts.state.mode, sentenceItems, idx)
      setAudioVisible(true)
    },
    [sentenceItems, tts]
  )

  // ReadingUniverse 표시용 — 현재 재생 문장 (브라우저 TTS 만 정확히 추적).
  //   LibriVox 는 챕터 단일 스트림이라 문장 타임스탬프가 없어 정확한 매핑 불가 →
  //   부정확한 추정 하이라이트는 표시하지 않음 (원어민 성우 선택 시 하이라이트 없음).
  const playingSentenceId = isShadow
    ? shadow.state.sentenceIdx
    : effectiveSource === 'librivox'
      ? null
      : tts.state.currentSentenceIdx

  // SpellForge 모드용 — 스크립트 내 모든 학습 단어 수집
  const spellforgeWords: SpellForgeWord[] = useMemo(() => {
    const collected: SpellForgeWord[] = []
    for (const p of paragraphs) {
      for (const s of p.sentences) {
        for (const part of s.parts) {
          if (part.word) collected.push(part.word as SpellForgeWord)
        }
      }
    }
    return collected
  }, [paragraphs])

  // Audio handler — close only (나머지 player 내부에서 controller 직접 호출)
  const handleAudioClose = () => {
    setAudioVisible(false)
    tts.stop()
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
      // LibriVox 활성 시 Space 는 브라우저 TTS 를 가로채지 않음 (player 의 재생 버튼 사용)
      if (effectiveSource === 'librivox') return
      if (tts.state.state === 'playing') tts.pause()
      else if (tts.state.state === 'paused') tts.resume()
      else if (sentenceItems.length > 0) {
        tts.playFromMode(tts.state.mode, sentenceItems, 0)
        setAudioVisible(true)
      }
    },
    onBookmark: handleBookmarkToggle,
    onInsight: () => setIsInsightOpen((o) => !o),
    onFocusMode: toggleFocus,
    onEscape: () => {
      setIsInsightOpen(false)
      handleRecallClose()
      handleSupportClose()
      handleLookupClose()
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

  // 단어 모드 (직접 스크립트) — 워크스페이스 내 추출 뷰. 추출 → 내 단어장(WordVault) 저장.
  // (라이브러리 책의 '단어' 는 /my/books/<bookId> 로 이동하므로 여기 도달하지 않음)
  if (currentMode === 'words' && !ctx?.libraryBookId) {
    return (
      <div className="min-h-screen bg-[var(--reading-bg)]">
        <div className="mx-auto max-w-2xl px-5 py-8 md:px-8">
          <div className="mb-5 flex items-center justify-between">
            <Link
              href={`/text/${text.id}?mode=read`}
              className="inline-flex items-center gap-1 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors hover:text-[var(--p)]"
            >
              <ArrowLeft size={14} aria-hidden /> 본문으로
            </Link>
            <Link
              href="/wordvault"
              className="inline-flex items-center gap-1 font-display text-[13px] font-[600] text-[var(--p)] hover:underline"
            >
              내 단어장 <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
          <h1 className="font-english text-[22px] font-[600] leading-tight text-[var(--t1)]">
            {text.title}
          </h1>
          <p className="mt-1.5 font-body text-[13px] leading-relaxed text-[var(--t3)]">
            이 스크립트의 단어를 AI로 추출해 내 단어장에 담아보세요.
          </p>
          <ExtractionPanel text={scriptContent} textId={text.id} defaultStrategy="text" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--reading-bg)]">
      <UnifiedHeader
        text={text}
        book={ctx?.book ?? null}
        chapters={ctx?.chapters ?? []}
        currentChapterIdx={ctx?.chapterIdx ?? null}
        currentTextId={text.id}
        currentChapterStatus={(ctx?.currentChapterStatus ?? 'not_started') as ChapterDisplayStatus}
        bookWordSetStats={ctx?.bookWordSetStats ?? null}
        isBookmarked={isBookmarked}
        onToggleBookmark={handleBookmarkToggle}
        onToggleInsight={() => setIsInsightOpen((o) => !o)}
        onToggleFocus={toggleFocus}
        isFocusMode={isFocusMode}
        currentMode={currentMode}
        modeStatus={MODE_STATUS}
        wordsHref={wordsHref}
        flashcardHref={flashcardHref}
        wordblitzHref={wordblitzHref}
      />

      {isShadow && (
        <ShadowReadAlong
          sentences={sentenceItems}
          state={shadow.state}
          controls={shadow.controls}
          onExit={() => router.push(`/text/${text.id}?mode=read`)}
        />
      )}

      <ReadingUniverse
        paragraphs={paragraphs}
        isFocusMode={isFocusMode}
        onWordHover={handleWordHover}
        onSentencePlay={isShadow ? shadow.controls.jumpTo : handleSentencePlay}
        playingSentenceId={playingSentenceId}
        chapterMeta={chapterMeta}
        onSupportTap={handleSupportTap}
        onWordLookup={handleWordLookup}
      />

      {/* Chapter bottom nav — 책 chapter context 만 (사용자 직접 입력 텍스트는 Pagination) */}
      {ctx?.libraryBookId && ctx.chapterIdx != null && ctx.chapters.length > 1 && (
        <div
          className={`mx-auto max-w-[680px] px-6 pb-10 md:px-8 ${
            isFocusMode ? 'opacity-30' : 'opacity-100'
          } transition-opacity duration-[var(--dur-slower)]`}
        >
          <ChapterBottomNav chapters={ctx.chapters} currentChapterIdx={ctx.chapterIdx} />
        </div>
      )}

      {/* Pagination — 사용자 직접 입력 텍스트의 다중 page 일 때만 */}
      {!ctx?.libraryBookId && text.totalPages > 1 && (
        <div className="mx-auto max-w-[680px] px-6 pb-10 md:px-8">
          <Pagination textId={text.id} currentPage={currentPage} totalPages={text.totalPages} />
        </div>
      )}

      {/* Chapter Footer — 실 단어 수 + 격려 (Empathetic Feedback + Implicit Progress) */}
      <footer
        className={`mx-auto max-w-[680px] px-6 pb-16 pt-8 text-center md:px-8 ${
          isFocusMode ? 'opacity-30' : 'opacity-100'
        } transition-opacity duration-[var(--dur-slower)]`}
      >
        <span className="mx-auto mb-4 block h-px w-10 bg-[var(--bd)]" aria-hidden="true" />
        {wordsOnPage > 0 && (
          <p className="font-body text-[12.5px] text-[var(--t3)]">
            이 chapter 에서{' '}
            <strong className="font-display font-[700] text-[var(--t1)]">{wordsOnPage}</strong>개의
            학습 단어를 만났어요
          </p>
        )}
        <p className="mt-1.5 font-body text-[12px] italic tracking-[0.01em] text-[var(--t3)]">
          오늘도 좋은 페이스예요 · 잠깐 쉬어도 좋아요
        </p>
      </footer>

      {/* Floating Components */}
      <RecallCard
        word={recallWord}
        anchorRect={recallAnchor}
        onClose={handleRecallClose}
      />

      <SupportGloss
        support={supportToken}
        anchorRect={supportAnchor}
        onClose={handleSupportClose}
      />

      {lookupSurface && lookupAnchor && (
        <WordLookupPopover
          surface={lookupSurface}
          anchorRect={lookupAnchor}
          onClose={handleLookupClose}
        />
      )}

      {/* 따라읽기 중엔 듣기 player 숨김 — speechSynthesis 자원 충돌 차단 */}
      {!isShadow && (
        <FloatingAudioPlayer
          isVisible={audioVisible}
          sentences={sentenceItems}
          onClose={handleAudioClose}
          chapterAudio={chapterAudio}
          source={effectiveSource}
          onSourceChange={handleSourceChange}
        />
      )}

      <FloatingSparkle
        message={recommendation.label}
        ctaLabel="시작하기"
        ctaHref={recommendationHref}
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
