// apps/web/src/lib/learner/__tests__/today-blocks.test.ts
//
// 처방 5블록 구성 규칙 — 계정 상태 없이 덮을 수 있는 분기들.
//
// e2e(23-hub-today-stage)는 "실데이터가 화면에 실제로 닿는가" 를 지키고, 여기는
// **완료·잠김·다음 하나·진행** 판정 규칙을 지킨다. 이 판정이 틀리면 화면은 멀쩡히 뜨면서
// 엉뚱한 것을 "지금 할 일" 이라고 말한다 — 런타임에서 가장 잡기 어려운 종류의 오류다.
//
// ⚠️ 2026-08-15 교훈: 이 파일 자체가 한동안 결함을 **보증**하고 있었다.
//    듣기 완료 판정이 `'echomatch'` 였는데 DB enum 값은 `'echo'` 다. 테스트가 같은 오타를
//    그대로 써서 초록불이 났고, 학습자 화면에서는 듣기 블록이 무엇을 해도 완료되지 않았다.
//    그래서 아래 "모듈 id 는 DB enum 실측치" 블록을 뒀다 — 오타를 오타로 검증하지 않도록.

import { describe, expect, it } from 'vitest'

import {
  BLOCK_MODULES,
  blockProgress,
  buildTodayBlocks,
  pickNow,
  touchedModulesToday,
} from '../today-blocks'
import type { TodayPrescription } from '../prescription-actions'

function prescription(over: Partial<TodayPrescription> = {}): TodayPrescription {
  return {
    isDiagnosed: true,
    stage: 'S3',
    stageNum: 3,
    totalMinutes: 75,
    dueCount: 12,
    input: { stageBand: 'B2', candidates: [] },
    practiceActive: true,
    practiceCount: 5,
    listeningTextId: null,
    unavailable: false,
    ...over,
  }
}

const NONE = new Set<string>()

/**
 * `learning_records.module` enum 실측 값 (2026-08-15 pg_enum).
 * 매핑표가 이 집합을 벗어나면 그 블록은 **영원히 완료되지 않는다**.
 */
const REAL_MODULE_IDS = new Set([
  'flashcard', 'spellforge', 'wordblitz', 'pairflip', 'scriptquiz', 'dictation',
  'wordvault', 'workspace', 'textviewer', 'pirate_quest', 'cascade', 'connections',
  'word-economy', 'daily-blitz', 'letter-forge', 'ghost-race', 'glyph-tongue',
  'word-customs', 'lexicon-hands', 'lexicon-detective', 'morpheme-rules', 'silent-rule',
  'lexicon-estate', 'word-orrery', 'wordsmith-vigil', 'morphmerge', 'wordfall-cadence',
  'pirate-quest', 'echo',
])

describe('BLOCK_MODULES — 모듈 id 는 DB enum 실측치여야 한다', () => {
  it('매핑표의 모든 값이 실제 enum 에 있다', () => {
    for (const [block, modules] of Object.entries(BLOCK_MODULES)) {
      for (const m of modules) {
        expect(REAL_MODULE_IDS.has(m), `${block} 의 '${m}' 은 enum 에 없다`).toBe(true)
      }
    }
  })

  it("듣기는 'echo' 다 — 'echomatch' 는 enum 에 존재하지 않는다", () => {
    expect(BLOCK_MODULES.listen).toContain('echo')
    expect(BLOCK_MODULES.listen).not.toContain('echomatch')
  })
})

describe('buildTodayBlocks', () => {
  it('항상 5블록 — 순서가 곧 오늘의 흐름이다', () => {
    const blocks = buildTodayBlocks(prescription(), NONE)
    expect(blocks.map((b) => b.key)).toEqual(['review', 'listen', 'read', 'syntax', 'check'])
  })

  it('이름은 레지스트리에서 온다 (화면에서 짓지 않는다)', () => {
    const blocks = buildTodayBlocks(prescription(), NONE)
    expect(blocks.map((b) => b.name)).toEqual([
      'Flashcard',
      'Echo',
      'Read',
      'Syntax',
      'ScriptQuiz',
    ])
  })

  it('복습은 due 0 이거나 오늘 복습 활동이 있으면 완료', () => {
    expect(buildTodayBlocks(prescription({ dueCount: 0 }), NONE)[0].done).toBe(true)
    expect(buildTodayBlocks(prescription({ dueCount: 1 }), NONE)[0].done).toBe(false)
    // 200개를 복습해도 41개가 남는 날 "아무것도 안 함" 이 되지 않도록.
    expect(buildTodayBlocks(prescription({ dueCount: 41 }), new Set(['flashcard']))[0].done).toBe(
      true,
    )
  })

  it('나머지 완료 판정은 오늘 활동 기록에서 읽는다', () => {
    const touched = new Set(['echo', 'textviewer'])
    const blocks = buildTodayBlocks(prescription(), touched)
    expect(blocks.find((b) => b.key === 'listen')!.done).toBe(true)
    expect(blocks.find((b) => b.key === 'read')!.done).toBe(true)
    expect(blocks.find((b) => b.key === 'check')!.done).toBe(false)
  })

  it('구문 연습은 스테이지가 열어 주기 전에는 잠긴다', () => {
    expect(
      buildTodayBlocks(prescription({ practiceActive: false }), NONE).find((b) => b.key === 'syntax')!
        .locked,
    ).toBe(true)
  })

  it('구문 연습은 완료를 관측할 수 없다 (grade_dcp_item 의 저장 테이블이 없다)', () => {
    const syntax = buildTodayBlocks(prescription(), NONE).find((b) => b.key === 'syntax')!
    expect(syntax.observable).toBe(false)
  })

  it('읽기 후보가 도서면 URL 직결, article 이면 서버액션 경유(articleId)', () => {
    const asBook = buildTodayBlocks(
      prescription({
        input: {
          stageBand: 'B2',
          candidates: [{ kind: 'book', id: 'bk1', title: 't', vLevel: 5, register: null, cefrLevel: null }],
        },
      }),
      NONE,
    ).find((b) => b.key === 'read')!
    expect(asBook.href).toBe('/library/books/bk1')
    expect(asBook.articleId).toBeUndefined()

    const asArticle = buildTodayBlocks(
      prescription({
        input: {
          stageBand: 'B2',
          candidates: [{ kind: 'article', id: 'ar1', title: 't', vLevel: 5, register: null, cefrLevel: null }],
        },
      }),
      NONE,
    ).find((b) => b.key === 'read')!
    // article 은 URL 직결이 불가하다 — 서재로 폴백하고 CTA 가 서버액션을 탄다
    expect(asArticle.href).toBe('/library/books')
    expect(asArticle.articleId).toBe('ar1')
  })
})

describe('blockProgress — 앱에 하나뿐인 진행 정의', () => {
  it('관측 불가 블록은 분모에서 빠진다 — 5/5 에 닿을 수 없는 목표를 만들지 않는다', () => {
    const blocks = buildTodayBlocks(prescription(), NONE)
    // 5블록 중 syntax(관측 불가)를 뺀 4개가 분모
    expect(blockProgress(blocks).total).toBe(4)
  })

  it('잠긴 블록도 분모에서 빠진다 — 오늘 할 수 없는 것은 오늘의 분량이 아니다', () => {
    // practiceActive:false 여도 syntax 는 이미 관측 불가라 분모는 그대로 4다
    const blocks = buildTodayBlocks(prescription({ practiceActive: false }), NONE)
    expect(blockProgress(blocks).total).toBe(4)
  })

  it('완료한 만큼만 센다', () => {
    const blocks = buildTodayBlocks(prescription({ dueCount: 0 }), new Set(['echo']))
    expect(blockProgress(blocks)).toEqual({ done: 2, total: 4 })
  })

  it('done 은 total 을 넘지 않는다', () => {
    const blocks = buildTodayBlocks(
      prescription({ dueCount: 0 }),
      new Set(['echo', 'textviewer', 'scriptquiz', 'flashcard']),
    )
    const p = blockProgress(blocks)
    expect(p.done).toBeLessThanOrEqual(p.total)
    expect(p).toEqual({ done: 4, total: 4 })
  })
})

describe('pickNow — 지금 할 하나', () => {
  it('아직 안 했고 열려 있는 첫 블록', () => {
    expect(pickNow(buildTodayBlocks(prescription(), NONE))!.key).toBe('review')
  })

  it('앞이 끝나면 다음으로 넘어간다', () => {
    const blocks = buildTodayBlocks(prescription({ dueCount: 0 }), new Set(['echo']))
    expect(pickNow(blocks)!.key).toBe('read')
  })

  it('잠긴 블록은 건너뛴다 (열리지 않은 것을 "지금" 이라 하지 않는다)', () => {
    const blocks = buildTodayBlocks(
      prescription({ dueCount: 0, practiceActive: false }),
      new Set(['echo', 'textviewer']),
    )
    expect(pickNow(blocks)!.key).toBe('check')
  })

  it('전부 끝나면 null — 화면은 그때 다른 말을 한다', () => {
    const blocks = buildTodayBlocks(
      prescription({ dueCount: 0, practiceActive: false }),
      new Set(['echo', 'textviewer', 'scriptquiz']),
    )
    expect(pickNow(blocks)).toBeNull()
  })
})

describe('touchedModulesToday — KST 오늘만', () => {
  it('오늘 것만 센다', () => {
    const now = Date.now()
    const touched = touchedModulesToday([
      { module: 'flashcard', createdAt: new Date(now - 60_000).toISOString() },
      { module: 'scriptquiz', createdAt: new Date(now - 40 * 86_400_000).toISOString() },
    ])
    expect(touched.has('flashcard')).toBe(true)
    expect(touched.has('scriptquiz')).toBe(false)
  })
})
