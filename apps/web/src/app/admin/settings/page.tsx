// apps/web/src/app/admin/settings/page.tsx
// 시스템 설정 — feature flags · AI 프롬프트 · 공지 · 점검

'use client'

import {
  AlertCircle,
  Bot,
  ChevronRight,
  Clock,
  Code2,
  Edit3,
  Megaphone,
  Power,
  Shield,
  Sliders,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'

import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { Toggle } from '@/components/ui/Toggle'

interface FeatureFlag {
  key: string
  label: string
  description: string
  enabled: boolean
  audience: 'all' | 'beta' | 'admin'
  updatedAt: string
}

interface PromptVersion {
  id: string
  name: string
  version: string
  model: string
  description: string
  active: boolean
  updatedAt: string
}

interface BroadcastNotice {
  id: string
  title: string
  audience: '전체' | 'Pro' | 'Team'
  sendsAt: string
  status: 'draft' | 'scheduled' | 'sent'
}

const FLAGS: FeatureFlag[] = [
  {
    key: 'tts_natural_voice',
    label: 'TTS Natural 보이스',
    description: 'OpenAI TTS-1 자연스러운 보이스 활성화 (Pro 전용).',
    enabled: true,
    audience: 'all',
    updatedAt: '2026-04-21',
  },
  {
    key: 'memory_decay_v2',
    label: 'Memory Decay v2 알고리즘',
    description: '단어별 기억 상태 추적 — SM-2 + 간격 가중.',
    enabled: true,
    audience: 'all',
    updatedAt: '2026-04-15',
  },
  {
    key: 'wordblitz_3d',
    label: 'WordBlitz 3D (Three.js)',
    description: '인형뽑기 풀스크린 3D 게임. /play/wordblitz.',
    enabled: true,
    audience: 'beta',
    updatedAt: '2026-04-30',
  },
  {
    key: 'ai_extraction_gpt4o',
    label: 'AI 단어 추출 — GPT-4o',
    description: '기본 GPT-4o-mini 대신 더 정밀한 GPT-4o로 처리.',
    enabled: false,
    audience: 'beta',
    updatedAt: '2026-04-10',
  },
  {
    key: 'admin_audit_log',
    label: 'Admin Audit Log',
    description: '관리자 액션을 audit_logs 테이블에 기록.',
    enabled: true,
    audience: 'admin',
    updatedAt: '2026-03-25',
  },
]

const PROMPTS: PromptVersion[] = [
  {
    id: 'p-extract-v3',
    name: '단어 추출',
    version: 'v3.2',
    model: 'gpt-4o-mini',
    description: 'CEFR 기반 우선순위 + 예문 + IPA 동시 출력.',
    active: true,
    updatedAt: '2026-04-12',
  },
  {
    id: 'p-quiz-v2',
    name: 'ScriptQuiz 생성',
    version: 'v2.4',
    model: 'gpt-4o',
    description: '4지선다 + OX + 근거 문장 (sourceSnippet) 강제 포함.',
    active: true,
    updatedAt: '2026-04-08',
  },
  {
    id: 'p-summary-v1',
    name: '주간 학습 리포트',
    version: 'v1.0',
    model: 'gpt-4o-mini',
    description: '학습자 톤 — 격려·차분·공감.',
    active: false,
    updatedAt: '2026-02-18',
  },
]

const NOTICES: BroadcastNotice[] = [
  {
    id: 'n-001',
    title: 'WordBlitz 3D 정식 출시 안내',
    audience: '전체',
    sendsAt: '2026-05-03 18:00',
    status: 'scheduled',
  },
  {
    id: 'n-002',
    title: 'Pro 플랜 신규 기능 — Memory Decay v2',
    audience: 'Pro',
    sendsAt: '2026-04-25 09:00',
    status: 'sent',
  },
]

const AUDIENCE_META: Record<
  FeatureFlag['audience'],
  { label: string; color: string; bg: string }
> = {
  all: { label: '전체', color: 'var(--success)', bg: 'var(--success-light)' },
  beta: { label: 'Beta', color: 'var(--info)', bg: 'var(--info-light)' },
  admin: { label: 'Admin', color: '#8B5CF6', bg: '#F5F3FF' },
}

const NOTICE_STATUS_META: Record<
  BroadcastNotice['status'],
  { label: string; color: string; bg: string }
> = {
  draft: { label: '초안', color: 'var(--t3)', bg: 'var(--bg3)' },
  scheduled: { label: '예약', color: 'var(--info)', bg: 'var(--info-light)' },
  sent: { label: '발송완료', color: 'var(--success)', bg: 'var(--success-light)' },
}

interface SectionProps {
  id: string
  icon: LucideIcon
  title: string
  description: string
  accent: string
  children: React.ReactNode
}

function SettingsSection({ id, icon: Icon, title, description, accent, children }: SectionProps) {
  return (
    <section
      id={id}
      aria-label={title}
      className="rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 shadow-[var(--sh-sm)] md:p-7"
    >
      <header className="mb-5 flex items-start gap-3">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--r-md)]"
          style={{ backgroundColor: `${accent}15`, color: accent }}
          aria-hidden
        >
          <Icon size={18} strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">{title}</h2>
          <p className="mt-0.5 font-body text-[12px] leading-relaxed text-[var(--t2)]">
            {description}
          </p>
        </div>
      </header>
      {children}
    </section>
  )
}

export default function AdminSystemSettingsPage() {
  const [maintenance, setMaintenance] = useState(false)
  const [flags, setFlags] = useState<FeatureFlag[]>(FLAGS)

  function toggleFlag(key: string) {
    setFlags((prev) =>
      prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f))
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:px-8">
      <AdminPageHeader
        icon={Sliders}
        title="시스템 설정"
        description="feature flags · AI 프롬프트 · 공지 · 점검"
      />

      <AdminScreenHelp screen="settings" className="-mt-3 mb-6" />

      <div className="space-y-5">
        {/* ── 점검 모드 (긴급 액션 — 가장 위) ── */}
        <SettingsSection
          id="maintenance"
          icon={Power}
          title="점검 모드"
          description="활성화 시 모든 사용자가 점검 안내 페이지로 리다이렉트됩니다."
          accent="var(--error)"
        >
          <div
            className={`flex items-start gap-4 rounded-[var(--r-md)] border p-4 ${
              maintenance
                ? 'border-[var(--error)]/30 bg-[var(--error-light)]/40'
                : 'border-[var(--bd)] bg-[var(--bg2)]'
            }`}
          >
            <span
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                maintenance ? 'bg-[var(--error)] text-white' : 'bg-[var(--bg3)] text-[var(--t2)]'
              }`}
              aria-hidden
            >
              {maintenance ? <AlertCircle size={16} /> : <Wrench size={16} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[13px] font-[700] text-[var(--t1)]">
                {maintenance ? '점검 중 — 모든 사용자에게 안내 페이지 표시 중' : '정상 운영 중'}
              </p>
              <p className="mt-1 font-body text-[12px] leading-relaxed text-[var(--t2)]">
                {maintenance
                  ? '관리자만 우회 접근 가능합니다.'
                  : '서비스 점검·배포 시 활성화하세요. 활성화 후 즉시 적용됩니다.'}
              </p>
            </div>
            <Toggle
              checked={maintenance}
              onChange={(e) => setMaintenance(e.target.checked)}
              aria-label="점검 모드"
            />
          </div>
        </SettingsSection>

        {/* ── Feature Flags ── */}
        <SettingsSection
          id="flags"
          icon={Code2}
          title="Feature Flags"
          description="기능 단위 ON/OFF — 변경 즉시 모든 활성 세션에 적용."
          accent="var(--p)"
        >
          <ul className="divide-y divide-[var(--bd)]">
            {flags.map((f) => {
              const aud = AUDIENCE_META[f.audience]
              return (
                <li key={f.key} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-display text-[13px] font-[700] text-[var(--t1)]">
                        {f.label}
                      </p>
                      <span
                        className="inline-flex rounded-full px-2 py-1 font-display text-[10px] font-[700]"
                        style={{ backgroundColor: aud.bg, color: aud.color }}
                      >
                        {aud.label}
                      </span>
                    </div>
                    <p className="mt-0.5 font-body text-[12px] leading-relaxed text-[var(--t2)]">
                      {f.description}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-[var(--t2)]">
                      <code className="text-[var(--t2)]">{f.key}</code> · 마지막 변경 {f.updatedAt}
                    </p>
                  </div>
                  <Toggle
                    checked={f.enabled}
                    onChange={() => toggleFlag(f.key)}
                    aria-label={f.label}
                  />
                </li>
              )
            })}
          </ul>
        </SettingsSection>

        {/* ── AI 프롬프트 관리 ── */}
        <SettingsSection
          id="prompts"
          icon={Bot}
          title="AI 프롬프트 관리"
          description="버전 관리 + 활성/비활성 + 모델 선택 (gpt-4o-mini · gpt-4o)."
          accent="#8B5CF6"
        >
          <ul className="space-y-2">
            {PROMPTS.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[#F5F3FF] text-[#8B5CF6]">
                  <Sparkles size={14} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-display text-[13px] font-[700] text-[var(--t1)]">
                      {p.name}
                    </p>
                    <span className="rounded-[var(--r-sm)] bg-[var(--bg2)] px-2 py-1 font-mono text-[10px] font-[700] text-[var(--t2)]">
                      {p.version}
                    </span>
                    <span className="rounded-[var(--r-sm)] bg-[var(--p-light)] px-2 py-1 font-mono text-[10px] font-[700] text-[var(--on-p-tint)]">
                      {p.model}
                    </span>
                    {p.active && (
                      <span className="rounded-full bg-[var(--success-light)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--success)]">
                        활성
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-body text-[12px] text-[var(--t2)]">{p.description}</p>
                </div>
                <button
                  className="inline-flex items-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 font-display text-[11px] font-[600] text-[var(--t2)] hover:bg-[var(--bg2)]"
                  aria-label="편집"
                >
                  <Edit3 size={11} aria-hidden />
                  편집
                </button>
              </li>
            ))}
          </ul>
        </SettingsSection>

        {/* ── 인앱 공지 ── */}
        <SettingsSection
          id="notices"
          icon={Megaphone}
          title="인앱 공지"
          description="전체 또는 특정 그룹 대상 메시지 발송."
          accent="var(--active)"
        >
          <ul className="space-y-2">
            {NOTICES.map((n) => {
              const status = NOTICE_STATUS_META[n.status]
              return (
                <li
                  key={n.id}
                  className="flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--warning-light)] text-[var(--active)]">
                    <Megaphone size={14} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-display text-[13px] font-[700] text-[var(--t1)]">
                        {n.title}
                      </p>
                      <span
                        className="inline-flex rounded-full px-2 py-1 font-display text-[10px] font-[700]"
                        style={{ backgroundColor: status.bg, color: status.color }}
                      >
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-[var(--t2)]">
                      <Clock size={10} className="mr-1 inline align-text-bottom" aria-hidden />
                      {n.sendsAt} · 대상: {n.audience}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-[var(--t2)]" aria-hidden />
                </li>
              )
            })}
          </ul>
          <button className="mt-3 inline-flex items-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t2)] hover:border-[var(--p)]/40 hover:text-[var(--p)]">
            + 새 공지 작성
          </button>
        </SettingsSection>

        {/* ── 권한 ── */}
        <SettingsSection
          id="rbac"
          icon={Shield}
          title="관리자 권한"
          description="RBAC 역할 할당 — superadmin · ops · content · viewer"
          accent="var(--info)"
        >
          <ul className="space-y-2">
            {[
              { role: 'superadmin', members: 2, color: '#EC4899' },
              { role: 'ops', members: 4, color: 'var(--p)' },
              { role: 'content', members: 3, color: 'var(--success)' },
              { role: 'viewer', members: 7, color: 'var(--t3)' },
            ].map((r) => (
              <li
                key={r.role}
                className="flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3"
              >
                <span
                  className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: r.color }}
                  aria-hidden
                />
                <p className="flex-1 font-mono text-[12px] font-[700] text-[var(--t1)]">{r.role}</p>
                <span className="font-mono text-[11px] text-[var(--t2)]">{r.members}명</span>
                <ChevronRight size={14} className="text-[var(--t2)]" aria-hidden />
              </li>
            ))}
          </ul>
        </SettingsSection>
      </div>
    </div>
  )
}
