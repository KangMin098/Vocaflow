// apps/web/src/components/admin/factory/WhoChip.tsx
// 누가 움직이는 걸음인가 — 아이콘 + 글자(아이콘만으로 뜻을 전하지 않는다).

import { Bot, Cog, UserRound, Users } from 'lucide-react'

import { WHO_KO, type Who } from '@/lib/csat/factory-plain'

const WHO_ICON: Record<Who, typeof Bot> = { person: UserRound, claude: Bot, auto: Cog, mix: Users }

export function WhoChip({ who }: { who: Who }) {
  const Icon = WHO_ICON[who]
  return (
    <span className="inline-flex w-fit items-center gap-1 font-body text-[11.5px] text-[var(--t2)]">
      <Icon size={13} strokeWidth={1.9} aria-hidden />
      {WHO_KO[who]}
    </span>
  )
}
