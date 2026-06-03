// apps/web/src/components/library/RegisterBadge.tsx
// V11 word_register 배지 — 도서 단어가 고어/시대어임을 표시 (학습자 인지 보조).
// CLAUDE.md §"V11 word_register 분류" 정합. CEFRBadge 패턴 따름 (토큰 기반 인라인).
//
// 정책: archaic_literary(📜 고어) · period_cultural(🏛 시대어) 만 렌더.
//   modern_advanced·standard·phrase_unit 은 null (배지 없음 = 정규 어휘, Calm UI).
//   색은 CSS Variables 토큰 → 다크모드 자동 대응.

interface RegisterBadgeProps {
  /** shared_dictionary.word_register 값 */
  register: string | null | undefined
  className?: string
}

const REGISTER_META: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  archaic_literary: {
    label: '고어',
    icon: '📜',
    bg: 'var(--active-light)',
    text: 'var(--active)',
  },
  period_cultural: {
    label: '시대어',
    icon: '🏛',
    bg: 'var(--info-light)',
    text: 'var(--info)',
  },
}

export function RegisterBadge({ register, className = '' }: RegisterBadgeProps) {
  const meta = register ? REGISTER_META[register] : undefined
  if (!meta) return null // standard / modern_advanced / phrase_unit → 배지 없음

  return (
    <span
      className={`inline-flex h-[18px] items-center gap-[3px] rounded-[3px] px-[5px] font-display text-[10px] font-[700] tracking-[0.02em] ${className}`}
      style={{ backgroundColor: meta.bg, color: meta.text }}
      aria-label={`어휘 등급: ${meta.label}`}
      title={
        register === 'archaic_literary'
          ? '고어·문어체 — 현대 영어에서 거의 쓰이지 않아요 (읽기 참고용)'
          : '시대·문화 어휘 — 특정 시대 맥락의 사물·제도'
      }
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  )
}
