// apps/web/src/components/textfit/PublicFitClient.tsx
//
// 공개 지문 판정 입력면 — 로그인 없이 지문을 붙여넣으면 학년축 프로파일이 나온다.
//
// 왜 공개인가 (2026-08-16 진단): 10만 학습자로 가는 유일한 산술은 광고가 아니라
//   **교사 3,500명 × 학급 30명**(CAC 0)이다. 그런데 이 제품의 결정적 기능이 로그인 뒤에 있으면
//   교사는 가입 전에 가치를 볼 수 없고, 그 관문에서 채널이 끊긴다.
//   → 가장 강한 기능을 관문 **앞**에 둔다.
//
// 개인정보: 입력 지문을 저장하지 않는다. 조회는 공개 어휘 테이블(shared_words·lexicon_clean)뿐이고
//   쓰기 경로가 없다. 그래서 로그인·동의 없이 열어도 남는 것이 없다.

'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileText, RotateCcw } from 'lucide-react'

import { LevelProfilePanel } from '@/components/textfit/LevelProfilePanel'
import { tokenizeText } from '@/lib/text-extract/tokenize'
import { analyzePublicText, PUBLIC_TEXT_LIMIT } from '@/lib/textfit/public-queries'
import type { LevelProfile } from '@/lib/textfit/profile'

/** 분석을 시작하는 최소 길이 — 한두 문장으로는 커버리지가 통계적 의미를 갖지 못한다. */
const MIN_CHARS = 120

const SAMPLE = `Scientists have long assumed that memory decays at a predictable rate, but recent evidence
suggests the process is far more contingent than that. When learners encounter a word repeatedly in
meaningful contexts, the retrieval pathway is reinforced disproportionately compared with isolated
rehearsal. This has substantial implications for classroom instruction: allocating scarce time to
massed drilling may be considerably less efficient than distributing the same effort across weeks.
Nevertheless, the prevailing curriculum still favours concentrated review, largely because it is
easier to administer and to measure.`

export function PublicFitClient() {
  const [text, setText] = useState('')
  const [profile, setProfile] = useState<LevelProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const truncated = text.length > PUBLIC_TEXT_LIMIT
  const analysed = useMemo(() => text.slice(0, PUBLIC_TEXT_LIMIT), [text])
  const tokenization = useMemo(() => tokenizeText(analysed), [analysed])

  const tooShort = analysed.trim().length > 0 && analysed.trim().length < MIN_CHARS

  useEffect(() => {
    if (analysed.trim().length < MIN_CHARS || tokenization.uniqueFinal === 0) {
      setProfile(null)
      setError(null)
      return
    }

    let alive = true
    setLoading(true)
    // 입력 중 매 글자마다 조회하지 않는다 — 화면이 흔들리면 읽을 수 없다(Calm UI).
    const timer = setTimeout(() => {
      analyzePublicText(tokenization.counts, tokenization.totalWords)
        .then((p) => {
          if (!alive) return
          setProfile(p)
          setError(null)
        })
        .catch(() => {
          if (!alive) return
          setProfile(null)
          setError('지금은 분석이 어려워요. 잠시 뒤 다시 시도해 주세요.')
        })
        .finally(() => {
          if (alive) setLoading(false)
        })
    }, 700)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [tokenization, analysed])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <label
          htmlFor="fit-input"
          className="font-display text-[13px] font-[700] text-[var(--t1)]"
        >
          영어 지문 붙여넣기
        </label>
        <textarea
          id="fit-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          spellCheck={false}
          placeholder="교과서 본문, 모의고사 지문, 수업 프린트 — 무엇이든 괜찮아요. 저장하지 않습니다."
          className="w-full resize-y rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4 font-body text-[14px] leading-[1.7] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] placeholder:text-[var(--t3)] hover:border-[var(--t3)] focus:border-[var(--p)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1 motion-reduce:transition-none"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 font-mono text-[11.5px] tabular-nums text-[var(--t3)]">
            {analysed.length.toLocaleString()} / {PUBLIC_TEXT_LIMIT.toLocaleString()}자
            {tooShort && <span className="ml-2 font-body"> · {MIN_CHARS}자 이상이면 분석돼요</span>}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setText(SAMPLE)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3.5 font-display text-[13px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg3)] active:bg-[var(--bg-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
            >
              <FileText size={14} aria-hidden />
              예시 지문
            </button>
            <button
              type="button"
              onClick={() => setText('')}
              disabled={text.length === 0}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3.5 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg3)] active:bg-[var(--bg-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
            >
              <RotateCcw size={14} aria-hidden />
              지우기
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="m-0 rounded-[var(--r-md)] border border-[var(--memory-risk)] bg-[var(--bg2)] px-4 py-3 font-body text-[13.5px] text-[var(--memory-risk-ink)]"
        >
          {error}
        </p>
      )}

      <LevelProfilePanel profile={profile} loading={loading} truncated={truncated} />
    </div>
  )
}
