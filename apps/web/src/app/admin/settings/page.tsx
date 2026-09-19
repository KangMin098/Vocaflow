// apps/web/src/app/admin/settings/page.tsx
// 시스템 설정 — 저장되지 않는 스위치를 "저장되지 않는다" 고 말하는 화면
//
// v06.35 이전, 점검 모드 카드는 "서비스 점검·배포 시 활성화하세요. 활성화 후 즉시 적용됩니다."
// 라고 단언했다. 저장 경로도, API 도, 그 값을 읽는 구독자도 없었다. 이 문구를 믿고 토글을 켠 뒤
// "서비스를 내렸다" 고 판단한 채 배포하면 사고다. 거짓 단언은 목업 숫자보다 위험하다 —
// 숫자는 틀린 판단을 부르지만, 이 문구는 틀린 **행동**을 부른다.
//
// 그래서:
//   · 점검 모드 토글은 disabled + 이유 표시. 화면 안에서만 바뀌는 상태(useState)도 없앴다.
//   · feature_flags · ai_prompts · notices 세 테이블은 to_regclass NULL 이다(2026-09-05 실측).
//     그 위에서 돌던 목록 5·3·2건과 "편집" · "+ 새 공지 작성" 버튼을 걷어냈다.
//   · 관리자 권한 4역할(superadmin 2 · ops 4 · content 3 · viewer 7)은 실재하지 않는 역할과
//     실재하지 않는 인원수였다. 실제 판정(canAccessAdminConsole)을 그대로 적는 것으로 대체했다.

import { Bot, Code2, Megaphone, Power, Shield, Sliders, Wrench, type LucideIcon } from 'lucide-react'

import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { MockDataBanner } from '@/components/admin/MockDataBanner'
import { Toggle } from '@/components/ui/Toggle'

export const metadata = {
  title: '시스템 설정 — Vocaflow Admin',
  description: '저장 경로 미구현 고지 · 실제 접근 제어 기준',
}

interface SectionProps {
  id: string
  icon: LucideIcon
  title: string
  description: string
  children: React.ReactNode
}

function SettingsSection({ id, icon: Icon, title, description, children }: SectionProps) {
  return (
    <section
      id={id}
      aria-label={title}
      className="rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 shadow-[var(--sh-sm)] md:p-7"
    >
      <header className="mb-5 flex items-start gap-3">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--bg3)] text-[var(--t2)]"
          aria-hidden
        >
          <Icon size={18} strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">{title}</h2>
          <p className="mt-0.5 break-keep font-body text-[12px] leading-relaxed text-[var(--t2)]">
            {description}
          </p>
        </div>
      </header>
      {children}
    </section>
  )
}

/** "여기 있어야 할 것이 없다 + 왜 없다" 만 말하는 자리. 숫자를 만들어 채우지 않는다. */
function NotWired({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-4 py-5">
      <p className="font-display text-[13px] font-[700] text-[var(--t1)]">{title}</p>
      <p className="mt-1 break-keep font-body text-[12px] leading-[1.7] text-[var(--t2)]">
        {detail}
      </p>
    </div>
  )
}

export default function AdminSystemSettingsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:px-8">
      <AdminPageHeader
        icon={Sliders}
        title="시스템 설정"
        description="저장 경로가 없는 화면 — 켜도 아무 일이 일어나지 않습니다"
      />

      <MockDataBanner
        className="mb-6"
        what="이 화면의 스위치는 아무것도 저장하지 않습니다. 점검 모드 토글은 잠가 두었고, 플래그·프롬프트·공지 목록은 비어 있습니다."
        // 지운 거짓 단언을 설명문에 그대로 옮겨 적지 않는다 — 화면에 남는 순간 그 문장은
        // 다시 읽히고, 급히 훑는 사람에게는 여전히 "즉시 적용된다" 로 보인다.
        why="feature_flags · notices · ai_prompts 테이블이 모두 존재하지 않고(to_regclass NULL · 2026-09-05 실측) 저장 API 도 없습니다. 예전 문구는 이 토글이 곧바로 서비스에 반영된다고 단언했지만 사실이 아니었습니다 — 여기서 점검 모드를 켜도 서비스는 그대로 돌아갑니다."
        instead={[{ label: '파이프라인 실측 대시보드', href: '/admin' }]}
        plan="실제 점검·배포는 배포 파이프라인에서 내립니다. 이 화면에 저장 경로를 붙일 일정은 미정입니다."
      />

      <AdminScreenHelp screen="settings" className="-mt-3 mb-6" />

      <div className="space-y-5">
        {/* ── 점검 모드 ── */}
        <SettingsSection
          id="maintenance"
          icon={Power}
          title="점검 모드"
          description="이 화면에서는 켤 수 없습니다. 서비스를 실제로 내리는 스위치가 아닙니다."
        >
          <div className="flex items-start gap-4 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg3)] text-[var(--t2)]"
              aria-hidden
            >
              <Wrench size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[13px] font-[700] text-[var(--t1)]">
                잠금 — 저장 경로가 없어 조작할 수 없습니다
              </p>
              <p className="mt-1 break-keep font-body text-[12px] leading-[1.7] text-[var(--t2)]">
                켠 값을 담을 곳도, 그 값을 읽고 사용자를 안내 페이지로 보내는 코드도 없습니다.
                점검이 필요하면 배포 쪽에서 내려야 합니다 — 여기서 토글만 켜 두고 내렸다고 믿으면
                사고가 납니다.
              </p>
            </div>
            <Toggle
              checked={false}
              readOnly
              disabled
              aria-label="점검 모드 (저장 경로 없음 — 사용 불가)"
              aria-describedby="maintenance-disabled-reason"
            />
            <span id="maintenance-disabled-reason" className="sr-only">
              점검 모드 저장 경로가 구현돼 있지 않아 이 스위치는 사용할 수 없습니다.
            </span>
          </div>
        </SettingsSection>

        {/* ── Feature Flags ── */}
        <SettingsSection
          id="flags"
          icon={Code2}
          title="Feature Flags"
          description="기능 단위 ON/OFF 저장소가 아직 없습니다."
        >
          <NotWired
            title="플래그 목록이 없습니다"
            detail="feature_flags 테이블이 존재하지 않습니다. 여기 있던 5개(tts_natural_voice · memory_decay_v2 · wordblitz_3d · ai_extraction_gpt4o · admin_audit_log)와 마지막 변경일은 코드 상수였고, 토글도 화면 안에서만 움직였습니다. 지금 기능 분기는 코드와 환경변수로만 관리합니다."
          />
        </SettingsSection>

        {/* ── AI 프롬프트 관리 ── */}
        <SettingsSection
          id="prompts"
          icon={Bot}
          title="AI 프롬프트 관리"
          description="프롬프트 버전을 저장하는 표가 아직 없습니다."
        >
          <NotWired
            title="프롬프트 목록이 없습니다"
            detail="ai_prompts 테이블이 존재하지 않습니다. 여기 있던 3건(단어 추출 v3.2 · ScriptQuiz 생성 v2.4 · 주간 학습 리포트 v1.0)과 「편집」 버튼은 동작하지 않는 예시였습니다. 실제 프롬프트는 저장소 코드와 Claude Code 드레인 절차 안에 있습니다."
          />
        </SettingsSection>

        {/* ── 인앱 공지 ── */}
        <SettingsSection
          id="notices"
          icon={Megaphone}
          title="인앱 공지"
          description="공지를 저장하거나 발송하는 경로가 아직 없습니다."
        >
          <NotWired
            title="공지를 만들 수 없습니다"
            detail="notices 테이블이 존재하지 않습니다. 여기 있던 예약 공지 2건과 「+ 새 공지 작성」 버튼은 동작하지 않는 예시였고, 공지가 발송된 적도 없습니다."
          />
        </SettingsSection>

        {/* ── 권한 ── */}
        <SettingsSection
          id="rbac"
          icon={Shield}
          title="관리자 권한"
          description="지금 실제로 적용되는 접근 제어 기준입니다 — 이 화면에서 바꿀 수는 없습니다."
        >
          <ul className="space-y-2">
            {[
              {
                role: 'admin',
                detail: '관리자 콘솔 전체 + 역할 부여·정지 같은 상위 권한(isFullAdmin).',
              },
              {
                role: 'curator',
                detail:
                  '관리자 콘솔 접근 허용. 미들웨어는 admin 과 curator 를 함께 통과시킵니다(canAccessAdminConsole).',
              },
            ].map((r) => (
              <li
                key={r.role}
                className="flex items-start gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3"
              >
                <code className="shrink-0 rounded-[var(--r-sm)] bg-[var(--bg3)] px-2 py-1 font-mono text-[11px] font-[700] text-[var(--t1)]">
                  {r.role}
                </code>
                <p className="min-w-0 break-keep font-body text-[12px] leading-[1.7] text-[var(--t2)]">
                  {r.detail}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 break-keep font-body text-[12px] leading-[1.7] text-[var(--t2)]">
            판정은 <code className="font-mono text-[11px]">lib/auth/account.ts</code> 의{' '}
            <code className="font-mono text-[11px]">canAccessAdminConsole</code> 한 곳에서만
            내립니다. 이 화면에 있던 superadmin · ops · content · viewer 네 역할과 인원수(2 · 4 · 3
            · 7)는 코드 어디에도 없는 값이었습니다.
          </p>
        </SettingsSection>
      </div>
    </div>
  )
}
