// apps/web/src/components/library/reader/ChapterLevelWords.tsx
// 라이브러리 도서 chapter — 이 학습자에게 맞춘 챕터 학습 단어 패널.
//
// v06.35 (ADR 0004 D7) — L2 개인화 전달로 전환.
//   이전: extract_vocabulary_for_user 직결. i+1 로직은 좋았지만 추출 파이프라인의
//         정제(노이즈·register 제외 · context_pos sense · 근거문장)를 우회했고,
//         무엇보다 **표시 전용**이라 학습자가 본 단어가 FSRS 큐로 이어지지 않았다.
//   현재: deliver_chapter_vocab(L2) 우선 — 정제된 후보 풀에서 기보유 제외 + i+1
//         재랭킹 + 챕터 길이 기반 분량(8~30). "담기" 로 vocabularies 에 연결된다.
//   폴백: 단어장이 아직 발행되지 않은 도서는 L2 가 빈 결과이므로 기존 경로를 쓴다.

'use client'

import {
  commitChapterVocab,
  deliverChapterVocab,
  getChapterWordsForUser,
  type DeliveryResult,
  type LeveledChapterResult,
} from '@/lib/library/chapter-words-queries'
import { createClient } from '@/lib/supabase/client'
import { Check, ChevronDown, Target } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface ChapterLevelWordsProps {
  libraryBookId: string
  chapterIdx: number
  /**
   * true 면 자체 카드(aside) 없이 본문만 낸다 — 이미 패널/다이얼로그 안에 놓일 때.
   * 실제 읽기 리더(`/text/[id]`)의 학습 인사이트 패널이 이 형태를 쓴다.
   */
  bare?: boolean
}

/** 선정 근거 문구 → 색 토큰. 색만으로 구분하지 않도록 문구를 항상 함께 노출한다. */
function reasonStyle(reason: string | null): { bg: string; text: string } {
  if (!reason) return { bg: 'var(--bg3)', text: 'var(--t3)' }
  if (reason.includes('i+1')) return { bg: 'var(--success-light)', text: 'var(--success)' }
  if (reason.includes('다지기') || reason.includes('견고화'))
    return { bg: 'var(--info-light)', text: 'var(--info)' }
  if (reason.includes('어려움') || reason.includes('도전'))
    return { bg: 'var(--warning-light)', text: 'var(--warning)' }
  return { bg: 'var(--bg3)', text: 'var(--t3)' }
}

type PanelState =
  | { kind: 'loading' }
  | { kind: 'anon' }
  | { kind: 'empty' }
  | { kind: 'delivered'; result: DeliveryResult }
  | { kind: 'legacy'; result: LeveledChapterResult }

export function ChapterLevelWords({
  libraryBookId,
  chapterIdx,
  bare = false,
}: ChapterLevelWordsProps) {
  const [state, setState] = useState<PanelState>({ kind: 'loading' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    setSaved(false)
    setSaveError(null)
    const client = createClient()
    ;(async () => {
      const {
        data: { user },
      } = await client.auth.getUser()
      if (cancelled) return
      if (!user) {
        setState({ kind: 'anon' })
        return
      }

      // L2 우선 — 정제된 후보 풀 + 근거문장 + 밀도 기반 분량
      const delivered = await deliverChapterVocab(client, libraryBookId, chapterIdx)
      if (cancelled) return
      if (delivered.words.length > 0) {
        setState({ kind: 'delivered', result: delivered })
        return
      }

      // 폴백 — 단어장 미발행 도서
      const legacy = await getChapterWordsForUser(
        client,
        libraryBookId,
        chapterIdx,
        user.id,
        'auto',
      )
      if (cancelled) return
      setState(legacy.words.length === 0 ? { kind: 'empty' } : { kind: 'legacy', result: legacy })
    })().catch(() => {
      if (!cancelled) setState({ kind: 'empty' })
    })
    return () => {
      cancelled = true
    }
  }, [libraryBookId, chapterIdx])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveError(null)
    try {
      // 담긴 **건수**를 확인하고 나서 성공을 표시한다. 낙관적으로 표시하면
      // 저장이 실패해도 학습자는 담긴 줄 알고 넘어간다 (초판에서 실제로 그랬다).
      const n = await commitChapterVocab(createClient(), libraryBookId, chapterIdx)
      if (n < 0) setSaveError('지금은 담지 못했어요. 잠시 후 다시 시도해 주세요.')
      else setSaved(true)
    } catch {
      setSaveError('지금은 담지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }, [libraryBookId, chapterIdx])

  const body = (
    <>
      {state.kind === 'loading' && (
        <p className="font-body text-[12px] text-[var(--t2)]">고르는 중…</p>
      )}

      {state.kind === 'anon' && (
        <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
          로그인하면 내 레벨에 맞춰 이 챕터의 학습 단어를 골라 드려요.
        </p>
      )}

      {state.kind === 'empty' && (
        <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
          이 챕터에는 새로 익힐 단어가 없어요. 이미 다 아는 단어들이네요.
        </p>
      )}

      {state.kind === 'delivered' && (
        <DeliveredBody
          result={state.result}
          saving={saving}
          saved={saved}
          saveError={saveError}
          onSave={handleSave}
        />
      )}

      {state.kind === 'legacy' && <LegacyBody result={state.result} />}
    </>
  )

  if (bare) {
    return (
      <section aria-label="이 챕터에서 익힐 단어">
        <h3 className="mb-3 flex items-center gap-2 font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
          <Target size={11} strokeWidth={2} aria-hidden />
          이 챕터에서 익힐 단어
        </h3>
        {body}
      </section>
    )
  }

  return (
    <aside
      className="mx-auto mt-8 max-w-2xl rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-5"
      aria-label="이 챕터에서 익힐 단어"
    >
      <header className="mb-3 flex items-center gap-2">
        <Target size={14} className="text-[var(--p)]" aria-hidden />
        <h2 className="font-display text-[13px] font-[700] text-[var(--t1)]">
          이 챕터에서 익힐 단어
        </h2>
      </header>
      {body}
    </aside>
  )
}

function DeliveredBody({
  result,
  saving,
  saved,
  saveError,
  onSave,
}: {
  result: DeliveryResult
  saving: boolean
  saved: boolean
  saveError: string | null
  onSave: () => void
}) {
  const [openWord, setOpenWord] = useState<string | null>(null)
  const m = result.meta

  return (
    <>
      {m && (
        <p className="mb-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-[var(--t2)]">
          <span>
            내 레벨{' '}
            <strong className="text-[var(--t2)]">
              {m.effectiveVLevel != null ? `V${m.effectiveVLevel}` : '—'}
            </strong>
          </span>
          <span>{result.words.length}개</span>
          {m.chapterWordCount != null && <span>이 챕터 {m.chapterWordCount.toLocaleString()}단어</span>}
          {m.poolSize > result.words.length && (
            <span className="text-[var(--t3)]">후보 {m.poolSize}개 중</span>
          )}
          {m.levelSource === 'book_v_level_fallback' && (
            <span className="text-[var(--t3)]">(진단 전 — 도서 난이도 기준)</span>
          )}
        </p>
      )}

      <ul role="list" className="flex flex-col divide-y divide-[var(--bd)]">
        {result.words.map((w) => {
          const rs = reasonStyle(w.reason)
          const open = openWord === w.word
          const hasContext = !!(w.sourceSentence ?? w.exampleEn)
          return (
            <li key={w.word} className="py-1">
              <button
                type="button"
                onClick={() => setOpenWord(open ? null : w.word)}
                disabled={!hasContext}
                aria-expanded={hasContext ? open : undefined}
                className="flex min-h-[44px] w-full items-baseline gap-3 rounded-[var(--r-sm)] px-1 text-left transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bg3)] disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className="w-28 shrink-0 font-display text-[14px] font-[700] text-[var(--t1)]">
                  {w.word}
                </span>
                {w.cefrLevel && (
                  <span className="shrink-0 font-mono text-[10px] text-[var(--t2)]">
                    {w.cefrLevel}
                    {w.vLevel != null && `·V${w.vLevel}`}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate font-body text-[12px] text-[var(--t2)]">
                  {w.meaning ?? '—'}
                </span>
                {w.reason && (
                  <span
                    className="shrink-0 rounded-[3px] px-2 py-1 font-body text-[9px] font-[600]"
                    style={{ backgroundColor: rs.bg, color: rs.text }}
                  >
                    {w.reason}
                  </span>
                )}
                {hasContext && (
                  <ChevronDown
                    size={12}
                    aria-hidden
                    className="shrink-0 text-[var(--t3)] transition-transform duration-[var(--dur-normal)] ease-[var(--ease)]"
                    style={{ transform: open ? 'rotate(180deg)' : undefined }}
                  />
                )}
              </button>

              {open && hasContext && (
                <p className="mb-2 ml-1 mr-1 rounded-[var(--r-sm)] bg-[var(--bg3)] px-3 py-2 font-body text-[12px] italic leading-relaxed text-[var(--t2)]">
                  {w.sourceSentence ?? w.exampleEn}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || saved}
          className="flex min-h-[44px] items-center gap-2 rounded-[var(--r-sm)] bg-[var(--p)] px-4 font-body text-[13px] font-[600] text-[var(--on-p)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:scale-[0.98] disabled:cursor-default disabled:opacity-50 disabled:active:scale-100"
        >
          {saved && <Check size={14} aria-hidden />}
          {saved ? '단어장에 담았어요' : saving ? '담는 중…' : '내 단어장에 담기'}
        </button>
        {saved && !saveError && (
          <span className="font-body text-[11px] text-[var(--t2)]">
            복습 일정은 알아서 잡아 둘게요.
          </span>
        )}
        {saveError && (
          <span role="status" className="font-body text-[11px] text-[var(--learn-error)]">
            {saveError}
          </span>
        )}
      </div>
    </>
  )
}

/** 단어장 미발행 도서 폴백 — 기존 i+1 추출 결과 (담기 없음: 근거문장·정제가 없다) */
function LegacyBody({ result }: { result: LeveledChapterResult }) {
  const m = result.meta
  return (
    <>
      {m && (
        <p className="mb-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-[var(--t2)]">
          <span>
            내 레벨{' '}
            <strong className="text-[var(--t2)]">
              {m.effectiveUserV != null ? `V${m.effectiveUserV}` : '—'}
            </strong>
          </span>
          <span>
            목표(i+1){' '}
            <strong className="text-[var(--p)]">
              {m.targetVLevel != null ? `V${m.targetVLevel}` : '—'}
            </strong>
          </span>
          <span>{result.words.length}개</span>
          <span className="text-[var(--t3)]">(단어장 준비 중인 도서)</span>
        </p>
      )}

      <ul role="list" className="flex flex-col divide-y divide-[var(--bd)]">
        {result.words.map((w) => {
          const rs = reasonStyle(w.reasoning)
          return (
            <li key={w.word} className="flex items-baseline gap-3 py-2">
              <span className="w-28 shrink-0 font-display text-[14px] font-[700] text-[var(--t1)]">
                {w.word}
              </span>
              {w.cefrLevel && (
                <span className="shrink-0 font-mono text-[10px] text-[var(--t2)]">
                  {w.cefrLevel}·V{w.vLevel}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate font-body text-[12px] text-[var(--t2)]">
                {w.meaning ?? '—'}
              </span>
              {w.reasoning && (
                <span
                  className="shrink-0 rounded-[3px] px-2 py-1 font-body text-[9px] font-[600]"
                  style={{ backgroundColor: rs.bg, color: rs.text }}
                >
                  {w.reasoning}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
