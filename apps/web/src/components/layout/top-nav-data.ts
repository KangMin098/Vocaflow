// apps/web/src/components/layout/top-nav-data.ts
//
// **상단 메뉴의 모양**(DD-68 · tines-mapping §27) — 목록이 아니라 배치다.
//
// 항목·주소·순서·소유(`owns`)의 정본은 여전히 `sidebar-config.ts` 다. 이 파일은 그 정본을
// 참조 사이트의 메가메뉴 골격(색 면 카드 · 소품 · 화살표 두 종)에 **앉히는 일만** 한다 —
// 주소를 여기서 새로 적지 않는다(적는 순간 같은 셸이 두 목록을 갖고 조용히 갈라진다.
// `lib/library/tabs.ts` 머리 주석이 같은 실패를 두 번 적어 두었다).
//
// ── 왼쪽 레일이 위로 올라오면서 지킨 것 ────────────────────────────────
// ① **번호는 순서다.** 다섯 단계가 막대 위에서 ①→⑤ 로 왼쪽에서 오른쪽으로 이어진다.
//    세로 레일 선은 번호 사이를 잇는 가로 실선 조각이 됐다.
// ② **잠그지 않는다.** 자물쇠·비활성·「아직 못 함」은 여기에도 없다(LEARNING_FRAMEWORK §4①).
// ③ **현재 단계를 진도로 말하지 않는다.** 막대가 강조하는 것은 "지금 보고 있는 구역" 이지
//    "당신은 3단계 학습자" 가 아니다(같은 문서 §4 — 이동을 알리는 자리는 넷뿐이다).
// ④ **Comics 는 레일 밖.** 만화는 단계가 아니라 읽는 방식이라 「더 보기」 패널로 내려간다.
//    DOM 순서로도 레일 뒤다(`tests/e2e/12-navigation` 이 순서를 본다).
//
// 한 줄 설명(`blurb`)은 면 안에서 읽히는 copy 라 여기 산다. 이미 정본이 있는 것
// (서가 네 면 · 내 라이브러리 네 면)은 `lib/library/tabs.ts` 의 `says` 를 그대로 읽는다.

import { routeArt } from '@/lib/design/route-art'
import { DEEP_CLASS, TINT_CLASS, type Deep, type Tint } from '@/lib/design/tone'
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
  '/dashboard': '자란 기록 · 기억 · 주간 리듬.',
  '/library': '공용 서가 — 골라서 읽기 시작합니다.',
  '/text': '담은 책 · 낱개 본문 · 구독 단어장.',
  '/wordvault': '담은 단어를 기억 네 색으로 봅니다.',
  '/practice': '어느 쪽이 무른지 고르면 방식이 따라옵니다.',
  '/arcade': '단어 게임 19종 — 기억을 놀이로 굴립니다.',
  '/scriptquiz': '읽던 본문으로 돌아가 문항으로 확인합니다.',
  '/dictate': '들은 것을 통째로 다시 써 봅니다.',
  '/comics/adapted': '읽는 책을 같은 이야기 만화로.',
  '/comics/restored': '1940~50년대 옛 만화책을 복원해서.',
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

/** 카드 면 색 — 경로가 이미 가진 범주 색(`route-art`)을 그대로 쓴다. 메뉴가 색을 새로 정하지 않는다. */
const deepClass = (href: string, override?: Deep): string =>
  DEEP_CLASS[override ?? routeArt(href.split('?')[0])?.deep ?? 'ink']
const tintClass = (tint: Tint): string => TINT_CLASS[tint]

/** 그림 — 타일(앱 아이콘 모양)과 소품(투명 물건). 없으면 lucide 아이콘이 대신한다. */
const tileOf = (href: string): string | null => routeArt(href.split('?')[0])?.tile ?? null
const spotOf = (href: string): string | null => routeArt(href.split('?')[0])?.spot ?? null

export interface PanelCard {
  item: NavItem
  title: string
  body: string
  /** 진한 원색 면 클래스 — 면 위 글자는 크림(`.tone-deep-*` 이 --t1 을 바꾼다) */
  tone: string
  tile: string | null
  /** 물건 소품 — 큰 카드에만 얹는다(참조 Product 의 가운데 소품 자리) */
  spot?: string | null
  /** 큰 카드 — 한 패널에 하나. 참조는 늘 「주인공 카드 + 나머지」로 무게를 나눈다. */
  size?: 'lg'
  /** → 안쪽 이동 · ↗ 다른 구역(참조 화살표 두 종) */
  arrow: 'in' | 'out'
}

export interface PanelRow {
  item: NavItem
  title: string
  body: string
  spot: string | null
}

export interface PanelFrame {
  /** 옅은 틀 — 참조는 원색 카드를 늘 한 단 옅은 틀 위에 얹는다 */
  tone: string
  eyebrow: string
  /** 눈썹 자체가 그 구역의 입구가 된다 — 부모 주소(`/library` · `/text`)를 잃지 않으려고 */
  eyebrowHref?: string
  cards: PanelCard[]
}

export interface PanelAside {
  tone: string
  eyebrow: string
  eyebrowHref?: string
  rows: PanelRow[]
}

export interface MenuPanel {
  frames: PanelFrame[]
  /** 틀 밖에 떨어져 서는 원색 카드(참조 Discover 오른쪽) */
  solids: PanelCard[]
  aside?: PanelAside
}

export type TopEntry =
  | {
      kind: 'link'
      key: string
      label: string
      item: NavItem
      /** 흐름 번호 — 순서이지 진도가 아니다 */
      step?: number
      stage?: string
      accent?: string
      says?: string
    }
  | {
      kind: 'menu'
      key: string
      label: string
      step?: number
      stage?: string
      accent?: string
      /** 단계가 하는 일 한 줄 — 패널 머리에서 한 번 말한다(막대에는 늘 띄우지 않는다) */
      says?: string
      /** 패널이 붙는 쪽 — 막대 오른쪽 끝 칸은 패널도 오른쪽에 선다(참조와 같다) */
      align?: 'start' | 'end'
      panel: MenuPanel
    }

const card = (
  item: NavItem,
  opts: { tone?: Deep; arrow?: 'in' | 'out'; size?: 'lg'; art?: string } = {},
): PanelCard => ({
  item,
  title: item.label,
  body: blurb(item.href),
  tone: deepClass(item.href, opts.tone),
  // `art` 는 **같은 경로를 두 카드가 나눠 가질 때만** 쓴다(만화 둘) — 그 밖에는 경로의 타일 그대로.
  tile: opts.art ?? tileOf(item.href),
  spot: opts.size === 'lg' ? spotOf(item.href) : null,
  size: opts.size,
  arrow: opts.arrow ?? 'in',
})

const row = (item: NavItem): PanelRow => ({
  item,
  title: item.label,
  body: blurb(item.href),
  spot: spotOf(item.href),
})

/** 설정에서 항목을 **주소로** 집는다 — 인덱스로 집으면 순서가 바뀔 때 조용히 다른 것을 판다. */
function pick(items: readonly NavItem[], href: string): NavItem {
  const hit = items.find((i) => i.href === href)
  if (!hit) throw new Error(`top-nav-data: ${href} 가 sidebar-config 에 없다`)
  return hit
}

const READ = NAV_GROUPS[0]
const library = pick(READ.items, '/library')
const myLibrary = pick(READ.items, '/text')

// ── 막대 ──────────────────────────────────────────────────────────────────
// 왼쪽부터: 로고 · 메타 둘 · 흐름 레일 다섯 · (오른쪽 끝) 더 보기.
// 사이드바의 세로 순서(META → 레일 → 레일 밖)를 그대로 가로로 눕힌 것이다.

export const META_ENTRIES: TopEntry[] = META_ITEMS.map((item) => ({
  kind: 'link',
  key: item.href,
  label: item.label,
  item,
  says: blurb(item.href),
}))

export const RAIL_ENTRIES: TopEntry[] = NAV_GROUPS.map((g): TopEntry => {
  const base = { step: g.step, stage: g.label, accent: g.accent }

  if (g.flowStage === 'read') {
    return {
      kind: 'menu',
      key: 'read',
      label: g.label,
      says: g.says,
      ...base,
      panel: {
        // 공용 서가 넷 — 자료 유형마다 자기 색이다(`MATERIAL_TONE`). 네 면이 나란히 서면
        // 그 색이 서가 화면의 탭·표지에서 다시 나온다(같은 대상 = 어디서나 같은 색).
        frames: [
          {
            tone: tintClass('lavender'),
            eyebrow: '자료별 — 공용 서가',
            eyebrowHref: library.href,
            cards: (library.children ?? []).map((c) => card(c)),
          },
        ],
        solids: [],
        aside: {
          tone: tintClass('peach'),
          eyebrow: '내 라이브러리',
          eyebrowHref: myLibrary.href,
          rows: (myLibrary.children ?? []).map(row),
        },
      },
    }
  }

  if (g.flowStage === 'practice') {
    return {
      kind: 'menu',
      key: 'practice',
      label: g.label,
      says: g.says,
      ...base,
      panel: {
        frames: [
          {
            tone: tintClass('lavender'),
            eyebrow: '연습 방식',
            // 첫 칸이 주인공이다 — 참조 Product 패널도 큰 카드 하나에 작은 카드가 붙는다.
            cards: g.items.map((i, n) => card(i, n === 0 ? { size: 'lg' } : {})),
          },
        ],
        solids: [],
      },
    }
  }

  // 항목이 하나인 단계는 메뉴를 열지 않는다 — 카드 한 장짜리 패널은 클릭을 한 번 늘릴 뿐이다.
  // 막대에는 **모듈 이름**(WordVault · ScriptQuiz · Dictation)을 적고, 단계 이름은
  // 번호 배지의 sr-only 문장이 말한다(「흐름 4번째 · Conquer」).
  const only = g.items[0]
  return { kind: 'link', key: g.flowStage, label: only.label, item: only, says: g.says, ...base }
})

/**
 * 레일 밖 — 단계가 아닌 것들. 만화(읽는 방식) · 기출(참조면) · 학급(역할) · 도구 둘.
 * 사이드바에서 ASIDE_GROUP + FOOTER_ITEMS 였던 자리 그대로, 막대의 **오른쪽 끝** 한 칸이다.
 */
export const MORE_ENTRY: TopEntry = {
  kind: 'menu',
  key: 'more',
  label: '더 보기',
  align: 'end',
  panel: {
    frames: [
      {
        tone: tintClass('yellow'),
        eyebrow: `${ASIDE_GROUP.label} — ${ASIDE_GROUP.says}`,
        cards: [
          card(pick(ASIDE_GROUP.items, '/comics/adapted'), { tone: 'orange' }),
          // 복원 만화는 같은 자료 유형이라 색도 그림도 겹친다 — 옛 인쇄물 쪽을 먹색 면 +
          // 소품 그림으로 갈라 둔다(같은 타일이 두 장 나란히 서면 둘이 같은 것으로 읽힌다).
          card(pick(ASIDE_GROUP.items, '/comics/restored'), { tone: 'charcoal', art: 'spot-comic' }),
        ],
      },
    ],
    solids: [
      card(pick(FOOTER_ITEMS, '/csat'), { tone: 'magenta' }),
      // 학급은 학습자 동선이 아니라 **역할이 바뀌는 곳** — 참조의 ↗(다른 구역) 화살표를 쓴다.
      card(pick(FOOTER_ITEMS, '/teacher'), { tone: 'green', arrow: 'out' }),
    ],
    aside: {
      tone: tintClass('teal'),
      eyebrow: '도구',
      rows: [row(pick(FOOTER_ITEMS, '/settings')), row(pick(FOOTER_ITEMS, '/sitemap'))],
    },
  },
}

export const TOP_ENTRIES: TopEntry[] = [...META_ENTRIES, ...RAIL_ENTRIES, MORE_ENTRY]

/**
 * 막대·패널·서랍이 실제로 그리는 **모든 항목** — 현재 위치 판정(`pickCurrent`)과
 * 회귀 테스트(`__tests__/top-nav.test.tsx`)가 읽는다. 목록을 손으로 적지 않는다.
 */
export function allEntryItems(entries: readonly TopEntry[] = TOP_ENTRIES): NavItem[] {
  const parents = [...NAV_GROUPS.flatMap((g) => g.items)]
  const out: NavItem[] = []
  for (const e of entries) {
    if (e.kind === 'link') {
      out.push(e.item)
      continue
    }
    for (const f of e.panel.frames) {
      const parent = f.eyebrowHref ? parents.find((i) => i.href === f.eyebrowHref) : undefined
      if (parent) out.push(parent)
      out.push(...f.cards.map((c) => c.item))
    }
    out.push(...e.panel.solids.map((c) => c.item))
    if (e.panel.aside) {
      const parent = e.panel.aside.eyebrowHref
        ? parents.find((i) => i.href === e.panel.aside?.eyebrowHref)
        : undefined
      if (parent) out.push(parent)
      out.push(...e.panel.aside.rows.map((r) => r.item))
    }
  }
  return out
}
