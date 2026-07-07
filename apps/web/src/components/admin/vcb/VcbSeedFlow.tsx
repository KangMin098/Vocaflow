'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Terminal,
  Upload,
} from 'lucide-react'
import {
  generateSeedSpec,
  checkSeedJobStatus,
  importSeedList,
  runSeedListCommand,
  type SeedJobStatus,
} from '@/lib/vcb/server/seed'

interface Props {
  runId: number
  collectionSlug: string
  collectionTitle: string
  runStatus: string
  initialStatus: SeedJobStatus
  initialConfig: {
    target_count?: number
    domain_hints?: string[]
    must_include_keywords?: string[]
    must_exclude_keywords?: string[]
    reference_seeds?: string
  }
}

const DEFAULT_LICENSE = 'AI-generated; must not replicate any copyrighted vocabulary list or textbook word list. Output is original synthesis based on general English vocabulary frequency patterns.'

export function VcbSeedFlow({
  runId,
  collectionSlug,
  collectionTitle,
  runStatus,
  initialStatus,
  initialConfig,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<SeedJobStatus>(initialStatus)
  const [actionError, setActionError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{
    inserted: number
    skipped: number
    total: number
    source_slug: string
  } | null>(null)

  // Spec form
  const [targetCount, setTargetCount] = useState<number>(initialConfig.target_count ?? 2000)
  const [domainHints, setDomainHints] = useState<string>(
    (initialConfig.domain_hints ?? []).join('\n'),
  )
  const [mustInclude, setMustInclude] = useState<string>(
    (initialConfig.must_include_keywords ?? []).join(', '),
  )
  const [mustExclude, setMustExclude] = useState<string>(
    (initialConfig.must_exclude_keywords ?? []).join(', '),
  )
  const [referenceSeeds, setReferenceSeeds] = useState<string>(
    initialConfig.reference_seeds ?? '',
  )
  const [licenseConstraint, setLicenseConstraint] = useState<string>(DEFAULT_LICENSE)
  const [runModel, setRunModel] = useState<'opus' | 'sonnet'>('opus')
  const [autoNavigating, setAutoNavigating] = useState<boolean>(false)
  const prevSeedListExists = useRef<boolean>(initialStatus.seed_list_exists)

  const canGenerate = !isPending && targetCount >= 50 && targetCount <= 10000
  const canRefresh = !isPending && status.spec_exists
  const canRun =
    !isPending &&
    status.spec_exists &&
    !status.seed_list_exists &&
    !status.running
  const canImport =
    !isPending &&
    status.seed_list_exists &&
    (runStatus === 'created' || runStatus === 'ingesting')

  const handleGenerate = () => {
    setActionError(null)
    startTransition(async () => {
      const result = await generateSeedSpec({
        run_id: runId,
        target_count: targetCount,
        domain_hints: domainHints,
        must_include_keywords: mustInclude,
        must_exclude_keywords: mustExclude,
        reference_seeds: referenceSeeds,
        license_constraint: licenseConstraint,
      })
      if (!result.ok) {
        setActionError(result.error ?? 'spec generation failed')
        return
      }
      const fresh = await checkSeedJobStatus(runId)
      if (fresh.ok && fresh.data) setStatus(fresh.data)
      router.refresh()
    })
  }

  // Auto-poll while runner is in progress (5s cadence)
  useEffect(() => {
    if (!status.running) return
    const id = setInterval(async () => {
      const fresh = await checkSeedJobStatus(runId)
      if (fresh.ok && fresh.data) setStatus(fresh.data)
    }, 5000)
    return () => clearInterval(id)
  }, [status.running, runId])

  // Auto-navigate to preview when seed-list.jsonl transitions false → true
  // during this session (e.g., user clicked AI 실행 and result just appeared).
  useEffect(() => {
    const wasExists = prevSeedListExists.current
    prevSeedListExists.current = status.seed_list_exists
    if (!wasExists && status.seed_list_exists && !autoNavigating) {
      setAutoNavigating(true)
      // Tiny delay so the UI can show the success indicator before navigation
      const t = setTimeout(() => {
        router.push(`/admin/vocab/runs/${runId}/seed/preview`)
      }, 1200)
      return () => clearTimeout(t)
    }
  }, [status.seed_list_exists, autoNavigating, router, runId])

  const handleRefresh = () => {
    setActionError(null)
    startTransition(async () => {
      const fresh = await checkSeedJobStatus(runId)
      if (!fresh.ok || !fresh.data) {
        setActionError(fresh.error ?? 'refresh failed')
        return
      }
      setStatus(fresh.data)
    })
  }

  const handleRun = () => {
    setActionError(null)
    startTransition(async () => {
      const result = await runSeedListCommand(runId, { model: runModel })
      if (!result.ok) {
        setActionError(result.error ?? 'run trigger failed')
        return
      }
      const fresh = await checkSeedJobStatus(runId)
      if (fresh.ok && fresh.data) setStatus(fresh.data)
    })
  }

  const handleImport = () => {
    setActionError(null)
    setImportResult(null)
    startTransition(async () => {
      const result = await importSeedList(runId)
      if (!result.ok || !result.data) {
        setActionError(result.error ?? 'import failed')
        return
      }
      setImportResult({
        inserted: result.data.inserted,
        skipped: result.data.skipped,
        total: result.data.total,
        source_slug: result.data.source_slug,
      })
      router.refresh()
    })
  }

  const slashCommand = status.spec_file
    ? `/vcb-seed-list exports/vcb-jobs/${status.spec_file}`
    : null

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ────────────────────────────── */}
      <div
        className="p-4 rounded-[var(--r-lg)] border"
        style={{ background: 'var(--bg2)', borderColor: 'var(--bd)' }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center shrink-0"
            style={{ background: 'var(--p-light)', color: 'var(--p)' }}
          >
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              className="font-display font-semibold text-lg mb-1"
              style={{ color: 'var(--t1)' }}
            >
              Method B — AI 시드 생성
            </h2>
            <p className="text-sm" style={{ color: 'var(--t2)' }}>
              {collectionTitle} · <span className="font-mono">{collectionSlug}</span> · status{' '}
              <span className="font-mono">{runStatus}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Step 1: Spec ──────────────────────── */}
      <Section
        step={1}
        title="Seed spec 생성"
        description="Claude Code 슬래시 명령에 전달할 spec 파일을 생성합니다."
        done={status.spec_exists}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="목표 단어 수" hint="50 ~ 10,000">
            <input
              type="number"
              value={targetCount}
              onChange={(e) => setTargetCount(parseInt(e.target.value, 10) || 0)}
              min={50}
              max={10000}
              className="w-full px-3 py-2 rounded-[var(--r-md)] border font-mono text-sm"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--bd)',
                color: 'var(--t1)',
              }}
              disabled={isPending}
            />
          </Field>

          <Field label="라이선스 제약" hint="저작권 보호 자료 복제 금지">
            <textarea
              value={licenseConstraint}
              onChange={(e) => setLicenseConstraint(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-[var(--r-md)] border text-sm resize-none"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--bd)',
                color: 'var(--t1)',
              }}
              disabled={isPending}
            />
          </Field>

          <Field
            label="도메인 힌트"
            hint="한 줄에 하나씩. 예: 수능 영어 빈출 / 일반 학습자 어휘"
            full
          >
            <textarea
              value={domainHints}
              onChange={(e) => setDomainHints(e.target.value)}
              rows={3}
              placeholder="고등학교 영어 빈출&#10;일반 학습자 어휘"
              className="w-full px-3 py-2 rounded-[var(--r-md)] border text-sm resize-none"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--bd)',
                color: 'var(--t1)',
              }}
              disabled={isPending}
            />
          </Field>

          <Field label="필수 포함 키워드" hint="쉼표 구분 (선택)">
            <input
              type="text"
              value={mustInclude}
              onChange={(e) => setMustInclude(e.target.value)}
              placeholder="academic, formal"
              className="w-full px-3 py-2 rounded-[var(--r-md)] border text-sm"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--bd)',
                color: 'var(--t1)',
              }}
              disabled={isPending}
            />
          </Field>

          <Field label="제외 키워드" hint="쉼표 구분 (선택)">
            <input
              type="text"
              value={mustExclude}
              onChange={(e) => setMustExclude(e.target.value)}
              placeholder="slang, vulgar"
              className="w-full px-3 py-2 rounded-[var(--r-md)] border text-sm"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--bd)',
                color: 'var(--t1)',
              }}
              disabled={isPending}
            />
          </Field>

          <Field label="참고 시드" hint="자유 형식 가이드 (선택)" full>
            <textarea
              value={referenceSeeds}
              onChange={(e) => setReferenceSeeds(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-[var(--r-md)] border text-sm resize-none"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--bd)',
                color: 'var(--t1)',
              }}
              disabled={isPending}
            />
          </Field>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-md)] font-display text-sm font-semibold disabled:opacity-50"
            style={{
              background: 'var(--p)',
              color: 'var(--ti)',
            }}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {status.spec_exists ? 'Spec 재생성' : 'Spec 생성'}
          </button>
          {status.spec_exists && status.spec_file ? (
            <span className="text-xs font-mono" style={{ color: 'var(--t3)' }}>
              {status.spec_file}
            </span>
          ) : null}
        </div>
      </Section>

      {/* ── Step 2: Run seed-list (claude -p detached) ─ */}
      <Section
        step={2}
        title="AI 시드 목록 생성 (자동 실행)"
        description="AI 가 시드 단어 목록을 자동 생성합니다. 보통 5~15분 정도 걸립니다."
        done={status.seed_list_exists}
        disabled={!status.spec_exists}
      >
        {/* Model picker + run button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-display" style={{ color: 'var(--t2)' }}>
              모델
            </span>
            <div
              className="inline-flex rounded-[var(--r-md)] border overflow-hidden"
              style={{ borderColor: 'var(--bd)' }}
            >
              {(['opus', 'sonnet'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRunModel(m)}
                  disabled={status.running || isPending}
                  className="px-3 py-1.5 text-xs font-mono disabled:opacity-50"
                  style={{
                    background: runModel === m ? 'var(--p)' : 'var(--bg)',
                    color: runModel === m ? 'var(--ti)' : 'var(--t2)',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleRun}
            disabled={!canRun}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-md)] font-display text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--p)', color: 'var(--ti)' }}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {status.running ? '실행 중…' : 'AI 실행'}
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={!canRefresh}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--r-md)] text-sm border disabled:opacity-50"
            style={{
              background: 'var(--bg)',
              borderColor: 'var(--bd)',
              color: 'var(--t2)',
            }}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            상태 새로고침
          </button>
        </div>

        {/* Running indicator */}
        {status.running ? (
          <div
            className="mt-3 p-3 rounded-[var(--r-md)] flex items-start gap-2"
            style={{ background: 'var(--info-light)', color: 'var(--info)' }}
          >
            <Loader2 className="w-5 h-5 shrink-0 mt-0.5 animate-spin" />
            <div className="text-sm flex-1 min-w-0">
              <div className="font-semibold">실행 중 · 자동 폴링 (5s)</div>
              <div className="text-xs mt-1">
                pid {status.running_pid ?? 'n/a'}
                {status.running_elapsed_seconds !== null
                  ? ` · 경과 ${formatElapsed(status.running_elapsed_seconds)}`
                  : null}
                {' · 5~15분 소요 예상 · 완료 시 미리보기로 자동 이동'}
              </div>
            </div>
          </div>
        ) : null}

        {/* Auto-navigate indicator */}
        {autoNavigating && (
          <div
            className="mt-3 p-3 rounded-[var(--r-md)] flex items-start gap-2"
            style={{ background: 'var(--success-light)', color: 'var(--success)' }}
            role="status"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm flex-1 min-w-0">
              <div className="font-semibold">생성 완료 · 미리보기로 이동합니다…</div>
              <div className="text-xs mt-1" style={{ color: 'var(--t2)' }}>
                {status.seed_list_line_count.toLocaleString()}건 lemma 감지됨
              </div>
            </div>
          </div>
        )}

        {/* File status row */}
        {status.spec_exists ? (
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <FileStatus
              label="seed-list.jsonl"
              exists={status.seed_list_exists}
              extra={
                status.seed_list_exists ? `${status.seed_list_line_count} 단어` : undefined
              }
            />
            <FileStatus
              label="validation.json"
              exists={status.validation_exists}
              extra={
                status.validation_exists && status.validation_ok !== null
                  ? status.validation_ok
                    ? 'ok'
                    : 'fail'
                  : undefined
              }
              error={status.validation_exists && status.validation_ok === false}
            />
            {status.error_exists ? (
              <FileStatus label="error.json" exists error />
            ) : null}
          </div>
        ) : null}

        {status.validation_exists && status.validation_summary ? (
          <p
            className="text-xs mt-2 px-3 py-2 rounded-[var(--r-md)]"
            style={{
              background:
                status.validation_ok === false ? 'var(--error-light)' : 'var(--bg2)',
              color: status.validation_ok === false ? 'var(--error)' : 'var(--t2)',
            }}
          >
            {status.validation_summary}
          </p>
        ) : null}

        {status.error_exists && status.error_summary ? (
          <p
            className="text-xs mt-2 px-3 py-2 rounded-[var(--r-md)]"
            style={{ background: 'var(--error-light)', color: 'var(--error)' }}
          >
            {status.error_summary}
          </p>
        ) : null}

        {/* Log tail */}
        {status.log_tail ? (
          <details className="mt-3">
            <summary
              className="cursor-pointer inline-flex items-center gap-1 text-xs font-mono"
              style={{ color: 'var(--t3)' }}
            >
              <Terminal className="w-3 h-3" />
              로그 ({status.log_file})
            </summary>
            <pre
              className="mt-2 p-3 rounded-[var(--r-md)] text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all"
              style={{
                background: 'var(--bg3)',
                color: 'var(--t2)',
                maxHeight: '240px',
                overflowY: 'auto',
              }}
            >
              {status.log_tail}
            </pre>
          </details>
        ) : null}

        {/* Manual fallback: slash command for VS Code Claude Code panel */}
        {slashCommand && !status.running && !status.seed_list_exists ? (
          <details className="mt-3">
            <summary
              className="cursor-pointer text-xs"
              style={{ color: 'var(--t3)' }}
            >
              수동 실행 (VS Code Claude Code 패널 또는 terminal)
            </summary>
            <div className="mt-2 flex items-center gap-2">
              <code
                className="flex-1 px-3 py-2 rounded-[var(--r-md)] font-mono text-xs border break-all"
                style={{
                  background: 'var(--bg)',
                  borderColor: 'var(--bd)',
                  color: 'var(--t2)',
                }}
              >
                {slashCommand}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(slashCommand)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-[var(--r-md)] text-xs border"
                style={{
                  background: 'var(--bg)',
                  borderColor: 'var(--bd)',
                  color: 'var(--t2)',
                }}
                title="복사"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </details>
        ) : null}
      </Section>

      {/* ── Step 3: Preview & Import ────────────── */}
      <Section
        step={3}
        title="미리보기 후 DB 적재"
        description="결과를 둘러보고 의심스러운 단어를 거부 표시한 뒤 시드 단어로 등록합니다."
        done={runStatus !== 'created' && runStatus !== 'ingesting'}
        disabled={!status.seed_list_exists}
      >
        {status.seed_list_exists && canImport ? (
          <Link
            href={`/admin/vocab/runs/${runId}/seed/preview`}
            className="group flex items-center gap-4 p-4 rounded-[var(--r-lg)] border transition-colors"
            style={{
              background: 'var(--bg2)',
              borderColor: 'var(--p)',
            }}
          >
            <div
              className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center shrink-0"
              style={{ background: 'var(--p-light)', color: 'var(--p)' }}
            >
              <Eye className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="font-display font-semibold text-base"
                style={{ color: 'var(--t1)' }}
              >
                {status.seed_list_line_count.toLocaleString()}건 미리보기 →
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
                CEFR 분포 · 신뢰도 · spec 매치 확인 후 import
              </div>
            </div>
            <ArrowRight
              className="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-0.5"
              style={{ color: 'var(--p)' }}
            />
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleImport}
            disabled={!canImport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-md)] font-display text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--p)', color: 'var(--ti)' }}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            DB 에 import (미리보기 없이)
          </button>
        )}

        {!canImport && status.seed_list_exists ? (
          <p className="text-xs mt-2" style={{ color: 'var(--t3)' }}>
            현재 status 가 <span className="font-mono">{runStatus}</span> 입니다. import 는
            created 또는 ingesting 상태에서만 가능합니다.
          </p>
        ) : null}

        {importResult ? (
          <div
            className="mt-3 p-3 rounded-[var(--r-md)] flex items-start gap-2"
            style={{ background: 'var(--success-light)', color: 'var(--success)' }}
          >
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold">Import 완료</div>
              <div className="text-xs mt-1">
                source: <span className="font-mono">{importResult.source_slug}</span> · 신규{' '}
                {importResult.inserted} / 중복 {importResult.skipped} / 전체{' '}
                {importResult.total}
              </div>
            </div>
          </div>
        ) : null}
      </Section>

      {actionError ? (
        <div
          className="p-3 rounded-[var(--r-md)] flex items-start gap-2"
          style={{ background: 'var(--error-light)', color: 'var(--error)' }}
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">{actionError}</p>
        </div>
      ) : null}
    </div>
  )
}

// ── helpers ────────────────────────────────────

function formatElapsed(s: number): string {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}m ${r}s`
}

function Section({
  step,
  title,
  description,
  done,
  disabled,
  children,
}: {
  step: number
  title: string
  description: string
  done?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className="p-5 rounded-[var(--r-lg)] border"
      style={{
        background: 'var(--bg)',
        borderColor: done ? 'var(--success)' : 'var(--bd)',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center font-display text-sm font-bold shrink-0"
          style={{
            background: done ? 'var(--success)' : 'var(--p-light)',
            color: done ? 'var(--ti)' : 'var(--p)',
          }}
        >
          {done ? <CheckCircle2 className="w-4 h-4" /> : step}
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className="font-display font-semibold text-base m-0"
            style={{ color: 'var(--t1)' }}
          >
            {title}
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  hint,
  full,
  children,
}: {
  label: string
  hint?: string
  full?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={full ? 'md:col-span-2' : undefined}>
      <label
        className="block font-display font-semibold text-xs uppercase tracking-wider mb-1"
        style={{ color: 'var(--t2)' }}
      >
        {label}
      </label>
      {hint ? (
        <p className="text-xs mb-2" style={{ color: 'var(--t3)' }}>
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  )
}

function FileStatus({
  label,
  exists,
  extra,
  error,
}: {
  label: string
  exists: boolean
  extra?: string
  error?: boolean
}) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: !exists ? 'var(--t4)' : error ? 'var(--error)' : 'var(--success)',
        }}
      />
      <span className="font-mono" style={{ color: 'var(--t2)' }}>
        {label}
      </span>
      {extra ? (
        <span style={{ color: error ? 'var(--error)' : 'var(--t3)' }}>· {extra}</span>
      ) : null}
    </div>
  )
}
