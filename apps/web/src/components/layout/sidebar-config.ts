// apps/web/src/components/layout/sidebar-config.ts
//
// Sidebar 정보 구조 단일 출처 — CLAUDE.md §17.10 IA 원칙 정합.
//
// ── v08.5 재설계 — 5 그룹이 "나열" 에서 "흐름" 이 됐다 ──────────────────────
//
// 이전: 다섯 그룹이 각자 점 하나를 달고 **같은 무게로 나열**됐다. 순서에 의미가 있는데
//   (읽고 → 단어를 모으고 → 익히고 → 본문으로 확인하고 → 통째로 재생산한다) 화면은
//   그것을 말하지 않아서, 학습자에겐 그냥 일곱 개의 도구 목록이었다.
// 지금: 다섯이 **번호가 붙은 한 줄기 레일**로 이어진다. 순서가 곧 정보다.
//
// **왜 순서를 보여도 되는가 (국내외 근거)**
//   · 클래스카드(한국 교사 1/3 사용) — 암기 → 리콜 → 스펠 → 테스트. 한국 학습자에겐
//     "단어 학습에는 정해진 단계가 있다" 가 이미 학습된 멘탈모델이다.
//   · 스픽(Speak) — 모든 레슨이 Learn → Practice → Apply 3단계 골격을 공유한다.
//   · Duolingo — 2022-11 단일 선형 path 전환. 명확성은 올랐으나 **탐색 자유도 상실**로
//     반발이 컸다. 우리가 피해야 할 쪽이다.
//   · Quizlet — Learn/Flashcards/Test/Match 를 **병렬**로 둔다. 자유롭지만 순서 안내가 없다.
//   · Amazon Science(적응 스케줄링 실험) — 선형 조건이 **완주율**을, 자기주도 조건이
//     **성적 향상**을 각각 이겼다. 둘은 반대 방향으로 간다.
//
// **그래서: 순서는 보이되 잠그지 않는다.** 전부 언제나 클릭된다. 자물쇠도, 비활성도,
//   "아직 못 함" 도 없다 — `docs/LEARNING_FRAMEWORK.md` §4① 이 이미 내린 결론이고
//   (`잠김·불가·금지·차단` 어휘는 테스트가 금지한다) 위 외부 근거가 그것을 뒷받침한다.
//
// ⚠️ **레일은 학습자의 현재 위치를 표시하지 않는다.** 같은 문서 §4 "이동을 알리는 자리는
//   정확히 4개(chapter-end · session-end · today · vault-word) — 다섯 번째가 생기면
//   처방 정본이 또 갈라진다". 사이드바가 "당신은 지금 3단계" 를 말하는 순간 그 다섯 번째가
//   된다. 게다가 단계는 **학습자 등급이 아니라 단어 상태**다(§4③). 레일이 그리는 것은
//   흐름의 **순서**이지 진도가 아니다.
//
// **Comics 는 레일 밖 최하단** (사용자 결정 2026-08-16) — 만화는 학습 단계가 아니라
//   **읽는 방식**이다. 레일 안에 두면 여섯 번째 단계로 읽힌다.
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
  Map,
  Mic2,
  ScanLine,
  Scale,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react'

import { LIBRARY_TABS, MY_LIBRARY_TABS } from '@/lib/library/tabs'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** 스크린리더 풀텍스트 — 라벨이 짧을 때 보강 */
  ariaLabel?: string
  /**
   * 펼침 하위 항목. **자체로 목록을 짓지 않는다** — 페이지 탭과 같은 배열을 읽어야 갈라지지 않는다.
   * 축소(72px) 모드에서는 렌더하지 않는다(자리가 없다 — 부모 툴팁이 대신한다).
   */
  children?: NavItem[]
  /**
   * **이 항목이 대신 대표하는 라우트 접두사.**
   *
   * ── 왜 필요한가 (실측 2026-08-25) ──────────────────────────────────
   * 사이드바는 13개 주소만 안다. 그런데 학습자 정적 화면은 42개다. 나머지에 서 있으면
   * 셸의 어느 항목에도 `aria-current` 가 붙지 않는다 — 화면이 "지금 어디" 를 말하지 않는다.
   * 전수 계측에서 **52 측정 중 20 이 그 상태**였다(현재 위치 표시 평균 61.5점).
   *
   * 시각적으로는 "아무 데도 아님" 이고, 스크린리더에서는 더 나쁘다: 목록을 훑어도
   * 현재 위치가 없어 되돌아갈 곳을 못 찾는다(WCAG 2.4.8 Location).
   *
   * 라우트를 사이드바에 더 늘리는 대신 **소유 관계를 적는다** — 항목 수는 그대로 두고
   * (레일이 길어지면 그 자체가 결함이다: 위 v06.202 결정 참조) 위치만 말한다.
   * 접두사 매칭이므로 `/diagnostic/history` 같은 하위도 함께 잡힌다.
   */
  owns?: string[]
}

/** 흐름 단계 키 — 코드 식별자. 학습자가 읽는 이름은 `label` 이다. */
export type FlowStage = 'read' | 'word' | 'practice' | 'conquer' | 'complete'

export interface NavGroup {
  label: string
  /** 단계 강조색 (시각 일관성) */
  accent: string
  flowStage: FlowStage
  /**
   * 레일 위 번호 — **순서**를 말한다. 진도도, 자격도, 잠금도 아니다.
   * 배열 순서와 반드시 일치한다(테스트가 강제).
   */
  step: number
  /**
   * 이 단계에서 학습자가 하는 일 — 한 줄. **상시 노출하지 않는다**:
   * 지금 그 단계에 있을 때만 한 줄 나타난다(Progressive Disclosure).
   * 다섯 줄을 늘 띄우면 그건 설명서지 내비가 아니다.
   */
  says: string
  items: NavItem[]
}

export const META_ITEMS: NavItem[] = [
  { label: 'Today', href: '/hub', icon: Home, ariaLabel: 'Today — 지금 할 학습 (이어하기·모듈·추천)' },
  {
    label: 'Growth',
    href: '/dashboard',
    icon: BarChart3,
    ariaLabel: 'Growth — 단어가 자란 기록·기억·주간 리듬 + 학습 관리(Level·Plan·Report)',
    // `ariaLabel` 이 이미 "Level·Plan·Report" 를 자기 소관이라고 말하고 있었다 —
    // 그런데 정작 그 세 화면에서는 Growth 에 불이 들어오지 않았다. 말과 동작을 맞춘다.
    owns: ['/diagnostic', '/plan', '/reports'],
  },
]

/**
 * 학습 흐름 5단계 — **배열 순서 = 레일 번호**.
 *
 * 라벨이 'Scripts' 에서 `Read` 로 바뀐 이유: 'Scripts' 는 자료 이름이었는데
 * (그마저 `axes.ts` 가 세 뜻으로 갈렸다고 판정해 정리한 단어다) 나머지 넷은 **하는 일**의
 * 이름이었다. 한 레일 위에 자료 이름 하나와 행위 이름 넷이 섞이면 순서가 안 읽힌다.
 * 다섯을 전부 "여기서 무엇을 하는가" 로 통일한다.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Read',
    accent: '#8B5CF6', // 보라
    flowStage: 'read',
    step: 1,
    says: '읽을 것을 고르고 만나요',
    items: [
      // 펼침 구조는 **하위 3면이 실재하는 두 곳**만 갖는다 (`lib/library/tabs.ts`):
      //   Library(공용)    — Books · Dispatches · Decks
      //   My Library(내 것) — Books · Texts      · Decks   ← Dispatches 는 내 것 공간에 없다
      // 둘 다 착지 후 탭을 한 번 더 눌러야 원하는 면에 닿았다(`/library` 는 첫 면으로 리다이렉트,
      //   `/text` 는 항목이 가장 많은 면을 고른다). 사이드바가 그 한 번을 없앤다.
      // Comics(2면)는 이미 평면 2리프로 노출돼 있고, Practice 는 v06.202 가 도구 4개를 한 칸으로
      //   **접은** 자리라 다시 펼치지 않는다(`axes.ts`: 활동은 Surface 가 아니다).
      {
        label: 'Library',
        href: '/library',
        icon: Compass,
        ariaLabel: '공용 콘텐츠 라이브러리',
        children: LIBRARY_TABS.map((t) => ({
          label: t.label,
          href: t.href,
          icon: t.icon,
          ariaLabel: `${t.label} — ${t.says}`,
        })),
      },
      // v08.4 — 'My Scripts' 는 `axes.ts` NAME_DECISIONS 의 **retire 목록**에 올라 있던 표기다
      //   ("스크립트" 가 내 본문 · 큐레이션 아티클 · hub 카드 셋을 동시에 가리켰던 문제의 잔재).
      //   `MATERIAL_LABEL.script` 도 같은 결정에서 `Texts` 로 맞췄다.
      // 메뉴 이름이 `Texts` 가 아니라 `My Library` 인 이유: 이 자리는 낱개 본문만이 아니라
      //   내 책·낱개 본문·구독 단어장 **셋의 컨테이너**다(화면 자신의 제목도 '내 라이브러리').
      //   `Texts` 는 그중 한 면의 이름으로 자식에 그대로 산다 — 부모·자식에 같은 이름을 두면
      //   층위가 안 읽힌다.
      {
        label: 'My Library',
        href: '/text',
        icon: BookOpen,
        ariaLabel: 'My Library — 내 책·본문·구독 단어장',
        // `/my/books` 는 이 칸이 말하는 "내 책" 그 자체다 — 주소만 다르다.
        owns: ['/my/books'],
        children: MY_LIBRARY_TABS.map((t) => ({
          label: t.label,
          href: t.href,
          icon: t.icon,
          ariaLabel: `${t.label} — ${t.says}`,
        })),
      },
    ],
  },
  {
    label: 'Words',
    accent: '#6366F1', // 인디고
    flowStage: 'word',
    step: 2,
    says: '만난 단어를 내 것으로 모아요',
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
    step: 3,
    says: '어느 쪽이 무른지 골라 익혀요',
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
        // v06.202 가 도구 4개를 이 한 칸으로 **접었다**. 접힌 것들의 주소는 살아 있고
        // (딥링크·회귀 스펙이 쓴다) 학습자도 거기 착지한다 — 그때 이 칸이 대신 불을 켠다.
        owns: ['/flashcard', '/spellforge', '/pairflip', '/wordblitz'],
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
    step: 4,
    says: '읽던 본문으로 되돌아가 확인해요',
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
    step: 5,
    says: '들은 것을 통째로 다시 써 봐요',
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

/**
 * 레일 **밖** 항목 — 단계가 아닌 것들. 흐름 아래 최하단에 조용히 둔다.
 *
 * Comics: 만화는 학습 단계가 아니라 **읽는 방식**이다(2026-08-09 결정으로 Scripts 그룹에서
 *   이미 빼냈고, 2026-08-16 에 레일 밖 최하단으로 내렸다). 레일 안에 있으면 여섯 번째
 *   단계로 읽히고, 실제로 Read 와 같은 보라색을 달고 Read 바로 아래 붙어 있어서
 *   "읽기 다음에 만화" 라는 없는 순서를 암시했다.
 */
export const ASIDE_GROUP: { label: string; says: string; accent: string; items: NavItem[] } = {
  label: 'Comics',
  says: '같은 이야기를 그림으로',
  accent: '#8B5CF6',
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
}

export const FOOTER_ITEMS: NavItem[] = [
  /**
   * 기출 유형 분석.
   *
   * ── 왜 레일이 아니라 레일 밖인가 ──────────────────────────────
   * 레일(① Read → ⑤ Complete)은 **학습 단계**이고 번호가 곧 순서다. 기출 분석은 단계가
   * 아니라 **참조면**이다 — 아무 단계에서나 들춰 보는 것이고, 여섯 번째 단계로 읽히면
   * "다섯 단계를 끝내야 볼 수 있는 것"이 된다(LEARNING_FRAMEWORK §4① 자물쇠 금지와 같은 문제).
   * Comics 를 ASIDE_GROUP 에 둔 것과 같은 이유다.
   */
  {
    label: 'CSAT Types',
    href: '/csat',
    icon: Scale,
    ariaLabel: '기출 유형 분석 — 평가원 수능·모의평가 독해 유형별 풀이 절차',
  },
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
  /**
   * 전체 보기(사이트맵).
   *
   * ── 왜 레일 밖 최하단인가 ────────────────────────────────────────
   * 단계가 아니다. 그리고 **한 화면에 닿는 두 번째 길** 이라는 것이 이 항목의 전부다 —
   * WCAG 2.2 §2.4.5 Multiple Ways (AA) 는 내비게이션 외에 검색(G161) 또는
   * 사이트맵(G63) 중 하나를 요구하는데, 전수 계측(2026-09-01) 학습자 52 측정 중
   * **43 이 둘 다 없었다.** 화면마다 검색창을 붙이는 쪽은 Calm UI 와 부딪혀 택하지 않았다.
   *
   * ⚠️ `FOOTER_ITEMS` 에 두는 것이 핵심이다 — 이 배열만이 `Sidebar`(데스크톱)와
   *    `MobileUtilityBar`(모바일) **양쪽에서** 렌더된다. 한쪽에만 두면 다른 뷰포트의
   *    화면들은 여전히 길이 하나뿐이라 2.4.5 를 그대로 놓친다.
   */
  {
    label: 'Sitemap',
    href: '/sitemap',
    icon: Map,
    ariaLabel: '전체 보기 — 학습자 화면 전체 지도',
  },
]
