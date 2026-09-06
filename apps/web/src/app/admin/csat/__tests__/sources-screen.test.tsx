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
