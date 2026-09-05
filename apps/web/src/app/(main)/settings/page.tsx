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
import Link from 'next/link'
import { useEffect, useState } from 'react'

// ──────────────────────────────────────────────
// 저장 알림
//
// ⚠️ **저장되지 않았는데 「저장됨」을 띄우지 않는다** (실측 2026-09-05).
//    예전에는 컨트롤 11개가 전부 `useState` 였고, 무엇을 눌러도 이 배지가 떴다.
//    새로고침하면 모두 원래대로였고 학습자는 자기가 잘못 눌렀다고 생각한다.
//    지금은 실제 저장 결과(`lib/settings/device-prefs.ts` 가 돌려주는 boolean)를 싣는다 —
//    사생활 보호 모드처럼 저장이 막힌 브라우저에서는 **막혔다고 말한다.**
// ──────────────────────────────────────────────
const SAVE_EVENT = 'settings:saved'

function notifySaved(saved: boolean) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SAVE_EVENT, { detail: { saved } }))
}

function SaveIndicator() {
  const [state, setState] = useState<'idle' | 'saved' | 'failed'>('idle')
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const handler = (e: Event) => {
      const ok = (e as CustomEvent<{ saved: boolean }>).detail?.saved !== false
      setState(ok ? 'saved' : 'failed')
      clearTimeout(timeout)
      // 실패는 더 오래 남긴다 — 1.6초면 못 읽는다.
      timeout = setTimeout(() => setState('idle'), ok ? 1600 : 5000)
    }
    window.addEventListener(SAVE_EVENT, handler)
    return () => {
      window.removeEventListener(SAVE_EVENT, handler)
      clearTimeout(timeout)
    }
  }, [])

  const failed = state === 'failed'
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed right-6 top-6 z-30 inline-flex items-center gap-2 rounded-full px-3 py-2 font-display text-[11px] font-[700] uppercase tracking-[0.06em] shadow-[var(--sh-md)] transition-all duration-[var(--dur-normal)] ${
        failed
          ? 'bg-[var(--danger-light)] text-[var(--danger)]'
          : 'bg-[var(--success-light)] text-[var(--success)]'
      } ${state === 'idle' ? 'pointer-events-none -translate-y-2 opacity-0' : 'opacity-100'}`}
    >
      {failed ? (
        <AlertTriangle size={11} strokeWidth={3} aria-hidden />
      ) : (
        <Check size={11} strokeWidth={3} aria-hidden />
      )}
      {failed ? '이 브라우저에는 저장할 수 없어요' : '저장됨'}
    </div>
  )
}

import { Screen } from '@/components/ui/ios'
import { Toggle } from '@/components/ui/Toggle'
import { signOut } from '@/hooks/useAuth'
import { useMotionPreference } from '@/components/layout/DevicePreferences'
import { useDevicePrefs, useThemePreference } from '@/lib/settings/device-prefs'

/** 아직 못 하는 것을 못 한다고 말하는 자리. 토글처럼 보이면 안 된다. */
function PendingBadge() {
  return (
    <span className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--bg3)] px-3 py-1 font-display text-[11px] font-[700] text-[var(--t3)]">
      준비 중
    </span>
  )
}

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
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-sm)] px-3 py-2 font-display text-[12px] font-[600] transition-all duration-[var(--dur-normal)] ${
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
  // 기기에 실제로 남는 취향 — 저장 결과를 그대로 배지에 싣는다.
  const { prefs, set: setPref } = useDevicePrefs()
  const { preference: theme, setPreference: setThemePref } = useThemePreference()
  const { preference: motionPref, setPreference: setMotionPref } = useMotionPreference()

  const focusMode = prefs.focusMode
  const memoryDecay = prefs.memoryDecayColors
  const activeRecallDelay = prefs.recallDelay
  const ttsEnabled = prefs.ttsEnabled
  const ttsSpeed = prefs.ttsSpeed

  const savePref = <K extends keyof typeof prefs>(key: K, value: (typeof prefs)[K]) =>
    notifySaved(setPref(key, value))
  const setTheme = (v: 'light' | 'dark' | 'system') => notifySaved(setThemePref(v))
  // 모션은 3상태(system/on/off)로 저장하지만 화면은 토글 하나다 — 학습자가 만진 순간
  // 'system' 은 의미를 잃으므로 on/off 로 확정한다.
  const reducedMotion = motionPref === 'on'
  const setReducedMotion = (on: boolean) => notifySaved(setMotionPref(on ? 'on' : 'off'))

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
            // 'Reminders' 를 쓴다 — 'Notifications' 는 뱃지·알림음을 연상시키는데
            // 이 제품은 그걸 금지한다(Calm UI). 이름이 먼저 약속을 어기면 안 된다.
            { href: '#learning', label: 'Study Flow' },
            { href: '#appearance', label: 'Appearance' },
            { href: '#audio', label: 'Voice' },
            { href: '#notifications', label: 'Reminders' },
            { href: '#account', label: 'Account & Data' },
          ].map((c) => (
            <a
              key={c.href}
              href={c.href}
              // 실측 2026-08-25: 31px 이었다(py-2). 알약의 시각 높이는 그대로 두고
              // 누르는 높이만 44px 로 — inline-flex + items-center 라 알약은 그대로 보인다.
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-ios-pill bg-[var(--bg)] px-3 py-2 font-display text-[12.5px] font-[600] text-[var(--t2)] shadow-ios-1 transition-all duration-[var(--dur-ios-fast)] hover:bg-[var(--p-light)] hover:text-[var(--on-p-tint)] active:scale-[0.97]"
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
                onChange={(e) => savePref('focusMode', e.target.checked)}
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
                onChange={(e) => savePref('memoryDecayColors', e.target.checked)}
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
                  { value: 'short', label: 'Short (1.5s)' },
                  { value: 'normal', label: 'Normal (3s)' },
                  { value: 'long', label: 'Long (5s)' },
                ]}
                onChange={(v) => savePref('recallDelay', v)}
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
                  { value: 'light', label: 'Light', icon: Sun },
                  { value: 'dark', label: 'Dark', icon: Moon },
                  { value: 'system', label: 'System', icon: Sparkles },
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
                onChange={(e) => savePref('ttsEnabled', e.target.checked)}
                aria-label="TTS 활성화"
              />
            }
          />
          {/* ⚠️ 예전에는 "OpenAI TTS-1 보이스 종류를 선택합니다" 라며 세 가지를 팔았다.
              이 앱의 발음은 **브라우저 음성 합성**(`hooks/useSpeechSynthesis.ts` 의
              `window.speechSynthesis`)이고, 저장소에 OpenAI 음성 합성 호출은 0건이다.
              고를 수 없는 것을 고르게 두면 학습자는 바꿨다고 믿고 같은 소리를 듣는다. */}
          <Row
            label="발음 목소리"
            description="이 기기의 브라우저 음성을 씁니다 — 목소리는 운영체제 설정에서 바뀝니다."
            control={
              <span className="font-mono text-[11px] text-[var(--t2)]">시스템 음성</span>
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
                  onChange={(e) => savePref('ttsSpeed', parseFloat(e.target.value))}
                  // 실측 2026-08-25: 128×6 이었다. 슬라이더는 **막대가 아니라 손잡이를 잡는다** —
                  // 막대(6px)는 그대로 보이게 두고, 위아래 투명 여백으로 잡는 영역만 44px 로 넓힌다
                  // (background-clip: content-box 로 막대 색이 여백까지 번지지 않게).
                  style={{ paddingTop: 19, paddingBottom: 19, backgroundClip: 'content-box' }}
                  className="box-content h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-[var(--bg3)] accent-[var(--p)]"
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
          description="아직 보낼 길이 없어요. 준비되면 여기서 켤 수 있게 하겠습니다."
          accent="var(--active)"
        >
          {/* ⚠️ 세 토글이 켜지고 「저장됨」까지 떴지만, 이 저장소에는 알림을 보내는 코드가
              **하나도 없다** — web-push · 서비스워커 · 메일 발송 어느 것도 없다(실측 2026-09-05).
              켜 둔 사람은 오지 않는 알림을 기다리게 된다. 켤 수 있는 것처럼 두지 않는다.
              값을 저장해 두지도 않는다 — 발송이 붙는 날의 기본값을 지금 미리 정할 이유가 없다. */}
          <Row
            label="매일 학습 리마인더"
            description="학습이 끊길 즈음 한 번만 알리려고 합니다."
            control={<PendingBadge />}
          />
          <Row
            label="연속 학습이 끊기기 전"
            description="압박이 아니라 알림 한 번으로 — 방식이 정해지면 켤 수 있게 합니다."
            control={<PendingBadge />}
          />
          <Row
            label="이메일 — 주간 요약"
            description="한 주를 차분히 돌아보는 메일. 발송 경로가 준비되면 열립니다."
            control={<PendingBadge />}
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
                // v06.140: /reset-password 가 세션이 있으면 "새 비밀번호" 모드로 열린다.
                // 그전까지 로그인한 사용자는 비밀번호를 바꿀 방법이 아예 없었다.
                ready: true,
                href: '/reset-password?mode=update',
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
            const href = 'href' in row ? (row.href as string) : undefined
            const rowClass =
              'group -mx-2 flex w-full items-center gap-3 rounded-[var(--r-md)] px-2 py-3 text-left transition-colors duration-[var(--dur-normal)] enabled:hover:bg-[var(--bg2)] disabled:cursor-not-allowed'

            const inner = (
              <>
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
                      <span className="inline-flex items-center rounded-full bg-[var(--warning-light)] px-2 py-1 font-display text-[9px] font-[700] uppercase tracking-[0.08em] text-[var(--active-ink)]">
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
              </>
            )

            // 준비됐고 목적지가 있으면 링크, 아니면 disabled 버튼 그대로.
            return row.ready && href ? (
              <Link key={row.label} href={href} className={`${rowClass} hover:bg-[var(--bg2)]`}>
                {inner}
              </Link>
            ) : (
              <button
                key={row.label}
                type="button"
                disabled={!row.ready}
                aria-disabled={!row.ready}
                className={rowClass}
              >
                {inner}
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
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut size={12} aria-hidden />
                {signingOut ? '로그아웃 중...' : '로그아웃'}
              </button>
              {/* v06.140: 로그아웃과 같은 결함(onClick 없음)이었다. 해지 백엔드
                  (30일 보관 → 영구 삭제)가 아직 없으므로 배선 대신, 위 계정 항목들과
                  같은 '준비중' 규약으로 정직하게 표시한다. 눌리는데 아무 일도 없는 것이
                  가장 나쁘다. */}
              <button
                type="button"
                disabled
                title="계정 해지는 준비 중입니다. support@vocaflow.com 으로 문의해주세요."
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-sm)] border border-[var(--error)]/30 bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--error-ink)] transition-colors duration-[var(--dur-normal)] enabled:hover:bg-[var(--error-light)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={12} aria-hidden />
                계정 해지
                <span className="ml-1 inline-flex items-center rounded-full bg-[var(--warning-light)] px-2 py-1 font-display text-[9px] font-[700] uppercase tracking-[0.08em] text-[var(--active-ink)]">
                  준비중
                </span>
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
