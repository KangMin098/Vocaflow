// apps/web/src/components/layout/sidebar-config.ts
//
// Sidebar 정보 구조 단일 출처 — CLAUDE.md §17.10 IA 원칙 정합.
//
// 5 그룹 (FlowNav stage 1:1 매핑 · v06.109 영어 라벨):
//   Scripts(보라) · Words(인디고) · Practice(핑크) · Conquer(앰버) · Complete(시안)
//
// Practice 그룹 정렬 = 인지 깊이 순:
//   Flashcard (L4a 시각적 재인) → WordBlitz (L4a 자동) → SpellForge (L4b 생성)
//
// 메타 표면 2개 (v06.108 통합 4→2 · v06.109 영어 라벨): Today(/hub, forward) · Growth(/dashboard, backward).
//   Level(진단)·Plan(계획)·Report(리포트) = Growth 의 "학습 관리" 섹션 카드(메타 peer 아님). /manage 폐지.
//   영어 라벨 = Reading Room Dual Coding(serif 정체성) + 모듈 브랜드명(Flashcard 등)과 정합. 라우트 URL 은 유지(/hub·/dashboard).

import {
  BarChart3,
  BookImage,
  BookOpen,
  Compass,
  Gamepad2,
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
  { label: 'Today', href: '/hub', icon: Home, ariaLabel: 'Today — 지금 할 학습 (이어하기·모듈·추천)' },
  { label: 'Growth', href: '/dashboard', icon: BarChart3, ariaLabel: 'Growth — 단어가 자란 기록·기억·주간 리듬 + 학습 관리(Level·Plan·Report)' },
]

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Scripts',
    accent: '#8B5CF6', // 보라
    flowStage: 'script',
    items: [
      {
        label: 'Library',
        href: '/library',
        icon: Compass,
        ariaLabel: '공용 콘텐츠 라이브러리',
      },
      // Comics — 만화 단일 메뉴(사용자 결정 2026-08-09). /library 하위 탭이 아니라 최상위.
      //   메뉴 안에서 **출처**로 나뉜다: Adapted(도서 각색 · CCP) · Restored(원본 복원 · PDCP).
      //   학습자에겐 둘 다 "만화"이므로 입구를 둘로 쪼개지 않는다.
      //   데이터는 각자 유지(CCP=library_books 앵커 / PDCP=호 단위 독립).
      {
        label: 'Comics',
        href: '/comics',
        icon: BookImage,
        ariaLabel: '만화 — 도서 각색(Adapted) · 원본 복원(Restored)',
      },
      {
        label: 'My Scripts',
        href: '/text',
        icon: BookOpen,
        ariaLabel: '내가 등록한 스크립트',
      },
      // PDCP(복원 만화)는 사이드바 최상위 항목에서 제거됐다 — Comics 메뉴 안의 'Restored' 탭
      // (`/comics/restored`)으로 편입(사용자 결정 2026-08-09). 만화 입구는 하나여야 한다.
    ],
  },
  {
    label: 'Words',
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
    label: 'Practice',
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
      // Arcade — 게임 스위트(L4a~L5). 이전에는 /hub 의 진입 카드 하나가 유일한 통로라
      // 허브를 스크롤해 내려가지 않으면 존재 자체를 발견할 수 없었다. Practice 상시 노출로 승격.
      {
        label: 'Arcade',
        href: '/arcade',
        icon: Gamepad2,
        ariaLabel: '아케이드 — 단어 게임 모음 (내 복습 단어 · 큐레이션 세계)',
      },
    ],
  },
  {
    label: 'Conquer',
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
    label: 'Complete',
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
    label: 'Class',
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
