// apps/web/src/app/(main)/settings/page.tsx
// 설정 — 자율성 지원 (Self-Determination Theory) 기반 카테고리 분리
//   · 학습 흐름 (Learning Flow) — 학습 과학 직접 영향
//   · 외형 (Appearance) — 테마·폰트
//   · 음성 (Audio) — TTS·속도
//   · 알림 (Notifications) — Calm UI: 끄는 게 기본 친화적
//   · 데이터·계정 (Data & Account) — 통제권

'use client'

import {
  AlertTriangle,
  BellOff,
  Brain,
  Check,
  ChevronRight,
  Download,
  Eye,
  KeyRound,
  Languages,
  LogOut,
  Moon,
  Palette,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  Volume2,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// ──────────────────────────────────────────────
// useStateWithSave — 변경 시 전역 'settings:saved' 이벤트 발화
// (실제 백엔드 저장은 Phase 2 — 현재는 시각 피드백만 제공)
// ──────────────────────────────────────────────
function useStateWithSave<T>(initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial)
  const isFirst = useRef(true)
  const wrapped = (v: T) => {
    setValue(v)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('settings:saved'))
    }
  }
  useEffect(() => {
    isFirst.current = false
  }, [])
  return [value, wrapped]
}

// ──────────────────────────────────────────────
// SaveIndicator — 우측 상단 sticky 배지
// ──────────────────────────────────────────────
function SaveIndicator() {
  const [saving, setSaving] = useState<'idle' | 'saved'>('idle')
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const handler = () => {
      setSaving('saved')
      clearTimeout(timeout)
      timeout = setTimeout(() => setSaving('idle'), 1600)
    }
    window.addEventListener('settings:saved', handler)
    return () => {
      window.removeEventListener('settings:saved', handler)
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed right-6 top-6 z-30 inline-flex items-center gap-1.5 rounded-full bg-[var(--success-light)] px-3 py-1.5 font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--success)] shadow-[var(--sh-md)] transition-all duration-[var(--dur-normal)] ${
        saving === 'saved' ? 'opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
      }`}
    >
      <Check size={11} strokeWidth={3} aria-hidden />
      저장됨
    </div>
  )
}

import { Screen } from '@/components/ui/ios'
import { Toggle } from '@/components/ui/Toggle'
import { signOut } from '@/hooks/useAuth'

// ══════════════════════════════════════════════════════════════
// Section · SettingRow 보조
// ══════════════════════════════════════════════════════════════
interface SectionProps {
  id: string
  icon: LucideIcon
  title: string
  description: string
  accent: string
  children: React.ReactNode
}

function Section({ id, icon: Icon, title, description, accent, children }: SectionProps) {
  return (
    <section
      id={id}
      aria-label={title}
      className="scroll-mt-20 rounded-ios-2xl bg-[var(--bg)] p-6 shadow-ios-2 md:p-8"
    >
      <header className="mb-6 flex items-start gap-4">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-ios-md"
          style={{ backgroundColor: `${accent}15`, color: accent }}
          aria-hidden
        >
          <Icon size={18} strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[18px] font-[700] text-[var(--t1)]">{title}</h2>
          <p className="mt-0.5 font-body text-[13px] leading-relaxed text-[var(--t2)]">
            {description}
          </p>
        </div>
      </header>

      <div className="space-y-1 divide-y divide-[var(--bd)]">{children}</div>
    </section>
  )
}

interface RowProps {
  label: string
  description?: string
  control: React.ReactNode
}

function Row({ label, description, control }: RowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="font-display text-[14px] font-[600] text-[var(--t1)]">{label}</p>
        {description && (
          <p className="mt-1 font-body text-[12px] leading-relaxed text-[var(--t2)]">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

// ── Segment switch ──
interface SegmentProps<T extends string> {
  value: T
  options: { value: T; label: string; icon?: LucideIcon }[]
  onChange: (v: T) => void
  ariaLabel: string
}

function Segment<T extends string>({ value, options, onChange, ariaLabel }: SegmentProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-1"
    >
      {options.map((opt) => {
        const Icon = opt.icon
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            // 44px 하한 — 실측 87x30 이었다(a11y 스윕 17회차). 세그먼트는 좁은 화면에서
            // 나란히 서므로 높이만 올린다(너비는 라벨이 정한다).
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-sm)] px-3 py-1.5 font-display text-[12px] font-[600] transition-all duration-[var(--dur-normal)] ${
              active
                ? 'bg-[var(--bg)] text-[var(--t1)] shadow-[var(--sh-xs)]'
                : 'text-[var(--t2)] hover:text-[var(--t1)]'
            }`}
          >
            {Icon && <Icon size={13} strokeWidth={2} aria-hidden />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Page
// ══════════════════════════════════════════════════════════════
export default function SettingsPage() {
  // 학습 흐름
  const [focusMode, setFocusMode] = useStateWithSave(true)
  const [memoryDecay, setMemoryDecay] = useStateWithSave(true)
  const [activeRecallDelay, setActiveRecallDelay] = useStateWithSave<'short' | 'normal' | 'long'>(
    'normal'
  )

  // 외형
  const [theme, setTheme] = useStateWithSave<'light' | 'dark' | 'system'>('system')
  const [reducedMotion, setReducedMotion] = useStateWithSave(false)

  // 음성
  const [ttsEnabled, setTtsEnabled] = useStateWithSave(true)
  const [ttsVoice, setTtsVoice] = useStateWithSave<'natural' | 'fast' | 'lang-female'>('natural')
  const [ttsSpeed, setTtsSpeed] = useStateWithSave(1.0)

  // 알림
  const [notifyDaily, setNotifyDaily] = useStateWithSave(false)
  const [notifyStreak, setNotifyStreak] = useStateWithSave(false)
  const [notifyEmail, setNotifyEmail] = useStateWithSave(true)

  // 로그아웃 — signOut() 이 세션 종료 후 '/login' 으로 hard reload 한다.
  // 실패해도 버튼이 영구히 잠기지 않도록 finally 에서 되돌린다.
  const [signingOut, setSigningOut] = useState(false)
  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <Screen width="content" background="bg2" padX="md">
      <div className="py-6 md:py-8">
        <SaveIndicator />
        {/* ── Header ── */}
        <header className="mb-6 px-1">
          <h1 className="font-editorial text-[44px] font-[500] tracking-[-0.012em] leading-[1.02] text-[var(--t1)] md:text-[56px]">
            설정
          </h1>
          <p className="mt-2 font-body text-[15px] leading-relaxed text-[var(--t2)]">
            학습 흐름은 당신의 것이에요. 무엇이든 자유롭게 바꿔보세요.
          </p>
        </header>

        {/* ── Quick TOC — iOS 캡슐 ── */}
        <nav aria-label="섹션 바로가기" className="mb-6 flex flex-wrap gap-2 px-1">
          {[
            { href: '#learning', label: '학습 흐름' },
            { href: '#appearance', label: '외형' },
            { href: '#audio', label: '음성' },
            { href: '#notifications', label: '알림' },
            { href: '#account', label: '계정·데이터' },
          ].map((c) => (
            <a
              key={c.href}
              href={c.href}
              className="rounded-ios-pill bg-[var(--bg)] px-3 py-1.5 font-display text-[12.5px] font-[600] text-[var(--t2)] shadow-ios-1 transition-all duration-[var(--dur-ios-fast)] hover:bg-[var(--p-light)] hover:text-[var(--on-p-tint)] active:scale-[0.97]"
            >
              {c.label}
            </a>
          ))}
        </nav>

      <div className="space-y-5">
        {/* ── 학습 흐름 ── */}
        <Section
          id="learning"
          icon={Brain}
          title="학습 흐름"
          description="학습 과학에 기반한 핵심 동작을 조정합니다."
          accent="var(--p)"
        >
          <Row
            label="집중 모드 (Focus Mode)"
            description="30초 무활동 시 사이드바를 흐리게 만들어 본문에 집중을 돕습니다."
            control={
              <Toggle
                checked={focusMode}
                onChange={(e) => setFocusMode(e.target.checked)}
                aria-label="집중 모드"
              />
            }
          />
          <Row
            label="Memory Decay 색 추적"
            description="단어의 기억 상태(stable/shaky/risk/new)를 색으로 표시합니다."
            control={
              <Toggle
                checked={memoryDecay}
                onChange={(e) => setMemoryDecay(e.target.checked)}
                aria-label="Memory Decay 색 추적"
              />
            }
          />
          <Row
            label="능동적 회상 대기 시간"
            description="단어 의미 카드가 표시되기까지의 회상 시도 시간."
            control={
              <Segment
                value={activeRecallDelay}
                options={[
                  { value: 'short', label: '짧게 (1.5초)' },
                  { value: 'normal', label: '보통 (3초)' },
                  { value: 'long', label: '길게 (5초)' },
                ]}
                onChange={setActiveRecallDelay}
                ariaLabel="능동적 회상 대기 시간"
              />
            }
          />
        </Section>

        {/* ── 외형 ── */}
        <Section
          id="appearance"
          icon={Palette}
          title="외형"
          description="시각 환경을 당신에게 맞춥니다."
          accent="#8B5CF6"
        >
          <Row
            label="테마"
            description="시스템 설정을 따르거나 직접 선택할 수 있습니다."
            control={
              <Segment
                value={theme}
                options={[
                  { value: 'light', label: '라이트', icon: Sun },
                  { value: 'dark', label: '다크', icon: Moon },
                  { value: 'system', label: '시스템', icon: Sparkles },
                ]}
                onChange={setTheme}
                ariaLabel="테마"
              />
            }
          />
          <Row
            label="모션 감소"
            description="애니메이션을 최소화하여 시각 자극을 줄입니다 (전정 감각 민감자 추천)."
            control={
              <Toggle
                checked={reducedMotion}
                onChange={(e) => setReducedMotion(e.target.checked)}
                aria-label="모션 감소"
              />
            }
          />
        </Section>

        {/* ── 음성 ── */}
        <Section
          id="audio"
          icon={Volume2}
          title="음성"
          description="TTS 발음을 당신의 학습 속도에 맞춥니다 (이중 부호화 지원)."
          accent="var(--info)"
        >
          <Row
            label="TTS 활성화"
            description="단어·문장 옆 음성 재생 버튼을 표시합니다."
            control={
              <Toggle
                checked={ttsEnabled}
                onChange={(e) => setTtsEnabled(e.target.checked)}
                aria-label="TTS 활성화"
              />
            }
          />
          <Row
            label="발음 보이스"
            description="OpenAI TTS-1 보이스 종류를 선택합니다."
            control={
              <Segment
                value={ttsVoice}
                options={[
                  { value: 'natural', label: 'Natural (남성)' },
                  { value: 'fast', label: 'Fast (중성)' },
                  { value: 'lang-female', label: 'Lang (여성)' },
                ]}
                onChange={setTtsVoice}
                ariaLabel="발음 보이스"
              />
            }
          />
          <Row
            label="재생 속도"
            description={`현재 ${ttsSpeed.toFixed(2)}x — 권장: 0.9~1.1x`}
            control={
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={ttsSpeed}
                  onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                  className="h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-[var(--bg3)] accent-[var(--p)]"
                  aria-label="재생 속도"
                />
                <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
                  {ttsSpeed.toFixed(2)}x
                </span>
              </div>
            }
          />
        </Section>

        {/* ── 알림 ── */}
        <Section
          id="notifications"
          icon={BellOff}
          title="알림"
          description="Calm UI 원칙 — 알림은 기본 OFF. 정말 도움이 될 때만 켜세요."
          accent="var(--active)"
        >
          <Row
            label="매일 학습 리마인더"
            description="설정한 시간(기본 21:00)에 부드럽게 푸시 알림을 보냅니다."
            control={
              <Toggle
                checked={notifyDaily}
                onChange={(e) => setNotifyDaily(e.target.checked)}
                aria-label="매일 학습 리마인더"
              />
            }
          />
          <Row
            label="Streak 위험 알림"
            description="연속 학습이 끊기기 4시간 전에만 1회 알림 (압박 없이 부드럽게)."
            control={
              <Toggle
                checked={notifyStreak}
                onChange={(e) => setNotifyStreak(e.target.checked)}
                aria-label="Streak 위험 알림"
              />
            }
          />
          <Row
            label="이메일 — 주간 요약"
            description="매주 일요일 저녁, 한 주의 학습을 차분히 돌아보는 메일."
            control={
              <Toggle
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                aria-label="이메일 주간 요약"
              />
            }
          />
        </Section>

        {/* ── 계정·데이터 ── */}
        <Section
          id="account"
          icon={Shield}
          title="계정·데이터"
          description="당신의 정보·학습 기록은 언제든 가져가거나 지울 수 있어요."
          accent="var(--success)"
        >
          {(
            [
              {
                label: '비밀번호 변경',
                description: '계정 보안을 위해 주기적인 변경을 권장합니다.',
                icon: KeyRound,
                ready: false,
              },
              {
                label: '내 데이터 내보내기',
                description: '학습 기록·단어장을 JSON 형식으로 받습니다.',
                icon: Download,
                ready: false,
              },
              {
                label: '언어 설정',
                description: 'UI 언어를 선택합니다. 영어 학습 콘텐츠는 영향 받지 않습니다.',
                icon: Languages,
                ready: false,
              },
              {
                label: '통계 활용 동의',
                description: '학습 효과 개선을 위한 익명 통계 활용. 언제든 철회 가능.',
                icon: Eye,
                ready: false,
              },
            ] as const
          ).map((row) => {
            const Icon = row.icon
            return (
              <button
                key={row.label}
                type="button"
                disabled={!row.ready}
                aria-disabled={!row.ready}
                className="group -mx-2 flex w-full items-center gap-3 rounded-[var(--r-md)] px-2 py-3 text-left transition-colors duration-[var(--dur-normal)] enabled:hover:bg-[var(--bg2)] disabled:cursor-not-allowed"
              >
                <span
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--bg2)] text-[var(--t2)]"
                  aria-hidden
                >
                  <Icon size={14} strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-display text-[14px] font-[600] text-[var(--t1)]">
                      {row.label}
                    </p>
                    {!row.ready && (
                      <span className="inline-flex items-center rounded-full bg-[var(--warning-light)] px-1.5 py-0.5 font-display text-[9px] font-[700] uppercase tracking-[0.08em] text-[var(--active)]">
                        준비중
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-body text-[12px] text-[var(--t2)]">
                    {row.description}
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  className="shrink-0 text-[var(--t2)] opacity-40 group-enabled:opacity-100"
                  aria-hidden
                />
              </button>
            )
          })}

          {/* Danger zone */}
          <div className="mt-4 rounded-[var(--r-md)] border border-[var(--error)]/20 bg-[var(--error-light)]/40 p-4">
            <header className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-[var(--error-ink)]" aria-hidden />
              <p className="font-display text-[12px] font-[700] uppercase tracking-[0.06em] text-[var(--error-ink)]">
                위험 구역
              </p>
            </header>
            <p className="mt-2 font-body text-[12px] leading-relaxed text-[var(--t2)]">
              계정을 해지하면 30일간 복원 가능 상태로 보관 후 영구 삭제됩니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {/* v06.140: onClick 이 없어 눌러도 아무 일도 없었다 — 앱 전체에 로그아웃 수단이 없던 자리 */}
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-1.5 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut size={12} aria-hidden />
                {signingOut ? '로그아웃 중...' : '로그아웃'}
              </button>
              <button className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--error)]/30 bg-[var(--bg)] px-3 py-1.5 font-display text-[12px] font-[600] text-[var(--error-ink)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--error-light)]">
                <Trash2 size={12} aria-hidden />
                계정 해지
              </button>
            </div>
          </div>
        </Section>
      </div>

        <footer className="mt-10 text-center">
          <p className="font-body text-[12px] italic text-[var(--t2)]">
            변경 사항은 자동으로 저장됩니다.
          </p>
        </footer>
      </div>
    </Screen>
  )
}
