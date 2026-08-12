// apps/web/src/components/library/vocab/VocabSetPreviewModal.tsx
//
// 공용 단어장 세트 미리보기 모달 (챕터 인식).
// - on open: 챕터 유무 감지 → 챕터형이면 전체 단어를 챕터별 아코디언으로, 아니면 10개 미리보기.
//   (하나의 세트가 여러 챕터로 "내부 구성" — shared_words.chapter. 챕터별 세트 아님.)
// - Esc / 오버레이 클릭 / X 버튼 닫기 · 본 세트 구독 CTA 동봉.

'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, Check, ChevronDown, Layers, Loader2, Plus, RefreshCw, Volume2, X } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import type { PublishedVocabSet } from '@/lib/library/vocab/queries'

interface PWord {
  word: string
  meaningKo: string
  partOfSpeech: string | null
  cefrLevel: string | null
  chapter: number | null
  /** 그룹 라벨 소스 — 어원 세트는 "어근 spec — 보다". 챕터 내 균일 시 챕터 헤딩으로 승격. */
  note: string | null
}

// 챕터 학습 — 게임별 launch (로더가 ?set=X&chapter=N 지원). from 으로 닫기 시 복귀.
//
// 마지막 항목은 개별 게임이 아니라 **아케이드 허브로 스코프를 넘기는 문**이다.
// 아케이드 19종을 여기 전부 나열하면 선택 과부하(CLAUDE.md 인지부하)라, 허브의
// "추천 1 + 전체 열람" 패턴을 재사용한다. 허브가 ?set/?chapter 를 받아 모든 카드에
// 실어주므로(v07.8) 이 한 줄로 19종 전부가 이 챕터 단어로 연결된다.
const CHAPTER_GAMES: { key: string; label: string; emoji: string; wide?: boolean; path: (setId: string, ch: number) => string }[] = [
  { key: 'flashcard', label: '플래시카드', emoji: '🃏', path: (s, c) => `/flashcard/play?set=${s}&chapter=${c}` },
  { key: 'wordblitz', label: '블리츠', emoji: '⚡', path: (s, c) => `/play/wordblitz?set=${s}&chapter=${c}` },
  { key: 'spellforge', label: '스펠', emoji: '🔨', path: (s, c) => `/spellforge/play?set=${s}&chapter=${c}` },
  { key: 'pairflip', label: '페어', emoji: '🎴', path: (s, c) => `/pairflip/play?set=${s}&chapter=${c}` },
  { key: 'arcade', label: 'Game Lab 19종', emoji: '🕹', wide: true, path: (s, c) => `/arcade?set=${s}&chapter=${c}` },
]
interface Props {
  set: PublishedVocabSet | null
  isSubscribed: boolean
  isPending: boolean
  onToggle: (set: PublishedVocabSet) => void
  onClose: () => void
  /** 챕터 게임 launch 의 닫기 복귀 경로(?from) — 재사용처(/wordvault 등)가 지정. 기본 /library/vocab. */
  fromPath?: string
}

/**
 * 적응형 완성 플랜(F2) — 시중 "30일 완성" 고정 스케줄 대비 개인화.
 *   신규 도입은 인지부하(하루 ~20~25단어) 기준으로 페이싱, 복습은 FSRS가 기억상태에 맞춰 자동 배치.
 *   챕터형이면 챕터를 하루 단위로. 순수 계산(사용자 상태 무관) — 세트 규모만.
 */
const DAILY_NEW = 22 // 인지부하 기반 하루 신규 권장(Cognitive Load — Sweller)

/**
 * 챕터를 펼쳤을 때 처음 보여줄 단어 수.
 *
 * 하루 신규 권장(22)과 같은 자리에 둔다 — "한 번에 눈에 들어오는 양" 의 기준이
 * 학습 분량과 어긋나면 안 된다. 나머지는 "더 보기" 로 요청할 때만 펼친다.
 */
const CHAPTER_PREVIEW = 24
const CHAPTER_PREVIEW_STEP = 50
function computeStudyPlan(wordCount: number, chapterCount: number) {
  if (wordCount <= 0) return null
  return {
    dailyNew: DAILY_NEW,
    introDays: Math.ceil(wordCount / DAILY_NEW),
    chapters: chapterCount > 1 ? chapterCount : 0,
  }
}

export function VocabSetPreviewModal({
  set,
  isSubscribed,
  isPending,
  onToggle,
  onClose,
  fromPath = '/library/vocab',
}: Props) {
  const fromEnc = encodeURIComponent(fromPath)
  const [words, setWords] = useState<PWord[] | null>(null)
  const [chaptered, setChaptered] = useState(false)
  const [openChapters, setOpenChapters] = useState<Set<number>>(new Set([1]))
  // v06.35 — 챕터를 펼쳤을 때 한 번에 보여줄 개수. 발행 cap 을 제거하면서(학습 대상
  //   누락을 없애기 위해) 챕터 세트가 300개 내외가 됐고, 그대로 flat 렌더하면
  //   "여기서 뭘 해야 하는지" 가 사라진다 — Progressive Disclosure 위반이고
  //   목록 자체가 압박이 된다(Calm UI). 처음엔 CHAPTER_PREVIEW 개만, 나머지는 요청 시.
  const [shownByChapter, setShownByChapter] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 진도-aware 완성 추정(F2) — 구독+로그인+챕터형(전체 단어 로드) 시 사용자 vocab∩세트 교집합 */
  const [learned, setLearned] = useState<number | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // 모달 열릴 때 단어 fetch — 챕터형이면 전체(아코디언), 아니면 10개 미리보기
  useEffect(() => {
    if (!set) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setWords(null)
    setChaptered(false)
    setOpenChapters(new Set([1]))
    setShownByChapter({}) // 다른 세트를 열면 "더 보기" 진행도도 초기화
    // shared_words.chapter 는 방금 추가된 컬럼 — database.ts 재생성 전이라 loose client 로 접근
    const supabase = createClient() as unknown as SupabaseClient

    const run = async () => {
      // 1) 챕터 유무 감지 — 최대 chapter 1행
      const { data: chRow, error: chErr } = await supabase
        .from('shared_words')
        .select('chapter')
        .eq('set_id', set.id)
        .not('chapter', 'is', null)
        .order('chapter', { ascending: false })
        .limit(1)
      if (cancelled) return
      if (chErr) {
        setError('단어를 불러오지 못했어요')
        setLoading(false)
        return
      }
      const hasChapters = (chRow?.[0]?.chapter ?? null) != null

      const map = (rows: { word: string; meaning_ko: string; part_of_speech: string | null; cefr_level: string | null; chapter?: number | null; korean_learner_note?: string | null }[]): PWord[] =>
        rows.map((r) => ({
          word: r.word,
          meaningKo: r.meaning_ko,
          partOfSpeech: r.part_of_speech,
          cefrLevel: r.cefr_level,
          chapter: r.chapter ?? null,
          note: r.korean_learner_note ?? null,
        }))

      if (hasChapters) {
        // 2a) 전체 단어 (페이지네이션, chapter 포함)
        const all: PWord[] = []
        const PAGE = 1000
        for (let from = 0; ; from += PAGE) {
          const { data, error: e } = await supabase
            .from('shared_words')
            .select('word, meaning_ko, part_of_speech, cefr_level, chapter, korean_learner_note')
            .eq('set_id', set.id)
            .order('sort_order', { ascending: true })
            .range(from, from + PAGE - 1)
          if (cancelled) return
          if (e) {
            setError('단어를 불러오지 못했어요')
            setLoading(false)
            return
          }
          const page = data ?? []
          all.push(...map(page))
          if (page.length < PAGE) break
        }
        setWords(all)
        setChaptered(true)
      } else {
        // 2b) 10개 미리보기
        const { data, error: e } = await supabase
          .from('shared_words')
          .select('word, meaning_ko, part_of_speech, cefr_level, korean_learner_note')
          .eq('set_id', set.id)
          .order('sort_order', { ascending: true })
          .limit(10)
        if (cancelled) return
        if (e) setError('단어를 불러오지 못했어요')
        else setWords(map(data ?? []))
        setChaptered(false)
      }
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [set])

  // 진도-aware 완성 추정(F2) — 구독+챕터형(전체 단어 로드)일 때만. 사용자 vocab 단어집합 ∩ 세트.
  useEffect(() => {
    setLearned(null)
    if (!set || !isSubscribed || !words || !chaptered || words.length === 0) return
    let cancelled = false
    const supabase = createClient() as unknown as SupabaseClient
    const run = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth?.user?.id
      if (!uid || cancelled) return
      // 사용자 vocab 단어(word만, keyset pagination) — RLS 본인만
      const vocab = new Set<string>()
      const PAGE = 1000
      let cursor = ''
      for (;;) {
        const { data, error: e } = await supabase
          .from('vocabularies')
          .select('word')
          .eq('user_id', uid)
          .gt('word', cursor)
          .order('word', { ascending: true })
          .limit(PAGE)
        if (e || cancelled) return
        const rows = (data ?? []) as { word: string }[]
        for (const r of rows) vocab.add(r.word.toLowerCase())
        if (rows.length < PAGE) break
        cursor = rows[rows.length - 1].word
      }
      if (cancelled) return
      const count = words.filter((w) => vocab.has(w.word.toLowerCase())).length
      setLearned(count)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [set, isSubscribed, words, chaptered])

  // Esc / body scroll lock / focus 관리
  useEffect(() => {
    if (!set) return
    const prevActive = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    dialogRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prevActive?.focus()
    }
  }, [set, onClose])

  // 챕터별 그룹 (챕터형일 때). label = 챕터 내 note 가 균일하면 그 note(어원 세트 어근 라벨), 아니면 null.
  const chapters = useMemo(() => {
    if (!chaptered || !words) return []
    const byCh = new Map<number, PWord[]>()
    for (const w of words) {
      const c = w.chapter ?? 0
      if (!byCh.has(c)) byCh.set(c, [])
      byCh.get(c)!.push(w)
    }
    return [...byCh.entries()].sort((a, b) => a[0] - b[0]).map(([n, ws]) => {
      const notes = ws.map((w) => w.note).filter((x): x is string => !!x)
      const uniform = notes.length === ws.length && new Set(notes).size === 1 ? notes[0] : null
      return { n, words: ws, label: uniform }
    })
  }, [chaptered, words])

  // 적응형 완성 플랜(F2) — 세트 규모 기반. 챕터형이면 챕터 수 반영.
  const plan = useMemo(
    () => (set ? computeStudyPlan(set.wordCount, chaptered ? chapters.length : 0) : null),
    [set, chaptered, chapters],
  )

  if (!set) return null

  function speak(word: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const utter = new SpeechSynthesisUtterance(word)
    utter.lang = 'en-US'
    utter.rate = 0.95
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }
  function toggleChapter(n: number) {
    setOpenChapters((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }

  const subtitle = chaptered
    ? `총 ${set.wordCount.toLocaleString()}개 단어 · ${chapters.length}챕터`
    : `총 ${set.wordCount.toLocaleString()}개 단어 · 미리보기 10개`

  const wordRow = (w: PWord, i: number) => (
    <li key={`${w.word}-${i}`} className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-english text-[16px] font-[600] text-[var(--t1)]">{w.word}</span>
          {w.partOfSpeech && <span className="font-body text-[11px] italic text-[var(--t2)]">{w.partOfSpeech}</span>}
          {w.cefrLevel && (
            <span className="rounded-[var(--r-full)] bg-[var(--bg3)] px-1.5 py-0.5 font-display text-[10px] font-[600] text-[var(--t2)]">
              {w.cefrLevel}
            </span>
          )}
        </div>
        <p className="mt-0.5 font-body text-[13px] text-[var(--t2)]">{w.meaningKo}</p>
      </div>
      <button
        type="button"
        onClick={() => speak(w.word)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-full)] bg-[#8B5CF6]/10 text-[#6D28D9] transition-colors hover:bg-[#8B5CF6]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
        aria-label={`${w.word} 발음 듣기`}
      >
        <Volume2 size={16} aria-hidden />
      </button>
    </li>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vocab-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[var(--r-2xl)] bg-[var(--bg)] shadow-[var(--sh-xl)] focus:outline-none"
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--bd)] px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="vocab-preview-title" className="line-clamp-2 font-display text-[18px] font-[700] text-[var(--t1)]">
              {set.coverEmoji} {set.title}
            </h2>
            <p className="mt-1 font-body text-[12px] text-[var(--t2)]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-full)] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
            aria-label="미리보기 닫기"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-[var(--t2)]">
              <Loader2 size={18} className="animate-spin" aria-hidden />
              <span className="font-body text-[13px]">단어를 불러오는 중...</span>
            </div>
          )}
          {error && !loading && (
            <p role="alert" className="py-6 text-center font-body text-[13px] text-[var(--error-ink)]">
              {error}
            </p>
          )}

          {/* 적응형 완성 플랜(F2) — 시중 고정 30일 대비 개인화 프레이밍 */}
          {!loading && !error && plan && (
            <div className="mb-4 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3">
              <div className="flex items-center gap-2">
                <CalendarClock size={15} className="shrink-0 text-[#6D28D9]" aria-hidden />
                <span className="font-display text-[12px] font-[700] text-[var(--t1)]">학습 플랜</span>
              </div>
              <p className="mt-1.5 font-body text-[13px] leading-relaxed text-[var(--t2)]">
                하루 <b className="font-[700] text-[var(--t1)]">{plan.dailyNew}단어</b>씩 · 약{' '}
                <b className="font-[700] text-[var(--t1)]">{plan.introDays}일</b>에 새 단어를 익혀요
                {plan.chapters > 0 && <span className="text-[var(--t2)]"> · {plan.chapters}챕터 구성</span>}.
              </p>

              {/* 진도-aware — 구독 후 실제 학습 진도 반영(개인화) */}
              {learned != null && (() => {
                const remaining = Math.max(0, set.wordCount - learned)
                const pct = set.wordCount > 0 ? Math.round((learned / set.wordCount) * 100) : 0
                const daysLeft = Math.ceil(remaining / plan.dailyNew)
                return (
                  <div className="mt-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-body text-[12px] text-[var(--t2)]">
                        학습 <b className="font-[700] text-[var(--t1)]">{learned}</b>
                        <span className="text-[var(--t2)]"> / {set.wordCount.toLocaleString()}</span>
                      </span>
                      <span className="font-body text-[12px] text-[var(--t2)]">
                        {remaining === 0 ? '한 바퀴 완주했어요 🎉' : `남은 ${remaining.toLocaleString()}단어 · 약 ${daysLeft}일 더`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-[6px] w-full overflow-hidden rounded-[var(--r-full)] bg-[var(--bg3)]">
                      <div
                        className="h-full rounded-[var(--r-full)] bg-[#8B5CF6] transition-[width] duration-[var(--dur-slow)]"
                        style={{ width: `${pct}%` }}
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`학습 진도 ${pct}%`}
                      />
                    </div>
                  </div>
                )
              })()}

              <p className="mt-2 flex items-start gap-1.5 font-body text-[12px] leading-relaxed text-[var(--t2)]">
                <RefreshCw size={12} className="mt-[3px] shrink-0" aria-hidden />
                <span>복습은 <b className="font-[600] text-[var(--t2)]">기억이 흐려질 때</b> 자동으로 배치돼요 — 고정 일정이 아니라 당신의 기억에 맞춰 조절돼요.</span>
              </p>
            </div>
          )}

          {/* 챕터형 — 아코디언 */}
          {!loading && !error && chaptered && chapters.length > 0 && (
            <div className="flex flex-col gap-2">
              {chapters.map((ch) => {
                const open = openChapters.has(ch.n)
                return (
                  <div key={ch.n} className="overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)]">
                    <div className="flex items-stretch bg-[var(--bg2)]">
                      <button
                        type="button"
                        onClick={() => toggleChapter(ch.n)}
                        aria-expanded={open}
                        className="flex min-w-0 flex-1 items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[var(--bg3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8B5CF6]"
                      >
                        <span className="min-w-0 font-display text-[13px] font-[700] text-[var(--t1)]">
                          {ch.label ?? `Chapter ${ch.n}`}
                          <span className="ml-2 font-body text-[12px] font-[400] text-[var(--t2)]">
                            {ch.words.length}단어 · {ch.words[0]?.cefrLevel ?? '?'}~{ch.words[ch.words.length - 1]?.cefrLevel ?? '?'}
                          </span>
                        </span>
                        <ChevronDown
                          size={16}
                          className={`shrink-0 text-[var(--t2)] transition-transform ${open ? 'rotate-180' : ''}`}
                          aria-hidden
                        />
                      </button>
                      <a
                        href={`/flashcard/play?set=${set.id}&chapter=${ch.n}&from=${fromEnc}`}
                        title={`Chapter ${ch.n} 플래시카드 학습`}
                        className="inline-flex shrink-0 items-center gap-1 border-l border-[var(--bd)] px-3 font-display text-[12px] font-[700] text-[#6D28D9] no-underline transition-colors hover:bg-[#8B5CF6]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8B5CF6]"
                      >
                        <Layers size={14} aria-hidden /> 학습
                      </a>
                    </div>
                    {open && (
                      <div className="flex flex-col">
                        {/* 게임별 챕터 학습 런처 */}
                        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--bd)] bg-[var(--bg)] px-4 py-2.5">
                          <span className="mr-0.5 font-display text-[11px] font-[700] text-[var(--t2)]">
                            이 챕터 학습
                          </span>
                          {CHAPTER_GAMES.map((g) => (
                            <a
                              key={g.key}
                              href={`${g.path(set.id, ch.n)}&from=${fromEnc}`}
                              title={`Chapter ${ch.n} — ${g.label}`}
                              // 44px 최소 터치 타겟(CLAUDE.md) — 기존 py-1 은 24px 였다.
                              // 아케이드 칩만 액센트를 줘 "개별 게임"이 아니라 "전부로 가는 문"임을 구분.
                              className={
                                'inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-full)] border px-3 font-display text-[11.5px] font-[700] no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] ' +
                                (g.wide
                                  ? 'border-[#8B5CF6]/45 bg-[#8B5CF6]/10 text-[#6D28D9] hover:border-[#8B5CF6] hover:bg-[#8B5CF6]/16'
                                  : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:border-[#8B5CF6] hover:bg-[#8B5CF6]/10 hover:text-[#6D28D9]')
                              }
                            >
                              <span aria-hidden>{g.emoji}</span>
                              {g.label}
                              {g.wide && <span aria-hidden>→</span>}
                            </a>
                          ))}
                        </div>
                        {(() => {
                          const shown = shownByChapter[ch.n] ?? CHAPTER_PREVIEW
                          const visible = ch.words.slice(0, shown)
                          const rest = ch.words.length - visible.length
                          return (
                            <>
                              <ul className="flex flex-col divide-y divide-[var(--bd)] px-4">
                                {visible.map((w, i) => wordRow(w, i))}
                              </ul>
                              {rest > 0 && (
                                <div className="flex items-center justify-center gap-2 border-t border-[var(--bd)] px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShownByChapter((s) => ({
                                        ...s,
                                        [ch.n]: shown + CHAPTER_PREVIEW_STEP,
                                      }))
                                    }
                                    className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 font-display text-[12px] font-[700] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[#8B5CF6] hover:text-[#6D28D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] active:scale-[0.98]"
                                  >
                                    {Math.min(rest, CHAPTER_PREVIEW_STEP)}개 더 보기
                                  </button>
                                  {rest > CHAPTER_PREVIEW_STEP && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setShownByChapter((s) => ({ ...s, [ch.n]: ch.words.length }))
                                      }
                                      className="inline-flex min-h-[44px] items-center px-3 font-display text-[12px] font-[600] text-[var(--t2)] underline-offset-2 transition-colors hover:text-[#6D28D9] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
                                    >
                                      전체 {ch.words.length}개
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* 평면 — 10개 미리보기 */}
          {!loading && !error && !chaptered && words && words.length > 0 && (
            <ul className="flex flex-col divide-y divide-[var(--bd)]">{words.map((w, i) => wordRow(w, i))}</ul>
          )}

          {!loading && !error && words && words.length === 0 && (
            <p className="py-6 text-center font-body text-[13px] text-[var(--t2)]">아직 등록된 단어가 없어요</p>
          )}
        </div>

        {/* 푸터 CTA */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--bd)] px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[40px] items-center rounded-[var(--r-md)] px-4 py-2 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)]"
          >
            닫기
          </button>
          {isSubscribed ? (
            <button
              type="button"
              onClick={() => onToggle(set)}
              disabled={isPending}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] px-4 py-2 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] disabled:opacity-60"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Check size={14} aria-hidden />}
              구독 해지
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onToggle(set)}
              disabled={isPending}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--r-md)] bg-[#8B5CF6] px-4 py-2 font-display text-[13px] font-[700] text-white transition-colors hover:bg-[#7C3AED] disabled:opacity-60"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Plus size={14} aria-hidden />}
              내 단어장에 추가
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
