// apps/web/src/app/(main)/sitemap/page.tsx
//
// **전체 보기** — 학습자 화면 전체를 한 장에 편다.
//
// ── 왜 이 화면이 생겼나 (실측 2026-09-01) ───────────────────────────
// WCAG 2.2 §2.4.5 Multiple Ways (AA) 는 한 화면에 닿는 길이 **둘 이상**일 것을 요구한다.
// 인정되는 수단은 검색(G161) 또는 사이트맵(G63)이다. 전수 계측에서 학습자 52 측정 중
// **43 이 "내비게이션만 있고 둘 다 없음"** 이었다 — 셸 레일은 하위 항목을 펼침 뒤에
// 숨기고, 폰에는 하단 탭 4개가 전부라 **제품이 무엇을 갖고 있는지 볼 수 있는 자리가 없었다.**
//
// 검색을 화면마다 붙이는 쪽은 택하지 않았다. 학습 중 자극 최소화(철학 ① Calm UI)와
// 정면으로 부딪히고, 우리 콘텐츠는 화면마다 검색 대상이 다르다(권·낱말·본문·만화).
// **사이트맵 한 장 + 셸 링크 하나**가 같은 기준을 만족시키면서 조용하다.
//
// ⚠️ **목록을 손으로 적지 않는다.** `NAV_GROUPS`·`META_ITEMS`·`ASIDE_GROUP`·`FOOTER_ITEMS`
//    를 그대로 읽는다. 사본을 두면 이 저장소가 이미 두 번 겪은 실패가 반복된다 —
//    모바일 하단 탭이 자체 한국어 목록을 들어 같은 표면이 데스크톱 `Today` / 모바일 `오늘`
//    이었던 일(`lib/framework/axes.ts`). 여기는 **내비 표면 중 가장 목록이 긴 자리**라
//    갈라지면 가장 크게 갈라진다.
//
// ⚠️ 레일 번호를 그대로 보여 주되 **진도로 읽히게 하지 않는다** — `sidebar-config.ts` 가
//    못박은 것과 같은 규칙이다(번호는 순서이지 자격·잠금·진도가 아니다). 그래서 여기에도
//    자물쇠·비활성·"아직 못 함" 이 없다. 전부 언제나 눌린다.

import Link from 'next/link'

import { Screen } from '@/components/ui/ios'
import {
  ASIDE_GROUP,
  FOOTER_ITEMS,
  META_ITEMS,
  NAV_GROUPS,
  type NavItem,
} from '@/components/layout/sidebar-config'

export const metadata = {
  // 레이아웃이 ' | Vocaflow' 를 붙인다 — 여기서 또 붙이면 두 번 나온다.
  title: '전체 보기',
  description: 'Vocaflow 학습자 화면 전체 지도 — 읽기·단어·연습·정복·완성 5단계와 그 안의 모든 화면.',
}

/**
 * 항목 한 줄.
 *
 * ⚠️ `ariaLabel` 을 설명으로 **재활용**한다. 그 문장은 이미 "라벨이 말하지 않는 것" 만
 *    담도록 쓰여 있고(사이드바 규칙), 여기서 새로 쓰면 두 곳이 갈라진다.
 *    다만 `ariaLabel` 은 대개 `Label — 설명` 꼴이라 앞의 라벨 부분은 잘라 낸다 —
 *    안 자르면 화면에 라벨이 두 번 인쇄된다.
 */
function itemNote(item: NavItem): string | null {
  if (!item.ariaLabel) return null
  const sep = item.ariaLabel.indexOf(' — ')
  const note = sep >= 0 ? item.ariaLabel.slice(sep + 3) : item.ariaLabel
  const trimmed = note.trim()
  // 설명이 라벨과 같으면 적을 것이 없다.
  return trimmed && trimmed !== item.label ? trimmed : null
}

function ItemRow({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const note = itemNote(item)

  return (
    <li className={depth > 0 ? 'border-l border-[var(--bd)] pl-4' : undefined}>
      <Link
        href={item.href}
        className="flex min-h-[44px] flex-col justify-center gap-0.5 rounded-[var(--r-md)] px-2 py-2 no-underline transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] active:bg-[var(--bg3)]"
      >
        <span className="font-display text-[14px] font-[700] leading-[1.5] text-[var(--t1)]">
          {item.label}
        </span>
        {note && (
          <span className="font-body text-[12px] leading-[1.6] text-[var(--t2)] [word-break:keep-all]">
            {note}
          </span>
        )}
      </Link>
      {item.children && item.children.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5">
          {item.children.map((child) => (
            <ItemRow key={child.href} item={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

function Block({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-ios-2xl bg-[var(--bg)] px-4 py-4 shadow-ios-2 md:px-6 md:py-5">
      <h2 className="font-editorial text-[18px] font-[500] leading-[1.4] tracking-[-0.014em] text-[var(--t1)]">
        {title}
      </h2>
      {note && (
        <p className="mt-1 font-body text-[12.5px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
          {note}
        </p>
      )}
      <div className="mt-2">{children}</div>
    </section>
  )
}

export default function SitemapPage() {
  return (
    <Screen width="wide" background="bg2" padX="md" asMain={false}>
      <div className="flex flex-col gap-3 py-6 md:py-8">
        <header className="flex flex-col gap-1.5">
          <h1 className="font-editorial text-[26px] font-[500] leading-[1.25] tracking-[-0.014em] text-[var(--t1)] md:text-[30px]">
            전체 보기
          </h1>
          <p className="max-w-[62ch] font-body text-[13px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
            Vocaflow 의 모든 화면입니다. 가운데 다섯 묶음은{' '}
            <strong className="font-display text-[var(--t1)]">순서</strong>대로 이어지지만,
            잠긴 곳은 없습니다 — 어디든 바로 갈 수 있어요.
          </p>
        </header>

        {/* 메타 표면 둘 — 앞을 보는 자리(Today)와 뒤를 보는 자리(Growth). 레일 밖이다. */}
        <Block title="어디서든 돌아오는 자리" note="지금 할 일과 지나온 기록.">
          <ul className="flex flex-col gap-0.5">
            {META_ITEMS.map((item) => (
              <ItemRow key={item.href} item={item} />
            ))}
          </ul>
        </Block>

        {/* 흐름 5단계 — 번호는 순서다. 진도가 아니다(sidebar-config 의 같은 규칙). */}
        {NAV_GROUPS.map((group) => (
          <Block
            key={group.flowStage}
            title={`${group.step}. ${group.label}`}
            note={group.says}
          >
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <ItemRow key={item.href} item={item} />
              ))}
            </ul>
          </Block>
        ))}

        {/* 레일 밖 — 만화는 학습 단계가 아니라 읽는 방식이다(2026-08-16 결정). */}
        <Block title={ASIDE_GROUP.label} note={ASIDE_GROUP.says}>
          <ul className="flex flex-col gap-0.5">
            {ASIDE_GROUP.items.map((item) => (
              <ItemRow key={item.href} item={item} />
            ))}
          </ul>
        </Block>

        {/* ⚠️ 자기 자신(`/sitemap`)은 뺀다 — 지금 보고 있는 화면으로 가는 링크는
            길이 아니라 되돌이표다. 목록은 여전히 `FOOTER_ITEMS` 하나에서 온다. */}
        <Block title="그 밖에" note="학급 운영과 내 설정.">
          <ul className="flex flex-col gap-0.5">
            {FOOTER_ITEMS.filter((item) => item.href !== '/sitemap').map((item) => (
              <ItemRow key={item.href} item={item} />
            ))}
          </ul>
        </Block>
      </div>
    </Screen>
  )
}
