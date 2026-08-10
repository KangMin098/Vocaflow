// apps/web/src/app/admin/quality/page.tsx
//
// /admin/quality — 품질평가 Q3 대시보드
// quality_metrics (nightly pg_cron jobid=12, KST 03:10 collect_quality_metrics) 읽기 전용 뷰.
// - 최신 스냅샷: 파이프라인 단계(ingest→analyze→extract→publish→deliver)별 지표 카드
// - 지표별 스파크라인(수집 이력 추이) + 직전 스냅샷 대비 변화
// - dims 상세(측정 모수)
// RLS read=admin — admin 세션이 아니면 빈 결과(레이아웃 가드가 선차단).

import type { SupabaseClient } from '@supabase/supabase-js'
import { Gauge } from 'lucide-react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { createClient } from '@/lib/supabase/server'

import { CollectNowButton } from './CollectNowButton'

export const metadata = {
  title: '품질 지표 — Admin',
  description: '콘텐츠 파이프라인 품질 지표 (quality_metrics nightly 수집)',
}

export const dynamic = 'force-dynamic'

interface MetricRow {
  stage: string
  metric: string
  value: string | number
  dims: Record<string, unknown> | null
  measured_at: string
}

/** stage+metric+세그먼트(dims.status) 단위 시계열 */
interface MetricSeries {
  key: string
  stage: string
  metric: string
  segment: string | null
  /** measured_at 오름차순 */
  points: { at: string; value: number; dims: Record<string, unknown> | null }[]
}

const STAGE_ORDER = ['ingest', 'analyze', 'extract', 'publish', 'deliver'] as const

const STAGE_LABEL: Record<string, string> = {
  ingest: '수집',
  analyze: '분석',
  extract: '추출',
  publish: '발행',
  deliver: '제공',
}

/** 알려진 지표 한글 라벨 — 미등록 지표는 metric 원문 그대로 노출(신규 M 추가에 열림) */
const METRIC_LABEL: Record<string, string> = {
  article_lexical_noise_p90: '아티클 어휘 노이즈 p90',
  book_v7_v8_share_pct: '도서 V7–V8 편중 비율',
  published_chapter_set_coverage_pct: '발행 챕터 단어장 커버리지',
  set_size_p50: '챕터 세트 크기 p50',
  set_size_p90: '챕터 세트 크기 p90',
  shared_words_meaning_ko_pct: '단어 뜻(한국어) 채움률',
  book_librivox_audio_pct: '챕터 오디오 보유율',
}

function formatValue(metric: string, v: number): string {
  if (metric.endsWith('_pct')) return `${v.toFixed(v >= 100 ? 0 : 2)}%`
  return Number.isInteger(v) ? String(v) : v.toFixed(3)
}

function formatDim(v: unknown): string {
  if (v === null || v === undefined) return '-'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** 수집 이력 → 지표 시계열 그룹핑. 세그먼트 = dims.status (도서 지표의 published/ready 분리) */
function toSeries(rows: MetricRow[]): MetricSeries[] {
  const map = new Map<string, MetricSeries>()
  // rows 는 measured_at DESC — 오름차순 시계열로 뒤집어 적재
  for (const row of [...rows].reverse()) {
    const segment = typeof row.dims?.status === 'string' ? (row.dims.status as string) : null
    const key = `${row.stage}/${row.metric}${segment ? `@${segment}` : ''}`
    let series = map.get(key)
    if (!series) {
      series = { key, stage: row.stage, metric: row.metric, segment, points: [] }
      map.set(key, series)
    }
    series.points.push({ at: row.measured_at, value: Number(row.value), dims: row.dims })
  }
  return [...map.values()]
}

/** 미니 스파크라인 (SVG polyline) — 수집 2회 미만이면 null */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const w = 132
  const h = 34
  const pad = 3
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const coords = points
    .map((v, i) => {
      const x = pad + (i / (points.length - 1)) * (w - pad * 2)
      const y = h - pad - ((v - min) / span) * (h - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} aria-hidden="true" className="shrink-0">
      <polyline
        points={coords}
        fill="none"
        stroke="#8B5CF6"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  )
}

export default async function AdminQualityPage() {
  // quality_metrics 는 생성 타입 미반영(PR #94 이후 재생성 전) — 언타입 클라이언트 경유
  const supabase = (await createClient()) as unknown as SupabaseClient

  // 9행/스냅샷 기준 400행 ≈ 최근 40여 회 수집분
  const { data, error } = await supabase
    .from('quality_metrics')
    .select('stage, metric, value, dims, measured_at')
    .order('measured_at', { ascending: false })
    .limit(400)
    .returns<MetricRow[]>()

  if (error) {
    console.warn('[admin/quality] quality_metrics fetch failed:', error.message)
  }

  const rows = data ?? []
  const series = toSeries(rows)
  const latestAt = rows[0]?.measured_at ?? null
  const snapshotCount = new Set(rows.map((r) => r.measured_at)).size

  // 파이프라인 순서로 stage 그룹핑 (미지 stage 는 뒤에)
  const stages = [...new Set(series.map((s) => s.stage))].sort((a, b) => {
    const ia = STAGE_ORDER.indexOf(a as (typeof STAGE_ORDER)[number])
    const ib = STAGE_ORDER.indexOf(b as (typeof STAGE_ORDER)[number])
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="inline-flex items-center gap-2.5 font-display text-[28px] font-[800] text-[var(--t1)]">
            <Gauge size={26} className="text-[#8B5CF6]" aria-hidden="true" /> 품질 지표
          </h1>
          <p className="mt-2 font-body text-[14px] text-[var(--t2)]">
            콘텐츠 파이프라인 품질 스냅샷 — 매일 KST 03:10 자동 수집 (collect_quality_metrics)
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-3">
          <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-2.5 text-right">
            <p className="font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
              최근 수집
            </p>
            <p className="mt-0.5 font-body text-[13px] text-[var(--t1)]">
              {latestAt ? new Date(latestAt).toLocaleString('ko-KR') : '기록 없음'}
            </p>
            <p className="font-body text-[11px] text-[var(--t2)]">수집 {snapshotCount}회 보관</p>
          </div>
          <CollectNowButton />
        </div>
      </header>

      <AdminScreenHelp screen="quality" className="-mt-4" />

      {series.length === 0 ? (
        <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-10 text-center">
          <p className="font-body text-[14px] text-[var(--t2)]">
            수집된 품질 지표가 없어요. 첫 nightly 수집(KST 03:10)을 기다리거나 admin 권한을 확인해
            주세요.
          </p>
        </section>
      ) : (
        stages.map((stage) => {
          const stageSeries = series.filter((s) => s.stage === stage)
          return (
            <section
              key={stage}
              className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6"
            >
              <h2 className="mb-4 flex items-center gap-2.5">
                <span className="rounded-[var(--r-sm)] bg-[#8B5CF6]/10 px-2 py-0.5 font-mono text-[11px] font-[700] uppercase tracking-[0.08em] text-[#8B5CF6]">
                  {stage}
                </span>
                <span className="font-display text-[16px] font-[700] text-[var(--t1)]">
                  {STAGE_LABEL[stage] ?? stage}
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {stageSeries.map((s) => {
                  const latest = s.points[s.points.length - 1]
                  const prev = s.points.length >= 2 ? s.points[s.points.length - 2] : null
                  const delta = prev ? latest.value - prev.value : null
                  const dims = latest.dims ?? {}
                  return (
                    <article
                      key={s.key}
                      className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4 transition-shadow duration-[var(--dur-normal)] ease-[var(--ease)] hover:shadow-[var(--sh-sm)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display text-[13px] font-[600] text-[var(--t1)]">
                            {METRIC_LABEL[s.metric] ?? s.metric}
                            {s.segment && (
                              <span className="ml-1.5 rounded-[var(--r-full)] bg-[var(--bg3)] px-1.5 py-0.5 font-mono text-[10px] font-[600] text-[var(--t2)]">
                                {s.segment}
                              </span>
                            )}
                          </p>
                          <p className="mt-1 flex items-baseline gap-2">
                            <span className="font-display text-[26px] font-[800] tracking-tight text-[var(--t1)]">
                              {formatValue(s.metric, latest.value)}
                            </span>
                            {delta !== null && delta !== 0 && (
                              <span className="font-body text-[12px] text-[var(--t2)]">
                                {delta > 0 ? '▲' : '▼'}{' '}
                                {formatValue(s.metric, Math.abs(delta)).replace('%', '')}
                                {s.metric.endsWith('_pct') ? '%p' : ''} (전회 대비)
                              </span>
                            )}
                            {delta === 0 && (
                              <span className="font-body text-[12px] text-[var(--t2)]">변동 없음</span>
                            )}
                          </p>
                        </div>
                        <Sparkline points={s.points.map((p) => p.value)} />
                      </div>
                      {Object.keys(dims).length > 0 && (
                        <dl className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--bd)] pt-2.5">
                          {Object.entries(dims).map(([k, v]) => (
                            <div key={k} className="flex items-baseline gap-1">
                              <dt className="font-mono text-[10px] text-[var(--t2)]">{k}</dt>
                              <dd className="font-mono text-[11px] font-[600] text-[var(--t2)]">
                                {formatDim(v)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })
      )}

      <p className="text-center font-body text-[11px] text-[var(--t2)]">
        수집: pg_cron jobid=12 (매일 KST 03:10) + 수동 &lsquo;지금 수집&rsquo;
        (admin_collect_quality_metrics) · 골든셋 스냅샷 회귀는 CI verify 참조
      </p>
    </div>
  )
}
