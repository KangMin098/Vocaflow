// apps/web/src/components/layout/top-nav-data.ts
//
// **상단 메뉴의 체계와 모양**(DD-68 · tines-mapping §27) — 목록이 아니라 배치다.
//
// 항목·주소·순서·소유(`owns`)의 정본은 `sidebar-config.ts` 다. 이 파일은 그 정본을
// 참조 사이트의 메가메뉴 골격에 **앉히는 일만** 한다 — 주소를 여기서 새로 적지 않는다
// (적는 순간 같은 셸이 두 목록을 갖고 조용히 갈라진다).
//
// ── v08.7 재설계 — 「더 보기」를 없앴다 ──────────────────────────────────
// 1차(v08.6)는 사이드바의 세로 순서를 그대로 눕혀 **막대에 여덟 칸**(메타 2 + 레일 5 +
// 더 보기)을 세웠다. 그 결과가 두 가지 문제다:
//   ① 「더 보기」는 이름이 아니라 **남은 것 통**이다 — 만화 · 기출 · 학급 · 설정 · 사이트맵이
//      공통점 없이 한 칸에 들어갔다. 학습자는 무엇이 거기 있는지 열어 보기 전엔 모른다.
//   ② 칸이 여덟이라 1024 아래에서 번호를 접어야 했고, 그래도 빠듯했다.
// 참조(2026-09-23 사용자 첨부 3장)는 **가운데 알약 다섯**(Platform · Solutions · Resources ·
// Company · Pricing)이고, 각 메뉴는 **옅은 면 한 장 안에 2~3열 + 얇은 세로 구분선 +
// 선 아이콘 목록 + 하단 텍스트 링크 줄**이다. 같은 체계로 옮긴다:
//
//   Today(링크) · Library ▾ · Practice ▾ · CSAT(링크) · Growth ▾   + 오른쪽 Class
//
// **흐름 다섯 단계는 사라지지 않는다** — 번호가 막대에서 **패널 안으로** 들어갔다.
//   ① Read  = Library 패널 첫 열의 눈썹
//   ② ~ ⑤   = Practice 패널의 블록·행마다 번호 배지 + sr-only 「흐름 N번째 · 이름」
// 번호는 여전히 순서일 뿐 진도·자격·잠금이 아니다(LEARNING_FRAMEWORK §4①).
//
// **만화는 여전히 레일 밖이다** — Library 패널의 **하단 텍스트 링크 줄**(눈썹 「읽는 방식」)에
// 산다. 번호를 달지 않고 열 안에도 들어가지 않으므로 여섯 번째 단계로 읽히지 않는다
// (2026-08-16 결정의 문장 그대로 — "만화는 학습 단계가 아니라 읽는 방식이다").
//
// 한 줄 설명(`blurb`)은 면 안에서 읽히는 copy 라 여기 산다. 이미 정본이 있는 것
// (서가 네 면 · 내 라이브러리 네 면)은 `lib/library/tabs.ts` 의 `says` 를 그대로 읽는다.

import { routeArt } from '@/lib/design/route-art'
import { TINT_CLASS } from '@/lib/design/tone'
import { LIBRARY_TABS, MY_LIBRARY_TABS } from '@/lib/library/tabs'

import {
  ASIDE_GROUP,
  FOOTER_ITEMS,
  META_ITEMS,
  NAV_GROUPS,
  type NavItem,
} from './sidebar-config'

// ── 면 안에서 읽히는 한 줄 ────────────────────────────────────────────────
// 화면 라벨을 되풀이하지 않는다 — 거기서 **무엇을 하는지**를 적는다(Admin 도움말과 같은 원칙).
const BLURB: Record<string, string> = {
  '/hub': '오늘 할 것 하나부터.',
  '/dashboard': '단어가 자란 기록 · 기억 · 주간 리듬.',
  '/diagnostic': '5분이면 지금 수준이 나와요.',
  '/plan': '요일마다 무엇을 할지 정해 둬요.',
  '/reports': '한 주를 돌아보는 카드.',
  '/library': '고전 · 짧은 글 · 단어장 · 교재를 골라 읽기 시작합니다.',
  '/text': '담은 책 · 낱개 본문 · 구독 단어장이 모인 내 책장.',
  '/wordvault': '담은 단어를 기억 네 색으로 봅니다.',
  '/practice': '어느 쪽이 무른지 고르면 방식이 따라옵니다.',
  '/arcade': '단어 게임 19종 — 기억을 놀이로 굴립니다.',
  '/scriptquiz': '읽던 본문으로 돌아가 문항으로 확인합니다.',
  '/dictate': '들은 것을 통째로 다시 써 봅니다.',
  '/comics/adapted': '읽는 책을 같은 이야기 만화로',
  '/comics/restored': '1940~50년대 옛 만화책을 복원해서',
  '/csat': '두 문항을 나란히 놓고 출제자의 설계를 읽습니다.',
  '/teacher': '초대코드로 학급을 열고 진행을 한 화면에.',
  '/settings': '계정 · 데이터 가져오기 / 내보내기.',
  '/sitemap': '학습자 화면 전체 지도.',
}

/** 이미 정본이 있는 한 줄 — 서가 · 내 라이브러리 네 면은 탭 레지스트리가 갖고 있다. */
const TAB_SAYS = new Map<string, string>(
  [...LIBRARY_TABS, ...MY_LIBRARY_TABS].map((t) => [t.href, t.says]),
)

export const blurb = (href: string): string => TAB_SAYS.get(href) ?? BLURB[href] ?? ''

/** 그림 — 타일(앱 아이콘 모양)과 소품(투명 물건). 경로가 이미 가진 것을 쓴다. */
const tileOf = (href: string): string | null => routeArt(href.split('?')[0])?.tile ?? null
const spotOf = (href: string): string | null => routeArt(href.split('?')[0])?.spot ?? null

/** 흐름 번호 표식 — 순서이지 진도가 아니다. */
export interface Step {
  n: number
  /** 단계 이름(Read · Words …) — sr-only 문장이 쓴다 */
  stage: string
  accent: string
}

/** 큰 블록 — 제목 + 한 줄 + 그림. 참조 첫 열의 「By product」 자리. */
export interface PanelFeature {
  item: NavItem
  title: string
  body: string
  art: string | null
  step?: Step
  arrow: 'in' | 'out'
}

/** 목록 행 — 선 아이콘 + 제목 + 한 줄. 행 사이는 얇은 가로선(참조와 같다). */
export interface PanelRow {
  item: NavItem
  title: string
  body: string
  step?: Step
}

/** 열 — 눈썹 하나 + 큰 블록들 + 목록. 열 사이는 얇은 세로선. */
export interface PanelColumn {
  eyebrow: string
  /** 눈썹 자체가 그 구역의 입구가 되기도 한다(부모 주소를 잃지 않으려고) */
  eyebrowHref?: string
  step?: Step
  features: PanelFeature[]
  rows: PanelRow[]
  /** 이 열을 넓게(첫 열) — 참조의 1열은 나머지보다 넓다 */
  wide?: boolean
}

export interface MenuPanel {
  /** 면 한 장의 색 — 참조는 메뉴마다 다른 색을 쓴다(초록 · 살구 · 분홍) */
  tone: string
  columns: PanelColumn[]
  /** 하단 텍스트 링크 줄 — 참조 Resources 의 「Events · Podcast · Webinars …」 */
  links?: { eyebrow: string; items: NavItem[] }
}

export type TopEntry =
  | { kind: 'link'; key: string; label: string; item: NavItem; says?: string }
  | { kind: 'menu'; key: string; label: string; says?: string; panel: MenuPanel }

const READ = NAV_GROUPS[0]
const WORDS = NAV_GROUPS[1]
const PRACTICE = NAV_GROUPS[2]
const CONQUER = NAV_GROUPS[3]
const COMPLETE = NAV_GROUPS[4]

/** 설정에서 항목을 **주소로** 집는다 — 인덱스로 집으면 순서가 바뀔 때 조용히 다른 것을 판다. */
function pick(items: readonly NavItem[], href: string): NavItem {
  const hit = items.find((i) => i.href === href)
  if (!hit) throw new Error(`top-nav-data: ${href} 가 sidebar-config 에 없다`)
  return hit
}

const stepOf = (g: (typeof NAV_GROUPS)[number]): Step => ({
  n: g.step,
  stage: g.label,
  accent: g.accent,
})

const feature = (
  item: NavItem,
  opts: { step?: Step; arrow?: 'in' | 'out'; art?: string } = {},
): PanelFeature => ({
  item,
  title: item.label,
  body: blurb(item.href),
  art: opts.art ?? tileOf(item.href),
  step: opts.step,
  arrow: opts.arrow ?? 'in',
})

const row = (item: NavItem, step?: Step): PanelRow => ({
  item,
  title: item.label,
  body: blurb(item.href),
  step,
})

const library = pick(READ.items, '/library')
const myLibrary = pick(READ.items, '/text')
const growth = pick(META_ITEMS, '/dashboard')

// ── 막대 — 가운데 알약 다섯 ────────────────────────────────────────────────

/** ① Today — 오늘 할 것 하나. 메뉴를 열지 않는다(화면 자체가 그 답이다). */
export const TODAY_ENTRY: TopEntry = {
  kind: 'link',
  key: 'today',
  label: pick(META_ITEMS, '/hub').label,
  item: pick(META_ITEMS, '/hub'),
  says: blurb('/hub'),
}

/**
 * ② Library — 흐름 ① Read 가 통째로 들어온다. 참조 「Solutions」(초록 면)와 같은 골격:
 *   넓은 첫 열(큰 블록 둘) · 「공용 서가」 4행 · 「내 라이브러리」 4행 · 하단 「읽는 방식」 줄.
 */
export const LIBRARY_ENTRY: TopEntry = {
  kind: 'menu',
  key: 'library',
  // 메뉴 이름은 **흐름 ① 의 이름**을 그대로 쓴다 — 'Library' 로 부르면 그 안의 서가 항목
  // (Library · My Library)과 이름이 겹쳐 층위가 안 읽힌다.
  label: READ.label,
  says: READ.says,
  panel: {
    tone: TINT_CLASS.green,
    columns: [
      {
        eyebrow: '읽을 곳',
        step: stepOf(READ),
        wide: true,
        features: [feature(library), feature(myLibrary)],
        rows: [],
      },
      {
        // 눈썹에 링크를 달지 않는다 — 부모 주소(/library · /text)는 **첫 열의 큰 블록**이 이미 판다.
        // 같은 주소를 한 패널에서 두 번 팔면 어느 쪽이 무엇인지 되묻게 된다.
        eyebrow: '공용 서가',
        features: [],
        rows: (library.children ?? []).map((c) => row(c)),
      },
      {
        eyebrow: '내 라이브러리',
        features: [],
        rows: (myLibrary.children ?? []).map((c) => row(c)),
      },
    ],
    // 만화는 열 밖 · 번호 밖 — 단계가 아니라 **읽는 방식**이라는 2026-08-16 결정 그대로다.
    links: { eyebrow: ASIDE_GROUP.says, items: [...ASIDE_GROUP.items] },
  },
}

/**
 * ③ Practice — 흐름 ②~⑤ 가 한 패널에서 번호 순으로 읽힌다. 참조 「Resources」(살구 면):
 *   넓은 첫 열(큰 블록 둘) · 가운데 목록 · 오른쪽 큰 블록.
 */
export const PRACTICE_ENTRY: TopEntry = {
  kind: 'menu',
  key: 'practice',
  label: 'Practice',
  says: '모아서 익히고, 본문으로 확인해요',
  panel: {
    tone: TINT_CLASS.peach,
    columns: [
      {
        eyebrow: '모으고 익히기',
        wide: true,
        features: [
          feature(pick(WORDS.items, '/wordvault'), { step: stepOf(WORDS) }),
          feature(pick(PRACTICE.items, '/practice'), { step: stepOf(PRACTICE) }),
        ],
        rows: [],
      },
      // ⚠️ 열 순서 = 번호 순서. 놀이(③)를 ④⑤ 뒤에 두면 패널을 왼쪽에서 오른쪽으로 읽을 때
      //    번호가 ②③ → ④⑤ → ③ 으로 되돌아간다(회귀가 잡는다).
      {
        eyebrow: '놀이로',
        features: [
          feature(pick(PRACTICE.items, '/arcade'), {
            step: stepOf(PRACTICE),
            art: spotOf('/arcade') ?? undefined,
          }),
        ],
        rows: [],
      },
      {
        eyebrow: '확인하고 완성하기',
        features: [],
        rows: [
          row(pick(CONQUER.items, '/scriptquiz'), stepOf(CONQUER)),
          row(pick(COMPLETE.items, '/dictate'), stepOf(COMPLETE)),
        ],
      },
    ],
  },
}

/** ④ CSAT — 참조 「Pricing」 자리. 한 화면이라 메뉴를 열지 않는다. */
export const CSAT_ENTRY: TopEntry = {
  kind: 'link',
  key: 'csat',
  label: pick(FOOTER_ITEMS, '/csat').label,
  item: pick(FOOTER_ITEMS, '/csat'),
  says: blurb('/csat'),
}

/**
 * ⑤ Growth — 참조 「Company」(분홍 면): 기록 한 블록 + 「학습 관리」 3행 + 「도구」 2행.
 * 사이드바 시절 「더 보기」에 섞여 있던 설정 · 전체 보기가 여기서 제 이름을 얻는다.
 */
export const GROWTH_ENTRY: TopEntry = {
  kind: 'menu',
  key: 'growth',
  label: growth.label,
  says: '자란 기록과 학습 관리',
  panel: {
    tone: TINT_CLASS.pink,
    columns: [
      {
        eyebrow: '기록',
        wide: true,
        features: [feature(growth)],
        rows: [],
      },
      {
        eyebrow: '학습 관리',
        features: [],
        rows: (growth.children ?? []).map((c) => row(c)),
      },
      {
        eyebrow: '도구',
        features: [],
        rows: [row(pick(FOOTER_ITEMS, '/settings')), row(pick(FOOTER_ITEMS, '/sitemap'))],
      },
    ],
  },
}

/**
 * 막대 오른쪽 — 참조의 「Book a demo」 자리. 학습자 동선이 아니라 **역할이 바뀌는 곳**이라
 * 가운데 알약 다섯에 끼우지 않고, 참조와 같은 ↗(다른 구역) 화살표를 단다.
 */
export const CLASS_ENTRY: TopEntry = {
  kind: 'link',
  key: 'class',
  label: pick(FOOTER_ITEMS, '/teacher').label,
  item: pick(FOOTER_ITEMS, '/teacher'),
  says: blurb('/teacher'),
}

/** 가운데 알약 다섯 — 순서가 곧 화면의 순서다(오늘 → 읽기 → 연습 → 기출 → 기록). */
export const BAR_ENTRIES: TopEntry[] = [
  TODAY_ENTRY,
  LIBRARY_ENTRY,
  PRACTICE_ENTRY,
  CSAT_ENTRY,
  GROWTH_ENTRY,
]

export const TOP_ENTRIES: TopEntry[] = [...BAR_ENTRIES, CLASS_ENTRY]

/**
 * 막대·패널이 실제로 그리는 **모든 항목** — 현재 위치 판정(`pickCurrent`)과
 * 회귀 테스트(`__tests__/top-nav.test.tsx`)가 읽는다. 목록을 손으로 적지 않는다.
 */
export function allEntryItems(entries: readonly TopEntry[] = TOP_ENTRIES): NavItem[] {
  const out: NavItem[] = []
  const parents = [...META_ITEMS, ...NAV_GROUPS.flatMap((g) => g.items)]
  for (const e of entries) {
    if (e.kind === 'link') {
      out.push(e.item)
      continue
    }
    for (const c of e.panel.columns) {
      const parent = c.eyebrowHref ? parents.find((i) => i.href === c.eyebrowHref) : undefined
      if (parent && !out.includes(parent)) out.push(parent)
      out.push(...c.features.map((f) => f.item))
      out.push(...c.rows.map((r) => r.item))
    }
    if (e.panel.links) out.push(...e.panel.links.items)
  }
  return out
}
