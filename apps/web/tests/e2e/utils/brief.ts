// apps/web/tests/e2e/utils/brief.ts
//
// 게임 브리핑 게이트를 e2e 에서 다루는 공용 헬퍼.
//
// ── 왜 필요한가 ─────────────────────────────────────────────────
// v08.6 부터 `/play/<slug>` 는 **그 게임의 브리핑을 처음 여는 학습자에게** 게임을 마운트하지
// 않고 브리핑을 먼저 띄운다(lib/game/brief-seen.ts · components/game/brief/InGameBrief.tsx).
// 게임의 동작을 검증하는 스펙은 "돌아온 학습자" 를 재현해야 하므로, 방문 전에 열람 기록을
// 심어 둔다. 그러지 않으면 스펙은 게임이 아니라 브리핑을 보고 "게임이 안 뜬다" 고 실패한다.
//
// 게이트 자체의 회귀는 `15-arcade-brief.spec.ts` 가 **심지 않은 상태**로 검증한다 —
// 여기서 전역으로 꺼 버리면 그 기능은 아무도 안 보는 코드가 된다.
//
// 저장 키는 제품 코드(`lib/game/brief-seen.ts`)와 같아야 한다. 어긋나면 심어도 안 먹고,
// 그 증상은 "게임이 가끔 안 뜬다" 로 나타나 원인을 찾기 어렵다.

import type { Page } from '@playwright/test'

/** lib/game/brief-seen.ts 의 KEY 와 같은 값. */
export const BRIEF_SEEN_KEY = 'vocaflow-brief-seen'

/**
 * 모든 게임의 브리핑을 "이미 봤음" 으로 심는다 — **첫 goto 전에** 부른다.
 *
 * `addInitScript` 라서 이후 모든 네비게이션에 적용된다. 값은 slug 별 플래그 맵이므로
 * 카탈로그가 늘어도 목록을 여기 유지할 필요가 없도록 **와일드카드 대신 알려진 slug 전체**를
 * 심는다(제품 코드는 `all[slug] === true` 만 본다).
 */
export async function seedBriefsSeen(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, slugs]: [string, string[]]) => {
      try {
        const map: Record<string, true> = {}
        for (const s of slugs) map[s] = true
        window.localStorage.setItem(key, JSON.stringify(map))
      } catch {
        /* 저장이 막힌 환경이면 브리핑이 뜬다 — 스펙이 그것을 보고 실패하는 편이 낫다 */
      }
    },
    [BRIEF_SEEN_KEY, ALL_SLUGS] as [string, string[]],
  )
}

/** 반대 — 첫 플레이를 재현한다(게이트 자체를 검증하는 스펙용). */
export async function clearBriefsSeen(page: Page): Promise<void> {
  await page.addInitScript((key: string) => {
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* noop */
    }
  }, BRIEF_SEEN_KEY)
}

/**
 * 카탈로그 19종 slug.
 *
 * 테스트 유틸이 제품 상수를 import 하면 Playwright 가 `@/` 별칭과 tsconfig paths 를
 * 따라가야 해서 스펙 기동이 무거워진다. 대신 `13-arcade-integrity.spec.ts` 가
 * "카탈로그와 이 목록이 같은가" 를 못 박아 drift 를 막는다.
 */
export const ALL_SLUGS = [
  'cascade',
  'ghost-race',
  'word-economy',
  'wordfall-cadence',
  'letter-forge',
  'wordsmith-vigil',
  'morphmerge',
  'daily-blitz',
  'connections',
  'glyph-tongue',
  'word-customs',
  'morpheme-rules',
  'silent-rule',
  'lexicon-hands',
  'lexicon-detective',
  'lexicon-estate',
  'word-orrery',
  'wordblitz',
  'pirate-quest',
]
