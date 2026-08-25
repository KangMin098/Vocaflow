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
import {
  analyzePublicText,
  FitRateLimitError,
  PUBLIC_TEXT_LIMIT,
} from '@/lib/textfit/public-queries'
import { buildShareUrl, isShareable } from '@/lib/textfit/share'
import { track } from '@/lib/analytics/client'
import { resolvedDecile, sizeBucket } from '@/lib/analytics/events'
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

interface Props {
  /**
   * 공유 링크(`?r=`)로 들어왔을 때 서버가 미리 해독해 넘긴 결과.
   * 해독은 서버에서 한 번만 한다 — OG 메타(`generateMetadata`)와 화면이 같은 값을 써야
   * 링크 미리보기와 실제 화면이 갈라지지 않는다.
   */
  initialShared?: LevelProfile | null
}

export function PublicFitClient({ initialShared = null }: Props) {
  const [text, setText] = useState('')
  const [profile, setProfile] = useState<LevelProfile | null>(initialShared)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [wordsCopied, setWordsCopied] = useState(false)
  // 공유받은 결과를 보고 있는가 — 본인이 지문을 넣는 순간 해제된다.
  const [viewingShared, setViewingShared] = useState(initialShared !== null)

  // 퍼널 분모 — 이 화면에 몇 명이 왔는가. 공유 링크로 온 진입은 확산 계수의 분자다.
  useEffect(() => {
    track({ name: 'fit_viewed', props: { shared: initialShared !== null } })
    if (initialShared !== null) {
      track({ name: 'fit_share_opened', props: { valid: true } })
    }

    // 진입 1회만 — 의존성 없음이 의도다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const truncated = text.length > PUBLIC_TEXT_LIMIT
  const analysed = useMemo(() => text.slice(0, PUBLIC_TEXT_LIMIT), [text])
  const tokenization = useMemo(() => tokenizeText(analysed), [analysed])

  const tooShort = analysed.trim().length > 0 && analysed.trim().length < MIN_CHARS

  useEffect(() => {
    if (analysed.trim().length < MIN_CHARS || tokenization.uniqueFinal === 0) {
      // 공유받은 결과를 보고 있는 중이면 지우지 않는다 — 링크로 들어온 사람의 화면이
      // 입력을 시작하기도 전에 비어 버린다.
      if (!viewingShared) {
        setProfile(null)
        setError(null)
      }
      return
    }

    let alive = true
    // 입력이 바뀌면 이전 요청을 취소한다 — 늦게 온 옛 응답이 새 결과를 덮지 않게.
    const controller = new AbortController()
    setLoading(true)

    // 입력 중 매 글자마다 조회하지 않는다 — 화면이 흔들리면 읽을 수 없다(Calm UI).
    const timer = setTimeout(() => {
      analyzePublicText(tokenization.counts, tokenization.totalWords, controller.signal)
        .then((p) => {
          if (!alive) return
          setProfile(p)
          setError(null)
          // 내 지문으로 다시 계산됐으므로 더 이상 남의 결과가 아니다.
          setViewingShared(false)
          setCopied(false)

          // "실제로 써 봤다" — 지문은 보내지 않는다(버킷·레벨만).
          track({
            name: 'fit_analyzed',
            props: {
              fitLevel: p.fitLevel,
              sizeBucket: sizeBucket(p.totalTokens),
              resolvedDecile: resolvedDecile(p.resolvedShare),
            },
          })
        })
        .catch((err: unknown) => {
          if (!alive || (err instanceof DOMException && err.name === 'AbortError')) return
          setProfile(null)
          setError(
            err instanceof FitRateLimitError
              ? `요청이 너무 잦아요. ${err.retryAfterSeconds}초 뒤 다시 시도해 주세요.`
              : '지금은 분석이 어려워요. 잠시 뒤 다시 시도해 주세요.',
          )
        })
        .finally(() => {
          if (alive) setLoading(false)
        })
    }, 700)

    return () => {
      alive = false
      controller.abort()
      clearTimeout(timer)
    }
  }, [tokenization, analysed, viewingShared])

  /**
   * 어려운 단어를 **단어⇥뜻** 형식으로 클립보드에 담는다.
   *
   * 왜 이 형식인가: 탭 구분은 클래스카드·퀴즐렛·엑셀이 공통으로 받는 import 형식이다.
   * 우리는 아직 학급에 단어를 배달하지 못한다(`classes` 는 명부일 뿐 전달 경로가 없다).
   * 그렇다면 최소한 **교사가 이미 쓰는 도구에 물려줄** 형태로는 내주는 게 맞다 —
   * 그게 "수업 준비 30분을 30초로" 를 오늘 지킬 수 있는 유일한 방법이다.
   */
  async function handleCopyWords() {
    if (!profile || typeof window === 'undefined') return

    const rows = profile.hardestWords
      .filter((w) => w.vLevel !== null)
      // 뜻에 탭·줄바꿈이 들어가면 붙여넣는 쪽에서 **열과 행이 밀린다**(단어와 뜻이 어긋난 채
      // 학생에게 나간다). 구분자로 쓰는 문자는 값에서 공백으로 접는다.
      .map((w) => `${w.surface}\t${(w.meaningKo ?? '').replace(/[\t\r\n]+/g, ' ').trim()}`)
    if (rows.length === 0) return

    try {
      await navigator.clipboard.writeText(rows.join('\n'))
      setWordsCopied(true)
      window.setTimeout(() => setWordsCopied(false), 2400)
    } catch {
      setError('클립보드를 쓸 수 없어요. 단어를 직접 선택해 복사해 주세요.')
    }
  }

  /**
   * 결과 링크를 클립보드에 담는다.
   *
   * 지문은 담지 않는다 — `share.ts` 가 커버리지 숫자와 단어 목록만 인코딩한다.
   * 주소창도 함께 바꿔서(`replaceState`) 새로고침·북마크에도 결과가 남게 한다.
   */
  async function handleShare() {
    if (!isShareable(profile) || typeof window === 'undefined') return

    const url = buildShareUrl(window.location.origin, profile)
    // 확산의 시작점 — 이 수 대비 `fit_share_opened` 가 교사 채널의 확산 계수다.
    track({ name: 'fit_shared', props: { fitLevel: profile.fitLevel } })

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2400)
      window.history.replaceState(null, '', url)
    } catch {
      // 클립보드 권한이 없을 수 있다(비보안 컨텍스트·브라우저 정책).
      // 그때도 주소창은 바꿔 준다 — 사용자가 직접 복사할 수 있어야 한다.
      window.history.replaceState(null, '', url)
      setError('클립보드를 쓸 수 없어요. 주소창의 링크를 복사해 주세요.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
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
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[13px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg3)] active:bg-[var(--bg-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
            >
              <FileText size={14} aria-hidden />
              예시 지문
            </button>
            <button
              type="button"
              onClick={() => setText('')}
              disabled={text.length === 0}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg3)] active:bg-[var(--bg-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
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

      <LevelProfilePanel
        profile={profile}
        loading={loading}
        truncated={truncated}
        shared={viewingShared}
        onShare={isShareable(profile) ? handleShare : undefined}
        shareCopied={copied}
        onCopyWords={profile && profile.hardestWords.length > 0 ? handleCopyWords : undefined}
        wordsCopied={wordsCopied}
      />
    </div>
  )
}
