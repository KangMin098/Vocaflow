// apps/web/src/app/admin/vocabulary/VocabularyDetailPanel.tsx
//
// 우측 slide-in 패널 — 단어 다차원 정보 풀 표시 + sanity warnings.

'use client'

import { useEffect } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import type { DictWordDetail } from '@/lib/admin/dict/word-search'
import { detailSanityIssues, type SanityIssue } from './_sanity'

interface VocabularyDetailPanelProps {
  detail: DictWordDetail
  onClose: () => void
}

const SEV_META: Record<
  SanityIssue['severity'],
  { color: string; bg: string; icon: typeof AlertTriangle }
> = {
  critical: { color: 'var(--error)', bg: 'var(--error-light)', icon: AlertTriangle },
  warning: { color: 'var(--active)', bg: 'var(--warning-light)', icon: AlertTriangle },
  info: { color: 'var(--info)', bg: 'var(--info-light)', icon: Info },
}

export function VocabularyDetailPanel({ detail, onClose }: VocabularyDetailPanelProps) {
  // Esc 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const issues = detailSanityIssues(detail)
  const reclassified =
    detail.v_level != null &&
    detail.v_level_rule_v1 != null &&
    detail.v_level !== detail.v_level_rule_v1

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* ── 헤더 ── */}
      <header className="flex items-start justify-between gap-2 border-b border-[var(--bd)] pb-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.08em] text-[#8B5CF6]">
            {detail.primary_pos ?? detail.pos}
            {detail.lemma_band ? ` · band ${detail.lemma_band}` : ''}
          </p>
          <h2 className="font-english text-[28px] font-[800] leading-none text-[var(--t1)]">
            {detail.word}
          </h2>
          {(detail.ipa || detail.ipa_uk || detail.ipa_us) && (
            <p className="mt-1 font-mono text-[11px] text-[var(--t2)]">
              {detail.ipa_uk && <span>UK {detail.ipa_uk} </span>}
              {detail.ipa_us && <span>US {detail.ipa_us} </span>}
              {!detail.ipa_uk && !detail.ipa_us && detail.ipa && <span>{detail.ipa}</span>}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail panel (Esc)"
          className={/* 탭 영역 44px — 시각 크기(h-7, 28px)와 다르다 */ "relative after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-sm)] text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]"}
        >
          <X size={14} aria-hidden />
        </button>
      </header>

      {/* ── Sanity Issues ── */}
      {issues.length > 0 ? (
        <section aria-label="sanity issues" className="flex flex-col gap-2">
          <h3 className="font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
            Sanity Check ({issues.length})
          </h3>
          {issues.map((iss) => {
            const sev = SEV_META[iss.severity]
            const SIcon = sev.icon
            return (
              <div
                key={iss.id}
                className="flex items-start gap-2 rounded-[var(--r-md)] border-l-[3px] p-2"
                style={{ borderLeftColor: sev.color, backgroundColor: sev.bg }}
              >
                <SIcon
                  size={12}
                  strokeWidth={2}
                  className="mt-0.5 shrink-0"
                  style={{ color: sev.color }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p
                    className="font-display text-[11px] font-[700]"
                    style={{ color: sev.color }}
                  >
                    {iss.label}
                  </p>
                  <p className="font-body text-[10px] text-[var(--t2)]">{iss.detail}</p>
                </div>
              </div>
            )
          })}
        </section>
      ) : (
        <div className="flex items-center gap-2 rounded-[var(--r-md)] bg-[var(--success-light)] p-2">
          <CheckCircle2 size={12} className="text-[var(--success)]" aria-hidden />
          <p className="font-display text-[11px] font-[700] text-[var(--success)]">
            Sanity 통과 — 정합 OK
          </p>
        </div>
      )}

      {/* ── Meaning ── */}
      <Section title="Meaning">
        {detail.meaning_ko ? (
          <p className="font-body text-[13px] leading-relaxed text-[var(--t1)]">
            {detail.meaning_ko}
          </p>
        ) : (
          <Empty />
        )}
        {detail.example_en && (
          <p className="mt-1.5 font-english text-[11px] italic leading-relaxed text-[var(--t2)]">
            “{detail.example_en}”
          </p>
        )}
      </Section>

      {/* ── Multi-dim VRL ⭐ ── */}
      <Section title="Multi-dim VRL Classification">
        <div className="grid grid-cols-2 gap-2">
          <DimCell
            label="V-Level"
            current={detail.v_level != null ? `V${detail.v_level}` : null}
            ruleV1={detail.v_level_rule_v1 != null ? `V${detail.v_level_rule_v1}` : null}
            changed={reclassified}
          />
          <DimCell
            label="Skill"
            current={detail.skill_level != null ? `L${detail.skill_level}` : null}
            ruleV1={
              detail.skill_level_rule_v1 != null ? `L${detail.skill_level_rule_v1}` : null
            }
            changed={
              detail.skill_level != null &&
              detail.skill_level_rule_v1 != null &&
              detail.skill_level !== detail.skill_level_rule_v1
            }
            extra={detail.skill_type ?? undefined}
          />
          <JsonbCell label="Track levels" current={detail.track_levels} ruleV1={detail.track_levels_rule_v1} />
          <JsonbCell label="Domain levels" current={detail.domain_levels} ruleV1={detail.domain_levels_rule_v1} />
        </div>

        {detail.classified_by && (
          <p className="mt-2 font-mono text-[10px] text-[var(--t2)]">
            classified_by:{' '}
            <span className="font-[700] text-[var(--t2)]">{detail.classified_by}</span>
            {detail.claude_classified_at && (
              <span className="ml-2">
                @ {detail.claude_classified_at.slice(0, 10)}
              </span>
            )}
          </p>
        )}

        {detail.claude_reasoning && (
          <details className="mt-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-2">
            <summary className="cursor-pointer font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
              claude_reasoning
            </summary>
            <p className="mt-1.5 whitespace-pre-wrap font-body text-[11px] leading-relaxed text-[var(--t2)]">
              {detail.claude_reasoning}
            </p>
          </details>
        )}
      </Section>

      {/* ── CEFR ── */}
      <Section title="CEFR">
        <KvRow k="cefr_level" v={detail.cefr_level} />
        <KvRow
          k="cefr_confidence"
          v={detail.cefr_confidence != null ? Number(detail.cefr_confidence).toFixed(2) : null}
        />
        <KvRow k="register" v={detail.register} />
      </Section>

      {/* ── Frequency ── */}
      <Section title="Frequency">
        <KvRow k="frequency_rank" v={detail.frequency_rank?.toLocaleString() ?? null} />
        <KvRow k="ngsl_sfi" v={detail.ngsl_sfi != null ? Number(detail.ngsl_sfi).toFixed(2) : null} />
        <KvRow k="frequency_band" v={detail.frequency_band} />
        <KvRow k="lemma_band" v={detail.lemma_band} />
        {detail.list_tags && detail.list_tags.length > 0 && (
          <KvRow k="list_tags" v={detail.list_tags.join(', ')} />
        )}
      </Section>

      {/* ── Learning Content ── */}
      <Section title="Learning Content">
        <KvRow k="synonyms" v={(detail.synonyms ?? []).join(', ') || null} />
        <KvRow k="antonyms" v={(detail.antonyms ?? []).join(', ') || null} />
        <KvRow k="collocations" v={(detail.collocations ?? []).join(', ') || null} />
        <KvRow k="korean_learner_note" v={detail.korean_learner_note} multiline />
      </Section>

      {/* ── Linguistics ── */}
      <Section title="Linguistics (senses · inflections · pos_set)">
        {detail.pos_set && detail.pos_set.length > 0 && (
          <KvRow k="pos_set" v={detail.pos_set.join(', ')} />
        )}
        {detail.senses != null && (
          <JsonPreview label="senses" value={detail.senses} />
        )}
        {detail.inflections != null && (
          <JsonPreview label="inflections" value={detail.inflections} />
        )}
        {detail.meanings_ko != null && (
          <JsonPreview label="meanings_ko" value={detail.meanings_ko} />
        )}
      </Section>

      {/* ── Schema Tier 1 (audio · image · mnemonic) ── */}
      <Section title="Schema Tier 1 (Migration ✅)">
        <KvRow k="audio_url" v={detail.audio_url} mono />
        <KvRow k="audio_url_uk" v={detail.audio_url_uk} mono />
        <KvRow k="audio_url_us" v={detail.audio_url_us} mono />
        <KvRow k="image_url" v={detail.image_url} mono />
        <KvRow k="mnemonic_ko" v={detail.mnemonic_ko} multiline />
        <KvRow
          k="last_quality_audit_at"
          v={detail.last_quality_audit_at?.slice(0, 19).replace('T', ' ') ?? null}
          mono
        />
      </Section>

      {/* ── Metadata ── */}
      <Section title="Metadata">
        <KvRow k="source" v={detail.source} mono />
        <KvRow k="verified" v={detail.verified ? 'true' : 'false'} />
        <KvRow k="vrl_calculated_at" v={detail.vrl_calculated_at?.slice(0, 19).replace('T', ' ') ?? null} mono />
        <KvRow k="created_at" v={detail.created_at?.slice(0, 10) ?? null} mono />
        <KvRow k="updated_at" v={detail.updated_at?.slice(0, 10) ?? null} mono />
      </Section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-[var(--bd)] pt-3">
      <h3 className="font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
        {title}
      </h3>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  )
}

function KvRow({
  k,
  v,
  mono,
  multiline,
}: {
  k: string
  v: string | null | undefined
  mono?: boolean
  multiline?: boolean
}) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2 py-1">
      <span className="font-mono text-[10px] text-[var(--t2)]">{k}</span>
      {v == null || v === '' ? (
        <Empty />
      ) : (
        <span
          className={`min-w-0 break-words ${mono ? 'font-mono text-[10px]' : 'font-body text-[11px]'} ${
            multiline ? 'whitespace-pre-wrap leading-relaxed' : 'truncate'
          } text-[var(--t1)]`}
          title={v}
        >
          {v}
        </span>
      )}
    </div>
  )
}

function Empty() {
  return <span className="font-mono text-[10px] italic text-[var(--t2)]">empty</span>
}

function DimCell({
  label,
  current,
  ruleV1,
  changed,
  extra,
}: {
  label: string
  current: string | null
  ruleV1: string | null
  changed?: boolean
  extra?: string
}) {
  return (
    <div
      className={`rounded-[var(--r-md)] border p-2 ${
        changed ? 'border-[#8B5CF6]/40 bg-[#8B5CF61A]' : 'border-[var(--bd)] bg-[var(--bg2)]'
      }`}
    >
      <p className="font-mono text-[9px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
        {label}
      </p>
      <p className="mt-0.5 font-display text-[16px] font-[800] leading-none text-[var(--t1)]">
        {current ?? <span className="font-body text-[10px] font-[500] text-[var(--t2)]">—</span>}
      </p>
      {ruleV1 && (
        <p className="mt-0.5 font-mono text-[9px] text-[var(--t2)]">
          rule_v1: {ruleV1}
          {changed && <span className="ml-1 text-[#8B5CF6]">↻</span>}
        </p>
      )}
      {extra && <p className="font-mono text-[9px] text-[var(--t2)]">{extra}</p>}
    </div>
  )
}

function JsonbCell({
  label,
  current,
  ruleV1,
}: {
  label: string
  current: unknown
  ruleV1: unknown
}) {
  const curStr = current ? compactJson(current) : null
  const ruleStr = ruleV1 ? compactJson(ruleV1) : null
  const changed = curStr !== ruleStr && curStr != null

  return (
    <div
      className={`rounded-[var(--r-md)] border p-2 ${
        changed ? 'border-[#8B5CF6]/40 bg-[#8B5CF61A]' : 'border-[var(--bd)] bg-[var(--bg2)]'
      }`}
    >
      <p className="font-mono text-[9px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
        {label}
      </p>
      <p className="mt-0.5 break-all font-mono text-[10px] text-[var(--t1)]">
        {curStr ?? (
          <span className="font-body text-[10px] font-[500] text-[var(--t2)]">—</span>
        )}
      </p>
      {ruleStr && ruleStr !== curStr && (
        <p className="mt-0.5 break-all font-mono text-[9px] text-[var(--t2)]">
          rule_v1: {ruleStr}
        </p>
      )}
    </div>
  )
}

function JsonPreview({ label, value }: { label: string; value: unknown }) {
  return (
    <details className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-2 py-1">
      <summary className="cursor-pointer font-mono text-[10px] text-[var(--t2)]">
        {label}{' '}
        <span className="text-[var(--t2)]">
          ({Array.isArray(value) ? `array[${value.length}]` : typeof value})
        </span>
      </summary>
      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-snug text-[var(--t2)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  )
}

function compactJson(v: unknown): string {
  try {
    const s = JSON.stringify(v)
    return s.length > 80 ? s.slice(0, 80) + '...' : s
  } catch {
    return String(v)
  }
}
