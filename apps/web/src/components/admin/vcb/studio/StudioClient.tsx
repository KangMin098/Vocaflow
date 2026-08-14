// apps/web/src/components/admin/vcb/studio/StudioClient.tsx
// 단어장 Studio — 유형 고르기 → 파라미터 → 미리보기·채점 → 발행.
//
// 화면 원칙 (CLAUDE.md 4철학):
//   · 발행 버튼은 채점 전에 눌릴 수 없다 — "평가가 발행의 전제" 를 UI 가 강제한다.
//   · 자산 결손 유형은 숨기지 않고 이유를 붙여 보여준다 (숨기면 왜 없는지 아무도 모른다).
//   · 미달 원인은 접어 두지 않는다. 지금 무엇을 고쳐야 하는지가 이 화면의 값이다.

'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Layers,
  Lock,
  Play,
  Sparkles,
  Upload,
} from 'lucide-react'
import type {
  BlueprintCardData,
  PreviewResult,
  PublishActionResult,
  StudioCatalog,
  StudioOptions,
} from '@/lib/vcb/server/compose-studio'
import { previewBlueprint, publishBlueprint } from '@/lib/vcb/server/compose-studio'
import type { BlueprintParams } from '@/lib/vcb/compose/blueprints'
import { ScorecardPanel } from './ScorecardPanel'

const FAMILY_LABEL: Record<string, string> = {
  list: '모집단이 목차를 정한다',
  structure: '어휘 구조가 목차를 정한다',
  corpus: '콘텐츠가 목차를 정한다',
  delivery: '학습 방법이 목차를 정한다',
  unique: '이 플랫폼만 만들 수 있다',
}

const FAMILY_ORDER = ['unique', 'list', 'structure', 'corpus', 'delivery']

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  ready: { label: '만들 수 있음', color: 'var(--success)', bg: 'var(--success-light)' },
  partial: { label: '규모 제한', color: 'var(--warning)', bg: 'var(--warning-light)' },
  asset_gap: { label: '자산 없음', color: 'var(--error)', bg: 'var(--error-light)' },
  data_gate: { label: '데이터 대기', color: 'var(--t3)', bg: 'var(--bg2)' },
}

const GROUP_BY_LABEL: Record<string, string> = {
  none: '목차 없음',
  root: '어근',
  topic: '주제',
  family: '파생 묶음',
  pos: '품사',
  v_level: 'V-Level',
  cefr: 'CEFR',
  freq_band: '빈도 대역',
  confusable: '혼동 짝',
  collocation_hub: '연어 허브',
  synonym_cluster: '유의어 군',
  sense: '뜻 개수',
  rhyme: '라임',
  source_chapter: '원문 챕터',
  day: '일자',
}

const FACET_LABEL: Record<string, string> = {
  recognize: '뜻',
  spell: '철자',
  sound: '소리',
  build: '조립',
  use: '문맥',
  fluency: '속도',
}

interface Props {
  catalog: StudioCatalog
  options: StudioOptions
}

export function StudioClient({ catalog, options }: Props) {
  const [selected, setSelected] = useState<BlueprintCardData | null>(null)
  const [params, setParams] = useState<BlueprintParams>({})
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [published, setPublished] = useState<PublishActionResult | null>(null)
  const [force, setForce] = useState(false)
  const [pending, startTransition] = useTransition()

  const grouped = useMemo(() => {
    const byFamily = new Map<string, BlueprintCardData[]>()
    for (const b of catalog.blueprints) {
      const list = byFamily.get(b.family)
      if (list) list.push(b)
      else byFamily.set(b.family, [b])
    }
    return FAMILY_ORDER.filter((f) => byFamily.has(f)).map((f) => ({
      family: f,
      items: byFamily.get(f)!,
    }))
  }, [catalog.blueprints])

  function choose(bp: BlueprintCardData): void {
    setSelected(bp)
    setPreview(null)
    setPublished(null)
    setForce(false)
    setParams({
      count: bp.default_count ?? undefined,
      book_id: bp.requires_params.includes('book_id') ? options.books[0]?.id : undefined,
      chapter_from: bp.requires_params.includes('chapter_from') ? 1 : undefined,
      chapter_to: bp.requires_params.includes('chapter_to') ? 3 : undefined,
      themes: bp.requires_params.includes('themes') ? [options.themes[0] ?? '여행'] : undefined,
      tags: bp.requires_params.includes('tags') ? ['ngsl_1.2'] : undefined,
      text_ids: bp.requires_params.includes('text_ids')
        ? options.article_sets[0]
          ? [options.article_sets[0].id]
          : undefined
        : undefined,
      days: bp.requires_params.includes('days') ? 30 : undefined,
      per_day: bp.requires_params.includes('per_day') ? 20 : undefined,
      v_level_min: bp.requires_params.includes('v_level_min') ? 4 : undefined,
      v_level_max: bp.requires_params.includes('v_level_max') ? 7 : undefined,
    })
  }

  function runPreview(): void {
    if (!selected) return
    setPublished(null)
    startTransition(async () => {
      const r = await previewBlueprint(selected.id, params)
      setPreview(r)
    })
  }

  function runPublish(): void {
    if (!selected) return
    startTransition(async () => {
      const r = await publishBlueprint(selected.id, params, force)
      setPublished(r)
      if (r.ok) {
        const again = await previewBlueprint(selected.id, params)
        setPreview(again)
      }
    })
  }

  const canPublish =
    !!preview?.ok && !!preview.scorecard && (force || preview.scorecard.passed) && !pending

  return (
    <div className="grid gap-8" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {/* ── 카탈로그 ─────────────────────────────────── */}
      <section>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-base font-semibold m-0" style={{ color: 'var(--t1)' }}>
            유형 고르기
          </h2>
          <span className="font-body text-xs" style={{ color: 'var(--t3)' }}>
            만들 수 있음 {catalog.summary.by_status.ready} · 규모 제한{' '}
            {catalog.summary.by_status.partial} · 자산 없음 {catalog.summary.by_status.asset_gap} ·
            데이터 대기 {catalog.summary.by_status.data_gate}
          </span>
        </div>

        {grouped.map(({ family, items }) => (
          <div key={family} className="mb-6">
            <div className="mb-2 flex items-center gap-2">
              {family === 'unique' ? (
                <Sparkles className="w-4 h-4" style={{ color: 'var(--admin)' }} aria-hidden />
              ) : (
                <Layers className="w-4 h-4" style={{ color: 'var(--t3)' }} aria-hidden />
              )}
              <h3
                className="font-display text-sm font-semibold m-0"
                style={{ color: family === 'unique' ? 'var(--admin)' : 'var(--t2)' }}
              >
                {FAMILY_LABEL[family] ?? family}
              </h3>
              <span className="font-body text-xs" style={{ color: 'var(--t3)' }}>
                {items.length}종
              </span>
            </div>

            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
            >
              {items.map((bp) => {
                const st = STATUS_META[bp.status] ?? STATUS_META['ready']!
                const active = selected?.id === bp.id
                return (
                  <button
                    key={bp.id}
                    type="button"
                    onClick={() => choose(bp)}
                    aria-pressed={active}
                    className="min-h-[44px] rounded-[var(--r-lg)] border p-4 text-left transition-all duration-[var(--dur-normal)] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin)] focus-visible:ring-offset-1 active:translate-y-0"
                    style={{
                      background: active ? 'var(--p-light)' : 'var(--bg)',
                      borderColor: active ? 'var(--admin)' : 'var(--bd)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="font-display text-sm font-semibold"
                        style={{ color: 'var(--t1)' }}
                      >
                        {bp.title}
                      </span>
                      <span
                        className="shrink-0 rounded-[var(--r-sm)] px-1.5 py-0.5 font-display text-[10px] font-medium"
                        style={{ color: st.color, background: st.bg }}
                      >
                        {st.label}
                      </span>
                    </div>

                    <p className="font-body text-xs mt-2 mb-0" style={{ color: 'var(--t2)' }}>
                      {bp.organizing_principle}
                    </p>
                    <p className="font-body text-[11px] mt-1.5 mb-0" style={{ color: 'var(--t3)' }}>
                      {bp.market_example}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className="rounded-[var(--r-sm)] px-1.5 py-0.5 font-body text-[10px]"
                        style={{ background: 'var(--bg2)', color: 'var(--t3)' }}
                      >
                        목차 {GROUP_BY_LABEL[bp.group_by] ?? bp.group_by}
                      </span>
                      {bp.facets.map((f) => (
                        <span
                          key={f}
                          className="rounded-[var(--r-sm)] px-1.5 py-0.5 font-body text-[10px]"
                          style={{ background: 'var(--bg2)', color: 'var(--t3)' }}
                        >
                          {FACET_LABEL[f] ?? f}
                        </span>
                      ))}
                    </div>

                    {bp.gap_note ? (
                      <p
                        className="font-body text-[11px] mt-2 mb-0 flex items-start gap-1"
                        style={{ color: st.color }}
                      >
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
                        <span>{bp.gap_note}</span>
                      </p>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      {/* ── 파라미터 + 실행 ──────────────────────────── */}
      {selected ? (
        <section
          className="rounded-[var(--r-lg)] border p-5"
          style={{ background: 'var(--bg)', borderColor: 'var(--bd)' }}
        >
          <h2
            className="font-display text-base font-semibold m-0 mb-1"
            style={{ color: 'var(--t1)' }}
          >
            {selected.title} 설정
          </h2>
          <p className="font-body text-xs m-0 mb-4" style={{ color: 'var(--t3)' }}>
            {selected.taxon} · {selected.id} — 채점을 통과해야 발행 버튼이 열립니다
          </p>

          <ParamForm
            blueprint={selected}
            options={options}
            params={params}
            onChange={setParams}
          />

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runPreview}
              disabled={pending}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] px-4 font-display text-sm font-medium text-white transition-opacity duration-[var(--dur-normal)] hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin)] focus-visible:ring-offset-1"
              style={{ background: 'var(--admin-strong)' }}
            >
              <Play className="w-4 h-4" aria-hidden />
              {pending ? '조립 중…' : '미리보기 + 채점'}
            </button>

            <button
              type="button"
              onClick={runPublish}
              disabled={!canPublish}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border px-4 font-display text-sm font-medium transition-colors duration-[var(--dur-normal)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin)] focus-visible:ring-offset-1"
              style={{
                borderColor: canPublish ? 'var(--success)' : 'var(--bd)',
                color: canPublish ? 'var(--success)' : 'var(--t3)',
                background: 'var(--bg)',
              }}
            >
              {canPublish ? (
                <Upload className="w-4 h-4" aria-hidden />
              ) : (
                <Lock className="w-4 h-4" aria-hidden />
              )}
              발행
            </button>

            {preview?.ok && preview.scorecard && !preview.scorecard.passed ? (
              <label
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 font-body text-xs"
                style={{ color: 'var(--t2)' }}
              >
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  className="h-4 w-4"
                />
                통과선 미달을 알고도 발행 (되돌리려면 같은 슬러그로 다시 발행)
              </label>
            ) : null}
          </div>

          {published ? (
            <div
              className="mt-4 rounded-[var(--r-md)] border p-3 font-body text-xs"
              style={{
                background: published.ok ? 'var(--success-light)' : 'var(--error-light)',
                borderColor: published.ok ? 'var(--success)' : 'var(--error)',
                color: published.ok ? 'var(--success)' : 'var(--error)',
              }}
            >
              {published.ok ? (
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" aria-hidden />
                  발행 완료 — {published.slug} · {published.published_count}단어
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" aria-hidden />
                    {published.error ?? '발행 실패'}
                  </span>
                  {published.blocked_by && published.blocked_by.length > 0 ? (
                    <ul className="mt-2 mb-0 pl-4">
                      {published.blocked_by.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </section>
      ) : (
        <section
          className="rounded-[var(--r-lg)] border p-10 text-center"
          style={{ background: 'var(--bg)', borderColor: 'var(--bd)' }}
        >
          <BookOpen className="mx-auto mb-3 w-6 h-6" style={{ color: 'var(--t3)' }} aria-hidden />
          <p className="font-display text-sm font-semibold m-0 mb-1" style={{ color: 'var(--t1)' }}>
            위에서 유형을 하나 고르세요
          </p>
          <p className="font-body text-xs m-0" style={{ color: 'var(--t3)' }}>
            고르면 그 유형이 요구하는 값만 물어봅니다.
          </p>
        </section>
      )}

      {/* ── 결과 ─────────────────────────────────────── */}
      {preview ? <ScorecardPanel preview={preview} passThreshold={catalog.pass_threshold} /> : null}
    </div>
  )
}

// ── 파라미터 폼 — 그 유형이 요구하는 것만 묻는다 ────────────────────

function ParamForm({
  blueprint,
  options,
  params,
  onChange,
}: {
  blueprint: BlueprintCardData
  options: StudioOptions
  params: BlueprintParams
  onChange: (p: BlueprintParams) => void
}) {
  const set = (patch: Partial<BlueprintParams>): void => onChange({ ...params, ...patch })
  const need = (k: string): boolean => blueprint.requires_params.includes(k)

  const fieldStyle = {
    background: 'var(--bg2)',
    borderColor: 'var(--bd)',
    color: 'var(--t1)',
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      <Field label="단어 수 (목표)">
        <input
          type="number"
          min={10}
          max={5000}
          value={params.count ?? ''}
          onChange={(e) => set({ count: e.target.value ? Number(e.target.value) : undefined })}
          className="min-h-[44px] w-full rounded-[var(--r-md)] border px-3 font-body text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin)]"
          style={fieldStyle}
        />
      </Field>

      {need('book_id') ? (
        <Field label="도서">
          <select
            value={params.book_id ?? ''}
            onChange={(e) => set({ book_id: e.target.value })}
            className="min-h-[44px] w-full rounded-[var(--r-md)] border px-3 font-body text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin)]"
            style={fieldStyle}
          >
            {options.books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} ({b.chapters}장)
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {need('chapter_from') || need('chapter_to') ? (
        <Field label="챕터 범위">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={params.chapter_from ?? 1}
              onChange={(e) => set({ chapter_from: Number(e.target.value) })}
              className="min-h-[44px] w-full rounded-[var(--r-md)] border px-3 font-body text-sm"
              style={fieldStyle}
            />
            <span className="font-body text-xs" style={{ color: 'var(--t3)' }}>
              –
            </span>
            <input
              type="number"
              min={1}
              value={params.chapter_to ?? 3}
              onChange={(e) => set({ chapter_to: Number(e.target.value) })}
              className="min-h-[44px] w-full rounded-[var(--r-md)] border px-3 font-body text-sm"
              style={fieldStyle}
            />
          </div>
        </Field>
      ) : null}

      {need('tags') ? (
        <Field label="어휘 목록 (list_tags)">
          <select
            value={params.tags?.[0] ?? ''}
            onChange={(e) => set({ tags: [e.target.value] })}
            className="min-h-[44px] w-full rounded-[var(--r-md)] border px-3 font-body text-sm"
            style={fieldStyle}
          >
            {options.list_tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {need('themes') ? (
        <Field label="주제 (L1)">
          <select
            value={params.themes?.[0] ?? ''}
            onChange={(e) => set({ themes: [e.target.value] })}
            className="min-h-[44px] w-full rounded-[var(--r-md)] border px-3 font-body text-sm"
            style={fieldStyle}
          >
            {options.themes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {need('text_ids') ? (
        <Field label="글 단어장">
          <select
            value={params.text_ids?.[0] ?? ''}
            onChange={(e) => set({ text_ids: [e.target.value] })}
            className="min-h-[44px] w-full rounded-[var(--r-md)] border px-3 font-body text-sm"
            style={fieldStyle}
          >
            {options.article_sets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({a.word_count})
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {need('days') || need('per_day') ? (
        <Field label="일정 (일 수 × 하루 개수)">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={params.days ?? 30}
              onChange={(e) => set({ days: Number(e.target.value) })}
              className="min-h-[44px] w-full rounded-[var(--r-md)] border px-3 font-body text-sm"
              style={fieldStyle}
            />
            <span className="font-body text-xs" style={{ color: 'var(--t3)' }}>
              ×
            </span>
            <input
              type="number"
              min={1}
              value={params.per_day ?? 20}
              onChange={(e) => set({ per_day: Number(e.target.value) })}
              className="min-h-[44px] w-full rounded-[var(--r-md)] border px-3 font-body text-sm"
              style={fieldStyle}
            />
          </div>
        </Field>
      ) : null}

      {need('v_level_min') || need('v_level_max') ? (
        <Field label="V-Level 밴드">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={11}
              value={params.v_level_min ?? 4}
              onChange={(e) => set({ v_level_min: Number(e.target.value) })}
              className="min-h-[44px] w-full rounded-[var(--r-md)] border px-3 font-body text-sm"
              style={fieldStyle}
            />
            <span className="font-body text-xs" style={{ color: 'var(--t3)' }}>
              –
            </span>
            <input
              type="number"
              min={1}
              max={11}
              value={params.v_level_max ?? 7}
              onChange={(e) => set({ v_level_max: Number(e.target.value) })}
              className="min-h-[44px] w-full rounded-[var(--r-md)] border px-3 font-body text-sm"
              style={fieldStyle}
            />
          </div>
        </Field>
      ) : null}

      {need('question_nos') ? (
        <Field label="문항 번호 (쉼표 · 비우면 전체)">
          <input
            type="text"
            value={params.question_nos?.join(', ') ?? ''}
            onChange={(e) => {
              const nos = e.target.value
                .split(',')
                .map((s) => Number(s.trim()))
                .filter((n) => Number.isFinite(n) && n > 0)
              set({ question_nos: nos.length > 0 ? nos : undefined })
            }}
            placeholder="예: 31, 32, 33, 34"
            className="min-h-[44px] w-full rounded-[var(--r-md)] border px-3 font-body text-sm"
            style={fieldStyle}
          />
        </Field>
      ) : null}

      {need('frequency_tier_min') ? (
        <Field label="빈출 등급 하한 (1~5 · 비우면 무제한)">
          <input
            type="number"
            min={1}
            max={5}
            value={params.frequency_tier_min ?? ''}
            onChange={(e) =>
              set({ frequency_tier_min: e.target.value ? Number(e.target.value) : undefined })
            }
            className="min-h-[44px] w-full rounded-[var(--r-md)] border px-3 font-body text-sm"
            style={fieldStyle}
          />
        </Field>
      ) : null}

      {need('coverage_target') ? (
        <Field label="커버리지 목표 % (비우면 단어 수 사용)">
          <input
            type="number"
            min={50}
            max={100}
            step={1}
            value={params.coverage_target != null ? Math.round(params.coverage_target * 100) : ''}
            onChange={(e) =>
              set({ coverage_target: e.target.value ? Number(e.target.value) / 100 : undefined })
            }
            placeholder="예: 95"
            className="min-h-[44px] w-full rounded-[var(--r-md)] border px-3 font-body text-sm"
            style={fieldStyle}
          />
        </Field>
      ) : null}

      {need('user_id') ? (
        <Field label="학습자 ID (개인화)">
          <input
            type="text"
            value={params.user_id ?? ''}
            onChange={(e) => set({ user_id: e.target.value })}
            placeholder="uuid"
            className="min-h-[44px] w-full rounded-[var(--r-md)] border px-3 font-body text-sm"
            style={fieldStyle}
          />
        </Field>
      ) : null}

      <Field label="슬러그 (비우면 유형 기본값)">
        <input
          type="text"
          value={params.slug ?? ''}
          onChange={(e) => set({ slug: e.target.value || undefined })}
          className="min-h-[44px] w-full rounded-[var(--r-md)] border px-3 font-body text-sm"
          style={fieldStyle}
        />
      </Field>

      <Field label="제목 (비우면 유형 기본값)">
        <input
          type="text"
          value={params.title ?? ''}
          onChange={(e) => set({ title: e.target.value || undefined })}
          className="min-h-[44px] w-full rounded-[var(--r-md)] border px-3 font-body text-sm"
          style={fieldStyle}
        />
      </Field>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block font-display text-xs font-medium"
        style={{ color: 'var(--t2)' }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}
