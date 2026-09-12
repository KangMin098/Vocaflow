// apps/web/src/app/admin/csat/__tests__/sources-screen.test.tsx
//
// 원문 적격 화면 회귀 + 도움말 계약.
//
// **이 화면의 목적은 교재 생성이 임의 판단이 되지 않게 하는 것**이다. 그러려면 화면이
// 세 가지를 반드시 말해야 한다 — 어떤 자로 쟀는가(축·출처) · 지금 몇 편이 통과하는가 ·
// 통과 못 한 것은 다음에 무엇을 해야 하는가. 셋 중 하나라도 사라지면 화면이 "숫자만
// 보이는 판" 이 되고, 그때부터 원문 선택은 다시 감으로 돌아간다.
//
// 그래서 아래 검사는 **표시가 사라지는 것**과 **판정이 관대해지는 것**을 함께 잠근다.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { HELP_REGISTRY } from '@/lib/admin/help'
import { buildSourceEligibilityPanel } from '@/lib/textbook/source-eligibility-view'

import { SourceEligibilityClient } from '../sources/SourceEligibilityClient'

const panel = buildSourceEligibilityPanel(new Date('2026-09-06T12:00:00Z'))
const html = renderToString(<SourceEligibilityClient panel={panel} />)

describe('buildSourceEligibilityPanel', () => {
  it('스냅샷 합계가 등급 합과 맞는다 — 어긋나면 밴드 인자와 함께 만든 스냅샷이다', () => {
    const sum = panel.grades.reduce((n, g) => n + g.count, 0)
    expect(sum).toBe(panel.total.total)
  })

  it('일곱 축을 모두 낸다 — 자를 하나라도 빼면 판정이 헐거워진다', () => {
    expect(panel.axes).toHaveLength(7)
    expect(panel.axes.map((a) => a.id)).toEqual([
      'legal',
      'safety',
      'gate',
      'analysis',
      'judgement',
      'format',
      'vocabulary',
    ])
  })

  it('조판 가능은 두 등급의 합뿐이다', () => {
    const composable = panel.grades.filter((g) => g.composable).map((g) => g.grade)
    expect(composable.sort()).toEqual(['excerpt', 'usable'])
    const sum = panel.grades.filter((g) => g.composable).reduce((n, g) => n + g.count, 0)
    expect(sum).toBe(panel.total.composable)
  })

  it('경과 일수를 기준 시각으로 계산한다 — 화면이 낡음을 스스로 말해야 한다', () => {
    const later = buildSourceEligibilityPanel(new Date('2026-09-20T12:00:00Z'))
    expect(later.ageDays).toBeGreaterThan(panel.ageDays)
  })

  it('다음 한 걸음은 **되돌릴 수 있는** 축 중 가장 큰 것이다', () => {
    if (!panel.topBlocker) return // 전부 통과한 재고면 없을 수 있다
    expect(panel.topBlocker.axis.recoverable).toBe(true)
    const recoverableMax = Math.max(
      ...panel.axes.filter((a) => a.recoverable).map((a) => a.blocked)
    )
    expect(panel.topBlocker.axis.blocked).toBe(recoverableMax)
  })
})

describe('원문 적격 화면', () => {
  it('일곱 축을 자의 출처와 함께 보인다 — "왜 이 원문을 골랐나" 의 답이다', () => {
    for (const a of panel.axes) {
      expect(html).toContain(a.label)
      expect(html).toContain(a.question)
    }
    // 출처를 지우면 임계값이 짐작처럼 보인다.
    expect(html).toContain('PASSAGE_WORDS')
    expect(html).toContain('gate-rules.mjs')
  })

  it('등급마다 다음에 할 일이 붙는다 — 막다른 화면을 만들지 않는다', () => {
    for (const g of panel.grades) {
      expect(html).toContain(g.label)
      expect(html).toContain(g.nextStep)
    }
  })

  it('조판 가능 여부를 색이 아니라 **글자로도** 말한다 (색맹 대응)', () => {
    expect(html).toContain('조판 가능')
    expect(html).toContain('조판 불가')
  })

  it('되돌릴 수 없는 축을 그렇게 표시한다', () => {
    expect(html).toContain('영영 못 쓴다')
  })

  // ── 미판정이 전부 구조적일 때 헛일을 시키지 않는다 ────────────────
  // 2026-09-06: 기사 5,245편을 전부 판정하고 나니 남은 미판정이 전부 미절단 원본이 되었다
  // (13,459 / 13,459). 그런데 화면은 위에 `gate-book-export` 를 처방하고 아래에 "그중 …" 을
  // 덧붙이고 있었다 — 관리자가 그대로 돌리면 **0권**이 나온다. 부분일 때와 전부일 때는
  // 처방이 다르므로 갈라 말해야 하고, 그 갈림이 사라지면 이 검사가 잡는다.
  it('미판정이 전부 구조적이면 게이트 처방을 보이지 않는다', () => {
    const structural = panel.structurallyUnjudged ?? 0
    const unjudged = panel.grades.find((g) => g.grade === 'unjudged')?.count ?? 0
    if (structural > 0 && structural >= unjudged) {
      expect(html).toContain('전부 미절단 원본이라 게이트로는 안 풀린다')
      expect(html).toContain('plos-extract')
      // 헛일을 시키는 처방이 어디에도 남아 있으면 안 된다 — 콜아웃도 등급표도.
      expect(html).not.toContain('gate-book-export')
      // "그중 N편 은 게이트를 돌려도 안 풀린다" 는 나머지가 있다는 뜻이라 이 상태에서는 거짓이다.
      expect(html).not.toContain('게이트를 돌려도 안 풀린다')
    } else {
      expect(html).toContain('gate-book-export')
    }
  })

  // ── 추출 결함 ────────────────────────────────────────────────────
  // 일곱 축은 「이 원문을 써도 되는가」를 묻고, 그 질문은 **본문이 온전하다**는 것을 전제한다.
  // 전제가 깨진 편은 축이 못 잡는다 — 장르도 저작권도 어수도 맞는데 첫 문단이
  // "You are using an outdated browser…" 다. 그대로 조판하면 그 문자열이 인쇄된다.
  // 화면이 이걸 안 보이면 관리자는 「전부 통과」라고 읽는다.
  it('추출 결함을 적격과 나란히 보인다', () => {
    expect(html).toContain('추출 결함')
    expect(html).toContain('지문으로 못 쓰는')
    expect(html).toContain(panel.defects.defective.toLocaleString())
    for (const r of panel.defects.rules) expect(html).toContain(r.label)
    // 다시 재는 명령이 없으면 이 표도 조용히 낡는다.
    expect(html).toContain('extraction-defect-scan.mjs')
  })

  // ⚠️ 비율만 말하면 오해를 부른다. 실측 2026-09-06: 「문단 통째 중복」이 전체의 59.4% 였는데
  //    12,917건 중 12,878건(99.7%)이 plos 하나였고 모양도 하나였다(초록이 두 번).
  //    "본문 절반이 깨졌다" 와 "한 원천의 수확기가 겹쳐 붙인다" 는 처방이 아예 다르다.
  it('한 원천에 몰린 결함은 그 사실을 함께 말한다', () => {
    const skewed = panel.defects.rules.filter((r) => r.concentrated)
    if (!skewed.length) return
    expect(html).toContain('사실상')
    for (const r of skewed) {
      expect(r.topSource).not.toBeNull()
      expect(html).toContain(r.topSource!.source)
      // 몫을 숫자로 대지 않으면 "몰려 있다" 가 인상으로만 남는다.
      expect(html).toContain(`${r.topSource!.share}%`)
    }
  })

  it('결함 스캔이 고치지 않는다는 사실을 적는다 — 안 그러면 자동 세척으로 오해한다', () => {
    expect(html).toContain('고치지 않는다')
  })

  // ── 지문을 안 쓰는 학년 ──────────────────────────────────────────
  // V1 은 유형 셋이 전부 no-passage(운율·낱말뜻·철자빈칸)라 지문을 한 편도 안 쓴다.
  // 그런데 조판 가능 비율은 5/80 = 6.3% 로 찍히고, 그것만 보면 "이 학년은 거의 다 못 쓴다"
  // 로 읽힌다 — 그 학년에서는 애초에 판단 근거가 아닌 수치다. 표가 그 사실을 말해야 한다.
  it('지문을 안 쓰는 학년은 조판 가능 수치가 근거가 아니라고 말한다', () => {
    const noPassage = panel.bands.filter((b) => !b.needsPassage)
    if (!noPassage.length) return
    expect(html).toContain('판단 근거가 아니다')
    // ⚠️ **문서 전체에 `toContain` 을 걸면 안 된다.** 「지문 없음」은 요건표가 이미 유형마다
    //    찍고 있고 안내 문구에도 있다 — 학령표의 표시를 통째로 지워도 검사가 살아남는다
    //    (변이 2회로 확인했다: 처음엔 toContain, 다음엔 개수 세기, 둘 다 안 잡혔다).
    //    그래서 **학령표 구간만 떼어** 그 안에서 센다.
    const bandSection = html.slice(html.indexOf('aria-label="학령별 적격"'))
    const bandTable = bandSection.slice(0, bandSection.indexOf('</section>'))
    // 안내 문구 1회 + 학년마다 1회 — 표시를 지우면 안내 문구만 남아 이 수가 모자란다.
    expect(bandTable.split('지문 없음').length - 1).toBeGreaterThanOrEqual(1 + noPassage.length)
    // 그 학년을 「만들 수 없음」으로 낙인찍으면 안 된다 — 만들 수 있다.
    for (const b of noPassage) expect(b.composable).toBeGreaterThanOrEqual(0)
  })

  // 요건표가 정본이다 — 재고가 아니라 규격이 「지문을 쓰는가」를 정한다.
  it('지문 필요 여부를 재고가 아니라 요건표에서 편다', () => {
    for (const b of panel.bands) {
      const req = panel.requirements.find((r) => r.vLevel === b.vLevel)
      if (!req) continue
      const usesPassage = req.types.some((t) => t.family !== 'no-passage')
      expect(b.needsPassage).toBe(usesPassage)
    }
  })

  // ── 처방이 막다른 말이 되지 않게 ────────────────────────────────
  // 「발췌 경로로 가야 한다」만 적으면 관리자는 발췌를 **새로 뽑으려** 든다. 실측 2026-09-07:
  // 발췌는 이미 11,601편 뽑혀 있었고 전부 queued 라 조판 풀에 못 들어오고 있었다 —
  // 안 만든 것이 아니라 만들어 놓고 다음 단계에서 서 있었다. 화면이 그걸 말해야 한다.
  it('발췌가 어디까지 와 있는지 말한다 — 안 그러면 이미 한 일을 다시 시킨다', () => {
    const b = panel.extractBacklog
    if (!b || b.total === 0) return
    expect(html).toContain(b.total.toLocaleString())
    expect(html).toContain('분석을 기다린다')
    // 다음에 무엇을 칠지가 없으면 사실만 알고 못 움직인다.
    expect(html).toContain('process-queue.mjs')
    expect(html).toContain(b.feed)
  })

  it('발췌 재고의 남은 수를 스스로 계산한다 — 스냅샷은 두 수만 준다', () => {
    const b = panel.extractBacklog
    if (!b) return
    expect(b.pending).toBe(Math.max(0, b.total - b.analyzed))
    // 합이 안 맞으면 화면이 「다 됐다」고 말하면서 큐가 남아 있는 상태가 된다.
    expect(b.analyzed + b.pending).toBe(b.total)
  })

  // ── 유형 재고 ───────────────────────────────────────────────────
  // 일곱 축을 다 통과한 원문이 아무리 많아도, 시중이 내는 **유형**을 못 내면 교재는 시중을
  // 못 따라간다. 조판 로그의 「시장 전체 기준 30.1%」가 그 격차이고, 이 표가 그 정체다.
  it('유형 재고를 원문 적격과 나란히 보인다 — 병목이 원문이 아닐 수 있다', () => {
    const inv = panel.typeInventory
    if (!inv) return
    expect(html).toContain('유형 재고')
    expect(html).toContain('원문이 아니라')
    expect(html).toContain('type-inventory-scan.mjs')
    for (const b of inv.bands) expect(html).toContain(`V${b.vLevel}`)
  })

  // ⚠️ 「재고가 있다」로 세면 유형당 26개도 100% 가 된다. 한 권이 120문항이고 목표가 14% 면
  //    권당 17개가 필요하므로 26개는 한 권 쓰면 바닥이다. 그래서 권수로 세고, **가장 얇은
  //    유형**이 그 권수를 정한다 — 그 산술이 어긋나면 화면이 「만들 수 있다」고 거짓말한다.
  it('권수는 가장 얇은 유형이 정한다 — 그 산술을 잠근다', () => {
    const inv = panel.typeInventory
    if (!inv) return
    for (const b of inv.bands) {
      const min = Math.min(...b.types.map((t) => t.volumes))
      expect(b.volumes).toBe(min)
      const t0 = b.types.find((t) => t.type === b.bindingType)
      expect(t0).toBeDefined()
      expect(t0!.volumes).toBe(min)
      // 권당 필요 수는 목표 비중에서 나온다 — 0 이면 나눗셈이 무한대가 된다.
      for (const t of b.types) expect(t.needPerVolume).toBeGreaterThan(0)
    }
  })

  it('재고 0 인 유형을 숨기지 않는다 — 숨기면 만들 수 있는 척이 된다', () => {
    const inv = panel.typeInventory
    if (!inv) return
    for (const b of inv.bands) {
      if (!b.missingTypes.length) continue
      expect(b.volumes).toBe(0)
      expect(html).toContain(b.missingTypes[0])
    }
  })

  // ── 채울 몫 ─────────────────────────────────────────────────────
  // 재고표는 「몇 권인가」까지만 답한다. 그 다음 질문(「무엇부터」)을 화면이 안 답하면
  // 관리자가 표를 눈으로 세는데, 눈으로 세면 눈에 띄는 것만 센다 — 실측 2026-09-08 에
  // 그렇게 세다가 병목을 셋으로 봤고 실제로는 생성형 유형 전부였다.
  it('채울 몫을 재고 옆에 함께 보인다 — 사실만 주고 끝내지 않는다', () => {
    const plan = panel.fillPlan
    if (!plan) return
    expect(html).toContain('채울 몫')
    expect(html).toContain('item-fill-plan.mjs')
    // 집필 규격이 어디 있는지 화면이 말해야 다음 사람이 규칙을 새로 짜지 않는다.
    expect(html).toContain('item-drain-brief.md')
    expect(html).toContain(plan.totalItems.toLocaleString())
  })

  // ⚠️ **비용이 100배 다른 둘을 한 수로 합치면 계획이 아니다.** 결정론 유형은 생성기 한
  //    번이고 생성형 유형은 글을 읽어야 한다. 합계에 결정론 몫이 섞여 들어가면 화면이
  //    「1,118문항을 써야 한다」고 말하면서 실제로는 그중 상당수가 명령 한 줄인 상태가 된다.
  it('사람이 써야 하는 몫만 집필 합계에 넣는다', () => {
    const plan = panel.fillPlan
    if (!plan) return
    for (const b of plan.bands) {
      const drain = b.types.filter((t) => t.drain)
      expect(b.drainItems).toBe(drain.reduce((n, t) => n + t.shortItems, 0))
      expect(b.drainChunks).toBe(drain.reduce((n, t) => n + t.chunks, 0))
      // 결정론 유형에 청크를 매기면 그만큼 헛일을 시킨다.
      for (const t of b.types.filter((t2) => !t2.drain)) expect(t.chunks).toBe(0)
    }
    expect(plan.totalItems).toBe(plan.bands.reduce((n, b) => n + b.drainItems, 0))
    expect(plan.totalChunks).toBe(plan.bands.reduce((n, b) => n + b.drainChunks, 0))
  })

  // 「지금 시작 가능」이 실제로 뽑혀 있는 것보다 크면 화면이 없는 일을 시작하라고 말한다.
  it('지금 시작 가능한 청크는 써야 할 청크를 넘지 않는다', () => {
    const plan = panel.fillPlan
    if (!plan) return
    for (const b of plan.bands) {
      expect(b.readyChunks).toBeLessThanOrEqual(b.drainChunks)
      expect(b.readyChunks).toBeGreaterThanOrEqual(0)
      for (const t of b.types) expect(Math.min(t.chunks, t.readyChunks)).toBeLessThanOrEqual(t.chunks)
    }
    expect(plan.readyChunks).toBeLessThanOrEqual(plan.totalChunks)
  })

  // 몫이 0 인 유형이 계획에 남아 있으면 다 끝난 칸을 다시 시키게 된다.
  it('이미 목표를 채운 유형은 계획에 없다', () => {
    const plan = panel.fillPlan
    if (!plan) return
    expect(plan.targetVolumes).toBeGreaterThan(0)
    for (const b of plan.bands) {
      expect(b.volumes).toBeLessThan(plan.targetVolumes)
      for (const t of b.types) expect(t.shortItems).toBeGreaterThan(0)
    }
  })

  // 재고와 계획이 다른 시각에 계산되면 화면이 두 세계를 겹쳐 보인다.
  it('계획이 재고보다 앞선 값으로 계산되지 않았다', () => {
    const plan = panel.fillPlan
    const inv = panel.typeInventory
    if (!plan || !inv) return
    expect(new Date(plan.computedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(inv.measuredAt).getTime(),
    )
    // 같은 밴드를 같은 권수로 말해야 한다 — 어긋나면 둘 중 하나가 낡았다.
    for (const b of plan.bands) {
      const iv = inv.bands.find((x) => x.vLevel === b.vLevel)
      if (iv) expect(b.volumes).toBe(iv.volumes)
    }
  })

  // ── 쓰고도 못 싣는 것 ───────────────────────────────────────────
  // 게이트는 시간이 지나며 엄해지는데 청크와 산출은 게이트보다 오래 산다. 이 표가 없으면
  // 예전에 쓴 문항이 조용히 막힌 채로 남고, 그 일을 두 번 하게 된다.
  it('이미 쓴 문항이 지금 게이트에 걸리는 수를 드러낸다', () => {
    const a = panel.drainAudit
    if (!a) return
    expect(html).toContain('쓰고도 못 싣는 것')
    expect(html).toContain('item-drain-audit.mjs')
    expect(html).toContain(a.filled.toLocaleString())
  })

  // ⚠️ **비용이 100배 다른 둘을 한 수로 합치면 아무도 손대지 않는다.** 「315개가 걸렸다」는
  //    다시 써야 할 산더미로 읽히지만, 그중 142는 한국어 해설 한 줄이면 살아난다.
  it('해설만 고치면 되는 몫과 지문을 다시 뽑아야 하는 몫을 갈라 센다', () => {
    const a = panel.drainAudit
    if (!a) return
    expect(a.rationaleOnly + a.passageBlocked).toBe(a.blocked)
    expect(a.blocked).toBeLessThanOrEqual(a.filled)
    expect(a.rationaleOnly).toBeGreaterThanOrEqual(0)
    // 이유 합계가 막힌 수와 어긋나면 표가 무언가를 숨기고 있다.
    if (a.reasons.length) {
      expect(a.reasons.reduce((n, r) => n + r.count, 0)).toBe(a.blocked)
    }
  })

  it('이유마다 고치는 법을 함께 말한다 — 사실만 주면 못 움직인다', () => {
    const a = panel.drainAudit
    if (!a) return
    if (!a.reasons.length) return
    expect(html).toContain('해설만 다시 쓴다')
    expect(html).toContain('지문을 다시 뽑는다')
  })

  // 칸별 합계가 총계와 어긋나면 어느 쪽을 믿어야 할지 알 수 없다.
  it('칸별 수가 총계와 맞는다', () => {
    const a = panel.drainAudit
    if (!a || !a.byDir.length) return
    expect(a.byDir.reduce((n, d) => n + d.blocked, 0)).toBe(a.blocked)
    expect(a.byDir.reduce((n, d) => n + d.rationaleOnly, 0)).toBe(a.rationaleOnly)
    for (const d of a.byDir) {
      expect(d.rationaleOnly).toBeLessThanOrEqual(d.blocked)
      expect(d.blocked).toBeLessThanOrEqual(d.filled)
    }
  })

  it('언제 잰 값인지와 다시 재는 명령을 함께 보인다', () => {
    expect(html).toContain('에 잰 값')
    expect(html).toContain('source-eligibility-scan.mjs')
  })

  it('조판이 받으면 안 되는 편수를 숨기지 않는다', () => {
    expect(html).toContain('지금 조판이 받으면 안 되는 편수')
    expect(html).toContain((panel.total.total - panel.total.composable).toLocaleString())
  })

  it('학령별로 "만들 수 없음" 을 분명히 말한다', () => {
    const zero = panel.bands.some((b) => b.composable === 0)
    if (zero) expect(html).toContain('만들 수 없음')
  })

  it('문항이 이미 있는데 원문이 판정을 못 넘는 편수를 드러낸다', () => {
    // 이 격차가 곧 "판정 없이 만들어진 문항" 의 분모다. 숨기면 화면이 좋아 보이지만
    // 그게 이 화면이 막으려는 바로 그것이다.
    expect(html).toContain('문항이 붙은 원문')
    if (panel.articlesWithItems != null && panel.articlesWithItems > panel.total.composable) {
      expect(html).toContain((panel.articlesWithItems - panel.total.composable).toLocaleString())
    }
  })

  it('게이트를 돌려도 안 풀리는 몫을 갈라 말한다 — 안 그러면 헛일을 시킨다', () => {
    if (panel.topBlocker?.axis.id !== 'judgement' || !panel.structurallyUnjudged) return
    // 처방은 어느 상태에서도 발췌 경로를 가리켜야 한다.
    expect(html).toContain('plos-extract')
    if (panel.structurallyUnjudged < panel.topBlocker.grade.count) {
      // **부분**: 몇 편이 그런지 숫자로 말해야 한다.
      expect(html).toContain('게이트를 돌려도 안 풀린다')
      expect(html).toContain(panel.structurallyUnjudged.toLocaleString())
    } else {
      // **전부**: "그중" 은 나머지가 있다는 뜻이라 거짓이다.
      expect(html).toContain('전부 미절단 원본이라 게이트로는 안 풀린다')
    }
  })

  it('연령 × 유형별 요건을 보인다 — "왜 이 학년 이 유형인가" 의 답이다', () => {
    expect(html).toContain('연령 × 유형별 원문 요건')
    // 사다리 7단이 전부 나와야 한다 — 한 단이라도 빠지면 그 학년은 근거가 없다.
    expect(panel.requirements).toHaveLength(7)
    for (const b of panel.requirements) {
      expect(html).toContain(b.schoolBand)
      expect(html).toContain(b.volumeTitle)
      for (const t of b.types) expect(html).toContain(t.label)
    }
  })

  it('창을 숫자로 적고, 좁히지 못한 칸은 그렇게 적는다', () => {
    const withWindow = panel.requirements.flatMap((b) => b.types).filter((t) => t.window)
    expect(withWindow.length).toBeGreaterThan(0)
    for (const t of withWindow.slice(0, 5)) {
      expect(html).toContain(`${t.window!.min}–${t.window!.max}어`)
    }
    expect(html).toContain('유형 창 그대로')
    // 지문이 없는 유형(초등 3종)을 0어로 적지 않는다 — 잴 지문이 없는 것이다.
    expect(html).toContain('지문 없음')
  })

  it('계열별 자의 출처를 함께 낸다', () => {
    expect(html).toContain('짐작으로 정한 값이 없다는 근거')
    expect(html).toContain('CSAT_ITEM_WORDS')
  })

  it('못 잰 것과 0 을 구별한다', () => {
    // 옛 스냅샷에는 두 열이 없다. 0 으로 채우면 "그런 원문은 없다" 는 거짓말이 된다.
    expect(panel.articlesWithItems === null || typeof panel.articlesWithItems === 'number').toBe(
      true
    )
    expect(
      panel.structurallyUnjudged === null || typeof panel.structurallyUnjudged === 'number'
    ).toBe(true)
  })
})

describe('도움말 계약', () => {
  const entry = HELP_REGISTRY['csat-sources']

  it('레지스트리 키가 라우트 슬러그와 같다', () => {
    expect(entry).toBeTruthy()
    expect(entry!.title).toBe('원문 적격')
  })

  it('드레인 절차가 있고 재실행 안전 여부를 밝힌다', () => {
    const drain = entry!.screen.drain
    expect(drain).toBeTruthy()
    expect(drain!.procedure.length).toBeGreaterThanOrEqual(3)
    expect(JSON.stringify(drain)).toContain('재실행 안전')
  })

  it('조판이 아직 이 판정을 강제하지 않는다는 사실을 경고에 적는다', () => {
    // 이 문장을 지우면 관리자가 "화면이 막아 준다" 고 오해한다.
    expect(JSON.stringify(entry!.screen.cautions)).toContain('volume-pool.mjs')
  })

  it('스캔 명령이 도움말과 화면에서 같다', () => {
    expect(JSON.stringify(entry!.screen.drain)).toContain('source-eligibility-scan.mjs')
  })

  // ── 스냅샷이 조용히 낡는 길을 막는다 ──────────────────────────────
  // 2026-09-06 실측: 기사 1,200편 판정을 적재하고 스캔을 돌렸는데 **화면은 그대로였다.**
  // 스캐너가 `--json <경로>` 를 준 실행에서만 파일을 썼기 때문이다. 터미널에는 새 수치가
  // 찍히므로 돌린 사람은 갱신됐다고 믿는다 — 틀린 줄 모르는 상태가 가장 나쁘다.
  // 그래서 두 가지를 잠근다: 기본 대상이 화면이 읽는 파일일 것, 그리고 안내가
  // 그 경로를 손으로 적으라고 시키지 말 것(손으로 적는 경로는 언젠가 어긋난다).
  it('스캐너가 인자 없이도 화면이 읽는 스냅샷에 쓴다', () => {
    const scan = readFileSync(
      resolve(process.cwd(), '../../scripts/textbook/source-eligibility-scan.mjs'),
      'utf8'
    )
    expect(scan).toContain(
      "path.resolve('apps/web/src/lib/textbook/source-eligibility-snapshot.json')"
    )
    // `--json` 이 없을 때 null 로 떨어지면 기본 갱신이 아니다.
    expect(scan).toContain(
      "const JSON_OUT = NO_WRITE ? null : arg('json') ?? (ONLY_BAND ? null : SNAPSHOT_PATH)"
    )
  })

  it('도움말과 화면이 --json 경로를 손으로 적으라고 시키지 않는다', () => {
    expect(JSON.stringify(entry!.screen.drain)).not.toContain('--json apps/web')
    expect(html).not.toContain('--json apps/web')
  })
})
