// apps/web/src/components/admin/__tests__/touch-target.test.ts
//
// **44px 미만 터치 타깃 회귀 락** (CLAUDE.md 「절대 하지 않을 것 · 접근성」).
//
// 이 규칙은 오래 문장으로만 있었고, 그래서 지켜지지 않았다 — 2026-09-06 실측으로
// `app/admin/**` + `components/admin/**` 에서 스캔한 인터랙티브 요소 539 개 중
// **382 곳**이 44px 미만이었다 (통과 87 · 판정 불가 70). 지금은 12 — 아래 허용 목록의 체크박스뿐이다.
// 문장은 다시 낡으므로 여기서 **수치로** 못 박는다. 새 위반이 들어오면 이 파일이 실패한다.
//
// 판정 규칙과 그 보수성(오탐 금지 · 애매하면 undecidable)은 `touch-target-scan.ts` 머리말 참조.
//
// ⚠️ **이 테스트가 조용히 무력해지는 방식**이 하나 있다 — 파서가 깨져 요소를 하나도 못 찾으면
//    위반 0 으로 "통과" 한다. 그래서 아래 두 가지를 함께 단언한다:
//      ① 스캔한 인터랙티브 요소 수의 **하한** (파서가 죽으면 여기서 걸린다)
//      ② 판정기 자체의 **단위 테스트** (44px 미만을 실제로 위반이라 부르는지)

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { type Finding, judgeTag, scanAdmin } from './touch-target-scan'

const here = fileURLToPath(new URL('.', import.meta.url))
const WEB_SRC = resolve(here, '../../../')
const REPO_ROOT = resolve(here, '../../../../../../')

const findings = scanAdmin(WEB_SRC, REPO_ROOT)
const violations = findings.filter((f) => f.verdict === 'violation')
const undecidable = findings.filter((f) => f.verdict === 'undecidable')

const CHECKBOX = 'input[checkbox|radio]'

/**
 * 유일한 허용 목록 — `<input type="checkbox|radio">`.
 *
 * **이유**: 체크박스·라디오는 replaced element 라 `::before`/`::after` 가 렌더되지 않는다.
 * 그래서 이 저장소가 다른 곳에서 쓰는 "시각 크기는 두고 의사요소로 탭 영역만 44px 로
 * 넓히기" 수법이 **여기서만 통하지 않는다.** 남은 길은 둘 뿐인데 둘 다 이 패스의 범위 밖이다:
 *   (a) 입력 자체를 44px 로 — 체크박스가 44px 로 그려진다 (표 정렬이 무너지고 보기에도 틀렸다)
 *   (b) `<label>` 로 감싸 라벨을 타깃으로 — 마크업 구조 변경 (이 패스는 **스타일만** 담당)
 *
 * 실제로 한 일: **`<label>` 이 이미 감싸고 있던 8곳은 그 라벨을 `min-h-[44px]` 로 키웠다**
 * (탭 영역은 44px 이고 체크박스 그림만 작다). 라벨이 없는 4곳은 손대지 않았고, 각 자리에
 * 그 사실을 주석으로 남겼다. 아래 수는 **입력 요소 기준**이라 라벨을 고친 자리도 포함한다.
 *
 * 이 목록을 늘리려면 위 (a)/(b) 중 하나를 실제로 하거나, 왜 못 하는지를 여기에 적어야 한다.
 */
const CHECKBOX_ALLOWLIST: { file: string; count: number; labelWrapped: number }[] = [
  { file: 'apps/web/src/app/admin/articles/BulkArticlesTab.tsx', count: 3, labelWrapped: 2 },
  { file: 'apps/web/src/app/admin/comic/AdminComicClient.tsx', count: 1, labelWrapped: 0 },
  { file: 'apps/web/src/components/admin/curation/AdvancedFetchPanel.tsx', count: 1, labelWrapped: 1 },
  { file: 'apps/web/src/components/admin/curation/BulkFetchTab.tsx', count: 1, labelWrapped: 1 },
  { file: 'apps/web/src/components/admin/curation/MyLibraryTab.tsx', count: 2, labelWrapped: 0 },
  { file: 'apps/web/src/components/admin/vcb/VcbStep6QaCard.tsx', count: 1, labelWrapped: 1 },
  { file: 'apps/web/src/components/admin/vcb/VcbStep8PublishCard.tsx', count: 1, labelWrapped: 1 },
  { file: 'apps/web/src/components/admin/vcb/preview/VcbPreviewFilters.tsx', count: 1, labelWrapped: 1 },
  { file: 'apps/web/src/components/admin/vcb/studio/StudioClient.tsx', count: 1, labelWrapped: 1 },
]

/**
 * 판정 불가 상한. 줄어드는 것은 언제나 환영이고, **늘어나면 실패**한다.
 *
 * 판정 불가는 "괜찮다" 가 아니라 "이 스캐너로는 못 읽는다" 는 뜻이다. 지금 70건의 구성:
 *   · 55 — 높이 클래스가 아예 없다 (내용·부모가 높이를 정한다 → 정적으로 알 수 없음)
 *   ·  7 — `<input type=checkbox>` 에 className 자체가 없다
 *   ·  6 — className 이 런타임 값에 달렸고 정적 높이 토큰이 없다
 *   ·  2 — `h-full` 등 부모가 높이를 정한다
 * 상한을 둔 이유는, 새 코드가 "높이 클래스 없는 버튼" 으로 규칙을 우회하는 것을 막기 위해서다.
 */
const UNDECIDABLE_CAP = 70

/**
 * 스캔이 실제로 일어났다는 증거. 파서가 깨지면 위반도 0 이 되므로 이 하한이 없으면
 * 이 파일 전체가 조용히 통과한다. 2026-09-06 실측 539 — 여유를 두고 450.
 */
const MIN_SCANNED = 450

function describeFinding(f: Finding): string {
  return `${f.file}:${f.line} <${f.tag}> [${f.reason}]\n    ${f.excerpt}`
}

describe('스캔이 실제로 돌았다', () => {
  it('admin 인터랙티브 요소를 충분히 찾는다 (파서 사망 감지)', () => {
    expect(findings.length).toBeGreaterThanOrEqual(MIN_SCANNED)
  })

  it('판정기가 44px 미만을 위반이라 부른다', () => {
    expect(judgeTag('<button className="min-h-[36px] px-3">', 'button').verdict).toBe('violation')
    expect(judgeTag('<button className="h-8 px-3">', 'button').verdict).toBe('violation')
    expect(judgeTag('<button className="px-3 py-1">', 'button').verdict).toBe('violation')
    expect(judgeTag('<button className="px-s-3 py-s-2">', 'button').verdict).toBe('violation')
    expect(judgeTag('<button className={`rounded px-2 py-2 ${x}`}>', 'button').verdict).toBe('violation')
  })

  it('판정기가 44px 이상을 통과시킨다', () => {
    expect(judgeTag('<button className="min-h-[44px] px-3">', 'button').verdict).toBe('pass')
    expect(judgeTag('<button className="h-11 w-11">', 'button').verdict).toBe('pass')
    expect(judgeTag('<button className="min-h-11 px-3">', 'button').verdict).toBe('pass')
    expect(judgeTag('<button className="px-3 py-3">', 'button').verdict).toBe('pass')
    // 탭 영역만 넓힌 경우 — 시각 크기는 h-8 그대로다
    expect(judgeTag('<button className="relative h-8 w-8 after:absolute after:h-11 after:w-11">', 'button').verdict).toBe('pass')
  })

  it('오탐을 내지 않는다 — 알 수 없으면 undecidable', () => {
    expect(judgeTag('<button className="px-3 text-sm">', 'button').verdict).toBe('undecidable')
    expect(judgeTag('<button className={cls}>', 'button').verdict).toBe('undecidable')
    expect(judgeTag('<button className="h-full px-3">', 'button').verdict).toBe('undecidable')
  })
})

describe('44px 미만 터치 타깃 — 체크박스 외 0', () => {
  it('button · a · Link · select · text 입력에 위반이 없다', () => {
    const bad = violations.filter((f) => f.tag !== CHECKBOX)
    expect(bad.map(describeFinding).join('\n')).toBe('')
  })
})

describe('허용 목록 — 체크박스·라디오', () => {
  const actual = new Map<string, number>()
  for (const f of violations.filter((v) => v.tag === CHECKBOX)) {
    actual.set(f.file, (actual.get(f.file) ?? 0) + 1)
  }

  it('허용한 파일·건수와 정확히 일치한다 (새 체크박스도, 고친 체크박스도 여기 반영해야 한다)', () => {
    const expected = Object.fromEntries(CHECKBOX_ALLOWLIST.map((e) => [e.file, e.count]))
    expect(Object.fromEntries([...actual.entries()].sort())).toEqual(
      Object.fromEntries(Object.entries(expected).sort()),
    )
  })

  it('허용 목록 항목마다 <label> 로 탭 영역을 넓힌 수가 적혀 있다', () => {
    for (const entry of CHECKBOX_ALLOWLIST) {
      expect(entry.count).toBeGreaterThan(0)
      expect(entry.labelWrapped).toBeGreaterThanOrEqual(0)
      expect(entry.labelWrapped).toBeLessThanOrEqual(entry.count)
    }
    // 12곳 중 8곳은 감싼 <label> 이 44px 이라 실제 탭 영역은 이미 44px 다.
    const total = CHECKBOX_ALLOWLIST.reduce((n, e) => n + e.count, 0)
    const wrapped = CHECKBOX_ALLOWLIST.reduce((n, e) => n + e.labelWrapped, 0)
    expect([total, wrapped]).toEqual([12, 8])
  })
})

describe('판정 불가는 늘지 않는다', () => {
  it(`판정 불가 ≤ ${UNDECIDABLE_CAP}`, () => {
    if (undecidable.length > UNDECIDABLE_CAP) {
      throw new Error(
        `판정 불가 ${undecidable.length}건 > 상한 ${UNDECIDABLE_CAP}\n` +
          `높이를 정하는 클래스가 없는 인터랙티브 요소가 늘었다. 새 요소에 min-h-[44px] 를 주거나,\n` +
          `정말 판정할 수 없다면 이 상한과 그 이유를 함께 고칠 것.\n` +
          undecidable.map(describeFinding).join('\n'),
      )
    }
    expect(undecidable.length).toBeLessThanOrEqual(UNDECIDABLE_CAP)
  })
})
