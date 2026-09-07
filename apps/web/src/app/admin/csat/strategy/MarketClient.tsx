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

import { unbenchedDimensions } from '@vocaflow/library-pipeline/textbook-evaluation'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import type { BenchFile, BenchPublisher } from '@/lib/csat/factory-bench'
import {
  MIN_ATTEMPTS_FOR_ACCURACY,
  VERDICT_KO,
  platformMeasurable,
  verdictOf,
  type MarketView,
} from '@/lib/csat/factory-lab-model'

import { AxisBullet, AxisBulletLegend } from './AxisBullet'
import { EvalChecklist } from './EvalChecklist'

const MODE_KO = {
  volume: { label: '권 (출간물)', hint: '실제로 인쇄되는 것 — 학습자가 만나는 품질' },
  warehouse: { label: '창고 (재고)', hint: '만들어 둔 것 전부 — 고를 수 있는 폭' },
} as const


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

      <AxisBulletLegend target={target} />
      <ul>
        {p.axes.map((a) => (
          <AxisBullet key={a.id} axis={a} target={target} />
        ))}
      </ul>
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
    <div className="flex flex-col gap-2">
      <h4 className="break-keep font-display text-[12.5px] font-[700] text-[var(--t1)]">
        종이가 못 하는 자리 — 관측이 있어야 잰다
      </h4>
      <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t2)]">
        개인별 복습 일정 · 오답 재출제 · 수준 맞춤 배본 · 즉시 채점 —{' '}
        <strong>학습자가 푼 기록 위에서만</strong> 잴 수 있다.
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
      {/*
        판정은 한 줄로 보이고, **왜 그 숫자인지**는 접어 둔다(철학 2 Progressive Disclosure).
        근거를 지우면 임계값이 짐작처럼 보이고, 늘 펼쳐 두면 화면이 산문으로 덮인다.
      */}
      <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t3)]">
        {platform.itemAttemptsError ??
          (usable
            ? `필요 표본 ${MIN_ATTEMPTS_FOR_ACCURACY}회를 넘겼다 — 필요조건은 채웠다.`
            : `필요 표본 ${MIN_ATTEMPTS_FOR_ACCURACY}회에 못 미친다 — 네 축 중 어느 것도 못 잰다.`)}
      </p>

      <details className="group">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center font-display text-[11.5px] font-[600] text-[#8B5CF6] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[#A78BFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]">
          {MIN_ATTEMPTS_FOR_ACCURACY}회는 어디서 나온 수인가
        </summary>
        <p className="mt-1 break-keep font-body text-[11.5px] leading-relaxed text-[var(--t3)]">
          {usable ? (
            <>
              시도가 <strong>한 문항에 모여야</strong> 그 문항을 잴 수 있다 — 흩어지면 여전히 못 잰다.
              문항별 분포를 확인한 뒤 축을 정의해 벤치마크에 A8~ 로 더한다.
            </>
          ) : (
            <>
              문항 하나의 정답률을 게이트(0.65~0.70) 대비 ±0.10 으로 잡으려면{' '}
              <code className="font-mono">0.7×0.3×(1.96/0.10)² ≈ {MIN_ATTEMPTS_FOR_ACCURACY}</code> 회가
              필요하다. <strong>필요조건이지 충분조건이 아니다</strong> — 그 수가 한 문항에 모여야 한다.
              이 수가 오르기 전까지 플랫폼 우위는 설계도이지 사실이 아니다.
            </>
          )}
        </p>
      </details>
    </div>
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

      {/*
        **일곱 축 밖은 두 갈래다.** 처음엔 두 패널로 나란히 걸었는데 제목이 사실상 같은 말이라
        («7축이 재지 않는 것» / «벤치마크가 안 보는 축») 관리자가 둘의 차이를 못 읽었다.
        갈라 주는 것은 「종이가 할 수 있느냐」다 — 못 하는 자리는 관측이 생겨야 재고,
        하는 자리는 지금도 잴 수 있는데 아직 손으로만 판정했다. 할 일이 서로 다르다.

        아래쪽 표는 TBP 콘솔(`/admin/textbook`)의 「평가 요소 15」를 옮긴 것이다(2026-09-06).
        실측 7축과 겹치는 넷은 `benchAxis` 로 걸러져 안 온다 — 같은 것을 두 근거로 두 번 말하면
        손으로 적은 쪽이 이긴다.
      */}
      <section className="flex flex-col gap-4 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <h3 className="break-keep font-display text-[14px] font-[700] text-[var(--t1)]">
          일곱 축 밖 — 지수가 1.200 을 넘겨도 안 본 자리
        </h3>
        <PlatformGapPanel platform={platform} />
        <EvalChecklist dimensions={unbenchedDimensions()} />
      </section>

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
