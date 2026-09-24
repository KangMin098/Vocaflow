// apps/web/src/app/admin/video/RequestsPanel.tsx
//
// 「요청」 탭 — 새 요청 만들기 + 요청 목록.
//
// 폼의 순서가 곧 기획의 순서다: **분야 → 대상 → 목적 → 수요자**, 그리고 그 수요자의 니즈를
// 바로 보여 준다. 니즈를 보고 메모를 쓰게 해야 요청이 「멋진 영상」이 아니라 「누구의 무슨 문제」가 된다.

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ArrowRight } from 'lucide-react'
import {
  AUDIENCE_LABEL,
  NEEDS,
  PHASE_LABEL,
  PURPOSE_LABEL,
  NEXT_STEP,
  type RequestAudience,
  type RequestPurpose,
} from '@vocaflow/video-factory/requests'

import type { RequestBoard } from '@/lib/admin/video-requests'
import { createVideoRequestAction } from './actions'

const FORMAT_LABEL: Record<string, string> = { wide: '가로 16:9', vertical: '세로 9:16', square: '정사각 1:1' }
const CUSTOM = '__custom__'

const fieldCls =
  'min-h-[44px] w-full rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-body text-[13px] text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]'
const labelCls = 'mb-1 block font-body text-[12px] font-[600] text-[var(--t2)]'

function Choice<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-[44px] rounded-[var(--r-sm)] border px-3 font-body text-[13px] transition-colors duration-[var(--dur-normal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)] ${
            value === o.value
              ? 'border-[var(--p)] bg-[var(--p-light)] font-[700] text-[var(--t1)]'
              : 'border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)]'
          }`}
        >
          {value === o.value ? '● ' : '○ '}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function RequestsPanel({ board }: { board: RequestBoard }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const firstDomain = board.domains.find((d) => d.enabled)
  const [domainId, setDomainId] = useState(firstDomain?.id ?? '')
  const domain = board.domains.find((d) => d.id === domainId) ?? null
  const targets = useMemo(
    () => board.targets.filter((t) => domain?.target_kinds.includes(t.kind)),
    [board.targets, domain],
  )
  const [targetKey, setTargetKey] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const [purpose, setPurpose] = useState<RequestPurpose>('buy')
  const [audience, setAudience] = useState<RequestAudience>('student')
  const [formats, setFormats] = useState<string[]>(['wide', 'vertical', 'square'])
  const [memo, setMemo] = useState('')

  const need = NEEDS[purpose][audience]
  const target = targets.find((t) => t.key === targetKey) ?? null

  if (!board.ready) {
    return (
      <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 font-body text-[13px] text-[var(--t2)]">
        요청 표를 읽지 못했습니다 — 마이그레이션 <code className="font-mono">20260924120000_video_requests</code> 가
        적용됐는지 확인하세요.
      </p>
    )
  }

  const submit = () => {
    setError(null)
    const isCustom = targetKey === CUSTOM
    const key = isCustom ? customLabel.trim() : targetKey
    const label = isCustom ? customLabel.trim() : target?.label ?? ''
    start(async () => {
      const r = await createVideoRequestAction({
        domainId,
        targetKey: key,
        targetLabel: label,
        purpose,
        audience,
        formats,
        memo,
      })
      if (!r.ok || !r.data) {
        setError(r.error ?? '요청을 만들지 못했습니다')
        return
      }
      router.push(`/admin/video/requests/${r.data.id}`)
    })
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* ── 새 요청 ── */}
      <form
        className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <h2 className="mb-3 font-display text-[16px] font-[800] text-[var(--t1)]">새 요청</h2>

        <label className={labelCls} htmlFor="vr-domain">분야</label>
        <select
          id="vr-domain"
          className={`${fieldCls} mb-1`}
          value={domainId}
          onChange={(e) => {
            setDomainId(e.target.value)
            setTargetKey('')
          }}
        >
          {board.domains.filter((d) => d.enabled).map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
        {domain && <p className="mb-3 break-keep font-body text-[11px] text-[var(--t3)]">{domain.description}</p>}

        <label className={labelCls} htmlFor="vr-target">대상</label>
        <select id="vr-target" className={`${fieldCls} mb-1`} value={targetKey} onChange={(e) => setTargetKey(e.target.value)}>
          <option value="">— 고르세요 ({targets.length}개)</option>
          {targets.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
              {t.hasRuleVideo ? ' · 기존 편 있음' : ''}
              {t.backing === 0 ? ' · 재고 0' : ''}
            </option>
          ))}
          {domain?.allow_custom_target && <option value={CUSTOM}>직접 입력…</option>}
        </select>
        {targetKey === CUSTOM && (
          <input
            aria-label="대상 직접 입력"
            className={`${fieldCls} mb-1`}
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="예: 여름 특강 안내"
          />
        )}
        {target?.backing === 0 && (
          <p className="mb-1 break-keep font-body text-[12px] text-[var(--warning)]">
            ⚠ 이 권은 문항이 0개입니다 — 지금 찍으면 빈 서가를 광고하게 됩니다.
          </p>
        )}
        {target?.hasRuleVideo && (
          <p className="mb-1 break-keep font-body text-[11px] text-[var(--t3)]">
            기존 규칙 편({target.key})이 설계의 출발점이 됩니다.
          </p>
        )}

        <p className={`${labelCls} mt-3`}>목적</p>
        <Choice
          name="목적"
          value={purpose}
          onChange={setPurpose}
          options={(Object.keys(PURPOSE_LABEL) as RequestPurpose[]).map((v) => ({ value: v, label: PURPOSE_LABEL[v] }))}
        />

        <p className={`${labelCls} mt-3`}>수요자</p>
        <Choice
          name="수요자"
          value={audience}
          onChange={setAudience}
          options={(Object.keys(AUDIENCE_LABEL) as RequestAudience[]).map((v) => ({ value: v, label: AUDIENCE_LABEL[v] }))}
        />

        {/* 니즈 — 기획의 출발점. 설계자 에이전트가 같은 정의를 받는다 */}
        <dl className="mt-3 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 rounded-[var(--r-sm)] bg-[var(--bg2)] px-3 py-2 font-body text-[12px]">
          <dt className="text-[var(--t3)]">원하는 것</dt><dd className="break-keep text-[var(--t1)]">{need.wants}</dd>
          <dt className="text-[var(--t3)]">문제</dt><dd className="break-keep text-[var(--t1)]">{need.pain}</dd>
          <dt className="text-[var(--t3)]">망설임</dt><dd className="break-keep text-[var(--t1)]">{need.doubt}</dd>
          <dt className="text-[var(--t3)]">다음 행동</dt><dd className="break-keep text-[var(--t1)]">{need.nextStep}</dd>
        </dl>

        <p className={`${labelCls} mt-3`}>규격</p>
        <div role="group" aria-label="규격" className="flex flex-wrap gap-2">
          {Object.entries(FORMAT_LABEL).map(([f, l]) => {
            const on = formats.includes(f)
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => setFormats((cur) => (on ? cur.filter((x) => x !== f) : [...cur, f]))}
                className={`min-h-[44px] rounded-[var(--r-sm)] border px-3 font-body text-[13px] transition-colors duration-[var(--dur-normal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)] ${
                  on
                    ? 'border-[var(--p)] bg-[var(--p-light)] font-[700] text-[var(--t1)]'
                    : 'border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)]'
                }`}
              >
                {on ? '✓ ' : '+ '}
                {l}
              </button>
            )
          })}
        </div>

        <label className={`${labelCls} mt-3`} htmlFor="vr-memo">메모 — 꼭 넣을 것 · 피할 것 · 쓸 곳</label>
        <textarea
          id="vr-memo"
          className={`${fieldCls} min-h-[88px] py-2`}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />

        {error && (
          <p role="alert" className="mt-3 break-keep font-body text-[13px] text-[var(--error-ink)]">✗ {error}</p>
        )}
        <button
          type="submit"
          disabled={pending || !domainId || !targetKey || (targetKey === CUSTOM && !customLabel.trim()) || formats.length === 0}
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-sm)] bg-[var(--p)] px-4 font-body text-[13px] font-[700] text-[var(--on-p)] transition-opacity duration-[var(--dur-normal)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
        >
          {pending ? '만드는 중…' : '요청 만들기'}
        </button>
      </form>

      {/* ── 요청 목록 ── */}
      <div>
        <h2 className="mb-3 font-display text-[16px] font-[800] text-[var(--t1)]">요청 {board.requests.length}건</h2>
        {board.requests.length === 0 ? (
          <p className="break-keep font-body text-[13px] text-[var(--t3)]">아직 요청이 없습니다. 왼쪽에서 만드세요.</p>
        ) : (
          <ul className="divide-y divide-[var(--bd)] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]">
            {board.requests.map((r) => {
              const next = NEXT_STEP[r.phase]
              return (
                <li key={r.id}>
                  <Link
                    href={`/admin/video/requests/${r.id}`}
                    className="flex min-h-[44px] items-start gap-3 px-4 py-3 transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--p)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-keep font-body text-[13px] font-[700] text-[var(--t1)]">{r.target_label}</p>
                      <p className="font-body text-[11px] text-[var(--t3)]">
                        {board.domains.find((d) => d.id === r.domain_id)?.label ?? r.domain_id} · {PURPOSE_LABEL[r.purpose]} ·{' '}
                        {AUDIENCE_LABEL[r.audience]} · rev {r.current_rev}
                      </p>
                      <p className="mt-1 break-keep font-body text-[11px] text-[var(--t2)]">
                        {next.who === 'admin' ? '▶ 내 차례 — 검토' : next.who === 'agent' ? '⚙ 에이전트 차례 — 명령은 상세 화면에' : next.text}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-[var(--r-sm)] border px-2 py-0.5 font-body text-[11px] font-[700] ${
                        next.who === 'admin'
                          ? 'border-[var(--p)] text-[var(--t1)]'
                          : r.phase === 'failed'
                            ? 'border-[var(--bde)] text-[var(--error-ink)]'
                            : 'border-[var(--bd)] text-[var(--t2)]'
                      }`}
                    >
                      {r.phase === 'failed' ? '✗ ' : ''}
                      {PHASE_LABEL[r.phase]}
                    </span>
                    <ArrowRight size={14} aria-hidden className="mt-1 shrink-0 text-[var(--t3)]" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
