'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react'
import {
  generateSeedSpec,
  checkSeedJobStatus,
  importSeedList,
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

  const canGenerate = !isPending && targetCount >= 50 && targetCount <= 10000
  const canRefresh = !isPending && status.spec_exists
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

      {/* ── Step 2: Slash command ─────────────── */}
      <Section
        step={2}
        title="Claude Code 슬래시 명령 실행"
        description="VS Code 의 Claude Code 세션에서 아래 명령을 실행하면 같은 디렉토리에 -seed-list.jsonl + validation.json 이 생성됩니다."
        done={status.seed_list_exists}
        disabled={!status.spec_exists}
      >
        {slashCommand ? (
          <div className="flex items-center gap-2">
            <code
              className="flex-1 px-3 py-2 rounded-[var(--r-md)] font-mono text-sm border break-all"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--bd)',
                color: 'var(--t1)',
              }}
            >
              {slashCommand}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(slashCommand)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-[var(--r-md)] text-sm border"
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
        ) : (
          <p className="text-sm" style={{ color: 'var(--t3)' }}>
            Step 1 에서 spec 을 먼저 생성하세요.
          </p>
        )}

        {status.spec_exists ? (
          <div className="flex items-center gap-3 mt-4">
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
              파일 감지 새로고침
            </button>
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
      </Section>

      {/* ── Step 3: Import ──────────────────────── */}
      <Section
        step={3}
        title="DB 적재"
        description="seed-list.jsonl 을 vocab_sources + vocab_seed_candidates 에 적재하고 run status 를 extracted 로 진행합니다."
        done={runStatus !== 'created' && runStatus !== 'ingesting'}
        disabled={!status.seed_list_exists}
      >
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
          DB 에 import
        </button>

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
