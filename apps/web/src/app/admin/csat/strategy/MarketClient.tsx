// apps/web/src/app/admin/csat/strategy/MarketClient.tsx
//
// **기획 — 시중 대비 어디서 지는가.**
//
// 이 화면의 유일한 주장: 「시중 교재보다 120%」는 **합본 평균이 아니라 구속점**으로 판정한다.
// 합본 지수는 쪽수 가중평균이라 특정 출판사에 지는 것을 감춘다(이 코퍼스는 쪽수의 67%가
// NE능률이다 — 그 평균을 이기는 것은 사실상 NE능률 규격만 이긴 것이다).
//
// 그리고 못 잰 축을 **1.0(대등)으로 채우지 않는다.** 채우면 종합 지수가 올라가는데 그것은
// 개선이 아니라 분식이다. 대신 「잰 축만으로 낼 수 있는 최대」(천장)를 목표와 견주어,
// **막는 것이 파이프라인인지 증거인지**를 가른다 — 이 구분이 없으면 관리자는 오르지 않는
// 지표에 배치를 계속 돌린다.

'use client'

import { useState } from 'react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import type { BenchFile, BenchPublisher } from '@/lib/csat/factory-bench'
import {
  MIN_ATTEMPTS_FOR_ACCURACY,
  VERDICT_KO,
  platformMeasurable,
  verdictOf,
  type MarketView,
} from '@/lib/csat/factory-lab-model'

const MODE_KO = {
  volume: { label: '권 (출간물)', hint: '실제로 인쇄되는 것 — 학습자가 만나는 품질' },
  warehouse: { label: '창고 (재고)', hint: '만들어 둔 것 전부 — 고를 수 있는 폭' },
} as const

function pct(v: number | null, unit: string): string {
  if (v == null) return '—'
  if (unit === '%') return `${(v * 100).toFixed(1)}%`
  return `${v.toLocaleString()}${unit}`
}

function PublisherCard({ p, target }: { p: BenchPublisher; target: number }) {
  const v = verdictOf(p, target)
  const k = VERDICT_KO[v]
  return (
    <article className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-display text-[15px] font-[700] text-[var(--t1)]">{p.publisher}</h3>
          <p className="font-body text-[11px] text-[var(--t3)]">
            표본 {p.docs}종 {p.pages.toLocaleString()}쪽 · 잰 축 {p.axesMeasured}/{p.axesTotal}
          </p>
        </div>
        <span
          className="rounded-[var(--r-full)] px-2 py-1 font-display text-[11px] font-[700]"
          style={{ background: `${k.color}1F`, color: k.color }}
          title={k.hint}
        >
          {k.label}
        </span>
      </header>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-mono text-[22px] font-[700] tabular-nums text-[var(--t1)]">
          {p.overallIndex?.toFixed(3) ?? '—'}
        </span>
        <span className="font-body text-[12px] text-[var(--t3)]">
          천장 {p.reachableMax?.toFixed(3) ?? '—'} · 목표 {target.toFixed(3)}
        </span>
      </div>

      {p.gaps.length ? (
        <p className="break-keep rounded-[var(--r-sm)] bg-[var(--bg2)] p-2 font-body text-[11.5px] leading-snug text-[var(--t2)]">
          못 잰 축: {p.gaps.join(' · ')} — {k.hint}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-[var(--bd)] text-[11px] text-[var(--t3)]">
              <th className="py-1.5 pr-2 font-[500]">축</th>
              <th className="py-1.5 pr-2 font-[500]">우리</th>
              <th className="py-1.5 pr-2 font-[500]">시장</th>
              <th className="py-1.5 font-[500]">지수</th>
            </tr>
          </thead>
          <tbody>
            {p.axes.map((a) => (
              <tr key={a.id} className="border-b border-[var(--bd)] align-top last:border-0">
                <td className="py-1.5 pr-2 text-[var(--t2)]">
                  <span className="font-mono text-[10px] text-[var(--t3)]">{a.id}</span>{' '}
                  <span className="break-keep">{a.name}</span>
                  {a.insufficient ? (
                    <p className="mt-0.5 break-keep font-body text-[10.5px] leading-snug text-[#8A8278]">
                      {a.insufficient}
                    </p>
                  ) : null}
                </td>
                <td className="py-1.5 pr-2 font-mono tabular-nums text-[var(--t1)]">
                  {pct(a.ours, a.unit)}
                </td>
                <td className="py-1.5 pr-2 font-mono tabular-nums text-[var(--t2)]">
                  {pct(a.market, a.unit)}
                </td>
                <td className="py-1.5 font-mono tabular-nums">
                  {a.index == null ? (
                    <span className="text-[#8A8278]">못 잼</span>
                  ) : (
                    <span style={{ color: a.index >= 1.2 ? '#2E7D5A' : a.index >= 1 ? '#B5803A' : '#9C3A30' }}>
                      {a.index.toFixed(3)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}

function ModePanel({ bench, target }: { bench: BenchFile; target: number }) {
  const binding = bench.publishers.find((p) => p.publisher === bench.bindingPublisher) ?? null
  const bindingVerdict = binding ? verdictOf(binding, target) : null
  return (
    <>
      <section className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <p className="font-body text-[12px] text-[var(--t3)]">
          판정은 합본 평균이 아니라 <strong>구속점</strong>이다 — 평균은 쪽수 가중이라 지는 곳을 감춘다
        </p>
        <p className="break-keep font-display text-[18px] font-[800] text-[var(--t1)]">
          {bench.bindingPublisher ?? '구속점 미상'}{' '}
          <span className="font-mono">{bench.bindingIndex?.toFixed(3) ?? '—'}</span>
          <span className="ml-2 font-body text-[13px] font-[400] text-[var(--t2)]">
            / 목표 {target.toFixed(3)}
            {bindingVerdict ? ` · ${VERDICT_KO[bindingVerdict].label}` : ''}
          </span>
        </p>
        <p className="break-keep font-body text-[12px] text-[var(--t3)]">
          합본 {bench.pooledIndex?.toFixed(3) ?? '—'} · {bench.scope} · 생성{' '}
          {bench.generatedAt.slice(0, 10)} — 이 값은 <strong>그때의 사실</strong>이다. 재고가 바뀌었으면
          다시 재야 한다.
        </p>
      </section>

      <div className="grid gap-3 xl:grid-cols-2">
        {bench.publishers.map((p) => (
          <PublisherCard key={p.publisher} p={p} target={target} />
        ))}
      </div>
    </>
  )
}

/**
 * **7축이 재지 않는 것.**
 *
 * 일곱 축(해설 보유 · 해설 길이 · 오답 배제 · 원문 인용 · 유형 수 · 지문 어수 · 선택지 수)은
 * 어느 것도 종이책이 못 하는 일이 아니다. 그래서 1.200 을 넘겨도 그 문장의 뜻은
 * **「더 나은 종이책」** 이다.
 *
 * 종이가 원리적으로 못 하는 자리 — 개인별 복습 일정 · 오답 재출제 · 수준 맞춤 배본 · 즉시 채점 —
 * 은 벤치마크 밖에 있고 **관측이 있어야 잴 수 있다.** 그래서 여기서 「우리는 그것을 한다」고
 * 주장하지 않고 **관측 수를 그대로 적는다.** 관측이 없으면 그것은 설계도이지 사실이 아니다.
 */
function PlatformGapPanel({ platform }: { platform: MarketView['platform'] }) {
  const usable = platformMeasurable(platform)
  const n = platform.itemAttempts
  return (
    <section className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
      <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">7축이 재지 않는 것</h3>
      <p className="break-keep font-body text-[12px] leading-relaxed text-[var(--t2)]">
        일곱 축은 <strong>전부 종이에서도 잴 수 있는 것</strong>이다 — 해설 보유·길이, 오답 배제,
        원문 인용, 유형 수, 지문 어수, 선택지 수. 그래서 목표 1.200 을 넘겨도 그 말의 뜻은{' '}
        <strong>「더 나은 종이책」</strong>이지 「종이가 못 하는 것을 한다」가 아니다.
      </p>
      <p className="break-keep font-body text-[12px] leading-relaxed text-[var(--t2)]">
        종이가 원리적으로 못 하는 자리는 넷이다 — <strong>개인별 복습 일정</strong>(FSRS),{' '}
        <strong>오답 재출제</strong>, <strong>수준 맞춤 배본</strong>, <strong>즉시 채점</strong>. 넷 다
        학습자가 실제로 푼 기록이 있어야 잴 수 있다.
      </p>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-[var(--r-sm)] bg-[var(--bg2)] p-3">
        <span className="font-body text-[11px] text-[var(--t3)]">기출 문항 시도</span>
        <span
          className="font-mono text-[20px] font-[700] tabular-nums"
          style={{ color: usable ? '#2E7D5A' : '#9C3A30' }}
        >
          {n == null ? '못 잼' : n.toLocaleString()}
        </span>
        <span className="font-body text-[11px] text-[var(--t3)]">
          조판된 권 {platform.renderedVolumes ?? '못 잼'}
        </span>
      </div>
      <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t3)]">
        {platform.itemAttemptsError ? (
          platform.itemAttemptsError
        ) : usable ? (
          <>
            시도가 필요 표본({MIN_ATTEMPTS_FOR_ACCURACY})을 넘었다 — <strong>필요조건은 채웠다.</strong>{' '}
            다만 그 시도가 <strong>한 문항에 모여야</strong> 그 문항을 잴 수 있다. 흩어져 있으면 여전히
            아무것도 못 잰다. 문항별 분포를 확인한 뒤 축을 정의해 벤치마크에 A8~ 로 더한다.
          </>
        ) : (
          <>
            문항 하나의 정답률을 게이트(0.65~0.70) 대비 ±0.10 으로 잡으려면 시도가{' '}
            <strong>{MIN_ATTEMPTS_FOR_ACCURACY}회</strong> 필요하다. 지금은 그 근처도 아니므로 네 축 중
            어느 것도 잴 수 없다. 그러니까 지금 「종이보다 낫다」고 말할 수 있는 근거는 7축뿐이고,{' '}
            <strong>그 7축은 종이의 경기장이다.</strong> 이 수가 오르기 전까지 플랫폼 우위는 설계도이지
            사실이 아니다.
          </>
        )}
      </p>
    </section>
  )
}

export function MarketClient({ warehouse, volume, target, platform, loadError }: MarketView) {
  const [mode, setMode] = useState<'volume' | 'warehouse'>(volume ? 'volume' : 'warehouse')
  const bench = mode === 'volume' ? volume : warehouse

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">② 기획 — 시장 대비 우위</h2>
          <p className="font-body text-[12px] text-[var(--t2)]">
            시중: 시장조사 · 경쟁교재 분석 · 상품기획
          </p>
        </div>
        <AdminScreenHelp screen="csat-strategy" />
      </div>

      {loadError ? (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-[#9C3A30] bg-[var(--bg)] p-3 font-body text-[13px] text-[#9C3A30]"
        >
          {loadError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {(['volume', 'warehouse'] as const).map((m) => {
          const has = (m === 'volume' ? volume : warehouse) != null
          return (
            <button
              key={m}
              type="button"
              disabled={!has}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              title={MODE_KO[m].hint}
              className={`min-h-[44px] rounded-[var(--r-md)] border px-3 font-display text-[13px] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-50 ${
                mode === m
                  ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 font-[600] text-[var(--t1)]'
                  : 'border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)] active:bg-[var(--bd)]'
              }`}
            >
              {MODE_KO[m].label}
              {!has ? <span className="ml-1 text-[11px] text-[var(--t3)]">(없음)</span> : null}
            </button>
          )
        })}
      </div>

      {bench ? (
        <ModePanel bench={bench} target={target} />
      ) : (
        <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4 font-body text-[13px] text-[var(--t2)]">
          이 모드의 리포트가 없다. 아래 명령을 돌리면 생긴다 — 값이 0 이어서가 아니라 <strong>아직 안
          쟀기</strong> 때문이다.
        </p>
      )}

      <PlatformGapPanel platform={platform} />

      <section className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
        <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">다시 재는 법</h3>
        <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
          npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/market-benchmark.mjs --per-publisher
        </code>
        <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
          npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/market-benchmark.mjs --per-publisher --volume
        </code>
        <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t3)]">
          「증거가 막는다」로 나온 출판사는 배치를 더 돌려도 지수가 안 오른다 — 그 출판사의 정답해설
          자료를 코퍼스에 넣는 것이 유일한 길이다. 자료 위치는 memory 의 「시중 교재 PDF」 항목에 있다.
        </p>
      </section>
    </div>
  )
}
