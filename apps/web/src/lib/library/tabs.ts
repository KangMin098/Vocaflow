// apps/web/src/lib/library/tabs.ts
//
// Library 하위 면의 **단일 출처** — 페이지 탭(`components/library/LibraryTabs`)과
// 사이드바 서브메뉴(`components/layout/sidebar-config`)가 **같은 배열**을 읽는다.
//
// 왜 배열을 여기로 뺐나:
//   사이드바가 자기 목록을 복사해 드는 순간 그것이 또 하나의 내비 표면이 되고, 면을 옮기거나
//   라벨을 바꿀 때 두 곳이 갈라진다. 이 프로젝트는 같은 실패를 이미 두 번 겪었다 —
//   미들웨어 `?next=` vs 로그인 `?returnTo=`(딥링크 복귀가 전부 /hub 로 떨어졌다) ·
//   모바일 하단 탭이 자체 한국어 목록을 들어 같은 표면이 데스크톱 `Today` / 모바일 `오늘`.
//   `lib/framework/axes.ts` 가 하단 탭에 대해 못박은 규칙("탭이 자체 목록을 갖는 순간
//   그것이 10번째 내비 표면이 된다")을 사이드바 서브메뉴에도 그대로 적용한다.
//
// 라벨은 여기서도 짓지 않는다 — `MATERIAL_LABEL`(자료 유형 이름의 단일 출처)에서 가져온다.
// 라우트 URL 은 고정이다(딥링크·북마크·e2e `12-navigation` 이 이 주소를 쓴다).

import { BookOpen, FileText, GraduationCap, Layers, type LucideIcon } from 'lucide-react'

import { MATERIAL_LABEL } from '@/lib/learner/plan-activities'

/**
 * 교재 시리즈 면의 이름 — 이 파일이 단일 출처.
 *
 * ⚠️ 왜 `MATERIAL_LABEL` 이 아닌가: 그 표의 키는 `MaterialType` 이고, 그것은
 * `study_plan_items.material_type` 의 CHECK(`book|article|word_set|script`)와 **같은 눈금**이다.
 * 교재 한 권은 DB 행이 아니라 `SERIES_SPINE` 의 계단 번호라 그 CHECK 에 들어갈 수 없다.
 * 없는 유형을 그 표에 끼워 넣으면 Plan 이 **저장할 수 없는 유형**을 팔게 된다.
 */
export const TEXTBOOK_LABEL = 'Textbooks'

export interface LibraryTab {
  /** 학습자가 읽는 이름 — MATERIAL_LABEL 파생 */
  label: string
  href: string
  icon: LucideIcon
  /** 이 면이 무엇인지 — 스크린리더/툴팁 보강. 화면에 상시 노출하지 않는다(Calm UI). */
  says: string
}

/** 진입 라우트 — `/library` 는 첫 면으로 리다이렉트한다(`app/(main)/library/page.tsx`). */
export const LIBRARY_ROOT = '/library'

export const LIBRARY_TABS: readonly LibraryTab[] = [
  {
    label: MATERIAL_LABEL.book,
    href: '/library/books',
    icon: BookOpen,
    says: '큐레이션 도서',
  },
  {
    label: MATERIAL_LABEL.article,
    href: '/library/scripts',
    icon: FileText,
    says: 'arXiv·NASA·NIH·VOA 짧은 글',
  },
  {
    label: MATERIAL_LABEL.word_set,
    href: '/library/vocab',
    icon: Layers,
    says: '발행 단어장',
  },
  {
    // ⚠️ 반드시 **끝**에 둔다 — `DiscoveryFooter` 가 이 배열을 인덱스로 참조한다.
    //    가운데 끼워 넣으면 그 화면이 조용히 다른 면을 가리킨다.
    label: TEXTBOOK_LABEL,
    href: '/library/textbooks',
    icon: GraduationCap,
    says: '학년을 잇는 교재 시리즈',
  },
]

// ── My Library (/text) — 같은 자료 축의 "내 것" 판 ────────────────────────────
//
// 공용 Library 와 **대칭**이되 한 칸이 다르다:
//   Library    = Books · Dispatches · Decks · Textbooks   (공용 카탈로그)
//   My Library = Books · Texts      · Decks · Textbooks   (내 것)
// `Textbooks` 만 양쪽에 다 있다 — 공용 쪽은 **고르는 서가**, 내 것 쪽은 **담은 것을 관리**하는 곳.
// 서점과 책장의 관계라 같은 이름이 두 층위에 있는 것이 오히려 정확하다.
// `Dispatches`(ACP 공개 짧은 글)는 내 것 공간에 존재하지 않는다. 그 자리에 있는 것은
// **내가 구독한 세트**(Decks)이고, 낱개 본문이 `Texts` 다. 없는 것을 대칭으로 만들어 팔면
// 그건 빈 링크를 파는 것이다.
//
// ⚠️ 이 면들은 라우트가 아니라 `/text` 한 화면의 **탭**이다. 그래서 `?view=` 로 주소화한다 —
// 주소가 없으면 사이드바에서 특정 면으로 곧장 갈 수 없고(그게 이 서브메뉴의 존재 이유다),
// 뒤로가기·북마크·공유도 성립하지 않는다.

export type MyLibraryView = 'books' | 'scripts' | 'vocab' | 'textbooks'

/**
 * 탭 강조색 — **흰 글자가 얹히므로 AA(4.5:1)를 넘어야 한다.**
 *
 * ⚠️ 실측 2026-08-22: 원래 값 넷이 **전부 미달**이었다 —
 *    #6366F1 4.47 · #3B82F6 3.68 · #0EA5E9 2.77 · #8B5CF6 4.23.
 *    한 톤씩 내려 5.9~7.1:1 로 맞췄다(색상은 유지 — 면을 구별하는 것이 이 색의 일이다).
 *    새 면을 더할 때 색부터 고르지 말고 **흰 글자 대비를 먼저 계산할 것.**
 */
export interface MyLibraryTab extends LibraryTab {
  view: MyLibraryView
  /** 캐러셀 탭 강조색 — 화면이 다시 정하지 않도록 여기서 준다 */
  accent: string
}

export const MY_LIBRARY_ROOT = '/text'
export const MY_LIBRARY_VIEW_PARAM = 'view'

export const MY_LIBRARY_TABS: readonly MyLibraryTab[] = [
  {
    view: 'books',
    label: MATERIAL_LABEL.book,
    href: `${MY_LIBRARY_ROOT}?${MY_LIBRARY_VIEW_PARAM}=books`,
    icon: BookOpen,
    says: '챕터로 나뉜 내 책',
    accent: '#4F46E5',
  },
  {
    view: 'scripts',
    // `script` = 학습자가 넣은 본문 → Texts. Library 의 `article`(Dispatches)과 다른 것이다.
    label: MATERIAL_LABEL.script,
    href: `${MY_LIBRARY_ROOT}?${MY_LIBRARY_VIEW_PARAM}=scripts`,
    icon: FileText,
    says: '낱개 본문',
    accent: '#1D4ED8',
  },
  {
    view: 'vocab',
    label: MATERIAL_LABEL.word_set,
    href: `${MY_LIBRARY_ROOT}?${MY_LIBRARY_VIEW_PARAM}=vocab`,
    icon: Layers,
    says: '내가 구독한 단어장',
    accent: '#0369A1',
  },
  {
    view: 'textbooks',
    label: TEXTBOOK_LABEL,
    href: `${MY_LIBRARY_ROOT}?${MY_LIBRARY_VIEW_PARAM}=textbooks`,
    icon: GraduationCap,
    says: '내가 담은 교재',
    accent: '#6D28D9',
  },
]

/** `?view=` 값 해석. 모르는 값은 null — 화면이 자기 기본값(가장 많은 면)을 쓴다. */
export function parseMyLibraryView(raw: string | null | undefined): MyLibraryView | null {
  return MY_LIBRARY_TABS.find((t) => t.view === raw)?.view ?? null
}
