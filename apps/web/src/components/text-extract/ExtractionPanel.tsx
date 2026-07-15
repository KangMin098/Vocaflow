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

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Sparkles, TrendingUp, User, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { tokenizeText } from '@/lib/text-extract/tokenize'
import { buildSentenceIndex, firstSentenceContaining } from '@/lib/text-extract/source-sentence'

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

const SOURCE_LABEL: Record<string, string> = {
  user_diagnostic: '본인 진단',
  text_p75: '글 P75',
  auto_user_diagnostic: '자동 — 본인 진단',
  auto_text_p75_fallback: '자동 — 글 P75 (미진단)',
}

export function ExtractionPanel({ text, textId, defaultStrategy = 'user', onSaved }: ExtractionPanelProps) {
  const [strategy, setStrategy] = useState<LevelStrategy>(defaultStrategy)
  const [displayPct, setDisplayPct] = useState<DisplayPct>(25)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ExtractedWord[] | null>(null)
  // 알아요/몰라요 판정 (표면형 키). known → 학습셋 제외 + 향후 추출 제외.
  const [familiar, setFamiliar] = useState<Record<string, 'known' | 'unknown'>>({})
  const [meta, setMeta] = useState<ExtractedWord | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedWord, setExpandedWord] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState<number | null>(null)

  const tokenization = useMemo(() => tokenizeText(text), [text])

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
    const sentences = buildSentenceIndex(text)
    const rows = ((data ?? []) as ExtractedWord[]).map((r) => ({
      ...r,
      source_sentence: firstSentenceContaining(sentences, r.matched_via_surface, r.word),
    }))
    setResults(rows)
    setMeta(rows[0] ?? null)
    setSelected(new Set(rows.map((r) => r.word)))
    setLoading(false)

    // Option C — 미매칭 lemma 누적 (silent, best-effort)
    void supabase.rpc('record_pending_words', {
      p_user_id: userData.user.id,
      p_lemmas: tokenization.words.filter(
        (w) => !rows.some((r) => r.word === w || r.matched_via_surface === w),
      ),
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
    try {
      const supabase = createClient()
      await supabase.rpc('set_word_familiarity', {
        p_lemma: lemma,
        p_verdict: verdict,
        p_v_level: r.v_level,
      })
    } catch {
      /* 낙관적 UI — 실패해도 화면 상태 유지, 다음 세션에 재시도 */
    }
  }

  function toggleAll() {
    if (!displayedResults) return
    if (selected.size === displayedResults.length) setSelected(new Set())
    else setSelected(new Set(displayedResults.map((r) => r.word)))
  }

  // displayPct 변경 시 선택 set 을 displayed 범위로 재초기화 (newly hidden 자동 unselect)
  useEffect(() => {
    if (!displayedResults) return
    setSelected(new Set(displayedResults.map((r) => r.word)))
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
      <div className="mt-6 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-6 text-center font-body text-[13px] text-[var(--t3)]">
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
        <p className="mt-1 font-body text-[12px] text-[var(--t3)]">
          총 {tokenization.totalWords}어 · unique {tokenization.uniqueRaw}개 · stopword 제외 후{' '}
          <strong className="text-[var(--t1)]">{tokenization.uniqueFinal}개</strong> 분석 후보
        </p>
      </header>

      {/* Level strategy selector */}
      <div className="mb-4 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
        <p className="mb-2 font-display text-[11px] font-[700] uppercase tracking-wider text-[var(--t3)]">
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
              <span className="inline-flex items-center gap-1.5 font-display text-[13px] font-[600] text-[var(--t1)]">
                <User size={12} /> 본인 레벨 기준
              </span>
              <p className="mt-0.5 font-body text-[11px] text-[var(--t3)]">
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
              <span className="inline-flex items-center gap-1.5 font-display text-[13px] font-[600] text-[var(--t1)]">
                <FileText size={12} /> 글 레벨 기준 (P75)
              </span>
              <p className="mt-0.5 font-body text-[11px] text-[var(--t3)]">
                글의 75% 단어가 속한 V-Level. V11 archaic 제외.
              </p>
            </div>
          </label>
        </div>
        <button
          onClick={() => void handleExtract()}
          disabled={loading}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--r-md)] bg-[var(--p)] px-4 py-2 font-display text-[13px] font-[700] text-[var(--ti)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] active:scale-[0.97] disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? '분석 중…' : '추출 분석'}
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-[var(--r-md)] border border-[var(--bde)] bg-[var(--error-light)] p-3 font-body text-[12px] text-[var(--error)]">
          {error}
        </div>
      )}

      {savedCount !== null && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--success)]/30 bg-[var(--success-light)] p-3 font-body text-[12px] text-[#065f46]">
          <CheckCircle2 size={14} /> {savedCount}개 단어를 내 단어장에 추가했어요
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
          <p className="col-span-2 mt-1 font-body text-[10px] text-[var(--t3)] sm:col-span-4">
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
          className="mb-3 flex flex-wrap items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-2"
        >
          <span className="px-1 font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t3)]">
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
                    ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--p)]'
                    : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:bg-[var(--bg3)]'
                }`}
              >
                {c.label}
                <span className={`font-mono text-[10px] ${active ? 'text-[var(--p)]/70' : 'text-[var(--t3)]'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {results && results.length === 0 && (
        <p className="font-body text-[13px] text-[var(--t3)]">
          추출 가능한 단어가 없어요 — 모두 학습 중이거나 사전에 없는 단어들이에요.
        </p>
      )}

      {displayedResults && displayedResults.length > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between rounded-[var(--r-md)] bg-[var(--bg2)] p-3">
            <label className="inline-flex items-center gap-2 font-body text-[12px] text-[var(--t2)]">
              <input
                type="checkbox"
                checked={selected.size === displayedResults.length}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-[var(--bd)] accent-[var(--p)]"
              />
              전체 선택 ({selected.size} / {displayedResults.length})
            </label>
            <button
              onClick={() => void handleSave()}
              disabled={saving || selected.size === 0}
              className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] bg-[var(--p)] px-3 py-1.5 font-display text-[12px] font-[700] text-[var(--ti)] hover:bg-[var(--p-hover)] disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              {saving ? '저장 중…' : '내 단어장에 추가'}
            </button>
          </div>

          <ul className="flex flex-col gap-2">
            {displayedResults.map((r) => {
              const isSelected = selected.has(r.word)
              const isExpanded = expandedWord === r.word
              const bd = r.score_breakdown
              const fam = familiar[r.word]
              return (
                <li key={r.word}>
                  <article className={`rounded-[var(--r-md)] border bg-[var(--bg)] transition-all ${
                    fam === 'known' ? 'border-[var(--bd)] opacity-45' : isSelected ? 'border-[var(--p)] shadow-[var(--sh-sm)]' : 'border-[var(--bd)]'
                  }`}>
                    <div className="flex items-center gap-3 p-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(r.word)}
                        className="h-4 w-4 rounded border-[var(--bd)] accent-[var(--p)]"
                        aria-label={`${r.word} 선택`}
                      />
                      <span className="font-display text-[11px] font-[700] tabular-nums text-[var(--t3)]">#{r.rank}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-english text-[18px] font-[600] text-[var(--t1)]">{r.word}</span>
                          <span className="font-body text-[11px] text-[var(--t3)]">{r.pos}</span>
                          <span className="rounded-[var(--r-full)] bg-[var(--p-light)] px-1.5 py-0.5 font-display text-[10px] font-[700] text-[var(--p)]">V{r.v_level}</span>
                          {r.cefr_level && (
                            <span className="rounded-[var(--r-full)] bg-[var(--bg3)] px-1.5 py-0.5 font-display text-[10px] font-[700] text-[var(--t2)]">{r.cefr_level}</span>
                          )}
                          {r.match_layer === 2 && r.matched_via_surface && r.matched_via_surface !== r.word && (
                            <span
                              title={`형태 "${r.word}" → 표제어 "${r.matched_via_surface}"`}
                              className="rounded-[var(--r-full)] bg-[#fdf4ff] px-1.5 py-0.5 font-display text-[10px] font-[700] text-[#a21caf] dark:bg-[#3b0764]/40 dark:text-[#f0abfc]"
                            >
                              → {r.matched_via_surface}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate font-body text-[13px] text-[var(--t2)]">{r.meaning_ko ?? '—'}</p>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="inline-flex items-center gap-0.5 font-display text-[13px] font-[700] tabular-nums text-[var(--p)]">
                          <TrendingUp size={11} /> {r.composite_score.toFixed(3)}
                        </span>
                        <span className="font-body text-[10px] text-[var(--t3)]">{bd.reasoning}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => markFamiliarity(r, 'unknown')}
                          aria-label={`${r.word} 몰라요 — 학습 유지`}
                          className={`rounded-[var(--r-full)] px-2.5 py-1.5 font-display text-[11px] font-[700] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] active:scale-95 ${
                            fam === 'unknown' ? 'bg-[var(--p)] text-white' : 'bg-[var(--bg2)] text-[var(--t2)] hover:bg-[var(--p-light)] hover:text-[var(--p)]'
                          }`}
                        >
                          몰라요
                        </button>
                        <button
                          onClick={() => markFamiliarity(r, 'known')}
                          aria-label={`${r.word} 알아요 — 추출에서 제외`}
                          className={`rounded-[var(--r-full)] px-2.5 py-1.5 font-display text-[11px] font-[700] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] active:scale-95 ${
                            fam === 'known' ? 'bg-[var(--t3)] text-white' : 'bg-[var(--bg2)] text-[var(--t2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]'
                          }`}
                        >
                          {fam === 'known' ? '알아요 ✓' : '알아요'}
                        </button>
                      </div>
                      <button
                        onClick={() => setExpandedWord(isExpanded ? null : r.word)}
                        aria-label="평가 상세"
                        className="rounded p-1 text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-[var(--bd)] bg-[var(--bg2)] p-4 font-body text-[11px]">
                        {(r.source_sentence ?? r.example_en) && (
                          <p className="mb-3 font-english text-[12px] italic text-[var(--t2)]">
                            &ldquo;{r.source_sentence ?? r.example_en}&rdquo;
                            {r.source_sentence && (
                              <span className="ml-1.5 rounded-[var(--r-full)] bg-[var(--p-light)] px-1.5 py-0.5 align-middle font-display text-[9px] font-[700] not-italic text-[var(--p)]">
                                본문
                              </span>
                            )}
                          </p>
                        )}
                        <h4 className="mb-2 font-display text-[10px] font-[700] uppercase tracking-wide text-[var(--t3)]">
                          스코어 breakdown (composite = {r.composite_score.toFixed(4)})
                        </h4>
                        <table className="w-full font-mono text-[10px]">
                          <tbody>
                            <ScoreRow label="Frequency boost (70%)" weight={bd.weights.frequency_boost} value={bd.frequency_boost} contribution={bd.weights.frequency_boost * bd.frequency_boost} />
                            <ScoreRow label="Track boost — csat/biz/acad max (30%)" weight={bd.weights.track_boost} value={bd.track_boost} contribution={bd.weights.track_boost * bd.track_boost} />
                            {bd.skill_penalty !== 0 && (
                              <ScoreRow label="Skill penalty (L4 + low V)" weight={1} value={bd.skill_penalty} contribution={bd.skill_penalty} />
                            )}
                          </tbody>
                        </table>
                        <div className="mt-3 flex flex-wrap gap-2 font-body text-[10px] text-[var(--t3)]">
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
      <p className="font-display text-[9px] font-[700] uppercase tracking-wider text-[var(--t3)]">{label}</p>
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
      <td className="py-1 pr-2 text-right text-[var(--t3)]">× {weight}</td>
      <td className="py-1 pr-2 text-right tabular-nums text-[var(--t1)]">{value.toFixed(4)}</td>
      <td className={`py-1 text-right tabular-nums ${isPenalty ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>
        {isPenalty ? '' : '+'}{contribution.toFixed(4)}
      </td>
    </tr>
  )
}
