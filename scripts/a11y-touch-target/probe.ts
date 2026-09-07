// scripts/a11y-touch-target/probe.ts
//
// 터치 타겟 프로브 — 학습자 화면의 44px 미만 인터랙티브 요소를 찾는다.
//
// CLAUDE.md "절대 하지 않을 것 · 접근성": 44px 미만 터치 타겟.
// 11회차에서 /text/new 추출 카드의 몰라요·알아요(28px) · 체크박스(16px) ·
// 펼침(22px)이 전부 위반이었다. 같은 패턴이 다른 학습 화면에 반복돼 있는지
// 눈대중이 아니라 전수로 본다.
//
// 사용:
//   npx tsx scripts/a11y-touch-target/probe.ts
//   npx tsx scripts/a11y-touch-target/probe.ts --all      # 파일별 상세
//
// ⚠️ 휴리스틱이다. Tailwind 클래스 문자열로 최소 높이를 추정하므로:
//   · 정밀도를 위해 **명시적 높이 신호가 있는 것만** 판정한다 (h-N · min-h-[Npx] · py-N).
//   · 부모가 크기를 주는 경우(예: grid cell 전체가 버튼)는 잡지 못한다 — 과소 보고.
//   · 게임 HUD 처럼 44px 가 레이아웃을 깨는 곳이 있다. 목록은 "확인 대상"이지 "결함 확정"이 아니다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const SRC = resolve(__dirname, '../../apps/web/src')

/** 학습자 화면만 — admin 은 별도 기준(밀도 우선 콘솔)이라 제외 */
function isLearnerFile(p: string): boolean {
  const rel = relative(SRC, p).replace(/\\/g, '/')
  if (!rel.endsWith('.tsx')) return false
  if (rel.includes('/admin/') || rel.startsWith('admin/')) return false
  if (rel.includes('/__tests__/')) return false
  return rel.startsWith('app/(main)/') || rel.startsWith('components/')
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (isLearnerFile(p)) out.push(p)
  }
  return out
}

// 추정 로직은 apps/web/src/lib/a11y/touch-target.ts 로 옮겼다 —
// 오탐·과소보고 특성을 vitest 회귀로 못박기 위해서다(CI 가 지킨다).
// 여기서 다시 구현하면 그 보증을 잃는다.
import { estimateHeight, MIN_TOUCH_PX } from '../../apps/web/src/lib/a11y/touch-target'

interface Hit {
  file: string
  line: number
  px: number
  via: string
  tag: string
  snippet: string
}

/** <button …> / <input type="checkbox|radio" …> 블록을 뽑아 className 을 본다. */
function scanFile(path: string): Hit[] {
  const src = readFileSync(path, 'utf8')
  const lines = src.split('\n')
  const hits: Hit[] = []
  const re = /<(button|input)\b([\s\S]{0,900}?)\/?>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const tag = m[1]!
    const body = m[2]!
    if (tag === 'input' && !/type=["'](?:checkbox|radio)["']/.test(body)) continue
    const cls = body.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/)
    const clsStr = cls ? (cls[1] ?? cls[2] ?? '') : ''
    if (!clsStr) continue
    const est = estimateHeight(clsStr)
    if (!est || est.px >= MIN_TOUCH_PX) continue
    // 부모 래퍼가 히트 영역을 주는 경우 제외 — 체크박스를 44px label 로 감싸는 것은
    // 정상 패턴이다(요소 자체는 20px 이어도 누를 수 있는 면적은 44px).
    // 프로브가 자기 오탐을 낸 자리다: ExtractionPanel 의 label 로 감싼 체크박스.
    const before = src.slice(Math.max(0, m.index - 240), m.index)
    if (/min-h-\[44px\][\s\S]*$/.test(before) && /<label\b/.test(before)) continue
    const line = src.slice(0, m.index).split('\n').length
    hits.push({
      file: relative(SRC, path).replace(/\\/g, '/'),
      line,
      px: est.px,
      via: est.via,
      tag,
      snippet: (lines[line - 1] ?? '').trim().slice(0, 60),
    })
  }
  return hits
}

function main() {
  const showAll = process.argv.includes('--all')
  const files = walk(SRC)
  const hits = files.flatMap(scanFile).sort((a, b) => a.px - b.px || a.file.localeCompare(b.file))

  const byFile = new Map<string, Hit[]>()
  for (const h of hits) {
    if (!byFile.has(h.file)) byFile.set(h.file, [])
    byFile.get(h.file)!.push(h)
  }

  console.log(`\n학습자 화면 ${files.length}개 스캔 → 44px 미만 추정 ${hits.length}건 / ${byFile.size}개 파일\n`)
  console.log(`  ⚠ 휴리스틱이다. 명시적 높이 신호가 있는 것만 판정하므로 **과소 보고**이고,`)
  console.log(`     게임 HUD 처럼 44px 가 레이아웃을 깨는 자리도 섞여 있다. "확인 대상" 목록이다.\n`)

  const ranked = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)
  console.log('  건수  파일')
  console.log('  ' + '─'.repeat(66))
  for (const [file, list] of ranked.slice(0, showAll ? ranked.length : 20)) {
    const min = Math.min(...list.map((h) => h.px))
    console.log(`  ${String(list.length).padStart(4)}  ${file}  (최소 ${min}px)`)
  }
  if (!showAll && ranked.length > 20) console.log(`  … 외 ${ranked.length - 20}개 파일 (--all 로 전체)`)

  console.log(`\n  가장 작은 10건:`)
  for (const h of hits.slice(0, 10)) {
    console.log(`    ${String(h.px).padStart(3)}px  ${h.via.padEnd(14)} ${h.file}:${h.line}`)
  }
  console.log('')
}

main()
