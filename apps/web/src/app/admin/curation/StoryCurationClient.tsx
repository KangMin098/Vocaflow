// apps/web/src/app/admin/curation/StoryCurationClient.tsx
//
// LCP Story S4 — /admin/curation 의 「이야기 판본」 작업 라인.
//
// 흐름: 후보 파일 검사 → 원천 등록 → 편집 기준 등록 → 판본 제출 → 다른 스태프 검수 → admin 권리 결정 → 검증 증인 → admin 발행 → 철회.
// 모든 쓰기는 명시적 버튼으로만 일어난다 — 목록 · 번들 · 화면 진입은 읽기만 한다.
// 화면의 생산자 · 검수자 · 보는 계정 표기는 안내용이며 권한 근거가 아니다(서버가 쿠키 세션 · 역할로, DB 가 다시 판정한다).
// 원문 · 파일 내용은 URL · 브라우저 저장소에 남기지 않는다(URL 에는 story_slot · story_panel 식별자만). 텔레메트리 없음.
// 도움말: lib/admin/help/curation.ts 의 tabs['이야기 판본'] — 화면을 바꾸면 같은 변경에서 고친다.

'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'next/navigation'

import {
  attestStoryValidationAction,
  checkStoryCandidateAction,
  publishStoryAction,
  recordStoryRightsAction,
  registerStoryCandidateAction,
  submitStoryReviewAction,
  withdrawStoryAction,
} from '@/app/admin/curation/story-actions'
import { storyHref, storyLocation, type StoryPanel } from '@/lib/admin/curation-view'
import { updateAdminUrl } from '@/lib/admin/navigation'
import { readStoryBundle, readStorySlots } from '@/lib/library/story/admin-reader'
import { describeStoryCode } from '@/lib/library/story/messages'
import {
  STORY_UPLOAD_MAX_BYTES,
  type StoryBundle,
  type StoryCandidateCheck,
  type StoryFailure,
  type StoryRegisterResult,
  type StoryRegisterStep,
  type StoryResult,
  type StoryRightsStatus,
  type StorySlotRow,
  type StoryViewer,
} from '@/lib/library/story/types'

import {
  STORY_CHANGE_OPERATION_LABEL,
  candidatePlanLabel,
  STORY_CHANGE_TYPE_LABEL,
  STORY_COVERAGE_LABEL,
  STORY_KIND_LABEL,
  STORY_PLAN_LABEL,
  STORY_RIGHTS_ASSET_LABEL,
  STORY_RIGHTS_STATUS_LABEL,
  STORY_STEP_FILES,
  STORY_TEXT_RIGHTS_ASSETS,
  STORY_VERDICT_LABEL,
  buildStoryComparison,
  formatBytes,
  formatStoryTime,
  isStaleStoryFailure,
  nextStoryAction,
  readStoryArtifact,
  releaseStateLabel,
  safeSourceHref,
  shortHash,
  splitStoryParagraphs,
  storyRegisterGate,
  storyRightsRows,
  storySlotHistory,
  storySlotOrigin,
  storySlotState,
  uploadTotal,
  type StoryActionKind,
  type StoryUploadSlot,
  type ViewChange,
} from './story-view'
import styles from './story-curation.module.css'

// ── 공용 스타일 ─────────────────────────────────────────────────────────────

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bdf)]'
const BTN = `inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 text-sm font-semibold text-[var(--t1)] break-keep hover:border-[var(--bd-strong)] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`
const BTN_PRIMARY = `inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p)] px-4 text-sm font-semibold text-[var(--on-p)] break-keep hover:bg-[var(--p-hover)] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`
const BTN_DANGER = `inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--error)] bg-[var(--bg)] px-4 text-sm font-semibold text-[var(--error-ink)] break-keep disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`
const FIELD = `min-h-11 w-full rounded-[var(--r-md)] border border-[var(--bd-input)] bg-[var(--bg)] px-3 text-sm text-[var(--t1)] ${FOCUS}`
const LABEL = 'text-sm font-semibold text-[var(--t1)] break-keep'
const HINT = 'text-[13px] text-[var(--t2)] break-keep'
const H3 = 'font-display text-[15px] font-[700] text-[var(--t1)] break-keep'
const H4 = 'text-sm font-semibold text-[var(--t1)] break-keep'

function localFailure(code: string): StoryFailure {
  const described = describeStoryCode(code)
  return { ok: false, code, ...described, stage: 'rpc', issues: [] }
}

/** Server Action 호출 — 던지면(네트워크 · 서버 오류) 화면용 실패로 바꾼다. 원시 오류 문자열은 보이지 않는다. */
async function callStory<T>(run: () => Promise<StoryResult<T>>): Promise<StoryResult<T>> {
  try {
    return await run()
  } catch {
    return localFailure('network_failed')
  }
}

function Hash({ value, length = 12 }: { value: string | null | undefined; length?: number }) {
  return (
    <span className={styles.mono} title={value ?? undefined}>
      {shortHash(value, length)}
    </span>
  )
}

function Field({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[12px] text-[var(--t2)] break-keep">{term}</dt>
      <dd className="min-w-0 text-sm text-[var(--t1)]">{children}</dd>
    </div>
  )
}

// ── 결과 · 실패 알림 ─────────────────────────────────────────────────────────

type Notice = { tone: 'success'; text: string } | { tone: 'failure'; text: string; failure: StoryFailure } | null

export function StoryFailureNotice({
  failure,
  title,
  onRetry,
  onReload,
  pending = false,
}: {
  failure: StoryFailure
  title?: string
  onRetry?: () => void
  onReload?: () => void
  pending?: boolean
}) {
  const stale = isStaleStoryFailure(failure)
  return (
    <div className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--error)] bg-[var(--bg)] p-3">
      {title && <p className="text-sm font-semibold text-[var(--error-ink)] break-keep">{title}</p>}
      <p className="text-sm text-[var(--t1)] break-keep">{failure.message}</p>
      <p className="text-[13px] text-[var(--t2)] break-keep">
        <span className="font-semibold text-[var(--t1)]">할 일 · </span>
        {failure.recovery}
      </p>
      {failure.issues.length > 0 && (
        <ul aria-label="문제 목록" className="flex flex-col gap-1 border-t border-[var(--bd)] pt-2">
          {failure.issues.map((issue, index) => (
            <li key={`${issue.code}-${issue.path}-${index}`} className="flex min-w-0 flex-col text-[13px]">
              <span className="text-[var(--t1)] break-keep">{issue.message}</span>
              <span className="text-[var(--t2)]">
                <span className={styles.mono}>{issue.code}</span>
                {issue.path && (
                  <>
                    {' · '}
                    <span className={styles.mono}>{issue.path}</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {(stale && onReload) || (failure.retryable && onRetry) ? (
        <div className="flex flex-wrap gap-2">
          {stale && onReload && (
            <button type="button" className={BTN} onClick={onReload} disabled={pending}>
              최신 상태 다시 불러오기
            </button>
          )}
          {failure.retryable && onRetry && (
            <button type="button" className={BTN} onClick={onRetry} disabled={pending} aria-busy={pending || undefined}>
              다시 시도
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}

function NoticeRegion({
  notice,
  onRetry,
  onReload,
  pending,
}: {
  notice: Notice
  onRetry?: () => void
  onReload?: () => void
  pending?: boolean
}) {
  return (
    <div role="status" aria-live="polite">
      {notice?.tone === 'success' && (
        <p className="rounded-[var(--r-md)] border border-[var(--success)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--success-ink)] break-keep">
          {notice.text}
        </p>
      )}
      {notice?.tone === 'failure' && (
        <StoryFailureNotice
          failure={notice.failure}
          title={notice.text}
          onRetry={onRetry}
          onReload={onReload}
          pending={pending}
        />
      )}
    </div>
  )
}

// ── 파일 입력 ───────────────────────────────────────────────────────────────

function FileInput({
  label,
  hint,
  file,
  onChange,
  disabled,
  inputKey,
}: {
  label: string
  hint: string
  file: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
  inputKey?: number
}) {
  const id = useId()
  const [emptyPicked, setEmptyPicked] = useState(false)
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input
        key={inputKey}
        id={id}
        type="file"
        accept=".json,application/json"
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          // 빈 파일(0 바이트)은 서버도 없는 것으로 본다 — 화면도 고르지 않은 것으로 다룬다.
          const picked = event.currentTarget.files?.[0] ?? null
          setEmptyPicked(picked !== null && picked.size === 0)
          onChange(picked && picked.size > 0 ? picked : null)
        }}
        className={`min-h-11 w-full min-w-0 rounded-[var(--r-md)] border border-[var(--bd-input)] bg-[var(--bg)] px-2 py-2 text-sm text-[var(--t1)] file:mr-3 file:min-h-9 file:rounded-[var(--r-sm)] file:border file:border-[var(--bd)] file:bg-[var(--bg2)] file:px-3 file:text-sm file:text-[var(--t1)] ${FOCUS}`}
      />
      <p id={`${id}-hint`} className={HINT}>
        {file ? (
          <>
            선택됨 · <span className={styles.mono}>{file.name}</span> · {formatBytes(file.size)}
          </>
        ) : emptyPicked ? (
          '빈 파일입니다 — 고르지 않은 것으로 봅니다. 내용이 있는 파일을 고르세요.'
        ) : (
          hint
        )}
      </p>
    </div>
  )
}

// ── 후보 파일 패널 ──────────────────────────────────────────────────────────

const STEP_LABEL: Record<StoryRegisterStep, string> = {
  source: '원천 등록',
  policy: '편집 기준 등록',
  edition: '판본 제출',
}

/** 단계별로 DB 에 저장된 결과 — 뒤 단계가 실패해도 앞 단계 결과는 그대로 남겨 보여 준다(롤백이 아니다). */
interface StepResults {
  source?: StoryRegisterResult['source']
  policy?: NonNullable<StoryRegisterResult['policy']>
  edition?: NonNullable<StoryRegisterResult['edition']>
}

function mergeRegisterResult(previous: StepResults, result: Partial<StoryRegisterResult>): StepResults {
  return {
    source: result.source ?? previous.source,
    policy: result.policy ?? previous.policy,
    edition: result.edition ?? previous.edition,
  }
}

export function storyStepResultText(step: StoryRegisterStep, results: StepResults): string | null {
  if (step === 'source' && results.source)
    return `${results.source.created ? '새로 등록됨' : '이미 있음 — 같은 원천을 그대로 이어 씁니다'} · 정체 ${shortHash(results.source.identity_sha256)}`
  if (step === 'policy' && results.policy)
    return `${results.policy.created ? '새로 등록됨' : '이미 있음 — 같은 편집 기준을 그대로 이어 씁니다'} · 판본 자리 ${results.policy.slots.length}개`
  if (step === 'edition' && results.edition)
    return `${results.edition.created ? '새 판으로 제출됨' : '같은 판이 이미 있음'} · ${STORY_PLAN_LABEL[results.edition.plan_status]}`
  return null
}

export function StoryCandidateReport({ check }: { check: StoryCandidateCheck }) {
  const fileLabel = { source: '원천 스냅숏', policy: '편집 기준', edition: '판본 결과물', review: '검수 결과' } as const
  return (
    <div className="flex flex-col gap-4" aria-label="파일 검사 결과">
      <ul className="flex flex-col gap-2">
        {check.files.map((file) => (
          <li key={file.file} className="flex min-w-0 flex-col gap-1 border-b border-[var(--bd)] pb-2 last:border-b-0">
            <p className="text-sm break-keep">
              <span className="font-semibold">{fileLabel[file.file]}</span>
              {' · '}
              <span className={file.ok ? 'text-[var(--success-ink)]' : 'text-[var(--error-ink)]'}>
                {file.ok ? '검사 통과' : `문제 ${file.issues.length}건`}
              </span>
            </p>
            {file.issues.length > 0 && (
              <ul className="flex flex-col gap-1 pl-3">
                {file.issues.map((issue, index) => (
                  <li key={`${issue.code}-${index}`} className="flex min-w-0 flex-col text-[13px]">
                    <span className="break-keep">{issue.message}</span>
                    <span className="text-[var(--t2)]">
                      <span className={styles.mono}>{issue.code}</span>
                      {issue.path && (
                        <>
                          {' · '}
                          <span className={styles.mono}>{issue.path}</span>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {check.source && (
        <section aria-label="원천 스냅숏 요약" className="flex flex-col gap-2">
          <h4 className={H4}>원천 스냅숏</h4>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field term="작품 키">
              <span className={styles.mono}>{check.source.work_key}</span>
            </Field>
            <Field term="문단 수">{check.source.paragraph_count}</Field>
            <Field term="범위">{STORY_COVERAGE_LABEL[check.source.coverage]}</Field>
            <Field term="원천 정체 해시">
              <Hash value={check.source.identity_sha256} />
            </Field>
            <Field term="본문 해시">
              <Hash value={check.source.text_sha256} />
            </Field>
            <Field term="합성 자료">{check.source.synthetic ? '예 — 적재할 수 없음' : '아니오'}</Field>
          </dl>
          <div className="flex flex-col gap-1">
            <p className={HINT}>권리 기록 — 파일의 주장 · 권한 근거 아님</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {check.source.rights.map((right) => (
                <li key={right.asset} className="break-keep">
                  {STORY_RIGHTS_ASSET_LABEL[right.asset]} · <span className={styles.mono}>{right.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {check.policy && (
        <section aria-label="편집 기준 요약" className="flex flex-col gap-2">
          <h4 className={H4}>
            편집 기준 · <Hash value={check.policy.policy_sha256} />
          </h4>
          <ul className="flex flex-col gap-1 text-sm">
            {check.policy.editions.map((edition) => (
              <li key={edition.edition_key} className="flex min-w-0 flex-wrap gap-x-2">
                <span className={styles.mono}>{edition.edition_key}</span>
                <span className="text-[var(--t2)] break-keep">
                  {STORY_KIND_LABEL[edition.kind]} · {STORY_COVERAGE_LABEL[edition.coverage]} ·{' '}
                  {STORY_CHANGE_TYPE_LABEL[edition.transformation] ?? edition.transformation}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {check.edition && (
        <section aria-label="판본 결과물 요약" className="flex flex-col gap-2">
          <h4 className={H4}>판본 결과물</h4>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field term="판본 키">
              <span className={styles.mono}>{check.edition.edition_key}</span>
            </Field>
            <Field term="단위 수">{check.edition.unit_count}</Field>
            <Field term="판본 해시">
              <Hash value={check.edition.edition_sha256} />
            </Field>
          </dl>
          <p
            className={`text-sm font-semibold break-keep ${
              check.edition.plan_status === 'candidate' ? 'text-[var(--t1)]' : 'text-[var(--warning-ink)]'
            }`}
          >
            계획 판정 · {candidatePlanLabel(check.edition)}
          </p>
          {check.edition.plan_reasons.length > 0 && (
            <ul className="flex flex-col gap-1 pl-3 text-[13px]">
              {check.edition.plan_reasons.map((reason, index) => (
                <li key={`${reason.code}-${index}`} className="flex min-w-0 flex-col">
                  <span className="break-keep">
                    {reason.blocks === 'fixture' ? '합성 자료' : '학습자 발행 차단'} · {reason.message}
                  </span>
                  <span className={`text-[var(--t2)] ${styles.mono}`}>{reason.code}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <p className={HINT}>
        {check.importable
          ? '적재할 수 있습니다. 등록 뒤에도 다른 스태프 검수 · admin 권리 결정 · 검증 증인을 거쳐야 발행할 수 있습니다.'
          : check.source?.synthetic || check.edition?.plan_reasons.some((reason) => reason.blocks === 'fixture')
            ? '합성(시험용) 자료는 원천 · 판본 어느 단계로도 적재하지 않습니다. 실제 원천으로 만든 파일을 고르세요.'
            : '이 조합은 아직 판본까지 적재할 수 없습니다. 위 문제를 고친 파일로 다시 검사하세요.'}
      </p>
    </div>
  )
}

export function StoryCandidatePanel({
  onClose,
  onRegistered,
}: {
  onClose: () => void
  onRegistered: (step: StoryRegisterStep, result: StoryRegisterResult) => Promise<void>
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [files, setFiles] = useState<Record<StoryUploadSlot, File | null>>({ source: null, policy: null, edition: null })
  const [check, setCheck] = useState<StoryCandidateCheck | null>(null)
  const [steps, setSteps] = useState<StepResults>({})
  const [pending, setPending] = useState<'check' | StoryRegisterStep | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const lastRun = useRef<(() => void) | null>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const setFile = (slot: StoryUploadSlot, file: File | null) => {
    setFiles((previous) => ({ ...previous, [slot]: file }))
    setCheck(null)
    setNotice(null)
    // 바뀐 파일을 쓰는 단계의 결과만 지운다 — 앞 단계(이미 DB 에 저장된 것)는 그대로 둔다.
    setSteps((previous) => {
      const next: StepResults = {}
      if (previous.source && !STORY_STEP_FILES.source.includes(slot)) next.source = previous.source
      if (previous.policy && !STORY_STEP_FILES.policy.includes(slot)) next.policy = previous.policy
      if (previous.edition && !STORY_STEP_FILES.edition.includes(slot)) next.edition = previous.edition
      return next
    })
  }

  const allSlots: StoryUploadSlot[] = ['source', 'policy', 'edition']
  const selectedSlots = allSlots.filter((slot) => files[slot])
  const total = uploadTotal(files, selectedSlots)
  const overLimit = total > STORY_UPLOAD_MAX_BYTES

  const runCheck = async () => {
    if (!files.source || overLimit) return
    lastRun.current = () => void runCheck()
    const form = new FormData()
    for (const slot of selectedSlots) form.append(slot, files[slot] as File)
    setPending('check')
    setNotice(null)
    const result = await callStory(() => checkStoryCandidateAction(form))
    setPending(null)
    if (result.ok) {
      setCheck(result.data)
      setNotice({ tone: 'success', text: '파일 검사를 마쳤습니다. DB 에는 아무것도 쓰지 않았습니다.' })
    } else {
      setCheck(null)
      setNotice({ tone: 'failure', text: '파일 검사 실패', failure: result })
    }
  }

  const runRegister = async (step: StoryRegisterStep) => {
    const needed = STORY_STEP_FILES[step]
    if (needed.some((slot) => !files[slot])) return
    if (uploadTotal(files, needed) > STORY_UPLOAD_MAX_BYTES) return
    lastRun.current = () => void runRegister(step)
    const form = new FormData()
    form.append('step', step)
    for (const slot of needed) form.append(slot, files[slot] as File)
    setPending(step)
    setNotice(null)
    const result = await callStory(() => registerStoryCandidateAction(form))
    setPending(null)
    if (result.ok) {
      const merged = mergeRegisterResult(steps, result.data)
      setSteps(merged)
      setNotice({ tone: 'success', text: `${STEP_LABEL[step]} · ${storyStepResultText(step, merged) ?? '완료'}` })
      await onRegistered(step, result.data)
    } else {
      const partial = result.partial
      if (partial) setSteps((previous) => mergeRegisterResult(previous, partial))
      setNotice({
        tone: 'failure',
        text: result.partial
          ? `${STEP_LABEL[step]} 실패 — 앞 단계는 저장되어 있습니다. 같은 파일로 이어서 다시 시도하세요.`
          : `${STEP_LABEL[step]} 실패`,
        failure: result,
      })
    }
  }

  return (
    <section
      aria-labelledby="story-files-title"
      className="flex flex-col gap-4 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id="story-files-title" ref={headingRef} tabIndex={-1} className={`${H3} outline-none`}>
            후보 파일 검사 · 등록
          </h3>
          <p className={HINT}>
            로컬 제작 드레인이 만든 파일을 올립니다. 서버가 검증기와 계획으로 다시 검사하고, 등록은 단계마다 올린 파일 전체를 다시
            검증합니다. 파일 내용은 이 브라우저에 저장하지 않습니다 — 이어 하려면 같은 파일을 다시 고르세요.
          </p>
        </div>
        <button type="button" className={BTN} onClick={onClose}>
          파일 패널 닫기
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FileInput
          label="원천 스냅숏 (필수)"
          hint="source.snapshot.json"
          file={files.source}
          onChange={(file) => setFile('source', file)}
          disabled={pending !== null}
        />
        <FileInput
          label="편집 기준"
          hint="편집 기준 등록 · 판본 제출에 필요"
          file={files.policy}
          onChange={(file) => setFile('policy', file)}
          disabled={pending !== null}
        />
        <FileInput
          label="판본 결과물"
          hint="판본 제출에 필요"
          file={files.edition}
          onChange={(file) => setFile('edition', file)}
          disabled={pending !== null}
        />
      </div>

      <p className={overLimit ? 'text-sm font-semibold text-[var(--error-ink)] break-keep' : HINT}>
        올릴 파일 합계 {formatBytes(total)} · 한 번에 올릴 수 있는 한도 {formatBytes(STORY_UPLOAD_MAX_BYTES)}
        {overLimit && ' — 한도를 넘어 보낼 수 없습니다. 본문을 발췌 스냅숏으로 나누거나 필요 없는 파일을 빼세요.'}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={!files.source || overLimit || pending !== null}
          aria-busy={pending === 'check' || undefined}
          onClick={() => void runCheck()}
        >
          {pending === 'check' ? '검사 중…' : '파일 검사'}
        </button>
        {!files.source && <span className={HINT}>원천 스냅숏을 먼저 고르세요.</span>}
      </div>

      {check && <StoryCandidateReport check={check} />}

      <ol aria-label="등록 단계" className="flex flex-col gap-2">
        {(['source', 'policy', 'edition'] as const).map((step, index) => {
          const previous = index === 0 ? null : (['source', 'policy'] as const)[index - 1]!
          const gate = storyRegisterGate(step, check)
          const missing = STORY_STEP_FILES[step].some((slot) => !files[slot])
          const waiting = previous !== null && !steps[previous]
          const overStep = uploadTotal(files, STORY_STEP_FILES[step]) > STORY_UPLOAD_MAX_BYTES
          const reason = missing
            ? '필요한 파일을 고르세요.'
            : !gate.ok
              ? gate.reason
              : waiting
                ? `먼저 ${STEP_LABEL[previous!]}을 마치세요.`
                : overStep
                  ? '파일 합계가 한도를 넘습니다.'
                  : null
          const result = storyStepResultText(step, steps)
          return (
            <li
              key={step}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--bd)] pt-2"
            >
              <button
                type="button"
                className={BTN}
                disabled={reason !== null || pending !== null}
                aria-busy={pending === step || undefined}
                onClick={() => void runRegister(step)}
              >
                {pending === step ? `${STEP_LABEL[step]} 중…` : STEP_LABEL[step]}
              </button>
              <span className="min-w-0 text-[13px] break-keep">
                {result ? (
                  <span className="text-[var(--t1)]">{result}</span>
                ) : (
                  <span className="text-[var(--t2)]">{reason ?? '준비됨'}</span>
                )}
              </span>
            </li>
          )
        })}
      </ol>

      <NoticeRegion
        notice={notice}
        pending={pending !== null}
        onRetry={() => lastRun.current?.()}
      />
    </section>
  )
}

// ── 판본 자리 목록 ──────────────────────────────────────────────────────────

export function StorySlotList({
  slots,
  selected,
  loading,
  onSelect,
}: {
  slots: StorySlotRow[]
  selected: string | null
  loading: boolean
  onSelect: (slotId: string) => void
}) {
  return (
    <ul aria-label="판본 자리" aria-busy={loading || undefined} className="flex flex-col gap-2">
      {slots.map((slot) => {
        const current = slot.slot_id === selected
        return (
          <li key={slot.slot_id}>
            <button
              type="button"
              aria-current={current ? 'true' : undefined}
              onClick={() => onSelect(slot.slot_id)}
              className={`${styles.slotButton} flex min-h-11 w-full min-w-0 flex-col items-start gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-left hover:border-[var(--bd-strong)] ${FOCUS}`}
            >
              <span className={`${styles.mono} text-[13px] font-semibold text-[var(--t1)]`}>{slot.work_key}</span>
              <span className="flex min-w-0 flex-wrap gap-x-2 text-[13px] text-[var(--t2)]">
                <span className={styles.mono}>{slot.edition_key}</span>
                <span className="break-keep">
                  {STORY_KIND_LABEL[slot.kind]} · {STORY_COVERAGE_LABEL[slot.coverage]}
                </span>
              </span>
              {/* 같은 작품 · 판본 키라도 원천 스냅숏이나 편집 기준 등록이 다르면 다른 자리다 — 전체 id 로 구분한다(줄이면 겹칠 수 있다). */}
              <span className={`${styles.mono} max-w-full text-[11px] leading-snug text-[var(--t2)] [overflow-wrap:anywhere]`}>
                {storySlotOrigin(slot)}
              </span>
              <span className="text-[12px] tabular-nums text-[var(--t2)] break-keep">{storySlotHistory(slot)}</span>
              <span className="text-[13px] font-semibold text-[var(--t1)] break-keep">{storySlotState(slot)}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ── 비교 ───────────────────────────────────────────────────────────────────

function ChangeItem({ change }: { change: ViewChange }) {
  return (
    <li className="flex min-w-0 flex-col gap-1 border-t border-[var(--bd)] pt-2 first:border-t-0 first:pt-0">
      <p className="text-[13px] font-semibold break-keep">
        {STORY_CHANGE_TYPE_LABEL[change.type] ?? change.type} · {STORY_CHANGE_OPERATION_LABEL[change.operation] ?? change.operation}
        <span className={`ml-2 font-normal text-[var(--t2)] ${styles.mono}`}>{change.change_id}</span>
      </p>
      <p className="text-[13px] text-[var(--t1)] break-keep">{change.rationale}</p>
      {change.learner_note && (
        <p className="text-[13px] text-[var(--t2)] break-keep">학습자 주석 · {change.learner_note}</p>
      )}
      <ul className="flex flex-col gap-0.5">
        {change.anchors.map((anchor, index) => (
          <li key={index} className="text-[13px] text-[var(--t2)]">
            ¶{anchor.paragraph + 1} ·{' '}
            <q lang="en" className={styles.english}>
              {anchor.quote}
            </q>
          </li>
        ))}
      </ul>
    </li>
  )
}

export function StoryComparisonView({
  bundle,
  unitId,
  onSelectUnit,
}: {
  bundle: Pick<StoryBundle, 'source' | 'version'>
  unitId: string | null
  onSelectUnit: (unitId: string) => void
}) {
  const comparison = buildStoryComparison(bundle, unitId)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = comparison.unit ? comparison.units.findIndex((unit) => unit.unit_id === comparison.unit!.unit_id) : -1

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (delta === 0) return
    const target = comparison.units[index + delta]
    if (!target) return
    event.preventDefault()
    onSelectUnit(target.unit_id)
    buttons.current[index + delta]?.focus()
  }

  if (comparison.units.length === 0) {
    return <p className={HINT}>이 판에는 읽을 단위가 없습니다.</p>
  }
  const mismatched = comparison.anchors.filter((check) => !check.matches).length

  return (
    <section aria-labelledby="story-compare-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 id="story-compare-title" className={H3}>
          원문 · 판본 · 변경 기록 비교
        </h4>
        <p className={HINT}>
          단위를 고르면 그 단위가 가리키는 원문 구간이 강조되고, 그 단위의 변경 기록만 남습니다. 원문 {comparison.paragraph_total}문단 중
          관련 {comparison.paragraphs.length}문단을 보여 줍니다.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <ol aria-label="판본 단위 — 위아래 화살표로 옮길 수 있습니다" className={`${styles.unitList} flex flex-col gap-1`}>
          {comparison.units.map((unit, index) => {
            const pressed = index === selectedIndex
            return (
              <li key={unit.unit_id}>
                <button
                  ref={(node) => {
                    buttons.current[index] = node
                  }}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => onSelectUnit(unit.unit_id)}
                  onKeyDown={(event) => onKey(event, index)}
                  className={`${styles.unitButton} flex min-h-11 w-full min-w-0 flex-col items-start rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 py-1.5 text-left ${FOCUS}`}
                >
                  <span className="text-[13px] font-semibold text-[var(--t1)] break-keep">
                    {unit.order}. {unit.title ?? unit.unit_id}
                  </span>
                  <span className="text-[12px] text-[var(--t2)] break-keep">원문 구간 {unit.anchors.length}</span>
                </button>
              </li>
            )
          })}
        </ol>

        {comparison.unit && (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
              <section aria-label="판본 단위 본문" className="flex min-w-0 flex-col gap-2">
                <h5 className={H4}>
                  판본 · {comparison.unit.order}. {comparison.unit.title ?? comparison.unit.unit_id}
                </h5>
                <p lang="en" className={`${styles.english} text-[15px] text-[var(--t1)]`}>
                  {comparison.unit.text}
                </p>
                {comparison.unit.preserves.length > 0 && (
                  <p className={HINT}>
                    보존 요소 · <span className={styles.mono}>{comparison.unit.preserves.join(', ')}</span>
                  </p>
                )}
              </section>
              <section aria-label="원문 구간" className="flex min-w-0 flex-col gap-2">
                <h5 className={H4}>원문</h5>
                <p className={HINT}>
                  <mark className={styles.markUnit}>밑줄 강조</mark> = 이 단위가 가리키는 원문 ·{' '}
                  <mark className={styles.markOmit}>취소선</mark> = 판본에서 생략한 원문
                </p>
                {comparison.paragraphs.map((paragraph) => (
                  <div key={paragraph.index} className="flex min-w-0 gap-2">
                    <span className="shrink-0 pt-0.5 text-[12px] tabular-nums text-[var(--t2)]">¶{paragraph.index + 1}</span>
                    <p lang="en" className={`${styles.english} min-w-0 text-[15px] text-[var(--t1)]`}>
                      {paragraph.segments.map((segment, index) =>
                        segment.mark === 'unit' ? (
                          <mark key={index} className={styles.markUnit}>
                            {segment.text}
                          </mark>
                        ) : segment.mark === 'omit' ? (
                          <mark key={index} className={styles.markOmit}>
                            <span className="sr-only">생략된 원문: </span>
                            {segment.text}
                          </mark>
                        ) : (
                          <span key={index}>{segment.text}</span>
                        )
                      )}
                    </p>
                  </div>
                ))}
                {mismatched > 0 && (
                  <p className="text-[13px] font-semibold text-[var(--error-ink)] break-keep">
                    저장된 원문과 인용이 맞지 않는 구간 {mismatched}개 — 검증 증인이 이 판을 거부합니다.
                  </p>
                )}
              </section>
            </div>

            <section aria-label="이 단위의 변경 기록" className="flex min-w-0 flex-col gap-2">
              <h5 className={H4}>이 단위의 변경 기록 {comparison.changes.length}</h5>
              {comparison.changes.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {comparison.changes.map((change) => (
                    <ChangeItem key={change.change_id} change={change} />
                  ))}
                </ul>
              ) : (
                <p className={HINT}>이 단위를 가리키는 변경 기록이 없습니다.</p>
              )}
              {comparison.omits.length > 0 && (
                <>
                  <h5 className={H4}>같은 문단의 생략 기록 {comparison.omits.length}</h5>
                  <ul className="flex flex-col gap-2">
                    {comparison.omits.map((change) => (
                      <ChangeItem key={change.change_id} change={change} />
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        )}
      </div>

      {comparison.hook && (
        <section aria-label="진입 장면" className="flex min-w-0 flex-col gap-1 border-t border-[var(--bd)] pt-3">
          <h5 className={H4}>진입 장면 — 읽기 순서 밖 미리보기</h5>
          <p lang="en" className={`${styles.english} text-sm text-[var(--t1)]`}>
            {comparison.hook.text}
          </p>
          <ul className="flex flex-col gap-0.5">
            {comparison.hook.anchors.map((check, index) => (
              <li key={index} className="text-[13px] text-[var(--t2)]">
                원문 ¶{check.anchor.paragraph + 1} ·{' '}
                <q lang="en" className={styles.english}>
                  {check.anchor.quote}
                </q>
                {!check.matches && <span className="ml-1 font-semibold text-[var(--error-ink)]">인용 불일치</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}

// ── 상태 ───────────────────────────────────────────────────────────────────

function accountLabel(uid: string, viewer: StoryViewer | null, submitter?: string): string {
  if (viewer && uid === viewer.uid) return '현재 계정'
  if (submitter && uid === submitter) return '판 제출 계정'
  return `계정 ${uid.slice(0, 8)}`
}

const metaRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
const metaText = (value: unknown): string | null => (typeof value === 'string' ? value : null)

export function StoryBundleStatus({ bundle, viewer }: { bundle: StoryBundle; viewer: StoryViewer | null }) {
  const artifact = readStoryArtifact(bundle.version.artifact)
  const meta = metaRecord(bundle.source.meta)
  const work = metaRecord(meta.work)
  const edition = metaRecord(meta.edition)
  const rawUrl = edition.source_url
  const sourceUrl = metaText(rawUrl)
  const sourceHref = safeSourceHref(rawUrl)
  const rights = storyRightsRows(bundle)

  return (
    <section aria-labelledby="story-status-title" className="flex flex-col gap-4">
      <h4 id="story-status-title" className={H3}>
        판 · 검수 · 권리 · 발행 상태
      </h4>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section aria-label="판" className="flex min-w-0 flex-col gap-2 border-t border-[var(--bd)] pt-3">
          <h5 className={H4}>판</h5>
          <dl className="grid grid-cols-2 gap-3">
            <Field term="최신 판">{bundle.version.is_latest ? '예' : '아니오 — 뒤에 새 판이 있음'}</Field>
            <Field term="제출">{formatStoryTime(bundle.version.submitted_at)}</Field>
            <Field term="제출 계정">{accountLabel(bundle.version.submitted_by, viewer)}</Field>
            <Field term="판본 해시">
              <Hash value={bundle.version.edition_sha256} />
            </Field>
          </dl>
          {artifact.producer_claim && (
            <p className={HINT}>
              생산 표기 — 파일의 주장 · 권한 근거 아님: <span className={styles.mono}>{artifact.producer_claim.agent}</span> ·{' '}
              <span className={styles.mono}>{artifact.producer_claim.provenance}</span>
            </p>
          )}
        </section>

        <section aria-label="검증 증명" className="flex min-w-0 flex-col gap-2 border-t border-[var(--bd)] pt-3">
          <h5 className={H4}>검증 증명</h5>
          <dl className="grid grid-cols-2 gap-3">
            <Field term="지금 결속의 증명">{bundle.validation.attested ? '있음' : '없음'}</Field>
            <Field term="결속 해시">
              <Hash value={bundle.validation.binding_sha256} />
            </Field>
          </dl>
          <p className={HINT}>
            증명은 서버 증인이 저장값으로 검증기를 통과했다고 남긴 기록입니다. 검수가 더해지거나 새 판이 오면 결속이 바뀌어 다시 실행해야
            합니다.
          </p>
        </section>

        <section aria-label="검수" className="flex min-w-0 flex-col gap-2 border-t border-[var(--bd)] pt-3">
          <h5 className={H4}>
            검수 {bundle.reviews.length} · 발행 자격 {bundle.reviews.filter((review) => review.qualifies).length}
          </h5>
          {bundle.reviews.length === 0 ? (
            <p className={HINT}>아직 검수가 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {bundle.reviews.map((review) => {
                const claim = metaRecord(review.review.reviewer)
                return (
                  <li key={review.id} className="flex min-w-0 flex-col gap-0.5 text-[13px]">
                    <span className="font-semibold break-keep">
                      {STORY_VERDICT_LABEL[review.verdict]} · {review.qualifies ? '발행 자격 있음' : '발행 자격 없음'}
                    </span>
                    <span className="text-[var(--t2)] break-keep">
                      올린 계정 · {accountLabel(review.submitted_by, viewer, bundle.version.submitted_by)} ·{' '}
                      {formatStoryTime(review.submitted_at)}
                    </span>
                    {metaText(claim.agent) && (
                      <span className="text-[var(--t2)] break-keep">
                        검수자 표기 — 파일의 주장: <span className={styles.mono}>{metaText(claim.kind) ?? '?'}</span> ·{' '}
                        <span className={styles.mono}>{metaText(claim.agent)}</span>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section aria-label="권리" className="flex min-w-0 flex-col gap-2 border-t border-[var(--bd)] pt-3">
          <h5 className={H4}>권리 · {bundle.rights_ok ? '필요 권리 모두 확인' : '확인 안 된 권리 있음'}</h5>
          <ul className="flex flex-col gap-2">
            {rights.map((row) => (
              <li key={row.asset} className="flex min-w-0 flex-col gap-0.5 text-[13px]">
                <span className="font-semibold break-keep">
                  {STORY_RIGHTS_ASSET_LABEL[row.asset]} ·{' '}
                  {row.decision ? STORY_RIGHTS_STATUS_LABEL[row.decision.status] : '결정 없음'}
                </span>
                {row.decision && (
                  <>
                    <span className="text-[var(--t2)] break-keep">근거 · {row.decision.basis}</span>
                    <span className="text-[var(--t2)]">
                      근거 자료 · <span className={styles.mono}>{row.decision.evidence_ref ?? '없음'}</span>
                    </span>
                    <span className="text-[var(--t2)] break-keep">
                      {accountLabel(row.decision.decided_by, viewer)} · {formatStoryTime(row.decision.decided_at)}
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
          <p className={HINT}>최신 결정만 셉니다. 원천 파일의 권리 기록은 주장일 뿐 결정이 아닙니다.</p>
        </section>

        <section aria-label="발행본" className="flex min-w-0 flex-col gap-2 border-t border-[var(--bd)] pt-3">
          <h5 className={H4}>이 자리의 발행본 {bundle.releases.length}</h5>
          <p className={HINT}>
            판이 아니라 자리 전체의 발행본입니다 — 옛 판의 발행본일 수 있습니다. 발행 키로 구분하세요 · 지금 보는 판의 판본 해시{' '}
            <Hash value={bundle.version.edition_sha256} />
          </p>
          {bundle.releases.length === 0 ? (
            <p className={HINT}>발행본이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {bundle.releases.map((release) => (
                <li key={release.release_key} className="flex min-w-0 flex-col gap-0.5 text-[13px]">
                  <span className="font-semibold break-keep">{releaseStateLabel(release)}</span>
                  <span className={styles.mono}>{release.release_key}</span>
                  <span className="text-[var(--t2)] break-keep">
                    발행 {formatStoryTime(release.published_at)}
                    {release.withdrawn_at && ` · 철회 ${formatStoryTime(release.withdrawn_at)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="원천" className="flex min-w-0 flex-col gap-2 border-t border-[var(--bd)] pt-3">
          <h5 className={H4}>원천</h5>
          <dl className="grid grid-cols-2 gap-3">
            <Field term="작품">
              <span lang="en">{metaText(work.title) ?? '없음'}</span>
            </Field>
            <Field term="원천 판본">
              <span lang="en">{metaText(edition.edition_label) ?? '없음'}</span>
            </Field>
            <Field term="문단 수">{splitStoryParagraphs(bundle.source.body).length}</Field>
            <Field term="등록">{formatStoryTime(bundle.source.registered_at)}</Field>
            <Field term="본문 해시">
              <Hash value={bundle.source.text_sha256} />
            </Field>
            <Field term="원천 정체 해시">
              <Hash value={bundle.source.identity_sha256} />
            </Field>
          </dl>
          <p className="min-w-0 text-[13px] text-[var(--t2)]">
            원천 URL ·{' '}
            {sourceHref ? (
              <a
                href={sourceHref}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.mono} text-[var(--t1)] underline ${FOCUS}`}
              >
                {sourceHref}
              </a>
            ) : sourceUrl ? (
              <span className={styles.mono}>{sourceUrl}</span>
            ) : (
              '없음'
            )}
          </p>
        </section>
      </div>
    </section>
  )
}

// ── 행동 ───────────────────────────────────────────────────────────────────

const TEXT_ONLY_NOTE = '텍스트 판본만 발행합니다 — 오디오 · 삽화 자산과 그 권리는 지원하지 않습니다.'

export function StoryBundleView({
  slot,
  bundle,
  viewer,
  onRefresh,
  onOpenFiles,
}: {
  slot: StorySlotRow
  bundle: StoryBundle
  viewer: StoryViewer | null
  onRefresh: () => Promise<void>
  onOpenFiles: () => void
}) {
  const formId = useId()
  const [unitId, setUnitId] = useState<string | null>(null)
  const [pending, setPending] = useState<StoryActionKind | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const lastRun = useRef<(() => void) | null>(null)
  // 결과 영역은 「다음 작업」 상자 안 한 곳뿐이다. 「다른 작업」 아래에서 눌러도 결과가 보이도록, 결과가 생기면 그 영역을
  // 뷰포트로 데려온다(초점은 옮기지 않는다 — 알림은 live 영역이 한 번만 읽는다). 줄인 동작 설정이면 즉시 이동.
  // 성공 뒤에는 번들을 다시 읽어 「다음 작업」 폼이 바뀌며 결과 영역이 밀릴 수 있다 — 번들이 바뀌어도 다시 맞춘다.
  const noticeRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!notice || !noticeRef.current) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    noticeRef.current.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [notice, bundle])
  // 입력값 — 실패해도 남긴다(성공한 폼만 비운다).
  const [reviewFile, setReviewFile] = useState<File | null>(null)
  const [reviewKey, setReviewKey] = useState(0)
  const [rightsAsset, setRightsAsset] = useState<'source_text' | 'translation'>('source_text')
  const [rightsStatus, setRightsStatus] = useState<StoryRightsStatus>('confirmed')
  const [rightsBasis, setRightsBasis] = useState('')
  const [rightsEvidence, setRightsEvidence] = useState('')
  const [rightsError, setRightsError] = useState<string | null>(null)
  const [withdrawReason, setWithdrawReason] = useState('')
  const [confirming, setConfirming] = useState<'publish' | 'withdraw' | null>(null)

  const next = nextStoryAction({ slot, bundle, viewer })
  const isAdmin = viewer?.role === 'admin'
  const submittedByViewer = viewer !== null && viewer.uid === bundle.version.submitted_by
  const live = bundle.releases.find((release) => !release.withdrawn_at) ?? null
  const required = storyRightsRows(bundle).map((row) => row.asset)
  const busy = pending !== null

  async function perform<T>(kind: StoryActionKind, label: string, run: () => Promise<StoryResult<T>>, success: (data: T) => string, after?: () => void) {
    lastRun.current = () => void perform(kind, label, run, success, after)
    setPending(kind)
    setNotice(null)
    const result = await callStory(run)
    if (result.ok) {
      after?.()
      setNotice({ tone: 'success', text: `${label} · ${success(result.data)}` })
      setPending(null)
      await onRefresh()
    } else {
      setPending(null)
      setNotice({ tone: 'failure', text: `${label} 실패`, failure: result })
    }
  }

  const submitReview = () => {
    if (!reviewFile || reviewFile.size > STORY_UPLOAD_MAX_BYTES) return
    const file = reviewFile
    void perform(
      'submit_review',
      '검수 결과 올리기',
      () => {
        const form = new FormData()
        form.append('edition_version_id', bundle.version.id)
        form.append('review', file)
        return submitStoryReviewAction(form)
      },
      (data) =>
        `${data.created ? '새 검수로 저장됨' : '같은 검수가 이미 있음'} · ${data.qualifies ? '발행 자격 있음' : '발행 자격 없음 — 새 판이 필요합니다'}`,
      () => {
        setReviewFile(null)
        setReviewKey((key) => key + 1)
      }
    )
  }

  const submitRights = () => {
    const basis = rightsBasis.trim()
    const evidence = rightsEvidence.trim()
    if (!basis) return setRightsError('근거를 적으세요.')
    if (rightsStatus === 'confirmed' && !evidence) return setRightsError('「확인」에는 근거 자료 위치가 필요합니다.')
    setRightsError(null)
    void perform(
      'record_rights',
      '권리 결정 기록',
      () =>
        recordStoryRightsAction({
          source_id: bundle.source.id,
          asset: rightsAsset,
          status: rightsStatus,
          basis,
          evidence_ref: evidence,
        }),
      () => `${STORY_RIGHTS_ASSET_LABEL[rightsAsset]} · ${STORY_RIGHTS_STATUS_LABEL[rightsStatus]} 으로 기록됨`,
      () => {
        setRightsBasis('')
        setRightsEvidence('')
      }
    )
  }

  const runAttest = () =>
    void perform(
      'attest',
      '검증 증인',
      () => attestStoryValidationAction(bundle.version.id),
      (data) => `${data.created ? '증명 기록됨' : '같은 결속의 증명이 이미 있음'} · 결속 ${shortHash(data.binding_sha256)}`
    )

  const runPublish = () =>
    void perform(
      'publish',
      '발행',
      () => publishStoryAction(bundle.version.id),
      (data) => `발행됨 · ${data.release_key}`,
      () => setConfirming(null)
    )

  const runWithdraw = () => {
    const reason = withdrawReason.trim()
    if (!live || !reason) return
    void perform(
      'withdraw',
      '철회',
      () => withdrawStoryAction(live.release_key, reason),
      (data) => (data.changed ? `철회됨 · ${formatStoryTime(data.withdrawn_at)}` : '이미 철회된 발행본입니다'),
      () => {
        setConfirming(null)
        setWithdrawReason('')
      }
    )
  }

  const reload = () => {
    setNotice(null)
    void onRefresh()
  }

  // 각 행동의 폼 — 주 행동 자리와 「다른 작업」 자리에 같은 것을 그린다(입력값은 위 상태에 있어 자리가 바뀌어도 남는다).
  const forms: Partial<Record<StoryActionKind, ReactNode>> = {
    reload_latest: (
      <button type="button" className={BTN_PRIMARY} onClick={reload} disabled={busy}>
        최신 판 다시 불러오기
      </button>
    ),
    resubmit_edition: (
      <button type="button" className={BTN} onClick={onOpenFiles} disabled={busy}>
        후보 파일 열어 새 판 제출
      </button>
    ),
    submit_review: (
      <div className="flex flex-col gap-2">
        <FileInput
          label="검수 결과 파일 (.json)"
          hint="이 판에 결속된 검수 결과 파일"
          file={reviewFile}
          onChange={setReviewFile}
          disabled={busy}
          inputKey={reviewKey}
        />
        {reviewFile && reviewFile.size > STORY_UPLOAD_MAX_BYTES && (
          <p className="text-sm font-semibold text-[var(--error-ink)] break-keep">
            파일이 한도 {formatBytes(STORY_UPLOAD_MAX_BYTES)}를 넘어 보낼 수 없습니다.
          </p>
        )}
        {submittedByViewer && <p className="text-sm text-[var(--warning-ink)] break-keep">이 판을 제출한 계정은 검수할 수 없습니다 — 다른 인증 스태프가 필요합니다.</p>}
        <div>
          <button
            type="button"
            className={BTN}
            onClick={submitReview}
            disabled={busy || !reviewFile || reviewFile.size > STORY_UPLOAD_MAX_BYTES || submittedByViewer}
            aria-busy={pending === 'submit_review' || undefined}
          >
            {pending === 'submit_review' ? '올리는 중…' : '검수 결과 올리기'}
          </button>
        </div>
      </div>
    ),
    record_rights: isAdmin ? (
      <form
        className="flex flex-col gap-3"
        aria-describedby={`${formId}-rights-note`}
        onSubmit={(event) => {
          event.preventDefault()
          submitRights()
        }}
      >
        <fieldset className="flex flex-col gap-1">
          <legend className={LABEL}>자산</legend>
          <div className="flex flex-wrap gap-x-4">
            {STORY_TEXT_RIGHTS_ASSETS.map((asset) => (
              <label key={asset} className="inline-flex min-h-11 items-center gap-2 text-sm break-keep">
                <input
                  type="radio"
                  name={`${formId}-asset`}
                  value={asset}
                  checked={rightsAsset === asset}
                  onChange={() => setRightsAsset(asset)}
                  disabled={busy}
                  className={`h-4 w-4 ${FOCUS}`}
                />
                {STORY_RIGHTS_ASSET_LABEL[asset]}
                {required.includes(asset) ? ' (필요)' : ' (이 원천에는 필요 없음)'}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-1">
          <legend className={LABEL}>결정</legend>
          <div className="flex flex-wrap gap-x-4">
            {(['confirmed', 'hold', 'rejected'] as const).map((status) => (
              <label key={status} className="inline-flex min-h-11 items-center gap-2 text-sm break-keep">
                <input
                  type="radio"
                  name={`${formId}-status`}
                  value={status}
                  checked={rightsStatus === status}
                  onChange={() => setRightsStatus(status)}
                  disabled={busy}
                  className={`h-4 w-4 ${FOCUS}`}
                />
                {STORY_RIGHTS_STATUS_LABEL[status]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${formId}-basis`} className={LABEL}>
            근거 (필수)
          </label>
          <textarea
            id={`${formId}-basis`}
            value={rightsBasis}
            onChange={(event) => setRightsBasis(event.target.value)}
            disabled={busy}
            rows={3}
            className={`${FIELD} py-2`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${formId}-evidence`} className={LABEL}>
            근거 자료 위치 (「확인」이면 필수)
          </label>
          <input
            id={`${formId}-evidence`}
            value={rightsEvidence}
            onChange={(event) => setRightsEvidence(event.target.value)}
            disabled={busy}
            className={FIELD}
          />
        </div>
        <p id={`${formId}-rights-note`} className={HINT}>
          결정은 추가만 됩니다 — 자산별 최신 결정이 발행 · 열람을 정합니다. 보류 · 거부는 발행본 열람을 즉시 닫고, 다시 확인하면 열립니다.
        </p>
        {rightsError && <p className="text-sm font-semibold text-[var(--error-ink)] break-keep">{rightsError}</p>}
        <div>
          <button type="submit" className={BTN} disabled={busy} aria-busy={pending === 'record_rights' || undefined}>
            {pending === 'record_rights' ? '기록 중…' : '권리 결정 기록'}
          </button>
        </div>
      </form>
    ) : (
      <p className={HINT}>권리 결정은 admin 전용입니다.</p>
    ),
    attest: (
      <div className="flex flex-col gap-2">
        <p className={HINT}>
          서버가 저장된 원천 · 편집 기준 · 판본 · 검수 전부를 검증기로 다시 검사합니다. 화면은 검증 결과를 보내지 않습니다.
        </p>
        <div>
          <button type="button" className={BTN} onClick={runAttest} disabled={busy} aria-busy={pending === 'attest' || undefined}>
            {pending === 'attest' ? '검증 중…' : '검증 실행'}
          </button>
        </div>
      </div>
    ),
    publish: (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-[var(--t1)] break-keep">{TEXT_ONLY_NOTE}</p>
        {!isAdmin ? (
          <p className={HINT}>발행은 admin 전용입니다.</p>
        ) : submittedByViewer ? (
          <p className="text-sm text-[var(--warning-ink)] break-keep">
            이 판을 제출한 계정은 발행할 수 없습니다 — 다른 인증 스태프(admin)가 필요합니다.
          </p>
        ) : confirming === 'publish' ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm break-keep">학습자 서가에 이 판본이 열립니다. 발행할까요?</span>
            <button type="button" className={BTN_PRIMARY} onClick={runPublish} disabled={busy} aria-busy={pending === 'publish' || undefined}>
              {pending === 'publish' ? '발행 중…' : '발행 확정'}
            </button>
            <button type="button" className={BTN} onClick={() => setConfirming(null)} disabled={busy}>
              취소
            </button>
          </div>
        ) : (
          <div>
            <button type="button" className={BTN} onClick={() => setConfirming('publish')} disabled={busy}>
              발행
            </button>
          </div>
        )}
      </div>
    ),
    withdraw: live ? (
      isAdmin ? (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-[var(--t2)]">
            철회 대상 발행 키 · <span className={styles.mono}>{live.release_key}</span>
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${formId}-withdraw`} className={LABEL}>
              철회 사유 (필수)
            </label>
            <textarea
              id={`${formId}-withdraw`}
              value={withdrawReason}
              onChange={(event) => setWithdrawReason(event.target.value)}
              disabled={busy}
              rows={2}
              className={`${FIELD} py-2`}
            />
          </div>
          {confirming === 'withdraw' ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm break-keep">학습자 열람이 즉시 닫힙니다. 학습 이력은 보존됩니다. 철회할까요?</span>
              <button
                type="button"
                className={BTN_DANGER}
                onClick={runWithdraw}
                disabled={busy || !withdrawReason.trim()}
                aria-busy={pending === 'withdraw' || undefined}
              >
                {pending === 'withdraw' ? '철회 중…' : '철회 확정'}
              </button>
              <button type="button" className={BTN} onClick={() => setConfirming(null)} disabled={busy}>
                취소
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                className={BTN_DANGER}
                onClick={() => setConfirming('withdraw')}
                disabled={busy || !withdrawReason.trim()}
              >
                철회
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className={HINT}>철회는 admin 전용입니다.</p>
      )
    ) : null,
  }

  const secondary: StoryActionKind[] = (
    live
      ? (['record_rights', 'withdraw', 'resubmit_edition'] as StoryActionKind[])
      : (['submit_review', 'record_rights', 'attest', 'publish', 'resubmit_edition'] as StoryActionKind[])
  ).filter((kind) => next.kind !== 'reload_latest' && kind !== next.kind && forms[kind])

  const artifact = readStoryArtifact(bundle.version.artifact)
  const meta = metaRecord(bundle.source.meta)
  const workTitle = metaText(metaRecord(meta.work).title)

  return (
    <article aria-labelledby="story-bundle-title" className="flex min-w-0 flex-col gap-5">
      <header className="flex min-w-0 flex-col gap-1">
        <h3 id="story-bundle-title" className="font-display text-[18px] font-[700] text-[var(--t1)] break-keep">
          <span lang="en">{artifact.title ?? slot.edition_key}</span>
        </h3>
        <p className="flex min-w-0 flex-wrap gap-x-2 text-[13px] text-[var(--t2)]">
          {workTitle && <span lang="en">{workTitle}</span>}
          <span className={styles.mono}>{slot.edition_key}</span>
          <span className="break-keep">
            {STORY_KIND_LABEL[slot.kind]} · {STORY_COVERAGE_LABEL[slot.coverage]} · 판 {slot.version_count}
          </span>
        </p>
      </header>

      <section
        aria-labelledby="story-next-title"
        className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bd-strong)] bg-[var(--bg)] p-4"
      >
        <p className="text-[12px] font-semibold text-[var(--t2)] break-keep">다음 작업</p>
        <h4 id="story-next-title" className="font-display text-[16px] font-[700] text-[var(--t1)] break-keep">
          {next.title}
        </h4>
        <p className="text-sm text-[var(--t1)] break-keep">{next.reason}</p>
        {next.blocked && (
          <p className="text-sm font-semibold text-[var(--warning-ink)] break-keep">{next.blocked}</p>
        )}
        {forms[next.kind]}
        <div ref={noticeRef} className="scroll-mt-4 scroll-mb-4">
          <NoticeRegion notice={notice} pending={busy} onRetry={() => lastRun.current?.()} onReload={reload} />
        </div>
      </section>

      <StoryComparisonView bundle={bundle} unitId={unitId} onSelectUnit={setUnitId} />

      <StoryBundleStatus bundle={bundle} viewer={viewer} />

      {secondary.length > 0 && (
        <details className="flex flex-col gap-3 border-t border-[var(--bd)] pt-3">
          <summary className={`min-h-11 cursor-pointer py-2 text-sm font-semibold text-[var(--t1)] break-keep ${FOCUS}`}>
            다른 작업 {secondary.length}
          </summary>
          <div className="flex flex-col gap-4 pt-2">
            {secondary.map((kind) => (
              <section key={kind} aria-label={SECONDARY_LABEL[kind]} className="flex flex-col gap-2 border-t border-[var(--bd)] pt-3 first:border-t-0 first:pt-0">
                <h5 className={H4}>{SECONDARY_LABEL[kind]}</h5>
                {forms[kind]}
              </section>
            ))}
          </div>
        </details>
      )}
    </article>
  )
}

const SECONDARY_LABEL: Record<StoryActionKind, string> = {
  reopen_files: '원천·편집 기준 파일을 다시 열기',
  load_bundle: '판본 불러오기',
  reload_latest: '최신 판 다시 불러오기',
  resubmit_edition: '새 판 제출',
  submit_review: '검수 결과 올리기',
  record_rights: '권리 결정 (admin)',
  attest: '검증 증인',
  publish: '발행 (admin)',
  withdraw: '철회 (admin)',
}

// ── 선택한 자리 ─────────────────────────────────────────────────────────────

type BundleState =
  | { status: 'idle' }
  | { status: 'loading'; versionId: string; bundle: StoryBundle | null }
  | { status: 'ready'; versionId: string; bundle: StoryBundle }
  | { status: 'error'; versionId: string; failure: StoryFailure }

function StorySlotDetail({
  slot,
  state,
  viewer,
  onRefresh,
  onRetryBundle,
  onOpenFiles,
}: {
  slot: StorySlotRow
  state: BundleState
  viewer: StoryViewer | null
  onRefresh: () => Promise<void>
  onRetryBundle: () => void
  onOpenFiles: () => void
}) {
  if (!slot.latest_version_id) {
    const next = nextStoryAction({ slot, bundle: null, viewer })
    return (
      <section
        aria-labelledby="story-next-title"
        className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bd-strong)] bg-[var(--bg)] p-4"
      >
        <p className="text-[13px] text-[var(--t2)]">
          <span className={styles.mono}>{slot.work_key}</span> · <span className={styles.mono}>{slot.edition_key}</span> · 판본 미제출
        </p>
        <h3 id="story-next-title" className="font-display text-[16px] font-[700] text-[var(--t1)] break-keep">
          {next.title}
        </h3>
        <p className="text-sm text-[var(--t1)] break-keep">{next.reason}</p>
        <div>
          <button type="button" className={BTN_PRIMARY} onClick={onOpenFiles}>
            원천·편집 기준 파일을 다시 열기
          </button>
        </div>
      </section>
    )
  }
  const bundle = state.status === 'ready' || state.status === 'loading' ? state.bundle : null
  if (state.status === 'error') {
    return (
      <div className="flex flex-col gap-3">
        <StoryFailureNotice
          failure={state.failure}
          title="판본을 불러오지 못했습니다"
          onRetry={onRetryBundle}
          onReload={() => void onRefresh()}
        />
      </div>
    )
  }
  if (!bundle) {
    return (
      <div aria-busy="true" className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-6">
        <p className={HINT}>최신 판의 원문 · 판본 · 검수 상태를 불러오는 중입니다…</p>
      </div>
    )
  }
  return (
    <div aria-busy={state.status === 'loading' || undefined} className="min-w-0">
      <StoryBundleView
        key={bundle.version.id}
        slot={slot}
        bundle={bundle}
        viewer={viewer}
        onRefresh={onRefresh}
        onOpenFiles={onOpenFiles}
      />
    </div>
  )
}

// ── 라인 전체 ───────────────────────────────────────────────────────────────

export function StoryCurationClient() {
  const params = useSearchParams()
  const location = storyLocation(params)
  const [viewer, setViewer] = useState<StoryViewer | null>(null)
  const [slots, setSlots] = useState<StorySlotRow[]>([])
  const [slotsStatus, setSlotsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [slotsFailure, setSlotsFailure] = useState<StoryFailure | null>(null)
  const [bundleState, setBundleState] = useState<BundleState>({ status: 'idle' })
  const bundleTicket = useRef(0)
  const lastBundleId = useRef<string | null>(null)

  const navigate = useCallback((patch: { slot?: string | null; panel?: StoryPanel | null }, mode: 'push' | 'replace' = 'push') => {
    updateAdminUrl(storyHref(new URLSearchParams(window.location.search), patch), mode)
  }, [])

  const loadSlots = useCallback(async (): Promise<StorySlotRow[] | null> => {
    setSlotsStatus('loading')
    setSlotsFailure(null)
    const result = await callStory(() => readStorySlots())
    if (result.ok) {
      setViewer(result.viewer)
      setSlots(result.data.slots)
      setSlotsStatus('ready')
      return result.data.slots
    }
    setSlotsFailure(result)
    setSlotsStatus('error')
    return null
  }, [])

  const loadBundle = useCallback(async (versionId: string) => {
    const ticket = ++bundleTicket.current
    lastBundleId.current = versionId
    setBundleState((previous) => ({
      status: 'loading',
      versionId,
      bundle: previous.status === 'ready' && previous.versionId === versionId ? previous.bundle : null,
    }))
    const result = await callStory(() => readStoryBundle(versionId))
    if (ticket !== bundleTicket.current) return
    if (result.ok) {
      setViewer(result.viewer)
      setBundleState({ status: 'ready', versionId, bundle: result.data })
    } else {
      setBundleState({ status: 'error', versionId, failure: result })
    }
  }, [])

  useEffect(() => {
    void loadSlots()
  }, [loadSlots])

  const selectedSlot = location.slot ? slots.find((slot) => slot.slot_id === location.slot) ?? null : null
  const versionId = selectedSlot?.latest_version_id ?? null

  useEffect(() => {
    if (versionId) {
      void loadBundle(versionId)
    } else {
      bundleTicket.current++
      lastBundleId.current = null
      setBundleState({ status: 'idle' })
    }
  }, [versionId, loadBundle])

  /** 변경 뒤 · 낡음 복구: 목록을 다시 읽고, 같은 판이면 번들도 다시 읽는다(판이 바뀌면 위 effect 가 읽는다). */
  const refreshAll = useCallback(async () => {
    const fresh = await loadSlots()
    if (!fresh) return
    const slotId = storyLocation(new URLSearchParams(window.location.search)).slot
    const id = fresh.find((slot) => slot.slot_id === slotId)?.latest_version_id ?? null
    if (id && id === lastBundleId.current) await loadBundle(id)
  }, [loadSlots, loadBundle])

  const onRegistered = useCallback(
    async (step: StoryRegisterStep, result: StoryRegisterResult) => {
      await refreshAll()
      if (step === 'edition' && result.edition) navigate({ slot: result.edition.slot_id })
    },
    [navigate, refreshAll]
  )

  const liveCount = slots.filter((slot) => slot.live_release_key).length
  const unsubmitted = slots.filter((slot) => !slot.latest_version_id).length
  const loading = slotsStatus === 'loading'

  return (
    <section aria-labelledby="story-line-title" className={`${styles.root} flex flex-col gap-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="story-line-title" className="font-display text-[16px] font-[700] text-[var(--t1)] break-keep">
            이야기 판본
          </h2>
          {slotsStatus !== 'error' && (
            <dl aria-label="판본 자리 요약" className="flex flex-wrap gap-x-4 text-[13px] text-[var(--t2)]">
              <div className="flex gap-1">
                <dt>판본 자리</dt>
                <dd className="font-semibold tabular-nums text-[var(--t1)]">{loading && slots.length === 0 ? '…' : slots.length}</dd>
              </div>
              <div className="flex gap-1">
                <dt>발행 중</dt>
                <dd className="font-semibold tabular-nums text-[var(--t1)]">{loading && slots.length === 0 ? '…' : liveCount}</dd>
              </div>
              <div className="flex gap-1">
                <dt>판본 미제출</dt>
                <dd className="font-semibold tabular-nums text-[var(--t1)]">{loading && slots.length === 0 ? '…' : unsubmitted}</dd>
              </div>
            </dl>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewer && (
            <span className="text-[13px] text-[var(--t2)] break-keep">
              로그인 역할 · {viewer.role === 'admin' ? 'admin' : 'curator'} (화면 안내용)
            </span>
          )}
          <button type="button" className={BTN} onClick={() => void refreshAll()} disabled={loading} aria-busy={loading || undefined}>
            {loading ? '불러오는 중…' : '새로고침'}
          </button>
          <button
            type="button"
            className={location.panel === 'files' ? BTN : BTN_PRIMARY}
            aria-expanded={location.panel === 'files'}
            onClick={() => navigate({ panel: location.panel === 'files' ? null : 'files' })}
          >
            {location.panel === 'files' ? '파일 패널 닫기' : '후보 파일 열기'}
          </button>
        </div>
      </div>

      {location.panel === 'files' && (
        <StoryCandidatePanel onClose={() => navigate({ panel: null })} onRegistered={onRegistered} />
      )}

      {slotsStatus === 'error' && slotsFailure && (
        <StoryFailureNotice
          failure={slotsFailure}
          title="판본 자리 목록을 불러오지 못했습니다"
          onRetry={() => void loadSlots()}
          onReload={() => void loadSlots()}
        />
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <h3 className={H3}>판본 자리</h3>
          {loading && slots.length === 0 ? (
            <p aria-busy="true" className={HINT}>
              판본 자리를 불러오는 중입니다…
            </p>
          ) : slotsStatus === 'ready' && slots.length === 0 ? (
            <div className="flex flex-col gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-4">
              <p className="text-sm font-semibold text-[var(--t1)] break-keep">등록된 판본 자리가 없습니다</p>
              <p className={HINT}>
                원천 스냅숏 · 편집 기준 파일을 검사하고 등록하면 판본 자리가 생깁니다.
              </p>
              {location.panel !== 'files' && (
                <div>
                  <button type="button" className={BTN_PRIMARY} onClick={() => navigate({ panel: 'files' })}>
                    후보 파일 열기
                  </button>
                </div>
              )}
            </div>
          ) : (
            <StorySlotList
              slots={slots}
              selected={location.slot}
              loading={loading}
              onSelect={(slotId) => navigate({ slot: slotId })}
            />
          )}
        </div>

        <div className="min-w-0">
          {selectedSlot ? (
            <StorySlotDetail
              slot={selectedSlot}
              state={bundleState}
              viewer={viewer}
              onRefresh={refreshAll}
              onRetryBundle={() => {
                if (versionId) void loadBundle(versionId)
              }}
              onOpenFiles={() => navigate({ panel: 'files' })}
            />
          ) : location.slot && slotsStatus === 'ready' ? (
            <div className="flex flex-col gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-4">
              <p className="text-sm text-[var(--t1)] break-keep">선택한 판본 자리를 목록에서 찾을 수 없습니다.</p>
              <div>
                <button type="button" className={BTN} onClick={() => navigate({ slot: null }, 'replace')}>
                  선택 해제
                </button>
              </div>
            </div>
          ) : slots.length > 0 ? (
            <p className={`${HINT} rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-4`}>
              판본 자리를 고르면 원문 · 판본 · 변경 기록을 단위별로 비교하고 다음 작업 하나를 보여 줍니다.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
