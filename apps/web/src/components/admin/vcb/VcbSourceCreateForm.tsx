'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, Info } from 'lucide-react'
import { createSource } from '@/lib/vcb/server/sources'
import type { SourceKind, LicenseTier } from '@vocaflow/vcb-curate-core'

const KINDS: Array<{ value: SourceKind; label: string; hint: string }> = [
  { value: 'frequency_list', label: '빈도 리스트', hint: 'NGSL, COCA 등 빈도 순위 기반' },
  { value: 'corpus', label: '코퍼스', hint: '대용량 텍스트 모음 (예: 뉴스, 위키)' },
  { value: 'dictionary', label: '사전', hint: '사전 데이터 (오픈 라이선스 시드)' },
  { value: 'curated_list', label: '큐레이션 리스트', hint: '수동 큐레이션된 단어 목록' },
  { value: 'ai_generated', label: 'AI 생성', hint: 'Claude / GPT 등이 생성한 시드 (T1 강제)' },
]

const TIERS: Array<{ value: LicenseTier; label: string; hint: string }> = [
  { value: 'T1', label: 'T1', hint: '자유 사용 (CC0, Public Domain)' },
  { value: 'T2', label: 'T2', hint: 'attribution 필수 (CC BY, CC BY-SA)' },
  { value: 'T3', label: 'T3', hint: '저장/재배포 금지 (상업용 — DB CHECK 차단)' },
]

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/

export function VcbSourceCreateForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<SourceKind>('frequency_list')
  const [licenseTier, setLicenseTier] = useState<LicenseTier>('T1')
  const [citation, setCitation] = useState('')
  const [url, setUrl] = useState('')
  const [language, setLanguage] = useState('en')
  const [notes, setNotes] = useState('')

  const [submitError, setSubmitError] = useState<string | null>(null)

  const slugValid = SLUG_PATTERN.test(slug)
  const titleValid = title.trim().length > 0 && title.length <= 200
  const citationValid = citation.trim().length > 0 && citation.length <= 1000
  const languageValid = language.length > 0 && language.length <= 10
  const aiGeneratedTierValid = kind !== 'ai_generated' || licenseTier === 'T1'
  const formValid =
    slugValid && titleValid && citationValid && languageValid && aiGeneratedTierValid

  const handleKindChange = (newKind: SourceKind) => {
    setKind(newKind)
    if (newKind === 'ai_generated') {
      setLicenseTier('T1')
    }
  }

  const handleSubmit = () => {
    setSubmitError(null)
    if (!formValid) {
      setSubmitError('Required fields incomplete or invalid')
      return
    }

    startTransition(async () => {
      const result = await createSource({
        slug,
        title: title.trim(),
        kind,
        license_tier: licenseTier,
        citation: citation.trim(),
        url: url.trim() || null,
        language: language.trim(),
        notes: notes.trim() || null,
      })

      if (!result.ok || !result.data) {
        setSubmitError(result.error ?? 'Source 등록 실패')
        return
      }

      router.push('/admin/vocab/sources')
    })
  }

  return (
    <div className="max-w-3xl">
      <section className="mb-8">
        <h3
          className="font-display font-semibold text-sm uppercase tracking-wider mb-4"
          style={{ color: 'var(--t2)' }}
        >
          기본 정보
        </h3>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-display" style={{ color: 'var(--t2)' }}>
              slug <span style={{ color: 'var(--error)' }}>*</span>
            </span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="ngsl-1.2"
              className="px-3 py-2 rounded-[var(--r-md)] border font-mono text-sm"
              style={{
                background: 'var(--bg)',
                borderColor:
                  slug.length > 0 && !slugValid ? 'var(--error)' : 'var(--bd)',
                color: 'var(--t1)',
              }}
            />
            <span
              className="text-xs"
              style={{
                color: slug.length > 0 && !slugValid ? 'var(--error)' : 'var(--t3)',
              }}
            >
              영소문자 + 숫자 + hyphen, 3~80 chars (예: ngsl-1-2, coca-5000, oxford-3000)
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-display" style={{ color: 'var(--t2)' }}>
              title <span style={{ color: 'var(--error)' }}>*</span>
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New General Service List 1.2"
              maxLength={200}
              className="px-3 py-2 rounded-[var(--r-md)] border font-display text-sm"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--bd)',
                color: 'var(--t1)',
              }}
            />
            <span className="text-xs" style={{ color: 'var(--t3)' }}>
              사용자/관리자에게 표시될 이름 (1~200 chars)
            </span>
          </label>
        </div>
      </section>

      <section className="mb-8">
        <h3
          className="font-display font-semibold text-sm uppercase tracking-wider mb-4"
          style={{ color: 'var(--t2)' }}
        >
          종류 (kind) <span style={{ color: 'var(--error)' }}>*</span>
        </h3>

        <div className="flex flex-col gap-2">
          {KINDS.map((k) => {
            const checked = kind === k.value
            return (
              <label
                key={k.value}
                className="flex flex-col gap-1 p-3 rounded-[var(--r-md)] border cursor-pointer"
                style={{
                  background: checked ? 'var(--p-light)' : 'var(--bg)',
                  borderColor: checked ? 'var(--p)' : 'var(--bd)',
                }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="kind"
                    value={k.value}
                    checked={checked}
                    onChange={() => handleKindChange(k.value)}
                  />
                  <span
                    className="font-display font-semibold text-sm"
                    style={{ color: checked ? 'var(--p)' : 'var(--t1)' }}
                  >
                    {k.label}
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: 'var(--t3)' }}>
                    {k.value}
                  </span>
                </div>
                <span className="text-xs ml-6" style={{ color: 'var(--t3)' }}>
                  {k.hint}
                </span>
              </label>
            )
          })}
        </div>
      </section>

      <section className="mb-8">
        <h3
          className="font-display font-semibold text-sm uppercase tracking-wider mb-4"
          style={{ color: 'var(--t2)' }}
        >
          라이선스 (license_tier) <span style={{ color: 'var(--error)' }}>*</span>
        </h3>

        {kind === 'ai_generated' && (
          <div
            className="flex items-start gap-2 p-3 mb-3 rounded-[var(--r-md)] border"
            style={{
              background: 'var(--info-light)',
              borderColor: 'var(--info)',
              color: 'var(--info)',
            }}
          >
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p className="text-sm m-0">
              ai_generated kind 는 T1 (CC0) 강제. DB 트리거 guard_ai_generated_license 가 위반 시 차단.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {TIERS.map((t) => {
            const checked = licenseTier === t.value
            const disabled = kind === 'ai_generated' && t.value !== 'T1'
            return (
              <label
                key={t.value}
                className="flex flex-col gap-1 p-3 rounded-[var(--r-md)] border"
                style={{
                  background: checked ? 'var(--p-light)' : 'var(--bg)',
                  borderColor: checked ? 'var(--p)' : 'var(--bd)',
                  opacity: disabled ? 0.4 : 1,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  pointerEvents: disabled ? 'none' : 'auto',
                }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="license_tier"
                    value={t.value}
                    checked={checked}
                    onChange={() => setLicenseTier(t.value)}
                    disabled={disabled}
                  />
                  <span
                    className="font-display font-semibold text-sm"
                    style={{ color: checked ? 'var(--p)' : 'var(--t1)' }}
                  >
                    {t.label}
                  </span>
                </div>
                <span className="text-xs ml-6" style={{ color: 'var(--t3)' }}>
                  {t.hint}
                </span>
              </label>
            )
          })}
        </div>
      </section>

      <section className="mb-8">
        <h3
          className="font-display font-semibold text-sm uppercase tracking-wider mb-4"
          style={{ color: 'var(--t2)' }}
        >
          출처 정보
        </h3>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-display" style={{ color: 'var(--t2)' }}>
              citation <span style={{ color: 'var(--error)' }}>*</span>
            </span>
            <textarea
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              placeholder="Browne, C., Culligan, B., & Phillips, J. (2023). New General Service List 1.2. CC BY-SA 4.0."
              rows={3}
              maxLength={1000}
              className="px-3 py-2 rounded-[var(--r-md)] border font-display text-sm resize-y"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--bd)',
                color: 'var(--t1)',
              }}
            />
            <span className="text-xs" style={{ color: 'var(--t3)' }}>
              저자/연도/제목/라이선스 명시 (T2 라이선스는 attribution 필수)
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-display" style={{ color: 'var(--t2)' }}>
              url
            </span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.newgeneralservicelist.com"
              maxLength={500}
              className="px-3 py-2 rounded-[var(--r-md)] border font-mono text-sm"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--bd)',
                color: 'var(--t1)',
              }}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-display" style={{ color: 'var(--t2)' }}>
              language
            </span>
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value.toLowerCase())}
              placeholder="en"
              maxLength={10}
              className="px-3 py-2 rounded-[var(--r-md)] border font-mono text-sm w-24"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--bd)',
                color: 'var(--t1)',
              }}
            />
            <span className="text-xs" style={{ color: 'var(--t3)' }}>
              ISO 639-1 코드 (en, ko 등)
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-display" style={{ color: 'var(--t2)' }}>
              notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="추가 메타 정보 (선택)"
              rows={3}
              maxLength={2000}
              className="px-3 py-2 rounded-[var(--r-md)] border font-display text-sm resize-y"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--bd)',
                color: 'var(--t1)',
              }}
            />
          </label>
        </div>
      </section>

      {submitError && (
        <div
          className="flex items-start gap-2 p-3 mb-4 rounded-[var(--r-md)] border"
          style={{
            background: 'var(--error-light)',
            borderColor: 'var(--error)',
            color: 'var(--error)',
          }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p className="text-sm m-0">{submitError}</p>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!formValid || isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--r-md)] font-display text-sm font-medium text-white"
          style={{
            background: !formValid || isPending ? 'var(--t4)' : '#6D28D9',
            cursor: !formValid || isPending ? 'not-allowed' : 'pointer',
          }}
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isPending ? '등록 중...' : 'Source 등록'}
        </button>
        <span className="text-xs" style={{ color: 'var(--t3)' }}>
          등록 후 Sources 목록으로 이동합니다
        </span>
      </div>
    </div>
  )
}
