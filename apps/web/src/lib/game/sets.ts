// apps/web/src/lib/game/sets.ts
//
// 자료별 게임 세트(코스) — "이 도서/스크립트/단어장으로는 무엇을, 어떤 순서로 하는가".
//
// ── 왜 필요한가 ──────────────────────────────────────────────────
// 스코프(`?set=` · `?text=` · `?book=`)는 이미 작동한다. 그런데 스코프를 걸고 허브에 오면
// **19장이 그대로 평평하게 깔린다**. 학습자가 실제로 묻는 것은 "이 자료로 뭘 하지" 인데
// 화면은 "19개 중 아무거나 고르세요" 로 답한다. 그 결과 선택이 이름·색 찍기가 되고,
// 자료마다 성립하지 않는 게임까지 같은 크기로 놓여 "들어갔더니 단어가 모자라다" 로 끝난다.
//
// ── 설계의 근거는 전부 실측이다 (2026-08-25 · DB direct query) ────
//
// 자료가 주는 신호:
//   자료              예문    저장 발음   품사     원문 문장   서사 맥락
//   도서 챕터        100%    57.6%     100%     2.6%      있음(읽던 책)
//   주제 단어장      100%     4.6%     89.8%   89.0%      없음
//   스크립트(내 글)   98.4%    1.6%     100%      —        있음(내가 넣은 글)
//
// 자료 단위의 크기(= 어떤 게임이 성립하는가를 결정한다):
//   자료           단위 수   중앙값   8개 이상   4개 미만
//   도서 챕터       1,968       4     46.6%     41.6%
//   주제 단어장     1,285      21     82.5%      5.5%
//   스크립트           59       4     28.8%     44.1%
//
// 이 표가 이 파일의 형태를 결정했다. **도서 챕터의 41.6% 와 스크립트의 44.1% 는
// 4단어 미만이라 19종 중 1종(morpheme-rules · minWords 1)밖에 돌지 않는다.**
// 그래서 코스는 "추천 3종" 같은 고정 목록일 수 없고, 풀 크기에 따라 **내려앉아야** 한다.
// 고정 목록을 내놓으면 도서 챕터의 절반에서 링크가 전부 죽은 채로 광고된다.
//
// ── 코스의 형태 ──────────────────────────────────────────────────
// 3단 — 워밍업(재인) → 본훈련(그 자료가 가장 잘 시키는 것) → 마무리(정착).
// 인지 부하가 낮은 것에서 높은 것으로 가고(원칙 6 Cognitive Load),
// 마지막에 의미망·형태로 묶어 맥락 인출을 남긴다(원칙 5 Context-Dependent).
//
// 각 단계는 후보 목록이다 — 풀 크기로 **처음 성립하는 것**을 고른다.
// 후보가 전부 미달이면 그 단계는 비고, 코스는 짧아진다(거짓말하지 않는다).

import { GAME_BY_SLUG, GAME_CATALOG, type GameEntry, type GameSlug } from '@/lib/game/catalog'

/** 학습 자료의 종류 — 게임 세트가 갈리는 축. `mine` 은 스코프 없는 복습 큐. */
export type ResourceKind = 'book' | 'script' | 'wordset' | 'mine'

/** 코스 한 단계가 맡는 역할. */
export type CourseRole = 'warmup' | 'main' | 'finish'

export interface CourseStage {
  role: CourseRole
  /** 단계 이름 — 학습자에게 보이는 라벨 */
  label: string
  /**
   * 후보 slug — **앞에서부터** 풀 크기가 되는 첫 게임을 쓴다.
   * 순서는 "이 단계에 가장 맞는 것" 순이지 minWords 순이 아니다
   * (내려앉기는 minWords 비교가 알아서 한다).
   */
  candidates: GameSlug[]
}

export interface GameCourse {
  kind: ResourceKind
  /** 코스 이름 */
  name: string
  /** 이 자료가 무엇을 가장 잘 시키는지 한 줄 */
  rationale: string
  stages: CourseStage[]
  /** 코스 밖 확장 — 풀이 넉넉할 때만 권한다(8개 이상). */
  extras: GameSlug[]
}

// ── 코스 정의 ─────────────────────────────────────────────────────

export const GAME_COURSES: Record<ResourceKind, GameCourse> = {
  // 도서 챕터 — 품사 100% · 읽은 직후라 재인이 이미 서 있다. 검증과 구조화로 간다.
  book: {
    kind: 'book',
    name: '챕터 정복',
    rationale:
      '방금 읽은 맥락이 살아 있고 품사가 전부 붙어 있어요. 뜻을 다시 떠올리는 데서 시작해 ' +
      '단어를 하나씩 검증하고, 챕터 전체를 하나의 의미망으로 묶어 마칩니다.',
    stages: [
      { role: 'warmup', label: '되살리기', candidates: ['cascade', 'word-orrery', 'morpheme-rules'] },
      { role: 'main', label: '검증하기', candidates: ['word-customs', 'lexicon-detective', 'wordsmith-vigil'] },
      { role: 'finish', label: '엮기', candidates: ['lexicon-estate', 'connections', 'cascade'] },
    ],
    extras: ['glyph-tongue', 'lexicon-hands', 'wordfall-cadence'],
  },

  // 스크립트(내가 넣은 글) — 중앙값 4단어. **짧고 낮은 문턱**이 유일하게 성립하는 설계다.
  script: {
    kind: 'script',
    name: '내 글 소화',
    rationale:
      '내가 넣은 글이라 단어 수가 적어요(중앙값 4개). 적은 단어로도 끝까지 도는 짧은 판을 ' +
      '골라, 철자를 직접 쓰는 생성 인출까지 한 번에 갑니다.',
    stages: [
      { role: 'warmup', label: '조립하기', candidates: ['morpheme-rules'] },
      { role: 'main', label: '직접 쓰기', candidates: ['wordsmith-vigil', 'letter-forge', 'cascade'] },
      { role: 'finish', label: '몰아치기', candidates: ['cascade', 'word-orrery', 'morpheme-rules'] },
    ],
    extras: ['ghost-race', 'wordblitz', 'letter-forge'],
  },

  // 공용 단어장 — 82.5% 가 8개 이상 · 원문 문장 89%. 큰 풀에서만 되는 것을 준다.
  wordset: {
    kind: 'wordset',
    name: '단어장 완주',
    rationale:
      '단어가 넉넉하고(82.5%가 8개 이상) 원문 문장이 89% 붙어 있어요. 속사 인출로 몸을 풀고, ' +
      '풀이 커야만 성립하는 의미 관계·형태 수집으로 넘어갑니다.',
    stages: [
      { role: 'warmup', label: '속사 인출', candidates: ['wordblitz', 'cascade', 'word-orrery'] },
      { role: 'main', label: '관계 찾기', candidates: ['connections', 'lexicon-detective', 'wordsmith-vigil'] },
      { role: 'finish', label: '형태 모으기', candidates: ['morphmerge', 'letter-forge', 'morpheme-rules'] },
    ],
    extras: ['glyph-tongue', 'silent-rule', 'lexicon-hands', 'word-customs'],
  },

  // 복습 큐 — 자료가 아니라 기억 상태가 고른다. FSRS 가 이미 순서를 정해 준다.
  mine: {
    kind: 'mine',
    name: '오늘의 복습',
    rationale:
      '복습이 임박한 단어부터 나옵니다. 재인 → 생성 → 추론 순으로 한 바퀴 돌면 ' +
      '같은 단어를 세 가지 다른 방식으로 인출하게 돼요.',
    stages: [
      { role: 'warmup', label: '재인', candidates: ['wordblitz', 'cascade', 'word-orrery', 'morpheme-rules'] },
      { role: 'main', label: '생성', candidates: ['wordsmith-vigil', 'letter-forge', 'morpheme-rules'] },
      { role: 'finish', label: '추론', candidates: ['connections', 'lexicon-detective', 'silent-rule'] },
    ],
    extras: ['daily-blitz', 'ghost-race', 'word-economy', 'wordfall-cadence'],
  },
}

// ── 해석 ──────────────────────────────────────────────────────────

export interface ResolvedStage {
  role: CourseRole
  label: string
  /** 이 풀에서 성립하는 게임. 없으면 null — 그 단계는 그리지 않는다. */
  game: GameEntry | null
  /** 성립하지 않은 이유(단어 몇 개가 더 필요한가). game 이 null 일 때만. */
  needs: number | null
}

export interface ResolvedCourse {
  course: GameCourse
  poolSize: number
  stages: ResolvedStage[]
  /** 실제로 그릴 수 있는 단계 수 */
  playable: number
  /** 풀이 넉넉할 때만 채워지는 확장 목록 */
  extras: GameEntry[]
  /**
   * 코스가 통째로 서지 않을 때 필요한 단어 수 — "N개만 더 모으면 코스가 열려요" 안내용.
   * 모든 단계가 서면 null.
   */
  unlockAt: number | null
}

/**
 * 자료 종류 + 풀 크기 → 실제로 플레이 가능한 코스.
 *
 * 같은 게임이 두 단계에 뽑히는 것은 막는다 — 코스가 "같은 걸 두 번"이 되면
 * 3단 구성이 주는 변화감이 사라지고, 그건 중복을 없앤 이유와 정면으로 어긋난다.
 * 단, 후보를 다 쓰고도 비면 중복을 허용하기보다 **그 단계를 비운다**.
 */
export function resolveCourse(kind: ResourceKind, poolSize: number): ResolvedCourse {
  const course = GAME_COURSES[kind]
  const used = new Set<GameSlug>()
  const stages: ResolvedStage[] = course.stages.map((s) => {
    let picked: GameEntry | null = null
    let cheapest = Number.POSITIVE_INFINITY
    for (const slug of s.candidates) {
      const g = GAME_BY_SLUG[slug]
      if (!g) continue
      cheapest = Math.min(cheapest, g.minWords)
      if (used.has(slug)) continue
      if (poolSize >= g.minWords) {
        picked = g
        used.add(slug)
        break
      }
    }
    return {
      role: s.role,
      label: s.label,
      game: picked,
      needs: picked ? null : Number.isFinite(cheapest) ? Math.max(0, cheapest - poolSize) : null,
    }
  })

  const extras = course.extras
    .map((slug) => GAME_BY_SLUG[slug])
    .filter((g): g is GameEntry => !!g && poolSize >= g.minWords && !used.has(g.slug))

  const playable = stages.filter((s) => s.game).length

  return {
    course,
    poolSize,
    stages,
    playable,
    extras,
    unlockAt: playable === stages.length ? null : nextUnlock(kind, poolSize, playable),
  }
}

/**
 * 다음으로 단계가 하나 더 열리는 풀 크기.
 *
 * minWords 산술로 구하지 않는다 — 코스는 **같은 게임을 두 단계에 쓰지 않으므로**,
 * "이 단계의 최저 minWords" 는 그 단계가 실제로 열리는 지점과 다르다.
 * (실측 사례: 도서 코스는 5단어에서 마무리 후보 cascade 가 이미 워밍업에 쓰여
 *  단계가 비는데, 산술로는 "5면 충분" 이 나왔다.)
 * 그래서 해석기 자신에게 물어본다. 상한은 카탈로그 최대 minWords — 그 위로는 더 열릴 것이 없다.
 */
function nextUnlock(kind: ResourceKind, from: number, playable: number): number | null {
  const ceiling = Math.max(...GAME_CATALOG.map((g) => g.minWords)) + 1
  for (let n = from + 1; n <= ceiling; n++) {
    const r = GAME_COURSES[kind].stages.reduce(
      (acc, s) => {
        for (const slug of s.candidates) {
          const g = GAME_BY_SLUG[slug]
          if (!g || acc.used.has(slug) || n < g.minWords) continue
          acc.used.add(slug)
          acc.n += 1
          break
        }
        return acc
      },
      { used: new Set<GameSlug>(), n: 0 },
    )
    if (r.n > playable) return n
  }
  return null
}

/** 스코프 쿼리 → 자료 종류. 허브·자료 페이지가 같은 규칙을 쓰도록 한 곳에 둔다. */
export function resourceKindFromScope(scope: {
  set?: string
  text?: string
  book?: string
  chapter?: number | null
}): ResourceKind {
  if (scope.book) return 'book'
  if (scope.text) return 'script'
  // 공용 단어장 세트 id 는 챕터 단어장으로도 쓰인다 — 챕터가 붙어 오면 도서 코스다.
  if (scope.set) return scope.chapter != null ? 'book' : 'wordset'
  return 'mine'
}

/**
 * 코스 3단이 **전부** 서는 최소 단어 수 — 자료 페이지에서 "지금 열리는가"를 미리 판단할 때.
 *
 * 단계별 최저 minWords 의 최댓값이 아니다. 중복 금지 때문에 그 산술은 실제보다 낮게 나온다.
 * 해석기를 직접 돌려 처음으로 전 단계가 서는 지점을 찾는다.
 */
export function courseMinWords(kind: ResourceKind): number {
  const total = GAME_COURSES[kind].stages.length
  const ceiling = Math.max(...GAME_CATALOG.map((g) => g.minWords)) + 1
  for (let n = 0; n <= ceiling; n++) {
    if (resolveCourse(kind, n).playable === total) return n
  }
  return ceiling
}
