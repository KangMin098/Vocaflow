// apps/web/src/components/textfit/LevelProfilePanel.tsx
//
// 공개 레벨 프로파일 — 지문 하나가 **학년축 전체에서 어떻게 보이는지** 를 한 화면에.
//
// 왜 이 형태인가:
//   Lexile·ATOS 는 지문에 숫자 하나를 붙인다(독자 점수는 따로 잰다). 교사는 그 둘을 머릿속에서
//   맞춰야 한다. 여기서는 **곡선**을 준다 — "고1 88 · 고2 93 · 수능 96". 교사의 실제 질문
//   ("이거 몇 학년용이야?")에 화면이 직접 답한다.
//
// 정직성: 레벨 미상 질량(실측 8.4%)을 감추지 않는다. 각 줄에 하한~상한 밴드를 함께 그리고,
//   적정 레벨은 **낙관 상한이 아니라 중앙 추정**으로 판정한다.
//
// 규약: Memory Decay 4색만 사용(새 색 0) · 색 + 위치 + 글자 3중 · 44px 타깃 · 4상태 ·
//   motion-reduce · data-theme 대응(토큰 경유).

'use client'

import { ArrowRight, Check, Link2, Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'

import { track } from '@/lib/analytics/client'
import { BAND_COPY, BAND_THRESHOLDS } from '@/lib/textfit/coverage'
import { LEVEL_LABEL, profileHeadline } from '@/lib/textfit/profile'
import type { LevelProfile, LevelReading } from '@/lib/textfit/profile'
import type { FitBand } from '@/lib/textfit/types'

const BAND_DOT: Record<FitBand, string> = {
  flow: 'var(--memory-stable)',
  growth: 'var(--memory-stable)',
  study: 'var(--memory-shaky)',
  hard: 'var(--memory-shaky)',
  overload: 'var(--memory-risk)',
}

const BAND_INK: Record<FitBand, string> = {
  flow: 'var(--memory-stable-ink)',
  growth: 'var(--memory-stable-ink)',
  study: 'var(--memory-shaky-ink)',
  hard: 'var(--memory-shaky-ink)',
  overload: 'var(--memory-risk-ink)',
}

/** 사다리 눈금 시작점 — 70% 아래는 "지금은 아닌 글" 이라 잘게 나눌 이유가 없다. */
const SCALE_MIN = 0.7

function pos(coverage: number): number {
  return Math.min(100, Math.max(0, ((coverage - SCALE_MIN) / (1 - SCALE_MIN)) * 100))
}

const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`

interface Props {
  profile: LevelProfile | null
  loading: boolean
  /** 입력이 상한을 넘어 잘렸는가 — 잘렸으면 숫자가 전체 지문의 것이 아니다. */
  truncated?: boolean
  /**
   * 공유 링크로 들어와서 보고 있는 결과인가.
   *
   * 링크는 서명하지 않으므로 **위조 가능**하다. 그래서 남의 결과를 내 분석처럼 보여주지 않고
   * 출처를 명시한 뒤, 받은 사람이 자기 지문으로 다시 돌릴 수 있게 한다.
   */
  shared?: boolean
  /** 공유 버튼 — 없으면 버튼을 그리지 않는다(죽은 버튼 금지). */
  onShare?: () => void
  /** 방금 복사했는가 — 버튼 라벨을 잠깐 바꾼다. */
  shareCopied?: boolean
}

export function LevelProfilePanel({
  profile,
  loading,
  truncated = false,
  shared = false,
  onShare,
  shareCopied = false,
}: Props) {
  if (loading && !profile) {
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] px-5 py-4 font-body text-[14px] text-[var(--t2)]"
      >
        <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden />
        지문을 학년축에 올려보는 중…
      </p>
    )
  }

  if (!profile || profile.uniqueContentWords === 0) return null

  const fit = profile.readings.find((r) => r.level === profile.fitLevel) ?? null

  return (
    <section
      aria-label="레벨 프로파일"
      className="flex flex-col gap-6 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-5 md:p-6"
    >
      {/* ── 공유된 결과 출처 명시 ──
          링크는 서명하지 않는다. 남의 숫자를 내 분석처럼 보여주면 그때부터 이 화면은
          검증 도구가 아니라 주장 전달자가 된다. */}
      {shared && (
        <p className="m-0 flex items-start gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg3)] px-3.5 py-2.5 font-body text-[12.5px] leading-[1.6] text-[var(--t2)]">
          <Link2 size={14} aria-hidden className="mt-0.5 shrink-0 text-[var(--t3)]" />
          <span>
            <b>공유받은 결과</b>예요 — 다른 사람이 분석한 지문입니다. 아래에 직접 지문을 넣으면 내
            기준으로 다시 계산돼요.
          </span>
        </p>
      )}

      {/* ── 한 줄 답 ── */}
      <header className="flex flex-col gap-2">
        <p
          className="m-0 text-[17px] leading-[1.55] text-[var(--t1)] md:text-[19px]"
          style={{ fontFamily: 'Lora, serif', fontStyle: 'italic' }}
        >
          {profileHeadline(profile)}
        </p>
        <p className="m-0 font-body text-[13px] leading-[1.6] text-[var(--t3)]">
          러닝 워드 {profile.totalTokens.toLocaleString()}개 · 학습 대상 단어{' '}
          {profile.uniqueContentWords.toLocaleString()}종
          {profile.textVLevel !== null && <> · 어휘 난도 V{profile.textVLevel}</>}
          {truncated && <> · 앞부분만 분석했어요(입력이 길어요)</>}
        </p>
      </header>

      {/* ── 레벨 사다리 ── */}
      <div className="flex flex-col gap-1.5">
        {profile.readings.map((r) => (
          <LevelRow key={r.level} reading={r} isFit={fit?.level === r.level} />
        ))}

        {/* 눈금 — 색이 아니라 숫자로도 읽힌다 */}
        <div
          aria-hidden
          className="relative mt-1 hidden h-4 font-mono text-[10.5px] tabular-nums text-[var(--t3)] sm:block"
          style={{ marginLeft: '104px', marginRight: '58px' }}
        >
          {[BAND_THRESHOLDS.hard, BAND_THRESHOLDS.study, BAND_THRESHOLDS.growth, BAND_THRESHOLDS.flow].map(
            (t) => (
              <span
                key={t}
                className="absolute -translate-x-1/2"
                style={{ left: `${pos(t)}%` }}
              >
                {(t * 100).toFixed(0)}
              </span>
            ),
          )}
        </div>
      </div>

      {/* ── 정직성 고지 ── */}
      {profile.resolvedShare < 0.97 && (
        <p className="m-0 font-body text-[12.5px] leading-[1.65] text-[var(--t3)]">
          이 지문 단어의 <b className="tabular-nums">{pct(profile.resolvedShare)}</b>는 학습 어휘
          목록에서 레벨을 확인했어요. 나머지는 레벨을 알 수 없어서 각 줄의 <b>옅은 띠</b>로
          범위를 함께 표시했습니다 — 하나의 숫자로 단정하지 않습니다.
        </p>
      )}

      {/* ── 어려운 단어 ── */}
      {profile.hardestWords.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h3 className="m-0 font-display text-[13px] font-[700] text-[var(--t1)]">
            이 지문에서 가장 어려운 단어
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {profile.hardestWords.slice(0, 16).map((w) => (
              <li
                key={w.lemma}
                className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] py-1 pl-2.5 pr-2 font-body text-[13px] text-[var(--t1)]"
              >
                {w.surface}
                {/* 단일 텍스트 노드로 만든다 — `V{n}` 은 SSR 이 노드를 쪼개 `V<!-- -->10` 이 되고,
                    화면에서는 같아 보여도 복사·검색·스크린리더에서 갈라진다. */}
                <span className="font-mono text-[10.5px] tabular-nums text-[var(--t3)]">
                  {`V${w.vLevel}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 다음 단계 ── */}
      <div className="flex flex-col gap-3 border-t border-[var(--bd)] pt-5">
        <p className="m-0 font-body text-[13.5px] leading-[1.65] text-[var(--t2)]">
          여기까지는 <b>학년 기준</b>이에요. 로그인하면 <b>내가 실제로 아는 단어</b>를 기준으로 다시
          계산하고, 복습을 미뤘을 때 이 지문이 2주 뒤 얼마나 어려워지는지까지 보여드려요.
        </p>
        <div className="flex flex-wrap gap-2.5">
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[13.5px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg3)] active:bg-[var(--bg-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
            >
              {shareCopied ? (
                <>
                  <Check size={15} aria-hidden style={{ color: 'var(--memory-stable)' }} />
                  링크 복사됨
                </>
              ) : (
                <>
                  <Link2 size={15} aria-hidden />
                  결과 링크 복사
                </>
              )}
            </button>
          )}
          <Link
            href="/signup"
            // 공개 화면 → 제품으로 넘어가는 유일한 문. 이 클릭 수가 없으면
            // "교사가 와서 써 봤지만 가입은 안 했다" 와 "애초에 안 왔다" 를 구분할 수 없다.
            onClick={() => track({ name: 'fit_signup_clicked', props: {} })}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p)] px-4 font-display text-[13.5px] font-[600] text-[var(--bg)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:brightness-110 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
          >
            <Sparkles size={15} aria-hidden />내 기준으로 보기
          </Link>
          <Link
            href="/pricing"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[13.5px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg3)] active:bg-[var(--bg-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
          >
            요금제 보기
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}

/** 사다리 한 칸 — 학년 · 막대(범위 포함) · 퍼센트. */
function LevelRow({ reading, isFit }: { reading: LevelReading; isFit: boolean }) {
  const dot = BAND_DOT[reading.band]
  const ink = BAND_INK[reading.band]
  const copy = BAND_COPY[reading.band]

  const low = pos(reading.coverageLow)
  const high = pos(reading.coverageHigh)
  const mid = pos(reading.coverage)

  return (
    <div
      className={`flex items-center gap-3 rounded-[var(--r-md)] px-2 py-1.5 transition-colors duration-[var(--dur-normal)] motion-reduce:transition-none ${
        isFit ? 'bg-[var(--bg3)]' : ''
      }`}
    >
      {/* 학년 이름 — 색이 아니라 글자가 먼저다 */}
      <span
        className="w-[92px] shrink-0 font-display text-[12.5px] font-[600] leading-[1.35] text-[var(--t1)] sm:w-[104px] sm:text-[13px]"
        style={isFit ? { color: ink } : undefined}
      >
        {LEVEL_LABEL[reading.level]}
        {isFit && (
          <span className="ml-1 font-mono text-[10px] font-[500]" style={{ color: ink }}>
            적정
          </span>
        )}
      </span>

      {/* 막대 */}
      <div
        className="relative h-[22px] flex-1 overflow-hidden rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg3)]"
        role="img"
        aria-label={`${LEVEL_LABEL[reading.level]} 커버리지 ${pct(reading.coverage, 1)}, ${copy.label}. 범위 ${pct(reading.coverageLow)}에서 ${pct(reading.coverageHigh)}.`}
      >
        {/* 불확실 범위 — 옅은 띠 */}
        <span
          aria-hidden
          className="absolute top-[7px] h-2 rounded-[var(--r-full)] opacity-25"
          style={{ left: `${low}%`, width: `${Math.max(0, high - low)}%`, background: dot }}
        />
        {/* 중앙 추정까지의 채움 */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 opacity-[0.18]"
          style={{ width: `${mid}%`, background: dot }}
        />
        {/* 중앙 마커 */}
        <span
          aria-hidden
          className="absolute inset-y-[3px] w-[3px] -translate-x-px rounded-[var(--r-full)]"
          style={{ left: `${mid}%`, background: dot }}
        />
      </div>

      {/* 숫자 */}
      <span
        className="w-[50px] shrink-0 text-right font-display text-[13px] font-[700] tabular-nums sm:w-[58px] sm:text-[14px]"
        style={{ color: ink }}
      >
        {pct(reading.coverage, 1)}
      </span>
    </div>
  )
}
