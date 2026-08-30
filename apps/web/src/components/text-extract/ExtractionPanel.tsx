// apps/web/src/components/text-extract/ExtractionPanel.tsx
//
// /text/new 단어 추출 패널 v2 — 측정 source 선택 + meta 표시
//
// strategy:
//   - user: 본인 진단 레벨 (미진단 시 에러)
//   - text: 글 P75 레벨 (V11 outlier 제외)
//   - auto (default): user 있으면 user, 없으면 text fallback
//
// 자동: 추출 개수는 글-사용자 gap 기반 (auto_n)

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { chunkForIn } from '@/lib/supabase/paged-select'
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Sparkles, TrendingUp, User, FileText, Target, GraduationCap, Briefcase, Repeat, Star, Shuffle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { tokenizeText } from '@/lib/text-extract/tokenize'
import { buildSentenceIndex, firstSentenceContaining } from '@/lib/text-extract/source-sentence'
import { TokenizationSummary } from '@/components/text-extract/TokenizationSummary'
import { TextFitVerdict } from '@/components/textfit/TextFitVerdict'
import { ClassWorksheet } from '@/components/teacher/ClassWorksheet'
import { SendToClassButton } from '@/components/teacher/SendToClassButton'
import type { AssignmentWord } from '@/lib/teacher/assignment-actions'
import { fetchTeacherClasses } from '@/lib/teacher/class-actions'
import type { TeacherClass } from '@/lib/teacher/class-actions'
import { analyzeText } from '@/lib/textfit/queries'
import type { TextFitReport } from '@/lib/textfit/types'

interface ExtractedWord {
  text_v_level: number
  user_v_level: number | null
  effective_user_v: number
  level_source: string
  gap: number
  auto_n: number
  v_threshold: number
  total_candidates: number
  word: string
  meaning_ko: string | null
  v_level: number
  cefr_level: string | null
  pos: string | null
  example_en: string | null
  frequency_rank: number | null
  skill_level: number
  track_levels: Record<string, number> | null
  composite_score: number
  score_breakdown: {
    user_v_level: number
    v_threshold: number
    track_boost: number
    frequency_boost: number
    skill_penalty: number
    weights: Record<string, number>
    reasoning: string
    method?: string
    match_layer?: 1 | 2
    matched_via_surface?: string | null
  }
  rank: number
  // v2 추가 컬럼 (L2 inflections 회수 표시)
  match_layer: 1 | 2
  matched_via_surface: string | null
  // 클라이언트 계산 — 원문(this script)에서의 출현 문장. 단어장 예문에 dict 보다 우선.
  source_sentence?: string | null
}

interface ExtractionPanelProps {
  text: string
  /** 저장 시 vocabularies.text_id 로 연결 — 워크스페이스 스크립트에서 추출 시 provenance */
  textId?: string
  /** 기본 레벨 기준 — 미진단 사용자 많은 워크스페이스에선 'text' 권장 (기본 'user') */
  defaultStrategy?: LevelStrategy
  onSaved?: (count: number) => void
  /** 과제 이름 기본값 (예: 글 제목) — 학급에 보낼 때 미리 채워진다. */
  assignmentTitle?: string
}

type LevelStrategy = 'user' | 'text'
type DisplayPct = 10 | 25 | 50 | 75 | 100
const PCT_CHIPS: { value: DisplayPct; label: string }[] = [
  { value: 10, label: '상위 10%' },
  { value: 25, label: '상위 25%' },
  { value: 50, label: '상위 50%' },
  { value: 75, label: '상위 75%' },
  { value: 100, label: '전체' },
]

/**
 * 한 번에 담기 좋은 신규 단어 수 — 이 수를 넘기면 차분히 알린다(막지는 않는다).
 * 근거: 인지 부하(작업기억 ~4항목)는 동시 처리 한계지만, SRS 신규 카드는 며칠 뒤
 * 복습이 한꺼번에 돌아온다. 기본 선택이 "표시된 것 전부"라 18개가 무심코 들어가던 것을
 * 결정 직전에 한 번 보여 주는 것이 목적이다.
 */
const CALM_BATCH = 10

const SOURCE_LABEL: Record<string, string> = {
  user_diagnostic: '본인 진단',
  text_p75: '글 P75',
  auto_user_diagnostic: '자동 — 본인 진단',
  auto_text_p75_fallback: '자동 — 글 P75 (미진단)',
}

const POS_KO: Record<string, string> = {
  verb: '동사', noun: '명사', adjective: '형용사', adverb: '부사',
  pronoun: '대명사', preposition: '전치사', conjunction: '접속사',
  determiner: '한정사', numeral: '수사', interjection: '감탄사',
}

// 4단계 "자랑하기" — 추출 근거를 학습자 공감 언어로. 왜 이 단어가 뽑혔나.
//   기술 스코어(score_breakdown)를 사람 말투 이유로 번역. 순서 = 신뢰 가치순.
type Reason = { key: string; Icon: LucideIcon; label: string }
function buildReasons(r: ExtractedWord): Reason[] {
  const reasons: Reason[] = []
  const bd = r.score_breakdown
  const tl = r.track_levels

  // 1) 목표 트랙 빈출 (수능/비즈/학술) — 가장 동기부여되는 근거
  if (bd.track_boost > 0 && tl) {
    const tracks: { v: number; Icon: LucideIcon; label: string }[] = [
      { v: tl.csat_korean ?? 0, Icon: Target, label: '수능 지문에 자주 나와요' },
      { v: tl.business_english ?? 0, Icon: Briefcase, label: '비즈니스 영어에서 자주 써요' },
      { v: tl.academic_english ?? 0, Icon: GraduationCap, label: '학술 글에서 자주 만나요' },
    ]
    const top = tracks.filter((t) => t.v >= 4).sort((a, b) => b.v - a.v)[0]
    if (top) reasons.push({ key: 'track', Icon: top.Icon, label: top.label })
  }

  // 2) i+1 난이도 위치 (Desirable Difficulty)
  const gap = r.v_level - bd.v_threshold
  reasons.push(
    gap === 0
      ? { key: 'level', Icon: Sparkles, label: '딱 지금 배우기 좋은 난이도예요' }
      : { key: 'level', Icon: TrendingUp, label: '조금 도전적이지만 이 글에 필요해요' },
  )

  // 3) 빈도 — 두루 쓸모 / 이 글에서 특별
  if (r.frequency_rank != null && r.frequency_rank <= 3000) {
    reasons.push({ key: 'freq', Icon: Repeat, label: '자주 쓰여서 익혀두면 두루 쓸모 있어요' })
  } else if (r.frequency_rank == null || r.frequency_rank > 12000) {
    reasons.push({ key: 'freq', Icon: Star, label: '이 글에서 특히 중요한 단어예요' })
  }

  // 4) 형태 해소 — 이 플랫폼만의 강점(굴절/파생형 → 표제어 + 그 형태의 뜻)
  if (r.match_layer === 2 && r.matched_via_surface && r.matched_via_surface !== r.word) {
    const posKo = r.pos ? POS_KO[r.pos] ?? r.pos : ''
    reasons.push({
      key: 'form',
      Icon: Shuffle,
      label: `이 글엔 "${r.word}" 형태로 나와요 — 표제어 "${r.matched_via_surface}"${posKo ? ` (${posKo} 뜻)` : ''}`,
    })
  }

  return reasons
}

export function ExtractionPanel({ text, textId, defaultStrategy = 'user', onSaved, assignmentTitle = '' }: ExtractionPanelProps) {
  const [strategy, setStrategy] = useState<LevelStrategy>(defaultStrategy)
  const [displayPct, setDisplayPct] = useState<DisplayPct>(25)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ExtractedWord[] | null>(null)
  // 알아요/몰라요 판정 (표면형 키). known → 학습셋 제외 + 향후 추출 제외.
  const [familiar, setFamiliar] = useState<Record<string, 'known' | 'unknown'>>({})
  // 어원(root) 힌트 — 표제어(lemma) → 어근들. word_root_links 조회(이중배당: 어원 축을 추출 근거에 노출).
  const [roots, setRoots] = useState<Record<string, { root: string; gloss: string }[]>>({})
  const [meta, setMeta] = useState<ExtractedWord | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedWord, setExpandedWord] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState<number | null>(null)

  // 내가 가르치는 학급 — 패널이 스스로 불러온다. 호출부마다 배선하면 한 곳이 빠지는 순간
  // 그 화면에서만 조용히 사라진다(그리고 아무도 눈치채지 못한다).
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([])
  useEffect(() => {
    void fetchTeacherClasses()
      .then((r) => setTeacherClasses(r.classes))
      // 학급 조회 실패는 추출을 막지 않는다 — 보내기 버튼만 안 뜬다.
      .catch(() => setTeacherClasses([]))
  }, [])

  /**
   * 학급에 보낼 낱말 — **선택된 것만**. 화면에서 고른 것과 보내는 것이 다르면 안 된다.
   * 표제어(matched_via_surface)를 쓴다 — 학생이 배울 형태는 원문 표면형이 아니라 표제어다.
   */
  const selectedAssignmentWords = useMemo<AssignmentWord[]>(() => {
    if (!results) return []
    return results
      .filter((r) => selected.has(r.word))
      .map((r) => ({ w: r.matched_via_surface ?? r.word, m: r.meaning_ko, v: r.v_level }))
  }, [results, selected])

  const tokenization = useMemo(() => tokenizeText(text), [text])

  // ── 지문 적합도(TextFit) ──
  // 추출 버튼을 누르기 **전에** 답해야 하는 질문이 하나 있다: "이 글, 지금 나에게 맞나?"
  // 추출은 "무엇을 배울까" 지만 TextFit 은 "지금 읽을 글이 맞나" 라서 순서가 앞선다.
  // 토크나이저 결과를 그대로 넘긴다 — 추출과 커버리지가 같은 토큰 집합에서 나와야 두 숫자가 갈라지지 않는다.
  const [fit, setFit] = useState<TextFitReport | null>(null)
  const [fitLoading, setFitLoading] = useState(false)

  useEffect(() => {
    if (tokenization.uniqueFinal === 0) {
      setFit(null)
      return
    }
    // 입력 중 매 글자마다 서버를 때리지 않는다(Calm UI — 화면이 계속 흔들리면 읽을 수 없다).
    let alive = true
    setFitLoading(true)
    const timer = setTimeout(() => {
      void analyzeText(tokenization.counts, tokenization.totalWords)
        .then((r) => {
          if (alive) setFit(r)
        })
        .catch(() => {
          // 판정 실패는 추출을 막지 않는다 — 부가 정보이지 관문이 아니다.
          if (alive) setFit(null)
        })
        .finally(() => {
          if (alive) setFitLoading(false)
        })
    }, 600)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [tokenization])

  /** 처방 단어(표제어)를 기존 선택에 얹는다 — 저장 경로는 하나로 유지한다. */
  const collectPrescribed = useMemo(() => {
    if (!results || results.length === 0) return undefined
    return (lemmas: string[]) => {
      const want = new Set(lemmas.map((l) => l.toLowerCase()))
      setSelected((prev) => {
        const next = new Set(prev)
        for (const r of results) {
          const lemma = (r.matched_via_surface ?? r.word).toLowerCase()
          if (want.has(lemma)) next.add(r.word)
        }
        return next
      })
    }
  }, [results])

  // 상위 displayPct% 슬라이스 (results 는 composite_score DESC 정렬됨)
  const displayedResults = useMemo(() => {
    if (!results) return null
    if (displayPct >= 100) return results
    const count = Math.max(1, Math.ceil((results.length * displayPct) / 100))
    return results.slice(0, count)
  }, [results, displayPct])

  async function handleExtract() {
    if (tokenization.words.length === 0) {
      setError('추출할 영문 단어가 없어요')
      return
    }
    setLoading(true)
    setError(null)
    setResults(null)
    setRoots({})
    setSelected(new Set())
    setSavedCount(null)

    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user?.id) {
      setError('로그인이 필요해요')
      setLoading(false)
      return
    }

    const { data, error: rpcErr } = await supabase.rpc('extract_vocabulary_for_user_v2', {
      p_user_id: userData.user.id,
      p_words: tokenization.words,
      p_level_strategy: strategy,
      p_limit: 0, // 전체 — 클라이언트 % chip 으로 슬라이스
    })

    if (rpcErr) {
      setError(rpcErr.message)
      setLoading(false)
      return
    }

    // 원문에서 단어별 출현 문장 부착 (context-dependent 예문). 문장 분리는 1회만.
    //
    // ⚠️ 인자 순서 주의 — RPC 컬럼명이 내용과 어긋난다.
    //   `word`                = 원문 표면형 (RPC 내부 c_surface)
    //   `matched_via_surface` = **표제어** (RPC 내부 c_word) — 이름과 달리 surface 가 아니다
    // firstSentenceContaining(sentences, 표면형, 표제어) 순이므로 아래가 맞다.
    // 뒤집으면 1단계가 표제어를 찾아, 학습자가 배우는 형태가 **없는** 문장을 예문으로 준다
    // (회귀: lib/text-extract/__tests__/source-sentence.test.ts).
    const sentences = buildSentenceIndex(text)
    const rows = ((data ?? []) as ExtractedWord[]).map((r) => ({
      ...r,
      source_sentence: firstSentenceContaining(sentences, r.word, r.matched_via_surface ?? r.word),
    }))
    setResults(rows)
    setMeta(rows[0] ?? null)
    setSelected(new Set(rows.map((r) => r.word)))
    setLoading(false)

    // 어원(root) 힌트 — 추출 단어의 표제어 어근을 조회해 근거에 노출(best-effort). 신규 테이블이라 loose client.
    const lemmas = [...new Set(rows.map((r) => (r.matched_via_surface ?? r.word).toLowerCase()))]
    if (lemmas.length > 0) {
      // ⚠️ `.in()` 은 **개수가 아니라 값 길이**에서 깨진다 — 낱말 ~600개(약 11,000자)를
      //    넘으면 `TypeError: fetch failed` 가 **7.5초 뒤에** 온다(실측 2026-08-30).
      //    긴 글을 붙여넣으면 표제어가 쉽게 그 수를 넘는데, 화면에서는 "어원이 안 뜬다" 로만
      //    보인다. 길이 기준으로 쪼갠다.
      void Promise.all(
        chunkForIn(lemmas).map((chunk) =>
          (supabase as unknown as SupabaseClient)
            .from('word_root_links')
            .select('word, word_roots(root, gloss_ko)')
            .in('word', chunk),
        ),
      )
        .then((results) => {
          const rows2 = results.flatMap(
            (res) => (res.data ?? []) as unknown as { word: string; word_roots: { root: string; gloss_ko: string } | null }[],
          )
          const map: Record<string, { root: string; gloss: string }[]> = {}
          for (const l of rows2) {
            if (!l.word_roots) continue
            ;(map[l.word] ??= []).push({ root: l.word_roots.root, gloss: l.word_roots.gloss_ko })
          }
          setRoots(map)
        })
    }

    // 사전이 **정말로** 모르는 단어만 누적한다 (사전 확장 백로그).
    //   이전에는 "추출 결과에 없는 단어" 를 전부 보냈다. 그런데 결과는 V-Level 임계값으로
    //   걸러진 것이라, 임계값 미만의 흔한 단어까지 전부 "사전 미등재" 로 기록됐다.
    //   실측(2026-08-13): 173건 전송 중 160건(92.5%)이 실제로는 사전에 있는 단어였고,
    //   진짜 사전 갭 13건이 오탐에 묻혀 백로그를 쓸 수 없었다.
    //   → unresolved_dict_words 가 resolve_dict_headword 해석 실패분만 돌려준다.
    //   (신규 RPC 라 생성 타입 미포함 — word_root_links 와 동일하게 loose client)
    const userId = userData.user.id
    void (supabase as unknown as SupabaseClient)
      .rpc('unresolved_dict_words', { p_words: tokenization.words })
      .then(({ data: unresolved, error: unresolvedErr }) => {
        const lemmas = (unresolved ?? []) as unknown as string[]
        if (unresolvedErr || lemmas.length === 0) return
        // 하이픈 전체형은 **부분이 이미 해석되면 사전 갭이 아니다**.
        //   토크나이저가 "machine-learning" 을 부분(machine·learning)과 전체 둘 다
        //   후보로 올리므로, 전체형은 대개 미해석으로 남는다. 그걸 그대로 백로그에
        //   넣으면 사전에 추가할 이유가 없는 항목이 쌓인다 (실측 12건 중 2건).
        const unresolvedSet = new Set(lemmas)
        const gaps = lemmas.filter((w) => {
          if (!w.includes('-')) return true
          const parts = w.split('-').filter((p) => p.length >= 2)
          return parts.length === 0 || parts.some((p) => unresolvedSet.has(p))
        })
        if (gaps.length === 0) return
        return supabase.rpc('record_pending_words', {
          p_user_id: userId,
          p_lemmas: gaps,
        })
      })
  }

  function toggleSelect(word: string) {
    const next = new Set(selected)
    if (next.has(word)) next.delete(word)
    else next.add(word)
    setSelected(next)
  }

  // "알아요/몰라요" — 학습자가 추출을 직접 교정. lemma(표제어) 단위 저장.
  //   known: 학습셋에서 빼고(선택 해제) 다음 추출부터 제외. unknown: 학습 유지.
  async function markFamiliarity(r: ExtractedWord, verdict: 'known' | 'unknown') {
    const lemma = r.matched_via_surface ?? r.word // 통합 추출: matched_via_surface = 해소 표제어
    setFamiliar((f) => ({ ...f, [r.word]: verdict }))
    if (verdict === 'known') {
      setSelected((s) => {
        const n = new Set(s)
        n.delete(r.word)
        return n
      })
    }
    // 낙관적 UI 는 유지한다(판정은 위에서 이미 화면에 반영됐다). 다만 **조용히 버리지 않는다** —
    // supabase.rpc 는 throw 하지 않고 `{ error }` 를 반환하므로 try/catch 만으로는 아무것도
    // 잡지 못했고, error 검사도 없었다. 그 결과 word_familiarity 테이블이 사라진 동안
    // 판정이 "성공한 것처럼 보이며" 전부 유실됐다(20260719 drop → 20260812 복원).
    // 실패를 학습자에게 알리고 화면 표시도 되돌린다 — 저장 안 된 판정을 저장된 것처럼
    // 보여주는 것이 이 화면에서 가장 나쁜 거짓말이다.
    const supabase = createClient()
    const { error: rpcErr } = await supabase.rpc('set_word_familiarity', {
      p_lemma: lemma,
      p_verdict: verdict,
      p_v_level: r.v_level,
    })
    if (rpcErr) {
      setFamiliar((f) => {
        const next = { ...f }
        delete next[r.word]
        return next
      })
      if (verdict === 'known') setSelected((s) => new Set(s).add(r.word))
      setError('판정을 저장하지 못했어요 — 다시 눌러 주세요')
    }
  }

  function toggleAll() {
    if (!displayedResults) return
    if (selected.size === displayedResults.length) setSelected(new Set())
    else setSelected(new Set(displayedResults.map((r) => r.word)))
  }

  // "알아요" 판정을 effect 의존성에 넣지 않기 위한 ref — 판정할 때마다 선택이
  //   통째로 재초기화되면 학습자가 손으로 해제한 것까지 되살아난다.
  const familiarRef = useRef(familiar)
  useEffect(() => {
    familiarRef.current = familiar
  }, [familiar])

  // displayPct 변경 시 선택 set 을 displayed 범위로 재초기화 (newly hidden 자동 unselect).
  //   단 **"알아요" 로 제외한 단어는 되살리지 않는다** — 학습자가 명시적으로 안다고 한 단어가
  //   % 칩을 눌렀다는 이유로 단어장에 저장되던 결함(v06.35).
  useEffect(() => {
    if (!displayedResults) return
    setSelected(
      new Set(
        displayedResults
          .filter((r) => familiarRef.current[r.word] !== 'known')
          .map((r) => r.word),
      ),
    )
  }, [displayedResults])

  async function handleSave() {
    if (!results || selected.size === 0) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user?.id) {
      setError('로그인이 필요해요')
      setSaving(false)
      return
    }

    const rows = (displayedResults ?? results)
      .filter((r) => selected.has(r.word))
      .map((r) => {
        // SRS 키 = 표제어(matched_via_surface) → galloped/gallops 형태별로 안 쪼개짐.
        //   학습자가 본 실제 형태·품사는 extracted_* 로 보존.
        const lemma = r.matched_via_surface ?? r.word
        return {
          user_id: userData.user!.id,
          word: lemma,
          lemma,
          extracted_surface: r.word,
          extracted_pos: r.pos ?? null,
          meaning: r.meaning_ko ?? '',
          // 원문(스크립트) 문장 우선 → dict 일반 예문 폴백
          example_sentence: r.source_sentence ?? r.example_en ?? null,
          pos: r.pos ?? null,
          cefr_level: r.cefr_level ?? null,
          pronunciation: null as string | null,
          difficulty: 6.0,
          stability: 0,
          review_count: 0,
          origin: 'manual' as const,
          ...(textId ? { text_id: textId } : {}),
        }
      })

    const { error: insertErr, count } = await supabase
      .from('vocabularies')
      .upsert(rows, { onConflict: 'user_id,word', ignoreDuplicates: true, count: 'exact' })

    if (insertErr) {
      setError(insertErr.message)
      setSaving(false)
      return
    }

    setSavedCount(count ?? rows.length)
    setSaving(false)
    onSaved?.(count ?? rows.length)
  }

  if (tokenization.uniqueFinal === 0) {
    return (
      <div className="mt-6 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-6 text-center font-body text-[13px] text-[var(--t2)]">
        본문에 영문 단어를 입력하면 AI 추출이 가능해져요
      </div>
    )
  }

  return (
    <section className="mt-8 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6 shadow-[var(--sh-sm)]">
      <header className="mb-4">
        <h3 className="inline-flex items-center gap-2 font-display text-[16px] font-[700] text-[var(--t1)]">
          <Sparkles size={16} className="text-[var(--p)]" />
          AI 단어 추출 (다축 VRL)
        </h3>
        <TokenizationSummary
          totalWords={tokenization.totalWords}
          uniqueRaw={tokenization.uniqueRaw}
          uniqueFinal={tokenization.uniqueFinal}
          diagnostics={tokenization.diagnostics}
        />
      </header>

      {/* 지문 적합도 — 무엇을 배울지 고르기 전에 "이 글이 맞나" 부터 답한다 */}
      {fit && (
        <div className="mb-4">
          <TextFitVerdict report={fit} onCollectWords={collectPrescribed} />
        </div>
      )}
      {!fit && fitLoading && (
        <p
          role="status"
          className="mb-4 flex items-center gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 font-body text-[13px] text-[var(--t2)]"
        >
          <Loader2 size={14} className="animate-spin" aria-hidden />이 글이 지금 나에게 맞는지 재는 중…
        </p>
      )}

      {/* Level strategy selector */}
      <div className="mb-4 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
        <p className="mb-2 font-display text-[11px] font-[700] uppercase tracking-wider text-[var(--t2)]">
          어느 레벨을 기준으로?
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <label className={`flex flex-1 cursor-pointer items-start gap-2 rounded-[var(--r-md)] border-2 p-3 transition-all ${
            strategy === 'user' ? 'border-[var(--p)] bg-[var(--p-light)]' : 'border-[var(--bd)] bg-[var(--bg)] hover:border-[var(--t3)]'
          }`}>
            <input
              type="radio"
              name="strategy"
              value="user"
              checked={strategy === 'user'}
              onChange={() => setStrategy('user')}
              className="mt-0.5 accent-[var(--p)]"
            />
            <div className="flex-1">
              <span className="inline-flex items-center gap-2 font-display text-[13px] font-[600] text-[var(--t1)]">
                <User size={12} /> 본인 레벨 기준
              </span>
              <p className="mt-0.5 font-body text-[11px] text-[var(--t2)]">
                진단된 V-Level 기준. 미진단 시 에러.
              </p>
            </div>
          </label>
          <label className={`flex flex-1 cursor-pointer items-start gap-2 rounded-[var(--r-md)] border-2 p-3 transition-all ${
            strategy === 'text' ? 'border-[var(--p)] bg-[var(--p-light)]' : 'border-[var(--bd)] bg-[var(--bg)] hover:border-[var(--t3)]'
          }`}>
            <input
              type="radio"
              name="strategy"
              value="text"
              checked={strategy === 'text'}
              onChange={() => setStrategy('text')}
              className="mt-0.5 accent-[var(--p)]"
            />
            <div className="flex-1">
              <span className="inline-flex items-center gap-2 font-display text-[13px] font-[600] text-[var(--t1)]">
                <FileText size={12} /> 글 레벨 기준 (P75)
              </span>
              <p className="mt-0.5 font-body text-[11px] text-[var(--t2)]">
                글의 75% 단어가 속한 V-Level. V11 archaic 제외.
              </p>
            </div>
          </label>
        </div>
        <button
          onClick={() => void handleExtract()}
          disabled={loading}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-4 py-2 font-display text-[13px] font-[700] text-[var(--on-p)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] active:scale-[0.97] disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? '분석 중…' : '추출 분석'}
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-[var(--r-md)] border border-[var(--bde)] bg-[var(--error-light)] p-3 font-body text-[12px] text-[var(--error-ink)]">
          {error}
        </div>
      )}

      {savedCount !== null && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--success)]/30 bg-[var(--success-light)] p-3 font-body text-[12px] text-[#065f46]">
          <CheckCircle2 size={14} /> {savedCount}개 단어를 내 단어장에 추가했어요
        </div>
      )}

      {/* 교사 경로 — 추출한 단어를 학급에 보낸다.
          학급이 없으면 버튼 대신 안내 한 줄만 나온다(누르면 실패하는 버튼을 두지 않는다). */}
      {results && results.length > 0 && (
        <div className="mb-4 flex flex-col gap-3">
          <SendToClassButton
            classes={teacherClasses}
            words={selectedAssignmentWords}
            defaultTitle={assignmentTitle}
          />
          {/*
            보내기와 나란히 둔다 — 같은 낱말이 **디지털로도 종이로도** 나가야 한다.
            교실에서 실제로 일어나는 일이 그렇고, 종이에 찍히는 학급 초대 QR 이
            "교사 1명 → 학생 30명" 이 실제로 일어나는 유일한 자리다.
          */}
          <ClassWorksheet
            classes={teacherClasses}
            words={selectedAssignmentWords}
            title={assignmentTitle}
          />
        </div>
      )}

      {/* Meta panel — measured levels */}
      {meta && results && displayedResults && (
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-[var(--r-md)] bg-[var(--bg2)] p-3 sm:grid-cols-4">
          <MetaCell label="글 레벨 (P75)" value={`V${meta.text_v_level}`} />
          <MetaCell label="본인 V-Level" value={meta.user_v_level && meta.user_v_level > 0 ? `V${meta.user_v_level}` : '미진단'} />
          <MetaCell label="추출 기준 (≥)" value={`V${meta.v_threshold}`} accent />
          <MetaCell
            label="표시 / 후보"
            value={`${displayedResults.length} / ${meta.total_candidates}`}
            accent
          />
          <p className="col-span-2 mt-1 font-body text-[10px] text-[var(--t2)] sm:col-span-4">
            기준: <strong>{SOURCE_LABEL[meta.level_source] ?? meta.level_source}</strong> ·
            <strong className="text-[var(--t1)]"> V{meta.v_threshold} 이상</strong> 단어 모두 후보
            · 빈도(70%) + 트랙(30%) 가산 정렬 · V11 archaic 도 글에 등장하면 포함
          </p>
        </div>
      )}

      {/* % chip strip — 스코어 상위 X% 슬라이스 */}
      {results && results.length > 0 && (
        <div
          role="radiogroup"
          aria-label="표시 비율"
          className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-2"
        >
          <span className="px-1 font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t2)]">
            상위 점수
          </span>
          {PCT_CHIPS.map((c) => {
            const active = displayPct === c.value
            const count = c.value >= 100 ? results.length : Math.max(1, Math.ceil((results.length * c.value) / 100))
            return (
              <button
                key={c.value}
                role="radio"
                aria-checked={active}
                onClick={() => setDisplayPct(c.value)}
                className={`inline-flex items-center gap-1 rounded-[var(--r-sm)] border px-2 py-1 font-display text-[11px] font-[700] transition-all ${
                  active
                    ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--on-p-tint)]'
                    : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:bg-[var(--bg3)]'
                }`}
              >
                {c.label}
                <span className={`font-mono text-[10px] ${active ? 'text-[var(--p)]/70' : 'text-[var(--t2)]'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {results && results.length === 0 && (
        <p className="font-body text-[13px] text-[var(--t2)]">
          추출 가능한 단어가 없어요 — 모두 학습 중이거나 사전에 없는 단어들이에요.
        </p>
      )}

      {displayedResults && displayedResults.length > 0 && (
        <>
          <div className="mb-3 rounded-[var(--r-md)] bg-[var(--bg2)] p-3">
            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 font-body text-[12px] text-[var(--t2)]">
                <input
                  type="checkbox"
                  checked={selected.size === displayedResults.length}
                  onChange={toggleAll}
                  className="h-5 w-5 rounded border-[var(--bd)] accent-[var(--p)]"
                />
                전체 선택 ({selected.size} / {displayedResults.length})
              </label>
              <button
                onClick={() => void handleSave()}
                disabled={saving || selected.size === 0}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-4 font-display text-[13px] font-[700] text-[var(--on-p)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {saving ? '담는 중…' : `${selected.size}개 담기`}
              </button>
            </div>

            {/* 한 번에 담는 양 — Cognitive Load(작업기억 ~4항목) · 학습자의 선택권은 뺏지 않는다.
                기본이 "표시된 것 전부 선택" 이라 아무 생각 없이 18개가 복습 큐로 들어가던 것을,
                결정 앞에서 한 번 알려 준다 (Empathetic Feedback — 비난 없이 맥락만). */}
            {selected.size > CALM_BATCH && (
              <p className="mt-1 flex items-start gap-2 font-body text-[11px] leading-relaxed text-[var(--t2)]">
                <Sparkles size={11} className="mt-0.5 shrink-0 text-[var(--p)]/70" aria-hidden />
                <span>
                  한 번에 {selected.size}개를 담으면 며칠 뒤 복습이 몰려요.
                  {displayPct > 10 && (
                    <>
                      {' '}
                      <button
                        type="button"
                        onClick={() => setDisplayPct(10)}
                        className="font-display font-[700] text-[var(--p)] underline underline-offset-2 transition-colors duration-[var(--dur-normal)] hover:text-[var(--p-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                      >
                        상위 10%부터 시작
                      </button>
                      해도 좋아요.
                    </>
                  )}
                </span>
              </p>
            )}
          </div>

          <ul className="flex flex-col gap-2">
            {displayedResults.map((r) => {
              const isSelected = selected.has(r.word)
              const isExpanded = expandedWord === r.word
              const bd = r.score_breakdown
              const fam = familiar[r.word]
              // 추출 근거 — 인라인엔 눈에 띄는 것만(generic 난이도 제외, Calm UI), 전체는 expand.
              const reasons = buildReasons(r)
              const inlineReason = reasons.find((x) => x.key !== 'level')
              const rootHints = roots[(r.matched_via_surface ?? r.word).toLowerCase()] ?? []
              return (
                <li key={r.word}>
                  <article className={`rounded-[var(--r-md)] border bg-[var(--bg)] transition-all ${
                    fam === 'known' ? 'border-[var(--bd)] opacity-45' : isSelected ? 'border-[var(--p)] shadow-[var(--sh-sm)]' : 'border-[var(--bd)]'
                  }`}>
                    <div className="flex items-center gap-3 p-3">
                      {/* 체크박스 자체는 16px 이지만 label 이 44px 히트 영역을 만든다 */}
                      <label className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(r.word)}
                          className="h-5 w-5 rounded border-[var(--bd)] accent-[var(--p)]"
                          aria-label={`${r.word} 담기 선택`}
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-english text-[18px] font-[600] text-[var(--t1)]">{r.word}</span>
                          <span className="font-body text-[11px] text-[var(--t2)]">{r.pos}</span>
                          <span className="rounded-[var(--r-full)] bg-[var(--p-light)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--on-p-tint)]">V{r.v_level}</span>
                          {r.cefr_level && (
                            <span className="rounded-[var(--r-full)] bg-[var(--bg3)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--t2)]">{r.cefr_level}</span>
                          )}
                          {r.match_layer === 2 && r.matched_via_surface && r.matched_via_surface !== r.word && (
                            <span
                              title={`형태 "${r.word}" → 표제어 "${r.matched_via_surface}"`}
                              className="rounded-[var(--r-full)] bg-[#fdf4ff] px-2 py-1 font-display text-[10px] font-[700] text-[#a21caf] dark:bg-[#3b0764]/40 dark:text-[#f0abfc]"
                            >
                              → {r.matched_via_surface}
                            </span>
                          )}
                          {rootHints.length > 0 && (
                            <span
                              title={`어원: ${rootHints.map((h) => `${h.root}(${h.gloss})`).join(' · ')}`}
                              className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[#fdf6ec] px-2 py-1 font-display text-[10px] font-[700] text-[#9a6a1f] dark:bg-[#3b2a0a]/50 dark:text-[#e8c887]"
                            >
                              🏛 {rootHints[0]!.root}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate font-body text-[13px] text-[var(--t2)]">{r.meaning_ko ?? '—'}</p>
                        {inlineReason && (
                          <p className="mt-1 inline-flex max-w-full items-center gap-1 font-body text-[11px] italic text-[var(--t2)]">
                            <inlineReason.Icon size={11} className="shrink-0 text-[var(--p)]/70" />
                            <span className="truncate">{inlineReason.label}</span>
                          </p>
                        )}
                      </div>
                      {/* 추천 점수(composite)는 인라인에서 걷어냈다.
                          "-0.279" 같은 음수는 학습자에게 아무 뜻이 없고 "이 단어가 나쁜가"로
                          읽힌다 (Calm UI). 숫자가 필요한 사람을 위해 펼침 breakdown 에는 그대로 있다. */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => markFamiliarity(r, 'unknown')}
                          aria-label={`${r.word} 몰라요 — 학습 유지`}
                          aria-pressed={fam === 'unknown'}
                          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--r-full)] px-3 font-display text-[12px] font-[700] transition-colors duration-[var(--dur-normal)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] active:scale-95 ${
                            fam === 'unknown' ? 'bg-[var(--p)] text-white' : 'bg-[var(--bg2)] text-[var(--t2)] hover:bg-[var(--p-light)] hover:text-[var(--on-p-tint)]'
                          }`}
                        >
                          몰라요
                        </button>
                        <button
                          onClick={() => markFamiliarity(r, 'known')}
                          aria-label={`${r.word} 알아요 — 추출에서 제외`}
                          aria-pressed={fam === 'known'}
                          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--r-full)] px-3 font-display text-[12px] font-[700] transition-colors duration-[var(--dur-normal)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] active:scale-95 ${
                            fam === 'known' ? 'bg-[var(--t3)] text-white' : 'bg-[var(--bg2)] text-[var(--t2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]'
                          }`}
                        >
                          {fam === 'known' ? '알아요 ✓' : '알아요'}
                        </button>
                      </div>
                      <button
                        onClick={() => setExpandedWord(isExpanded ? null : r.word)}
                        aria-label={`${r.word} 추천 근거 ${isExpanded ? '접기' : '펼치기'}`}
                        aria-expanded={isExpanded}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--r-md)] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-[var(--bd)] bg-[var(--bg2)] p-4 font-body text-[11px]">
                        {/* 어원(root) 힌트 — 어근으로 계열 학습 (이중배당) */}
                        {rootHints.length > 0 && (
                          <p className="mb-3 inline-flex flex-wrap items-center gap-2 rounded-[var(--r-md)] border border-[#9a6a1f]/20 bg-[#fdf6ec]/60 px-3 py-2 text-[#9a6a1f] dark:bg-[#3b2a0a]/30 dark:text-[#e8c887]">
                            <span aria-hidden>🏛</span>
                            <span className="font-display font-[700]">어원</span>
                            <span className="font-body">
                              {rootHints.map((h) => `${h.root} (${h.gloss})`).join(' · ')}
                            </span>
                          </p>
                        )}
                        {/* 4단계 근거 카드 — 왜 이 단어를 추천했는지 사람 말투로 (기술 breakdown 위에) */}
                        {reasons.length > 0 && (
                          <div className="mb-3 rounded-[var(--r-md)] border border-[var(--p)]/20 bg-[var(--p-light)]/40 p-3">
                            <h4 className="mb-1.5 inline-flex items-center gap-1 font-display text-[10px] font-[700] uppercase tracking-wide text-[var(--p)]">
                              <Sparkles size={11} /> 왜 추천했어요?
                            </h4>
                            <ul className="flex flex-col gap-1">
                              {reasons.map((rs) => (
                                <li key={rs.key} className="inline-flex items-start gap-2 font-body text-[11px] text-[var(--t2)]">
                                  <rs.Icon size={12} className="mt-0.5 shrink-0 text-[var(--p)]" />
                                  <span>{rs.label}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(r.source_sentence ?? r.example_en) && (
                          <p className="mb-3 font-english text-[12px] italic text-[var(--t2)]">
                            &ldquo;{r.source_sentence ?? r.example_en}&rdquo;
                            {r.source_sentence && (
                              <span className="ml-1.5 rounded-[var(--r-full)] bg-[var(--p-light)] px-2 py-1 align-middle font-display text-[9px] font-[700] not-italic text-[var(--on-p-tint)]">
                                본문
                              </span>
                            )}
                          </p>
                        )}
                        <h4 className="mb-1 font-display text-[10px] font-[700] uppercase tracking-wide text-[var(--t2)]">
                          스코어 breakdown (composite = {r.composite_score.toFixed(4)})
                        </h4>
                        <p className="mb-2 font-mono text-[9px] text-[var(--t2)]">
                          {bd.reasoning}{bd.method ? ` · ${bd.method}` : ''}
                        </p>
                        <table className="w-full font-mono text-[10px]">
                          <tbody>
                            <ScoreRow label="Frequency boost (70%)" weight={bd.weights.frequency_boost} value={bd.frequency_boost} contribution={bd.weights.frequency_boost * bd.frequency_boost} />
                            <ScoreRow label="Track boost — csat/biz/acad max (30%)" weight={bd.weights.track_boost} value={bd.track_boost} contribution={bd.weights.track_boost * bd.track_boost} />
                            {bd.skill_penalty !== 0 && (
                              <ScoreRow label="Skill penalty (L4 + low V)" weight={1} value={bd.skill_penalty} contribution={bd.skill_penalty} />
                            )}
                          </tbody>
                        </table>
                        <div className="mt-3 flex flex-wrap gap-2 font-body text-[10px] text-[var(--t2)]">
                          <span>본인 V={bd.user_v_level}</span>
                          <span>threshold V≥{bd.v_threshold}</span>
                          {r.frequency_rank && <span>freq #{r.frequency_rank}</span>}
                          <span>skill L{r.skill_level}</span>
                          {r.track_levels && (
                            <span>
                              tracks: csat={r.track_levels.csat_korean ?? 0} · biz={r.track_levels.business_english ?? 0} · acad={r.track_levels.academic_english ?? 0}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

function MetaCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="font-display text-[9px] font-[700] uppercase tracking-wider text-[var(--t2)]">{label}</p>
      <p className={`font-display text-[16px] font-[800] tabular-nums ${accent ? 'text-[var(--p)]' : 'text-[var(--t1)]'}`}>
        {value}
      </p>
    </div>
  )
}

function ScoreRow({ label, weight, value, contribution }: {
  label: string; weight: number; value: number; contribution: number;
}) {
  const isPenalty = contribution < 0
  return (
    <tr className="border-t border-[var(--bd)]">
      <td className="py-1 pr-2 text-[var(--t2)]">{label}</td>
      <td className="py-1 pr-2 text-right text-[var(--t2)]">× {weight}</td>
      <td className="py-1 pr-2 text-right tabular-nums text-[var(--t1)]">{value.toFixed(4)}</td>
      <td className={`py-1 text-right tabular-nums ${isPenalty ? 'text-[var(--error-ink)]' : 'text-[var(--success)]'}`}>
        {isPenalty ? '' : '+'}{contribution.toFixed(4)}
      </td>
    </tr>
  )
}
