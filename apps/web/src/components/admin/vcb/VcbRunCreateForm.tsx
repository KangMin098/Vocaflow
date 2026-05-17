'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2 } from 'lucide-react'
import { createRun } from '@/lib/vcb/server/run-create'
import type { Segment, Cefr } from '@/lib/vcb/types'

const SEGMENTS: Array<{ value: Segment; label: string; hint: string }> = [
  { value: 'middle_school', label: '중학', hint: '중학교 영어 어휘' },
  { value: 'high_school', label: '고교', hint: '고등학교 영어 (수능 외 일반)' },
  { value: 'toeic', label: 'TOEIC', hint: 'TOEIC 빈출 어휘' },
  { value: 'business', label: '비즈니스', hint: '비즈니스 영어 + 업무용' },
  { value: 'academic', label: '학술', hint: '학술 어휘 (NAWL)' },
  { value: 'civil_service', label: '공무원', hint: '공무원 시험 빈출' },
  { value: 'general', label: '범용', hint: '일반 영어 학습자' },
]

const CEFR_LEVELS: Cefr[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/

export function VcbRunCreateForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [collectionSlug, setCollectionSlug] = useState('')
  const [collectionTitle, setCollectionTitle] = useState('')
  const [targetSegment, setTargetSegment] = useState<Segment>('high_school')
  const [targetCefrRange, setTargetCefrRange] = useState<Cefr[]>(['B1', 'B2'])
  const [description, setDescription] = useState('')
  const [coverEmoji, setCoverEmoji] = useState('')

  const [submitError, setSubmitError] = useState<string | null>(null)

  const slugValid = SLUG_PATTERN.test(collectionSlug)
  const titleValid =
    collectionTitle.trim().length > 0 && collectionTitle.length <= 200
  const cefrValid = targetCefrRange.length > 0
  const formValid = slugValid && titleValid && cefrValid

  const toggleCefr = (level: Cefr) => {
    setTargetCefrRange((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level],
    )
  }

  const handleSubmit = () => {
    setSubmitError(null)
    if (!formValid) {
      setSubmitError('Required fields incomplete or invalid')
      return
    }

    startTransition(async () => {
      const result = await createRun({
        collection_slug: collectionSlug,
        collection_title: collectionTitle.trim(),
        target_segment: targetSegment,
        target_cefr_range: targetCefrRange,
        description: description.trim() || null,
        cover_emoji: coverEmoji.trim() || null,
      })

      if (!result.ok || !result.data) {
        setSubmitError(result.error ?? 'Run 생성 실패')
        return
      }

      router.push(`/admin/vocab/runs/${result.data.run_id}`)
    })
  }

  return (
    <div className="max-w-3xl">
      {/* 기본 정보 */}
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
              collection_slug <span style={{ color: 'var(--error)' }}>*</span>
            </span>
            <input
              type="text"
              value={collectionSlug}
              onChange={(e) => setCollectionSlug(e.target.value)}
              placeholder="csat-essential-2000"
              className="px-3 py-2 rounded-[var(--r-md)] border font-mono text-sm"
              style={{
                background: 'var(--bg)',
                borderColor:
                  collectionSlug.length > 0 && !slugValid
                    ? 'var(--error)'
                    : 'var(--bd)',
                color: 'var(--t1)',
              }}
            />
            <span
              className="text-xs"
              style={{
                color:
                  collectionSlug.length > 0 && !slugValid
                    ? 'var(--error)'
                    : 'var(--t3)',
              }}
            >
              영소문자 + 숫자 + hyphen, 3~80 chars (예: csat-essential-2000)
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-display" style={{ color: 'var(--t2)' }}>
              collection_title <span style={{ color: 'var(--error)' }}>*</span>
            </span>
            <input
              type="text"
              value={collectionTitle}
              onChange={(e) => setCollectionTitle(e.target.value)}
              placeholder="수능 필수 2000"
              maxLength={200}
              className="px-3 py-2 rounded-[var(--r-md)] border font-display text-sm"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--bd)',
                color: 'var(--t1)',
              }}
            />
            <span className="text-xs" style={{ color: 'var(--t3)' }}>
              사용자에게 표시될 한글 컬렉션 이름 (1~200 chars)
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-display" style={{ color: 'var(--t2)' }}>
              cover_emoji
            </span>
            <input
              type="text"
              value={coverEmoji}
              onChange={(e) => setCoverEmoji(e.target.value)}
              placeholder="📚"
              maxLength={8}
              className="px-3 py-2 rounded-[var(--r-md)] border font-display text-base w-24"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--bd)',
                color: 'var(--t1)',
              }}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-display" style={{ color: 'var(--t2)' }}>
              description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="컬렉션 설명 (선택)"
              rows={3}
              maxLength={500}
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

      {/* target_segment 라디오 */}
      <section className="mb-8">
        <h3
          className="font-display font-semibold text-sm uppercase tracking-wider mb-4"
          style={{ color: 'var(--t2)' }}
        >
          대상 사용자 (target_segment) <span style={{ color: 'var(--error)' }}>*</span>
        </h3>

        <div className="grid grid-cols-2 gap-2">
          {SEGMENTS.map((s) => {
            const checked = targetSegment === s.value
            return (
              <label
                key={s.value}
                className="flex flex-col gap-1 p-3 rounded-[var(--r-md)] border cursor-pointer"
                style={{
                  background: checked ? 'var(--p-light)' : 'var(--bg)',
                  borderColor: checked ? 'var(--p)' : 'var(--bd)',
                }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="target_segment"
                    value={s.value}
                    checked={checked}
                    onChange={() => setTargetSegment(s.value)}
                  />
                  <span
                    className="font-display font-semibold text-sm"
                    style={{ color: checked ? 'var(--p)' : 'var(--t1)' }}
                  >
                    {s.label}
                  </span>
                </div>
                <span className="text-xs ml-6" style={{ color: 'var(--t3)' }}>
                  {s.hint}
                </span>
              </label>
            )
          })}
        </div>
      </section>

      {/* target_cefr_range checkbox */}
      <section className="mb-8">
        <h3
          className="font-display font-semibold text-sm uppercase tracking-wider mb-4"
          style={{ color: 'var(--t2)' }}
        >
          대상 CEFR 레벨 (target_cefr_range){' '}
          <span style={{ color: 'var(--error)' }}>*</span>
        </h3>

        <div className="flex gap-2 flex-wrap">
          {CEFR_LEVELS.map((level) => {
            const checked = targetCefrRange.includes(level)
            return (
              <label
                key={level}
                className="flex items-center gap-2 px-4 py-2 rounded-[var(--r-md)] border cursor-pointer"
                style={{
                  background: checked ? `var(--cefr-${level}-bg)` : 'var(--bg)',
                  borderColor: checked
                    ? `var(--cefr-${level}-text)`
                    : 'var(--bd)',
                  color: checked ? `var(--cefr-${level}-text)` : 'var(--t2)',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCefr(level)}
                />
                <span className="font-mono font-semibold text-sm">{level}</span>
              </label>
            )
          })}
        </div>
        {!cefrValid && targetCefrRange.length === 0 && (
          <p className="text-xs mt-2" style={{ color: 'var(--error)' }}>
            최소 1개 이상 선택
          </p>
        )}
      </section>

      {/* 제출 오류 */}
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

      {/* 제출 버튼 */}
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
          {isPending ? '생성 중...' : 'Run 생성'}
        </button>
        <span className="text-xs" style={{ color: 'var(--t3)' }}>
          생성 후 Run 상세 페이지로 이동합니다
        </span>
      </div>
    </div>
  )
}
