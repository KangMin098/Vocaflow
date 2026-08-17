// apps/web/src/components/textfit/TextFitVerdict.tsx
//
// 지문 적합도 판정 카드 — "이 글, 지금 나에게 맞나?" 에 한 화면으로 답한다.
//
// 이 화면이 경쟁 도구와 다른 지점 딱 하나:
//   Lexile·ATOS 는 **글**을 재고, LingQ 의 known-word 카운트는 **이진값**이다. 둘 다 정적이다.
//   여기서는 커버리지가 학습자의 기억 상태에서 나오므로 **복습을 미루면 눈금이 왼쪽으로 간다**.
//   그 미래 위치를 고스트 마커로 같이 그린다 — 숫자로 겁주지 않고 위치로 보여준다
//   (CLAUDE.md §Implicit Progress · §Calm UI).
//
// 접근성: 색만으로 대역을 말하지 않는다(라벨 + 점 + 문장 병행). 스케일은 role="img" 로
//   전체 문장을 읽어 준다. 펼침/담기 버튼은 44px 타깃 + 4상태.

'use client'

import { ChevronDown, ChevronUp, Clock3, Sparkles, Target, TrendingDown } from 'lucide-react'
import { useId, useState } from 'react'

import { BAND_COPY, BAND_THRESHOLDS, FORECAST_DAYS, SOURCE_COPY } from '@/lib/textfit/coverage'
import type { FitBand, KnownSource, TextFitReport } from '@/lib/textfit/types'

/** 대역 → Memory Decay 토큰. 4색 규약을 그대로 재사용한다(새 색을 만들지 않는다). */
const BAND_TOKEN: Record<FitBand, { ink: string; dot: string }> = {
  flow: { ink: 'var(--memory-stable-ink)', dot: 'var(--memory-stable)' },
  growth: { ink: 'var(--memory-stable-ink)', dot: 'var(--memory-stable)' },
  study: { ink: 'var(--memory-shaky-ink)', dot: 'var(--memory-shaky)' },
  hard: { ink: 'var(--memory-shaky-ink)', dot: 'var(--memory-shaky)' },
  overload: { ink: 'var(--memory-risk-ink)', dot: 'var(--memory-risk)' },
}

/** 스케일 시작점 — 80% 아래는 어차피 "지금은 아닌 글" 이라 눈금을 잘게 나눌 이유가 없다. */
const SCALE_MIN = 0.8

/** 눈금 — csat_stage_gates 의 coverage 임계와 같은 값. */
const TICKS = [
  { v: BAND_THRESHOLDS.hard, label: '85' },
  { v: BAND_THRESHOLDS.study, label: '90' },
  { v: BAND_THRESHOLDS.growth, label: '95' },
  { v: BAND_THRESHOLDS.flow, label: '98' },
] as const

/** 커버리지를 스케일 위 0~100 위치로. 하한 아래는 0 에 붙인다. */
function scalePos(coverage: number): number {
  const p = ((coverage - SCALE_MIN) / (1 - SCALE_MIN)) * 100
  return Math.min(100, Math.max(0, p))
}

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`

interface Props {
  report: TextFitReport
  /** 처방 단어를 단어장으로 보낼 때. 없으면 처방은 읽기 전용으로만 보인다. */
  onCollectWords?: (lemmas: string[]) => void
  /** 진단이 없을 때 안내를 눌렀을 경우. */
  onDiagnose?: () => void
}

export function TextFitVerdict({ report, onCollectWords, onDiagnose }: Props) {
  const [open, setOpen] = useState(false)
  const detailId = useId()

  const copy = BAND_COPY[report.band]
  const token = BAND_TOKEN[report.band]

  const now = scalePos(report.coverage)
  const future = scalePos(report.coverageIn14Days)
  const decay = report.coverage - report.coverageIn14Days
  // 0.5%p 미만의 감쇠는 눈금에서 구분되지 않는다 — 없는 변화를 그리지 않는다.
  const showForecast = decay >= 0.005

  const low = scalePos(report.coverageLow)
  const high = scalePos(report.coverageHigh)
  // 추정 비중이 크면 점이 아니라 범위로 보여준다. 단일 숫자는 있지도 않은 정밀도를 주장한다.
  const showRange = report.confidence < 0.85 && high - low > 1

  // 학습했다가 잊은 단어 — 복습 한 번이면 커버리지가 돌아온다(가장 값싼 회복분).
  const recoverable = report.fading.length
  // 그중 **아직 남아 있어서 앞으로 더 떨어질** 단어 — 이미 0 인 것은 예보의 원인이 아니다.
  const decaying = report.fading.filter((f) => f.weight > 0).length

  const p95 = report.prescriptions.find((p) => p.target === 0.95)
  const p98 = report.prescriptions.find((p) => p.target === 0.98)
  const active = p95 && p95.wordsNeeded > 0 ? p95 : p98 && p98.wordsNeeded > 0 ? p98 : null

  return (
    <section
      aria-label="지문 적합도 판정"
      className="flex flex-col gap-[18px] rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-5 transition-colors duration-[var(--dur-normal)]"
    >
      {/* ── 판정 한 줄 ── */}
      <header className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className="inline-flex items-center gap-[7px] rounded-[var(--r-full)] border bg-[var(--bg3)] px-[11px] py-[5px] font-display text-[13px] font-[700] leading-[1.3]"
            style={{ borderColor: token.dot, color: token.ink }}
          >
            <span
              aria-hidden
              className="h-[7px] w-[7px] rounded-full"
              style={{ background: token.dot }}
            />
            {copy.label}
          </span>

          <span className="font-display text-[28px] font-[700] tabular-nums tracking-[-0.02em] text-[var(--t1)]">
            {pct(report.coverage)}
          </span>

          {showRange && (
            <span className="font-body text-[12.5px] tabular-nums text-[var(--t3)]">
              ({pct(report.coverageLow, 0)}–{pct(report.coverageHigh, 0)} 사이)
            </span>
          )}
        </div>

        {/* Empathetic Feedback — 압박이 아니라 다음 행동. Lora italic 사람 말투. */}
        <p
          className="m-0 text-[15px] italic leading-[1.6] text-[var(--t2)]"
          style={{ fontFamily: 'Lora, serif' }}
        >
          {copy.verdict} {copy.action}
        </p>
      </header>

      {/* ── 대역 스케일 ── */}
      <div
        role="img"
        aria-label={
          `어휘 커버리지 ${pct(report.coverage)}, ${copy.label} 구간.` +
          (showForecast ? ` 복습하지 않으면 ${FORECAST_DAYS}일 뒤 ${pct(report.coverageIn14Days)}.` : '')
        }
        className="flex flex-col gap-[7px]"
      >
        <div className="relative h-[30px] overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg3)]">
          {/* 대역 경계 눈금 */}
          {TICKS.map((t) => (
            <span
              key={t.label}
              aria-hidden
              className="absolute inset-y-0 w-px bg-[var(--bd)]"
              style={{ left: `${scalePos(t.v)}%` }}
            />
          ))}

          {/* 14일 뒤 고스트 — 이 제품에만 있는 눈금. 지금 위치에서 여기까지 내려간다. */}
          {showForecast && (
            <>
              <span
                aria-hidden
                className="absolute top-[9px] h-3 opacity-20"
                style={{
                  left: `${future}%`,
                  width: `${Math.max(0, now - future)}%`,
                  background: 'var(--memory-shaky)',
                }}
              />
              <span
                aria-hidden
                className="absolute inset-y-[5px] w-0.5 opacity-60"
                style={{ left: `${future}%`, background: 'var(--memory-shaky)' }}
              />
            </>
          )}

          {/* 신뢰 구간 — 추정에 기댄 만큼 넓다 */}
          {showRange && (
            <span
              aria-hidden
              className="absolute top-[11px] h-2 rounded-[var(--r-full)] opacity-25"
              style={{ left: `${low}%`, width: `${high - low}%`, background: token.dot }}
            />
          )}

          {/* 현재 위치 */}
          <span
            aria-hidden
            className="absolute inset-y-[3px] w-[3px] -translate-x-px rounded-[var(--r-full)] transition-[left] duration-[var(--dur-normal)] ease-[var(--ease)] motion-reduce:transition-none"
            style={{ left: `${now}%`, background: token.dot }}
          />
        </div>

        <div aria-hidden className="relative h-3.5 font-mono text-[10.5px] tabular-nums text-[var(--t3)]">
          {TICKS.map((t) => (
            <span
              key={t.label}
              className="absolute -translate-x-1/2"
              style={{ left: `${scalePos(t.v)}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── 미지어 / 잊은 단어 구분 ──
          커버리지 기여는 둘 다 0 이지만 학습자에게는 전혀 다른 단어다.
          하나는 처음부터 배워야 하고, 다른 하나는 복습 한 번이면 돌아온다. */}
      {(report.unknown.length > 0 || recoverable > 0) && (
        <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-body text-[13.5px] leading-[1.6] text-[var(--t2)]">
          {report.unknown.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--memory-new)' }}
              />
              처음 보는 단어 <b className="tabular-nums">{report.unknown.length}개</b>
            </span>
          )}
          {recoverable > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--memory-shaky)' }}
              />
              복습하면 돌아올 단어 <b className="tabular-nums">{recoverable}개</b>
            </span>
          )}
        </p>
      )}

      {/* ── 감쇠 예보 ── */}
      {showForecast && (
        <p className="m-0 flex items-start gap-2 font-body text-[13.5px] leading-[1.6] text-[var(--t2)]">
          <TrendingDown
            size={16}
            aria-hidden
            className="mt-0.5 shrink-0 text-[var(--memory-shaky)]"
          />
          <span>
            복습하지 않으면 {FORECAST_DAYS}일 뒤{' '}
            <b className="tabular-nums">{pct(report.coverageIn14Days)}</b>
            {decaying > 0 && <> — 지금 흔들리는 단어 {decaying}개 때문이에요.</>}
          </span>
        </p>
      )}

      {/* ── 처방 ── */}
      {active && active.reachable && (
        <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg3)] px-4 py-3.5">
          <p className="m-0 flex items-center gap-2 font-body text-[14px] text-[var(--t1)]">
            <Target size={16} aria-hidden className="shrink-0 text-[var(--p)]" />
            <span>
              <b className="tabular-nums">{active.wordsNeeded}개</b>만 익히면{' '}
              <b className="tabular-nums">{pct(active.projectedCoverage, 0)}</b>
              {active.target >= BAND_THRESHOLDS.flow ? ' — 사전 없이 읽혀요' : ' — 편하게 읽히는 구간'}
            </span>
          </p>

          {onCollectWords && (
            <button
              type="button"
              onClick={() => onCollectWords(active.words.map((w) => w.lemma))}
              className="inline-flex min-h-[44px] items-center gap-[7px] rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p)] px-4 font-display text-[13.5px] font-[600] text-[var(--bg)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:brightness-110 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              <Sparkles size={15} aria-hidden />
              단어장에 담기
            </button>
          )}
        </div>
      )}

      {/* ── 진단 유도 (추정에 기대고 있을 때만) ── */}
      {!report.isDiagnosed && (
        <p className="m-0 font-body text-[13px] leading-[1.6] text-[var(--t3)]">
          아직 레벨 진단 전이라 이 숫자는 글 자체의 난이도에 가까워요.
          {onDiagnose && (
            <>
              {' '}
              <button
                type="button"
                onClick={onDiagnose}
                className="border-b border-[var(--p)] text-[var(--p)] transition-opacity duration-[var(--dur-normal)] hover:opacity-75 active:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
              >
                5분 진단
              </button>
              을 마치면 내 기준으로 다시 계산돼요.
            </>
          )}
        </p>
      )}

      {/* ── 근거 (Progressive Disclosure) ── */}
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={detailId}
          className="inline-flex min-h-[44px] items-center gap-1.5 font-body text-[13px] text-[var(--t3)] transition-colors duration-[var(--dur-normal)] hover:text-[var(--t1)] active:text-[var(--p)] focus-visible:rounded-[2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--p)] motion-reduce:transition-none"
        >
          {open ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}이 숫자가
          나온 근거
        </button>

        {open && (
          <div
            id={detailId}
            className="mt-3 flex flex-col gap-3 font-body text-[13px] leading-[1.7] text-[var(--t2)]"
          >
            <dl className="m-0 grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 gap-y-1.5">
              {(Object.entries(report.breakdown) as [KnownSource, number][])
                .filter(([, n]) => n > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([source, n]) => (
                  <BreakdownRow
                    key={source}
                    label={SOURCE_COPY[source]}
                    n={n}
                    total={report.totalTokens}
                  />
                ))}
            </dl>

            <p className="m-0 text-[var(--t3)]">
              러닝 워드 {report.totalTokens.toLocaleString()}개 · 학습 대상 단어{' '}
              {report.uniqueContentWords.toLocaleString()}종
              {report.resolutionMode === 'exact_match_fallback' && (
                <> · 굴절형 해석 미가동 상태라 실제보다 낮게 잡혔을 수 있어요</>
              )}
            </p>

            <p className="m-0 flex items-start gap-[7px] text-[var(--t3)]">
              <Clock3 size={14} aria-hidden className="mt-[3px] shrink-0" />
              <span>
                기준선 98%·95%는 Hu &amp; Nation(2000)의 읽기 이해 임계에서 왔어요. 이후 재현
                연구(Kremmel 외, 2023)는 90~98% 사이 차이가 크지 않다고 보고해서, 하나의 절벽이 아니라
                구간으로 보여드려요.
              </span>
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

/** 근거 한 줄 — 라벨 · 막대 · 비율. 막대는 색만이 아니라 길이로도 말한다. */
function BreakdownRow({ label, n, total }: { label: string; n: number; total: number }) {
  const share = total > 0 ? n / total : 0
  return (
    <>
      <dt className="whitespace-nowrap text-[var(--t2)]">{label}</dt>
      <dd className="m-0">
        <span
          aria-hidden
          className="block h-1.5 rounded-[var(--r-full)] bg-[var(--bd-strong)]"
          style={{ width: `${Math.max(2, share * 100)}%` }}
        />
      </dd>
      <dd className="m-0 whitespace-nowrap tabular-nums text-[var(--t3)]">
        {n.toLocaleString()} · {(share * 100).toFixed(0)}%
      </dd>
    </>
  )
}
