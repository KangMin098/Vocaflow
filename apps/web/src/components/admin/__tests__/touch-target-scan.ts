// apps/web/src/components/admin/__tests__/touch-target-scan.ts
//
// Admin 화면의 **44px 미만 터치 타깃** 스캐너.
//
// CLAUDE.md 「절대 하지 않을 것 · 접근성」 = "44px 미만 터치 타겟". 그 금지를 문장이 아니라
// **코드로 고정**한다. 정규식으로 JSX 를 완벽히 판정할 수는 없으므로 규칙은 하나다 —
// **오탐을 내지 않는다.** 애매하면 위반이 아니라 `undecidable` 로 센다.
//
// 판정 대상: <button> · <a> · <Link> · <select> · <input>(checkbox·radio·텍스트류)
//            · role="button" 이 붙은 임의 요소
//
// 판정 규칙 (className 에서 뽑을 수 있는 **정적 문자열 토큰**만 근거로 삼는다):
//   1. 44px 이상을 보장하는 토큰이 하나라도 있으면 PASS
//      (min-h-[44px]+ · h-11+ · size-11+ · py-3+ · p-3+ · min-h-[2.75rem]+ · 탭영역 확장 after:*)
//   2. 그렇지 않고 44px 미만을 **확정**하는 토큰이 있으면 VIOLATION
//      (min-h-[NNpx] where NN<44 · h-N where N<11 · h-[NNpx] where NN<44 · size-N where N<11)
//   3. 그렇지 않고 높이를 정하는 것이 py-N(N<=2) / p-N(N<=2) 뿐이면 VIOLATION
//   4. 그 외 (높이 클래스가 아예 없음 · 부모가 높이를 정함 · className 이 전부 동적) → UNDECIDABLE
//
// 이 저장소에 맞춰 둔 두 가지 — 없으면 규칙이 조용히 꺼진다:
//   · `s-N` spacing 스케일(tailwind.config.ts, N×4px) 을 기본 스케일과 같이 읽는다.
//     `py-s-2` 를 못 읽던 동안 `/admin/compose` 18곳이 "판정 불가" 로 빠져 있었다.
//   · 파일 최상단 클래스 상수(`const BTN = '...'`) 를 풀어서 읽는다. `className={BTN}` 하나가
//     화면 전체를 판정 불가로 만들었고, 실제로 그 상수들이 36px 였다.
//
// ⚠️ 시각적 크기와 탭 영역은 다를 수 있다. 표 안 촘촘한 아이콘 버튼은 높이를 키우면 행이
//    벌어지므로 `relative after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11
//    after:-translate-x-1/2 after:-translate-y-1/2` 로 **탭 영역만** 44px 로 넓힌다.
//    스캐너는 그 패턴을 PASS 로 인정한다 (§1 마지막 항목).
//    이 수법은 `<input type=checkbox>` 에는 **통하지 않는다** — replaced element 라
//    의사요소가 렌더되지 않는다. 그래서 체크박스만 회귀 테스트의 허용 목록에 남아 있다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export type Verdict = 'pass' | 'violation' | 'undecidable'

export interface Finding {
  file: string
  line: number
  tag: string
  verdict: Verdict
  /** 판정 근거가 된 토큰 (violation/pass 일 때) */
  reason: string
  /** 원문 발췌 (디버깅용, 앞 120자) */
  excerpt: string
}

/** Tailwind spacing scale 한 단위 = 4px */
const UNIT_PX = 4
/** 접근성 최소 터치 타깃 */
export const MIN_TOUCH_PX = 44

/**
 * 텍스트 한 줄(font-size 11~14px, leading-normal)의 대략 높이.
 * py-N 만으로 높이가 정해질 때 총 높이를 어림잡는 데 쓴다. 어림값이므로
 * 경계(py-3 = 24 + 20 = 44px)에서만 판정하고 그 사이는 건드리지 않는다.
 */
const LINE_PX = 20

// ── 스캔 대상 ────────────────────────────────────────────────────────────────

const INTERACTIVE_TAGS = new Set(['button', 'a', 'Link', 'select', 'input', 'textarea'])

/** 다른 세션이 진행 중이거나 스캔 의미가 없는 경로 */
const EXCLUDED_DIR_SEGMENTS = ['__tests__', 'node_modules']

export function listAdminSourceFiles(webSrcDir: string): string[] {
  const roots = [join(webSrcDir, 'app', 'admin'), join(webSrcDir, 'components', 'admin')]
  const out: string[] = []
  for (const root of roots) walk(root, out)
  return out.sort()
}

function walk(dir: string, out: string[]): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (EXCLUDED_DIR_SEGMENTS.includes(name)) continue
      walk(full, out)
      continue
    }
    if (name.endsWith('.tsx')) out.push(full)
  }
}

// ── JSX 여는 태그 추출 ───────────────────────────────────────────────────────

interface OpenTag {
  tag: string
  /** 여는 태그 전체 원문 (`<button ... >`) */
  raw: string
  index: number
}

/**
 * 소스에서 여는 태그를 뽑는다. 문자열·템플릿리터럴·중괄호 깊이를 추적하므로
 * `className={cn('a>b')}` 같은 것에 속지 않는다.
 */
export function extractOpenTags(source: string): OpenTag[] {
  const tags: OpenTag[] = []
  const re = /<([A-Za-z][A-Za-z0-9.]*)(?=[\s/>])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const tag = m[1]
    const end = findTagEnd(source, m.index + m[0].length)
    if (end < 0) continue
    tags.push({ tag, raw: source.slice(m.index, end + 1), index: m.index })
  }
  return tags
}

/** `<tag` 뒤 위치에서 시작해 여는 태그를 닫는 `>` 의 인덱스를 찾는다. */
function findTagEnd(src: string, from: number): number {
  let depth = 0
  let i = from
  while (i < src.length) {
    const c = src[i]
    if (c === '"' || c === "'") {
      i = skipQuoted(src, i, c)
      continue
    }
    if (c === '`') {
      i = skipTemplate(src, i)
      continue
    }
    if (c === '{') {
      depth += 1
      i += 1
      continue
    }
    if (c === '}') {
      depth -= 1
      i += 1
      continue
    }
    if (c === '>' && depth === 0) return i
    // 태그 안에서 새 태그가 시작되면(중괄호 밖) 파싱이 어긋난 것 — 포기
    if (c === '<' && depth === 0) return -1
    i += 1
  }
  return -1
}

function skipQuoted(src: string, start: number, quote: string): number {
  let i = start + 1
  while (i < src.length) {
    if (src[i] === '\\') {
      i += 2
      continue
    }
    if (src[i] === quote) return i + 1
    i += 1
  }
  return src.length
}

function skipTemplate(src: string, start: number): number {
  let i = start + 1
  while (i < src.length) {
    if (src[i] === '\\') {
      i += 2
      continue
    }
    if (src[i] === '`') return i + 1
    if (src[i] === '$' && src[i + 1] === '{') {
      let depth = 1
      i += 2
      while (i < src.length && depth > 0) {
        if (src[i] === '{') depth += 1
        else if (src[i] === '}') depth -= 1
        else if (src[i] === '"' || src[i] === "'") {
          i = skipQuoted(src, i, src[i]) - 1
        } else if (src[i] === '`') {
          i = skipTemplate(src, i) - 1
        }
        i += 1
      }
      continue
    }
    i += 1
  }
  return src.length
}

// ── className 토큰 수집 ──────────────────────────────────────────────────────

/**
 * 파일 최상단의 `const BTN = '...'` 같은 **클래스 상수**를 모은다.
 * 이 저장소는 표·툴바에서 `className={BTN}` 을 쓰므로, 이걸 못 풀면 그 화면 전체가
 * "판정 불가" 로 빠져 규칙이 사실상 꺼진다.
 */
export function collectClassConstants(source: string): Map<string, string> {
  const map = new Map<string, string>()
  const re = /^const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\r?\n\s*)?(['"`])((?:\\.|(?!\2)[\s\S])*?)\2/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) map.set(m[1], m[3])
  return map
}

/**
 * 여는 태그 원문에서 className 에 **나타날 수 있는 정적 클래스 토큰**을 전부 모은다.
 * `clsx(...)` · 템플릿 리터럴 · 조건부 삼항 안의 문자열 · 알려진 클래스 상수까지 포함한
 * **초집합**이다. 초집합이므로 "44px 을 보장하는 토큰이 있다" 는 판정이 낙관적일 수 있지만,
 * 그 방향의 오차는 **오탐이 아니라 미탐** — 설계상 허용한다.
 */
export function collectClassTokens(
  rawTag: string,
  consts: Map<string, string> = new Map(),
): { tokens: string[]; hasDynamic: boolean } {
  const cls = extractAttributeSource(rawTag, 'className')
  if (cls === null) return { tokens: [], hasDynamic: false }

  const tokens: string[] = []
  let hasDynamic = false

  const push = (text: string): void => {
    for (const t of text.split(/\s+/)) if (t) tokens.push(t)
  }

  // 표현식을 훑으며 **모든 문자열 리터럴 내용**을 모은다. 템플릿 리터럴은 정적 구간을 취하고
  // `${...}` 안으로 재귀한다 — 조건부 클래스 `${a ? 'x' : 'y'}` 까지 초집합에 들어온다.
  const walk = (src: string): void => {
    let i = 0
    while (i < src.length) {
      const c = src[i]
      if (c === '"' || c === "'") {
        const end = skipQuoted(src, i, c)
        push(src.slice(i + 1, end - 1))
        i = end
        continue
      }
      if (c === '`') {
        const end = skipTemplate(src, i)
        walkTemplate(src.slice(i + 1, end - 1))
        i = end
        continue
      }
      if (/[A-Za-z_$]/.test(c)) {
        const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i))
        const word = m ? m[0] : c
        const known = consts.get(word)
        if (known !== undefined) push(known)
        // clsx/cn 같은 조립 헬퍼 이름 자체는 "동적" 근거가 아니다 (인자는 위에서 다 읽는다)
        else if (!/^(clsx|cn|classNames|twMerge|tw|join|filter|Boolean|true|false|undefined|null)$/.test(word)) {
          hasDynamic = true
        }
        i += word.length
        continue
      }
      i += 1
    }
  }

  const walkTemplate = (body: string): void => {
    let i = 0
    let buf = ''
    while (i < body.length) {
      if (body[i] === '\\') {
        buf += body.slice(i, i + 2)
        i += 2
        continue
      }
      if (body[i] === '$' && body[i + 1] === '{') {
        push(buf)
        buf = ''
        const start = i + 2
        let depth = 1
        i = start
        while (i < body.length && depth > 0) {
          const ch = body[i]
          if (ch === '"' || ch === "'") {
            i = skipQuoted(body, i, ch)
            continue
          }
          if (ch === '`') {
            i = skipTemplate(body, i)
            continue
          }
          if (ch === '{') depth += 1
          else if (ch === '}') {
            depth -= 1
            if (depth === 0) break
          }
          i += 1
        }
        walk(body.slice(start, i))
        i += 1
        continue
      }
      buf += body[i]
      i += 1
    }
    push(buf)
  }

  walk(cls)
  return { tokens, hasDynamic }
}

/**
 * `attr="..."` 이면 따옴표를 **포함한** 원문을, `attr={...}` 이면 중괄호 안 표현식 원문을
 * 돌려준다. (collectClassTokens 가 리터럴을 직접 훑으므로 따옴표가 남아 있어야 한다.)
 */
function extractAttributeSource(rawTag: string, attr: string): string | null {
  const re = new RegExp(`(?:^|[\\s{])${attr}\\s*=\\s*`, 'g')
  const m = re.exec(rawTag)
  if (!m) return null
  const start = m.index + m[0].length
  const c = rawTag[start]
  if (c === '"' || c === "'") return rawTag.slice(start, skipQuoted(rawTag, start, c))
  if (c === '{') {
    const end = matchBrace(rawTag, start)
    return end < 0 ? null : rawTag.slice(start + 1, end)
  }
  return null
}

function matchBrace(src: string, start: number): number {
  let depth = 0
  let i = start
  while (i < src.length) {
    const ch = src[i]
    if (ch === '"' || ch === "'") {
      i = skipQuoted(src, i, ch)
      continue
    }
    if (ch === '`') {
      i = skipTemplate(src, i)
      continue
    }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return i
    }
    i += 1
  }
  return -1
}

/** `attr="..."` 또는 `attr={...}` 의 값 원문을 뽑는다. 없으면 null. */
export function extractAttributeExpression(rawTag: string, attr: string): string | null {
  const re = new RegExp(`(?:^|[\\s{])${attr}\\s*=\\s*`, 'g')
  const m = re.exec(rawTag)
  if (!m) return null
  const start = m.index + m[0].length
  const c = rawTag[start]
  if (c === '"' || c === "'") return rawTag.slice(start + 1, skipQuoted(rawTag, start, c) - 1)
  if (c === '{') {
    let depth = 0
    let i = start
    while (i < rawTag.length) {
      const ch = rawTag[i]
      if (ch === '"' || ch === "'") {
        i = skipQuoted(rawTag, i, ch)
        continue
      }
      if (ch === '`') {
        i = skipTemplate(rawTag, i)
        continue
      }
      if (ch === '{') depth += 1
      else if (ch === '}') {
        depth -= 1
        if (depth === 0) return rawTag.slice(start + 1, i)
      }
      i += 1
    }
  }
  return null
}

// ── 높이 판정 ────────────────────────────────────────────────────────────────

/** `[44px]` `[2.75rem]` `[3.5em]` 같은 임의값을 px 로. 판정 불가면 null. */
function arbitraryToPx(value: string): number | null {
  const px = /^(\d+(?:\.\d+)?)px$/.exec(value)
  if (px) return Number(px[1])
  const rem = /^(\d+(?:\.\d+)?)rem$/.exec(value)
  if (rem) return Number(rem[1]) * 16
  return null
}

interface HeightSignal {
  /** 44px 이상을 보장한다 */
  guarantees: boolean
  /** 44px 미만을 확정한다 */
  definitelySmall: boolean
  token: string
}

function classifyToken(token: string): HeightSignal | null {
  // variant prefix (sm: · hover: · md: 등) 는 조건부라 높이를 "보장" 하지 않는다.
  // 단, 반응형 축소는 위반을 만들 수 있으므로 확정 판정에서도 제외한다 (보수적).
  const raw = token.includes(':') ? token.slice(token.lastIndexOf(':') + 1) : token
  // `h-s-8` → `h-8` 로 정규화 (s- 스케일도 N×4px)
  const bare = raw.replace(/^(min-h|h|size|py|p)-s-/, '$1-')
  const isVariant = token.includes(':')

  // 탭 영역 확장 패턴 — `after:h-11` · `after:min-h-[44px]` 처럼 **의사요소로 히트 영역만**
  // 넓힌 경우를 보장으로 인정한다. 시각 크기(h-8 등)는 그대로 두고 탭만 44px 로 키우는 수법이라
  // 표 안 촘촘한 행을 벌리지 않는다.
  if (/^(after|before):/.test(token)) {
    const arb = /(?:min-h|h)-\[([^\]]+)\]$/.exec(token)
    if (arb) {
      const px = arbitraryToPx(arb[1])
      if (px !== null && px >= MIN_TOUCH_PX) return { guarantees: true, definitelySmall: false, token }
      return null
    }
    const scale = /(?:min-h|h|size)-(\d+(?:\.5)?)$/.exec(token)
    if (scale && Number(scale[1]) * UNIT_PX >= MIN_TOUCH_PX) {
      return { guarantees: true, definitelySmall: false, token }
    }
    return null
  }
  if (isVariant) return null

  // min-h-[NNpx] / min-h-N / h-[NNpx] / h-N / size-N / size-[NNpx]
  // `s-N` 은 이 저장소 전용 spacing 스케일(tailwind.config.ts) — 값은 기본 스케일과 같은 N×4px.
  const arb = /^(min-h|h|size)-\[([^\]]+)\]$/.exec(bare)
  if (arb) {
    const px = arbitraryToPx(arb[2])
    if (px === null) return null
    return { guarantees: px >= MIN_TOUCH_PX, definitelySmall: px < MIN_TOUCH_PX, token }
  }
  const scale = /^(min-h|h|size)-(\d+(?:\.5)?)$/.exec(bare)
  if (scale) {
    const px = Number(scale[2]) * UNIT_PX
    return { guarantees: px >= MIN_TOUCH_PX, definitelySmall: px < MIN_TOUCH_PX, token }
  }
  // h-full · h-auto · min-h-full 등 — 부모가 정한다. 판정 불가.
  if (/^(min-h|h)-(full|auto|screen|fit|min|max|dvh|svh|lvh)$/.test(bare)) {
    return { guarantees: false, definitelySmall: false, token }
  }
  return null
}

/** py-N / p-N 만으로 높이가 결정될 때의 총 높이(어림). 없으면 null. */
function paddingHeightPx(tokens: string[]): { px: number; token: string } | null {
  let best: { px: number; token: string } | null = null
  for (const token of tokens) {
    if (token.includes(':')) continue
    // `py-s-2` → `py-2` (s- 스케일도 N×4px)
    const bare = token.replace(/^(py|p)-s-/, '$1-')
    const m = /^(py|p)-(\d+(?:\.5)?)$/.exec(bare)
    if (m) {
      const px = Number(m[2]) * UNIT_PX * 2 + LINE_PX
      if (!best || px > best.px) best = { px, token }
      continue
    }
    const arb = /^(py|p)-\[([^\]]+)\]$/.exec(bare)
    if (arb) {
      const one = arbitraryToPx(arb[2])
      if (one === null) continue
      const px = one * 2 + LINE_PX
      if (!best || px > best.px) best = { px, token }
    }
  }
  return best
}

// ── 요소 판정 ────────────────────────────────────────────────────────────────

/** 이 여는 태그가 터치 타깃 판정 대상인가. 대상이면 표시용 태그명을 돌려준다. */
export function interactiveKind(rawTag: string, tag: string): string | null {
  if (/\brole\s*=\s*["']button["']/.test(rawTag)) return `${tag}[role=button]`
  if (!INTERACTIVE_TAGS.has(tag)) return null
  if (tag === 'input') {
    const type = extractAttributeExpression(rawTag, 'type')
    if (type === null) return null
    if (/checkbox|radio/.test(type)) return 'input[checkbox|radio]'
    // 텍스트 입력류도 터치 타깃이다
    if (/^(text|search|number|email|password|url|date|tel)$/.test(type.trim())) return `input[${type.trim()}]`
    return null
  }
  if (tag === 'textarea') return null // 여러 줄 — 높이가 본질적으로 크다
  if (tag === 'a' || tag === 'Link') {
    // 본문 안의 인라인 링크(className 없음)는 터치 타깃 규칙 대상이 아니다
    if (extractAttributeExpression(rawTag, 'className') === null) return null
    return tag
  }
  return tag
}

export function judgeTag(
  rawTag: string,
  tag: string,
  consts: Map<string, string> = new Map(),
): { verdict: Verdict; reason: string } {
  const { tokens, hasDynamic } = collectClassTokens(rawTag, consts)

  let guaranteeToken: string | null = null
  let smallToken: string | null = null
  let neutralHeight = false
  for (const t of tokens) {
    const sig = classifyToken(t)
    if (!sig) continue
    if (sig.guarantees) guaranteeToken = sig.token
    else if (sig.definitelySmall) smallToken ??= sig.token
    else neutralHeight = true
  }

  if (guaranteeToken) return { verdict: 'pass', reason: guaranteeToken }
  if (smallToken) return { verdict: 'violation', reason: smallToken }
  if (neutralHeight) return { verdict: 'undecidable', reason: '부모가 높이를 정함 (h-full/auto)' }

  const pad = paddingHeightPx(tokens)
  if (pad) {
    if (pad.px >= MIN_TOUCH_PX) return { verdict: 'pass', reason: `${pad.token} (≈${pad.px}px)` }
    return { verdict: 'violation', reason: `${pad.token} 뿐 (≈${pad.px}px)` }
  }

  if (hasDynamic) return { verdict: 'undecidable', reason: 'className 이 동적 — 정적 높이 토큰 없음' }
  if (tokens.length === 0) return { verdict: 'undecidable', reason: 'className 없음' }
  return { verdict: 'undecidable', reason: '높이 클래스 없음 — 내용이 높이를 정함' }
}

// ── 스캔 ─────────────────────────────────────────────────────────────────────

export function scanFile(absPath: string, repoRoot: string): Finding[] {
  const source = readFileSync(absPath, 'utf8')
  const rel = relative(repoRoot, absPath).split(sep).join('/')
  const consts = collectClassConstants(source)
  const findings: Finding[] = []
  for (const t of extractOpenTags(source)) {
    const kind = interactiveKind(t.raw, t.tag)
    if (!kind) continue
    const { verdict, reason } = judgeTag(t.raw, t.tag, consts)
    findings.push({
      file: rel,
      line: source.slice(0, t.index).split('\n').length,
      tag: kind,
      verdict,
      reason,
      excerpt: t.raw.replace(/\s+/g, ' ').slice(0, 120),
    })
  }
  return findings
}

export function scanAdmin(webSrcDir: string, repoRoot: string): Finding[] {
  return listAdminSourceFiles(webSrcDir).flatMap((f) => scanFile(f, repoRoot))
}
