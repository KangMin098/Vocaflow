// apps/web/src/components/admin/vcb/VcbRunProgress.tsx
// run.status 기반 파이프라인 진행 오리엔테이션 — "지금 어디 · 다음 할 일" 을 한눈에.
// DB status 만 사용(FS 비의존) — 결정 B(FS/CLI 결합 탈피) 정합. FS 의존 VcbPipelineGuide 를 대체.

import { ArrowRight, Check } from 'lucide-react'
import type { RunStatus } from '@/lib/vcb/types'

const PHASES: { label: string; statuses: RunStatus[] }[] = [
  { label: '생성', statuses: ['created'] },
  { label: '시드', statuses: ['ingesting', 'normalized', 'extracted'] },
  { label: '사전 매칭', statuses: ['looked_up'] },
  { label: 'AI 보강', statuses: ['enriching'] },
  { label: 'QA', statuses: ['qa'] },
  { label: '큐레이션', statuses: ['curating'] },
  { label: '발행', statuses: ['publishing', 'published'] },
]

const NEXT_ACTION: Record<RunStatus, string> = {
  created: '시드 확보 — 방식 A(파일) 또는 B(AI 생성)',
  ingesting: '사전 매칭 실행 (Step 4)',
  normalized: '사전 매칭 실행 (Step 4)',
  extracted: '사전 매칭 실행 (Step 4)',
  looked_up: 'AI 보강 실행 (Step 5)',
  enriching: 'QA 게이트 실행 (Step 6)',
  qa: '큐레이션 시작 (Step 7)',
  curating: '검토 후 발행 (Step 8)',
  publishing: '발행 진행 중…',
  published: '발행 완료 — 라이브러리에 게시됨',
  failed: '실패 — 로그 확인 후 재시도',
}

export function VcbRunProgress({ status }: { status: RunStatus }) {
  const currentIdx = PHASES.findIndex((p) => p.statuses.includes(status))
  const isFailed = status === 'failed'
  const isPublished = status === 'published'

  return (
    <section
      aria-label="파이프라인 진행 단계"
      className="mb-8 rounded-[var(--r-lg)] border p-4"
      style={{ borderColor: 'var(--bd)', background: 'var(--bg2)' }}
    >
      <ol className="flex items-center gap-1 flex-wrap">
        {PHASES.map((p, i) => {
          const done = isPublished || currentIdx > i
          const active = !isPublished && currentIdx === i
          return (
            <li key={p.label} className="flex items-center gap-1">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--r-full)] font-display text-xs font-medium whitespace-nowrap"
                style={{
                  background: done
                    ? 'var(--success-light)'
                    : active
                      ? 'var(--combo)'
                      : 'var(--bg)',
                  color: done ? 'var(--success)' : active ? 'var(--ti)' : 'var(--t4)',
                  border: `1px solid ${
                    done ? 'var(--success)' : active ? 'var(--combo)' : 'var(--bd)'
                  }`,
                }}
              >
                {done && <Check className="w-3 h-3" aria-hidden />}
                {p.label}
              </span>
              {i < PHASES.length - 1 && (
                <ArrowRight
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: 'var(--t4)' }}
                  aria-hidden
                />
              )}
            </li>
          )
        })}
      </ol>

      <p
        className="mt-3 text-sm font-body flex items-center gap-2"
        style={{ color: isFailed ? 'var(--error)' : 'var(--t2)' }}
      >
        <span
          className="font-display font-semibold shrink-0"
          style={{ color: isFailed ? 'var(--error)' : isPublished ? 'var(--success)' : 'var(--p)' }}
        >
          {isPublished ? '완료' : isFailed ? '오류' : '다음'}
        </span>
        {NEXT_ACTION[status]}
      </p>
    </section>
  )
}
