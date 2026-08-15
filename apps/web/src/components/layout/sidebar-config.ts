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
  ScanLine,
  ScrollText,
  Settings,
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
      {
        label: 'My Scripts',
        href: '/text',
        icon: BookOpen,
        ariaLabel: '내가 등록한 스크립트',
      },
    ],
  },
  // Comics — Scripts 에서 빼내 **바로 아래 별도 메뉴**로 (사용자 결정 2026-08-09).
  //   Scripts 는 "읽을 원문"의 그룹이다. 만화는 원문이 아니라 **읽는 방식**이라
  //   그 안에 두면 Library·My Scripts 와 같은 층위로 오해된다.
  //   flowStage 를 'script' 로 남긴 이유: 학습 흐름상 여전히 읽기 단계이고,
  //   FlowNav 는 NAV_GROUPS 를 쓰지 않으므로 단계가 늘어나지 않는다.
  {
    label: 'Comics',
    accent: '#8B5CF6',
    flowStage: 'script',
    items: [
      {
        label: 'Book Comics',
        href: '/comics/adapted',
        icon: BookImage,
        ariaLabel: 'Book Comics — 읽는 책을 만화로',
      },
      {
        label: 'Vintage Comics',
        href: '/comics/restored',
        icon: ScanLine,
        ariaLabel: 'Vintage Comics — 1940~50년대 옛 영어 만화책',
      },
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
      // v06.202 — 도구 4개(Flashcard·WordBlitz·PairFlip·SpellForge)를 `/practice` 하나로 접었다.
      //
      // **근거는 `lib/framework/axes.ts` 가 이미 내린 결정이다**:
      //   > 활동(모드)은 Surface 가 아니다. Flashcard·Game Lab 은 "어떻게 연습하는가" 이므로
      //   > 콘텐츠를 고른 뒤의 선택지로 내려간다. 별도 활동 탭은 사용률로 정당화되지 않으면
      //   > 유지된 사례가 없다(Quizlet Gravity 제거 · Duolingo Stories 탭 폐지).
      //   > 국외 12종: Busuu 3 · Memrise 3 · Babbel 4 · Vocabulary.com 4 · Duolingo 코어 6.
      //   > 현재 우리는 8 표면 / 14 리프로 그 범위 밖이다.
      // `SurfaceId` 는 today·library·vault·growth 넷뿐인데 사이드바가 도구 4개를 최상위로 팔았다.
      //
      // 실측 근거도 같은 방향이었다: 그 4화면은 각자 다른 고채도 그라디언트 히어로를 갖고
      // 있어서 한 그룹인데 네 브랜드가 동시에 소리쳤다(+ 이모지 난이도, 상시 설명서, 카드 3중첩).
      // 통합 진입면은 루브릭 **87점**, 흡수 대상 평균은 77점.
      //
      // 라우트는 지우지 않는다 — 딥링크와 기존 회귀 스펙(`18-hub-real-queue` ·
      // `25-practice-pool` 등)이 그 주소를 쓴다. 사이드바에서만 한 칸으로 접는다.
      {
        label: 'Practice',
        href: '/practice',
        icon: Layers,
        ariaLabel: '연습 — 어느 쪽을 연습할지 고르기',
      },
      // Arcade — 게임 스위트(L4a~L5). 이전에는 /hub 의 진입 카드 하나가 유일한 통로라
      // 허브를 스크롤해 내려가지 않으면 존재 자체를 발견할 수 없었다. Practice 상시 노출로 승격.
      {
        label: 'Game Lab',
        href: '/arcade',
        icon: Gamepad2,
        // v08.3 — "큐레이션 세계" 는 v07.8 에 사라진 분류축이다(전 게임이 학습자 단어를 쓴다).
        ariaLabel: 'Game Lab — 단어 게임 19종 (Recall · Synthesis · Inference 구역)',
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
