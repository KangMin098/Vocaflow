// apps/web/src/components/layout/sidebar-config.ts
//
// Sidebar 정보 구조 단일 출처 — CLAUDE.md §17.10 IA 원칙 정합.
//
// 5 그룹 (FlowNav stage 1:1 매핑):
//   스크립트(보라) · 단어(인디고) · 익히기(핑크) · 정복(앰버) · 완성(시안)
//
// 익히기 그룹 정렬 = 인지 깊이 순:
//   Flashcard (L4a 시각적 재인) → WordBlitz (L4a 자동) → SpellForge (L4b 생성)
//
// 메타 표면 2개 (v06.108 통합 4→2): 오늘(/hub, forward) · 회고(/dashboard, backward).
//   진단·계획·리포트 = 회고의 "학습 관리" 섹션으로 강등(메타 peer 아님). /manage 폐지.

import {
  BarChart3,
  BookOpen,
  Compass,
  GraduationCap,
  Home,
  Layers,
  Mic2,
  Pencil,
  ScrollText,
  Settings,
  Shuffle,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** 스크린리더 풀텍스트 — 라벨이 짧을 때 보강 */
  ariaLabel?: string
}

export interface NavGroup {
  label: string
  /** FlowNav stage accent 색 (시각 일관성) */
  accent: string
  flowStage: 'script' | 'word' | 'practice' | 'conquer' | 'complete'
  items: NavItem[]
}

export const META_ITEMS: NavItem[] = [
  { label: '오늘', href: '/hub', icon: Home, ariaLabel: '오늘 — 지금 할 학습 (이어하기·모듈·추천)' },
  { label: '회고', href: '/dashboard', icon: BarChart3, ariaLabel: '회고 — 성장·기억·주간 리듬 + 학습 관리(진단·계획·리포트)' },
]

export const NAV_GROUPS: NavGroup[] = [
  {
    label: '스크립트',
    accent: '#8B5CF6', // 보라
    flowStage: 'script',
    items: [
      {
        label: '라이브러리',
        href: '/library',
        icon: Compass,
        ariaLabel: '공용 콘텐츠 라이브러리',
      },
      {
        label: '내 스크립트',
        href: '/text',
        icon: BookOpen,
        ariaLabel: '내가 등록한 스크립트',
      },
    ],
  },
  {
    label: '단어',
    accent: '#6366F1', // 인디고
    flowStage: 'word',
    items: [
      {
        label: 'WordVault',
        href: '/wordvault',
        icon: Layers,
        ariaLabel: '내 단어 자산 — 가져오기 진입점 포함',
      },
    ],
  },
  {
    label: '익히기',
    accent: '#EC4899', // 핑크
    flowStage: 'practice',
    items: [
      // 정렬 = 인지 깊이 (L4a 시각적 → L4a 자동 → L4a 공간기억+매칭 → L4b 생성)
      {
        label: 'Flashcard',
        href: '/flashcard',
        icon: Layers,
        ariaLabel: '플래시카드 — 시각적 재인',
      },
      {
        label: 'WordBlitz',
        href: '/wordblitz',
        icon: Zap,
        ariaLabel: '워드블리츠 — 속도 자동화',
      },
      {
        label: 'PairFlip',
        href: '/pairflip',
        icon: Shuffle,
        ariaLabel: 'PairFlip — 짝맞추기 카드 게임',
      },
      {
        label: 'SpellForge',
        href: '/spellforge',
        icon: Pencil,
        ariaLabel: '스펠포지 — 철자 생성 인출',
      },
    ],
  },
  {
    label: '정복',
    accent: '#F59E0B', // 앰버
    flowStage: 'conquer',
    items: [
      {
        label: 'ScriptQuiz',
        href: '/scriptquiz',
        icon: ScrollText,
        ariaLabel: '스크립트 독해 검증',
      },
    ],
  },
  {
    label: '완성',
    accent: '#06B6D4', // 시안
    flowStage: 'complete',
    items: [
      {
        label: 'Dictation',
        href: '/dictate',
        icon: Mic2,
        ariaLabel: '받아쓰기 — 다중 채널 통합',
      },
    ],
  },
]

export const FOOTER_ITEMS: NavItem[] = [
  {
    label: '클래스',
    href: '/teacher',
    icon: GraduationCap,
    ariaLabel: '클래스 — 교사용 클래스 개설·초대코드 (L3 B2B, P4.2)',
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    ariaLabel: '설정 — 데이터 가져오기/내보내기 포함',
  },
]
