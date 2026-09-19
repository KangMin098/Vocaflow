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
    vLevel: 7,
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

  it('읽기·검증은 by_module 에 안 남는다 — 별도 신호로도 완료가 된다', () => {
    // ⚠️ 위 테스트가 `'textviewer'` 를 **손으로** 넣어 통과하고 있었다. 실제 DB 의
    //    `daily_activity.by_module` 에 그 키는 **한 번도 나타난 적이 없다** —
    //    실측 2026-09-05, 관측 키 21종(dictation · ghost-race · cascade · wordblitz · echo
    //    · flashcard …)에 `textviewer`·`workspace`·`scriptquiz` 셋 다 없다.
    //    저장소 어디에도 그 키로 `learning_records` 에 쓰는 코드가 없기 때문이다.
    //
    //    그래서 읽기·검증 블록은 **완료가 구조적으로 불가능**했고, `pickNow()` 순서가
    //    review→listen→read→syntax→check 라 복습·듣기를 끝내면 "지금 할 일" 이
    //    **읽기에서 영구히 멈췄다.** 증거는 다른 표에 있다 —
    //    읽기 `reading_sessions`(실측 256행) · 검증 `scores`(실측 23행).
    const b = (signals: { read?: boolean; check?: boolean }) =>
      buildTodayBlocks(prescription(), NONE, signals)
    expect(b({}).find((x) => x.key === 'read')!.done).toBe(false)
    expect(b({ read: true }).find((x) => x.key === 'read')!.done).toBe(true)
    expect(b({}).find((x) => x.key === 'check')!.done).toBe(false)
    expect(b({ check: true }).find((x) => x.key === 'check')!.done).toBe(true)
  })

  it('by_module 만으로는 5블록이 다 차지 않는다 — 진행 링이 3/5 에서 멈춘다', () => {
    // 실제로 관측되는 키만으로 채울 수 있는 최대치. `read`·`check` 신호가 없으면
    // 학습자가 무엇을 해도 링이 완성되지 않는다.
    const onlyObservable = new Set(['flashcard', 'echo'])
    const blocks = buildTodayBlocks(prescription({ practiceActive: true }), onlyObservable, {
      dcp: true,
    })
    expect(blockProgress(blocks)).toEqual({ done: 3, total: 5 })

    // 신호를 넘기면 완성된다.
    const withSignals = buildTodayBlocks(prescription({ practiceActive: true }), onlyObservable, {
      dcp: true,
      read: true,
      check: true,
    })
    expect(blockProgress(withSignals)).toEqual({ done: 5, total: 5 })
  })

  it('구문 연습은 스테이지가 열어 주기 전에는 잠긴다', () => {
    expect(
      buildTodayBlocks(prescription({ practiceActive: false }), NONE).find((b) => b.key === 'syntax')!
        .locked,
    ).toBe(true)
  })

  it('구문 연습 완료는 별도 인자로 받는다 (csat_item_attempts 에만 남는다)', () => {
    // ⚠️ 한때 이 블록을 "관측 불가" 로 두고 분모에서 뺐다. 근거가 CLAUDE.md 의
    // "csat_item_attempts 미해결" 이었는데 그 표가 낡아 있었다 — 20260812113000 이
    // 이미 복원했다(실측: 테이블 존재 · grade_dcp_item 정상). 문서가 아니라 DB 가 근거다.
    const syn = (dcpDone: boolean) =>
      buildTodayBlocks(prescription(), NONE, { dcp: dcpDone }).find((b) => b.key === 'syntax')!
    expect(syn(false).done).toBe(false)
    expect(syn(true).done).toBe(true)
  })

  it('DCP 신호를 안 넘기면 완료로 올리지 않는다 (기본값은 "안 했음")', () => {
    expect(buildTodayBlocks(prescription(), NONE).find((b) => b.key === 'syntax')!.done).toBe(false)
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
  it('구문 연습이 열려 있으면 5블록 전부가 분모다', () => {
    expect(blockProgress(buildTodayBlocks(prescription(), NONE)).total).toBe(5)
  })

  it('잠긴 블록은 분모에서 빠진다 — 오늘 열리지 않은 것은 오늘의 분량이 아니다', () => {
    const blocks = buildTodayBlocks(prescription({ practiceActive: false }), NONE)
    expect(blockProgress(blocks).total).toBe(4)
  })

  it('완료한 만큼만 센다', () => {
    const blocks = buildTodayBlocks(prescription({ dueCount: 0 }), new Set(['echo']))
    expect(blockProgress(blocks)).toEqual({ done: 2, total: 5 })
  })

  it('5/5 에 실제로 닿을 수 있다 (도달 불가 목표를 만들지 않는다)', () => {
    // ⚠️ 이 테스트가 오랫동안 **거짓을 증명**하고 있었다. `touchedToday` 에
    //    `'textviewer'`·`'scriptquiz'` 를 손으로 넣어 5/5 를 만들었는데, 그 두 키는
    //    실제 `daily_activity.by_module` 에 **한 번도 나타난 적이 없다**(실측 2026-09-05).
    //    그래서 초록불이 나는 동안 학습자 화면의 링은 3/5 에서 멈춰 있었다.
    //    이제 **실제로 존재하는 신호**로만 5/5 를 만든다.
    const blocks = buildTodayBlocks(
      prescription({ dueCount: 0 }),
      new Set(['echo', 'flashcard']), // by_module 에 실제로 나타나는 키만
      { dcp: true, read: true, check: true }, // 나머지는 저마다의 표에서 온다
    )
    const p = blockProgress(blocks)
    expect(p.done).toBeLessThanOrEqual(p.total)
    expect(p).toEqual({ done: 5, total: 5 })
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
      new Set(['echo']),
      { read: true },
    )
    expect(pickNow(blocks)!.key).toBe('check')
  })

  it('전부 끝나면 null — 화면은 그때 다른 말을 한다', () => {
    const blocks = buildTodayBlocks(
      prescription({ dueCount: 0, practiceActive: false }),
      new Set(['echo']),
      { read: true, check: true },
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
