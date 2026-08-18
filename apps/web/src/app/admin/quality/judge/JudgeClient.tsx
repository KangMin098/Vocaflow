// apps/web/src/app/admin/quality/judge/JudgeClient.tsx
//
// 판정 하네스 클라이언트 — blind 절대판정 + 쌍대비교. 제출 후에만 시스템 선택(in-cap) 공개.
// blind 보존: get_judgment_sample 은 sort_order/in_cap 을 반환하지 않음. reveal 은 save RPC
//   반환값(서버가 SSoT 재조회로 계산)으로만 얻음 → 판정 중 확증편향 차단.

'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { Check, HelpCircle, Loader2, Scale, Sparkles, X } from 'lucide-react'
import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'

export interface BookOption {
  id: string
  title: string
  book_v_level: number | null
  chapter_count: number | null
}

export interface ArticleOption {
  id: string
  title: string
  register: string | null
  article_v_level: number | null
}

interface SampleWord {
  word: string
  lemma: string
  meaning_ko: string
  v_level: number | null
  pos: string | null
  first_sentence: string | null
}

type Verdict = 'valuable' | 'not_valuable' | 'uncertain'
type Mode = 'absolute' | 'pairwise'
type Phase = 'select' | 'judging' | 'revealed'

interface Reveal {
  in_cap: boolean
  sort_order_at: number
}

const REGISTER_LABEL: Record<string, string> = {
  expository: '설명',
  argumentative: '논증',
  narrative: '서사',
  news: '뉴스',
  reference: '참조',
}

export function JudgeClient({ books, articles }: { books: BookOption[]; articles: ArticleOption[] }) {
  const [kind, setKind] = useState<'book' | 'article'>('book')
  const [bookId, setBookId] = useState<string>(books[0]?.id ?? '')
  const [chapter, setChapter] = useState<number>(1)
  const [articleId, setArticleId] = useState<string>(articles[0]?.id ?? '')
  const [mode, setMode] = useState<Mode>('absolute')

  const [phase, setPhase] = useState<Phase>('select')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sample, setSample] = useState<SampleWord[]>([])
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({})
  const [pairChoices, setPairChoices] = useState<Record<number, 'a' | 'b'>>({})
  const [reveals, setReveals] = useState<Record<string, Reveal>>({})

  const selectedBook = books.find((b) => b.id === bookId)
  const sourceLabel =
    kind === 'book'
      ? `${selectedBook?.title ?? '—'} · Ch.${chapter}`
      : (articles.find((a) => a.id === articleId)?.title ?? '—')

  // 쌍대비교용 페어 (셔플된 sample 을 2개씩 묶음, 홀수 잔여는 제외)
  const pairs: [SampleWord, SampleWord][] = []
  for (let i = 0; i + 1 < sample.length; i += 2) pairs.push([sample[i], sample[i + 1]])

  async function loadSample() {
    setLoading(true)
    setError(null)
    try {
      const client = createClient() as unknown as SupabaseClient
      const { data, error: rpcErr } = await client.rpc('get_judgment_sample', {
        p_source_kind: kind,
        p_source_id: kind === 'book' ? bookId : articleId,
        p_chapter_idx: kind === 'book' ? chapter : null,
      })
      if (rpcErr) throw rpcErr
      const rows = (data ?? []) as SampleWord[]
      if (rows.length === 0) {
        setError('이 표본에서 추출 후보가 나오지 않았어요. 다른 챕터/아티클을 골라 주세요.')
        return
      }
      setSample(rows)
      setVerdicts({})
      setPairChoices({})
      setReveals({})
      setPhase('judging')
    } catch (e) {
      setError(e instanceof Error ? e.message : '표본을 불러오지 못했어요')
    } finally {
      setLoading(false)
    }
  }

  function setVerdict(word: string, v: Verdict) {
    setVerdicts((prev) => ({ ...prev, [word]: prev[word] === v ? 'not_valuable' : v }))
  }

  async function saveOne(
    client: SupabaseClient,
    word: string,
    verdict: Verdict,
    pairWord: string | null,
    pairWins: boolean | null,
  ): Promise<Reveal | null> {
    const { data, error: rpcErr } = await client.rpc('save_extraction_judgment', {
      p_source_kind: kind,
      p_source_id: kind === 'book' ? bookId : articleId,
      p_chapter_idx: kind === 'book' ? chapter : null,
      p_word: word,
      p_verdict: verdict,
      p_mode: mode,
      p_pair_word: pairWord,
      p_pair_wins: pairWins,
    })
    if (rpcErr) throw rpcErr
    const row = (data ?? [])[0] as Reveal | undefined
    return row ?? null
  }

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const client = createClient() as unknown as SupabaseClient
      const next: Record<string, Reveal> = {}

      if (mode === 'absolute') {
        for (const w of sample) {
          const v = verdicts[w.word] ?? 'not_valuable'
          const r = await saveOne(client, w.word, v, null, null)
          if (r) next[w.word] = r
        }
      } else {
        for (let i = 0; i < pairs.length; i++) {
          const [a, b] = pairs[i]
          const choice = pairChoices[i]
          if (!choice) continue
          const winner = choice === 'a' ? a : b
          const loser = choice === 'a' ? b : a
          const rw = await saveOne(client, winner.word, 'valuable', loser.word, true)
          const rl = await saveOne(client, loser.word, 'not_valuable', winner.word, false)
          if (rw) next[winner.word] = rw
          if (rl) next[loser.word] = rl
        }
      }
      setReveals(next)
      setPhase('revealed')
    } catch (e) {
      setError(e instanceof Error ? e.message : '판정을 저장하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setPhase('select')
    setSample([])
    setVerdicts({})
    setPairChoices({})
    setReveals({})
    setError(null)
  }

  const pairwiseAnswered = pairs.filter((_, i) => pairChoices[i]).length

  return (
    <div className="space-y-6">
      {/* ── 소스 선택 ── */}
      {phase === 'select' && (
        <section className="space-y-5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
          <div className="flex gap-2">
            {(['book', 'article'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-[var(--r-md)] border px-4 py-2 font-display text-[13px] font-[600] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] ${
                  kind === k
                    ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 text-[#8B5CF6]'
                    : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:text-[var(--t1)]'
                }`}
              >
                {k === 'book' ? '도서 챕터' : '아티클'}
              </button>
            ))}
          </div>

          {kind === 'book' ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex-1 min-w-[240px]">
                <span className="mb-1 block font-display text-[12px] font-[600] text-[var(--t2)]">도서</span>
                <select
                  value={bookId}
                  onChange={(e) => setBookId(e.target.value)}
                  className="w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-body text-[14px] text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
                >
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} (V{b.book_v_level ?? '?'} · {b.chapter_count}ch)
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block font-display text-[12px] font-[600] text-[var(--t2)]">챕터</span>
                <input
                  type="number"
                  min={1}
                  max={selectedBook?.chapter_count ?? 999}
                  value={chapter}
                  onChange={(e) => setChapter(Math.max(1, Number(e.target.value) || 1))}
                  className="w-24 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-body text-[14px] text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
                />
              </label>
            </div>
          ) : (
            <label className="block">
              <span className="mb-1 block font-display text-[12px] font-[600] text-[var(--t2)]">아티클</span>
              <select
                value={articleId}
                onChange={(e) => setArticleId(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-body text-[14px] text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
              >
                {articles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title.slice(0, 70)} ({REGISTER_LABEL[a.register ?? ''] ?? a.register ?? '?'} · V
                    {a.article_v_level ?? '?'})
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-[var(--bd)] pt-4">
            <div className="flex gap-2">
              {(['absolute', 'pairwise'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-[var(--r-full)] border px-3 py-1 font-body text-[12px] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] ${
                    mode === m
                      ? 'border-[#8B5CF6]/50 bg-[#8B5CF6]/10 text-[#8B5CF6]'
                      : 'border-[var(--bd)] text-[var(--t2)] hover:text-[var(--t2)]'
                  }`}
                >
                  {m === 'absolute' ? '절대 판정' : '쌍대 비교'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={loadSample}
              disabled={loading || (kind === 'book' ? !bookId : !articleId)}
              className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] bg-[#8B5CF6] px-4 py-2 font-display text-[13px] font-[600] text-white transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[#7c4ff0] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              표본 불러오기
            </button>
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-[var(--r-md)] border border-[#9C3A30]/30 bg-[#9C3A30]/8 px-4 py-3 font-body text-[13px] text-[#9C3A30]">
          {error}
        </p>
      )}

      {/* ── 판정 ── */}
      {phase === 'judging' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-body text-[13px] text-[var(--t2)]">
              <span className="font-mono text-[var(--t2)]">{sourceLabel}</span> — 이 챕터를 공부하는
              학습자에게 <strong className="text-[var(--t1)]">가치 있는 단어</strong>를 고르세요.
            </p>
            <span className="rounded-[var(--r-full)] bg-[var(--bg3)] px-2.5 py-1 font-mono text-[11px] text-[var(--t2)]">
              {mode === 'absolute' ? '절대 판정' : '쌍대 비교'}
            </span>
          </div>

          {mode === 'absolute' ? (
            <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {sample.map((w) => {
                const v = verdicts[w.word] ?? 'not_valuable'
                return (
                  <li
                    key={w.word}
                    className={`rounded-[var(--r-md)] border bg-[var(--bg2)] p-3.5 transition-all duration-[var(--dur-normal)] ease-[var(--ease)] ${
                      v === 'valuable'
                        ? 'border-[#2E7D5A]/50 bg-[#2E7D5A]/6'
                        : v === 'uncertain'
                          ? 'border-[#B5803A]/40'
                          : 'border-[var(--bd)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display text-[15px] font-[700] text-[var(--t1)]">{w.word}</p>
                        <p className="font-body text-[13px] text-[var(--t2)]">{w.meaning_ko}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-[var(--t2)]">
                          {w.pos} · V{w.v_level}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          aria-pressed={v === 'valuable'}
                          onClick={() => setVerdict(w.word, 'valuable')}
                          title="가치 있음"
                          className={`grid h-8 w-8 place-items-center rounded-[var(--r-sm)] border transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D5A] ${
                            v === 'valuable'
                              ? 'border-[#2E7D5A] bg-[#2E7D5A] text-white'
                              : 'border-[var(--bd)] text-[var(--t2)] hover:border-[#2E7D5A]/50 hover:text-[#2E7D5A]'
                          }`}
                        >
                          <Check size={15} />
                        </button>
                        <button
                          type="button"
                          aria-pressed={v === 'uncertain'}
                          onClick={() => setVerdict(w.word, 'uncertain')}
                          title="애매함"
                          className={`grid h-8 w-8 place-items-center rounded-[var(--r-sm)] border transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5803A] ${
                            v === 'uncertain'
                              ? 'border-[#B5803A] bg-[#B5803A] text-white'
                              : 'border-[var(--bd)] text-[var(--t2)] hover:border-[#B5803A]/50 hover:text-[#B5803A]'
                          }`}
                        >
                          <HelpCircle size={15} />
                        </button>
                      </div>
                    </div>
                    {w.first_sentence && (
                      <p className="mt-2 border-t border-[var(--bd)] pt-2 font-body text-[12px] italic leading-[1.5] text-[var(--t2)]">
                        “{w.first_sentence}”
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <ul className="space-y-2.5">
              {pairs.map(([a, b], i) => (
                <li key={a.word + b.word} className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
                  <p className="mb-2 text-center font-body text-[12px] text-[var(--t2)]">
                    이 챕터에 더 가치 있는 쪽은?
                  </p>
                  <div className="flex items-stretch gap-2">
                    {(['a', 'b'] as const).map((side) => {
                      const w = side === 'a' ? a : b
                      const chosen = pairChoices[i] === side
                      return (
                        <button
                          key={side}
                          type="button"
                          onClick={() => setPairChoices((p) => ({ ...p, [i]: side }))}
                          className={`flex-1 rounded-[var(--r-sm)] border p-2.5 text-left transition-all duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] ${
                            chosen
                              ? 'border-[#8B5CF6] bg-[#8B5CF6]/10'
                              : 'border-[var(--bd)] hover:border-[#8B5CF6]/40'
                          }`}
                        >
                          <span className="font-display text-[14px] font-[700] text-[var(--t1)]">{w.word}</span>
                          <span className="block font-body text-[12px] text-[var(--t2)]">{w.meaning_ko}</span>
                        </button>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between border-t border-[var(--bd)] pt-4">
            <button
              type="button"
              onClick={reset}
              className="font-body text-[13px] text-[var(--t2)] underline-offset-2 hover:text-[var(--t2)] hover:underline"
            >
              다른 표본
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving || (mode === 'pairwise' && pairwiseAnswered === 0)}
              className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] bg-[#8B5CF6] px-5 py-2 font-display text-[13px] font-[600] text-white transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[#7c4ff0] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Scale size={14} />}
              판정 제출
            </button>
          </div>
        </section>
      )}

      {/* ── 공개 (reveal) ── */}
      {phase === 'revealed' && <RevealPanel sample={sample} verdicts={verdicts} reveals={reveals} onReset={reset} sourceLabel={sourceLabel} />}
    </div>
  )
}

function RevealPanel({
  sample,
  verdicts,
  reveals,
  onReset,
  sourceLabel,
}: {
  sample: SampleWord[]
  verdicts: Record<string, Verdict>
  reveals: Record<string, Reveal>
  onReset: () => void
  sourceLabel: string
}) {
  const judged = sample.filter((w) => reveals[w.word])
  const inCap = judged.filter((w) => reveals[w.word].in_cap)
  const youValuable = judged.filter((w) => (verdicts[w.word] ?? 'not_valuable') === 'valuable')
  const agree = youValuable.filter((w) => reveals[w.word].in_cap).length
  const precision = youValuable.length ? Math.round((agree / youValuable.length) * 100) : null
  const recall = inCap.length ? Math.round((agree / inCap.length) * 100) : null

  const sorted = [...judged].sort((a, b) => reveals[a.word].sort_order_at - reveals[b.word].sort_order_at)

  return (
    <section className="space-y-4">
      <div className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
        <p className="font-body text-[13px] text-[var(--t2)]">
          <span className="font-mono text-[var(--t2)]">{sourceLabel}</span> — 판정 저장 완료. 시스템
          선택(in-cap)과 비교했어요.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat label="precision" hint="내가 고른 것 중 in-cap" value={precision === null ? '—' : `${precision}%`} />
          <Stat label="recall" hint="in-cap 중 내가 고름" value={recall === null ? '—' : `${recall}%`} />
          <Stat label="라벨" hint="이번 회차 저장" value={String(judged.length)} />
        </div>
      </div>

      <ul className="space-y-1.5">
        {sorted.map((w) => {
          const r = reveals[w.word]
          const v = verdicts[w.word] ?? 'not_valuable'
          const youKept = v === 'valuable'
          const match = youKept === r.in_cap
          return (
            <li
              key={w.word}
              className="flex items-center justify-between gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3.5 py-2"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full ${
                    match ? 'bg-[#2E7D5A]/15 text-[#2E7D5A]' : 'bg-[#B5803A]/15 text-[#B5803A]'
                  }`}
                >
                  {match ? <Check size={12} /> : <X size={12} />}
                </span>
                <span className="font-display text-[14px] font-[600] text-[var(--t1)]">{w.word}</span>
                <span className="font-body text-[12px] text-[var(--t2)]">{w.meaning_ko}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2 font-mono text-[10px]">
                <span className={`rounded-[var(--r-sm)] px-1.5 py-0.5 ${youKept ? 'bg-[#2E7D5A]/12 text-[#2E7D5A]' : 'bg-[var(--bg3)] text-[var(--t2)]'}`}>
                  나: {youKept ? '가치' : v === 'uncertain' ? '애매' : '제외'}
                </span>
                <span className={`rounded-[var(--r-sm)] px-1.5 py-0.5 ${r.in_cap ? 'bg-[#8B5CF6]/12 text-[#8B5CF6]' : 'bg-[var(--bg3)] text-[var(--t2)]'}`}>
                  시스템: {r.in_cap ? 'in-cap' : `#${r.sort_order_at}`}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[#8B5CF6]/40 bg-[#8B5CF6]/8 px-4 py-2 font-display text-[13px] font-[600] text-[#8B5CF6] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[#8B5CF6]/15 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
        >
          <Sparkles size={14} /> 다음 표본 판정
        </button>
      </div>
    </section>
  )
}

function Stat({ label, hint, value }: { label: string; hint: string; value: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3 text-center">
      <p className="font-display text-[24px] font-[800] tracking-tight text-[var(--t1)]">{value}</p>
      <p className="font-mono text-[11px] font-[700] uppercase tracking-[0.06em] text-[#8B5CF6]">{label}</p>
      <p className="mt-0.5 font-body text-[10px] text-[var(--t2)]">{hint}</p>
    </div>
  )
}
