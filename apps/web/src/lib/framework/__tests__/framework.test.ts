// apps/web/src/lib/framework/__tests__/framework.test.ts
//
// 프레임워크 무결성 — 레지스트리는 **조용히 낡는 것**이 유일한 실패 방식이다.
//
// 새 활동을 만들고 여기 등록하지 않으면 예외가 나지 않는다. 그냥 처방·연습장·챕터 런처에서
// 사라진다(EchoMatch 가 어느 메뉴에도 없던 것이 정확히 그 실패다). 그래서 카탈로그와의
// 정합을 테스트로 강제한다.
//
// 흐름 규칙도 같이 못 박는다. 특히 "갓 만난 단어에 생산 과제를 권하지 않는다" 는
// 근거가 있는 제약인데(Barcroft — 초기 부호화에서 생산 강제는 자원 소모로 해롭다)
// 코드가 우연히 지키고 있을 뿐 문서에 없었다. 여기 없으면 다음 사람이 깨뜨린다.

import { describe, expect, it } from 'vitest'

import {
  ASIDE_GROUP,
  FOOTER_ITEMS,
  META_ITEMS,
  NAV_GROUPS,
} from '../../../components/layout/sidebar-config'
import { GAME_CATALOG } from '../../game/catalog'
import { MATERIAL_LABEL, MATERIAL_LABEL_ONE } from '../../learner/plan-activities'
import { LIBRARY_TABS, MY_LIBRARY_TABS, parseMyLibraryView } from '../../library/tabs'
import {
  CROSS,
  FACETS,
  FACET_ORDER,
  NAME_DECISIONS,
  SPINE,
  STAGES,
  STAGE_ORDER,
  SURFACES,
  SURFACE_ORDER,
  nextSpine,
  stageOf,
} from '../axes'
import {
  ACCURACY_HOLD_BELOW,
  ACCURACY_TARGET,
  DAILY_BLOCKS,
  ENCOUNTERS_FLOOR,
  HANDOFFS,
  NEW_FACETS_PER_SESSION,
  STRAND_TARGET,
  canAdvance,
  type WordFrameworkState,
} from '../flow'
import { activities, activityById, facetCoverage, fullScreenActivityPaths } from '../registry'
import {
  FULL_SCREEN_ACTIVITY_ROUTES,
  isFullScreenRoute,
} from '../../layout/full-screen-routes'

const ACTS = activities()

describe('축 — 면 · 단계 · 표면', () => {
  it('면은 6개이고 spine 4 + cross 2 로 정확히 갈린다', () => {
    expect(FACET_ORDER).toHaveLength(6)
    expect(SPINE).toHaveLength(4)
    expect(CROSS).toHaveLength(2)
    expect([...SPINE, ...CROSS].sort()).toEqual([...FACET_ORDER].sort())
    for (const f of SPINE) expect(FACETS[f].kind, `${f}`).toBe('spine')
    for (const f of CROSS) expect(FACETS[f].kind, `${f}`).toBe('cross')
  })

  it('면·단계·표면의 코드와 이름이 유일하다 (같은 이름 두 개면 충돌이 재발한다)', () => {
    const facetNames = FACET_ORDER.map((f) => FACETS[f].name)
    expect(new Set(facetNames).size).toBe(facetNames.length)
    const facetCodes = FACET_ORDER.map((f) => FACETS[f].code)
    expect(new Set(facetCodes).size).toBe(facetCodes.length)

    const stageNames = STAGE_ORDER.map((s) => STAGES[s].name)
    expect(new Set(stageNames).size).toBe(stageNames.length)

    const surfaceNames = SURFACE_ORDER.map((s) => SURFACES[s].name)
    expect(new Set(surfaceNames).size).toBe(surfaceNames.length)
  })

  it('최상위 표면은 4개다 (국외 관측 3~6 · 모바일 하단 탭에 들어가야 한다)', () => {
    expect(SURFACE_ORDER).toHaveLength(4)
    // 한 단어여야 탭에 들어간다
    for (const s of SURFACE_ORDER) {
      expect(SURFACES[s].name.trim().split(/\s+/), `${s} 는 한 단어여야 한다`).toHaveLength(1)
    }
  })

  it('단계는 통과한 면에서 파생된다 — 별도 상태 기계가 아니다', () => {
    expect(stageOf([])).toBe('met')
    expect(stageOf(['recognize'])).toBe('recognized')
    expect(stageOf(['recognize', 'spell'])).toBe('recalled')
    expect(stageOf(['recognize', 'spell', 'use'])).toBe('applied')
    expect(stageOf(['recognize', 'spell', 'use', 'fluency'])).toBe('fluent')
  })

  it('cross 면은 단계를 올리지 않는다 (Sound 를 몰라도 문맥으로 갈 수 있다)', () => {
    expect(stageOf(['sound'])).toBe('met')
    expect(stageOf(['build'])).toBe('met')
    expect(stageOf(['recognize', 'sound', 'build'])).toBe('recognized')
  })

  it('건너뛴 통과도 정직하게 반영한다 (게이트는 처방이 하고 계산이 흉내 내지 않는다)', () => {
    // Spell 없이 Use 를 통과했으면 Applied 다 — "했는데 안 올라간다" 는 거짓말이다
    expect(stageOf(['recognize', 'use'])).toBe('applied')
  })

  it('nextSpine 이 다음 한 걸음을 준다', () => {
    expect(nextSpine([])).toBe('recognize')
    expect(nextSpine(['recognize'])).toBe('spell')
    expect(nextSpine(['recognize', 'spell', 'use', 'fluency'])).toBeNull()
    // cross 면을 통과해도 spine 진행은 그대로다
    expect(nextSpine(['sound', 'build'])).toBe('recognize')
  })

  it('이름 충돌 결정이 폐기 목록을 반드시 갖는다 (결정 없이 이름만 늘리면 8종이 9종이 된다)', () => {
    expect(NAME_DECISIONS.length).toBeGreaterThanOrEqual(5)
    for (const d of NAME_DECISIONS) {
      expect(d.now.length, `${d.was}: 확정 이름 없음`).toBeGreaterThan(0)
      expect(d.retire.length, `${d.was}: 폐기 표기가 없다 — 그러면 갈라진 채로 남는다`).toBeGreaterThan(0)
      expect(d.why.trim().length, `${d.was}: 근거 없음`).toBeGreaterThan(20)
      for (const n of d.now) expect(n.name.trim().length).toBeGreaterThan(0)
    }
  })

  it('폐기하기로 한 표기가 살아 있는 내비/라벨 레지스트리에 남아 있지 않다', () => {
    // 왜 이 단언인가: `retire` 목록은 **결정**인데, 결정을 적어 두는 것과 화면이 따르는 것은
    // 별개다. 실제로 v08.4 까지 사이드바는 retire 된 `My Scripts` 를 그대로 팔고 있었고,
    // `MATERIAL_LABEL.script` 는 같은 대상을 `Scripts` 로 불러 **두 레지스트리가 한 대상을
    // 서로 다르게 부르는 상태**가 오래 유지됐다. 아무 예외도 나지 않기 때문이다.
    const liveLabels = [
      ...META_ITEMS.map((i) => i.label),
      ...FOOTER_ITEMS.map((i) => i.label),
      ...[...NAV_GROUPS, ASIDE_GROUP].flatMap((g) => [
        g.label,
        ...g.items.flatMap((i) => [i.label, ...(i.children ?? []).map((c) => c.label)]),
      ]),
      ...LIBRARY_TABS.map((t) => t.label),
      ...MY_LIBRARY_TABS.map((t) => t.label),
      ...Object.values(MATERIAL_LABEL),
      ...Object.values(MATERIAL_LABEL_ONE),
      ...SURFACE_ORDER.map((id) => SURFACES[id].name),
    ]

    // 서술형 폐기 항목('Library 탭 "스크립트"' 등)은 라벨이 아니므로 정확 일치만 본다.
    const retired = new Set(NAME_DECISIONS.flatMap((d) => d.retire))
    for (const label of liveLabels) {
      expect(retired.has(label), `폐기된 표기가 아직 쓰인다: "${label}"`).toBe(false)
    }
  })

  it('학습 흐름 레일 — 번호가 배열 순서와 같고, 단계 키가 고유하다', () => {
    // 번호는 손으로 적는 값이라 항목을 끼워 넣으면 조용히 어긋난다. 어긋난 순간
    // 레일은 "순서를 말하는 장치" 가 아니라 **틀린 순서를 말하는 장치**가 된다.
    NAV_GROUPS.forEach((g, i) => {
      expect(g.step, `${g.label}: 번호가 배열 위치와 다르다`).toBe(i + 1)
      expect(g.says.trim().length, `${g.label}: 이 단계에서 하는 일이 비어 있다`).toBeGreaterThan(0)
      expect(g.items.length, `${g.label}: 빈 단계`).toBeGreaterThan(0)
    })
    const stages = NAV_GROUPS.map((g) => g.flowStage)
    expect(new Set(stages).size, '단계 키 중복 — 레일 key 가 겹친다').toBe(stages.length)

    // NN/g: 최상위 6개 초과 금지. 레일이 늘어나는 것을 여기서 막는다.
    expect(NAV_GROUPS.length).toBeLessThanOrEqual(6)
  })

  it('레일은 막지 않는다 — 잠금 어휘가 단계 이름·설명에 없다', () => {
    // `docs/LEARNING_FRAMEWORK.md` §4① — 자물쇠 UI 를 두지 않고, 잠김/불가/금지/차단 어휘를
    // 쓰지 않는다. 번호를 붙이면 "순서 = 자격" 으로 미끄러지기 쉬워서 여기서 못 박는다.
    const BANNED = /잠김|잠금|불가|금지|차단|먼저 해야|완료해야/
    for (const g of NAV_GROUPS) {
      expect(BANNED.test(g.label), `${g.label}: 잠금 어휘`).toBe(false)
      expect(BANNED.test(g.says), `${g.label}: 잠금 어휘 — "${g.says}"`).toBe(false)
    }
  })

  it('사이드바가 약속한 Game Lab 게임 수가 카탈로그와 같다 (문구 드리프트 차단)', () => {
    // 이 단언은 `09-arcade-access` 의 A2 를 옮겨 온 것이다. A2 는 `/hub` 의 아케이드 진입
    // 카드가 약속한 "N종" 을 검사했는데, v06.202 가 그 카드를 없애고 Game Lab 통로를
    // 사이드바로 옮기면서 **검사 대상이 사라졌다**(스펙은 그대로 남아 계속 빨갰다).
    // 지금 드리프트 위험은 사이드바 `ariaLabel` 에 **손으로 적힌 숫자**에 있다.
    // DOM 이 아니라 레지스트리끼리 비교하므로 날짜·로그인·컴파일 상태에 흔들리지 않는다.
    const gameLab = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.href === '/arcade')
    expect(gameLab, '사이드바에 Game Lab 항목이 없다').toBeTruthy()
    const claimed = Number(/(\d+)\s*종/.exec(gameLab!.ariaLabel ?? '')?.[1] ?? 0)
    expect(claimed, `ariaLabel 에 게임 수가 없다: "${gameLab!.ariaLabel}"`).toBeGreaterThan(0)
    expect(claimed, '사이드바가 약속한 수 ≠ 카탈로그 실제 수').toBe(GAME_CATALOG.length)
  })

  it('Comics 는 레일 밖에 있다 — 읽는 방식이지 학습 단계가 아니다', () => {
    expect(NAV_GROUPS.some((g) => g.items.some((i) => i.href.startsWith('/comics')))).toBe(false)
    expect(ASIDE_GROUP.items.map((i) => i.href)).toEqual(['/comics/adapted', '/comics/restored'])
  })

  it('서브메뉴가 페이지 탭과 같은 배열을 읽는다 (Library · My Library)', () => {
    // 사이드바가 목록을 복사해 들면 화면은 멀쩡해 보이고 한쪽에만 없는 면이 생긴다.
    const items = NAV_GROUPS.flatMap((g) => g.items)
    const pairs: Array<[string, ReadonlyArray<{ href: string; label: string }>]> = [
      ['/library', LIBRARY_TABS],
      ['/text', MY_LIBRARY_TABS],
    ]
    for (const [href, tabs] of pairs) {
      const parent = items.find((i) => i.href === href)
      expect(parent?.children?.map((c) => c.href), `${href} 자식 href`).toEqual(
        tabs.map((t) => t.href),
      )
      expect(parent?.children?.map((c) => c.label), `${href} 자식 라벨`).toEqual(
        tabs.map((t) => t.label),
      )
    }
  })

  it('My Library 세 면은 주소를 갖고, 부모와 이름이 겹치지 않는다', () => {
    // 주소가 없으면 사이드바에서 특정 면으로 들어갈 수 없다 — 이 서브메뉴의 존재 이유가 사라진다.
    for (const t of MY_LIBRARY_TABS) {
      expect(t.href).toBe(`/text?view=${t.view}`)
      expect(parseMyLibraryView(t.view)).toBe(t.view)
    }
    expect(parseMyLibraryView('nope')).toBeNull()
    expect(parseMyLibraryView(undefined)).toBeNull()

    // 부모 이름이 자식 중 하나와 같으면 층위가 안 읽힌다('Texts > Texts' 를 피한 이유).
    const parent = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.href === '/text')
    expect(parent?.label).toBeTruthy()
    expect(MY_LIBRARY_TABS.map((t) => t.label)).not.toContain(parent!.label)

    // 공용 Library 와 대칭이되 한 칸이 다르다 — 내 것 공간에 Dispatches 는 없다.
    expect(MY_LIBRARY_TABS.map((t) => t.label)).not.toContain(
      LIBRARY_TABS.find((t) => t.href === '/library/scripts')!.label,
    )
  })
})

describe('레지스트리 ↔ 카탈로그 정합', () => {
  it('카탈로그의 모든 게임이 레지스트리에 있다 (등록 누락 = 그 화면에서만 사라짐)', () => {
    const missing = GAME_CATALOG.filter((g) => !activityById(g.slug)).map((g) => g.slug)
    expect(missing, `레지스트리 누락: ${missing.join(', ')}`).toEqual([])
  })

  it('모든 활동이 면을 최소 1개 갖는다 (면 없는 활동은 처방이 고를 수 없다)', () => {
    const naked = ACTS.filter((a) => a.facets.length === 0).map((a) => a.id)
    expect(naked, `면 미선언: ${naked.join(', ')}`).toEqual([])
  })

  it('활동 id 와 정식명이 유일하다', () => {
    const ids = ACTS.map((a) => a.id)
    expect(new Set(ids).size, `중복 id: ${ids.join(', ')}`).toBe(ids.length)
    // 계열 모드는 같은 name 을 공유할 수 있으므로 name+alias 조합으로 본다
    const labels = ACTS.map((a) => `${a.name}/${a.alias ?? ''}`)
    expect(new Set(labels).size, `중복 라벨: ${labels.join(', ')}`).toBe(labels.length)
  })

  it('활동이 배치 가능한 단계를 갖는다', () => {
    for (const a of ACTS) {
      expect(a.stages.length, `${a.id}: 배치 가능 단계 없음`).toBeGreaterThan(0)
      for (const s of a.stages) expect(STAGE_ORDER, `${a.id}: 미상 단계 ${s}`).toContain(s)
    }
  })

  it('아케이드 활동은 브리핑을 갖는다 (카드의 (?) 가 조용히 사라지지 않게)', () => {
    const arcade = ACTS.filter((a) => GAME_CATALOG.some((g) => g.slug === a.id))
    expect(arcade.length).toBe(GAME_CATALOG.length)
    const noBrief = arcade.filter((a) => !a.brief).map((a) => a.id)
    expect(noBrief, `브리핑 없음: ${noBrief.join(', ')}`).toEqual([])
  })

  it('면 커버리지가 설계와 실사용을 구분해서 센다', () => {
    const cov = facetCoverage()
    for (const f of FACET_ORDER) {
      expect(cov[f].recording, `${f}: 기록 활동이 설계 활동보다 많다`).toBeLessThanOrEqual(cov[f].designed)
    }
    // 이 표의 값이 프레임워크가 요구하는 신설의 근거다.
    // recognize 는 과잉이고 sound 는 기록 0 이다 — 지금 상태를 테스트가 증언한다.
    expect(cov.recognize.designed, 'recognize 과잉이 해소되면 이 기대를 갱신하라').toBeGreaterThanOrEqual(8)
    // Sound 면의 기록 경로는 2개다:
    //   · Dictation — 타깃 단어를 받아 적는다(인출). FSRS 카드를 움직인다.
    //   · Echo — 문장을 따라 말한다(발화 모방). 면 이력만 남기고 **복습 간격은 안 움직인다**
    //     (화면에 문장이 떠 있으므로 인출이 아니다 — lib/echo/word-signal.ts).
    // 설계안 §8 이 "청각 처방 불가" 의 원인으로 지목한 'Echo 가 FSRS 밖' 이 이것으로 해소됐다.
    expect(cov.sound.recording, '청각 면 기록 활동 수가 바뀌면 근거와 함께 갱신하라').toBe(2)

    // Use(F5) 는 설계 3(ScriptQuiz · Dictation · word-customs) · 기록 2 이고
    // **그 차이가 ScriptQuiz 하나다.**
    // ScriptQuiz 의 0행은 배선 누락이 아니라 남길 단어가 없어서다 — 문항 1,019+5 건
    // 어디에도 대상 단어가 없고 문항 자체가 서사 이해(줄거리·인물·동기)다. 줄거리 정답을
    // 그 문장에 든 단어의 인출로 세면 §9 가 금지한 승격이 된다(본문 이해는 `scores` 에 남는다).
    // 이 단언이 깨진다면 둘 중 하나다: ① 문항이 대상 단어를 갖게 됐다(그럼 진짜 해소다)
    // ② 누군가 추측을 기록으로 만들었다. **어느 쪽인지 확인하고** 근거와 함께 갱신하라.
    expect(cov.use.designed, 'Use 면 설계 활동 수').toBe(3)
    expect(cov.use.recording, 'ScriptQuiz 를 기록으로 올렸다면 대상 단어가 생겼는지 먼저 확인하라').toBe(2)
  })

  it('순수 생산 활동은 met 단계에 배치되지 않는다 (초기 부호화 보호)', () => {
    // 혼합 활동은 예외다 — ghost-race 는 인코스(재인)와 아웃코스(철자)를 학습자가 고르므로
    // 갓 만난 단어로도 플레이할 수 있다(인코스 쪽). 제약이 걸리는 것은 **재인 경로가 없는**
    // 활동이다: SpellForge · wordsmith-vigil · letter-forge 처럼 후보가 아예 없는 것들.
    // 보호 대상은 **생성형 인출**(spell · use)이다. fluency 는 이미 아는 것을 빠르게 쓰는
    // 면이라 새 부담을 얹지 않으므로 제약에 넣지 않는다(Nation 의 fluency development 는
    // 새 항목을 다루지 않는 strand 다).
    for (const a of ACTS) {
      const production = a.facets.filter((f) => f === 'spell' || f === 'use')
      if (production.length === 0) continue
      if (a.facets.includes('recognize')) continue // 혼합 — 재인 경로가 있다
      expect(a.stages, `${a.id}: 재인 경로 없는 생산 활동인데 met 단계에 배치돼 있다`).not.toContain('met')
    }
  })

  it('혼합 활동은 어느 면으로 들어가는지 처방이 정해야 한다', () => {
    // 면이 둘 이상이고 그중 재인과 생산이 섞인 활동은, 단계에 따라 **다른 얼굴**로 열려야 한다.
    // 그러지 않으면 갓 만난 단어에 아웃코스(타이핑)가 걸릴 수 있다.
    const mixed = ACTS.filter(
      (a) => a.facets.includes('recognize') && a.facets.some((f) => f === 'spell' || f === 'use'),
    )
    // 지금 해당하는 것: ghost-race(인코스/아웃코스) · glyph-tongue · silent-rule
    expect(mixed.length, '혼합 활동이 하나도 없다면 이 규칙은 불필요하다').toBeGreaterThan(0)
    for (const a of mixed) {
      expect(a.stages.length, `${a.id}: 혼합인데 단계가 하나뿐 — 얼굴을 나눌 수 없다`).toBeGreaterThan(1)
    }
  })
})

describe('흐름 — 막지 않고 권한다', () => {
  const base: WordFrameworkState = {
    word: 'bribe',
    passed: [],
    accuracy: {},
    hits: {},
    memory: 'new',
    encounters: 12,
  }

  it('아무것도 통과 안 한 단어에는 Recognize 를 권한다', () => {
    const adv = canAdvance(base)
    expect(adv?.facet).toBe('recognize')
    expect(adv?.to).toBe('recognized')
    expect(adv?.holdReason, '재인은 갓 만난 단어에도 권할 수 있다').toBeUndefined()
  })

  it('갓 만난 단어(new)에 생산 과제를 권하지 않는다 — 근거 있는 제약이다', () => {
    const adv = canAdvance({ ...base, passed: ['recognize'], memory: 'new', accuracy: { recognize: 0.9 } })
    expect(adv?.facet).toBe('spell')
    expect(adv?.holdReason, 'new 단어에 Spell 을 권하고 있다 (Barcroft 위반)').toBeTruthy()
  })

  it('흔들림 이상이면 생산 과제를 권한다', () => {
    const adv = canAdvance({ ...base, passed: ['recognize'], memory: 'shaky', accuracy: { recognize: 0.9 } })
    expect(adv?.facet).toBe('spell')
    expect(adv?.holdReason).toBeUndefined()
    expect(adv?.because, '왜 권하는지를 학습자 말로 설명해야 한다').toContain('못 쓰는')
  })

  it('앞 면이 흔들리면 다음 면을 얹지 않는다', () => {
    const adv = canAdvance({
      ...base,
      passed: ['recognize'],
      memory: 'stable',
      accuracy: { recognize: 0.5 },
    })
    expect(adv?.holdReason).toBeTruthy()
  })

  it('노출이 얕으면 새 면보다 만남을 먼저 권한다 (narrow reading)', () => {
    const adv = canAdvance({
      ...base,
      passed: ['recognize'],
      memory: 'stable',
      accuracy: { recognize: 0.9 },
      encounters: 3,
    })
    expect(adv?.holdReason, '노출 부족인데 다음 면을 권하고 있다').toContain('만난 횟수')
  })

  it('끝까지 간 단어에는 권할 것이 없다', () => {
    expect(canAdvance({ ...base, passed: ['recognize', 'spell', 'use', 'fluency'] })).toBeNull()
  })

  it('막는 이유가 있으면 항상 학습자 말로 설명한다 (자물쇠 UI 금지)', () => {
    const held = canAdvance({ ...base, passed: ['recognize'], memory: 'new', accuracy: { recognize: 0.9 } })
    expect(held?.holdReason).toBeTruthy()
    // "잠김" · "불가" 같은 차단 어휘를 쓰지 않는다
    expect(held!.holdReason!, '차단 어휘를 쓰고 있다').not.toMatch(/잠김|불가|금지|차단/)
  })
})

describe('흐름 — 이동을 알리는 자리', () => {
  it('네 자리만 있다 (다섯 번째가 생기면 처방 정본이 또 갈라진다)', () => {
    expect(Object.keys(HANDOFFS).sort()).toEqual(['chapter-end', 'session-end', 'today', 'vault-word'])
  })

  it('모든 자리가 행동 1개와 미루기를 준다 (강제하면 우회 대상이 된다)', () => {
    for (const [at, h] of Object.entries(HANDOFFS)) {
      expect(h.headline(3).trim().length, `${at}: 문구 없음`).toBeGreaterThan(0)
      expect(h.action('spell').trim().length, `${at}: 행동 없음`).toBeGreaterThan(0)
      // vault-word 는 단어 상세 안이라 미루기가 화면 자체(뒤로 가기)다
      if (at !== 'vault-word') {
        expect(h.defer.trim().length, `${at}: 미루기 없음`).toBeGreaterThan(0)
      }
    }
  })
})

describe('흐름 — 세션 구성 상수', () => {
  it('한 세션에 새 면을 하나만 들인다 (작업기억 4항목)', () => {
    expect(NEW_FACETS_PER_SESSION).toBe(1)
  })

  it('하루 목표가 개수로 닫힌다 (단어 수·XP 가 아니다)', () => {
    expect(DAILY_BLOCKS.min).toBeLessThanOrEqual(DAILY_BLOCKS.target)
    expect(DAILY_BLOCKS.target).toBeLessThanOrEqual(DAILY_BLOCKS.max)
    expect(DAILY_BLOCKS.max, '하루 5개를 넘기면 "언제 끝나는지" 가 닫히지 않는다').toBeLessThanOrEqual(5)
  })

  it('정답률 대역이 유지 임계보다 높다', () => {
    expect(ACCURACY_TARGET).toBeGreaterThan(ACCURACY_HOLD_BELOW)
    expect(ACCURACY_TARGET).toBeLessThan(1)
  })

  it('노출 하한이 문헌 범위(6~20) 안이다', () => {
    expect(ENCOUNTERS_FLOOR).toBeGreaterThanOrEqual(6)
    expect(ENCOUNTERS_FLOOR).toBeLessThanOrEqual(20)
  })

  it('Four Strands 배분 합이 1이다', () => {
    const sum = Object.values(STRAND_TARGET).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 5)
  })

  it('output strand 를 담는 활동이 있다 (없으면 배분 지표가 항상 0이다)', () => {
    const output = ACTS.filter((a) => a.strand === 'output')
    expect(output.length, 'meaning-focused output 활동이 하나도 없다').toBeGreaterThan(0)
  })
})

// ── 라우트 선언 ↔ 풀스크린 판정 (드리프트 차단) ────────────────────
//
// 판정 목록은 `lib/layout/full-screen-routes` 에 손으로 있다 — 레지스트리를 레이아웃에서
// import 하면 `GAME_MARKS`(ReactNode)가 전 화면 번들에 딸려 오기 때문이다.
// 손으로 둔 대가는 드리프트이고, 그것을 여기서 막는다. 활동을 추가하고 목록을 안 고치면
// 이 테스트가 먼저 빨개진다 — 예전처럼 `endsWith('/play')` 가 조용히 삼키지 않는다.
describe('풀스크린 라우트 — 레지스트리 선언과 일치한다', () => {
  it('레지스트리의 fullScreen 활동 경로 = 레이아웃 목록', () => {
    expect(FULL_SCREEN_ACTIVITY_ROUTES).toEqual(fullScreenActivityPaths())
  })

  it('선언된 경로는 전부 풀스크린으로 판정된다', () => {
    for (const p of fullScreenActivityPaths()) {
      expect(isFullScreenRoute(p), `${p} 가 풀스크린으로 안 잡힌다`).toBe(true)
    }
  })

  it('모양만 비슷한 경로는 삼키지 않는다 (예전 패턴 판정의 결함)', () => {
    // `endsWith('/play')` 시절에는 이런 라우트가 생기는 순간 조용히 풀스크린이 됐다.
    expect(isFullScreenRoute('/notes/play')).toBe(false)
    expect(isFullScreenRoute('/play')).toBe(false)
    expect(isFullScreenRoute('/play/unknown-game')).toBe(false)
  })

  it('셸을 유지하기로 선언한 활동은 풀스크린이 아니다', () => {
    // Echo 는 워크스페이스 안에서 열린다(registry: fullScreen false).
    expect(isFullScreenRoute('/text/abc-123/echo')).toBe(false)
    expect(isFullScreenRoute('/dictate/setup')).toBe(false)
    expect(isFullScreenRoute('/dictate/results')).toBe(false)
  })

  it('후행 슬래시는 같은 라우트다', () => {
    expect(isFullScreenRoute('/play/cascade/')).toBe(true)
  })

  it('빈 값은 풀스크린이 아니다', () => {
    expect(isFullScreenRoute(null)).toBe(false)
    expect(isFullScreenRoute(undefined)).toBe(false)
    expect(isFullScreenRoute('')).toBe(false)
  })
})
